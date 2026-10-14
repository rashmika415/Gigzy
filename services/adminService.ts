import { collection, doc, documentId, getCountFromServer, getDocsFromServer, increment, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, Timestamp, updateDoc, where } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';
import type { UserData } from '../context/AuthContext';
import type { Application } from '../types/application';
import type { Gig } from '../types/gig';

export type AdminUser = UserData & { id: string };
export type AdminStats = { users: number; youth: number; businesses: number; suspended: number; gigs: number; openGigs: number; applications: number };
export type AdminCursor = QueryDocumentSnapshot<DocumentData>;
export type SuspensionType = 'temporary' | 'permanent';
export type ModerationEventType = 'warning' | 'temporary_suspension' | 'permanent_suspension' | 'reinstated';
export interface ModerationEvent { id: string; type: ModerationEventType; reason: string; actorId: string; createdAt?: unknown; suspendedUntil?: unknown }
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
export async function setUserSuspension(userId: string, suspended: boolean, reason: string, options?: { type?: SuspensionType; durationDays?: number }) {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Please sign in again.');
  const clean = suspended ? cleanReason(reason) : '';
  const type = options?.type ?? 'permanent';
  const durationDays = options?.durationDays ?? 7;
  if (suspended && type === 'temporary' && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365)) {
    throw new Error('Choose a suspension duration between 1 and 365 days.');
  }
  const suspendedUntil = suspended && type === 'temporary'
    ? Timestamp.fromMillis(Date.now() + durationDays * 24 * 60 * 60 * 1000)
    : null;
  const historyRef = doc(collection(db, 'users', userId, 'moderationHistory'));
  const notificationRef = doc(collection(db, 'users', userId, 'notifications'));
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = await transaction.get(doc(db, 'users', userId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!target.exists()) throw new Error('This user no longer exists.');
    if (userId === actor.uid || target.data().role === 'admin') throw new Error('Administrator accounts cannot be suspended here.');
    const now = serverTimestamp();
    transaction.update(target.ref, {
      suspended,
      suspensionReason: clean,
      suspensionType: suspended ? type : 'none',
      suspendedUntil,
      updatedAt: now,
    });
    transaction.set(historyRef, {
      type: suspended ? (type === 'temporary' ? 'temporary_suspension' : 'permanent_suspension') : 'reinstated',
      reason: suspended ? clean : 'Manually reinstated by an administrator.',
      actorId: actor.uid,
      ...(suspendedUntil ? { suspendedUntil } : {}),
      createdAt: now,
    });
    transaction.set(notificationRef, {
      userId,
      type: 'system',
      title: suspended ? (type === 'temporary' ? 'Account temporarily suspended' : 'Account suspended') : 'Account reinstated',
      body: suspended ? clean : 'Your access to LocalWorks has been restored.',
      read: false,
      createdAt: now,
    });
  });
}

export async function issueUserWarning(userId: string, reason: string) {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Please sign in again.');
  const clean = cleanReason(reason);
  const historyRef = doc(collection(db, 'users', userId, 'moderationHistory'));
  const notificationRef = doc(collection(db, 'users', userId, 'notifications'));
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = await transaction.get(doc(db, 'users', userId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!target.exists()) throw new Error('This user no longer exists.');
    if (userId === actor.uid || target.data().role === 'admin') throw new Error('Administrator accounts cannot be warned here.');
    const now = serverTimestamp();
    transaction.update(target.ref, { warningCount: increment(1), lastWarningReason: clean, lastWarnedAt: now, updatedAt: now });
    transaction.set(historyRef, { type: 'warning', reason: clean, actorId: actor.uid, createdAt: now });
    transaction.set(notificationRef, { userId, type: 'system', title: 'Account warning', body: clean, read: false, createdAt: now });
  });
}

export async function fetchUserModerationHistory(userId: string): Promise<ModerationEvent[]> {
  const snapshot = await getDocsFromServer(query(collection(db, 'users', userId, 'moderationHistory'), orderBy('createdAt', 'desc'), limit(20)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as ModerationEvent);
}

export async function releaseExpiredSuspension(userId: string) {
  await updateDoc(doc(db, 'users', userId), {
    suspended: false,
    suspensionReason: '',
    suspensionType: 'none',
    suspendedUntil: null,
    updatedAt: serverTimestamp(),
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
