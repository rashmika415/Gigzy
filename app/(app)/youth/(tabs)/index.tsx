import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import GigCard from '../../../../components/GigCard';
import FiltersSheet, { Filters, DEFAULT_FILTERS } from '../../../../components/FiltersSheet';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { MOCK_GIGS, CATEGORY_LABEL, Category, YOUTH_PROFILE } from '../../../../data/mockData';

const CATEGORIES: (Category | 'all')[] = ['all', 'cafe', 'retail', 'events', 'tutoring', 'delivery', 'ngo'];

export default function GigsFeed() {
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const gigs = useMemo(() => {
    return MOCK_GIGS.filter((gig) => {
      if (activeCategory !== 'all' && gig.category !== activeCategory) return false;
      if (filters.categories.length && !filters.categories.includes(gig.category)) return false;
      if (gig.distanceKm > filters.maxDistanceKm) return false;
      if (filters.minPay != null && gig.pay < filters.minPay) return false;
      if (filters.maxPay != null && gig.pay > filters.maxPay) return false;
      if (search.trim() && !gig.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [activeCategory, filters, search]);

  const toggleBookmark = (id: string) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gigs near you</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={13} color={colors.textMuted} />
            <Text style={styles.locationText}>{YOUTH_PROFILE.location}</Text>
          </View>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{YOUTH_PROFILE.name[0]}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search gigs"
            placeholderTextColor={colors.placeholder}
          />
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersOpen(true)} activeOpacity={0.8}>
          <MaterialIcons name="tune" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={gigs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.chipsRow}>
              <FlatList
                data={CATEGORIES}
                horizontal
                keyExtractor={(c) => c}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => {
                  const active = activeCategory === item;
                  return (
                    <TouchableOpacity
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setActiveCategory(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {item === 'all' ? 'All' : CATEGORY_LABEL[item]}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
            <View style={styles.countRow}>
              <Text style={styles.countText}>{gigs.length} open {gigs.length === 1 ? 'gig' : 'gigs'}</Text>
              <Text style={styles.sortText}>Sort: Newest</Text>
            </View>
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No gigs match your filters yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <GigCard
            title={item.title}
            category={item.category}
            subtitle={`${item.employerName} · ${item.employerRating}★`}
            schedule={item.schedule}
            distance={`${item.distanceKm}km away`}
            pay={item.pay}
            payRate={item.payRate}
            bookmarked={bookmarked.has(item.id)}
            onToggleBookmark={() => toggleBookmark(item.id)}
            onPress={() => router.push(`/youth/gig/${item.id}`)}
          />
        )}
      />

      <FiltersSheet
        visible={filtersOpen}
        initialFilters={filters}
        resultCount={gigs.length}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
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
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.primary,
  },

  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  chipsRow: { marginTop: spacing.md, marginBottom: spacing.sm },
  chip: {
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: {
    backgroundColor: colors.chipActiveBg,
    borderColor: colors.chipActiveBg,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.chipActiveText },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  countText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  sortText: {
    fontFamily: fonts.body,
    fontSize: 13,
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
