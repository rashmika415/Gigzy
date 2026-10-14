import { Text } from './LocalizedText';
import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../constants/theme';

type ChipVariant = 'default' | 'selected' | 'outline';
type ChipSize = 'sm' | 'md';

interface ChipProps {
  /** Text shown inside the chip */
  label: string;
  /** Visual variant */
  variant?: ChipVariant;
  /** Size preset */
  size?: ChipSize;
  /** Optional Ionicon name rendered to the left of the label */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional count badge rendered after the label (e.g. filter tabs) */
  count?: number;
  /** When provided, the chip becomes pressable */
  onPress?: () => void;
  /** Show an ✕ removal button */
  onRemove?: () => void;
  /** Additional styles */
  style?: ViewStyle;
}

export default function Chip({
  label,
  variant = 'default',
  size = 'md',
  icon,
  count,
  onPress,
  onRemove,
  style,
}: ChipProps) {
  const isSm = size === 'sm';
  const selected = variant === 'selected';

  const chipStyles = [
    styles.container,
    isSm && styles.containerSm,
    onPress && !isSm && styles.pressable,
    selected && styles.selected,
    variant === 'outline' && styles.outline,
    style,
  ];

  const foreground = selected ? colors.primaryOnColor : colors.textSecondary;

  const inner = (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={isSm ? 12 : 14}
          color={foreground}
          style={{ marginRight: spacing.xs }}
        />
      )}
      <Text
        style={[
          styles.label,
          isSm && styles.labelSm,
          { color: foreground },
          selected && styles.labelSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.count, selected && styles.countSelected]}>
          <Text style={[styles.countText, selected && styles.countTextSelected]}>{count}</Text>
        </View>
      )}
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.removeBtn}
        >
          <Ionicons
            name="close-circle"
            size={isSm ? 13 : 15}
            color={selected ? colors.primaryOnColor : colors.textMuted}
          />
        </Pressable>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [chipStyles, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={chipStyles}>{inner}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  containerSm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  // Tappable chips (filters) get a comfortable touch height.
  pressable: {
    minHeight: 36,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.75,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.surfaceBorder,
  },
  label: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  labelSm: {
    fontSize: 12,
    lineHeight: 16,
  },
  labelSelected: {
    fontFamily: typography.label.fontFamily,
  },
  count: {
    marginLeft: spacing.xs + 2,
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  countSelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  countText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  countTextSelected: {
    color: colors.primaryOnColor,
  },
  removeBtn: {
    marginLeft: spacing.xs,
  },
});
