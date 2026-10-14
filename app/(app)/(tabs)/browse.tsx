import { Text } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, ScrollView, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DiscoveryFilters from '../../../components/DiscoveryFilters';
import { useGigDiscovery } from '../../../hooks/useGigDiscovery';
import GigMap from '../../../components/maps/GigMap';
import SegmentedControl from '../../../components/SegmentedControl';
import OptionSheet, { type SheetOption } from '../../../components/OptionSheet';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, borderRadius, typography } from '../../../constants/theme';
import { Chip, GigCard, SearchBar, EmptyState, SkeletonList, ErrorState } from '../../../components';
import ApplyModal from '../../../components/applications/ApplyModal';
import { subscribeToMyApplications } from '../../../services/applicationService';
import { useToast } from '../../../context/ToastContext';
import type { Gig, GigSortOption, LocationType, GigFilterOptions } from '../../../types/gig';
import { GIG_CATEGORIES } from '../../../types/gig';

const SORT_OPTIONS: SheetOption<GigSortOption>[] = [
  { id: 'newest', label: 'Newest first', icon: 'calendar-outline' },
  { id: 'oldest', label: 'Oldest first', icon: 'time-outline' },
  { id: 'pay-high', label: 'Highest pay', icon: 'trending-up-outline' },
  { id: 'pay-low', label: 'Lowest pay', icon: 'trending-down-outline' },
  { id: 'applicants', label: 'Most applicants', icon: 'people-outline' },
];

const LOCATION_OPTIONS: { key: LocationType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'remote', label: 'Remote', icon: 'globe-outline' },
  { key: 'on-site', label: 'On-site', icon: 'location-outline' },
  { key: 'hybrid', label: 'Hybrid', icon: 'git-merge-outline' },
];

