import { formatCurrency, formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../../constants/theme';
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

export function ApplicationStatusPill({ status }: { status: Application['status'] }) {
  const { t } = useTranslation();
  const theme = getStatusTheme(status);
  return <View style={[styles.statusPill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
    <Ionicons name={theme.icon} size={12} color={theme.text} />
    <Text style={[styles.statusText, { color: theme.text }]}>{t(theme.label)}</Text>
  </View>;
}

/** Accepted, in progress or done. Older documents may say "approved" or "in-progress". */
export function isHiredStatus(status: unknown): boolean {
  return ['accepted', 'approved', 'in-progress', 'completed'].includes(String(status || '').toLowerCase());
}

/** Some older documents store a user reference object instead of the uid string. */
export function uidOf(value: unknown): string {
  if (value && typeof value === 'object') return String((value as any).uid || (value as any).id || '');
  return String(value || '');
}

export function toDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp?.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

export default function ApplicationCard({ application, onPress }: ApplicationCardProps) {
  const { t } = useTranslation();
  const statusTheme = getStatusTheme(application.status);
  const applied = toDate(application.createdAt);
  const hasPay = application.gigPay !== undefined && application.gigPay !== null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('Application for {{value0}}, status {{value1}}', { value0: application.gigTitle || t('Gig'), value1: t(statusTheme.label) })}
    >
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.gigTitle} numberOfLines={2}>
            {application.gigTitle || t('Gig Opportunity')}
          </Text>
          <View style={styles.metaItem}>
            <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.businessName} numberOfLines={1}>
              {application.businessName || t('Business Owner')}
            </Text>
          </View>
        </View>
        <ApplicationStatusPill status={application.status} />
      </View>

      {hasPay || !!application.gigLocation ? (
        <View style={styles.metaRow}>
          {hasPay ? (
            <Text style={styles.payText}>
              {formatCurrency(application.gigPay!)}
              <Text style={styles.payType}>{application.gigPayType === 'hourly' ? t('/hr') : t(' fixed')}</Text>
            </Text>
          ) : null}
          {application.gigLocation ? (
            <View style={[styles.metaItem, styles.flexShrink]}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{application.gigLocation}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.metaText}>
          {applied ? `${t('Applied')} ${localizedDate(applied)}` : ''}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.sm + spacing.xs,
    gap: spacing.sm,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  headerLeft: { flex: 1, gap: spacing.xs },
  gigTitle: { ...typography.title, color: colors.text },
  businessName: { ...typography.bodySmall, color: colors.textSecondary, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full, borderWidth: 1 },
  statusText: { ...typography.caption, fontFamily: typography.label.fontFamily },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flexShrink: { flexShrink: 1 },
  payText: { ...typography.label, color: colors.primary },
  payType: { ...typography.caption, color: colors.primary },
  metaText: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceBorderSubtle },
});
