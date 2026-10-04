import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';

interface EmptyStateProps {
  /** Ionicon name for the icon inside the hero circle */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Primary headline */
  title: string;
  /** Supporting copy below the title */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button icon (Ionicon name) */
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /** Called when the action button is pressed */
  onAction?: () => void;
}

export default function EmptyState({
  icon = 'briefcase-outline',
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
}: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>

      <Text style={styles.title}>{t(title)}</Text>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {onAction && actionLabel && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t(actionLabel ?? '')}
          style={styles.actionBtn}
          onPress={onAction}
          activeOpacity={0.85}
        >
          {actionIcon && (
            <Ionicons name={actionIcon} size={20} color={colors.primaryOnColor} />
          )}
          <Text style={styles.actionText}>{t(actionLabel ?? '')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: 8,
    marginTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  actionText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontWeight: '800',
  },
});
