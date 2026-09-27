export type NotificationType =
  | 'gig_match'
  | 'application'
  | 'message'
  | 'review'
  | 'endorsement'
  | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  route?: string;
  entityId?: string;
  createdAt?: unknown;
}
