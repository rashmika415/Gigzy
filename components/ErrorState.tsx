import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';

interface ErrorStateProps {
  /** Primary error title */
  title?: string;
  /** Detailed error description or technical message */
  message?: string;
  /** Label for the retry button */
  retryLabel?: string;
  /** Called when the user taps "Retry" */
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  retryLabel = 'Retry',
  onRetry,
}: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle" size={32} color={colors.error} />
      </View>

      <Text style={styles.title}>{t(title)}</Text>

      {message ? (
        <Text style={styles.message}>{t(message)}</Text>
      ) : null}

      {onRetry && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={15} color="#FFF" />
          <Text style={styles.retryText}>{t(retryLabel)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    gap: 6,
    marginTop: 4,
  },
  retryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
