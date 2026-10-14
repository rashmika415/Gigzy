import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../../localization/i18n';
import { formatCurrency } from '../../../localization/format';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../../components/LocalizedText';
import { borderRadius, colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Chip, EmptyState, ErrorState, GigCard, SearchBar, SkeletonList, STATUS_STYLES } from '../../../components';
import ConfirmSheet from '../../../components/ConfirmSheet';
import OptionSheet, { type SheetOption } from '../../../components/OptionSheet';
import GigDetailSheet from '../../../components/business/GigDetailSheet';
import BusinessGigActions from '../../../components/business/BusinessGigActions';
import { ApplicantListModal } from '../../../components/applications';
import { RatingModal } from '../../../components/reviews';
import { ReportModal } from '../../../components/reports';
import {
  calculateBusinessGigStats,
  deleteGig,
  filterAndSortGigs,
  getGigsByClient,
  subscribeToClientGigs,
  updateGigStatus,
} from '../../../services/gigService';
import { Gig, GIG_CATEGORIES, GigSortOption, GigStatus } from '../../../types/gig';

const haptic = (kind: 'light' | 'select' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  const run = kind === 'select' ? Haptics.selectionAsync()
    : kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  void run.catch(() => {});
};

const SORT_OPTIONS: SheetOption<GigSortOption>[] = [
  { id: 'newest', label: 'Newest first', icon: 'calendar-outline' },
  { id: 'oldest', label: 'Oldest first', icon: 'time-outline' },
  { id: 'pay-high', label: 'Highest pay', icon: 'trending-up-outline' },
  { id: 'pay-low', label: 'Lowest pay', icon: 'trending-down-outline' },
  { id: 'applicants', label: 'Most applicants', icon: 'people-outline' },
];

const STATUS_DESCRIPTIONS: Partial<Record<GigStatus, string>> = {
  open: 'Accepting applications and visible to freelancers',
  'in-progress': 'Work is under way with a hired freelancer',
  completed: 'The work is finished and delivered',
  cancelled: 'Closed and no longer accepting applications',
};

const STATUS_OPTIONS: SheetOption<GigStatus>[] = (['open', 'in-progress', 'completed', 'cancelled'] as GigStatus[]).map(id => ({
  id,
  label: STATUS_STYLES[id].label,
  description: STATUS_DESCRIPTIONS[id],
  icon: STATUS_STYLES[id].icon,
  color: STATUS_STYLES[id].text,
  tint: STATUS_STYLES[id].bg,
}));

