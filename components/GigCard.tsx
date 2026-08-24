import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import { CATEGORY_ICON, Category } from '../data/mockData';

interface GigCardProps {
  title: string;
  category: Category;
  subtitle: string;
  schedule: string;
  distance?: string;
  pay: number;
  payRate: 'day' | 'hour';
  onPress: () => void;
  rightSlot?: React.ReactNode;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export default function GigCard({
  title,
  category,
  subtitle,
  schedule,
  distance,
  pay,
  payRate,
  onPress,
  rightSlot,
  bookmarked,
  onToggleBookmark,
}: GigCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.topRow}>
        <View style={styles.iconBadge}>
          <MaterialIcons name={CATEGORY_ICON[category] as any} size={20} color={colors.primary} />
        </View>
        <View style={styles.topRowText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        {onToggleBookmark ? (
          <TouchableOpacity onPress={onToggleBookmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons
              name={bookmarked ? 'bookmark' : 'bookmark-border'}
              size={20}
              color={bookmarked ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialIcons name="schedule" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{schedule}</Text>
        </View>
        {distance ? (
          <View style={styles.metaItem}>
            <MaterialIcons name="location-on" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{distance}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.pay}>
          Rs {pay.toLocaleString()}<Text style={styles.payRate}>/{payRate}</Text>
        </Text>
        {rightSlot}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRowText: { flex: 1 },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pay: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.primary,
  },
  payRate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
});
