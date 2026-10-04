import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, borderRadius } from '../constants/theme';

interface SegmentOption {
  /** Unique key for the segment */
  key: string;
  /** Display label */
  label: string;
  /** Optional count badge */
  count?: number;
}

interface SegmentedControlProps {
  /** The list of segments to render */
  options: SegmentOption[];
  /** The currently selected segment key */
  selectedKey: string;
  /** Callback when a segment is selected */
  onSelect: (key: string) => void;
  /** When true, wraps in a horizontal ScrollView for many segments */
  scrollable?: boolean;
}

export default function SegmentedControl({
  options,
  selectedKey,
  onSelect,
  scrollable = false,
}: SegmentedControlProps) {
  const { t } = useTranslation();
  const segments = options.map((opt) => {
    const isSelected = opt.key === selectedKey;

    return (
      <TouchableOpacity
        key={opt.key}
        accessibilityRole="button"
        accessibilityLabel={t(opt.label)}
        accessibilityState={{ selected: isSelected }}
        aria-pressed={isSelected}
        style={[styles.tab, isSelected && styles.tabSelected]}
        onPress={() => onSelect(opt.key)}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
          {t(opt.label)}
        </Text>
        {opt.count !== undefined && (
          <View style={[styles.badge, isSelected && styles.badgeSelected]}>
            <Text
              style={[
                styles.badgeText,
                isSelected && styles.badgeTextSelected,
              ]}
            >
              {opt.count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {segments}
      </ScrollView>
    );
  }

  return <View style={styles.container}>{segments}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContainer: {
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 6,
  },
  tabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextSelected: {
    color: colors.primaryOnColor,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  badgeTextSelected: {
    color: colors.primaryOnColor,
  },
});
