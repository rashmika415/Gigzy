import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db, auth } from '../FirebaseConfig';
import { Application, CreateApplicationInput } from '../types/application';
import { parseFirebaseError } from './gigService';
import { sendNotification } from './notificationService';

/**
 * Derives a deterministic application ID based on gigId and youthId.
 * Guarantees atomic duplicate application prevention (one youth + one gig = one application).
 */
export function deriveApplicationId(gigId: string, youthId: string): string {
  return `app_${gigId}_${youthId}`;
}

/**
 * Submits a new application with atomic duplicate prevention and gig status validation.
 */
export async function createApplication(input: CreateApplicationInput): Promise<Application> {
  const cleanMessage = (input.message || '').trim();
  if (!cleanMessage || cleanMessage.length < 5) {
    throw new Error('Please provide an application message explaining why you are suitable (at least 5 characters).');
  }
  if (cleanMessage.length > 500) throw new Error('Keep your application message within 500 characters.');

  if (!input.availabilityConfirmed) {
    throw new Error('You must confirm your availability on the required date and time to apply.');
  }

  if (!input.youthId) {
    throw new Error('Authentication required. Please sign in to apply.');
  }

  if (auth && auth.currentUser && auth.currentUser.uid !== input.youthId) {
    throw new Error('Unauthorized. You can only submit applications for yourself.');
  }

  if (!input.gigId) {
    throw new Error('A valid gig must be selected to apply.');
  }

  const appId = deriveApplicationId(input.gigId, input.youthId);
  const appDocRef = doc(db, 'applications', appId);
  const gigDocRef = doc(db, 'gigs', input.gigId);
  const youthDocRef = doc(db, 'users', input.youthId);

  try {
    let createdApp: Application | null = null;

    await runTransaction(db, async (transaction) => {
      // 1. Check if application already exists
      const existingAppDoc = await transaction.get(appDocRef);
      if (existingAppDoc.exists()) {
        throw new Error('You have already applied to this gig.');
      }

      // 2. Validate gig exists and is open
      const gigDoc = await transaction.get(gigDocRef);
      if (!gigDoc.exists()) {
        throw new Error('This gig does not exist or has been removed.');
      }

      const gigData = gigDoc.data();
      if (gigData.status !== 'open') {
        throw new Error('This gig is no longer accepting applications.');
      }

      const businessId =
        gigData.postedBy?.uid ||
        gigData.postedBy?.id ||
        gigData.clientId ||
        gigData.userId ||
        gigData.ownerId ||
        input.businessId;

      if (!businessId) {
        throw new Error('Gig business owner could not be identified.');
      }

      if (businessId === input.youthId && process.env.NODE_ENV === 'production') {
        throw new Error('You cannot apply to your own gig.');
      }

      // 3. Validate applicant role
      const youthDoc = await transaction.get(youthDocRef);
      const youthData = youthDoc.exists() ? youthDoc.data() : null;
      if (youthData && youthData.role && youthData.role !== 'freelancer' && youthData.role !== 'youth' && process.env.NODE_ENV === 'production') {
        throw new Error('Only youth freelancers can apply to gigs.');
      }

      const businessName =
        input.businessName ||
        gigData.postedBy?.fullName ||
        gigData.postedBy?.name ||
        gigData.businessName ||
        'Business Owner';

      const youthRatingAverage =
        input.youthRatingAverage !== undefined
          ? input.youthRatingAverage
          : (youthData?.ratingAverage ?? null);
      const youthRatingCount =
        input.youthRatingCount !== undefined
          ? input.youthRatingCount
          : (youthData?.ratingCount ?? null);

      // 4. Assemble document data
      const newAppData: Record<string, any> = {
        applicationId: appId,
        gigId: input.gigId,
        youthId: input.youthId,
        businessId,
        message: cleanMessage,
        availabilityConfirmed: true,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Snapshot gig info for fast querying without N+1 lookups
        gigTitle: input.gigTitle || gigData.title || '',
        gigLocation: input.gigLocation || gigData.location || '',
        gigDate: input.gigDate || gigData.date || '',
        gigPay: input.gigPay !== undefined ? input.gigPay : (gigData.pay ?? null),
        gigPayType: input.gigPayType || gigData.payType || 'fixed',
        gigCategory: input.gigCategory || gigData.category || '',
        businessName,
        // Snapshot applicant info
        youthName: input.youthName || youthData?.fullName || youthData?.name || 'Youth Freelancer',
        youthPhotoURL: input.youthPhotoURL || youthData?.photoURL || '',
        youthSkills: input.youthSkills || youthData?.skillBadges || youthData?.skills || [],
        youthBio: input.youthBio || youthData?.bio || '',
        youthRatingAverage,
        youthRatingCount,
      };

      // 5. Commit atomic writes
      transaction.set(appDocRef, newAppData);
      transaction.update(gigDocRef, {
        applicantsCount: increment(1),
      });

      createdApp = {
        id: appId,
        ...newAppData,
      } as Application;
    });

    if (!createdApp) {
      throw new Error('Failed to create application.');
    }

    // Send the complete application details once, after the application commits.
    const targetBusinessId = (createdApp as Application).businessId;
    if (targetBusinessId) {
      try {
        await sendNotification(targetBusinessId, {
          userId: targetBusinessId,
          type: 'application',
          title: 'New Applicant! 📬',
          body: `${(createdApp as Application).youthName || 'A youth freelancer'} applied for "${(createdApp as Application).gigTitle || 'your gig'}". Review their application now!`,
          read: false,
          route: '/(app)/applications',
          entityId: (createdApp as Application).id,
        });
      } catch (notifErr) {
        console.warn('Could not deliver application notification to business owner:', notifErr);
      }
    }

    return createdApp;
  } catch (error: any) {
    if (error.message && (
      error.message.includes('already applied') ||
      error.message.includes('no longer accepting') ||
      error.message.includes('at least 5 characters') ||
      error.message.includes('availability') ||
      error.message.includes('own gig') ||
      error.message.includes('freelancers')
    )) {
      throw error;
    }
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Checks if a youth has already applied to a specific gig.
 */
export async function hasApplied(gigId: string, youthId: string): Promise<boolean> {
  try {
    const appId = deriveApplicationId(gigId, youthId);
    const snap = await getDoc(doc(db, 'applications', appId));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Retrieves the application for a specific gig and youth if one exists.
 */
export async function getUserApplicationForGig(gigId: string, youthId: string): Promise<Application | null> {
  try {
    const appId = deriveApplicationId(gigId, youthId);
    const snap = await getDoc(doc(db, 'applications', appId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
    } as Application;
  } catch (error) {
    console.error('Error in getUserApplicationForGig:', error);
    return null;
  }
}

/**
 * Real-time listener for an individual application status on a gig page.
 */
export function subscribeToUserApplicationForGig(
  gigId: string,
  youthId: string,
  onUpdate: (app: Application | null) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const appId = deriveApplicationId(gigId, youthId);
    const appDocRef = doc(db, 'applications', appId);

    return onSnapshot(
      appDocRef,
      (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
        } else {
          onUpdate({
            id: snap.id,
            ...snap.data(),
          } as Application);
        }
      },
      (err) => {
        if (onError) onError(new Error(parseFirebaseError(err)));
      }
    );
  } catch (err: any) {
    if (onError) onError(new Error(parseFirebaseError(err)));
    return () => {};
  }
}

/**
 * Fetches all applications submitted by a specific youth.
 */
export async function getMyApplications(youthId: string): Promise<Application[]> {
  try {
    const q = query(
      collection(db, 'applications'),
      where('youthId', '==', youthId)
    );
    const snapshot = await getDocs(q);
    const apps = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Application[];

    return apps.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (error: any) {
    console.error('Error in getMyApplications:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Real-time listener for all applications submitted by a youth.
 */
export function subscribeToMyApplications(
  youthId: string,
  onUpdate: (apps: Application[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, 'applications'),
      where('youthId', '==', youthId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const apps = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Application[];

        const sorted = apps.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        onUpdate(sorted);
      },
      (error) => {
        if (onError) onError(new Error(parseFirebaseError(error)));
      }
    );
  } catch (err: any) {
    if (onError) onError(new Error(parseFirebaseError(err)));
    return () => {};
  }
}

/**
 * Fetches all applicants for a specific gig (for the business owner).
 * Uses businessId constraint to guarantee authorization under Firestore security rules.
 */
export async function getApplicantsForGig(
  gigId: string,
  businessId?: string
): Promise<Application[]> {
  try {
    const effectiveBusinessId = businessId || auth?.currentUser?.uid;
    let docs: any[] = [];

    if (effectiveBusinessId && gigId) {
      try {
        const q = query(
          collection(db, 'applications'),
          where('businessId', '==', effectiveBusinessId),
          where('gigId', '==', gigId)
        );
        const snapshot = await getDocs(q);
        docs = snapshot.docs;
      } catch {
        // Fallback: Query by businessId and filter by gigId in-memory
        const fallbackQ = query(
          collection(db, 'applications'),
          where('businessId', '==', effectiveBusinessId)
        );
        const fallbackSnap = await getDocs(fallbackQ);
        docs = fallbackSnap.docs.filter((d) => d.data().gigId === gigId);
      }
    } else if (effectiveBusinessId) {
      const q = query(
        collection(db, 'applications'),
        where('businessId', '==', effectiveBusinessId)
      );
      const snapshot = await getDocs(q);
      docs = snapshot.docs;
    } else {
      const q = query(
        collection(db, 'applications'),
        where('gigId', '==', gigId)
      );
      const snapshot = await getDocs(q);
      docs = snapshot.docs;
    }

    const apps = docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Application[];

    return apps.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (error: any) {
    console.error('Error in getApplicantsForGig:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Real-time listener for applicants on a gig.
 * Supports both:
 *   subscribeToGigApplicants(gigId, businessId, onUpdate, onError)
 *   subscribeToGigApplicants(gigId, onUpdate, onError)
 */
export function subscribeToGigApplicants(
  gigId: string,
  onUpdate: (apps: Application[]) => void,
  onError?: (error: Error) => void
): () => void;
export function subscribeToGigApplicants(
  gigId: string,
  businessId: string | undefined,
  onUpdate: (apps: Application[]) => void,
  onError?: (error: Error) => void
): () => void;
export function subscribeToGigApplicants(
  gigId: string,
  businessIdOrOnUpdate?: string | ((apps: Application[]) => void),
  onUpdateOrOnError?: ((apps: Application[]) => void) | ((error: Error) => void),
  optionalOnError?: (error: Error) => void
): () => void {
  try {
    let businessId: string | undefined;
    let onUpdate: (apps: Application[]) => void = () => {};
    let onError: ((error: Error) => void) | undefined;

    if (typeof businessIdOrOnUpdate === 'function') {
      businessId = undefined;
      onUpdate = businessIdOrOnUpdate;
      onError = typeof onUpdateOrOnError === 'function' ? (onUpdateOrOnError as (e: Error) => void) : undefined;
    } else {
      businessId = businessIdOrOnUpdate;
      onUpdate = typeof onUpdateOrOnError === 'function' ? (onUpdateOrOnError as (apps: Application[]) => void) : () => {};
      onError = optionalOnError;
    }

    const effectiveBusinessId = businessId || auth?.currentUser?.uid;

    const sortApps = (rawDocs: any[]): Application[] => {
      const apps = rawDocs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Application[];

      return apps.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    };

    if (effectiveBusinessId && gigId) {
      const q = query(
        collection(db, 'applications'),
        where('businessId', '==', effectiveBusinessId),
        where('gigId', '==', gigId)
      );

      let unsubscribeFallback: (() => void) | null = null;

      const unsubscribePrimary = onSnapshot(
        q,
        (snapshot) => {
          onUpdate(sortApps(snapshot.docs));
        },
        () => {
          // If compound query fails (e.g. index/permission rule evaluation), fallback to businessId query
          try {
            const fallbackQ = query(
              collection(db, 'applications'),
              where('businessId', '==', effectiveBusinessId)
            );
            unsubscribeFallback = onSnapshot(
              fallbackQ,
              (fallbackSnap) => {
                const filtered = fallbackSnap.docs.filter((d) => d.data().gigId === gigId);
                onUpdate(sortApps(filtered));
              },
              (fallbackErr) => {
                if (onError) onError(new Error(parseFirebaseError(fallbackErr)));
              }
            );
          } catch (e: any) {
            if (onError) onError(new Error(parseFirebaseError(e)));
          }
        }
      );

      return () => {
        unsubscribePrimary();
        if (unsubscribeFallback) unsubscribeFallback();
      };
    } else if (effectiveBusinessId) {
      const q = query(
        collection(db, 'applications'),
        where('businessId', '==', effectiveBusinessId)
      );
      return onSnapshot(
        q,
        (snapshot) => onUpdate(sortApps(snapshot.docs)),
        (err) => { if (onError) onError(new Error(parseFirebaseError(err))); }
      );
    } else {
      const q = query(
        collection(db, 'applications'),
        where('gigId', '==', gigId)
      );
      return onSnapshot(
        q,
        (snapshot) => onUpdate(sortApps(snapshot.docs)),
        (err) => { if (onError) onError(new Error(parseFirebaseError(err))); }
      );
    }
  } catch (err: any) {
    if (optionalOnError) optionalOnError(new Error(parseFirebaseError(err)));
    return () => {};
  }
}

/**
 * Real-time listener for all applications received by a business owner across all their gigs.
 */
export function subscribeToBusinessApplications(
  businessId?: string,
  onUpdate: (apps: Application[]) => void = () => {},
  onError?: (error: Error) => void
): () => void {
  try {
    const effectiveBusinessId = businessId || auth?.currentUser?.uid;
    if (!effectiveBusinessId) {
      onUpdate([]);
      return () => {};
    }

    const q = query(
      collection(db, 'applications'),
      where('businessId', '==', effectiveBusinessId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const apps = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            applicationId: data.applicationId || d.id,
          };
        }) as Application[];

        const sorted = apps.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        onUpdate(sorted);
      },
      (error) => {
        if (onError) onError(new Error(parseFirebaseError(error)));
      }
    );
  } catch (err: any) {
    if (onError) onError(new Error(parseFirebaseError(err)));
    return () => {};
  }
}

/**
 * Fetches all applications received by a business owner across all their gigs.
 */
export async function getApplicationsForBusiness(businessId?: string): Promise<Application[]> {
  try {
    const effectiveBusinessId = businessId || auth?.currentUser?.uid;
    if (!effectiveBusinessId) return [];

    const q = query(
      collection(db, 'applications'),
      where('businessId', '==', effectiveBusinessId)
    );
    const snapshot = await getDocs(q);
    const apps = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        applicationId: data.applicationId || d.id,
      };
    }) as Application[];

    return apps.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (error: any) {
    console.error('Error in getApplicationsForBusiness:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/** Persist the decision notification with its application update. */
function writeDecisionNotification(transaction: Parameters<Parameters<typeof runTransaction>[1]>[0], applicationId: string, data: Application, accepted: boolean) {
  transaction.set(doc(db, 'users', data.youthId, 'notifications', `application-${accepted ? 'accepted' : 'rejected'}-${applicationId}`), {
    userId: data.youthId, type: 'application',
    title: accepted ? 'Application Accepted!' : 'Application Status Update',
    body: accepted
      ? `${data.businessName || 'The business owner'} accepted your application for "${data.gigTitle || 'the gig'}".`
      : `Your application for "${data.gigTitle || 'the gig'}" was not selected this time.`,
    read: false, route: `/(app)/gig/${data.gigId}`, entityId: applicationId, createdAt: serverTimestamp(),
  });
}

function requireBusinessActor(businessId?: string): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in to manage applications.');
  if (businessId && businessId !== uid) throw new Error('Unauthorized. You can only manage applications for your own gigs.');
  return uid;
}

/** Accept one pending applicant and reserve the gig atomically. */
export async function acceptApplication(applicationId: string, businessId?: string): Promise<void> {
  const uid = requireBusinessActor(businessId);
  let acceptedData: any = null;
  await runTransaction(db, async transaction => {
    const appRef = doc(db, 'applications', applicationId);
    const appSnap = await transaction.get(appRef);
    if (!appSnap.exists()) throw new Error('Application not found.');
    const data = appSnap.data() as Application;
    if (data.businessId !== uid) throw new Error('Unauthorized. You can only manage applications for your own gigs.');
    if (data.status !== 'pending') throw new Error(`Cannot accept an application that is already ${data.status}.`);
    const gigRef = doc(db, 'gigs', data.gigId);
    const gigSnap = await transaction.get(gigRef);
    if (!gigSnap.exists()) throw new Error('Gig not found.');
    const gig = gigSnap.data();
    if (gig.postedBy?.uid !== uid) throw new Error('Unauthorized. You can only manage applications for your own gigs.');
    if (gig.status !== 'open' || gig.assignedYouthId || gig.acceptedApplicationId || gig.moderationRemoved) {
      throw new Error('This gig has already been accepted or is no longer open. A youth cannot be accepted twice for this gig.');
    }
    transaction.update(appRef, { status: 'accepted', conversationId: `conv_${applicationId}`, updatedAt: serverTimestamp() });
    transaction.update(gigRef, {
      status: 'in-progress', assignedYouthId: data.youthId,
      assignedYouthName: data.youthName || 'Youth Freelancer',
      assignedYouthPhotoURL: data.youthPhotoURL || '',
      acceptedApplicationId: applicationId, conversationId: `conv_${applicationId}`,
      updatedAt: serverTimestamp(),
    });
    writeDecisionNotification(transaction, applicationId, data, true);
    acceptedData = { ...data, gigScheduleDate: gig.date, gigScheduleTime: gig.time, gigScheduleLocation: gig.location };
  });

  // Automatically initialize/ensure the direct in-app conversation between business and youth applicant
  if (acceptedData && acceptedData.youthId && acceptedData.businessId) {
    try {
      const convId = `conv_${applicationId}`;
      const convRef = doc(db, 'conversations', convId);
      let convSnap: any = null;
      try {
        convSnap = await getDoc(convRef);
      } catch {}
      if (!convSnap || !convSnap.exists()) {
        const newConvData: Record<string, any> = {
          conversationId: convId,
          applicationId,
          gigId: acceptedData.gigId || '',
          youthId: acceptedData.youthId,
          businessId: acceptedData.businessId,
          participants: [acceptedData.youthId, acceptedData.businessId],
          participantDetails: {
            [acceptedData.youthId]: {
              uid: acceptedData.youthId,
              fullName: acceptedData.youthName || 'Youth Freelancer',
              photoURL: acceptedData.youthPhotoURL || '',
              role: 'freelancer',
            },
            [acceptedData.businessId]: {
              uid: acceptedData.businessId,
              fullName: acceptedData.businessName || 'Business Client',
              photoURL: '',
              role: 'client',
            },
          },
          gigTitle: acceptedData.gigTitle || 'Gig',
          gigPay: acceptedData.gigPay || 0,
          gigPayType: acceptedData.gigPayType || 'fixed',
          gigCategory: acceptedData.gigCategory || '',
          gigDate: acceptedData.gigDate || acceptedData.gigScheduleDate || '',
          gigTime: acceptedData.gigTime || acceptedData.gigScheduleTime || '',
          gigLocation: acceptedData.gigLocation || acceptedData.gigScheduleLocation || '',
          lastMessage: '🎉 Application accepted! You can now chat directly.',
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unreadCount: {
            [acceptedData.youthId]: 1,
            [acceptedData.businessId]: 0,
          },
        };
        await setDoc(convRef, newConvData, { merge: true });

        // Add initial welcome/system message to the messages subcollection
        const messagesRef = collection(db, 'conversations', convId, 'messages');
        await addDoc(messagesRef, {
          conversationId: convId,
          senderId: acceptedData.businessId,
          receiverId: acceptedData.youthId,
          senderName: acceptedData.businessName || 'Business Client',
          senderPhotoURL: '',
          text: `🎉 Application accepted for "${acceptedData.gigTitle || 'this gig'}". You can now discuss instructions, schedules, and deliverables here.`,
          type: 'system',
          read: false,
          readBy: [acceptedData.businessId],
          createdAt: serverTimestamp(),
        });
      }
    } catch (convErr) {
      console.warn('Could not initialize conversation on application acceptance:', convErr);
    }
  }
}

/** Reject a pending application; other applicants remain available for review. */
export async function rejectApplication(applicationId: string, businessId?: string): Promise<void> {
  const uid = requireBusinessActor(businessId);
  await runTransaction(db, async transaction => {
    const appRef = doc(db, 'applications', applicationId);
    const snapshot = await transaction.get(appRef);
    if (!snapshot.exists()) throw new Error('Application not found.');
    const data = snapshot.data() as Application;
    if (data.businessId !== uid) throw new Error('Unauthorized. You can only manage applications for your own gigs.');
    if (data.status !== 'pending') throw new Error(`Cannot reject an application that is already ${data.status}.`);
    const gig = await transaction.get(doc(db, 'gigs', data.gigId));
    if (!gig.exists()) throw new Error('Gig not found.');
    if (gig.data().postedBy?.uid !== uid) throw new Error('Unauthorized. You can only manage applications for your own gigs.');
    transaction.update(appRef, { status: 'rejected', updatedAt: serverTimestamp() });
    writeDecisionNotification(transaction, applicationId, data, false);
  });
}
