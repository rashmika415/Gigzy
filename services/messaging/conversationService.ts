import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../FirebaseConfig';
import { Conversation, CreateConversationInput } from '../../types/messaging';

export function deriveConversationId(youthId: string, businessId: string, applicationId?: string, gigId?: string): string {
  if (applicationId) {
    return `conv_${applicationId}`;
  }
  const sorted = [youthId, businessId].sort().join('_');
  if (gigId) {
    return `conv_${gigId}_${sorted}`;
  }
  return `conv_dm_${sorted}`;
}

export async function createConversation(input: CreateConversationInput): Promise<Conversation> {
  const conversationId = deriveConversationId(input.youthId, input.businessId, input.applicationId, input.gigId);
  const convRef = doc(db, 'conversations', conversationId);

  const existing = await getDoc(convRef);
  if (existing.exists()) {
    const data = existing.data();
    return {
      id: existing.id,
      conversationId: existing.id,
      ...data,
    } as Conversation;
  }

  const participants = [input.youthId, input.businessId];
  const participantDetails = {
    [input.youthId]: {
      uid: input.youthId,
      fullName: input.youthName || 'Youth Freelancer',
      photoURL: input.youthPhotoURL || '',
      role: 'freelancer' as const,
    },
    [input.businessId]: {
      uid: input.businessId,
      fullName: input.businessName || 'Business Owner',
      photoURL: input.businessPhotoURL || '',
      role: 'client' as const,
    },
  };

  const newConvData: Record<string, any> = {
    conversationId,
    applicationId: input.applicationId,
    youthId: input.youthId,
    businessId: input.businessId,
    participants,
    participantDetails,
    lastMessage: input.initialMessage || 'Application accepted. You can now chat.',
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadCount: {
      [input.youthId]: 0,
      [input.businessId]: 0,
    },
  };

  if (input.gigId) newConvData.gigId = input.gigId;
  if (input.gigTitle) newConvData.gigTitle = input.gigTitle;
  if (input.gigPay !== undefined) newConvData.gigPay = input.gigPay;
  if (input.gigPayType) newConvData.gigPayType = input.gigPayType;
  if (input.gigCategory) newConvData.gigCategory = input.gigCategory;

  await setDoc(convRef, newConvData);

  return {
    id: conversationId,
    conversationId,
    ...newConvData,
  } as Conversation;
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    conversationId: snap.id,
    ...snap.data(),
  } as Conversation;
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((d) => ({
    id: d.id,
    conversationId: d.id,
    ...d.data(),
  })) as Conversation[];

  return items.sort((a, b) => {
    const timeA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : new Date(a.lastMessageAt || 0).getTime();
    const timeB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : new Date(b.lastMessageAt || 0).getTime();
    return timeB - timeA;
  });
}

export function listenToConversations(
  userId: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        conversationId: d.id,
        ...d.data(),
      })) as Conversation[];

      const sorted = items.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : new Date(a.lastMessageAt || 0).getTime();
        const timeB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : new Date(b.lastMessageAt || 0).getTime();
        return timeB - timeA;
      });

      onUpdate(sorted);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function markConversationAsRead(conversationId: string, userId: string): Promise<void> {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`unreadCount.${userId}`]: 0,
    });
  } catch (error) {
    console.warn('markConversationAsRead warning:', error);
  }
}
