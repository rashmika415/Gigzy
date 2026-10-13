import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../../localization/i18n';
import AppBanner, { AppPhoto } from '../../../components/AppBanner';
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Text } from '../../../components/LocalizedText';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { useSavedGigs } from '../../../context/SavedGigsContext';
import { colors, spacing, borderRadius, fonts, typography } from '../../../constants/theme';
import { formatCurrency, formatNumber } from '../../../localization/format';
import { subscribeToClientGigs, subscribeToRecentGigs, deleteGig } from '../../../services/gigService';
import { subscribeToUserChats, getOrCreateChat } from '../../../services/chatService';
import { Gig } from '../../../types/gig';
import { subscribeToNotifications } from '../../../services/notificationService';
import GigCard from '../../../components/GigCard';
import EmptyState from '../../../components/EmptyState';
import ErrorState from '../../../components/ErrorState';
import SkeletonList from '../../../components/Skeleton';
import { useToast } from '../../../context/ToastContext';

const openGig = (gig: Gig) => router.push({ pathname: '/(app)/gig/[id]', params: { id: gig.id } });

export default function Home() {
  useTranslation();
  const { user, userData } = useAuth();
  const { savedIds } = useSavedGigs();
  const toast = useToast();
  const firstName = userData?.fullName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'there';
  const role = userData?.role ?? 'freelancer';
  const isClient = role === 'client';

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loadingGigs, setLoadingGigs] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [startingChatGigId, setStartingChatGigId] = useState<string | null>(null);

  // Real-time unread messages listener
  useEffect(() => {
    if (!user) return;
    const unsubChats = subscribeToUserChats(
      user.uid,
      (userChats) => {
        const total = userChats.reduce((acc, c) => acc + (c.unreadCount?.[user.uid] || 0), 0);
        setUnreadChatCount(total);
      },
      () => {}
    );
    return () => unsubChats();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, (items) => {
      setUnreadNotificationCount(items.filter((item) => !item.read).length);
    }, () => {});
  }, [user]);

  // Real-time Firestore synchronization
  useEffect(() => {
    if (!user) {
      return;
    }

    let unsubscribe: () => void = () => {};
    let active = true;
    void Promise.resolve().then(() => {
    if (!active) return;
    setLoadingGigs(true);
    setLoadError('');

    if (role === 'client') {
      // Business owner: subscribe to their own posted gigs in real time
      unsubscribe = subscribeToClientGigs(
        user.uid,
        (clientGigs) => {
          setLoadError('');
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
          setLoadError('');
          setGigs(recentGigs);
          setLoadingGigs(false);
        },
        (err) => {
          setLoadError(err.message);
          setLoadingGigs(false);
        }
      );
    }

    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, role, loadAttempt]);

  const handleDeleteGig = (gigId: string, gigTitle: string) => {
    Alert.alert(
      tr("Delete Gig"),
      tr("Are you sure you want to remove \"{{value0}}\"? This cannot be undone.", { value0: gigTitle }),
      [
        { text: tr("Cancel"), style: 'cancel' },
        {
          text: tr("Delete"),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGig(gigId);
              toast.success(tr("Gig deleted"));
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}
            } catch (err: any) {
              toast.error(tr("Failed to delete gig."), err.message);
            }
          },
        },
      ]
    );
  };

  const handleContactBusiness = async (gig: Gig) => {
    if (!user) {
      toast.info(tr("Sign In Required"), tr("Please sign in to contact the gig author."));
      return;
    }
    if (gig.postedBy?.uid === user.uid) {
      router.push('/(app)/(tabs)/my-gigs' as any);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setStartingChatGigId(gig.id);

    try {
      const currentParticipant = {
        uid: user.uid,
        fullName: userData?.fullName || user.displayName || 'Freelancer',
        photoURL: userData?.photoURL || '',
        role: (userData?.role as any) || 'freelancer',
        email: user.email || '',
      };

      const businessParticipant = {
        uid: gig.postedBy.uid,
        fullName: gig.postedBy.fullName || 'Business Owner',
        photoURL: '',
        role: 'client' as const,
        email: gig.postedBy.email || '',
      };

      const chat = await getOrCreateChat(currentParticipant, businessParticipant, gig);
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: chat.id },
      } as any);
    } catch (err: any) {
      toast.error(tr("Failed to start conversation."), err.message);
    } finally {
      setStartingChatGigId(null);
    }
  };

  const getRoleLabel = () => {
    if (role === 'admin') return 'Platform Admin';
    if (role === 'client') return 'Business Owner';
    return 'Youth (Freelancer)';
  };

  const tap = (go: () => void) => () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    go();
  };
  const goBrowse = () => router.push('/(app)/(tabs)/browse');
  const goMyGigs = () => router.push('/(app)/(tabs)/my-gigs' as any);
  const goPostGig = () => router.push('/(app)/post-gig' as any);
  const editGig = (gig: Gig) => router.push({ pathname: '/(app)/post-gig', params: { editGigId: gig.id } } as any);

  const stats: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void }[] = isClient
    ? [
        { label: 'Gigs Posted', value: formatNumber(gigs.length), icon: 'briefcase-outline', onPress: goMyGigs },
        { label: 'Total Value', value: formatCurrency(gigs.reduce((acc, g) => acc + (g.pay || 0), 0)), icon: 'wallet-outline', onPress: goMyGigs },
        { label: 'Rating', value: userData?.ratingCount ? formatNumber(userData.ratingAverage ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—', icon: 'star-outline', onPress: () => router.push('/(app)/add-ratings' as any) },
      ]
    : [
        { label: 'New Gigs', value: formatNumber(gigs.length), icon: 'flash-outline', onPress: goBrowse },
        { label: 'Saved', value: formatNumber(savedIds.size), icon: 'bookmark-outline', onPress: () => router.push('/(app)/(tabs)/saved' as any) },
        { label: 'Rating', value: userData?.ratingCount ? formatNumber(userData.ratingAverage ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—', icon: 'star-outline' },
      ];

  const renderGigActions = (gig: Gig) =>
    isClient ? (
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={tap(() => editGig(gig))}
          accessibilityRole="button"
          accessibilityLabel={tr("Edit gig")}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryActionText}>{tr("Edit")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconAction}
          onPress={() => handleDeleteGig(gig.id, gig.title)}
          accessibilityRole="button"
          accessibilityLabel={tr("Delete gig")}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => openGig(gig)}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryActionText}>{tr("View Details")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => handleContactBusiness(gig)}
          disabled={startingChatGigId === gig.id}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          {startingChatGigId === gig.id ? (
            <ActivityIndicator size="small" color={colors.primaryOnColor} />
          ) : (
            <>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primaryOnColor} />
              <Text style={styles.primaryActionText}>{tr("Chat")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerGreetingBlock}>
            <Text style={styles.greeting}>{tr("Hello, {{name}}!", { name: firstName })}</Text>
            <Text style={styles.roleLabel}>{tr(getRoleLabel())}</Text>
          </View>

          <View style={styles.headerActionsRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push('/(app)/notifications' as any)}
              accessibilityRole="button"
              accessibilityLabel={tr("Notifications")}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.primary} />
              {unreadNotificationCount > 0 && (
                <View style={styles.headerBadgePill}><Text style={styles.headerBadgeText}>{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={tap(() => router.push('/(app)/(tabs)/messages' as any))}
              accessibilityRole="button"
              accessibilityLabel={tr("Messages")}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
              {unreadChatCount > 0 && (
                <View style={styles.headerBadgePill}>
                  <Text style={styles.headerBadgeText}>
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => router.push('/(app)/(tabs)/profile' as any)}
              accessibilityRole="button"
              accessibilityLabel={tr("Profile")}
              activeOpacity={0.8}
            >
              {userData?.photoURL ? (
                <Image source={{ uri: userData.photoURL }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>
                  {(firstName?.[0] ?? '?').toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {!isClient && <AppBanner kind="youth" title={tr("Your next opportunity starts here.")} description={tr("Find local gigs that fit your skills and your schedule.")} action="Explore gigs" onPress={goBrowse} />}
        {isClient && (
          <View style={styles.ctaCard}>
            <View style={{ marginBottom: spacing.md }}><AppPhoto kind="business" /></View>
            <View style={styles.ctaBadge}>
              <Ionicons name="flash" size={14} color={colors.primaryOnColor} />
              <Text style={styles.ctaBadgeText}>{tr("FOR BUSINESS OWNERS")}</Text>
            </View>
            <Text style={styles.ctaTitle}>{tr("Need Help with a Task?")}</Text>
            <Text style={styles.ctaSubtitle}>{tr("Post a new gig in minutes and connect with local skilled youth and talented freelancers.")}</Text>

            <View style={styles.ctaButtonsRow}>
              <TouchableOpacity style={styles.postGigButton} onPress={tap(goPostGig)} accessibilityRole="button" activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primaryOnColor} />
                <Text style={styles.postGigButtonText}>{tr("Post New Gig")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.manageGigsButton} onPress={tap(goMyGigs)} accessibilityRole="button" activeOpacity={0.85}>
                <Ionicons name="list-outline" size={18} color={colors.primary} />
                <Text style={styles.manageGigsButtonText}>{tr("My Posted Gigs ({{count}})", { count: gigs.length })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <TouchableOpacity
              key={stat.label}
              style={styles.statCard}
              onPress={stat.onPress}
              disabled={!stat.onPress}
              accessibilityRole={stat.onPress ? 'button' : undefined}
              activeOpacity={stat.onPress ? 0.75 : 1}
            >
              <View style={styles.statIcon}>
                <Ionicons name={stat.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{stat.value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{tr(stat.label)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gig list */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isClient ? tr("Your Posted Gigs") : tr("Explore Latest Gigs")}
            </Text>
            <TouchableOpacity
              onPress={isClient ? goMyGigs : goBrowse}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.seeAllText}>
                {isClient ? tr("Manage All ({{count}})", { count: gigs.length }) : tr("Browse All")} →
              </Text>
            </TouchableOpacity>
          </View>

          {loadingGigs && user ? (
            <SkeletonList variant="gig" count={3} />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={() => setLoadAttempt((n) => n + 1)} />
          ) : gigs.length === 0 ? (
            isClient ? (
              <EmptyState
                icon="briefcase-outline"
                title="No gigs posted yet"
                description={tr("Post your first gig to start finding local help.")}
                actionLabel="Post New Gig"
                actionIcon="add-circle-outline"
                onAction={goPostGig}
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title="No new gigs right now"
                description={tr("New gigs will appear here as soon as they are posted.")}
                actionLabel="Browse All"
                onAction={goBrowse}
              />
            )
          ) : (
            <View style={styles.gigsList}>
              {gigs.map((gig) => (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  onPress={openGig}
                  showBookmark={role === 'freelancer'}
                  renderActions={renderGigActions}
                />
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
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    flexWrap: 'wrap',
    gap: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerGreetingBlock: {
    flex: 1,
    minWidth: 140,
    marginRight: spacing.sm,
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgePill: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.background,
    paddingHorizontal: 4,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.primaryOnColor,
  },
  greeting: {
    ...typography.h1,
    color: colors.text,
  },
  roleLabel: {
    ...typography.label,
    color: colors.primary,
    marginTop: 2,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    ...typography.h3,
    color: colors.primary,
  },

  // CTA Card
  ctaCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
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
    ...typography.overline,
    color: colors.primaryOnColor,
  },
  ctaTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 4,
  },
  ctaSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ctaButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  postGigButton: {
    flex: 1,
    minWidth: 160,
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  postGigButtonText: {
    ...typography.title,
    fontSize: 15,
    color: colors.primaryOnColor,
  },
  manageGigsButton: {
    flex: 1,
    minWidth: 160,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  manageGigsButtonText: {
    ...typography.label,
    fontSize: 14,
    color: colors.primary,
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
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
    alignSelf: 'stretch',
  },
  statLabel: {
    ...typography.caption,
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
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    flexShrink: 1,
    color: colors.text,
  },
  seeAllText: {
    ...typography.label,
    color: colors.primary,
  },

  // Gig list
  gigsList: {
    gap: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  primaryActionText: {
    ...typography.label,
    fontSize: 14,
    color: colors.primaryOnColor,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  secondaryActionText: {
    ...typography.label,
    fontSize: 14,
    color: colors.primary,
  },
  iconAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
  },
});
