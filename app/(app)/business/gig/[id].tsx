import { useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import StatusPill from '../../../../components/StatusPill';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { CATEGORY_ICON } from '../../../../data/mockData';
import { useApplicants } from '../../../../context/ApplicantsContext';
import { useBusinessGigs } from '../../../../context/BusinessGigsContext';

export default function BusinessGigDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { gigs, setGigStatus } = useBusinessGigs();
  const gig = useMemo(() => gigs.find((g) => g.id === id), [gigs, id]);
  const { applicants } = useApplicants();
  const gigApplicants = useMemo(() => applicants.filter((a) => a.gigId === id), [applicants, id]);
  const status = gig?.status ?? 'open';

  if (!gig) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFoundText}>Gig not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{gig.title}</Text>
        <MaterialIcons name="more-vert" size={22} color={colors.text} />
      </View>

      <FlatList
        data={gigApplicants}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.iconBadge}>
                  <MaterialIcons name={CATEGORY_ICON[gig.category] as any} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryTitle}>{gig.title}</Text>
                  <Text style={styles.summarySchedule}>{gig.schedule}</Text>
                </View>
                <StatusPill status={status} />
              </View>
              <View style={styles.summaryBottomRow}>
                <Text style={styles.pay}>Rs {gig.pay.toLocaleString()}/{gig.payRate}</Text>
                <TouchableOpacity
                  style={styles.toggleButton}
                  activeOpacity={0.85}
                  onPress={() => setGigStatus(gig.id, status === 'open' ? 'closed' : 'open')}
                >
                  <Text style={styles.toggleButtonText}>{status === 'open' ? 'Close gig' : 'Reopen gig'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Applicants ({gigApplicants.length})</Text>
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="groups" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No one has applied yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.applicantCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/business/applicant/${item.id}`)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.applicantName}>{item.name}, {item.age}</Text>
              <Text style={styles.applicantRating}>{item.rating}★ ({item.reviewCount} reviews)</Text>
            </View>
            <StatusPill status={item.status} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  notFoundText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.text,
  },

  listContent: { padding: spacing.md, paddingBottom: spacing.xl },

  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  summarySchedule: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  summaryBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pay: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.primary,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  toggleButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.text,
  },

  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  applicantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
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
  applicantName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  applicantRating: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },

  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
});
