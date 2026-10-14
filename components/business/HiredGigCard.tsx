import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../LocalizedText';
import StatusPill from '../StatusPill';
import { formatCalendarDate, formatCurrency } from '../../localization/format';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';
import type { Gig } from '../../types/gig';

interface HiredGigCardProps {
  gig: Gig;
  calendarState: 'idle' | 'adding' | 'added';
  reviewed: boolean;
  onOpen: (gig: Gig) => void;
  onMessage: (gig: Gig) => void;
  onCalendar: (gig: Gig) => void;
  onComplete: (gig: Gig) => void;
  onRate: (gig: Gig) => void;
  /** Report the hired freelancer (e.g. a no-show) */
  onReport?: (gig: Gig) => void;
}

/** A gig where the owner has hired someone: who, when, where, and the next action. */
export default function HiredGigCard({ gig, calendarState, reviewed, onOpen, onMessage, onCalendar, onComplete, onRate, onReport }: HiredGigCardProps) {
  const { t } = useTranslation();
  const completed = gig.status === 'completed';
  const name = gig.assignedYouthName || t('Assigned Freelancer');

  return <View style={styles.card}>
    <Pressable onPress={() => onOpen(gig)} accessibilityRole="button" style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <StatusPill status={gig.status} size="sm" />
        <Text style={styles.pay}>{formatCurrency(gig.pay || 0)}<Text style={styles.payType}>{gig.payType === 'hourly' ? t('/hr') : t(' fixed')}</Text></Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{gig.title}</Text>

      <View style={styles.person}>
        {gig.assignedYouthPhotoURL
          ? <Image source={{ uri: gig.assignedYouthPhotoURL }} style={styles.avatar} contentFit="cover" />
          : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text></View>}
        <View style={styles.personCopy}>
          <Text style={styles.personName} numberOfLines={1}>{name}</Text>
          <Text style={styles.meta}>{t('Hired for this gig')}</Text>
        </View>
      </View>

      {(gig.date || gig.location) && <View style={styles.metaRow}>
        {!!gig.date && <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.meta} numberOfLines={1}>{formatCalendarDate(gig.date)}{gig.time ? ` · ${gig.time}` : ''}</Text>
        </View>}
        {!!gig.location && <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.meta} numberOfLines={1}>{gig.location}</Text>
        </View>}
      </View>}
    </Pressable>

    <View style={styles.actions}>
      <Pressable onPress={() => onMessage(gig)} accessibilityRole="button" accessibilityLabel={t('Message Freelancer')}
        style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
        <Ionicons name="chatbubbles-outline" size={16} color={colors.primaryOnColor} />
        <Text style={styles.primaryText}>{t('Message')}</Text>
      </Pressable>
      <Pressable onPress={() => onCalendar(gig)} disabled={calendarState !== 'idle'} accessibilityRole="button"
        accessibilityLabel={calendarState === 'added' ? t('In calendar') : t('Add to Calendar')}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        {calendarState === 'adding' ? <ActivityIndicator color={colors.primary} />
          : <Ionicons name={calendarState === 'added' ? 'checkmark-circle' : 'calendar-outline'} size={18} color={calendarState === 'added' ? colors.success : colors.primary} />}
      </Pressable>
      {!completed ? (
        <Pressable onPress={() => onComplete(gig)} accessibilityRole="button"
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
          <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
          <Text style={[styles.secondaryText, { color: colors.success }]}>{t('Mark done')}</Text>
        </Pressable>
      ) : reviewed ? (
        <View style={[styles.button, styles.done]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.secondaryText, { color: colors.success }]}>{t('Reviewed')}</Text>
        </View>
      ) : (
        <Pressable onPress={() => onRate(gig)} accessibilityRole="button"
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
          <Ionicons name="star-outline" size={16} color={colors.star} />
          <Text style={styles.secondaryText}>{t('Rate')}</Text>
        </Pressable>
      )}
      {onReport && (
        <Pressable onPress={() => onReport(gig)} accessibilityRole="button" accessibilityLabel={t('Report Freelancer')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons name="flag-outline" size={18} color={colors.error} />
        </Pressable>
      )}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.surfaceBorder, padding: spacing.md, gap: spacing.sm + spacing.xs },
  body: { gap: spacing.sm + spacing.xs },
  pressed: { opacity: 0.8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pay: { ...typography.title, color: colors.primary },
  payType: { ...typography.caption, color: colors.primary },
  title: { ...typography.h3, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.sm + spacing.xs, borderRadius: borderRadius.md, backgroundColor: colors.surfaceElevated },
  avatar: { width: 40, height: 40, borderRadius: borderRadius.full },
  avatarFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.title, color: colors.primary },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { ...typography.title, fontSize: 15, color: colors.text },
  metaRow: { gap: spacing.xs + 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  meta: { ...typography.bodySmall, color: colors.textSecondary, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm + spacing.xs, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.sm + spacing.xs, borderRadius: borderRadius.md },
  primary: { flex: 1, backgroundColor: colors.primary },
  primaryText: { ...typography.label, color: colors.primaryOnColor },
  secondary: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  secondaryText: { ...typography.label, color: colors.text },
  done: { flex: 1, backgroundColor: colors.successLight },
  iconButton: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
});
