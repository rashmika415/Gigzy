import { Text, View, StyleSheet } from 'react-native';
import { colors, fonts, borderRadius, spacing } from '../constants/theme';

type Status = 'pending' | 'accepted' | 'rejected' | 'open' | 'closed';

const CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: colors.warningLight, text: colors.warning },
  accepted: { label: 'Accepted', bg: colors.successLight, text: colors.success },
  rejected: { label: 'Rejected', bg: colors.errorLight, text: colors.error },
  open: { label: 'Open', bg: colors.successLight, text: colors.success },
  closed: { label: 'Closed', bg: colors.surfaceBorder, text: colors.textMuted },
};

export default function StatusPill({ status }: { status: Status }) {
  const config = CONFIG[status];
  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
