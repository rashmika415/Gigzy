import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import { Review, SubmitReviewInput } from '../types/review';
import { sendNotification } from './notificationService';
import { parseFirebaseError } from './gigService';

/** Application statuses that unlock reviews (business owner has accepted). */
const REVIEWABLE_STATUSES = ['accepted', 'approved', 'in-progress', 'completed'];

export const REVIEW_LOCKED_MESSAGE =
  'Reviews unlock only after the business owner accepts the application.';

/**
 * Returns true when author and target share an application that the business
 * owner has accepted. Works in both directions (youth → business, business → youth).
 * Each query filters on the author's own field so it satisfies Firestore rules.
 */
export async function canReviewUser(
  authorId: string,
  targetUserId: string,
  gigId?: string
): Promise<boolean> {
  if (!authorId || !targetUserId || authorId === targetUserId) return false;

  const directions: [string, string][] = [
    ['youthId', 'businessId'], // author is youth, target is business
    ['businessId', 'youthId'], // author is business, target is youth
  ];

  for (const [authorField, targetField] of directions) {
    try {
      const snap = await getDocs(
        query(collection(db, 'applications'), where(authorField, '==', authorId))
      );
      const ok = snap.docs.some((d) => {
        const a: any = d.data();
        const status = String(a.status || '').toLowerCase();
        return (
          a[targetField] === targetUserId &&
          REVIEWABLE_STATUSES.includes(status) &&
          (!gigId || !a.gigId || a.gigId === gigId)
        );
      });
      if (ok) return true;
    } catch {
      // Query not permitted for this direction (e.g. wrong role) — try the other.
    }
  }
  return false;
}

/**
 * Submits a rating and written review for a user (youth freelancer or business client),
 * automatically recalculating the recipient's overall ratingAverage and ratingCount.
 */
export async function submitReview(input: SubmitReviewInput): Promise<string> {
  const cleanComment = (input.comment || '').trim();
  const cleanRating = Math.round(Number(input.rating));

  if (!input.targetUserId) {
    throw new Error('Target user ID is required to submit a review.');
  }

  if (!input.authorId) {
    throw new Error('You must be signed in to submit a review.');
  }

  if (input.targetUserId === input.authorId) {
    throw new Error('You cannot rate or review yourself.');
  }

  if (isNaN(cleanRating) || cleanRating < 1 || cleanRating > 5) {
    throw new Error('Rating must be a whole number between 1 and 5 stars.');
  }

  if (cleanComment.length < 5) {
    throw new Error('Please provide a written review of at least 5 characters.');
  }

  if (cleanComment.length > 1000) {
    throw new Error('Review comment cannot exceed 1000 characters.');
  }

  if (!(await canReviewUser(input.authorId, input.targetUserId, input.gigId))) {
    throw new Error(REVIEW_LOCKED_MESSAGE);
  }

  try {
    const reviewsColRef = collection(db, 'users', input.targetUserId, 'reviews');
    const userDocRef = doc(db, 'users', input.targetUserId);

    const reviewData = {
      targetUserId: input.targetUserId,
      targetRole: input.targetRole,
      authorId: input.authorId,
      authorName: input.authorName || 'User',
      authorPhotoURL: input.authorPhotoURL || '',
      authorRole: input.authorRole,
      rating: cleanRating,
      comment: cleanComment,
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 10) : [],
      gigId: input.gigId || '',
      gigTitle: input.gigTitle || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 1. Save review document to subcollection
    const docRef = await addDoc(reviewsColRef, reviewData);

    // 2. Recalculate rating average and total count across all reviews for this user
    try {
      const snap = await getDocs(reviewsColRef);
      let totalRatingSum = 0;
      let validReviewsCount = 0;

      snap.forEach((d) => {
        const item = d.data();
        if (typeof item.rating === 'number' && item.rating >= 1 && item.rating <= 5) {
          totalRatingSum += item.rating;
          validReviewsCount += 1;
        }
      });

      // Avoid edge cases where snap might be temporarily empty right after addDoc in mocks
      if (validReviewsCount === 0) {
        totalRatingSum = cleanRating;
        validReviewsCount = 1;
      }

      const ratingAverage = Math.round((totalRatingSum / validReviewsCount) * 10) / 10;
      const ratingCount = validReviewsCount;

      await updateDoc(userDocRef, {
        ratingAverage,
        ratingCount,
        updatedAt: serverTimestamp(),
      });
    } catch (calcError) {
      console.warn('Warning: Could not recalculate user rating average:', calcError);
    }

    // 3. Dispatch an in-app notification to the reviewed user
    try {
      const roleLabel = input.authorRole === 'client' ? 'Business client' : 'Youth freelancer';
      const previewText = cleanComment.length > 60 ? `${cleanComment.slice(0, 60)}...` : cleanComment;
      await sendNotification(input.targetUserId, {
        userId: input.targetUserId,
        type: 'review',
        title: 'New Review Received! ⭐',
        body: `${roleLabel} ${input.authorName || 'A user'} gave you a ${cleanRating}★ rating: "${previewText}"`,
        read: false,
        route: `/(app)/profile/${input.targetUserId}`,
        entityId: docRef.id,
      });
    } catch (notifErr) {
      console.warn('Could not dispatch review notification:', notifErr);
    }

    return docRef.id;
  } catch (error: any) {
    console.error('Error submitting review:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Subscribes to reviews for a specific user in real-time.
 */
export function subscribeToUserReviews(
  userId: string,
  onUpdate: (reviews: Review[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, 'users', userId, 'reviews'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const reviews = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Review[];
        onUpdate(reviews);
      },
      (error) => {
        console.error('Firestore subscribeToUserReviews error:', error);
        if (onError) onError(new Error(parseFirebaseError(error)));
      }
    );
  } catch (err: any) {
    if (onError) onError(new Error(parseFirebaseError(err)));
    return () => {};
  }
}

/**
 * Fetches all reviews for a user once.
 */
export async function getReviewsForUser(userId: string): Promise<Review[]> {
  try {
    const q = query(
      collection(db, 'users', userId, 'reviews'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Review[];
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Checks if author has already submitted a review for a specific gig and counterpart.
 */
export async function hasUserReviewedGig(
  authorId: string,
  targetUserId: string,
  gigId: string
): Promise<boolean> {
  if (!authorId || !targetUserId || !gigId) return false;
  try {
    const q = query(
      collection(db, 'users', targetUserId, 'reviews'),
      where('authorId', '==', authorId),
      where('gigId', '==', gigId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}
