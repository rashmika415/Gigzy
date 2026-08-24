import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import { CATEGORY_LABEL, Category } from '../data/mockData';

export interface Filters {
  categories: Category[];
  maxDistanceKm: number;
  minPay: number | null;
  maxPay: number | null;
  availability: string[];
}

export const DEFAULT_FILTERS: Filters = {
  categories: [],
  maxDistanceKm: 20,
  minPay: null,
  maxPay: null,
  availability: [],
};

const ALL_CATEGORIES: Category[] = ['cafe', 'retail', 'events', 'tutoring', 'delivery', 'ngo'];
const DISTANCE_STEPS = [2, 5, 10, 20];
const AVAILABILITY_OPTIONS = ['Weekdays', 'Weekends', 'Evenings', 'Any'];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface FiltersSheetProps {
  visible: boolean;
  initialFilters: Filters;
  resultCount: number;
  onClose: () => void;
  onApply: (filters: Filters) => void;
}

export default function FiltersSheet({ visible, initialFilters, resultCount, onClose, onApply }: FiltersSheetProps) {
  const [draft, setDraft] = useState<Filters>(initialFilters);

  useEffect(() => {
    if (visible) setDraft(initialFilters);
  }, [visible, initialFilters]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={() => setDraft(DEFAULT_FILTERS)}>
            <Text style={styles.resetText}>RESET</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <View style={styles.chipWrap}>
          {ALL_CATEGORIES.map((cat) => {
            const active = draft.categories.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDraft((d) => ({ ...d, categories: toggle(d.categories, cat) }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{CATEGORY_LABEL[cat]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>DISTANCE FROM ME</Text>
        <View style={styles.chipWrap}>
          {DISTANCE_STEPS.map((km) => {
            const active = draft.maxDistanceKm === km;
            return (
              <TouchableOpacity
                key={km}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDraft((d) => ({ ...d, maxDistanceKm: km }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {km === 20 ? 'Any distance' : `Within ${km}km`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>PAY RANGE (LKR)</Text>
        <View style={styles.payRow}>
          <TextInput
            style={styles.payInput}
            value={draft.minPay != null ? String(draft.minPay) : ''}
            onChangeText={(t) => setDraft((d) => ({ ...d, minPay: t ? Number(t.replace(/[^0-9]/g, '')) : null }))}
            placeholder="Min"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
          />
          <Text style={styles.payDash}>–</Text>
          <TextInput
            style={styles.payInput}
            value={draft.maxPay != null ? String(draft.maxPay) : ''}
            onChangeText={(t) => setDraft((d) => ({ ...d, maxPay: t ? Number(t.replace(/[^0-9]/g, '')) : null }))}
            placeholder="Any"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
          />
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>AVAILABILITY</Text>
        <View style={styles.chipWrap}>
          {AVAILABILITY_OPTIONS.map((opt) => {
            const active = draft.availability.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDraft((d) => ({ ...d, availability: toggle(d.availability, opt) }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.clearButton} onPress={() => setDraft(DEFAULT_FILTERS)} activeOpacity={0.8}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={() => onApply(draft)} activeOpacity={0.9}>
            <Text style={styles.applyText}>Show {resultCount} gigs</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceBorder,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  resetText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.primary,
  },
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: {
    backgroundColor: colors.chipActiveBg,
    borderColor: colors.chipActiveBg,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.chipActiveText },

  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  payInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  payDash: { color: colors.textMuted },

  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  clearButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  applyButton: {
    flex: 2,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.primaryOnColor,
  },
});
