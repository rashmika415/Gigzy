import { PayType } from './gig';

export interface ParticipantDetail {
  uid: string;
  fullName: string;
  photoURL?: string;
  role: 'freelancer' | 'client' | 'admin';
  email?: string;
}

export interface LastMessage {
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any;
  readBy: string[];
  mediaUrl?: string;
}

export interface Chat {
  id: string;
  gigId?: string;
  gigTitle?: string;
  gigPay?: number;
  gigPayType?: PayType;
  gigCategory?: string;
  participants: string[];
  participantDetails: Record<string, ParticipantDetail>;
  lastMessage?: LastMessage;
  unreadCount?: Record<string, number>;
  createdAt: any;
  updatedAt: any;
}

export type MessageType = 'text' | 'image' | 'system' | 'offer';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  mediaUrl?: string;
  type: MessageType;
  readBy: string[];
  createdAt: any;
}

export interface QuickReply {
  id: string;
  text: string;
  category?: 'general' | 'availability' | 'pricing' | 'scheduling';
}

export const FREELANCER_QUICK_REPLIES: QuickReply[] = [
  { id: '1', text: 'Hi! I am interested and available to start immediately.' },
  { id: '2', text: 'Could you share more details about the project requirements?' },
  { id: '3', text: 'I have experience in this exact field. Here is my availability.' },
  { id: '4', text: 'What is the expected deadline for this gig?' },
  { id: '5', text: 'Thank you! Looking forward to working together.' },
];

export const BUSINESS_QUICK_REPLIES: QuickReply[] = [
  { id: 'b1', text: 'Hi! Thanks for reaching out. When are you available to begin?' },
  { id: 'b2', text: 'Can you share examples or references of similar work you have done?' },
  { id: 'b3', text: 'The budget and timeline in the gig description are fixed.' },
  { id: 'b4', text: 'Would you be available for a brief introductory call today?' },
  { id: 'b5', text: 'We would love to move forward with you on this task!' },
];

export interface ChatFilterOptions {
  searchQuery?: string;
  filterTab?: 'all' | 'unread' | 'gigs';
}
