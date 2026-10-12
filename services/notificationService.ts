import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import { AppNotification } from '../types/notification';

export function subscribeToGigAnnouncements(userId: string, onError?: (error: Error) => void) {
  let active = true;
  const unsubscribe = onSnapshot(
    query(collection(db, 'gigs'), orderBy('createdAt', 'desc'), limit(20)),
    (snapshot) => {
      if (!active) return;
      for (const item of snapshot.docs) {
        const ref = doc(db, 'users', userId, 'notifications', `gig-posted-${item.id}`);
        void runTransaction(db, async (transaction) => {
          if (!active) return;
          const existing = await transaction.get(ref);
          if (existing.exists()) return;
          const gig = (await transaction.get(item.ref)).data();
          if (!active || gig?.status !== 'open' || !gig.postedBy?.uid
            || gig.postedBy.uid === userId || typeof gig.title !== 'string') return;
          transaction.set(ref, {
            userId, type: 'gig_posted', title: 'New gig posted', body: gig.title,
            route: `/(app)/gig/${item.id}`, entityId: item.id,
            read: false, createdAt: serverTimestamp(),
          });
        }).catch((error: Error) => { if (active) onError?.(error); });
      }
    },
    onError,
  );
  return () => { active = false; unsubscribe(); };
}

export async function sendNotification(
  userId: string,
  notification: Omit<AppNotification, 'id'>,
): Promise<string> {
  const notifRef = doc(collection(db, 'users', userId, 'notifications'));
  await setDoc(notifRef, {
    ...notification,
    userId,
    read: false,
    createdAt: serverTimestamp(),
  });
  return notifRef.id;
}

export function subscribeToNotifications(
  userId: string,
  onData: (items: AppNotification[]) => void,
  onError?: (error: Error) => void,
) {
  const notificationsQuery = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    notificationsQuery,
    (snapshot) => onData(deduplicateNotifications(
      snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as AppNotification),
    )),
    onError,
  );
}

// Snapshots are ordered newest first. Older app versions wrote both a random-ID
// announcement and a deterministic one for the same event.
function deduplicateNotifications(items: AppNotification[]): AppNotification[] {
  const events = new Map<string, AppNotification>();
  const result: AppNotification[] = [];
  for (const item of items) {
    let event: string | undefined;
    if (item.entityId && item.type === 'gig_posted') event = 'gig_posted';
    if (item.entityId && item.type === 'application') {
      if (item.title === 'New gig application' || item.title.startsWith('New Applicant!')) {
        event = 'application_received';
      } else if (item.title.startsWith('Application Accepted!')) {
        event = 'application_accepted';
      } else if (item.title === 'Application Status Update') {
        event = 'application_rejected';
      }
    }
    if (!event) {
      result.push(item);
      continue;
    }
    const key = JSON.stringify([item.userId, event, item.entityId]);
    const latest = events.get(key);
    if (!latest) {
      const copy = { ...item };
      events.set(key, copy);
      result.push(copy);
    } else {
      // Prefer the actual submission record over the old listener's generic
      // copy, including its original ID, timestamp, details and destination.
      const read = latest.read || item.read;
      if (event === 'application_received'
        && item.title.startsWith('New Applicant!')
        && !latest.title.startsWith('New Applicant!')) {
        Object.assign(latest, item);
      }
      latest.read = read;
    }
  }
  // Replacing a generic copy can move the event back to its real creation time.
  const positions = new Map(items.map((item, index) => [item.id, index]));
  return result.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(userId: string, items: AppNotification[]) {
  const unread = items.filter((item) => !item.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((item) => batch.update(doc(db, 'users', userId, 'notifications', item.id), {
    read: true,
    readAt: serverTimestamp(),
  }));
  await batch.commit();
}
