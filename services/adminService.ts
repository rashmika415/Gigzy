import { collection, doc, documentId, getCountFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where, writeBatch } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';
import type { UserData } from '../context/AuthContext';
import type { Gig } from '../types/gig';

export type AdminUser = UserData & { id: string };
export type AdminStats = { users: number; youth: number; businesses: number; suspended: number; gigs: number; openGigs: number; applications: number };
export type AdminCursor = QueryDocumentSnapshot<DocumentData>;
export type AdminReview = { id: string; authorId?: string; authorName?: string; rating?: number; comment?: string; createdAt?: unknown };
export type AdminEndorsement = { id: string; endorserId?: string; endorserName?: string; skill?: string; createdAt?: unknown };
export type AdminPushToken = { id: string; token?: string; provider?: string; platform?: string; updatedAt?: unknown };
export type AdminPushFailure = { id: string; userId?: string; tokenId?: string; code?: string; message?: string; createdAt?: unknown };
export type AdminAuditLog = { id: string; adminId?: string; action?: string; targetUserId?: string; targetPath?: string; details?: string; createdAt?: unknown };
export type AdminUserDetails = { reviews: AdminReview[]; endorsements: AdminEndorsement[]; pushTokens: AdminPushToken[]; pushFailures: AdminPushFailure[] };
export type NotificationAudience = 'user' | 'freelancer' | 'client' | 'all';
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

export async function fetchAdminPage(kind: 'users' | 'gigs', cursor?: AdminCursor) {
  const constraints = [orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(ADMIN_PAGE_SIZE + 1)];
  const snapshot = await getDocsFromServer(query(collection(db, kind), ...constraints));
  const docs = snapshot.docs.slice(0, ADMIN_PAGE_SIZE);
  return {
    rows: docs.map(item => ({ ...item.data(), id: item.id })) as (AdminUser | Gig)[],
    cursor: docs.at(-1), hasMore: snapshot.docs.length > ADMIN_PAGE_SIZE,
  };
}

function cleanReason(reason: string) {
  const clean = reason.trim();
  if (clean.length < 5 || clean.length > 500) throw new Error('Enter a reason between 5 and 500 characters.');
  return clean;
}

function auditRef() { return doc(collection(db, 'adminAuditLogs')); }
function auditData(adminId: string, action: string, targetUserId?: string, targetPath?: string, details?: string) {
  return { adminId, action, targetUserId: targetUserId || null, targetPath: targetPath || null, details: details || null, createdAt: serverTimestamp() };
}

function currentAdmin() {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Please sign in again.');
  return actor;
}

export async function fetchAdminUserDetails(userId: string): Promise<AdminUserDetails> {
  const [reviews, endorsements, tokens, failures] = await Promise.all([
    getDocsFromServer(query(collection(db, 'users', userId, 'reviews'), orderBy('createdAt', 'desc'), limit(50))),
    getDocsFromServer(query(collection(db, 'users', userId, 'endorsements'), orderBy('createdAt', 'desc'), limit(50))),
    getDocsFromServer(query(collection(db, 'users', userId, 'pushTokens'), limit(50))),
    getDocsFromServer(query(collection(db, 'pushDeliveryFailures'), where('userId', '==', userId), limit(50))),
  ]);
  const rows = <T extends { id: string }>(snapshot: typeof reviews) => snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as T);
  return { reviews: rows<AdminReview>(reviews), endorsements: rows<AdminEndorsement>(endorsements), pushTokens: rows<AdminPushToken>(tokens), pushFailures: rows<AdminPushFailure>(failures) };
}

export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const snapshot = await getDocsFromServer(query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc'), limit(100)));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as AdminAuditLog);
}

// Server rules also enforce these restrictions. Transactions avoid acting on stale rows.
export async function setUserSuspension(userId: string, suspended: boolean, reason: string) {
  const actor = currentAdmin();
  const clean = suspended ? cleanReason(reason) : '';
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = await transaction.get(doc(db, 'users', userId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!target.exists()) throw new Error('This user no longer exists.');
    if (userId === actor.uid || target.data().role === 'admin') throw new Error('Administrator accounts cannot be suspended here.');
    transaction.update(target.ref, { suspended, suspensionReason: clean, updatedAt: serverTimestamp() });
    transaction.set(auditRef(), auditData(actor.uid, suspended ? 'user.suspended' : 'user.reactivated', userId, target.ref.path, clean));
  });
}

export async function setBusinessVerification(userId: string, verified: boolean) {
  const actor = currentAdmin();
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = await transaction.get(doc(db, 'users', userId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!target.exists() || target.data().role !== 'client') throw new Error('Only business accounts can be verified.');
    transaction.update(target.ref, { isVerified: verified, updatedAt: serverTimestamp() });
    transaction.set(auditRef(), auditData(actor.uid, verified ? 'business.verified' : 'business.verification_revoked', userId, target.ref.path));
  });
}

