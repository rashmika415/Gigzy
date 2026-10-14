import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../constants/theme';

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
  /** Outlined button for low-emphasis actions such as "Clear filters" */
  secondary?: boolean;
}

export default function EmptyState({
  icon = 'briefcase-outline',
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  secondary = false,
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(actionLabel ?? '')}
          style={({ pressed }) => [styles.actionBtn, secondary && styles.secondaryBtn, pressed && styles.pressed]}
          onPress={onAction}
        >
          {actionIcon && (
            <Ionicons name={actionIcon} size={20} color={secondary ? colors.primary : colors.primaryOnColor} />
          )}
          <Text style={[styles.actionText, secondary && styles.secondaryText]}>{t(actionLabel ?? '')}</Text>
        </Pressable>
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
    fontFamily: fonts.bodyBold,
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
    minHeight: 44,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  secondaryText: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  actionText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
});
