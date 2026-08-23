import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';
import {
  subscribeToClientGigs,
  getGigsByClient,
  updateGigStatus,
  deleteGig,
  calculateBusinessGigStats,
  filterAndSortGigs,
} from '../../services/gigService';
import {
  Gig,
  GigStatus,
  GIG_CATEGORIES,
  GigSortOption,
  BusinessGigStats,
} from '../../types/gig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_CONFIG: Record<
  GigStatus,
  { label: string; bg: string; text: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  open: {
    label: 'Open & Active',
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#10B981',
    border: 'rgba(16, 185, 129, 0.3)',
    icon: 'radio-button-on',
  },
  'in-progress': {
    label: 'In Progress',
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#F59E0B',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: 'time-outline',
  },
  completed: {
    label: 'Completed',
    bg: 'rgba(124, 58, 237, 0.15)',
    text: '#A78BFA',
    border: 'rgba(124, 58, 237, 0.35)',
    icon: 'checkmark-circle-outline',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'rgba(239, 68, 68, 0.12)',
    text: '#EF4444',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: 'close-circle-outline',
  },
};

export default function MyGigs() {
  const { user, userData } = useAuth();

  // Data states
  const [allGigs, setAllGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<GigStatus | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<GigSortOption>('newest');
  const [showSortModal, setShowSortModal] = useState(false);

  // Status Change Modal state
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedGigForStatus, setSelectedGigForStatus] = useState<Gig | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Detail Modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedGigDetail, setSelectedGigDetail] = useState<Gig | null>(null);

  // 1. Subscribe to Firestore real-time client gigs
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    const unsubscribe = subscribeToClientGigs(
      user.uid,
      (clientGigs) => {
        setAllGigs(clientGigs);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message || 'Failed to load your gigs.');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Manual pull-to-refresh handler
  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const freshGigs = await getGigsByClient(user.uid);
      setAllGigs(freshGigs);
      setLoadError('');
    } catch (err: any) {
      setLoadError(err.message || 'Failed to refresh gigs.');
    } finally {
      setRefreshing(false);
    }
  };

  // 2. Computed Business Stats
  const stats: BusinessGigStats = useMemo(() => {
    return calculateBusinessGigStats(allGigs);
  }, [allGigs]);

  // 3. Filtered & Sorted Gigs
  const filteredGigs = useMemo(() => {
    return filterAndSortGigs(allGigs, {
      status: selectedStatus,
      category: selectedCategory,
      searchQuery: searchQuery,
      sortBy: sortBy,
    });
  }, [allGigs, selectedStatus, selectedCategory, searchQuery, sortBy]);

  // Status change handler
  const handleOpenStatusModal = (gig: Gig) => {
    setSelectedGigForStatus(gig);
    setStatusModalVisible(true);
  };

  const handleUpdateStatus = async (newStatus: GigStatus) => {
    if (!selectedGigForStatus) return;
    setStatusUpdating(true);
    try {
      await updateGigStatus(selectedGigForStatus.id, newStatus);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setStatusModalVisible(false);
      setSelectedGigForStatus(null);
    } catch (error: any) {
      Alert.alert('Status Update Failed', error.message || 'Could not update gig status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Delete gig handler
  const handleDeleteGig = (gig: Gig) => {
    Alert.alert(
      'Delete Gig Listing',
      `Are you sure you want to permanently delete "${gig.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGig(gig.id, user?.uid);
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete gig.');
            }
          },
        },
      ]
    );
  };

  // View gig details
  const handleOpenDetails = (gig: Gig) => {
    setSelectedGigDetail(gig);
    setDetailModalVisible(true);
  };

  const getSortLabel = (sort: GigSortOption) => {
    switch (sort) {
      case 'newest':
        return 'Newest First';
      case 'oldest':
        return 'Oldest First';
      case 'pay-high':
        return 'Highest Pay';
      case 'pay-low':
        return 'Lowest Pay';
      case 'applicants':
        return 'Most Applicants';
      default:
        return 'Sort';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background ambient lighting */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      {/* Top Navigation Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>My Posted Gigs</Text>
              <View style={styles.liveBadge}>
                <View style={styles.livePulse} />
                <Text style={styles.liveBadgeText}>Live</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Manage {allGigs.length} job {allGigs.length === 1 ? 'listing' : 'listings'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.postNewBtn}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
            router.push('/(app)/post-gig' as any);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#080B14" />
          <Text style={styles.postNewBtnText}>Post Gig</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Business Metrics Carousel / Grid */}
        <View style={styles.metricsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsContainer}
          >
            {/* Open / Active */}
            <TouchableOpacity
              style={[
                styles.metricCard,
                selectedStatus === 'open' && styles.metricCardSelected,
              ]}
              onPress={() => setSelectedStatus(selectedStatus === 'open' ? 'all' : 'open')}
              activeOpacity={0.8}
            >
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="radio-button-on" size={18} color="#10B981" />
              </View>
              <Text style={styles.metricValue}>{stats.open}</Text>
              <Text style={styles.metricLabel}>Open & Active</Text>
            </TouchableOpacity>

            {/* In Progress */}
            <TouchableOpacity
              style={[
                styles.metricCard,
                selectedStatus === 'in-progress' && styles.metricCardSelected,
              ]}
              onPress={() => setSelectedStatus(selectedStatus === 'in-progress' ? 'all' : 'in-progress')}
              activeOpacity={0.8}
            >
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="time-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.metricValue}>{stats.inProgress}</Text>
              <Text style={styles.metricLabel}>In Progress</Text>
            </TouchableOpacity>

            {/* Total Applicants */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="people-outline" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.metricValue}>{stats.totalApplicants}</Text>
              <Text style={styles.metricLabel}>Applicants</Text>
            </View>

            {/* Completed */}
            <TouchableOpacity
              style={[
                styles.metricCard,
                selectedStatus === 'completed' && styles.metricCardSelected,
              ]}
              onPress={() => setSelectedStatus(selectedStatus === 'completed' ? 'all' : 'completed')}
              activeOpacity={0.8}
            >
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#A78BFA" />
              </View>
              <Text style={styles.metricValue}>{stats.completed}</Text>
              <Text style={styles.metricLabel}>Completed</Text>
            </TouchableOpacity>

            {/* Total Budget */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                <Ionicons name="wallet-outline" size={18} color="#EC4899" />
              </View>
              <Text style={styles.metricValue}>${stats.totalBudget.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Total Budget</Text>
            </View>
          </ScrollView>
        </View>

        {/* Search and Sort Toolbar */}
        <View style={styles.toolbarSection}>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title, skill, location..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.primary} />
            <Text style={styles.sortButtonText} numberOfLines={1}>
              {getSortLabel(sortBy)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Segmented Tabs */}
        <View style={styles.statusTabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusTabsContainer}
          >
            {[
              { id: 'all', label: 'All Gigs', count: stats.total },
              { id: 'open', label: 'Open', count: stats.open },
              { id: 'in-progress', label: 'In Progress', count: stats.inProgress },
              { id: 'completed', label: 'Completed', count: stats.completed },
              { id: 'cancelled', label: 'Cancelled', count: stats.cancelled },
            ].map((tab) => {
              const isSelected = selectedStatus === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.statusTab, isSelected && styles.statusTabSelected]}
                  onPress={() => {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                    setSelectedStatus(tab.id as any);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.statusTabText, isSelected && styles.statusTabTextSelected]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.tabBadge, isSelected && styles.tabBadgeSelected]}>
                    <Text style={[styles.tabBadgeText, isSelected && styles.tabBadgeTextSelected]}>
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Category Pills Filter */}
        <View style={styles.categoriesWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === 'all' && styles.categoryChipSelected,
              ]}
              onPress={() => setSelectedCategory('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === 'all' && styles.categoryChipTextSelected,
                ]}
              >
                All Categories
              </Text>
            </TouchableOpacity>

            {GIG_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                  onPress={() => setSelectedCategory(isSelected ? 'all' : cat.name)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={14}
                    color={isSelected ? '#080B14' : colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Gigs List / Empty / Error Views */}
        <View style={styles.listSection}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listCountText}>
              Showing <Text style={styles.listCountHighlight}>{filteredGigs.length}</Text> of {allGigs.length} {allGigs.length === 1 ? 'gig' : 'gigs'}
            </Text>
            {(searchQuery.length > 0 || selectedStatus !== 'all' || selectedCategory !== 'all') && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSelectedStatus('all');
                  setSelectedCategory('all');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.resetFiltersText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Syncing your posted gigs from Firestore...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={32} color={colors.error} />
              <Text style={styles.errorTitle}>Failed to Load Gigs</Text>
              <Text style={styles.errorSubtitle}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh} activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>Retry Connection</Text>
              </TouchableOpacity>
            </View>
          ) : filteredGigs.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <Ionicons
                  name={allGigs.length === 0 ? 'briefcase-outline' : 'filter-outline'}
                  size={36}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {allGigs.length === 0 ? 'No Gigs Posted Yet' : 'No Matching Gigs Found'}
              </Text>
              <Text style={styles.emptyDesc}>
                {allGigs.length === 0
                  ? 'Start by posting your first gig. Reach skilled local youth and top freelancers in minutes.'
                  : 'Try adjusting your search keywords, status tabs, or category filters.'}
              </Text>

              {allGigs.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/(app)/post-gig' as any)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={20} color="#080B14" />
                  <Text style={styles.emptyActionBtnText}>Post Your First Gig</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedStatus('all');
                    setSelectedCategory('all');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.clearFilterBtnText}>Clear All Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.gigsContainer}>
              {filteredGigs.map((gig) => {
                const statusCfg = STATUS_CONFIG[gig.status] || STATUS_CONFIG.open;

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
                        <Text style={styles.cardCategoryText}>{gig.category}</Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.cardStatusBadge,
                          { backgroundColor: statusCfg.bg, borderColor: statusCfg.border },
                        ]}
                        onPress={() => handleOpenStatusModal(gig)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={statusCfg.icon} size={12} color={statusCfg.text} />
                        <Text style={[styles.cardStatusText, { color: statusCfg.text }]}>
                          {statusCfg.label}
                        </Text>
                        <Ionicons name="chevron-down" size={10} color={statusCfg.text} style={{ marginLeft: 2 }} />
                      </TouchableOpacity>
                    </View>

                    {/* Gig Title & Pay */}
                    <View style={styles.titlePayRow}>
                      <Text style={styles.gigCardTitle} numberOfLines={2}>
                        {gig.title}
                      </Text>
                      <View style={styles.payPill}>
                        <Text style={styles.payAmount}>${gig.pay}</Text>
                        <Text style={styles.payType}>
                          {gig.payType === 'hourly' ? '/hr' : ' fixed'}
                        </Text>
                      </View>
                    </View>

                    {/* Gig Description preview */}
                    <Text style={styles.gigCardDesc} numberOfLines={2}>
                      {gig.description}
                    </Text>

                    {/* Skills Chips */}
                    {gig.skills && gig.skills.length > 0 && (
                      <View style={styles.cardSkillsRow}>
                        {gig.skills.slice(0, 3).map((skill, idx) => (
                          <View key={`${gig.id}-skill-${idx}`} style={styles.skillTag}>
                            <Text style={styles.skillTagText}>{skill}</Text>
                          </View>
                        ))}
                        {gig.skills.length > 3 && (
                          <View style={styles.skillMoreTag}>
                            <Text style={styles.skillMoreText}>+{gig.skills.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Meta info row */}
                    <View style={styles.cardMetaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons
                          name={gig.locationType === 'remote' ? 'globe-outline' : 'location-outline'}
                          size={13}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.metaItemText} numberOfLines={1}>
                          {gig.location || 'Remote'}
                        </Text>
                      </View>

                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                        <Text style={styles.metaItemText}>{gig.date || 'Flexible'}</Text>
                      </View>

                      <View style={[styles.applicantsChip, gig.applicantsCount > 0 && styles.applicantsChipActive]}>
                        <Ionicons
                          name="people"
                          size={12}
                          color={gig.applicantsCount > 0 ? '#10B981' : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.applicantsChipText,
                            gig.applicantsCount > 0 && styles.applicantsChipTextActive,
                          ]}
                        >
                          {gig.applicantsCount || 0} {gig.applicantsCount === 1 ? 'Applicant' : 'Applicants'}
                        </Text>
                      </View>
                    </View>

                    {/* Card Actions Footer */}
                    <View style={styles.cardActionsFooter}>
                      <TouchableOpacity
                        style={styles.actionStatusBtn}
                        onPress={() => handleOpenStatusModal(gig)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="sync-outline" size={14} color={colors.primary} />
                        <Text style={styles.actionStatusBtnText}>Change Status</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionDetailsBtn}
                        onPress={() => handleOpenDetails(gig)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="eye-outline" size={14} color={colors.text} />
                        <Text style={styles.actionDetailsBtnText}>Details</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionDeleteBtn}
                        onPress={() => handleDeleteGig(gig)}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Status Change Modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statusModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Update Gig Status</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedGigForStatus?.title}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setStatusModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {statusUpdating ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.modalLoadingText}>Updating status in Firestore...</Text>
              </View>
            ) : (
              <View style={styles.statusOptionsList}>
                {(['open', 'in-progress', 'completed', 'cancelled'] as GigStatus[]).map(
                  (statusKey) => {
                    const cfg = STATUS_CONFIG[statusKey];
                    const isCurrent = selectedGigForStatus?.status === statusKey;

                    return (
                      <TouchableOpacity
                        key={statusKey}
                        style={[
                          styles.statusOptionRow,
                          isCurrent && {
                            backgroundColor: cfg.bg,
                            borderColor: cfg.border,
                          },
                        ]}
                        onPress={() => handleUpdateStatus(statusKey)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.statusOptionLeft}>
                          <View
                            style={[
                              styles.statusOptionDot,
                              { backgroundColor: cfg.text },
                            ]}
                          />
                          <View>
                            <Text style={[styles.statusOptionLabel, { color: isCurrent ? cfg.text : colors.text }]}>
                              {cfg.label}
                            </Text>
                            <Text style={styles.statusOptionDesc}>
                              {statusKey === 'open' && 'Accepting proposals & visible to applicants'}
                              {statusKey === 'in-progress' && 'Work is actively ongoing with a freelancer'}
                              {statusKey === 'completed' && 'Project completed and delivered'}
                              {statusKey === 'cancelled' && 'Listing closed and no longer accepting applications'}
                            </Text>
                          </View>
                        </View>

                        {isCurrent && (
                          <Ionicons name="checkmark-circle" size={20} color={cfg.text} />
                        )}
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Sort Option Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sortModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Posted Gigs</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sortOptionsList}>
              {[
                { id: 'newest', label: 'Newest First (Default)', icon: 'calendar-outline' },
                { id: 'oldest', label: 'Oldest First', icon: 'time-outline' },
                { id: 'pay-high', label: 'Highest Budget / Pay', icon: 'trending-up-outline' },
                { id: 'pay-low', label: 'Lowest Budget / Pay', icon: 'trending-down-outline' },
                { id: 'applicants', label: 'Most Applicants', icon: 'people-outline' },
              ].map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.sortOptionItem, isSelected && styles.sortOptionItemSelected]}
                    onPress={() => {
                      setSortBy(opt.id as GigSortOption);
                      setShowSortModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sortOptionItemLeft}>
                      <Ionicons
                        name={opt.icon as any}
                        size={18}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.sortOptionItemLabel, isSelected && styles.sortOptionItemLabelSelected]}>
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Gig Details Sheet Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalCard}>
            <View style={styles.detailModalHeader}>
              <View style={styles.detailHeaderTop}>
                <View style={styles.cardCategoryBadge}>
                  <Text style={styles.cardCategoryText}>{selectedGigDetail?.category}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.detailTitle}>{selectedGigDetail?.title}</Text>
            </View>

            <ScrollView style={styles.detailScrollBody} showsVerticalScrollIndicator={false}>
              {/* Pay & Status Bar */}
              <View style={styles.detailHighlightBox}>
                <View>
                  <Text style={styles.detailBoxLabel}>BUDGET / COMPENSATION</Text>
                  <Text style={styles.detailPayAmount}>
                    ${selectedGigDetail?.pay}
                    <Text style={styles.detailPayType}>
                      {selectedGigDetail?.payType === 'hourly' ? ' / hour' : ' Fixed Price'}
                    </Text>
                  </Text>
                </View>

                {selectedGigDetail && (
                  <View
                    style={[
                      styles.cardStatusBadge,
                      {
                        backgroundColor: STATUS_CONFIG[selectedGigDetail.status]?.bg,
                        borderColor: STATUS_CONFIG[selectedGigDetail.status]?.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={STATUS_CONFIG[selectedGigDetail.status]?.icon}
                      size={13}
                      color={STATUS_CONFIG[selectedGigDetail.status]?.text}
                    />
                    <Text
                      style={[
                        styles.cardStatusText,
                        { color: STATUS_CONFIG[selectedGigDetail.status]?.text },
                      ]}
                    >
                      {STATUS_CONFIG[selectedGigDetail.status]?.label}
                    </Text>
                  </View>
                )}
              </View>

              {/* Specs Grid */}
              <View style={styles.detailSpecsGrid}>
                <View style={styles.detailSpecItem}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <View>
                    <Text style={styles.specLabel}>Date / Deadline</Text>
                    <Text style={styles.specVal}>{selectedGigDetail?.date || 'Flexible'}</Text>
                  </View>
                </View>

                <View style={styles.detailSpecItem}>
                  <Ionicons
                    name={selectedGigDetail?.locationType === 'remote' ? 'globe-outline' : 'location-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <View>
                    <Text style={styles.specLabel}>Location ({selectedGigDetail?.locationType})</Text>
                    <Text style={styles.specVal} numberOfLines={1}>
                      {selectedGigDetail?.location || 'Remote'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSpecItem}>
                  <Ionicons name="people-outline" size={16} color={colors.primary} />
                  <View>
                    <Text style={styles.specLabel}>Total Applicants</Text>
                    <Text style={styles.specVal}>{selectedGigDetail?.applicantsCount || 0} applicants</Text>
                  </View>
                </View>

                <View style={styles.detailSpecItem}>
                  <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                  <View>
                    <Text style={styles.specLabel}>Gig ID</Text>
                    <Text style={styles.specVal} numberOfLines={1}>
                      {selectedGigDetail?.id}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.detailSectionHeading}>Job Description</Text>
              <Text style={styles.detailDescriptionText}>{selectedGigDetail?.description}</Text>

              {/* Required Skills */}
              {selectedGigDetail?.skills && selectedGigDetail.skills.length > 0 && (
                <>
                  <Text style={styles.detailSectionHeading}>Required Skills</Text>
                  <View style={styles.detailSkillsWrap}>
                    {selectedGigDetail.skills.map((skill, i) => (
                      <View key={i} style={styles.detailSkillChip}>
                        <Text style={styles.detailSkillChipText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.detailModalFooter}>
              <TouchableOpacity
                style={styles.detailChangeStatusBtn}
                onPress={() => {
                  setDetailModalVisible(false);
                  if (selectedGigDetail) handleOpenStatusModal(selectedGigDetail);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="sync" size={16} color="#080B14" />
                <Text style={styles.detailChangeStatusBtnText}>Update Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  blobTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primaryGlow,
    opacity: 0.25,
  },
  blobBottom: {
    position: 'absolute',
    bottom: 40,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.accentLight,
    opacity: 0.3,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: 'rgba(8, 11, 20, 0.85)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 4,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  postNewBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    gap: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  postNewBtnText: {
    color: '#080B14',
    fontSize: 13,
    fontWeight: '800',
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
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Toolbar
  toolbarSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    padding: 0,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    gap: 6,
  },
  sortButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 6,
  },
  statusTabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusTabTextSelected: {
    color: '#080B14',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeSelected: {
    backgroundColor: '#080B14',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabBadgeTextSelected: {
    color: colors.primary,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  categoryChipSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#080B14',
    fontWeight: '700',
  },

  // List Section
  listSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  listCountText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  listCountHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
  resetFiltersText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },

  // Loading & Error
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginTop: 4,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Empty State
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyActionBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#080B14',
    fontSize: 14,
    fontWeight: '800',
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
    fontWeight: '700',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCategoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardCategoryText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    gap: 4,
  },
  cardStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Title and Pay
  titlePayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  gigCardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  payPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  payAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  payType: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  gigCardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Skills
  cardSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  skillTagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  skillMoreTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  skillMoreText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },

  // Meta
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  applicantsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  applicantsChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  applicantsChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  applicantsChipTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },

  // Actions Footer
  cardActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    gap: 8,
  },
  actionStatusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    gap: 4,
  },
  actionStatusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  actionDetailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    gap: 4,
  },
  actionDetailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  actionDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals Overlay & Containers
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
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
  },
  modalLoadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalLoadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Status Modal
  statusModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F1423',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    fontWeight: '700',
    marginBottom: 2,
  },
  statusOptionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },

  // Sort Modal
  sortModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F1423',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortOptionItemLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  sortOptionItemLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Details Modal
  detailModalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#0F1423',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    ...shadows.card,
  },
  detailModalHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  detailScrollBody: {
    padding: spacing.lg,
  },
  detailHighlightBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailPayAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  detailPayType: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailSpecsGrid: {
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailSpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  specLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  specVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  detailSectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.xl,
  },
  detailSkillChip: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  detailSkillChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  detailModalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  detailChangeStatusBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  detailChangeStatusBtnText: {
    color: '#080B14',
    fontSize: 15,
    fontWeight: '800',
  },
});
