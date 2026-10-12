import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, borderRadius } from '../constants/theme';

interface LoadingStateProps {
  /** Message displayed below the spinner */
  message?: string;
  /** Spinner size */
  size?: 'small' | 'large';
}

export default function LoadingState({
  message = 'Loading…',
  size = 'small',
}: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size={size} />
      <Text style={styles.text}>{t(message)}</Text>
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
    gap: spacing.md,
    marginTop: spacing.md,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
