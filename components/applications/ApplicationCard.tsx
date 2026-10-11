import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
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
        bg: 'rgba(16, 185, 129, 0.12)',
        text: '#059669',
        border: 'rgba(16, 185, 129, 0.3)',
        icon: 'checkmark-circle' as const,
      };
    case 'rejected':
      return {
        label: 'Rejected',
        bg: 'rgba(239, 68, 68, 0.12)',
        text: '#DC2626',
        border: 'rgba(239, 68, 68, 0.3)',
        icon: 'close-circle' as const,
      };
    case 'completed':
      return {
        label: 'Completed',
        bg: 'rgba(99, 102, 241, 0.12)',
        text: '#4F46E5',
        border: 'rgba(99, 102, 241, 0.3)',
        icon: 'trophy' as const,
      };
    case 'pending':
    default:
      return {
        label: 'Pending',
        bg: 'rgba(245, 158, 11, 0.12)',
        text: '#D97706',
        border: 'rgba(245, 158, 11, 0.3)',
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
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ApplicationCard({ application, onPress }: ApplicationCardProps) {
  const statusTheme = getStatusTheme(application.status);
  const appliedDate = formatDate(application.createdAt);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Application for ${application.gigTitle || 'Gig'}, status ${statusTheme.label}`}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.gigTitle} numberOfLines={1}>
            {application.gigTitle || 'Gig Opportunity'}
          </Text>
          <View style={styles.businessRow}>
            <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.businessName} numberOfLines={1}>
              {application.businessName || 'Business Owner'}
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
            {statusTheme.label}
          </Text>
        </View>
      </View>

      {/* Message snippet preview */}
      {application.message ? (
        <Text style={styles.messagePreview} numberOfLines={2}>
          "{application.message}"
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
                {application.gigPayType === 'hourly' ? '/hr' : ' fixed'}
              </Text>
            </View>
          ) : null}
        </View>

        {appliedDate ? (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>Applied {appliedDate}</Text>
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
    fontWeight: '700',
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
    fontWeight: '500',
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
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.primary,
  },
});
