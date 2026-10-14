import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../LocalizedText';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';
import type { Gig } from '../../types/gig';

interface BusinessGigActionsProps {
  gig: Gig;
  onApplicants: (gig: Gig) => void;
  onEdit: (gig: Gig) => void;
  onDelete: (gig: Gig) => void;
  /** Shown once a freelancer is hired */
  onRate?: (gig: Gig) => void;
  /** Report the hired freelancer; shown once someone is hired */
  onReport?: (gig: Gig) => void;
}

/** Owner's action row under a posted gig: Applicants (n) · Edit · [Rate] · [Report] · Delete. */
export default function BusinessGigActions({ gig, onApplicants, onEdit, onDelete, onRate, onReport }: BusinessGigActionsProps) {
  const { t } = useTranslation();
  const canRate = !!onRate && !!gig.assignedYouthId && (gig.status === 'in-progress' || gig.status === 'completed');
  return <View style={styles.row}>
    <Pressable onPress={() => onApplicants(gig)} accessibilityRole="button"
      style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
      <Ionicons name="people-outline" size={16} color={colors.primaryOnColor} />
      <Text style={styles.primaryText} numberOfLines={1}>{t('Applicants ({{count}})', { count: gig.applicantsCount || 0 })}</Text>
    </Pressable>
    <Pressable onPress={() => onEdit(gig)} accessibilityRole="button" accessibilityLabel={t('Edit gig')}
      style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
      <Ionicons name="create-outline" size={16} color={colors.primary} />
      <Text style={styles.secondaryText}>{t('Edit')}</Text>
    </Pressable>
    {canRate && (
      <Pressable onPress={() => onRate!(gig)} accessibilityRole="button" accessibilityLabel={t('Rate Freelancer')}
        style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
        <Ionicons name="star-outline" size={18} color={colors.star} />
      </Pressable>
    )}
    {!!onReport && !!gig.assignedYouthId && (
      <Pressable onPress={() => onReport(gig)} accessibilityRole="button" accessibilityLabel={t('Report Freelancer')}
        style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
        <Ionicons name="flag-outline" size={18} color={colors.error} />
      </Pressable>
    )}
    <Pressable onPress={() => onDelete(gig)} accessibilityRole="button" accessibilityLabel={t('Delete gig')}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
      <Ionicons name="trash-outline" size={18} color={colors.error} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.75 },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.sm + spacing.xs, borderRadius: borderRadius.md },
  primary: { flex: 1, backgroundColor: colors.primary },
  primaryText: { ...typography.label, flexShrink: 1, color: colors.primaryOnColor },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  secondaryText: { ...typography.label, color: colors.primary },
  icon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
});
