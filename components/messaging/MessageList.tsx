import React, { useRef, useEffect } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../constants/theme';
import { Message } from '../../types/messaging';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  onImagePress?: (url: string) => void;
}

function formatDateDivider(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MessageList({ messages, currentUserId, onImagePress }: MessageListProps) {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id || String(item.createdAt)}
      contentContainerStyle={styles.listContent}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      renderItem={({ item, index }) => {
        const isMe = item.senderId === currentUserId;
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const showDateDivider =
          !prevMessage ||
          formatDateDivider(item.createdAt) !== formatDateDivider(prevMessage.createdAt);

        return (
          <View key={item.id}>
            {showDateDivider && (
              <View style={styles.dateDivider}>
                <Text style={styles.dateDividerText}>{formatDateDivider(item.createdAt)}</Text>
              </View>
            )}
            <MessageBubble message={item} isMe={isMe} onImagePress={onImagePress} />
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Send a friendly greeting to start your conversation.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dateDividerText: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});
