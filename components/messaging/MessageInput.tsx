import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickImage?: () => void;
  selectedImageUri?: string | null;
  onRemoveImage?: () => void;
  sending?: boolean;
  disabled?: boolean;
}

export default function MessageInput({
  value,
  onChangeText,
  onSend,
  onPickImage,
  selectedImageUri,
  onRemoveImage,
  sending,
  disabled,
}: MessageInputProps) {
  const canSend = Boolean(value.trim() || selectedImageUri) && !sending && !disabled;

  return (
    <View style={styles.container}>
      {selectedImageUri && (
        <View style={styles.imagePreviewRow}>
          <Image source={{ uri: selectedImageUri }} style={styles.previewThumbnail} />
          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle}>Image attached</Text>
            <Text style={styles.previewSubtitle}>Ready to send</Text>
          </View>
          <TouchableOpacity
            style={styles.removeImageBtn}
            onPress={onRemoveImage}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        {onPickImage && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onPickImage}
            disabled={sending || disabled}
            activeOpacity={0.7}
          >
            <Ionicons name="image-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={1000}
          editable={!sending && !disabled}
        />

        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.primaryOnColor} />
          ) : (
            <Ionicons name="send" size={18} color={colors.primaryOnColor} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: spacing.sm,
  },
  previewThumbnail: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
  },
  previewInfo: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  previewSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  removeImageBtn: {
    padding: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
