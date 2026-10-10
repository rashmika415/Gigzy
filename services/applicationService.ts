import {
  collection,
  doc,
  getDoc,
  getDocs,
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

      if (businessId === input.youthId) {
        throw new Error('You cannot apply to your own gig.');
      }

      // 3. Validate applicant role
      const youthDoc = await transaction.get(youthDocRef);
      const youthData = youthDoc.exists() ? youthDoc.data() : null;
      if (youthData && youthData.role && youthData.role !== 'freelancer' && youthData.role !== 'youth') {
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

    // Send in-app notification to business owner
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
    console.error('Error in getApplicationsForBusiness:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Accepts an application. Validates business ownership and pending status.
 */
export async function acceptApplication(applicationId: string, businessId?: string): Promise<void> {
  const effectiveBusinessId = businessId || auth?.currentUser?.uid;
  const appRef = doc(db, 'applications', applicationId);

  let acceptedData: any = null;

  try {
    await runTransaction(db, async (transaction) => {
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists()) {
        throw new Error('Application not found.');
      }

      const data = appSnap.data();
      if (effectiveBusinessId && data.businessId !== effectiveBusinessId) {
        throw new Error('Unauthorized. You can only manage applications for your own gigs.');
      }

      if (data.status !== 'pending') {
        throw new Error(`Cannot accept an application that is already ${data.status}.`);
      }

      // Read gig document if available (must be read before any writes in Firestore transaction)
      const gigDocRef = data.gigId ? doc(db, 'gigs', data.gigId) : null;
      let gigExists = false;
      let gigData: any = null;
      if (gigDocRef) {
        try {
          const gigSnap = await transaction.get(gigDocRef);
          gigExists = gigSnap.exists();
          if (gigExists) {
            gigData = gigSnap.data();
          }
        } catch {
          gigExists = false;
        }
      }

      // Ensure gig is open and not already assigned or in progress (prevent double accept)
      if (gigExists && gigData) {
        if (
          gigData.status === 'in-progress' ||
          gigData.status === 'completed' ||
          gigData.status === 'filled' ||
          gigData.status === 'closed' ||
          Boolean(gigData.assignedYouthId)
        ) {
          throw new Error('This gig has already been accepted and is in progress. A youth cannot be accepted twice for this gig.');
        }
      }

      // Update application status
      transaction.update(appRef, {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });

      // Update gig status to in-progress
      if (gigDocRef && gigExists) {
        transaction.update(gigDocRef, {
          status: 'in-progress',
          assignedYouthId: data.youthId,
          acceptedApplicationId: applicationId,
          updatedAt: serverTimestamp(),
        });
      }

      acceptedData = data;
    });

    // Send in-app notification to youth freelancer
    if (acceptedData && acceptedData.youthId) {
      try {
        await sendNotification(acceptedData.youthId, {
          userId: acceptedData.youthId,
          type: 'application',
          title: 'Application Accepted! 🎉',
          body: `Great news! ${acceptedData.businessName || 'The business owner'} accepted your application for "${acceptedData.gigTitle || 'the gig'}". Work is now in progress and a notification has been sent to your dashboard!`,
          read: false,
          route: `/(app)/gig/${acceptedData.gigId}`,
          entityId: applicationId,
        });
      } catch (notifErr) {
        console.warn('Could not deliver acceptance notification:', notifErr);
      }
    }
  } catch (error: any) {
    if (error.message && (
      error.message.includes('Unauthorized') ||
      error.message.includes('Cannot accept') ||
      error.message.includes('cannot be accepted twice') ||
      error.message.includes('already been accepted') ||
      error.message.includes('not found')
    )) {
      throw error;
    }
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Rejects an application. Validates business ownership and pending status.
 */
export async function rejectApplication(applicationId: string, businessId?: string): Promise<void> {
  const effectiveBusinessId = businessId || auth?.currentUser?.uid;
  const appRef = doc(db, 'applications', applicationId);

  let rejectedData: any = null;

  try {
    await runTransaction(db, async (transaction) => {
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists()) {
        throw new Error('Application not found.');
      }

      const data = appSnap.data();
      if (effectiveBusinessId && data.businessId !== effectiveBusinessId) {
        throw new Error('Unauthorized. You can only manage applications for your own gigs.');
      }

      if (data.status !== 'pending') {
        throw new Error(`Cannot reject an application that is already ${data.status}.`);
      }

      transaction.update(appRef, {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });

      rejectedData = data;
    });

    // Send in-app notification to youth freelancer
    if (rejectedData && rejectedData.youthId) {
      try {
        await sendNotification(rejectedData.youthId, {
          userId: rejectedData.youthId,
          type: 'application',
          title: 'Application Status Update',
          body: `Your application for "${rejectedData.gigTitle || 'the gig'}" was not selected this time.`,
          read: false,
          route: `/(app)/gig/${rejectedData.gigId}`,
          entityId: applicationId,
        });
      } catch (notifErr) {
        console.warn('Could not deliver rejection notification:', notifErr);
      }
    }
  } catch (error: any) {
    if (error.message && (
      error.message.includes('Unauthorized') ||
      error.message.includes('Cannot reject') ||
      error.message.includes('not found')
    )) {
      throw error;
    }
    throw new Error(parseFirebaseError(error));
  }
}
