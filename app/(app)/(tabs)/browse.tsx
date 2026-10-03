import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../../constants/theme';
import { subscribeToRecentGigs, filterAndSortGigs } from '../../../services/gigService';
import {
  GigCard,
  SearchBar,
  EmptyState,
  LoadingState,
  ErrorState,
} from '../../../components';
import type { Gig, GigSortOption, LocationType } from '../../../types/gig';
import { GIG_CATEGORIES } from '../../../types/gig';

// ── Sort options config ──
const SORT_OPTIONS: { key: GigSortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'newest', label: 'Newest First', icon: 'time-outline' },
  { key: 'oldest', label: 'Oldest First', icon: 'hourglass-outline' },
  { key: 'pay-high', label: 'Highest Pay', icon: 'trending-up-outline' },
  { key: 'pay-low', label: 'Lowest Pay', icon: 'trending-down-outline' },
  { key: 'applicants', label: 'Most Applicants', icon: 'people-outline' },
];

// ── Location type options ──
const LOCATION_OPTIONS: { key: LocationType | 'all'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Any', icon: 'apps-outline' },
  { key: 'remote', label: 'Remote', icon: 'globe-outline' },
  { key: 'on-site', label: 'On-site', icon: 'location-outline' },
  { key: 'hybrid', label: 'Hybrid', icon: 'git-merge-outline' },
];

