import { collection, doc, documentId, getCountFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';
import type { UserData } from '../context/AuthContext';
import type { Application } from '../types/application';
import type { Gig } from '../types/gig';

export type AdminUser = UserData & { id: string };
export type AdminStats = { users: number; youth: number; businesses: number; suspended: number; gigs: number; openGigs: number; applications: number };
export type AdminCursor = QueryDocumentSnapshot<DocumentData>;
export const ADMIN_PAGE_SIZE = 25;

export async function fetchAdminStats(): Promise<AdminStats> {
  const count = async (name: string, field?: string, value?: string | boolean) => {
    const ref = collection(db, name);
    const result = await getCountFromServer(field ? query(ref, where(field, '==', value)) : ref);
    return result.data().count;
  };
  const [users, youth, businesses, suspended, gigs, openGigs, applications] = await Promise.all([
    count('users'), count('users', 'role', 'freelancer'), count('users', 'role', 'client'), count('users', 'suspended', true),
    count('gigs'), count('gigs', 'status', 'open'), count('applications'),
  ]);
  return { users, youth, businesses, suspended, gigs, openGigs, applications };
}

export async function fetchAdminPage(kind: 'users' | 'gigs' | 'applications', cursor?: AdminCursor) {
  const constraints = [orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(ADMIN_PAGE_SIZE + 1)];
  const snapshot = await getDocsFromServer(query(collection(db, kind), ...constraints));
  const docs = snapshot.docs.slice(0, ADMIN_PAGE_SIZE);
  return {
    rows: docs.map(item => ({ ...item.data(), id: item.id })) as (AdminUser | Gig | Application)[],
    cursor: docs.at(-1), hasMore: snapshot.docs.length > ADMIN_PAGE_SIZE,
  };
}

function cleanReason(reason: string) {
  const clean = reason.trim();
  if (clean.length < 5 || clean.length > 500) throw new Error('Enter a reason between 5 and 500 characters.');
  return clean;
}

// Server rules also enforce these restrictions. Transactions avoid acting on stale rows.
export async function setUserSuspension(userId: string, suspended: boolean, reason: string) {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Please sign in again.');
  const clean = suspended ? cleanReason(reason) : '';
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = await transaction.get(doc(db, 'users', userId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!target.exists()) throw new Error('This user no longer exists.');
    if (userId === actor.uid || target.data().role === 'admin') throw new Error('Administrator accounts cannot be suspended here.');
    transaction.update(target.ref, { suspended, suspensionReason: clean, updatedAt: serverTimestamp() });
  });
}

export async function removeGigFromDiscovery(gigId: string, reason: string) {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Please sign in again.');
  const clean = cleanReason(reason);
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const gig = await transaction.get(doc(db, 'gigs', gigId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!gig.exists()) throw new Error('This gig no longer exists.');
    if (gig.data().moderationRemoved) throw new Error('This gig has already been removed.');
    transaction.update(gig.ref, {
      status: 'closed', moderationRemoved: true, moderationReason: clean,
      moderatedBy: actor.uid, moderatedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
}
