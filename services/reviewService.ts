import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';
import type { Gig } from '../types/gig';

export function getReviewTarget(gig: Gig, uid?: string, role?: string): string | null {
  if (!uid || gig.status !== 'completed' || gig.moderationRemoved) return null;
  const owner = gig.postedBy.uid;
  const worker = gig.assignedYouthId;
  if (!worker || worker === owner) return null;
  if (role === 'client' && uid === owner) return worker;
  if ((role === 'freelancer' || role === 'youth') && uid === worker) return owner;
  return null;
}

export async function submitGigReview(gigId: string, rating: number, comment: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in to rate a user.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.');
  const cleanComment = comment.trim();
  if (cleanComment.length > 1000) throw new Error('Keep your review within 1000 characters.');
  await runTransaction(db, async transaction => {
    const gigSnapshot = await transaction.get(doc(db, 'gigs', gigId));
    const authorSnapshot = await transaction.get(doc(db, 'users', uid));
    if (!gigSnapshot.exists()) throw new Error('Gig not found.');
    const gig = { ...gigSnapshot.data(), id: gigId } as Gig;
    const target = getReviewTarget(gig, uid, authorSnapshot.data()?.role);
    if (!target) throw new Error('Only participants can rate a user after gig completion.');
    const reviewRef = doc(db, 'users', target, 'reviews', `${gigId}_${uid}`);
    const existing = await transaction.get(reviewRef);
    if (existing.exists()) throw new Error('You have already reviewed this gig.');
    transaction.set(reviewRef, {
      gigId, reviewerId: uid, reviewedUserId: target, reviewerRole: authorSnapshot.data()?.role,
      authorId: uid, authorName: authorSnapshot.data()?.businessName || authorSnapshot.data()?.fullName || 'User',
      rating, comment: cleanComment, createdAt: serverTimestamp(),
    });
  });
}
