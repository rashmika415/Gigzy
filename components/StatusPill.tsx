import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius } from '../constants/theme';
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
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#147D54',
    border: 'rgba(16, 185, 129, 0.3)',
    icon: 'radio-button-on',
  },
  'in-progress': {
    label: 'In Progress',
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#986000',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: 'time-outline',
  },
  filled: { label: 'Filled', bg: 'rgba(245,158,11,0.12)', text: '#986000', border: 'rgba(245,158,11,0.3)', icon: 'people-outline' },
  closed: { label: 'Closed', bg: 'rgba(239,68,68,0.12)', text: '#B42318', border: 'rgba(239,68,68,0.3)', icon: 'lock-closed-outline' },
  completed: {
    label: 'Completed',
    bg: 'rgba(124, 58, 237, 0.15)',
    text: '#6D28D9',
    border: 'rgba(124, 58, 237, 0.35)',
    icon: 'checkmark-circle-outline',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'rgba(239, 68, 68, 0.12)',
    text: '#B42318',
    border: 'rgba(239, 68, 68, 0.3)',
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
      <TouchableOpacity
        style={pillStyle}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
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
  containerSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  labelSm: {
    fontSize: 10,
  },
});
