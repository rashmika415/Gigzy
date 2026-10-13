import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius } from '../constants/theme';

/** Pulsing placeholder that keeps the page layout steady while data loads. */
function usePulse() {
  const [value] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(value, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [value]);
  return value;
}

interface BoneProps { width?: DimensionValue; height?: number; radius?: number; style?: ViewStyle }
function Bone({ width = '100%', height = 12, radius = borderRadius.sm, style }: BoneProps) {
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceBorderSubtle }, style]} />;
}

function GigCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Bone width={90} height={20} />
        <Bone width={70} height={20} radius={borderRadius.full} />
      </View>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Bone width="60%" height={20} />
        <Bone width={72} height={26} radius={borderRadius.md} />
      </View>
      <Bone width="95%" />
      <Bone width="75%" />
      <View style={styles.row}>
        <Bone width={60} height={22} radius={borderRadius.full} />
        <Bone width={72} height={22} radius={borderRadius.full} />
      </View>
      <View style={[styles.row, styles.divider]}>
        <Bone width={110} />
        <Bone width={80} />
      </View>
    </View>
  );
}

function RowSkeleton() {
  return (
    <View style={[styles.card, styles.listRow]}>
      <Bone width={48} height={48} radius={24} />
      <View style={styles.rowText}>
        <Bone width="45%" height={14} />
        <Bone width="85%" />
      </View>
    </View>
  );
}

interface SkeletonListProps {
  /** `gig` mirrors GigCard; `row` mirrors conversation and notification rows. */
  variant?: 'gig' | 'row';
  count?: number;
  style?: ViewStyle;
}

export default function SkeletonList({ variant = 'gig', count = 3, style }: SkeletonListProps) {
  const { t } = useTranslation();
  const opacity = usePulse();
  const Item = variant === 'gig' ? GigCardSkeleton : RowSkeleton;
  return (
    <Animated.View
      style={[styles.list, { opacity }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('Loading…')}
    >
      {Array.from({ length: count }, (_, i) => <Item key={i} />)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    gap: spacing.sm + 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceBorderSubtle },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.lg },
  rowText: { flex: 1, gap: spacing.sm },
});
