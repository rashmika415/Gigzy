import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../../constants/theme';
import { subscribeToRecentGigs } from '../../../services/gigService';
import { GigCard, SearchBar, EmptyState, LoadingState, ErrorState } from '../../../components';
import type { Gig } from '../../../types/gig';

export default function BrowseScreen() {
  const { user } = useAuth();

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time subscription to gigs
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError('');

    const unsubscribe = subscribeToRecentGigs(
      50,
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

  // Client-side filtering
  const filteredGigs = searchQuery.trim()
    ? gigs.filter((g) => {
        const q = searchQuery.toLowerCase();
        return (
          g.title?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.category?.toLowerCase().includes(q) ||
          g.location?.toLowerCase().includes(q) ||
          g.skills?.some((s) => s.toLowerCase().includes(q))
        );
      })
    : gigs;

  const openGigs = filteredGigs.filter((g) => g.status === 'open');

  const handleRefresh = () => setRefreshing(true);

  const handleGigPress = (gig: Gig) => {
    router.push({
      pathname: '/(app)/gig/[id]',
      params: { id: gig.id },
    } as any);
  };

  const renderGigItem = ({ item }: { item: Gig }) => (
    <View style={styles.cardWrapper}>
      <GigCard gig={item} onPress={handleGigPress} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Background blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Browse Gigs</Text>
          <Text style={styles.subtitle}>
            {openGigs.length} open {openGigs.length === 1 ? 'opportunity' : 'opportunities'}
          </Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search gigs by title, skill, location…"
        />
      </View>

      {/* Gig Feed */}
      {loading ? (
        <LoadingState message="Discovering gigs…" size="large" />
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
      ) : openGigs.length === 0 ? (
        <View style={styles.stateWrapper}>
          <EmptyState
            icon={searchQuery ? 'search-outline' : 'briefcase-outline'}
            title={searchQuery ? 'No matching gigs' : 'No gigs yet'}
            description={
              searchQuery
                ? 'Try adjusting your search query.'
                : 'New opportunities will appear here in real time.'
            }
          />
        </View>
      ) : (
        <FlatList
          data={openGigs}
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
    </SafeAreaView>
  );
}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stateWrapper: {
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
});
