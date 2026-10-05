import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { Conversation, ParticipantDetail } from '../../types/messaging';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  onPress: (conversation: Conversation) => void;
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ConversationItem({
  conversation,
  currentUserId,
  onPress,
}: ConversationItemProps) {
  const otherUid =
    conversation.participants?.find((p) => p !== currentUserId) ||
    (conversation.youthId === currentUserId ? conversation.businessId : conversation.youthId) ||
    '';

  const other: ParticipantDetail =
    conversation.participantDetails?.[otherUid] || {
      uid: otherUid,
      fullName: 'User',
      role: 'freelancer',
    };

  const isBusiness = other.role === 'client';
  const unreadCount = conversation.unreadCount?.[currentUserId] || 0;
  const isUnread = unreadCount > 0 || Boolean(conversation.unread);

  const lastMessageText =
    typeof conversation.lastMessage === 'string'
      ? conversation.lastMessage
      : conversation.lastMessage?.text || 'No messages yet';

  const isSentByMe =
    typeof conversation.lastMessage === 'object' &&
    conversation.lastMessage?.senderId === currentUserId;

  return (
    <TouchableOpacity
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => onPress(conversation)}
      activeOpacity={0.75}
    >
      <View style={styles.avatarWrapper}>
        {other.photoURL ? (
          <Image source={{ uri: other.photoURL }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarCircle, isBusiness && styles.avatarCircleBusiness]}>
            <Text style={[styles.avatarText, isBusiness && styles.avatarTextBusiness]}>
              {(other.fullName?.[0] || 'U').toUpperCase()}
            </Text>
          </View>
        )}
        {isUnread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.nameBlock}>
            <Text style={[styles.name, isUnread && styles.nameBold]} numberOfLines={1}>
              {other.fullName || 'User'}
            </Text>
            <View style={[styles.roleTag, isBusiness ? styles.roleTagBusiness : styles.roleTagYouth]}>
              <Text style={[styles.roleTagText, isBusiness ? styles.roleTagTextBusiness : styles.roleTagTextYouth]}>
                {isBusiness ? 'Client' : 'Freelancer'}
              </Text>
            </View>
          </View>
          <Text style={[styles.time, isUnread && styles.timeUnread]}>
            {formatTimestamp(conversation.lastMessageAt || conversation.createdAt)}
          </Text>
        </View>

        {conversation.gigTitle && (
          <View style={styles.gigPill}>
            <Ionicons name="briefcase-outline" size={11} color={colors.primary} />
            <Text style={styles.gigPillText} numberOfLines={1}>
              {conversation.gigTitle}
              {conversation.gigPay ? ` • $${conversation.gigPay}` : ''}
            </Text>
          </View>
        )}

        <View style={styles.messageRow}>
          <Text style={[styles.previewText, isUnread && styles.previewTextUnread]} numberOfLines={1}>
            {isSentByMe ? 'You: ' : ''}
            {lastMessageText}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleBusiness: {
    backgroundColor: 'rgba(44, 73, 104, 0.3)',
    borderColor: '#7BA6D6',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  avatarTextBusiness: {
    color: '#ADC9EE',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  nameBold: {
    fontWeight: '800',
    color: '#FFF',
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  roleTagYouth: {
    backgroundColor: colors.primaryLight,
    borderColor: 'rgba(111, 216, 199, 0.3)',
  },
  roleTagBusiness: {
    backgroundColor: 'rgba(44, 73, 104, 0.3)',
    borderColor: 'rgba(123, 166, 214, 0.4)',
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  roleTagTextYouth: {
    color: colors.primary,
  },
  roleTagTextBusiness: {
    color: '#ADC9EE',
  },
  time: {
    fontSize: 11,
    color: colors.textMuted,
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: '700',
  },
  gigPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(111, 216, 199, 0.08)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  gigPillText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  previewTextUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryOnColor,
  },
});
