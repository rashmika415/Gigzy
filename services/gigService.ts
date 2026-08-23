import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import {
  Gig,
  GigInput,
  GigValidationErrors,
  GigStatus,
  BusinessGigStats,
  GigFilterOptions,
} from '../types/gig';

/**
 * Translates Firebase / Firestore error codes into human-readable messages.
 */
export function parseFirebaseError(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = error.code || '';
  const message = error.message || '';

  if (code.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
    return 'Permission denied. Please ensure you are logged in to create or view gigs.';
  }
  if (code.includes('unavailable') || message.includes('Failed to get document because the client is offline')) {
    return 'Unable to reach Firestore. Please check your internet connection and try again.';
  }
  if (code.includes('unauthenticated')) {
    return 'Your session has expired. Please log in again.';
  }
  if (code.includes('deadline-exceeded')) {
    return 'The request timed out. Please check your network and try again.';
  }
  if (code.includes('resource-exhausted')) {
    return 'Daily quota limit reached. Please try again later.';
  }
  if (code.includes('failed-precondition')) {
    return 'Database query pre-condition missing. Retrying with fallback query...';
  }
  if (code.includes('invalid-argument')) {
    return 'Invalid gig data format. Please verify your form inputs.';
  }

  return message || 'Failed to complete database operation. Please try again.';
}

/**
 * Generates an array of unique search keywords for client/database querying.
 */
function generateSearchKeywords(title: string, category: string, skills: string[], location: string): string[] {
  const text = `${title} ${category} ${skills.join(' ')} ${location}`.toLowerCase();
  const words = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return Array.from(new Set(words));
}

/**
 * Validates all fields of a gig form with timezone-safe date checking.
 */
export function validateGigForm(form: GigInput): { isValid: boolean; errors: GigValidationErrors } {
  const errors: GigValidationErrors = {};

  // Title validation
  const trimmedTitle = form.title?.trim() || '';
  if (!trimmedTitle) {
    errors.title = 'Gig title is required.';
  } else if (trimmedTitle.length < 5) {
    errors.title = 'Title must be at least 5 characters long.';
  } else if (trimmedTitle.length > 100) {
    errors.title = 'Title must not exceed 100 characters.';
  }

  // Category validation
  if (!form.category?.trim()) {
    errors.category = 'Please select a category for this gig.';
  }

  // Description validation
  const trimmedDesc = form.description?.trim() || '';
  if (!trimmedDesc) {
    errors.description = 'Gig description is required.';
  } else if (trimmedDesc.length < 20) {
    errors.description = 'Please provide a detailed description (at least 20 characters).';
  } else if (trimmedDesc.length > 2500) {
    errors.description = 'Description cannot exceed 2,500 characters.';
  }

  // Pay validation
  const trimmedPay = form.pay?.trim() || '';
  if (!trimmedPay) {
    errors.pay = 'Please specify the pay amount.';
  } else {
    const cleanPayStr = trimmedPay.replace(/[^0-9.]/g, '');
    const numericPay = parseFloat(cleanPayStr);
    if (isNaN(numericPay) || numericPay <= 0) {
      errors.pay = 'Pay amount must be a positive number greater than 0.';
    } else if (numericPay > 1000000) {
      errors.pay = 'Pay amount exceeds the allowable limit ($1,000,000).';
    }
  }

  // Date validation (Timezone-safe YYYY-MM-DD parsing)
  const trimmedDate = form.date?.trim() || '';
  if (!trimmedDate) {
    errors.date = 'Date or deadline is required.';
  } else {
    const parts = trimmedDate.split('-');
    if (parts.length !== 3) {
      errors.date = 'Please provide a valid date (YYYY-MM-DD).';
    } else {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
        errors.date = 'Please provide a valid date (YYYY-MM-DD).';
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const gigDay = new Date(year, month - 1, day, 0, 0, 0, 0);

        if (gigDay < today) {
          errors.date = 'Gig date cannot be in the past.';
        }
      }
    }
  }

  // Location validation
  if (form.locationType !== 'remote') {
    const trimmedLoc = form.location?.trim() || '';
    if (!trimmedLoc) {
      errors.location = `Location is required for ${form.locationType === 'hybrid' ? 'hybrid' : 'on-site'} gigs.`;
    } else if (trimmedLoc.length < 3) {
      errors.location = 'Please specify a valid city or address (min 3 characters).';
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

/**
 * Creates and persists a new gig document in Cloud Firestore.
 */
export async function createGig(
  input: GigInput,
  user: { uid: string; fullName?: string; email?: string }
): Promise<string> {
  const { isValid, errors } = validateGigForm(input);
  if (!isValid) {
    const firstError = Object.values(errors)[0];
    throw new Error(firstError || 'Validation failed. Please check form inputs.');
  }

  const numericPay = parseFloat(input.pay.replace(/[^0-9.]/g, ''));
  const finalLocation =
    input.locationType === 'remote'
      ? input.location.trim() || 'Remote (Work from Anywhere)'
      : input.location.trim();

  const cleanSkills = input.skills.filter((s) => s.trim().length > 0);
  const keywords = generateSearchKeywords(input.title, input.category, cleanSkills, finalLocation);

  const gigDocData = {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    pay: numericPay,
    payType: input.payType,
    date: input.date.trim(),
    location: finalLocation,
    locationType: input.locationType,
    skills: cleanSkills,
    status: 'open' as GigStatus,
    postedBy: {
      uid: user.uid,
      fullName: user.fullName || 'Business Owner',
      email: user.email || '',
    },
    applicantsCount: 0,
    viewsCount: 0,
    searchKeywords: keywords,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    // 1. Create gig document in Firestore
    const docRef = await addDoc(collection(db, 'gigs'), gigDocData);

    // 2. Increment user's total gigs counter (best-effort)
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        totalGigsPosted: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-critical if user counter update fails
    }

    return docRef.id;
  } catch (error: any) {
    console.error('Firestore createGig error:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Sorts an array of gigs in memory by createdAt descending with fallback for pending server timestamps.
 */
function sortGigsDesc(gigs: Gig[]): Gig[] {
  return [...gigs].sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || Date.now()).getTime();
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || Date.now()).getTime();
    return timeB - timeA;
  });
}

