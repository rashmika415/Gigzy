import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../FirebaseConfig';
import { Message, SendMessageInput } from '../../types/messaging';

export async function sendMessage(input: SendMessageInput): Promise<string> {
  const cleanText = input.text.trim();
  if (!cleanText && !input.mediaUrl) {
    throw new Error('Message cannot be empty.');
  }

  const messagesRef = collection(db, 'conversations', input.conversationId, 'messages');
  const convRef = doc(db, 'conversations', input.conversationId);

  const messageData = {
    conversationId: input.conversationId,
    senderId: input.senderId,
    receiverId: input.receiverId,
    senderName: input.senderName || 'User',
    senderPhotoURL: input.senderPhotoURL || '',
    text: cleanText,
    mediaUrl: input.mediaUrl || '',
    type: input.type || (input.mediaUrl ? 'image' : 'text'),
    read: false,
    readBy: [input.senderId],
    createdAt: serverTimestamp(),
  };

  const msgDoc = await addDoc(messagesRef, messageData);

  const displayText = input.type === 'image' ? '📷 Photo attachment' : cleanText;
  await updateDoc(convRef, {
    lastMessage: displayText,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    [`unreadCount.${input.receiverId}`]: increment(1),
  });

  return msgDoc.id;
}

export function listenToMessages(
  conversationId: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (error: Error) => void
): () => void {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((d) => ({
        id: d.id,
        messageId: d.id,
        ...d.data(),
      })) as unknown as Message[];
      onUpdate(messages);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function markMessagesAsRead(conversationId: string, currentUserId: string): Promise<void> {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      where('receiverId', '==', currentUserId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.update(d.ref, {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`unreadCount.${currentUserId}`]: 0,
    });
  } catch (err) {
    console.warn('Non-critical: markMessagesAsRead error:', err);
  }
}