export default function BrowseScreen() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<LocationType | 'all'>('all');
  const [selectedSort, setSelectedSort] = useState<GigSortOption>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<GigFilterOptions>({});
  const [appliedGigIds, setAppliedGigIds] = useState<Set<string>>(() => new Set());
  const [selectedGigForApply, setSelectedGigForApply] = useState<Gig | null>(null);

  useEffect(() => {
    if (!user || userData?.role === 'client') return;
    return subscribeToMyApplications(user.uid, apps => setAppliedGigIds(new Set(apps.map(app => app.gigId))), () => {});
  }, [user, userData?.role]);

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const options = useMemo(() => ({ ...advancedFilters, status: 'open' as const,
    category: selectedCategory, locationType: selectedLocation, sortBy: selectedSort, searchQuery: keyword,
  }), [advancedFilters, selectedCategory, selectedLocation, selectedSort, keyword]);
  const { gigs, loading, error, refreshing, loadingMore, hasMore, refresh, loadMore } =
    useGigDiscovery(options, !!user && userData?.role === 'freelancer' && !userData.suspended);

  // The Filters badge counts only what lives inside the Filters sheet; chips and sort show their own state.
  const advancedCount = Object.entries(advancedFilters).filter(([key, value]) =>
    key !== 'origin' && value !== undefined && value !== '' && value !== false && value !== 'all').length;
  const hasAnyFilter = !!searchQuery.trim() || advancedCount > 0 || selectedCategory !== 'all'
    || selectedLocation !== 'all' || selectedSort !== 'newest';
  const isClient = userData?.role === 'client';

  const handleGigPress = useCallback((gig: Gig) => {
    router.push({ pathname: '/(app)/gig/[id]', params: { id: gig.id } } as any);
  }, []);

  const handleClearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSearchQuery('');
    setKeyword('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSelectedSort('newest');
    setAdvancedFilters({});
  };

  const select = <T,>(setter: (update: (prev: T) => T) => void, value: T, none: T) => {
    Haptics.selectionAsync().catch(() => {});
    setter(prev => (prev === value ? none : value));
  };

  const renderGigItem = useCallback(({ item }: { item: Gig }) => {
    const hasApplied = appliedGigIds.has(item.id);
    return (
      <View style={styles.cardWrapper}>
        <GigCard
          gig={item}
          onPress={handleGigPress}
          showBookmark={!isClient}
          renderActions={isClient ? undefined : gig => (
            <View style={styles.cardActionsRow}>
              <Pressable onPress={() => handleGigPress(gig)} accessibilityRole="button"
                style={({ pressed }) => [styles.cardBtn, styles.detailsBtn, pressed && styles.pressed]}>
                <Text style={styles.detailsBtnText}>{t('Details')}</Text>
              </Pressable>
              {hasApplied ? (
                <Pressable onPress={() => router.push('/(app)/applications' as any)} accessibilityRole="button"
                  style={({ pressed }) => [styles.cardBtn, styles.appliedBtn, pressed && styles.pressed]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.appliedBtnText}>{t('Applied')}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setSelectedGigForApply(gig)} accessibilityRole="button"
                  style={({ pressed }) => [styles.cardBtn, styles.applyBtn, pressed && styles.pressed]}>
                  <Ionicons name="paper-plane" size={15} color={colors.primaryOnColor} />
                  <Text style={styles.applyBtnText}>{t('Apply Now')}</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      </View>
    );
  }, [handleGigPress, appliedGigIds, isClient, t]);

  const sortLabel = SORT_OPTIONS.find(option => option.id === selectedSort)?.label ?? 'Newest first';
  const resultLabel = hasMore
    ? t('{{count}}+ gigs found', { count: gigs.length })
    : t('{{count}} gigs found', { count: gigs.length });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{t('Browse Gigs')}</Text>
        <Pressable onPress={() => setFilterModalVisible(true)} accessibilityRole="button" accessibilityLabel={t('Open gig filters')}
          style={({ pressed }) => [styles.filterBtn, advancedCount > 0 && styles.filterBtnActive, pressed && styles.pressed]}>
          <Ionicons name="options-outline" size={18} color={advancedCount > 0 ? colors.primaryOnColor : colors.primary} />
          <Text style={[styles.filterBtnText, advancedCount > 0 && styles.filterBtnTextActive]}>{t('Filters')}</Text>
          {advancedCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{advancedCount}</Text></View>}
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder={t('Search title, skill, location…')} />
        <Pressable onPress={() => setSortVisible(true)} accessibilityRole="button" accessibilityLabel={t('Sort By')}
          style={({ pressed }) => [styles.sortBtn, selectedSort !== 'newest' && styles.sortBtnActive, pressed && styles.pressed]}>
          <Ionicons name="swap-vertical" size={18} color={selectedSort !== 'newest' ? colors.primaryOnColor : colors.primary} />
        </Pressable>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
          <Chip label={t('All')} icon="grid-outline" variant={selectedCategory === 'all' ? 'selected' : 'default'}
            onPress={() => setSelectedCategory('all')} />
          {GIG_CATEGORIES.map(cat => <Chip key={cat.id} label={t(cat.name)} icon={cat.icon as any}
            variant={selectedCategory === cat.id ? 'selected' : 'default'}
            onPress={() => select(setSelectedCategory, cat.id, 'all')} />)}
        </ScrollView>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
          {LOCATION_OPTIONS.map(loc => <Chip key={loc.key} label={t(loc.label)} icon={loc.icon}
            variant={selectedLocation === loc.key ? 'selected' : 'outline'}
            onPress={() => select<LocationType | 'all'>(setSelectedLocation, loc.key, 'all')} />)}
        </ScrollView>
      </View>

      <View style={styles.resultsRow}>
        <Text style={styles.resultsText} numberOfLines={1}>
          {loading ? t('Searching…') : resultLabel}
          {selectedSort !== 'newest' ? ` · ${t(sortLabel)}` : ''}
        </Text>
        {hasAnyFilter && <Pressable onPress={handleClearFilters} accessibilityRole="button" style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}>
          <Text style={styles.linkText}>{t('Clear All')}</Text>
        </Pressable>}
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl options={[{ key: 'list', label: t('List') }, { key: 'map', label: t('Map') }]} selectedKey={viewMode}
          onSelect={key => { setViewMode(key); Keyboard.dismiss(); }} />
      </View>

      {viewMode === 'map' ? <GigMap gigs={gigs} loading={loading} error={error ?? undefined} refreshing={refreshing} loadingMore={loadingMore} hasMore={hasMore}
        onRefresh={refresh} onLoadMore={loadMore} onGigPress={handleGigPress} onShowList={() => setViewMode('list')} /> : <FlatList
        data={gigs}
        keyExtractor={item => item.id}
        renderItem={renderGigItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReached={() => { if (!error && gigs.length > 0) loadMore(); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={loading ? <SkeletonList variant="gig" count={3} /> : error
          ? <ErrorState title={t('Failed to load gigs')} message={t(error)} onRetry={refresh} />
          : <EmptyState icon={hasAnyFilter ? 'search-outline' : 'briefcase-outline'}
            title={hasMore ? t('Still looking for matches') : hasAnyFilter ? t('No matching gigs') : t('No gigs yet')}
            description={hasMore ? t('Continue searching to check older gigs.') : hasAnyFilter ? t('Try adjusting your search or filters.') : t('Pull down to check for new opportunities.')}
            actionLabel={hasMore ? t('Continue searching') : hasAnyFilter ? t('Clear All Filters') : undefined}
            onAction={hasMore ? loadMore : handleClearFilters} />}
        ListFooterComponent={gigs.length > 0 ? <View style={styles.footer}>
          {!!error && <ErrorState message={t(error)} onRetry={hasMore ? loadMore : refresh} />}
          {loadingMore ? <ActivityIndicator color={colors.primary} /> : !refreshing && !error && (hasMore
            ? <Pressable onPress={loadMore} accessibilityRole="button" style={({ pressed }) => [styles.loadMoreBtn, pressed && styles.pressed]}>
              <Text style={styles.linkText}>{t('Load more gigs')}</Text>
            </Pressable>
            : <Text style={styles.endText}>{t('You have reached the end.')}</Text>)}
        </View> : null}
      />}

      {filterModalVisible && <DiscoveryFilters visible value={advancedFilters} onApply={setAdvancedFilters} onClose={() => setFilterModalVisible(false)} />}

      <OptionSheet visible={sortVisible} title="Sort By" options={SORT_OPTIONS} selected={selectedSort}
        onSelect={id => { Haptics.selectionAsync().catch(() => {}); setSelectedSort(id); setSortVisible(false); }}
        onClose={() => setSortVisible(false)} />

      {user && <ApplyModal
        visible={!!selectedGigForApply}
        gig={selectedGigForApply}
        youthId={user.uid}
        youthName={userData?.fullName || user.displayName || 'Youth Freelancer'}
        youthPhotoURL={userData?.photoURL || ''}
        youthSkills={userData?.skills?.split(',').map(s => s.trim()).filter(Boolean)}
        youthBio={userData?.bio || ''}
        onClose={() => setSelectedGigForApply(null)}
        onSuccess={() => {
          const appliedGig = selectedGigForApply;
          setSelectedGigForApply(null);
          if (appliedGig) setAppliedGigIds(prev => new Set(prev).add(appliedGig.id));
          toast.success(t('Application Submitted! 🎉'), t('Your application has been sent to the business owner.'));
        }}
      />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pressed: { opacity: 0.8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.text, flex: 1 },
  filterBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBtnText: { ...typography.label, color: colors.primary },
  filterBtnTextActive: { color: colors.primaryOnColor },
  filterBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { ...typography.caption, fontFamily: typography.label.fontFamily, color: colors.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  sortBtn: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  sortBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  resultsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 44 },
  resultsText: { ...typography.label, color: colors.textSecondary, flex: 1 },
  clearBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { ...typography.label, color: colors.primary },
  segmentWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl, flexGrow: 1 },
  cardWrapper: { marginBottom: spacing.md },
  cardActionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  cardBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2, borderRadius: borderRadius.md },
  detailsBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  detailsBtnText: { ...typography.label, color: colors.text },
  applyBtn: { flex: 1.3, backgroundColor: colors.primary },
  applyBtnText: { ...typography.label, color: colors.primaryOnColor },
  appliedBtn: { flex: 1.3, backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.successBorder },
  appliedBtnText: { ...typography.label, color: colors.success },
  footer: { paddingVertical: spacing.md, alignItems: 'center', gap: spacing.sm },
  loadMoreBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  endText: { ...typography.caption, color: colors.textMuted },
});
