import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './LocalizedText';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

export interface SheetOption<T extends string> {
  id: T;
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Accent for the icon and selected state; defaults to the primary colour */
  color?: string;
  tint?: string;
}

interface OptionSheetProps<T extends string> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SheetOption<T>[];
  selected?: T;
  /** Disables the options and shows a spinner, e.g. while saving */
  loading?: boolean;
  onSelect: (id: T) => void;
  onClose: () => void;
}

/** Bottom sheet with a single-choice list (sort order, status, …). */
export default function OptionSheet<T extends string>({
  visible, title, subtitle, options, selected, loading = false, onSelect, onClose,
}: OptionSheetProps<T>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const close = () => { if (!loading) onClose(); };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('Close')} />
      <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>{t(title)}</Text>
            {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
          </View>
          {loading ? <ActivityIndicator color={colors.primary} />
            : <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Close')}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>}
        </View>
        {options.map(option => {
          const isSelected = option.id === selected;
          const accent = option.color ?? colors.primary;
          return <Pressable key={option.id} disabled={loading} onPress={() => onSelect(option.id)}
            accessibilityRole="radio" accessibilityState={{ checked: isSelected, disabled: loading }}
            style={({ pressed }) => [styles.option, isSelected && { borderColor: accent, backgroundColor: option.tint ?? colors.primaryLight }, pressed && styles.pressed]}>
            {option.icon && <View style={[styles.optionIcon, { backgroundColor: option.tint ?? colors.primaryLight }]}>
              <Ionicons name={option.icon} size={18} color={accent} />
            </View>}
            <View style={styles.optionCopy}>
              <Text style={[styles.optionLabel, isSelected && { color: accent }]}>{t(option.label)}</Text>
              {!!option.description && <Text style={styles.optionDescription}>{t(option.description)}</Text>}
            </View>
            {isSelected && <Ionicons name="checkmark-circle" size={20} color={accent} />}
          </Pressable>;
        })}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.surfaceBorder, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  headerCopy: { flex: 1 },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },
  close: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, minHeight: 56, padding: spacing.sm + spacing.xs, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  optionIcon: { width: 36, height: 36, borderRadius: borderRadius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: { ...typography.title, fontSize: 15, color: colors.text },
  optionDescription: { ...typography.bodySmall, color: colors.textSecondary },
  pressed: { opacity: 0.75 },
});
