import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../LocalizedText';
import Chip from '../Chip';
import StatusPill from '../StatusPill';
import { formatCalendarDate, formatCurrency } from '../../localization/format';
import { categoryId } from '../../services/discoveryFilters';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';
import { GIG_CATEGORIES } from '../../types/gig';
import type { Gig } from '../../types/gig';

interface GigDetailSheetProps {
  gig: Gig | null;
  onClose: () => void;
  onEdit: (gig: Gig) => void;
  onChangeStatus: (gig: Gig) => void;
  onApplicants: (gig: Gig) => void;
}

const LOCATION_LABEL: Record<string, string> = { remote: 'Remote', 'on-site': 'On-site', hybrid: 'Hybrid' };

/** Read-only summary of a posted gig with the owner's main actions pinned to the bottom. */
export default function GigDetailSheet({ gig, onClose, onEdit, onChangeStatus, onApplicants }: GigDetailSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (!gig) return null;
  const category = GIG_CATEGORIES.find(item => item.id === categoryId(gig.category))?.name ?? gig.category;
  const specs: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'calendar-outline', label: 'Date', value: gig.date ? `${formatCalendarDate(gig.date)}${gig.time ? ` · ${gig.time}` : ''}` : t('Flexible') },
    { icon: gig.locationType === 'remote' ? 'globe-outline' : 'location-outline', label: t(LOCATION_LABEL[gig.locationType] ?? 'Location'), value: gig.location || t('Remote') },
    { icon: 'people-outline', label: 'Applicants', value: String(gig.applicantsCount || 0) },
  ];

  return <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('Close')} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerBadges}>
            <Chip label={t(category)} size="sm" />
            <StatusPill status={gig.status} />
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Close')}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={styles.title}>{gig.title}</Text>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.payBox}>
            <Text style={styles.payLabel}>{t('Pay')}</Text>
            <Text style={styles.payAmount}>
              {formatCurrency(gig.pay)}
              <Text style={styles.payType}>{gig.payType === 'hourly' ? t('/hr') : t(' fixed')}</Text>
            </Text>
          </View>

          <View style={styles.specs}>
            {specs.map(spec => <View key={spec.label} style={styles.spec}>
              <View style={styles.specIcon}><Ionicons name={spec.icon} size={16} color={colors.primary} /></View>
              <View style={styles.specCopy}>
                <Text style={styles.specLabel}>{t(spec.label)}</Text>
                <Text style={styles.specValue} numberOfLines={2}>{spec.value}</Text>
              </View>
            </View>)}
          </View>

          <Text style={styles.sectionTitle}>{t('Job Description')}</Text>
          <Text style={styles.description}>{gig.description}</Text>

          {gig.skills?.length > 0 && <>
            <Text style={styles.sectionTitle}>{t('Required Skills')}</Text>
            <View style={styles.skills}>{gig.skills.map(skill => <Chip key={skill} label={skill} size="sm" />)}</View>
          </>}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <Pressable onPress={() => onApplicants(gig)} accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
            <Ionicons name="people-outline" size={18} color={colors.primaryOnColor} />
            <Text style={styles.primaryText}>{t('Applicants ({{count}})', { count: gig.applicantsCount || 0 })}</Text>
          </Pressable>
          <View style={styles.footerRow}>
            <Pressable onPress={() => onEdit(gig)} accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryText}>{t('Edit')}</Text>
            </Pressable>
            <Pressable onPress={() => onChangeStatus(gig)} accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryText}>{t('Change status')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.surfaceBorder, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  headerBadges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  close: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  body: { flexGrow: 0 },
  bodyContent: { padding: spacing.lg, gap: spacing.md },
  payBox: { padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primaryLight, gap: 2 },
  payLabel: { ...typography.caption, color: colors.primaryDark },
  payAmount: { ...typography.h2, color: colors.primaryDark },
  payType: { ...typography.bodySmall, color: colors.primaryDark },
  specs: { gap: spacing.sm },
  spec: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  specIcon: { width: 36, height: 36, borderRadius: borderRadius.sm + 2, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  specCopy: { flex: 1 },
  specLabel: { ...typography.caption, color: colors.textSecondary },
  specValue: { ...typography.body, color: colors.text },
  sectionTitle: { ...typography.label, color: colors.text, marginTop: spacing.xs },
  description: { ...typography.body, color: colors.textSecondary },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.md, paddingHorizontal: spacing.md },
  primary: { backgroundColor: colors.primary },
  primaryText: { ...typography.title, fontSize: 15, color: colors.primaryOnColor },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  secondaryText: { ...typography.title, fontSize: 15, color: colors.primary },
  pressed: { opacity: 0.8 },
});
