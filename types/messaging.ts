export interface ParticipantDetail {
  uid: string;
  fullName: string;
  photoURL?: string;
  role: 'freelancer' | 'client' | 'admin';
  email?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: any;
  read: boolean;
  senderName?: string;
  senderPhotoURL?: string;
  mediaUrl?: string;
  type?: 'text' | 'image' | 'system' | 'offer';
}

export interface Conversation {
  id: string;
  conversationId?: string;
  gigId?: string;
  applicationId?: string;
  youthId: string;
  businessId: string;
  participants: string[];
  participantDetails?: Record<string, ParticipantDetail>;
  gigTitle?: string;
  gigPay?: number;
  gigPayType?: 'fixed' | 'hourly';
  gigCategory?: string;
  lastMessage: string | { text: string; senderId?: string; createdAt?: any };
  lastMessageAt: any;
  createdAt: any;
  updatedAt?: any;
  unreadCount?: Record<string, number>;
  unread?: boolean;
}

export interface CreateConversationInput {
  applicationId: string;
  gigId?: string;
  youthId: string;
  businessId: string;
  gigTitle?: string;
  gigPay?: number;
  gigPayType?: 'fixed' | 'hourly';
  gigCategory?: string;
  youthName?: string;
  youthPhotoURL?: string;
  businessName?: string;
  businessPhotoURL?: string;
  initialMessage?: string;
}

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  senderName?: string;
  senderPhotoURL?: string;
  mediaUrl?: string;
  type?: 'text' | 'image' | 'system' | 'offer';
}