export default function BrowseScreen() {
  const { user } = useAuth();

  // ── Data state ──
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<LocationType | 'all'>('all');
  const [selectedSort, setSelectedSort] = useState<GigSortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // ── Real-time subscription ──
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError('');

    const unsubscribe = subscribeToRecentGigs(
      100,
      (recentGigs) => {
        setGigs(recentGigs);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  // ── Derived: apply all filters ──
  const filteredGigs = useMemo(() => {
    // 1. Only open gigs for the browse feed
    let result = gigs.filter((g) => g.status === 'open');

    // 2. Use the service-layer filter for category + search + sort
    result = filterAndSortGigs(result, {
      status: 'open',
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      searchQuery: searchQuery.trim() || undefined,
      sortBy: selectedSort,
    });

    // 3. Location type filter (not in the existing service utility)
    if (selectedLocation !== 'all') {
      result = result.filter((g) => g.locationType === selectedLocation);
    }

    return result;
  }, [gigs, searchQuery, selectedCategory, selectedLocation, selectedSort]);

  // ── Counts for active filters badge ──
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedLocation !== 'all') count++;
    if (selectedSort !== 'newest') count++;
    return count;
  }, [selectedCategory, selectedLocation, selectedSort]);

  const hasAnyFilter = searchQuery.trim().length > 0 || activeFilterCount > 0;

  // ── Handlers ──
  const handleRefresh = () => setRefreshing(true);

  const handleGigPress = useCallback((gig: Gig) => {
    router.push({
      pathname: '/(app)/gig/[id]',
      params: { id: gig.id },
    } as any);
  }, []);

  const handleClearFilters = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSelectedSort('newest');
  };

  const handleCategoryPress = (catId: string) => {
    try { Haptics.selectionAsync(); } catch {}
    setSelectedCategory((prev) => (prev === catId ? 'all' : catId));
  };

  const handleLocationPress = (loc: LocationType | 'all') => {
    try { Haptics.selectionAsync(); } catch {}
    setSelectedLocation((prev) => (prev === loc ? 'all' : loc));
  };

  const handleSortSelect = (sort: GigSortOption) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSelectedSort(sort);
    setSortModalVisible(false);
  };

  // ── Render helpers ──
  const renderGigItem = useCallback(
    ({ item }: { item: Gig }) => (
      <View style={styles.cardWrapper}>
        <GigCard gig={item} onPress={handleGigPress} />
      </View>
    ),
    [handleGigPress],
  );

  const currentSortLabel = SORT_OPTIONS.find((s) => s.key === selectedSort)?.label ?? 'Newest';

  return (
    <SafeAreaView style={styles.container}>
      {/* Background blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Browse Gigs</Text>
          <Text style={styles.subtitle}>
            {filteredGigs.length} open{' '}
            {filteredGigs.length === 1 ? 'opportunity' : 'opportunities'}
            {hasAnyFilter ? ' (filtered)' : ''}
          </Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {/* ── Search + Sort button row ── */}
      <View style={styles.searchRow}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search title, skill, location…"
          style={styles.searchBarFlex}
        />
        <TouchableOpacity
          style={[styles.sortBtn, selectedSort !== 'newest' && styles.sortBtnActive]}
          onPress={() => setSortModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="swap-vertical"
            size={18}
            color={selectedSort !== 'newest' ? '#080B14' : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Category Filter Pills ── */}
      <View style={styles.filterSectionWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {/* All chip */}
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipSelected]}
            onPress={() => handleCategoryPress('all')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="grid-outline"
              size={14}
              color={selectedCategory === 'all' ? '#080B14' : colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === 'all' && styles.categoryChipTextSelected,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {GIG_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                onPress={() => handleCategoryPress(cat.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isSelected ? '#080B14' : colors.textSecondary}
                />
                <Text
                  style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Location Type Filter ── */}
      <View style={styles.filterSectionWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.locationScroll}
        >
          {LOCATION_OPTIONS.map((loc) => {
            const isSelected = selectedLocation === loc.key;
            return (
              <TouchableOpacity
                key={loc.key}
                style={[styles.locationChip, isSelected && styles.locationChipSelected]}
                onPress={() => handleLocationPress(loc.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={loc.icon}
                  size={13}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[styles.locationChipText, isSelected && styles.locationChipTextSelected]}
                >
                  {loc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Active filter info bar ── */}
      {hasAnyFilter && (
        <View style={styles.filterInfoBar}>
          <Text style={styles.filterInfoText}>
            <Text style={styles.filterInfoHighlight}>{filteredGigs.length}</Text>
            {' '}result{filteredGigs.length !== 1 ? 's' : ''}
            {selectedSort !== 'newest' ? ` · ${currentSortLabel}` : ''}
          </Text>
          <TouchableOpacity onPress={handleClearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearFiltersText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Gig Feed ── */}
      {loading ? (
        <View style={styles.stateWrapper}>
          <LoadingState message="Discovering gigs…" size="large" />
        </View>
      ) : error ? (
        <View style={styles.stateWrapper}>
          <ErrorState
            title="Failed to load gigs"
            message={error}
            onRetry={() => {
              setError('');
              setLoading(true);
            }}
          />
        </View>
      ) : filteredGigs.length === 0 ? (
        <View style={styles.stateWrapper}>
          <EmptyState
            icon={hasAnyFilter ? 'search-outline' : 'briefcase-outline'}
            title={hasAnyFilter ? 'No matching gigs' : 'No gigs yet'}
            description={
              hasAnyFilter
                ? 'Try adjusting your search or filters to find more opportunities.'
                : 'New opportunities will appear here in real time.'
            }
            actionLabel={hasAnyFilter ? 'Clear All Filters' : undefined}
            actionIcon={hasAnyFilter ? 'close-circle-outline' : undefined}
            onAction={hasAnyFilter ? handleClearFilters : undefined}
          />
        </View>
      ) : (
        <FlatList
          data={filteredGigs}
          keyExtractor={(item) => item.id}
          renderItem={renderGigItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* ── Sort Modal ── */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Sort By</Text>

            {SORT_OPTIONS.map((opt) => {
              const isActive = selectedSort === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOption, isActive && styles.sortOptionActive]}
                  onPress={() => handleSortSelect(opt.key)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sortOptionLeft}>
                    <View
                      style={[
                        styles.sortIconCircle,
                        isActive && styles.sortIconCircleActive,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={isActive ? '#080B14' : colors.textMuted}
                      />
                    </View>
                    <Text
                      style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  blob1: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primaryGlow,
    opacity: 0.25,
  },
  blob2: {
    position: 'absolute',
    bottom: 100,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentLight,
    opacity: 0.35,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },

  // Search + Sort row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  searchBarFlex: {
    flex: 1,
  },
  sortBtn: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // Category pills
  filterSectionWrap: {
    marginBottom: 2,
  },
  categoryScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 5,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: '#080B14',
    fontWeight: '700',
  },

  // Location pills
  locationScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: 6,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 5,
    paddingHorizontal: 11,
    gap: 4,
  },
  locationChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  locationChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  locationChipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Active filter info bar
  filterInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  filterInfoText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterInfoHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
  clearFiltersText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },

  // List
  stateWrapper: {
    paddingHorizontal: spacing.lg,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },

  // Sort Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  sortOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortIconCircleActive: {
    backgroundColor: colors.primary,
  },
  sortOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
});
