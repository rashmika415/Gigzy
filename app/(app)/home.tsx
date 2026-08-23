import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { subscribeToClientGigs, subscribeToRecentGigs, deleteGig } from '../../services/gigService';
import { Gig } from '../../types/gig';

export default function Home() {
  const { user, userData } = useAuth();
  const firstName = userData?.fullName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'there';
  const role = userData?.role ?? 'freelancer';

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loadingGigs, setLoadingGigs] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Real-time Firestore synchronization
  useEffect(() => {
    if (!user) {
      setLoadingGigs(false);
      return;
    }

    setLoadingGigs(true);
    setLoadError('');

    let unsubscribe: () => void = () => {};

    if (role === 'client') {
      // Business owner: subscribe to their own posted gigs in real time
      unsubscribe = subscribeToClientGigs(
        user.uid,
        (clientGigs) => {
          setGigs(clientGigs);
          setLoadingGigs(false);
        },
        (err) => {
          setLoadError(err.message);
          setLoadingGigs(false);
        }
      );
    } else {
      // Freelancer: subscribe to recent open gigs across the platform
      unsubscribe = subscribeToRecentGigs(
        10,
        (recentGigs) => {
          setGigs(recentGigs);
          setLoadingGigs(false);
        },
        (err) => {
          setLoadError(err.message);
          setLoadingGigs(false);
        }
      );
    }

    return () => {
      unsubscribe();
    };
  }, [user, role]);

  const handleDeleteGig = (gigId: string, gigTitle: string) => {
    Alert.alert(
      'Delete Gig',
      `Are you sure you want to remove "${gigTitle}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGig(gigId);
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

  const getRoleLabel = () => {
    if (role === 'admin') return 'Platform Admin';
    if (role === 'client') return 'Business Owner';
    return 'Youth (Freelancer)';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}! 👋</Text>
            <Text style={styles.subtitle}>
              Role Profile: <Text style={styles.roleLabel}>{getRoleLabel()}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => router.push('/(app)/profile' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>
              {(firstName?.[0] ?? '?').toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Business Owner / Post Gig CTA Banner */}
        <View style={styles.ctaCard}>
          <View style={styles.ctaBadge}>
            <Ionicons name="flash" size={14} color="#080B14" />
            <Text style={styles.ctaBadgeText}>FOR BUSINESS OWNERS</Text>
          </View>
          <Text style={styles.ctaTitle}>Need Help with a Task?</Text>
          <Text style={styles.ctaSubtitle}>
            Post a new gig in minutes and connect with local skilled youth and talented freelancers.
          </Text>

          <TouchableOpacity
            style={styles.postGigButton}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              router.push('/(app)/post-gig' as any);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color="#080B14" />
            <Text style={styles.postGigButtonText}>Post a New Gig</Text>
          </TouchableOpacity>
        </View>

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Gigs Active', value: gigs.length.toString(), emoji: '💼' },
            { label: 'Earnings', value: '$0', emoji: '💰' },
            { label: 'Rating', value: '5.0', emoji: '⭐' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statEmoji}>{stat.emoji}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Real-time Gigs List Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                {role === 'client' ? 'Your Posted Gigs' : 'Explore Latest Gigs'}
              </Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live Sync</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(app)/post-gig' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.seeAllText}>+ Post Gig</Text>
            </TouchableOpacity>
          </View>

          {loadingGigs ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.loadingText}>Syncing with Cloud Firestore...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : gigs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No Gigs Found</Text>
              <Text style={styles.emptyText}>
                {role === 'client'
                  ? 'You have not posted any gigs yet. Tap "Post a New Gig" above to create your first listing in Firestore!'
                  : 'Be the first to create or browse new opportunities on the platform.'}
              </Text>
            </View>
          ) : (
            <View style={styles.gigsList}>
              {gigs.map((gig) => (
                <View key={gig.id} style={styles.gigItemCard}>
                  <View style={styles.gigItemHeader}>
                    <View style={styles.gigCategoryBadge}>
                      <Text style={styles.gigCategoryBadgeText}>{gig.category}</Text>
                    </View>
                    <View style={styles.gigHeaderRight}>
                      <View style={styles.gigPayBadge}>
                        <Text style={styles.gigPayText}>
                          ${gig.pay} {gig.payType === 'hourly' ? '/hr' : ''}
                        </Text>
                      </View>
                      {role === 'client' && (
                        <TouchableOpacity
                          style={styles.deleteGigBtn}
                          onPress={() => handleDeleteGig(gig.id, gig.title)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <Text style={styles.gigItemTitle} numberOfLines={1}>
                    {gig.title}
                  </Text>
                  <Text style={styles.gigItemDesc} numberOfLines={2}>
                    {gig.description}
                  </Text>

                  {/* Skills tags preview */}
                  {gig.skills && gig.skills.length > 0 && (
                    <View style={styles.skillsRow}>
                      {gig.skills.slice(0, 3).map((skill) => (
                        <View key={skill} style={styles.skillChip}>
                          <Text style={styles.skillChipText}>{skill}</Text>
                        </View>
                      ))}
                      {gig.skills.length > 3 && (
                        <Text style={styles.moreSkillsText}>+{gig.skills.length - 3} more</Text>
                      )}
                    </View>
                  )}

                  <View style={styles.gigItemFooter}>
                    <View style={styles.gigMetaRow}>
                      <Ionicons
                        name={gig.locationType === 'remote' ? 'globe-outline' : 'location-outline'}
                        size={13}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.gigMetaText} numberOfLines={1}>
                        {gig.location || 'Remote'}
                      </Text>
                    </View>
                    <View style={styles.gigMetaRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.gigMetaText}>{gig.date}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  blob1: {
    position: 'absolute',
    top: -60,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primaryGlow,
    opacity: 0.35,
  },
  blob2: {
    position: 'absolute',
    bottom: 80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentLight,
    opacity: 0.4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },

  // CTA Card
  ctaCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  ctaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
    marginBottom: spacing.sm,
  },
  ctaBadgeText: {
    color: '#080B14',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  postGigButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  postGigButtonText: {
    color: '#080B14',
    fontSize: 15,
    fontWeight: '800',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 22 },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // Section
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.sm },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Gigs List
  gigsList: {
    gap: spacing.md,
  },
  gigItemCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: 6,
  },
  gigItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  gigHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gigCategoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  gigCategoryBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  gigPayBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  gigPayText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  deleteGigBtn: {
    padding: 4,
  },
  gigItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  gigItemDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  skillChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  skillChipText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  moreSkillsText: {
    fontSize: 10,
    color: colors.textMuted,
    alignSelf: 'center',
  },
  gigItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  gigMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gigMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
