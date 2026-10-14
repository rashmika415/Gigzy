import { formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import Chip from '../Chip';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import type { Application } from '../../types/application';
import { ApplicationStatusPill, getStatusTheme, toDate } from './ApplicationCard';

interface ApplicantCardProps {
  application: Application;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  /** Disables the decision buttons while a request for this applicant is in flight */
  busy?: boolean;
  onRate?: () => void;
}

export { ApplicationStatusPill, toDate };

export function ApplicantAvatar({ application, size = 44 }: { application: Application; size?: number }) {
  const initial = (application.youthName?.[0] || 'Y').toUpperCase();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return application.youthPhotoURL
    ? <Image source={{ uri: application.youthPhotoURL }} style={[styles.avatar, shape]} contentFit="cover" transition={150} />
    : <View style={[styles.avatarFallback, shape]}><Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initial}</Text></View>;
}

export default function ApplicantCard({ application, onPress, onAccept, onReject, busy = false }: ApplicantCardProps) {
  const { t } = useTranslation();
export default function ApplicantCard({
  application,
  onPress,
  onAccept,
  onReject,
  onRate,
}: ApplicantCardProps) {
  useTranslation();
  const statusTheme = getStatusTheme(application.status);
  const applied = toDate(application.createdAt);
  const skills = (application.youthSkills || []).slice(0, 3);
  const extraSkills = (application.youthSkills?.length || 0) - skills.length;
  const isPending = application.status === 'pending';
  const name = application.youthName || t('Youth Freelancer');
  const statusLower = (application.status || '').toLowerCase();
  const isPending = statusLower === 'pending';
  const isAccepted = ['accepted', 'approved', 'in-progress', 'completed'].includes(statusLower);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('Applicant {{value0}}, status {{value1}}', { value0: name, value1: t(statusTheme.label) })}
    >
      <View style={styles.topRow}>
        <ApplicantAvatar application={application} />
        <View style={styles.nameContainer}>
          <Text style={styles.youthName} numberOfLines={1}>{name}</Text>
          <View style={styles.metaRow}>
            {applied && <Text style={styles.metaText}>{t('Applied {{date}}', { date: localizedDate(applied, { month: 'short', day: 'numeric' }) })}</Text>}
            {!!application.youthRatingAverage && application.youthRatingAverage > 0 && (
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color={colors.star} />
                <Text style={styles.metaText}>
                  {application.youthRatingAverage.toFixed(1)}{application.youthRatingCount ? ` (${application.youthRatingCount})` : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
        <ApplicationStatusPill status={application.status} />
      </View>

      {!!application.message && (
        <Text style={styles.message} numberOfLines={2}>“{application.message}”</Text>
      )}

      {skills.length > 0 && (
        <View style={styles.skillsRow}>
          {skills.map(skill => <Chip key={skill} label={skill} size="sm" />)}
          {extraSkills > 0 && <Text style={styles.metaText}>{t('+{{count}} more', { count: extraSkills })}</Text>}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.viewDetails}>
          <Text style={styles.viewDetailsText}>{t('View Details')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
        {isPending && (onAccept || onReject) && (
          <View style={styles.decisions}>
            {busy ? <ActivityIndicator color={colors.primary} style={styles.busy} /> : <>
              {onReject && (
                <Pressable onPress={onReject} accessibilityRole="button" accessibilityLabel={t('Reject {{name}}', { name })}
                  style={({ pressed }) => [styles.decision, styles.reject, pressed && styles.pressed]}>
                  <Ionicons name="close" size={16} color={colors.error} />
                  <Text style={styles.rejectText}>{t('Reject')}</Text>
                </Pressable>
              )}
              {onAccept && (
                <Pressable onPress={onAccept} accessibilityRole="button" accessibilityLabel={t('Accept {{name}}', { name })}
                  style={({ pressed }) => [styles.decision, styles.accept, pressed && styles.pressed]}>
                  <Ionicons name="checkmark" size={16} color={colors.primaryOnColor} />
                  <Text style={styles.acceptText}>{t('Accept')}</Text>
                </Pressable>
              )}
            </>}

        {isPending && (onAccept || onReject) ? (
          <View style={styles.decisionBtnsRow}>
            {onReject && (
              <TouchableOpacity
                style={styles.cardRejectBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onReject();
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={tr("Reject")}
              >
                <Ionicons name="close-circle-outline" size={15} color={colors.error} />
                <Text style={styles.cardRejectBtnText}>{tr("Reject")}</Text>
              </TouchableOpacity>
            )}

            {onAccept && (
              <TouchableOpacity
                style={styles.cardAcceptBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onAccept();
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={tr("Accept")}
              >
                <Ionicons name="checkmark-circle" size={15} color={colors.primaryOnColor} />
                <Text style={styles.cardAcceptBtnText}>{tr("Accept")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isAccepted && onRate ? (
          <TouchableOpacity
            style={styles.cardRateBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onRate();
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={tr("Rate Freelancer")}
          >
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={styles.cardRateBtnText}>{tr("Rate Freelancer")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.availabilityBadge}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={styles.availabilityText}>{tr("Available")}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.surfaceBorder, padding: spacing.md, gap: spacing.sm + spacing.xs },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  avatar: { backgroundColor: colors.surfaceElevated },
  avatarFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.title.fontFamily, color: colors.primary },
  nameContainer: { flex: 1, minWidth: 0, gap: 2 },
  youthName: { ...typography.title, color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm },
  metaText: { ...typography.caption, fontFamily: typography.bodySmall.fontFamily, color: colors.textSecondary },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  message: { ...typography.bodySmall, color: colors.textSecondary },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs + 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.sm + spacing.xs, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewDetailsText: { ...typography.label, color: colors.primary },
  decisions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  busy: { minHeight: 44, paddingHorizontal: spacing.md },
  decision: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.md },
  reject: { borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.surface },
  rejectText: { ...typography.label, color: colors.error },
  accept: { backgroundColor: colors.primary },
  acceptText: { ...typography.label, color: colors.primaryOnColor },
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceBorder,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  youthName: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  appliedDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.warning,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
  },
  messagePreview: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  skillChip: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  skillText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
  },
  moreSkillsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availabilityText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.success,
  },
  viewApplicantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewApplicantText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  gigTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  gigTagText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  decisionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  cardRejectBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.error,
  },
  cardAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  cardAcceptBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryOnColor,
  },
  cardRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  cardRateBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.warning,
  },
});
