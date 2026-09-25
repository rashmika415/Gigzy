import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import { AppNotification } from '../types/notification';

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
