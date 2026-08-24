import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import StatusPill from '../../../../components/StatusPill';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { ApplicationStatus } from '../../../../data/mockData';
import { useApplicants } from '../../../../context/ApplicantsContext';

const TABS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

export default function ApplicantsList() {
  const { applicants } = useApplicants();
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all');

  const rows = useMemo(
    () => applicants.filter((a) => activeTab === 'all' || a.status === activeTab),
    [applicants, activeTab]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Applicants</Text>

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
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="groups" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No applicants here yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/business/applicant/${item.id}`)}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.name}>{item.name}, {item.age}</Text>
                <Text style={styles.gigTitle} numberOfLines={1}>Applied for {item.gigTitle}</Text>
              </View>
              <StatusPill status={item.status} />
            </View>
            <View style={styles.cardBottomRow}>
              <Text style={styles.rating}>{item.rating}★ ({item.reviewCount})</Text>
              <Text style={styles.appliedText}>
                {item.appliedDaysAgo === 0 ? 'Applied today' : `Applied ${item.appliedDaysAgo}d ago`}
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
    gap: spacing.sm,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.primary,
  },
  cardTitleWrap: { flex: 1 },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  gigTitle: {
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
  rating: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
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