/**
 * Subscribes to real-time updates for recent gigs with automatic index fallback.
 */
export function subscribeToRecentGigs(
  limitCount = 10,
  onUpdate: (gigs: Gig[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, 'gigs'),
      limit(limitCount * 2)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const rawGigs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Gig[];
        const sorted = sortGigsDesc(rawGigs).slice(0, limitCount);
        onUpdate(sorted);
      },
      (error) => {
        console.error('Firestore subscribeToRecentGigs error:', error);
        if (onError) onError(new Error(parseFirebaseError(error)));
      }
    );
  } catch (e: any) {
    if (onError) onError(new Error(parseFirebaseError(e)));
    return () => {};
  }
}

/**
 * Subscribes to real-time updates for gigs posted by a specific business owner.
 */
export function subscribeToClientGigs(
  userId: string,
  onUpdate: (gigs: Gig[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, 'gigs'),
      where('postedBy.uid', '==', userId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const rawGigs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Gig[];
        const sorted = sortGigsDesc(rawGigs);
        onUpdate(sorted);
      },
      (error) => {
        console.error('Firestore subscribeToClientGigs error:', error);
        if (onError) onError(new Error(parseFirebaseError(error)));
      }
    );
  } catch (e: any) {
    if (onError) onError(new Error(parseFirebaseError(e)));
    return () => {};
  }
}

/**
 * Calculates summary metrics and performance stats for a business owner's gigs.
 */
