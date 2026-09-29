import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  increment,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../FirebaseConfig';
import { Chat, ChatMessage, ParticipantDetail, MessageType } from '../types/chat';
import { Gig } from '../types/gig';
import { parseFirebaseError } from './gigService';

/**
 * Derives a deterministic or unique ID for a conversation between two users for a specific gig or DM.
 */
export function generateChatId(uidA: string, uidB: string, gigId?: string): string {
  const sortedUsers = [uidA, uidB].sort().join('_');
  if (gigId) {
    return `${gigId}_${sortedUsers}`;
  }
  return `dm_${sortedUsers}`;
}

/**
 * Finds an existing chat or creates a new chat document in Firestore.
 */
export async function getOrCreateChat(
  currentUser: ParticipantDetail,
  otherUser: ParticipantDetail,
  gig?: Partial<Gig>
): Promise<Chat> {
  const chatId = generateChatId(currentUser.uid, otherUser.uid, gig?.id);
  const chatDocRef = doc(db, 'chats', chatId);

  try {
    const chatDoc = await getDoc(chatDocRef);
    if (chatDoc.exists()) {
      return {
        id: chatDoc.id,
        ...chatDoc.data(),
      } as Chat;
    }

    // Initialize new chat document
    const newChatData: Omit<Chat, 'id'> = {
      participants: [currentUser.uid, otherUser.uid],
      participantDetails: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          fullName: currentUser.fullName || 'User',
          photoURL: currentUser.photoURL || '',
          role: currentUser.role || 'freelancer',
          email: currentUser.email || '',
        },
        [otherUser.uid]: {
          uid: otherUser.uid,
          fullName: otherUser.fullName || 'User',
          photoURL: otherUser.photoURL || '',
          role: otherUser.role || 'freelancer',
          email: otherUser.email || '',
        },
      },
      unreadCount: {
        [currentUser.uid]: 0,
        [otherUser.uid]: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (gig?.id) {
      newChatData.gigId = gig.id;
      newChatData.gigTitle = gig.title || '';
      newChatData.gigPay = gig.pay;
      newChatData.gigPayType = gig.payType;
      newChatData.gigCategory = gig.category;
    }

    await setDoc(chatDocRef, newChatData);

    return {
      id: chatId,
      ...newChatData,
    } as Chat;
  } catch (error: any) {
    console.error('Error in getOrCreateChat:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Subscribes to real-time updates for all chats where the user is a participant.
 */
export function subscribeToUserChats(
  userId: string,
  onUpdate: (chats: Chat[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const rawChats = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Chat[];

        // Sort in memory by updatedAt descending
        const sorted = rawChats.sort((a, b) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt || 0).getTime();
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt || 0).getTime();
          return timeB - timeA;
        });

        onUpdate(sorted);
      },
      (error) => {
        console.error('Firestore subscribeToUserChats error:', error);
        if (onError) onError(new Error(parseFirebaseError(error)));
      }
    );
  } catch (e: any) {
    if (onError) onError(new Error(parseFirebaseError(e)));
    return () => {};
  }
}

/**
 * Subscribes to messages within a specific chat in real-time.
 */
export function subscribeToChatMessages(
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ChatMessage[];
        onUpdate(messages);
      },
      (error) => {
        console.error('Firestore subscribeToChatMessages error:', error);
        if (onError) onError(new Error(parseFirebaseError(error)));
      }
    );
  } catch (e: any) {
    if (onError) onError(new Error(parseFirebaseError(e)));
    return () => {};
  }
}

/**
 * Sends a chat message and updates the parent chat metadata with last message and unread count.
 */
export async function sendChatMessage(
  chatId: string,
  sender: ParticipantDetail,
  recipientId: string,
  text: string,
  mediaUrl?: string,
  type: MessageType = 'text'
): Promise<string> {
  const cleanText = text.trim();
  if (!cleanText && !mediaUrl) {
    throw new Error('Message cannot be empty.');
  }

  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatRef = doc(db, 'chats', chatId);

    const messageData = {
      chatId,
      senderId: sender.uid,
      senderName: sender.fullName || 'User',
      senderPhotoURL: sender.photoURL || '',
      text: cleanText,
      mediaUrl: mediaUrl || '',
      type,
      readBy: [sender.uid],
      createdAt: serverTimestamp(),
    };

    // 1. Add message doc to subcollection
    const msgDoc = await addDoc(messagesRef, messageData);

    // 2. Update parent chat record
    const displayText = type === 'image' ? '📷 Photo attachment' : cleanText;
    await updateDoc(chatRef, {
      lastMessage: {
        text: displayText,
        senderId: sender.uid,
        senderName: sender.fullName || 'User',
        createdAt: serverTimestamp(),
        readBy: [sender.uid],
        mediaUrl: mediaUrl || '',
      },
      [`unreadCount.${recipientId}`]: increment(1),
      updatedAt: serverTimestamp(),
    });

    return msgDoc.id;
  } catch (error: any) {
    console.error('Error in sendChatMessage:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Resets the unread counter for the current user and marks lastMessage as read.
 */
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const readBy = data.lastMessage?.readBy || [];

    const updates: Record<string, any> = {
      [`unreadCount.${userId}`]: 0,
    };

    if (!readBy.includes(userId) && data.lastMessage) {
      updates['lastMessage.readBy'] = [...readBy, userId];
    }

    await updateDoc(chatRef, updates);
  } catch (error) {
    console.warn('Non-critical: markChatAsRead error:', error);
  }
}

/**
 * Uploads an image attachment for a chat message to Firebase Storage.
 */
export async function uploadChatImage(chatId: string, localUri: string): Promise<string> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();

    const timestamp = Date.now();
    const imageRef = ref(storage, `chat_attachments/${chatId}/${timestamp}.jpg`);

    await uploadBytes(imageRef, blob);
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading chat image:', error);
    throw new Error('Failed to upload image. Please try again.');
  }
}

/**
 * Fetches a single chat document by ID once.
 */
export async function getChatById(chatId: string): Promise<Chat | null> {
  try {
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (!chatDoc.exists()) return null;
    return {
      id: chatDoc.id,
      ...chatDoc.data(),
    } as Chat;
  } catch (error: any) {
    console.error('Error in getChatById:', error);
    throw new Error(parseFirebaseError(error));
  }
}
