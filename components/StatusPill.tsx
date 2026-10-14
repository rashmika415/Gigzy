import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, typography } from '../constants/theme';
import type { GigStatus } from '../types/gig';

/** Visual config for each status variant */
const STATUS_STYLES: Record<
  GigStatus,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  open: {
    label: 'Open & Active',
    bg: colors.successLight,
    text: colors.success,
    border: colors.successBorder,
    icon: 'radio-button-on',
  },
  'in-progress': {
    label: 'In Progress',
    bg: colors.warningLight,
    text: colors.warning,
    border: colors.warningBorder,
    icon: 'time-outline',
  },
  filled: { label: 'Filled', bg: colors.warningLight, text: colors.warning, border: colors.warningBorder, icon: 'people-outline' },
  closed: { label: 'Closed', bg: colors.errorLight, text: colors.error, border: colors.errorBorder, icon: 'lock-closed-outline' },
  completed: {
    label: 'Completed',
    bg: colors.infoLight,
    text: colors.info,
    border: colors.infoBorder,
    icon: 'checkmark-circle-outline',
  },
  cancelled: {
    label: 'Cancelled',
    bg: colors.errorLight,
    text: colors.error,
    border: colors.errorBorder,
    icon: 'close-circle-outline',
  },
};

export { STATUS_STYLES };

interface StatusPillProps {
  /** Current gig status */
  status: GigStatus;
  /** Render a smaller pill — useful inside cards */
  size?: 'sm' | 'md';
  /** Show the chevron-down indicator (when tappable) */
  showChevron?: boolean;
  /** When provided, the pill becomes a TouchableOpacity */
  onPress?: () => void;
}

export default function StatusPill({
  status,
  size = 'md',
  showChevron = false,
  onPress,
}: StatusPillProps) {
  const { t } = useTranslation();
  const cfg = STATUS_STYLES[status] ?? STATUS_STYLES.open;
  const isSm = size === 'sm';

  const content = (
    <>
      <Ionicons
        name={cfg.icon}
        size={isSm ? 10 : 12}
        color={cfg.text}
      />
      <Text
        style={[
          styles.label,
          { color: cfg.text },
          isSm && styles.labelSm,
        ]}
      >
        {t(cfg.label)}
      </Text>
      {showChevron && (
        <Ionicons
          name="chevron-down"
          size={isSm ? 8 : 10}
          color={cfg.text}
          style={{ marginLeft: 2 }}
        />
      )}
    </>
  );

  const pillStyle = [
    styles.container,
    {
      backgroundColor: cfg.bg,
      borderColor: cfg.border,
    },
    isSm && styles.containerSm,
  ];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [pillStyle, pressed && styles.pressed]}
        onPress={onPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('Change status: {{status}}', { status: t(cfg.label) })}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={pillStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    gap: 4,
  },
  pressed: {
    opacity: 0.75,
  },
  containerSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 3,
  },
  label: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 16,
  },
  labelSm: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
  },
});