export function calculateBusinessGigStats(gigs: Gig[]): BusinessGigStats {
  const stats: BusinessGigStats = {
    total: gigs.length,
    open: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    totalBudget: 0,
    totalApplicants: 0,
  };

  for (const gig of gigs) {
    if (gig.status === 'open') stats.open += 1;
    else if (gig.status === 'in-progress') stats.inProgress += 1;
    else if (gig.status === 'completed') stats.completed += 1;
    else if (gig.status === 'cancelled') stats.cancelled += 1;

    if (gig.pay && typeof gig.pay === 'number') {
      stats.totalBudget += gig.pay;
    }
    if (gig.applicantsCount && typeof gig.applicantsCount === 'number') {
      stats.totalApplicants += gig.applicantsCount;
    }
  }

  return stats;
}

/**
 * Filters and sorts an array of gigs in memory according to specified filter criteria.
 */
export function filterAndSortGigs(gigs: Gig[], options: GigFilterOptions): Gig[] {
  let result = [...gigs];

  // 1. Filter by Status
  if (options.status && options.status !== 'all') {
    result = result.filter((g) => g.status === options.status);
  }

  // 2. Filter by Category
  if (options.category && options.category !== 'all') {
    result = result.filter(
      (g) => g.category?.toLowerCase() === options.category?.toLowerCase()
    );
  }

  // 3. Filter by Search Query
  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    const query = options.searchQuery.trim().toLowerCase();
    result = result.filter((g) => {
      const matchTitle = g.title?.toLowerCase().includes(query);
      const matchDesc = g.description?.toLowerCase().includes(query);
      const matchCategory = g.category?.toLowerCase().includes(query);
      const matchLocation = g.location?.toLowerCase().includes(query);
      const matchSkills = g.skills?.some((s) => s.toLowerCase().includes(query));
      return matchTitle || matchDesc || matchCategory || matchLocation || matchSkills;
    });
  }

  // 4. Sort
  const sortBy = options.sortBy || 'newest';
  result.sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();

    switch (sortBy) {
      case 'newest':
        return timeB - timeA;
      case 'oldest':
        return timeA - timeB;
      case 'pay-high':
        return (b.pay || 0) - (a.pay || 0);
      case 'pay-low':
        return (a.pay || 0) - (b.pay || 0);
      case 'applicants':
        return (b.applicantsCount || 0) - (a.applicantsCount || 0);
      default:
        return timeB - timeA;
    }
  });

  return result;
}

/**
 * Updates the status of a gig (e.g. 'open' -> 'in-progress' -> 'completed' -> 'cancelled').
 */
export async function updateGigStatus(gigId: string, status: GigStatus): Promise<void> {
  try {
    const docRef = doc(db, 'gigs', gigId);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Firestore updateGigStatus error:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Deletes a gig from Cloud Firestore and decrements the user's total gigs counter.
 */
export async function deleteGig(gigId: string, userId?: string): Promise<void> {
  try {
    const docRef = doc(db, 'gigs', gigId);
    await deleteDoc(docRef);

    // Decrement user's total gigs counter if userId provided (best-effort)
    if (userId) {
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          totalGigsPosted: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-critical if user counter update fails
      }
    }
  } catch (error: any) {
    console.error('Firestore deleteGig error:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Fetches a single gig by its ID from Cloud Firestore.
 */
export async function getGigById(gigId: string): Promise<Gig | null> {
  try {
    const docRef = doc(db, 'gigs', gigId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
    } as Gig;
  } catch (error: any) {
    console.error('Firestore getGigById error:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Fetches recent active gigs once from Cloud Firestore.
 */
export async function getRecentGigs(limitCount = 10): Promise<Gig[]> {
  try {
    const q = query(
      collection(db, 'gigs'),
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(q);
    const rawGigs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Gig[];
    return sortGigsDesc(rawGigs).slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching recent gigs:', error);
    return [];
  }
}

/**
 * Fetches gigs posted by a specific business owner / client once.
 */
export async function getGigsByClient(userId: string): Promise<Gig[]> {
  try {
    const q = query(
      collection(db, 'gigs'),
      where('postedBy.uid', '==', userId)
    );
    const snapshot = await getDocs(q);
    const rawGigs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Gig[];
    return sortGigsDesc(rawGigs);
  } catch (error) {
    console.error('Error fetching client gigs:', error);
    return [];
  }
}

