import { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import StatusPill from '../../../../components/StatusPill';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { CATEGORY_ICON } from '../../../../data/mockData';
import { useBusinessGigs } from '../../../../context/BusinessGigsContext';

const SEGMENTS: { key: 'all' | 'open' | 'closed'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
];

export default function MyGigs() {
  const [segment, setSegment] = useState<'all' | 'open' | 'closed'>('all');
  const { gigs: allGigs } = useBusinessGigs();
  const gigs = allGigs.filter((g) => segment === 'all' || g.status === segment);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Gigs</Text>
        <TouchableOpacity
          style={styles.postButton}
          activeOpacity={0.85}
          onPress={() => router.push('/business/post-gig')}
        >
          <MaterialIcons name="add" size={18} color={colors.primaryOnColor} />
          <Text style={styles.postButtonText}>Post a gig</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.segmented}>
        {SEGMENTS.map((seg) => {
          const active = segment === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setSegment(seg.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{seg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={gigs}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="work-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No gigs here yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/business/gig/${item.id}`)}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.iconBadge}>
                <MaterialIcons name={CATEGORY_ICON[item.category] as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardSchedule}>{item.schedule}</Text>
              </View>
              <StatusPill status={item.status} />
            </View>
            <View style={styles.cardBottomRow}>
              <Text style={styles.pay}>
                Rs {item.pay.toLocaleString()}<Text style={styles.payRate}>/{item.payRate}</Text>
              </Text>
              <View style={styles.applicantsChip}>
                <MaterialIcons name="groups" size={14} color={colors.primary} />
                <Text style={styles.applicantsText}>{item.applicantCount} applicants</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  postButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.primaryOnColor,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  segmentTextActive: { color: colors.primaryOnColor },

  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  cardSchedule: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  applicantsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  applicantsText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },

  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
});
