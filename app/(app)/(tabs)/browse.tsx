import { Text } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView, Modal, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DiscoveryFilters from '../../../components/DiscoveryFilters';
import { useGigDiscovery } from '../../../hooks/useGigDiscovery';
import GigMap from '../../../components/maps/GigMap';
import SegmentedControl from '../../../components/SegmentedControl';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../../constants/theme';
import {
  GigCard,
  SearchBar,
  EmptyState,
  LoadingState,
  ErrorState,
} from '../../../components';
import type { Gig, GigSortOption, LocationType, GigFilterOptions } from '../../../types/gig';
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
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<LocationType | 'all'>('all');
  const [selectedSort, setSelectedSort] = useState<GigSortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<GigFilterOptions>({});
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const options = useMemo(() => ({ ...advancedFilters, status: 'open' as const,
    category: selectedCategory, locationType: selectedLocation, sortBy: selectedSort, searchQuery: keyword,
  }), [advancedFilters, selectedCategory, selectedLocation, selectedSort, keyword]);
  const { gigs: filteredGigs, loading, error, refreshing, loadingMore, hasMore, refresh, loadMore } =
    useGigDiscovery(options, !!user && userData?.role === 'freelancer' && !userData.suspended);
  const activeFilterCount = (selectedCategory !== 'all' ? 1 : 0) + (selectedLocation !== 'all' ? 1 : 0)
    + (selectedSort !== 'newest' ? 1 : 0) + Object.entries(advancedFilters).filter(([key, value]) =>
      key !== 'origin' && value !== undefined && value !== '' && value !== false && value !== 'all').length;
  const hasAnyFilter = !!searchQuery.trim() || activeFilterCount > 0;

  // ── Handlers ──
  const handleRefresh = refresh;

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
    setKeyword('');
    setAdvancedFilters({});
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
        <GigCard gig={item} onPress={handleGigPress} showBookmark />
      </View>
    ),
    [handleGigPress],
  );

  const currentSortLabel = SORT_OPTIONS.find((s) => s.key === selectedSort)?.label ?? 'Newest';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0, marginRight: spacing.sm }}>
          <Text style={styles.title}>{t("Browse Gigs")}</Text>
          <Text style={styles.subtitle}>
            {t("Open opportunities loaded: {{count}}", { count: filteredGigs.length })}
            {hasAnyFilter ? t(" (filtered)") : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.liveIndicator} onPress={() => setFilterModalVisible(true)} accessibilityLabel={t("Open gig filters")}>
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <Text style={styles.liveText}>{t("Filters")}{activeFilterCount ? t(" ({{value0}})", { value0: activeFilterCount }) : ''}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search + Sort button row ── */}
      <View style={styles.searchRow}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("Search title, skill, location…")}
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
            color={selectedSort !== 'newest' ? colors.primaryOnColor : colors.primary}
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
              color={selectedCategory === 'all' ? colors.primaryOnColor : colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === 'all' && styles.categoryChipTextSelected,
              ]}
            >{t("All")}</Text>
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
                  color={isSelected ? colors.primaryOnColor : colors.textSecondary}
                />
                <Text
                  style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}
                >
                  {t(cat.name)}
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
                  {t(loc.label)}
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
            {' '}{t("result")}{filteredGigs.length !== 1 ? t("s") : ''}
            {selectedSort !== 'newest' ? t(" · {{value0}}", { value0: t(currentSortLabel) }) : ''}
          </Text>
          <TouchableOpacity onPress={handleClearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearFiltersText}>{t("Clear All")}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <SegmentedControl options={[{ key: 'list', label: t("List") }, { key: 'map', label: t("Map") }]} selectedKey={viewMode} onSelect={key => { setViewMode(key); Keyboard.dismiss(); }} />
      </View>
      {viewMode === 'map' ? <GigMap gigs={filteredGigs} loading={loading} error={error} refreshing={refreshing} loadingMore={loadingMore} hasMore={hasMore}
        onRefresh={refresh} onLoadMore={loadMore} onGigPress={handleGigPress} onShowList={() => setViewMode('list')} /> : <FlatList
        data={filteredGigs}
        keyExtractor={item => item.id}
        renderItem={renderGigItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReached={() => { if (!error && filteredGigs.length > 0) loadMore(); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={loading ? <LoadingState message={t("Discovering gigs...")} size="large" /> : error ?
          <ErrorState title={t("Failed to load gigs")} message={t(error ?? "")} onRetry={refresh} /> :
          <EmptyState icon={hasAnyFilter ? 'search-outline' : 'briefcase-outline'}
            title={hasMore ? t("Still looking for matches") : hasAnyFilter ? t("No matching gigs") : t("No gigs yet")}
            description={hasMore ? t("Continue searching to check older gigs.") : hasAnyFilter ? t("Try adjusting your search or filters.") : t("Pull down to check for new opportunities.")}
            actionLabel={hasAnyFilter && !hasMore ? t("Clear All Filters") : undefined} onAction={handleClearFilters} />}
        ListFooterComponent={<View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
          {!!error && filteredGigs.length > 0 && <ErrorState message={t(error ?? "")} onRetry={hasMore ? loadMore : refresh} />}
          {loadingMore ? <LoadingState message={t("Finding more gigs...")} /> : !loading && !refreshing && !error && (
            hasMore ? <TouchableOpacity onPress={loadMore}><Text style={styles.clearFiltersText}>{filteredGigs.length ? t("Load more gigs") : t("Continue searching")}</Text></TouchableOpacity> :
              filteredGigs.length > 0 ? <Text style={styles.subtitle}>{t("You have reached the end.")}</Text> : null
          )}
        </View>}
      />
      }
      {filterModalVisible && <DiscoveryFilters visible value={advancedFilters} onApply={setAdvancedFilters} onClose={() => setFilterModalVisible(false)} />}

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
            <Text style={styles.modalTitle}>{t("Sort By")}</Text>

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
                        color={isActive ? colors.primaryOnColor : colors.textMuted}
                      />
                    </View>
                    <Text
                      style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}
                    >
                      {t(opt.label)}
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
    backgroundColor: '#147D54',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#147D54',
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
    color: colors.primaryOnColor,
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
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.overlay,
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
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.surfaceElevated,
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
