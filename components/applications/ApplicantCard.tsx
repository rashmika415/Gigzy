import { formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import Chip from '../Chip';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import type { Application } from '../../types/application';
import { ApplicationStatusPill, getStatusTheme, isHiredStatus, toDate } from './ApplicationCard';

interface ApplicantCardProps {
  application: Application;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  /** Shown once the applicant is hired, so the business can rate them */
  onRate?: () => void;
  /** Disables the decision buttons while a request for this applicant is in flight */
  busy?: boolean;
}

export { ApplicationStatusPill, toDate };

export function ApplicantAvatar({ application, size = 44 }: { application: Application; size?: number }) {
  const initial = (application.youthName?.[0] || 'Y').toUpperCase();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return application.youthPhotoURL
    ? <Image source={{ uri: application.youthPhotoURL }} style={[styles.avatar, shape]} contentFit="cover" transition={150} />
    : <View style={[styles.avatarFallback, shape]}><Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initial}</Text></View>;
}

export default function ApplicantCard({ application, onPress, onAccept, onReject, onRate, busy = false }: ApplicantCardProps) {
  const { t } = useTranslation();
  const statusTheme = getStatusTheme(application.status);
  const applied = toDate(application.createdAt);
  const skills = (application.youthSkills || []).slice(0, 3);
  const extraSkills = (application.youthSkills?.length || 0) - skills.length;
  const isPending = application.status === 'pending';
  const isHired = isHiredStatus(application.status);
  const name = application.youthName || t('Youth Freelancer');

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
          </View>
        )}
        {isHired && onRate && (
          <Pressable onPress={onRate} accessibilityRole="button" accessibilityLabel={t('Rate Freelancer')}
            style={({ pressed }) => [styles.decision, styles.rate, pressed && styles.pressed]}>
            <Ionicons name="star-outline" size={16} color={colors.star} />
            <Text style={styles.rateText}>{t('Rate')}</Text>
          </Pressable>
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
  rate: { borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningLight },
  rateText: { ...typography.label, color: colors.warning },
});
