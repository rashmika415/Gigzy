import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import StatusPill from '../../../../components/StatusPill';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { MOCK_APPLICATIONS, MOCK_GIGS, ApplicationStatus } from '../../../../data/mockData';

const TABS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

export default function Applications() {
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all');

  const rows = useMemo(() => {
    return MOCK_APPLICATIONS
      .map((app) => ({ app, gig: MOCK_GIGS.find((g) => g.id === app.gigId) }))
      .filter((row) => row.gig && (activeTab === 'all' || row.app.status === activeTab));
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>My Applications</Text>

      <View style={styles.segmented}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.app.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="assignment" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No applications here yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/youth/gig/${item.gig!.id}`)}
          >
            <View style={styles.cardTopRow}>
              <Text style={styles.gigTitle} numberOfLines={1}>{item.gig!.title}</Text>
              <StatusPill status={item.app.status} />
            </View>
            <Text style={styles.employerText}>{item.gig!.employerName}</Text>
            <View style={styles.cardBottomRow}>
              <Text style={styles.pay}>
                Rs {item.gig!.pay.toLocaleString()}<Text style={styles.payRate}>/{item.gig!.payRate}</Text>
              </Text>
              <Text style={styles.appliedText}>
                {item.app.appliedDaysAgo === 0 ? 'Applied today' : `Applied ${item.app.appliedDaysAgo}d ago`}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
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
    gap: spacing.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gigTitle: {
    flex: 1,
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  employerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  pay: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.primary,
  },
  payRate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  appliedText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
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
