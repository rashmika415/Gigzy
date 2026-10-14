import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';

export type AnnouncementAudience = 'all' | 'freelancer' | 'client' | 'user';
export type AnnouncementStatus = 'queued' | 'processing' | 'sent' | 'failed';

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  targetUserId?: string;
  status: AnnouncementStatus;
  deliveredCount: number;
  createdBy: string;
  createdAt?: unknown;
  completedAt?: unknown;
  errorMessage?: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  targetUserId?: string;
}

export interface AnnouncementRecipient {
  id: string;
  displayName: string;
  email: string;
  role: 'freelancer' | 'client';
}

const DELIVERY_PAGE_SIZE = 400;
const RECIPIENT_PAGE_SIZE = 200;

export async function fetchAnnouncementRecipients(): Promise<AnnouncementRecipient[]> {
  const recipients: AnnouncementRecipient[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  while (true) {
    const constraints: QueryConstraint[] = [
      orderBy(documentId()),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(RECIPIENT_PAGE_SIZE),
    ];
    const snapshot: QuerySnapshot<DocumentData> = await getDocsFromServer(query(collection(db, 'users'), ...constraints));
    for (const item of snapshot.docs) {
      const data = item.data();
      if (data.suspended === true || !['freelancer', 'client'].includes(data.role)) continue;
      recipients.push({
        id: item.id,
        displayName: String(data.fullName || data.businessName || data.email || item.id),
        email: typeof data.email === 'string' ? data.email : '',
        role: data.role,
      });
    }
    if (snapshot.size < RECIPIENT_PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
  return recipients.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function cleanAnnouncement(input: CreateAnnouncementInput) {
  const title = input.title.trim();
  const body = input.body.trim();
  const targetUserId = input.targetUserId?.trim() ?? '';
  if (title.length < 3 || title.length > 80) throw new Error('Title must be between 3 and 80 characters.');
  if (body.length < 5 || body.length > 500) throw new Error('Message must be between 5 and 500 characters.');
  if (!['all', 'freelancer', 'client', 'user'].includes(input.audience)) throw new Error('Choose a valid audience.');
  if (input.audience === 'user' && !targetUserId) throw new Error('Select a recipient.');
  if (targetUserId.includes('/')) throw new Error('Enter a valid recipient user ID.');
  return { title, body, targetUserId };
}

function notificationData(announcementId: string, title: string, body: string, userId: string) {
  return { userId, type: 'system', title, body, read: false, entityId: announcementId, createdAt: serverTimestamp() };
}

async function deliverAdminAnnouncement(
  announcementId: string,
  input: { title: string; body: string; audience: AnnouncementAudience; targetUserId: string },
) {
  const announcementRef = doc(db, 'announcements', announcementId);
  await updateDoc(announcementRef, { status: 'processing', startedAt: serverTimestamp() });
  try {
    if (input.audience === 'user') {
      const user = await getDoc(doc(db, 'users', input.targetUserId));
      if (!user.exists()) throw new Error('Recipient user does not exist.');
      if (user.data().suspended === true) throw new Error('Recipient account is suspended.');
      if (!['freelancer', 'client'].includes(user.data().role)) throw new Error('Choose a youth or business account.');
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.id, 'notifications', `announcement-${announcementId}`),
        notificationData(announcementId, input.title, input.body, user.id));
      batch.update(announcementRef, { status: 'sent', deliveredCount: 1, completedAt: serverTimestamp() });
      await batch.commit();
      return;
    }

    let deliveredCount = 0;
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
    while (true) {
      const constraints: QueryConstraint[] = [
        ...(input.audience === 'all' ? [] : [where('role', '==', input.audience)]),
        orderBy(documentId()),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(DELIVERY_PAGE_SIZE),
      ];
      const users: QuerySnapshot<DocumentData> = await getDocsFromServer(query(collection(db, 'users'), ...constraints));
      if (users.empty) break;
      const recipients = users.docs.filter(user => {
        const data = user.data();
        return data.suspended !== true && ['freelancer', 'client'].includes(data.role)
          && (input.audience === 'all' || data.role === input.audience);
      });
      const batch = writeBatch(db);
      for (const user of recipients) {
        batch.set(doc(db, 'users', user.id, 'notifications', `announcement-${announcementId}`),
          notificationData(announcementId, input.title, input.body, user.id));
      }
      const lastDocument = users.docs[users.docs.length - 1];
      cursor = lastDocument;
      deliveredCount += recipients.length;
      batch.update(announcementRef, { deliveredCount, lastUserId: lastDocument.id });
      await batch.commit();
      if (users.size < DELIVERY_PAGE_SIZE) break;
    }
    await updateDoc(announcementRef, { status: 'sent', deliveredCount, completedAt: serverTimestamp() });
  } catch (error) {
    await updateDoc(announcementRef, {
      status: 'failed',
      errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      failedAt: serverTimestamp(),
    }).catch(() => {});
    throw error;
  }
}

export async function createAdminAnnouncement(input: CreateAnnouncementInput): Promise<string> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Please sign in again.');
  const clean = cleanAnnouncement(input);
  const reference = doc(collection(db, 'announcements'));
  await setDoc(reference, {
    title: clean.title,
    body: clean.body,
    audience: input.audience,
    ...(input.audience === 'user' ? { targetUserId: clean.targetUserId } : {}),
    status: 'queued',
    deliveredCount: 0,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
  });
  await deliverAdminAnnouncement(reference.id, {
    title: clean.title,
    body: clean.body,
    audience: input.audience,
    targetUserId: clean.targetUserId,
  });
  return reference.id;
}

export function subscribeToAdminAnnouncements(
  onData: (items: AdminAnnouncement[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(30)),
    snapshot => onData(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as AdminAnnouncement)),
    onError,
  );
}
