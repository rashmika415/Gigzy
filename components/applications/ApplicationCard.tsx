import { formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import type { Application, ApplicationStatus } from '../../types/application';

interface ApplicationCardProps {
  application: Application;
  onPress: () => void;
}

export function getStatusTheme(status: ApplicationStatus) {
  switch (status) {
    case 'accepted':
      return {
        label: 'Accepted',
        bg: colors.successLight,
        text: colors.success,
        border: colors.successBorder,
        icon: 'checkmark-circle' as const,
      };
    case 'rejected':
      return {
        label: 'Rejected',
        bg: colors.errorLight,
        text: colors.error,
        border: colors.errorBorder,
        icon: 'close-circle' as const,
      };
    case 'completed':
      return {
        label: 'Completed',
        bg: colors.infoLight,
        text: colors.info,
        border: colors.infoBorder,
        icon: 'trophy' as const,
      };
    case 'pending':
    default:
      return {
        label: 'Pending',
        bg: colors.warningLight,
        text: colors.warning,
        border: colors.warningBorder,
        icon: 'time' as const,
      };
  }
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp?.toDate
    ? timestamp.toDate()
    : timestamp?.toMillis
    ? new Date(timestamp.toMillis())
    : new Date(timestamp);

  if (isNaN(date.getTime())) return '';
  return localizedDate(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ApplicationCard({ application, onPress }: ApplicationCardProps) {
  useTranslation();
  const statusTheme = getStatusTheme(application.status);
  const appliedDate = formatDate(application.createdAt);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={tr("Application for {{value0}}, status {{value1}}", { value0: application.gigTitle || 'Gig', value1: statusTheme.label })}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.gigTitle} numberOfLines={1}>
            {application.gigTitle || tr("Gig Opportunity")}
          </Text>
          <View style={styles.businessRow}>
            <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.businessName} numberOfLines={1}>
              {application.businessName || tr("Business Owner")}
            </Text>
          </View>
        </View>

        {/* Status Badge */}
        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusTheme.bg, borderColor: statusTheme.border },
          ]}
        >
          <Ionicons name={statusTheme.icon} size={12} color={statusTheme.text} />
          <Text style={[styles.statusText, { color: statusTheme.text }]}>
            {tr(statusTheme.label)}
          </Text>
        </View>
      </View>

      {/* Message snippet preview */}
      {application.message ? (
        <Text style={styles.messagePreview} numberOfLines={2}>
          {'“'}{application.message}{'”'}
        </Text>
      ) : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Meta Footer Row */}
      <View style={styles.footerRow}>
        <View style={styles.metaGroup}>
          {application.gigLocation ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {application.gigLocation}
              </Text>
            </View>
          ) : null}

          {application.gigPay !== undefined && application.gigPay !== null ? (
            <View style={styles.metaItem}>
              <Ionicons name="wallet-outline" size={12} color={colors.primary} />
              <Text style={styles.payText}>
                ${application.gigPay}
                {application.gigPayType === 'hourly' ? tr("/hr") : tr(" fixed")}
              </Text>
            </View>
          ) : null}
        </View>

        {appliedDate ? (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{tr("Applied")}{' '}{appliedDate}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  gigTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  businessName: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
  },
  messagePreview: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  payText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
});
