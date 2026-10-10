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
  serverTimestamp,
  updateDoc,
  increment,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../FirebaseConfig';
import { Chat, ChatMessage, ParticipantDetail, MessageType } from '../types/chat';
import { Gig } from '../types/gig';
import { parseFirebaseError } from './gigService';

export * from './messaging/conversationService';
export * from './messaging/messageService';

/**
 * Derives a deterministic or unique ID for a conversation between two users for a specific gig or DM.
 */
export function generateChatId(uidA: string, uidB: string, gigId?: string, applicationId?: string): string {
  if (applicationId) {
    return `conv_${applicationId}`;
  }
  const sortedUsers = [uidA, uidB].sort().join('_');
  if (gigId) {
    return `conv_${gigId}_${sortedUsers}`;
  }
  return `conv_dm_${sortedUsers}`;
}

/**
 * Finds an existing conversation or creates a new conversation document in Firestore.
 */
export async function getOrCreateChat(
  currentUser: ParticipantDetail,
  otherUser: ParticipantDetail,
  gig?: Partial<Gig>,
  applicationId?: string
): Promise<Chat> {
  const chatId = generateChatId(currentUser.uid, otherUser.uid, gig?.id, applicationId);
  const convRef = doc(db, 'conversations', chatId);

  try {
    const convDoc = await getDoc(convRef);
    if (convDoc.exists()) {
      return {
        id: convDoc.id,
        conversationId: convDoc.id,
        ...convDoc.data(),
      } as Chat;
    }

    // Check legacy chats collection fallback
    const legacyDoc = await getDoc(doc(db, 'chats', chatId));
    if (legacyDoc.exists()) {
      return {
        id: legacyDoc.id,
        conversationId: legacyDoc.id,
        ...legacyDoc.data(),
      } as Chat;
    }

    const isCurrentYouth = currentUser.role === 'freelancer';
    const isOtherYouth = otherUser.role === 'freelancer';
    const youthId = isCurrentYouth ? currentUser.uid : (isOtherYouth ? otherUser.uid : currentUser.uid);
    const businessId = !isCurrentYouth && currentUser.role === 'client' ? currentUser.uid : (!isOtherYouth && otherUser.role === 'client' ? otherUser.uid : otherUser.uid);

    // Initialize new conversation document
    const newChatData: Record<string, any> = {
      conversationId: chatId,
      participants: [currentUser.uid, otherUser.uid],
      youthId,
      businessId,
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
      lastMessage: 'Application accepted. You can now chat.',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (applicationId) {
      newChatData.applicationId = applicationId;
    }

    if (gig?.id) {
      newChatData.gigId = gig.id;
      newChatData.gigTitle = gig.title || '';
      newChatData.gigPay = gig.pay;
      newChatData.gigPayType = gig.payType;
      newChatData.gigCategory = gig.category;
    }

    await setDoc(convRef, newChatData);

    return {
      id: chatId,
      conversationId: chatId,
      ...newChatData,
    } as Chat;
  } catch (error: any) {
    console.error('Error in getOrCreateChat:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Subscribes to real-time updates for all conversations where the user is a participant.
 */
export function subscribeToUserChats(
  userId: string,
  onUpdate: (chats: Chat[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const rawChats = snapshot.docs.map((d) => {
          const data = d.data();
          const lastMsg = typeof data.lastMessage === 'string'
            ? { text: data.lastMessage, senderId: '', senderName: '', createdAt: data.lastMessageAt, readBy: [] }
            : data.lastMessage;

          return {
            id: d.id,
            conversationId: d.id,
            ...data,
            lastMessage: lastMsg,
          };
        }) as Chat[];

        // Sort in memory by lastMessageAt or updatedAt descending
        const sorted = rawChats.sort((a, b) => {
          const timeA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : (a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.lastMessageAt || a.updatedAt || 0).getTime());
          const timeB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : (b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.lastMessageAt || b.updatedAt || 0).getTime());
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
 * Subscribes to messages within a specific conversation in real-time.
 */
export function subscribeToChatMessages(
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const messagesRef = collection(db, 'conversations', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs.map((d) => ({
          id: d.id,
          chatId,
          conversationId: chatId,
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
 * Sends a message and updates the parent conversation with lastMessage, lastMessageAt, and unreadCount.
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
    const messagesRef = collection(db, 'conversations', chatId, 'messages');
    const convRef = doc(db, 'conversations', chatId);

    const messageData = {
      chatId,
      conversationId: chatId,
      senderId: sender.uid,
      receiverId: recipientId,
      senderName: sender.fullName || 'User',
      senderPhotoURL: sender.photoURL || '',
      text: cleanText,
      mediaUrl: mediaUrl || '',
      type,
      read: false,
      readBy: [sender.uid],
      createdAt: serverTimestamp(),
    };

    // 1. Add message doc to subcollection
    const msgDoc = await addDoc(messagesRef, messageData);

    // 2. Update parent conversation record
    const displayText = type === 'image' ? '📷 Photo attachment' : cleanText;
    await updateDoc(convRef, {
      lastMessage: displayText,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      [`unreadCount.${recipientId}`]: increment(1),
    });

    return msgDoc.id;
  } catch (error: any) {
    console.error('Error in sendChatMessage:', error);
    throw new Error(parseFirebaseError(error));
  }
}

/**
 * Marks messages received by userId in the conversation as read, and resets unreadCount.
 */
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  try {
    const convRef = doc(db, 'conversations', chatId);

    // 1. Mark unread messages received by this user as read
    const messagesRef = collection(db, 'conversations', chatId, 'messages');
    const q = query(
      messagesRef,
      where('receiverId', '==', userId),
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

    // 2. Reset conversation unread counter for current user
    await updateDoc(convRef, {
      [`unreadCount.${userId}`]: 0,
    });
  } catch (error) {
    console.warn('Non-critical: markChatAsRead error:', error);
  }
}

/**
 * Uploads an image attachment for a message to Firebase Storage.
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
 * Fetches a single conversation document by ID once.
 */
export async function getChatById(chatId: string): Promise<Chat | null> {
  try {
    const convDoc = await getDoc(doc(db, 'conversations', chatId));
    if (convDoc.exists()) {
      return {
        id: convDoc.id,
        conversationId: convDoc.id,
        ...convDoc.data(),
      } as Chat;
    }

    // Legacy fallback to chats collection
    const legacyDoc = await getDoc(doc(db, 'chats', chatId));
    if (legacyDoc.exists()) {
      return {
        id: legacyDoc.id,
        conversationId: legacyDoc.id,
        ...legacyDoc.data(),
      } as Chat;
    }

    return null;
  } catch (error: any) {
    console.error('Error in getChatById:', error);
    throw new Error(parseFirebaseError(error));
  }
}