export async function setProfileFlag(userId: string, flagged: boolean, reason: string) {
  const actor = currentAdmin();
  const clean = flagged ? cleanReason(reason) : '';
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = await transaction.get(doc(db, 'users', userId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!target.exists() || target.data().role === 'admin') throw new Error('This profile cannot be moderated here.');
    transaction.update(target.ref, { profileFlagged: flagged, profileFlagReason: clean, profileFlaggedBy: flagged ? actor.uid : '', profileFlaggedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.set(auditRef(), auditData(actor.uid, flagged ? 'profile.flagged' : 'profile.flag_cleared', userId, target.ref.path, clean));
  });
}

export async function setSkillBadges(userId: string, labels: string[]) {
  const actor = currentAdmin();
  const cleaned = [...new Set(labels.map(value => value.trim()).filter(Boolean))].slice(0, 20);
  if (cleaned.some(value => value.length > 60)) throw new Error('Badge names must be 60 characters or fewer.');
  const badges = cleaned.map(label => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), label }));
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = await transaction.get(doc(db, 'users', userId));
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!target.exists() || target.data().role !== 'freelancer') throw new Error('Skill badges can only be assigned to youth accounts.');
    transaction.update(target.ref, { skillBadges: badges, updatedAt: serverTimestamp() });
    transaction.set(auditRef(), auditData(actor.uid, 'user.badges_updated', userId, target.ref.path, `${badges.length} badge(s)`));
  });
}

async function deleteProfileContent(userId: string, kind: 'reviews' | 'endorsements', itemId: string) {
  const actor = currentAdmin();
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', actor.uid));
    const target = doc(db, 'users', userId, kind, itemId);
    const item = await transaction.get(target);
    if (!admin.exists() || admin.data().role !== 'admin' || admin.data().suspended) throw new Error('Administrator access required.');
    if (!item.exists()) throw new Error('This item no longer exists.');
    transaction.delete(target);
    transaction.set(auditRef(), auditData(actor.uid, kind === 'reviews' ? 'review.deleted' : 'endorsement.deleted', userId, target.path));
  });
}

export const deleteReviewAsAdmin = (userId: string, reviewId: string) => deleteProfileContent(userId, 'reviews', reviewId);
export const deleteEndorsementAsAdmin = (userId: string, endorsementId: string) => deleteProfileContent(userId, 'endorsements', endorsementId);

export async function sendSystemNotification(audience: NotificationAudience, title: string, body: string, targetUserId?: string) {
  const actor = currentAdmin();
  const cleanTitle = title.trim(); const cleanBody = body.trim();
  if (!cleanTitle || !cleanBody || cleanTitle.length > 80 || cleanBody.length > 500) throw new Error('Enter a title (up to 80) and message (up to 500 characters).');
  if (audience === 'user' && !targetUserId) throw new Error('Select a user first.');
  const admin = await getDocsFromServer(query(collection(db, 'users'), where(documentId(), '==', actor.uid), limit(1)));
  if (!admin.docs[0] || admin.docs[0].data().role !== 'admin' || admin.docs[0].data().suspended) throw new Error('Administrator access required.');
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
  let recipientCount = 0;
  do {
    const snapshot = await getDocsFromServer(query(
      collection(db, 'users'),
      orderBy(documentId()),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(400),
    ));
    const recipients = snapshot.docs.filter(item => {
      const data = item.data();
      if (data.role === 'admin' || data.suspended) return false;
      if (audience === 'user') return item.id === targetUserId;
      return audience === 'all' || data.role === audience;
    });
    if (recipients.length) {
      const batch = writeBatch(db);
      recipients.forEach(recipient => batch.set(doc(collection(db, 'users', recipient.id, 'notifications')), {
        userId: recipient.id, type: 'system', title: cleanTitle, body: cleanBody, read: false, createdAt: serverTimestamp(),
      }));
      await batch.commit();
      recipientCount += recipients.length;
    }
    cursor = snapshot.docs.length === 400 ? snapshot.docs.at(-1) : undefined;
  } while (cursor && audience !== 'user');
  if (!recipientCount) throw new Error('No eligible recipients found.');
  const audit = writeBatch(db);
  audit.set(auditRef(), auditData(actor.uid, 'notification.sent', audience === 'user' ? targetUserId : undefined, 'users/*/notifications', `${audience}: ${cleanTitle} (${recipientCount})`));
  await audit.commit();
  return recipientCount;
}

export async function removeGigFromDiscovery(gigId: string, reason: string) {
  const actor = currentAdmin();
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
    transaction.set(auditRef(), auditData(actor.uid, 'gig.removed', undefined, gig.ref.path, clean));
  });
}
