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
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';
import { Review, SubmitReviewInput } from '../types/review';
import type { Gig } from '../types/gig';
import { sendNotification } from './notificationService';
import { parseFirebaseError } from './gigService';

/** Application statuses that unlock reviews (business owner has accepted). */
const REVIEWABLE_STATUSES = ['accepted', 'approved', 'in-progress', 'completed'];

export const REVIEW_LOCKED_MESSAGE =
  'Reviews unlock only after the business owner accepts the application.';

export const ALREADY_REVIEWED_MESSAGE = 'You have already reviewed this gig.';
const MIN_COMMENT = 5; // firestore.rules rejects shorter comments
const SHORT_COMMENT_MESSAGE = 'Please provide a written review of at least 5 characters.';

/**
 * Gig-linked reviews use a fixed document id so the same person can rate the
 * other participant of a gig only once, whichever rating button they used.
 */
const gigReviewId = (gigId: string, authorId: string) => `${gigId}_${authorId}`;

/** The other participant of a completed gig, or null when the viewer cannot rate anyone. */
export function getReviewTarget(gig: Gig, uid?: string, role?: string): string | null {
  if (!uid || gig.status !== 'completed' || gig.moderationRemoved) return null;
  const owner = gig.postedBy.uid;
  const worker = gig.assignedYouthId;
  if (!worker || worker === owner) return null;
  if (role === 'client' && uid === owner) return worker;
  if ((role === 'freelancer' || role === 'youth') && uid === worker) return owner;
  return null;
}

/** Recalculates the recipient's rating and notifies them. Failures are logged, never thrown. */
async function afterReviewSaved(
  targetUserId: string,
  reviewId: string,
  review: { authorRole?: string; authorName?: string; rating: number; comment: string }
) {
  try {
    const snap = await getDocs(collection(db, 'users', targetUserId, 'reviews'));
    let totalRatingSum = 0;
    let validReviewsCount = 0;

    snap.forEach((d) => {
      const item = d.data();
      if (typeof item.rating === 'number' && item.rating >= 1 && item.rating <= 5) {
        totalRatingSum += item.rating;
        validReviewsCount += 1;
      }
    });

    // Avoid edge cases where snap might be temporarily empty right after the write in mocks
    if (validReviewsCount === 0) {
      totalRatingSum = review.rating;
      validReviewsCount = 1;
    }

    await updateDoc(doc(db, 'users', targetUserId), {
      ratingAverage: Math.round((totalRatingSum / validReviewsCount) * 10) / 10,
      ratingCount: validReviewsCount,
      updatedAt: serverTimestamp(),
    });
  } catch (calcError) {
    console.warn('Warning: Could not recalculate user rating average:', calcError);
  }

  try {
    const roleLabel = review.authorRole === 'client' ? 'Business client' : 'Youth freelancer';
    const previewText = review.comment.length > 60 ? `${review.comment.slice(0, 60)}...` : review.comment;
    await sendNotification(targetUserId, {
      userId: targetUserId,
      type: 'review',
      title: 'New Review Received! ⭐',
      body: `${roleLabel} ${review.authorName || 'A user'} gave you a ${review.rating}★ rating: "${previewText}"`,
      read: false,
      route: `/(app)/profile/${targetUserId}`,
      entityId: reviewId,
    });
  } catch (notifErr) {
    console.warn('Could not dispatch review notification:', notifErr);
  }
}

/**
 * Rates the other participant of a completed gig (used by RateUserButton).
 * The target, role and duplicate checks all run inside one transaction.
 */
export async function submitGigReview(gigId: string, rating: number, comment: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in to rate a user.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.');
  const cleanComment = comment.trim();
  if (cleanComment.length > 1000) throw new Error('Keep your review within 1000 characters.');

  const saved = await runTransaction(db, async transaction => {
    const gigSnapshot = await transaction.get(doc(db, 'gigs', gigId));
    const authorSnapshot = await transaction.get(doc(db, 'users', uid));
    if (!gigSnapshot.exists()) throw new Error('Gig not found.');
    const gig = { ...gigSnapshot.data(), id: gigId } as Gig;
    const author = authorSnapshot.data() ?? {};
    const target = getReviewTarget(gig, uid, author.role);
    if (!target) throw new Error('Only participants can rate a user after gig completion.');
    if (cleanComment.length < MIN_COMMENT) throw new Error(SHORT_COMMENT_MESSAGE);
    const reviewRef = doc(db, 'users', target, 'reviews', gigReviewId(gigId, uid));
    if ((await transaction.get(reviewRef)).exists()) throw new Error(ALREADY_REVIEWED_MESSAGE);

    const authorRole: 'client' | 'freelancer' = author.role === 'client' ? 'client' : 'freelancer';
    const authorName = author.businessName || author.fullName || 'User';
    transaction.set(reviewRef, {
      targetUserId: target,
      targetRole: target === gig.postedBy.uid ? 'client' : 'freelancer',
      authorId: uid,
      authorName,
      authorPhotoURL: author.photoURL || '',
      authorRole,
      rating,
      comment: cleanComment,
      tags: [],
      gigId,
      gigTitle: gig.title || '',
      // Kept for older readers of gig reviews.
      reviewerId: uid,
      reviewedUserId: target,
      reviewerRole: author.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { target, reviewId: reviewRef.id, authorRole, authorName };
  });

  await afterReviewSaved(saved.target, saved.reviewId, { authorRole: saved.authorRole, authorName: saved.authorName, rating, comment: cleanComment });
  return saved.reviewId;
}

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

  if (cleanComment.length < MIN_COMMENT) {
    throw new Error('Please provide a written review of at least 5 characters.');
  }

  if (cleanComment.length > 1000) {
    throw new Error('Review comment cannot exceed 1000 characters.');
  }

  if (!(await canReviewUser(input.authorId, input.targetUserId, input.gigId))) {
    throw new Error(REVIEW_LOCKED_MESSAGE);
  }

  try {
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

    let reviewId: string;
    if (input.gigId) {
      // Older gig reviews were saved with random ids, so also check by query.
      if (await hasUserReviewedGig(input.authorId, input.targetUserId, input.gigId)) {
        throw new Error(ALREADY_REVIEWED_MESSAGE);
      }
      const reviewRef = doc(db, 'users', input.targetUserId, 'reviews', gigReviewId(input.gigId, input.authorId));
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(reviewRef)).exists()) throw new Error(ALREADY_REVIEWED_MESSAGE);
        transaction.set(reviewRef, reviewData);
      });
      reviewId = reviewRef.id;
    } else {
      reviewId = (await addDoc(collection(db, 'users', input.targetUserId, 'reviews'), reviewData)).id;
    }

    await afterReviewSaved(input.targetUserId, reviewId, { authorRole: input.authorRole, authorName: input.authorName, rating: cleanRating, comment: cleanComment });
    return reviewId;
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
