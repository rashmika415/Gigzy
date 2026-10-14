import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../LocalizedText';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Local YYYY-MM-DD for a calendar day (no UTC shift). */
export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(value?: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : null;
}

interface DatePickerSheetProps {
  visible: boolean;
  value?: string;
  /** Days before this date cannot be picked. Defaults to today. */
  minDate?: Date;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
}

/** Month calendar in a bottom sheet. Only real dates exist, so there is no "31 February". */
export default function DatePickerSheet({ visible, value, minDate, onSelect, onClose }: DatePickerSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = minDate ?? today;
  const selected = parseIsoDate(value);
  const [month, setMonth] = useState(() => {
    const start = selected ?? today;
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = month.getDay();
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const canGoBack = month > new Date(min.getFullYear(), min.getMonth(), 1);
  const shift = (delta: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('Close')} />
      <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={() => shift(-1)} disabled={!canGoBack} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Previous month')}
            style={({ pressed }) => [styles.nav, !canGoBack && styles.disabled, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.monthTitle}>{t(MONTHS[month.getMonth()])} {month.getFullYear()}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Next month')}
            style={({ pressed }) => [styles.nav, pressed && styles.pressed]}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.row}>
          {WEEKDAYS.map(day => <Text key={day} style={styles.weekday}>{t(day)}</Text>)}
        </View>
        <View style={styles.grid}>
          {cells.map((date, index) => {
            if (!date) return <View key={`blank-${index}`} style={styles.cell} />;
            const disabled = date < min;
            const isSelected = !!selected && date.getTime() === selected.getTime();
            const isToday = date.getTime() === today.getTime();
            return <Pressable key={date.getDate()} disabled={disabled} onPress={() => onSelect(toIsoDate(date))}
              accessibilityRole="button" accessibilityState={{ selected: isSelected, disabled }}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
              <View style={[styles.day, isToday && styles.today, isSelected && styles.selected]}>
                <Text style={[styles.dayText, disabled && styles.dayDisabled, isSelected && styles.selectedText]}>{date.getDate()}</Text>
              </View>
            </Pressable>;
          })}
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.surfaceBorder, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  nav: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  monthTitle: { ...typography.h3, color: colors.text },
  row: { flexDirection: 'row' },
  weekday: { ...typography.caption, flex: 1, textAlign: 'center', color: colors.textSecondary, paddingVertical: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, maxHeight: 52, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.primaryBorder },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { ...typography.body, color: colors.text },
  dayDisabled: { color: colors.surfaceBorder },
  selectedText: { color: colors.primaryOnColor, fontFamily: typography.title.fontFamily },
});
