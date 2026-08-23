import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import { Gig, GigInput, GigValidationErrors } from '../types/gig';

/**
 * Validates all fields of a gig form.
 * Returns an object with `isValid` boolean and a mapping of field error messages.
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
    const numericPay = parseFloat(trimmedPay.replace(/[^0-9.]/g, ''));
    if (isNaN(numericPay) || numericPay <= 0) {
      errors.pay = 'Pay amount must be a positive number greater than 0.';
    } else if (numericPay > 1000000) {
      errors.pay = 'Pay amount exceeds the allowable limit ($1,000,000).';
    }
  }

  // Date validation
  const trimmedDate = form.date?.trim() || '';
  if (!trimmedDate) {
    errors.date = 'Date or deadline is required.';
  } else {
    // Check if valid date format (e.g. YYYY-MM-DD)
    const parsedDate = new Date(trimmedDate);
    if (isNaN(parsedDate.getTime())) {
      errors.date = 'Please provide a valid date (YYYY-MM-DD).';
    } else {
      // Must be today or future date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const gigDay = new Date(parsedDate);
      gigDay.setHours(0, 0, 0, 0);
      if (gigDay < today) {
        errors.date = 'Gig date cannot be in the past.';
      }
    }
  }

  // Location validation
  if (form.locationType === 'remote') {
    // Remote gigs can have default "Remote" or optional country/timezone
  } else {
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
 * Creates a new gig in Cloud Firestore.
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

  const gigDocData = {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    pay: numericPay,
    payType: input.payType,
    date: input.date.trim(),
    location: finalLocation,
    locationType: input.locationType,
    skills: input.skills.filter((s) => s.trim().length > 0),
    status: 'open',
    postedBy: {
      uid: user.uid,
      fullName: user.fullName || 'Business Owner',
      email: user.email || '',
    },
    applicantsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'gigs'), gigDocData);
  return docRef.id;
}

/**
 * Fetches recent active gigs from Cloud Firestore.
 */
export async function getRecentGigs(limitCount = 10): Promise<Gig[]> {
  try {
    const q = query(
      collection(db, 'gigs'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Gig[];
  } catch (error) {
    console.error('Error fetching recent gigs:', error);
    return [];
  }
}

/**
 * Fetches gigs posted by a specific business owner / client.
 */
export async function getGigsByClient(userId: string): Promise<Gig[]> {
  try {
    const q = query(
      collection(db, 'gigs'),
      where('postedBy.uid', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Gig[];
  } catch (error) {
    // If composite index is building or missing, fallback to where only
    try {
      const fallbackQuery = query(
        collection(db, 'gigs'),
        where('postedBy.uid', '==', userId)
      );
      const snapshot = await getDocs(fallbackQuery);
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Gig[];
    } catch (e) {
      console.error('Error fetching client gigs:', e);
      return [];
    }
  }
}
