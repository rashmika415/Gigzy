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
  const [selectedGigForApplicants, setSelectedGigForApplicants] = useState<Gig | null>(null);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ userId: string; userName: string; userPhotoURL?: string; gigId?: string; gigTitle?: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'user' | 'gig' | 'no-show';
    targetId: string;
    targetUserId?: string;
    targetUserName?: string;
    targetGigId?: string;
    targetGigTitle?: string;
  } | null>(null);

  // Role guard: only business owners (clients) can manage gigs
  // Data states
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
  const [ratingTarget, setRatingTarget] = useState<{ userId: string; userName: string; gigId?: string; gigTitle?: string } | null>(null);

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
      if (newStatus === 'completed' && gig.assignedYouthId) {
        setRatingTarget({ userId: gig.assignedYouthId, userName: t('Youth Freelancer'), gigId: gig.id, gigTitle: gig.title });
      await updateGigStatus(currentGig.id, newStatus);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setStatusModalVisible(false);
      setSelectedGigForStatus(null);
      if (newStatus === "completed" && currentGig.assignedYouthId) {
        setRatingTarget({
          userId: currentGig.assignedYouthId,
          userName: currentGig.assignedYouthName || t("Youth Freelancer"),
          userPhotoURL: currentGig.assignedYouthPhotoURL,
          gigId: currentGig.id,
          gigTitle: currentGig.title,
        });
        setRatingModalVisible(true);
      }
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
  const handleReportGig = (gig: Gig) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    if (gig.assignedYouthId) {
      setReportTarget({
        targetType: 'user',
        targetId: gig.assignedYouthId,
        targetUserId: gig.assignedYouthId,
        targetUserName: gig.assignedYouthName || tr("Assigned Freelancer"),
        targetGigId: gig.id,
        targetGigTitle: gig.title,
      });
    } else {
      setReportTarget({
        targetType: 'gig',
        targetId: gig.id,
        targetGigId: gig.id,
        targetGigTitle: gig.title,
      });
    }
  };

  // Delete gig handler
  const handleDeleteGig = (gig: Gig) => {
    Alert.alert(
      tr("Delete Gig Listing"),
      tr("Are you sure you want to permanently delete \"{{value0}}\"? This cannot be undone.", { value0: gig.title }),
      [
        { text: tr("Cancel"), style: "cancel" },
        {
          text: tr("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGig(gig.id, user?.uid);
              try {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              } catch {}
            } catch (err: any) {
              toast.error(tr("Failed to delete gig."), err.message);
            }
          },
        },
      ],
    );
  };

  // Edit gig handler
  const handleEditGig = (gig: Gig) => {
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
    onRate={target => setRatingTarget({ userId: target.assignedYouthId!, userName: target.assignedYouthName || t('Youth Freelancer'), gigId: target.id, gigTitle: target.title })} />;

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

          {loading && user ? (
            <SkeletonList variant="gig" count={3} />
          ) : loadError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={32} color={colors.error} />
              <Text style={styles.errorTitle}>{tr("Failed to Load Gigs")}</Text>
              <Text style={styles.errorSubtitle}>{tr(loadError)}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={handleRefresh}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>{tr("Retry Connection")}</Text>
              </TouchableOpacity>
            </View>
          ) : filteredGigs.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <Ionicons
                  name={
                    allGigs.length === 0
                      ? "briefcase-outline"
                      : "filter-outline"
                  }
                  size={36}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {allGigs.length === 0
                  ? tr("No Gigs Posted Yet")
                  : tr("No Matching Gigs Found")}
              </Text>
              <Text style={styles.emptyDesc}>
                {allGigs.length === 0
                  ? tr("Start by posting your first gig. Reach skilled local youth and top freelancers in minutes.")
                  : tr("Try adjusting your search keywords, status tabs, or category filters.")}
              </Text>

              {allGigs.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => router.push("/(app)/post-gig" as any)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={20} color={colors.primaryOnColor} />
                  <Text style={styles.emptyActionBtnText}>{tr("Post Your First Gig")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedStatus("all");
                    setSelectedCategory("all");
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.clearFilterBtnText}>{tr("Clear All Filters")}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.gigsContainer}>
              {filteredGigs.map((gig) => {
                const statusCfg =
                  STATUS_CONFIG[gig.status] || STATUS_CONFIG.open;

                return (
                  <TouchableOpacity
                    key={gig.id}
                    style={styles.gigCard}
                    onPress={() => handleOpenDetails(gig)}
                    activeOpacity={0.9}
                  >
                    {/* Top Row: Category & Status Badge */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardCategoryBadge}>
                        <Text style={styles.cardCategoryText}>
                          {gig.category}
                        </Text>
                      </View>

                      <TouchableOpacity
                        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                        style={[
                          styles.cardStatusBadge,
                          {
                            backgroundColor: statusCfg.bg,
                            borderColor: statusCfg.border,
                          },
                        ]}
                        onPress={() => handleOpenStatusModal(gig)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={statusCfg.icon}
                          size={12}
                          color={statusCfg.text}
                        />
                        <Text
                          style={[
                            styles.cardStatusText,
                            { color: statusCfg.text },
                          ]}
                        >
                          {tr(statusCfg.label)}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={10}
                          color={statusCfg.text}
                          style={{ marginLeft: 2 }}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Gig Title & Pay */}
                    <View style={styles.titlePayRow}>
                      <Text style={styles.gigCardTitle} numberOfLines={2}>
                        {gig.title}
                      </Text>
                      <View style={styles.payPill}>
                        <Text style={styles.payAmount}>{formatCurrency(gig.pay)}</Text>
                        <Text style={styles.payType}>
                          {gig.payType === "hourly" ? tr("/hr") : tr(" fixed")}
                        </Text>
                      </View>
                    </View>

                    {Boolean(gig.assignedYouthId || gig.status === "in-progress") && (
                      <View style={styles.assignedHireBanner}>
                        <View style={styles.assignedHireBannerLeft}>
                          <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                          <Text style={styles.assignedHireBannerText}>
                            {gig.assignedYouthName
                              ? `${tr("Assigned Freelancer")}: ${gig.assignedYouthName}`
                              : tr("Accepted Freelancer Assigned")}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.assignedReportLink}
                          onPress={() => handleReportGig(gig)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={tr("Report Freelancer")}
                        >
                          <Ionicons name="flag-outline" size={12} color={colors.error} />
                          <Text style={styles.assignedReportLinkText}>{tr("Report")}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Gig Description preview */}
                    <Text style={styles.gigCardDesc} numberOfLines={2}>
                      {gig.description}
                    </Text>

                    {/* Skills Chips */}
                    {gig.skills && gig.skills.length > 0 && (
                      <View style={styles.cardSkillsRow}>
                        {gig.skills.slice(0, 3).map((skill, idx) => (
                          <View
                            key={`${gig.id}-skill-${idx}`}
                            style={styles.skillTag}
                          >
                            <Text style={styles.skillTagText}>{skill}</Text>
                          </View>
                        ))}
                        {gig.skills.length > 3 && (
                          <View style={styles.skillMoreTag}>
                            <Text style={styles.skillMoreText}>
                              +{gig.skills.length - 3}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Meta info row */}
                    <View style={styles.cardMetaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons
                          name={
                            gig.locationType === "remote"
                              ? "globe-outline"
                              : "location-outline"
                          }
                          size={13}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.metaItemText} numberOfLines={1}>
                          {gig.location || tr("Remote")}
                        </Text>
                      </View>

                      <View style={styles.metaItem}>
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.metaItemText}>
                          {gig.date || tr("Flexible")}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.applicantsChip,
                          gig.applicantsCount > 0 &&
                            styles.applicantsChipActive,
                        ]}
                        onPress={() => {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch {}
                          setSelectedGigForApplicants(gig);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel={`${gig.applicantsCount || 0} ${gig.applicantsCount === 1 ? tr("Applicant") : tr("Applicants")}`}
                      >
                        <Ionicons
                          name="people"
                          size={12}
                          color={
                            gig.applicantsCount > 0
                              ? colors.success
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.applicantsChipText,
                            gig.applicantsCount > 0 &&
                              styles.applicantsChipTextActive,
                          ]}
                        >
                          {gig.applicantsCount || 0}{" "}
                          {gig.applicantsCount === 1
                            ? tr("Applicant")
                            : tr("Applicants")}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <ViewApplicantsButton key={`applicants-${gig.id}`} gig={gig} />
                    <CloseGigButton gig={gig} />

                    {/* Card Actions Footer */}
                    <View style={styles.cardActionsFooter}>
                      <TouchableOpacity
                        style={styles.actionUpdateBtn}
                        onPress={() => handleEditGig(gig)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name="create-outline"
                          size={14}
                          color={colors.primaryOnColor}
                        />
                        <Text style={styles.actionUpdateBtnText}>{tr("Update")}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionApplicantsBtn}
                        onPress={() => {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch {}
                          setSelectedGigForApplicants(gig);
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name="people-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.actionApplicantsBtnText}>
                          {tr("Applicants")} ({gig.applicantsCount || 0})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionStatusBtn}
                        onPress={() => handleOpenStatusModal(gig)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name="sync-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.actionStatusBtnText}>{tr("Status")}</Text>
                      </TouchableOpacity>

                      {(gig.status === "completed" || gig.status === "in-progress" || Boolean(gig.assignedYouthId)) && gig.assignedYouthId ? (
                        <TouchableOpacity
                          style={styles.actionRateBtn}
                          onPress={() => {
                            setRatingTarget({
                              userId: gig.assignedYouthId!,
                              userName: gig.assignedYouthName || tr("Youth Freelancer"),
                              userPhotoURL: gig.assignedYouthPhotoURL,
                              gigId: gig.id,
                              gigTitle: gig.title,
                            });
                            setRatingModalVisible(true);
                          }}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="star" size={13} color={colors.star} />
                          <Text style={styles.actionRateBtnText}>{tr("Rate Freelancer")}</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={styles.actionDetailsBtn}
                        onPress={() => handleOpenDetails(gig)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name="eye-outline"
                          size={14}
                          color={colors.text}
                        />
                        <Text style={styles.actionDetailsBtnText}>{tr("Details")}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionReportBtn}
                        onPress={() => handleReportGig(gig)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={tr("Report")}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="flag-outline"
                          size={15}
                          color={colors.error}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionDeleteBtn}
                        onPress={() => handleDeleteGig(gig)}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
        onEdit={editGig} onChangeStatus={openStatus} onApplicants={openApplicants} />

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
              <TouchableOpacity
                style={styles.detailChangeStatusBtn}
                onPress={() => {
                  setDetailModalVisible(false);
                  if (selectedGigDetail)
                    handleOpenStatusModal(selectedGigDetail);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="sync-outline" size={16} color={colors.primary} />
                <Text style={styles.detailChangeStatusBtnText}>{tr("Update Status")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailReportBtn}
                onPress={() => {
                  setDetailModalVisible(false);
                  if (selectedGigDetail) handleReportGig(selectedGigDetail);
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={tr("Report")}
              >
                <Ionicons name="flag-outline" size={16} color={colors.error} />
                <Text style={styles.detailReportBtnText}>{tr("Report")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Applicant List Modal */}
      {selectedGigForApplicants && (
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
          onSuccess={() => { setRatingTarget(null); toast.success(tr('Review submitted successfully!')); }}
        />
      )}

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          visible={Boolean(reportTarget)}
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          targetUserId={reportTarget.targetUserId}
          targetUserName={reportTarget.targetUserName}
          targetGigId={reportTarget.targetGigId}
          targetGigTitle={reportTarget.targetGigTitle}
          onClose={() => setReportTarget(null)}
          onSuccess={() => {
            setReportTarget(null);
            toast.success(tr("Report submitted"), tr("Our moderation team will review this report shortly."));
          }}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerMessagesBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 4,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: colors.success,
  },
  postNewBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    gap: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 44,
    justifyContent: 'center',
  },
  postNewBtnText: {
    color: colors.primaryOnColor,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },

  // Metrics
  metricsSection: {
    paddingVertical: spacing.md,
  },
  metricsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 110,
    alignItems: "center",
    gap: 4,
  },
  metricCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: fonts.bodySemiBold,
  },

  // Toolbar
  toolbarSection: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    padding: 0,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    gap: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  sortButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },

  // Status Tabs
  statusTabsWrapper: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  statusTabsContainer: {
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  statusTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  statusTabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusTabText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
  },
  statusTabTextSelected: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyBold,
  },
  tabBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.textSecondary,
  },
  tabBadgeTextSelected: {
    color: colors.primaryOnColor,
  },

  // Category Pills
  categoriesWrapper: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 5,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryChipSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
  },
  categoryChipTextSelected: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyBold,
  },

  // List Section
  listSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  listCountText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
  },
  listCountHighlight: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
  },
  resetFiltersText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },

  // Loading & Error
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: colors.primaryOnColor,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },

  // Empty State
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyActionBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: 8,
    marginTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyActionBtnText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
  clearFilterBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  clearFilterBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },

  // Gig Cards
  gigsContainer: {
    gap: spacing.md,
  },
  gigCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardCategoryBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardCategoryText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    gap: 4,
  },
  cardStatusText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
  },

  // Title and Pay
  titlePayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  gigCardTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  payPill: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "baseline",
  },
  payAmount: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  payType: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  gigCardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Skills
  cardSkillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillTag: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  skillTagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  skillMoreTag: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  skillMoreText: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },

  // Meta
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaItemText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  applicantsChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  applicantsChipActive: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  applicantsChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
  },
  applicantsChipTextActive: {
    color: colors.success,
    fontFamily: fonts.bodyBold,
  },

  // Actions Footer
  cardActionsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    gap: 6,
  },
  actionUpdateBtn: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    gap: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 44,
  },
  actionUpdateBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primaryOnColor,
  },
  actionStatusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    gap: 4,
    minHeight: 44,
  },
  actionStatusBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  actionDetailsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    gap: 4,
    minHeight: 44,
  },
  actionDetailsBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  actionApplicantsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    gap: 4,
    minHeight: 44,
  },
  actionApplicantsBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  assignedHireBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginBottom: spacing.xs,
  },
  assignedHireBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  assignedHireBannerText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.success,
  },
  assignedReportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  assignedReportLinkText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: colors.error,
  },
  actionRateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    gap: 4,
  },
  actionRateBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.warning,
  },
  actionReportBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  actionDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modals Overlay & Containers
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    maxWidth: 240,
  },
  modalCloseBtn: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingBox: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  modalLoadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Status Modal
  statusModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    ...shadows.card,
  },
  statusOptionsList: {
    gap: spacing.sm,
  },
  statusOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  statusOptionLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  statusOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  statusOptionLabel: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    marginBottom: 2,
  },
  statusOptionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },

  // Sort Modal
  sortModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    ...shadows.card,
  },
  sortOptionsList: {
    gap: 6,
  },
  sortOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  sortOptionItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  sortOptionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sortOptionItemLabel: {
    fontSize: 14,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
  },
  sortOptionItemLabelSelected: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },

  // Details Modal
  detailModalCard: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: "hidden",
    ...shadows.card,
  },
  detailModalHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  detailHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  detailTitle: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.text,
    letterSpacing: -0.3,
  },
  detailScrollBody: {
    padding: spacing.lg,
  },
  detailHighlightBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailBoxLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailPayAmount: {
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.primary,
  },
  detailPayType: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
  },
  detailSpecsGrid: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailSpecItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  specLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  specVal: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  detailSectionHeading: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  detailDescriptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  detailSkillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.xl,
  },
  detailSkillChip: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  detailSkillChipText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  detailModalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
    flexDirection: "row",
    gap: spacing.sm,
  },
  detailEditBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  detailEditBtnText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
  detailChangeStatusBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  detailChangeStatusBtnText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
  detailReportBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  detailReportBtnText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
});
