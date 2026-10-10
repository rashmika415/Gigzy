import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { Message } from '../../types/messaging';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  onImagePress?: (url: string) => void;
}

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isMe, onImagePress }: MessageBubbleProps) {
  const isImage = Boolean(message.mediaUrl);

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
      {!isMe && (
        <View style={styles.avatarWrap}>
          {message.senderPhotoURL ? (
            <Image source={{ uri: message.senderPhotoURL }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(message.senderName?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
          isImage && styles.bubbleImage,
        ]}
      >
        {isImage && (
          <TouchableOpacity
            onPress={() => onImagePress?.(message.mediaUrl!)}
            activeOpacity={0.9}
            style={styles.imageWrap}
          >
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {Boolean(message.text) && (
          <Text style={[styles.text, isMe ? styles.textMe : styles.textOther]}>
            {message.text}
          </Text>
        )}

        <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowOther]}>
          <Text style={[styles.time, isMe ? styles.timeMe : styles.timeOther]}>
            {formatTime(message.createdAt)}
          </Text>
          {isMe && (
            <Ionicons
              name={message.read ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={message.read ? colors.primary : 'rgba(0, 55, 49, 0.6)'}
              style={styles.checkIcon}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    gap: 8,
  },
  rowMe: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  bubbleImage: {
    padding: 4,
  },
  imageWrap: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: 4,
  },
  messageImage: {
    width: 220,
    height: 150,
    borderRadius: borderRadius.md,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  textMe: {
    color: colors.primaryOnColor,
  },
  textOther: {
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  metaRowMe: {
    justifyContent: 'flex-end',
  },
  metaRowOther: {
    justifyContent: 'flex-start',
  },
  time: {
    fontSize: 11,
  },
  timeMe: {
    color: 'rgba(0, 55, 49, 0.75)',
  },
  timeOther: {
    color: colors.textMuted,
  },
  checkIcon: {
    marginLeft: 2,
  },
});
