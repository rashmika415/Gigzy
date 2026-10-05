import { collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../FirebaseConfig';

export interface SavedGig {
  gigId: string;
  savedAt: unknown;
}

export function savedGigError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return 'You cannot access saved gigs right now. Please try signing in again.';
  if (code === 'unavailable' || code === 'failed-precondition') return 'Check your connection and try again.';
  return error instanceof Error ? error.message : 'Unable to update saved gigs. Please try again.';
}

export function subscribeToSavedGigs(userId: string, onData: (items: SavedGig[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(db, 'users', userId, 'savedGigs'), orderBy('savedAt', 'desc')),
    snapshot => onData(snapshot.docs.map(item => ({ gigId: item.id, savedAt: item.data().savedAt }))),
    error => onError(new Error(savedGigError(error))));
}

// A deterministic document ID and transaction make saves idempotent across devices.
// Do not copy the gig: the saved screen reads its live document, including status changes.
export async function saveGig(userId: string, gigId: string): Promise<void> {
  try {
    const reference = doc(db, 'users', userId, 'savedGigs', gigId);
    await runTransaction(db, async transaction => {
      if ((await transaction.get(reference)).exists()) return;
      const gig = await transaction.get(doc(db, 'gigs', gigId));
      if (!gig.exists()) throw new Error('This gig has been removed and cannot be saved.');
      transaction.set(reference, { gigId, savedAt: serverTimestamp() });
    });
  } catch (error) { throw new Error(savedGigError(error)); }
}

export async function removeSavedGig(userId: string, gigId: string): Promise<void> {
  try { await deleteDoc(doc(db, 'users', userId, 'savedGigs', gigId)); }
  catch (error) { throw new Error(savedGigError(error)); }
}
