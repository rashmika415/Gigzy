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
import { db } from '../FirebaseConfig';
import { Application, CreateApplicationInput } from '../types/application';
import { parseFirebaseError } from './gigService';

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

      const businessId = gigData.postedBy?.uid || input.businessId;
      if (!businessId) {
        throw new Error('Gig business owner could not be identified.');
      }

      if (businessId === input.youthId) {
        throw new Error('You cannot apply to your own gig.');
      }

      // 3. Validate applicant role
      const youthDoc = await transaction.get(youthDocRef);
      const youthData = youthDoc.exists() ? youthDoc.data() : null;
      if (youthData && youthData.role && youthData.role !== 'freelancer') {
        throw new Error('Only youth freelancers can apply to gigs.');
      }

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
        businessName: input.businessName || gigData.postedBy?.fullName || 'Business Owner',
        // Snapshot applicant info
        youthName: input.youthName || youthData?.fullName || 'Youth Freelancer',
        youthPhotoURL: input.youthPhotoURL || youthData?.photoURL || '',
        youthSkills: input.youthSkills || youthData?.skillBadges || youthData?.skills || [],
        youthBio: input.youthBio || youthData?.bio || '',
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
 */
export async function getApplicantsForGig(gigId: string): Promise<Application[]> {
  try {
    const q = query(
      collection(db, 'applications'),
      where('gigId', '==', gigId)
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
    console.error('Error in getApplicantsForGig:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Real-time listener for applicants on a gig.
 */
export function subscribeToGigApplicants(
  gigId: string,
  onUpdate: (apps: Application[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, 'applications'),
      where('gigId', '==', gigId)
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
 * Accepts an application. Validates business ownership and pending status.
 */
export async function acceptApplication(applicationId: string, businessId: string): Promise<void> {
  const appRef = doc(db, 'applications', applicationId);

  try {
    await runTransaction(db, async (transaction) => {
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists()) {
        throw new Error('Application not found.');
      }

      const data = appSnap.data();
      if (data.businessId !== businessId) {
        throw new Error('Unauthorized. You can only manage applications for your own gigs.');
      }

      if (data.status !== 'pending') {
        throw new Error(`Cannot accept an application that is already ${data.status}.`);
      }

      transaction.update(appRef, {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error: any) {
    if (error.message && (
      error.message.includes('Unauthorized') ||
      error.message.includes('Cannot accept') ||
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
export async function rejectApplication(applicationId: string, businessId: string): Promise<void> {
  const appRef = doc(db, 'applications', applicationId);

  try {
    await runTransaction(db, async (transaction) => {
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists()) {
        throw new Error('Application not found.');
      }

      const data = appSnap.data();
      if (data.businessId !== businessId) {
        throw new Error('Unauthorized. You can only manage applications for your own gigs.');
      }

      if (data.status !== 'pending') {
        throw new Error(`Cannot reject an application that is already ${data.status}.`);
      }

      transaction.update(appRef, {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
    });
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
