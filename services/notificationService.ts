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
  where,
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

export function subscribeToApplicationAnnouncements(userId: string, onError?: (error: Error) => void) {
  let active = true;
  const unsubscribe = onSnapshot(
    query(collection(db, 'applications'), where('businessId', '==', userId)),
    (snapshot) => {
      if (!active) return;
      for (const item of snapshot.docs) {
        const ref = doc(db, 'users', userId, 'notifications', `application-${item.id}`);
        void runTransaction(db, async (transaction) => {
          if (!active) return;
          const existing = await transaction.get(ref);
          if (existing.exists()) return;
          const application = (await transaction.get(item.ref)).data();
          if (!application || application.businessId !== userId || !application.youthId
            || application.youthId === userId || !application.gigId) return;
          const gig = (await transaction.get(doc(db, 'gigs', application.gigId))).data();
          if (!active || gig?.postedBy?.uid !== userId) return;
          transaction.set(ref, {
            userId, type: 'application', title: 'New gig application',
            body: `${application.youthName || 'A youth user'} applied to your gig.`,
            route: `/(app)/gig/${application.gigId}`, entityId: item.id,
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