export default function MyGigs() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const toast = useToast();
  const role = userData?.role;

  // Data
  const [allGigs, setAllGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<GigStatus | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<GigSortOption>('newest');
  const [showSort, setShowSort] = useState(false);

  // Sheets
  const [detailGig, setDetailGig] = useState<Gig | null>(null);
  const [statusGig, setStatusGig] = useState<Gig | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Gig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [applicantsGig, setApplicantsGig] = useState<Gig | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ userId: string; userName: string; userPhotoURL?: string; gigId?: string; gigTitle?: string } | null>(null);
  const [reportGig, setReportGig] = useState<Gig | null>(null);

  useEffect(() => {
    if (!user || role !== 'client') return;
    return subscribeToClientGigs(
      user.uid,
      clientGigs => { setAllGigs(clientGigs); setLoadError(''); setLoading(false); },
      err => { setLoadError(err.message || 'Failed to load your gigs.'); setLoading(false); },
    );
  }, [user, role]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      setAllGigs(await getGigsByClient(user.uid));
      setLoadError('');
    } catch (err: any) {
      setLoadError(err.message || 'Failed to refresh gigs.');
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => calculateBusinessGigStats(allGigs), [allGigs]);
  const filteredGigs = useMemo(() => filterAndSortGigs(allGigs, {
    status: selectedStatus, category: selectedCategory, searchQuery, sortBy,
  }), [allGigs, selectedStatus, selectedCategory, searchQuery, sortBy]);
  const filtersActive = searchQuery.length > 0 || selectedStatus !== 'all' || selectedCategory !== 'all';

  const clearFilters = () => { setSearchQuery(''); setSelectedStatus('all'); setSelectedCategory('all'); };

  const handleUpdateStatus = async (newStatus: GigStatus) => {
    if (!statusGig || statusUpdating) return;
    const gig = statusGig;
    if (gig.status === newStatus) { setStatusGig(null); return; }
    setStatusUpdating(true);
    try {
      await updateGigStatus(gig.id, newStatus);
      haptic('success');
      setStatusGig(null);
      toast.success(tr('Status updated'));
      if (newStatus === 'completed' && gig.assignedYouthId) rateFreelancer(gig);
    } catch (error: any) {
      toast.error(tr('Status Update Failed'), error.message || tr('Could not update gig status.'));
    } finally {
      setStatusUpdating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteGig(deleteTarget.id, user?.uid);
      haptic('success');
      setDeleteTarget(null);
      toast.success(tr('Gig deleted'));
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete gig.');
    } finally {
      setDeleting(false);
    }
  };

  const editGig = (gig: Gig) => {
    haptic();
    setDetailGig(null);
    router.push({ pathname: '/(app)/post-gig', params: { editGigId: gig.id } } as any);
  };

  const rateFreelancer = (gig: Gig) => setRatingTarget({
    userId: gig.assignedYouthId!,
    userName: gig.assignedYouthName || t('Youth Freelancer'),
    userPhotoURL: gig.assignedYouthPhotoURL,
    gigId: gig.id,
    gigTitle: gig.title,
  });
  const openReport = (gig: Gig) => { haptic(); setDetailGig(null); setReportGig(gig); };

  const openApplicants = (gig: Gig) => { haptic(); setDetailGig(null); setApplicantsGig(gig); };
  const openStatus = (gig: Gig) => { setDetailGig(null); setStatusGig(gig); };

  if (userData && role !== 'client') {
    return <SafeAreaView style={[styles.container, styles.centered]}>
      <EmptyState icon="lock-closed-outline" title="Access Restricted"
        description={tr('This page is for business owners to manage their posted gigs.')}
        actionLabel="Go back" onAction={() => router.back()} secondary />
    </SafeAreaView>;
  }

  const statusTabs: { id: GigStatus | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'open', label: 'Open', count: stats.open },
    { id: 'in-progress', label: 'In Progress', count: stats.inProgress },
    { id: 'completed', label: 'Completed', count: stats.completed },
    { id: 'cancelled', label: 'Cancelled', count: stats.cancelled },
  ];

  const renderActions = (gig: Gig) => <BusinessGigActions gig={gig} onApplicants={openApplicants} onEdit={editGig}
    onDelete={target => { setDeleteError(''); setDeleteTarget(target); }}
    onRate={rateFreelancer} onReport={openReport} />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.headerTitle}>{t('My Gigs')}</Text>
          <Text style={styles.headerSubtitle}>{t('{{count}} posted', { count: allGigs.length })}</Text>
        </View>
        <Pressable onPress={() => { haptic(); router.push('/(app)/post-gig' as any); }} accessibilityRole="button"
          style={({ pressed }) => [styles.postButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={20} color={colors.primaryOnColor} />
          <Text style={styles.postButtonText}>{t('Post Gig')}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Summary */}
        <View style={styles.summary}>
          <Pressable onPress={() => router.push('/(app)/applications' as any)} accessibilityRole="button"
            style={({ pressed }) => [styles.summaryTile, pressed && styles.pressed]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.accentLight }]}><Ionicons name="people-outline" size={18} color={colors.accent} /></View>
            <Text style={styles.summaryValue}>{stats.totalApplicants}</Text>
            <View style={styles.summaryLabelRow}>
              <Text style={styles.summaryLabel}>{t('Applicants')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </Pressable>
          <View style={styles.summaryTile}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.successLight }]}><Ionicons name="wallet-outline" size={18} color={colors.success} /></View>
            <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.totalBudget)}</Text>
            <Text style={styles.summaryLabel}>{t('Total Budget')}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/(app)/add-ratings' as any)} accessibilityRole="button"
          style={({ pressed }) => [styles.rateRow, pressed && styles.pressed]}>
          <Ionicons name="star-outline" size={18} color={colors.star} />
          <Text style={styles.rateText}>{t('Rate freelancers you have worked with')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        {/* Search & sort */}
        <View style={styles.toolbar}>
          <View style={styles.flex}>
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder={tr('Search by title, skill, location...')} />
          </View>
          <Pressable onPress={() => setShowSort(true)} accessibilityRole="button" accessibilityLabel={t('Sort')}
            style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}>
            <Ionicons name="swap-vertical" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroll}>
          {statusTabs.map(tab => <Chip key={tab.id} label={t(tab.label)} count={tab.count}
            variant={selectedStatus === tab.id ? 'selected' : 'default'}
            onPress={() => { haptic('select'); setSelectedStatus(tab.id); }} />)}
        </ScrollView>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroll}>
          <Chip label={t('All Categories')} variant={selectedCategory === 'all' ? 'selected' : 'default'} onPress={() => setSelectedCategory('all')} />
          {GIG_CATEGORIES.map(cat => {
            const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
            return <Chip key={cat.id} label={t(cat.name)} icon={cat.icon as any} variant={isSelected ? 'selected' : 'default'}
              onPress={() => setSelectedCategory(isSelected ? 'all' : cat.name)} />;
          })}
        </ScrollView>

        <View style={styles.listHeader}>
          <Text style={styles.listCount}>{t('Showing {{visible}} of {{total}} gigs', { visible: filteredGigs.length, total: allGigs.length })}</Text>
          {filtersActive && <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button">
            <Text style={styles.resetText}>{t('Reset Filters')}</Text>
          </Pressable>}
        </View>

        {loading && user ? (
          <SkeletonList variant="gig" count={3} />
        ) : loadError ? (
          <ErrorState title="Failed to Load Gigs" message={loadError} retryLabel="Retry" onRetry={handleRefresh} />
        ) : filteredGigs.length === 0 ? (
          allGigs.length === 0
            ? <EmptyState icon="briefcase-outline" title="No Gigs Posted Yet"
              description={tr('Start by posting your first gig. Reach skilled local youth and top freelancers in minutes.')}
              actionLabel="Post Your First Gig" actionIcon="add-circle" onAction={() => router.push('/(app)/post-gig' as any)} />
            : <EmptyState icon="filter-outline" title="No Matching Gigs Found"
              description={tr('Try adjusting your search keywords, status tabs, or category filters.')}
              actionLabel="Clear All Filters" onAction={clearFilters} secondary />
        ) : (
          <View style={styles.list}>
            {filteredGigs.map(gig => <GigCard key={gig.id} gig={gig} showAssigned
              onPress={setDetailGig} onStatusPress={setStatusGig} onApplicantsPress={openApplicants}
              renderActions={renderActions} />)}
          </View>
        )}
      </ScrollView>

      <GigDetailSheet gig={detailGig} onClose={() => setDetailGig(null)}
        onEdit={editGig} onChangeStatus={openStatus} onApplicants={openApplicants} onReport={openReport} />

      <OptionSheet visible={!!statusGig} title="Update Gig Status" subtitle={statusGig?.title}
        options={STATUS_OPTIONS} selected={statusGig?.status} loading={statusUpdating}
        onSelect={handleUpdateStatus} onClose={() => setStatusGig(null)} />

      <OptionSheet visible={showSort} title="Sort gigs" options={SORT_OPTIONS} selected={sortBy}
        onSelect={id => { setSortBy(id); setShowSort(false); }} onClose={() => setShowSort(false)} />

      <ConfirmSheet visible={!!deleteTarget} destructive icon="trash-outline"
        title="Delete Gig Listing" confirmLabel="Delete" loading={deleting} error={deleteError}
        message={deleteTarget ? tr('Are you sure you want to permanently delete "{{value0}}"? This cannot be undone.', { value0: deleteTarget.title }) : undefined}
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {applicantsGig && (
        <ApplicantListModal
          visible
          gigId={applicantsGig.id}
          gigTitle={applicantsGig.title}
          businessId={user?.uid || ''}
          gigDate={applicantsGig.date}
          gigTime={applicantsGig.time}
          gigLocation={applicantsGig.location}
          gigPay={applicantsGig.pay}
          gigPayType={applicantsGig.payType}
          onClose={() => setApplicantsGig(null)}
        />
      )}

      {ratingTarget && (
        <RatingModal
          visible
          targetUserId={ratingTarget.userId}
          targetUserName={ratingTarget.userName}
          targetUserPhotoURL={ratingTarget.userPhotoURL}
          targetRole="freelancer"
          gigId={ratingTarget.gigId}
          gigTitle={ratingTarget.gigTitle}
          onClose={() => setRatingTarget(null)}
          onSuccess={() => setRatingTarget(null)}
        />
      )}

      {reportGig && (
        <ReportModal
          visible
          targetType={reportGig.assignedYouthId ? 'user' : 'gig'}
          targetId={reportGig.assignedYouthId || reportGig.id}
          targetUserId={reportGig.assignedYouthId}
          targetUserName={reportGig.assignedYouthId ? (reportGig.assignedYouthName || tr('Assigned Freelancer')) : undefined}
          targetGigId={reportGig.id}
          targetGigTitle={reportGig.title}
          onClose={() => setReportGig(null)}
          onSuccess={() => setReportGig(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', padding: spacing.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  headerCopy: { flex: 1 },
  headerTitle: { ...typography.h1, color: colors.text },
  headerSubtitle: { ...typography.bodySmall, color: colors.textSecondary },
  postButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary },
  postButtonText: { ...typography.title, fontSize: 15, color: colors.primaryOnColor },

  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  summary: { flexDirection: 'row', gap: spacing.sm + spacing.xs },
  summaryTile: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, gap: spacing.xs },
  summaryIcon: { width: 36, height: 36, borderRadius: borderRadius.sm + 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  summaryValue: { ...typography.h2, color: colors.text },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  summaryLabel: { ...typography.bodySmall, color: colors.textSecondary },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  rateText: { ...typography.body, flex: 1, color: colors.text },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sortButton: { width: 48, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },

  chipScroll: { marginHorizontal: -spacing.md, flexGrow: 0 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.md },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  listCount: { ...typography.bodySmall, color: colors.textSecondary },
  resetText: { ...typography.label, color: colors.primary },
  list: { gap: spacing.md },
});
