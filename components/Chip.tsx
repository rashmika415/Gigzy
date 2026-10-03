import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius } from '../constants/theme';

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
  onPress,
  onRemove,
  style,
}: ChipProps) {
  const isSm = size === 'sm';

  const chipStyles = [
    styles.container,
    isSm && styles.containerSm,
    variant === 'selected' && styles.selected,
    variant === 'outline' && styles.outline,
    style,
  ];

  const labelColor =
    variant === 'selected' ? colors.primaryOnColor : colors.textSecondary;
  const iconColor =
    variant === 'selected' ? colors.primaryOnColor : colors.textSecondary;

  const inner = (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={isSm ? 12 : 14}
          color={iconColor}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.label,
          isSm && styles.labelSm,
          { color: labelColor },
          variant === 'selected' && styles.labelSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={styles.removeBtn}
        >
          <Ionicons
            name="close-circle"
            size={isSm ? 13 : 15}
            color={variant === 'selected' ? colors.primaryOnColor : colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={chipStyles} onPress={onPress} activeOpacity={0.8}>
        {inner}
      </TouchableOpacity>
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
    paddingHorizontal: 12,
  },
  containerSm: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
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
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  labelSm: {
    fontSize: 11,
  },
  labelSelected: {
    fontWeight: '700',
  },
  removeBtn: {
    marginLeft: 4,
  },
});
