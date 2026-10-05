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
} from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import { AppNotification } from '../types/notification';

// Spark-plan fallback: a youth client creates only its own validated announcements.
export function subscribeToGigAnnouncements(userId: string, onError: (error: Error) => void) {
  let stopped = false;
  const pending = new Set<string>();
  const completed = new Set<string>();
  const unsubscribe = onSnapshot(
    query(collection(db, 'gigs'), orderBy('createdAt', 'desc'), limit(20)),
    snapshot => {
      for (const gig of snapshot.docs) {
        if (gig.data().status !== 'open' || gig.data().postedBy?.uid === userId ||
            pending.has(gig.id) || completed.has(gig.id)) continue;
        pending.add(gig.id);
        const notification = doc(db, 'users', userId, 'notifications', `gig-posted-${gig.id}`);
        void runTransaction(db, async transaction => {
          if (stopped) return;
          if ((await transaction.get(notification)).exists()) return;
          // Re-read so a gig closed/deleted during delivery is not announced.
          const current = await transaction.get(gig.ref);
          const data = current.data();
          if (stopped || !data || data.status !== 'open' || data.postedBy?.uid === userId) return;
          transaction.set(notification, {
            userId,
            type: 'gig_posted',
            title: 'New gig posted',
            body: data.title,
            read: false,
            route: `/(app)/gig/${gig.id}`,
            entityId: gig.id,
            createdAt: serverTimestamp(),
          });
        }).then(() => { completed.add(gig.id); })
          .catch(error => { if (!stopped) onError(error); })
          .finally(() => { pending.delete(gig.id); });
      }
    },
    onError,
  );
  return () => { stopped = true; unsubscribe(); };
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
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AppNotification)),
    onError,
  );
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
