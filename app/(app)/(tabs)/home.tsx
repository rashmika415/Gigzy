import VerifiedBusinessBadge from '../../../components/VerifiedBusinessBadge';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../../localization/i18n';
import AppBanner, { AppPhoto } from '../../../components/AppBanner';
import React, { useEffect, useState, useMemo } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Text } from '../../../components/LocalizedText';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { useSavedGigs } from '../../../context/SavedGigsContext';
import { colors, spacing, borderRadius, fonts, typography } from '../../../constants/theme';
import { formatNumber } from '../../../localization/format';
import { subscribeToClientGigs, subscribeToRecentGigs, deleteGig, updateGigStatus } from '../../../services/gigService';
import { subscribeToUserChats, getOrCreateChat } from '../../../services/chatService';
import { subscribeToMyApplications } from '../../../services/applicationService';
import { addGigToCalendar } from '../../../services/calendarService';
import { Gig } from '../../../types/gig';
import type { Application } from '../../../types/application';
import { subscribeToNotifications } from '../../../services/notificationService';
import GigCard from '../../../components/GigCard';
import EmptyState from '../../../components/EmptyState';
import ErrorState from '../../../components/ErrorState';
import SkeletonList from '../../../components/Skeleton';
import { useToast } from '../../../context/ToastContext';
import ApplyModal from '../../../components/applications/ApplyModal';
import { ApplicantListModal } from '../../../components/applications';
import { RatingModal } from '../../../components/reviews';
import { hasUserReviewedGig } from '../../../services/reviewService';
import ConfirmSheet from '../../../components/ConfirmSheet';
import BusinessGigActions from '../../../components/business/BusinessGigActions';
import HiredGigCard from '../../../components/business/HiredGigCard';

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
  const [selectedGigForApply, setSelectedGigForApply] = useState<Gig | null>(null);
  const [selectedGigForApplicants, setSelectedGigForApplicants] = useState<Gig | null>(null);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [calendarAddingGigId, setCalendarAddingGigId] = useState<string | null>(null);
  const [calendarAddedGigIds, setCalendarAddedGigIds] = useState<Record<string, boolean>>({});
  const [ratingTarget, setRatingTarget] = useState<{
    userId: string;
    userName: string;
    userPhotoURL?: string;
    targetRole?: 'freelancer' | 'client';
    gigId: string;
    gigTitle: string;
  } | null>(null);
  const [reviewedGigIds, setReviewedGigIds] = useState<Record<string, boolean>>({});

  const totalApplicants = useMemo(
    () => gigs.reduce((acc, g) => acc + (g.applicantsCount || 0), 0),
    [gigs]
  );

  const acceptedApplications = useMemo(
    () => myApplications.filter((app) => app.status === 'accepted' || app.status === 'completed'),
    [myApplications]
  );

  const inProgressGigs = useMemo(
    () => (isClient ? gigs.filter((g) => g.status === 'in-progress' || g.status === 'completed') : []),
    [gigs, isClient]
  );

  const spotlightApplications = useMemo(() => {
    return [...myApplications].sort((a, b) => {
      const aPriority = a.status === 'accepted' ? 2 : a.status === 'completed' ? 1 : 0;
      const bPriority = b.status === 'accepted' ? 2 : b.status === 'completed' ? 1 : 0;
      return bPriority - aPriority;
    });
  }, [myApplications]);

  const openGigs = useMemo(
    () => (isClient ? gigs.filter((g) => g.status === 'open' || !g.status) : gigs),
    [gigs, isClient]
  );

  // Real-time synchronization of youth applications
  useEffect(() => {
    if (!user || isClient) return;
    const unsubApps = subscribeToMyApplications(
      user.uid,
      (apps) => setMyApplications(apps),
      () => {}
    );
    return () => unsubApps();
  }, [user, isClient]);

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

  // Check review completion status for active gigs and applications
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const checkReviews = async () => {
      const results: Record<string, boolean> = {};

      if (isClient) {
        for (const gig of inProgressGigs) {
          if (gig.assignedYouthId && gig.id) {
            try {
              const reviewed = await hasUserReviewedGig(user.uid, gig.assignedYouthId, gig.id);
              if (reviewed) results[gig.id] = true;
            } catch {}
          }
        }
      } else {
        for (const app of acceptedApplications) {
          if (app.businessId && app.gigId) {
            try {
              const reviewed = await hasUserReviewedGig(user.uid, app.businessId, app.gigId);
              if (reviewed) results[app.gigId] = true;
            } catch {}
          }
        }
      }

      if (!cancelled) {
        setReviewedGigIds((prev) => ({ ...prev, ...results }));
      }
    };

    checkReviews();
    return () => {
      cancelled = true;
    };
  }, [user, isClient, inProgressGigs, acceptedApplications]);

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

  // Owner confirmations (delete listing / mark hired gig as done) share one themed dialog.
  const [confirmAction, setConfirmAction] = useState<{ kind: 'delete' | 'complete'; gig: Gig } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const runConfirmedAction = async () => {
    if (!confirmAction || confirmBusy) return;
    const { kind, gig } = confirmAction;
    setConfirmBusy(true);
    setConfirmError('');
    try {
      if (kind === 'delete') {
        await deleteGig(gig.id, user?.uid);
        toast.success(tr("Gig deleted"));
      } else {
        await updateGigStatus(gig.id, 'completed');
        toast.success(tr("Gig Marked as Completed! 🎉"), tr("Thank you! Please leave a review for the freelancer."));
        if (gig.assignedYouthId) handleRateFreelancer(gig);
      }
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setConfirmAction(null);
    } catch (err: any) {
      setConfirmError(err?.message || (kind === 'delete' ? 'Failed to delete gig.' : 'Failed to update gig status.'));
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleDeleteGig = (gig: Gig) => { setConfirmError(''); setConfirmAction({ kind: 'delete', gig }); };

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

  const handleAddToCalendar = async (gig: Gig) => {
    setCalendarAddingGigId(gig.id);
    try {
      const result = await addGigToCalendar({
        title: gig.title,
        date: gig.date || new Date().toISOString().split('T')[0],
        time: gig.time,
        location: gig.location,
        description: gig.description,
        gigId: gig.id,
        pay: gig.pay,
        payType: gig.payType,
        counterpartName: gig.assignedYouthName || 'Youth Freelancer',
        counterpartRole: 'freelancer',
      });
      if (!result.success) throw new Error(result.error || 'Could not add gig to calendar.');
      setCalendarAddedGigIds((prev) => ({ ...prev, [gig.id]: true }));
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      toast.success(tr("Added to calendar"));
    } catch (err: any) {
      toast.error(tr("Could not add gig to calendar."), err?.message ? tr(err.message) : undefined);
    } finally {
      setCalendarAddingGigId(null);
    }
  };

  const handleMessageAssignedFreelancer = async (gig: Gig) => {
    if (!user) return;
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      if (gig.conversationId) {
        router.push({
          pathname: '/(app)/chat/[id]',
          params: { id: gig.conversationId },
        } as any);
        return;
      }
      if (gig.assignedYouthId) {
        const currentParticipant = {
          uid: user.uid,
          fullName: userData?.fullName || user.displayName || 'Business Owner',
          photoURL: userData?.photoURL || '',
          role: 'client' as const,
          email: user.email || '',
        };
        const youthParticipant = {
          uid: gig.assignedYouthId,
          fullName: gig.assignedYouthName || 'Youth Freelancer',
          photoURL: gig.assignedYouthPhotoURL || '',
          role: 'freelancer' as const,
          email: '',
        };
        const chat = await getOrCreateChat(currentParticipant, youthParticipant, gig);
        router.push({
          pathname: '/(app)/chat/[id]',
          params: { id: chat.id },
        } as any);
      } else {
        router.push('/(app)/(tabs)/messages' as any);
      }
    } catch (err: any) {
      toast.error(tr("Failed to start conversation."), err.message);
    }
  };

  const handleRateFreelancer = (gig: Gig) => {
    if (!gig.assignedYouthId) return;
    setRatingTarget({
      userId: gig.assignedYouthId,
      userName: gig.assignedYouthName || 'Youth Freelancer',
      userPhotoURL: gig.assignedYouthPhotoURL,
      targetRole: 'freelancer',
      gigId: gig.id,
      gigTitle: gig.title,
    });
  };

  const handleRateClient = (app: Application) => {
    if (!app.businessId) return;
    setRatingTarget({
      userId: app.businessId,
      userName: app.businessName || 'Business Owner',
      targetRole: 'client',
      gigId: app.gigId,
      gigTitle: app.gigTitle || '',
    });
  };

  const handleCompleteGig = (gig: Gig) => { setConfirmError(''); setConfirmAction({ kind: 'complete', gig }); };

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
        { label: 'In Progress', value: formatNumber(inProgressGigs.length), icon: 'flash-outline', onPress: goMyGigs },
        { label: 'Open Listings', value: formatNumber(openGigs.length), icon: 'briefcase-outline', onPress: goMyGigs },
        { label: 'Applicants', value: formatNumber(totalApplicants), icon: 'people-outline', onPress: () => router.push('/(app)/applications' as any) },
      ]
    : [
        { label: 'Accepted Gigs', value: formatNumber(acceptedApplications.length), icon: 'checkmark-circle-outline', onPress: () => router.push('/(app)/applications' as any) },
        { label: 'My Applications', value: formatNumber(myApplications.length), icon: 'document-text-outline', onPress: () => router.push('/(app)/applications' as any) },
        { label: 'Rating', value: userData?.ratingCount ? formatNumber(userData.ratingAverage ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—', icon: 'star-outline' },
      ];

  const renderGigActions = (gig: Gig) =>
    isClient ? (
      <BusinessGigActions gig={gig} onApplicants={setSelectedGigForApplicants}
        onEdit={target => tap(() => editGig(target))()} onDelete={handleDeleteGig} />
    ) : (
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => openGig(gig)}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryActionText}>{tr("Details")}</Text>
        </TouchableOpacity>

        {myApplications.some(app => app.gigId === gig.id) ? (
          <TouchableOpacity
            style={styles.appliedAction}
            onPress={() => router.push('/(app)/applications' as any)}
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.appliedActionText}>{tr("Applied")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => {
              if (!user) {
                router.push('/(auth)/login' as any);
                return;
              }
              setSelectedGigForApply(gig);
            }}
            accessibilityRole="button"
            activeOpacity={0.85}
          >
            <Ionicons name="paper-plane" size={15} color={colors.primaryOnColor} />
            <Text style={styles.primaryActionText}>{tr("Apply Now")}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.chatAction}
          onPress={() => handleContactBusiness(gig)}
          disabled={startingChatGigId === gig.id}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          {startingChatGigId === gig.id ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
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
            <AppPhoto kind="business" />
            <View style={styles.ctaCopy}>
              <Text style={styles.ctaTitle}>{tr("Need help with a task?")}</Text>
              <Text style={styles.ctaSubtitle}>{tr("Post a gig in minutes and connect with skilled local people.")}</Text>
            </View>
            <View style={styles.ctaButtonsRow}>
              <Pressable style={({ pressed }) => [styles.postGigButton, pressed && styles.pressed]} onPress={tap(goPostGig)} accessibilityRole="button">
                <Ionicons name="add" size={20} color={colors.primaryOnColor} />
                <Text style={styles.postGigButtonText}>{tr("Post a gig")}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.manageGigsButton, pressed && styles.pressed]} onPress={tap(goMyGigs)} accessibilityRole="button">
                <Text style={styles.manageGigsButtonText}>{tr("My Gigs ({{count}})", { count: gigs.length })}</Text>
              </Pressable>
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

        {/* Applications & Gigs Spotlight (Youth Freelancer) */}
        {!isClient && myApplications.length > 0 && (
          <View style={styles.acceptedSectionContainer}>
            <View style={styles.acceptedSectionHeader}>
              <View style={styles.acceptedTitleRow}>
                <Ionicons
                  name={acceptedApplications.length > 0 ? 'checkmark-circle' : 'document-text'}
                  size={20}
                  color={acceptedApplications.length > 0 ? colors.success : colors.primary}
                />
                <Text style={styles.acceptedSectionTitle}>
                  {acceptedApplications.length > 0
                    ? `${tr("Accepted Gigs")} (${acceptedApplications.length})`
                    : `${tr("My Applications")} (${myApplications.length})`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(app)/applications' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.75}
              >
                <Text style={styles.acceptedViewAllText}>{tr("View All")} ({myApplications.length}) →</Text>
              </TouchableOpacity>
            </View>

            {spotlightApplications.slice(0, 3).map((app: Application) => {
              const isAccepted = (app.status || '').toLowerCase() === 'accepted';
              const isCompleted = (app.status || '').toLowerCase() === 'completed';
              const hasReviewed = !!reviewedGigIds[app.gigId];
              return (
                <View key={app.id} style={styles.acceptedGigCard}>
                  <View style={styles.acceptedCardTopRow}>
                    <View style={[
                      styles.acceptedStatusBadge,
                      isCompleted ? { backgroundColor: colors.successLight, borderColor: colors.successBorder } :
                      !isAccepted ? { backgroundColor: colors.warningLight, borderColor: colors.warningBorder } : null,
                    ]}>
                      <Ionicons
                        name={isCompleted ? 'checkmark-circle' : isAccepted ? 'sparkles' : 'time-outline'}
                        size={13}
                        color={isCompleted ? colors.success : isAccepted ? colors.success : colors.warning}
                      />
                      <Text style={[styles.acceptedStatusText, !isAccepted && !isCompleted && { color: colors.warning }]}>
                        {isCompleted ? tr("Completed 🎉") : isAccepted ? tr("Application Accepted! 🎉") : tr("Pending")}
                      </Text>
                    </View>
                    {app.gigPay ? (
                      <Text style={styles.acceptedPayText}>
                        ${app.gigPay}{app.gigPayType === 'hourly' ? tr('/hr') : tr(' fixed')}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={styles.acceptedGigTitle} numberOfLines={1}>
                    {app.gigTitle || tr("Gig Title")}
                  </Text>

                  <View style={styles.acceptedBusinessRow}>
                    <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.acceptedBusinessText} numberOfLines={1}>
                      {app.businessName || tr("Business Owner")}
                    </Text>
                    {app.gigLocation ? (
                      <>
                        <Text style={styles.acceptedDot}>•</Text>
                        <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.acceptedLocationText} numberOfLines={1}>
                          {app.gigLocation}
                        </Text>
                      </>
                    ) : null}
                  </View>

                  <View style={styles.acceptedActionsRow}>
                    {isAccepted || isCompleted ? (
                      <TouchableOpacity
                        style={styles.acceptedChatBtn}
                        onPress={() => {
                          const convId = app.conversationId || `conv_${app.id}`;
                          router.push({
                            pathname: '/(app)/chat/[id]',
                            params: { id: convId },
                          } as any);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="chatbubbles" size={15} color={colors.primaryOnColor} />
                        <Text style={styles.acceptedChatBtnText}>{tr("Message Client")}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.acceptedChatBtn}
                        onPress={() => router.push('/(app)/applications' as any)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-text-outline" size={15} color={colors.primaryOnColor} />
                        <Text style={styles.acceptedChatBtnText}>{tr("View my application")}</Text>
                      </TouchableOpacity>
                    )}

                    {(isAccepted || isCompleted) && (
                      hasReviewed ? (
                        <View style={styles.acceptedRatedBadge}>
                          <Ionicons name="star" size={13} color={colors.star} />
                          <Text style={styles.acceptedRatedBadgeText}>{tr("Rated ★")}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.acceptedRateBtn}
                          onPress={() => handleRateClient(app)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="star-outline" size={14} color={colors.warning} />
                          <Text style={styles.acceptedRateBtnText}>{tr("Rate Client")}</Text>
                        </TouchableOpacity>
                      )
                    )}

                    <TouchableOpacity
                      style={styles.acceptedDetailsBtn}
                      onPress={() => {
                        if (app.gigId) {
                          router.push({
                            pathname: '/(app)/gig/[id]',
                            params: { id: app.gigId },
                          });
                        } else {
                          router.push('/(app)/applications' as any);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.acceptedDetailsBtnText}>{tr("Gig Details")}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Hired gigs (Business Owner) */}
        {isClient && inProgressGigs.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{tr("Hired gigs ({{count}})", { count: inProgressGigs.length })}</Text>
              <Pressable onPress={goMyGigs} accessibilityRole="button" hitSlop={12}>
                <Text style={styles.seeAllText}>{tr("Manage")}</Text>
              </Pressable>
            </View>
            <View style={styles.gigsList}>
              {inProgressGigs.map((gig) => (
                <HiredGigCard
                  key={gig.id}
                  gig={gig}
                  calendarState={calendarAddingGigId === gig.id ? 'adding' : calendarAddedGigIds[gig.id] ? 'added' : 'idle'}
                  reviewed={!!reviewedGigIds[gig.id]}
                  onOpen={openGig}
                  onMessage={handleMessageAssignedFreelancer}
                  onCalendar={handleAddToCalendar}
                  onComplete={handleCompleteGig}
                  onRate={handleRateFreelancer}
                />
              ))}
            </View>
          </View>
        )}

        {/* Part 2: Your Open Listings (Business Owner) / Explore Latest Gigs (Freelancer) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isClient ? tr("Your Open Listings") : tr("Explore Latest Gigs")}
            </Text>
            <TouchableOpacity
              onPress={isClient ? goMyGigs : goBrowse}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.seeAllText}>
                {isClient ? tr("Manage All ({{count}})", { count: openGigs.length }) : tr("Browse All")} →
              </Text>
            </TouchableOpacity>
          </View>

          {loadingGigs && user ? (
            <SkeletonList variant="gig" count={3} />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={() => setLoadAttempt((n) => n + 1)} />
          ) : isClient && openGigs.length === 0 && inProgressGigs.length > 0 ? (
            <EmptyState
              icon="sparkles-outline"
              title="Every gig has someone working on it"
              description={tr("Post a new gig whenever you need more help.")}
              actionLabel="Post a gig"
              actionIcon="add"
              onAction={goPostGig}
            />
          ) : (isClient ? openGigs : gigs).length === 0 ? (
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
              {(isClient ? openGigs : gigs).map((gig) => (
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

      {selectedGigForApply && user && (
        <ApplyModal
          visible={Boolean(selectedGigForApply)}
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
            toast.success(tr("Application Submitted! 🎉"), tr("Your application has been sent to the business owner."));
            if (user && appliedGig) {
              setMyApplications((prev) => [
                {
                  id: `app_${appliedGig.id}_${user.uid}`,
                  gigId: appliedGig.id,
                  youthId: user.uid,
                  gigTitle: appliedGig.title,
                  gigLocation: appliedGig.location,
                  gigPay: appliedGig.pay,
                  gigPayType: appliedGig.payType,
                  businessName: appliedGig.postedBy?.fullName || 'Business Owner',
                  status: 'pending',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                } as any,
                ...prev.filter((a) => a.gigId !== appliedGig.id),
              ]);
            }
          }}
        />
      )}

      {selectedGigForApplicants && (
        <ApplicantListModal
          visible={Boolean(selectedGigForApplicants)}
          gigId={selectedGigForApplicants.id}
          gigTitle={selectedGigForApplicants.title}
          businessId={user?.uid || ''}
          gigDate={selectedGigForApplicants.date}
          gigTime={selectedGigForApplicants.time}
          gigLocation={selectedGigForApplicants.location}
          gigPay={selectedGigForApplicants.pay}
          gigPayType={selectedGigForApplicants.payType}
          onClose={() => setSelectedGigForApplicants(null)}
        />
      )}

      <ConfirmSheet
        visible={!!confirmAction}
        destructive={confirmAction?.kind === 'delete'}
        icon={confirmAction?.kind === 'delete' ? 'trash-outline' : 'checkmark-done-outline'}
        title={confirmAction?.kind === 'delete' ? 'Delete Gig' : 'Mark as Completed'}
        message={confirmAction?.kind === 'delete'
          ? tr("Are you sure you want to remove \"{{value0}}\"? This cannot be undone.", { value0: confirmAction.gig.title })
          : confirmAction ? tr("Are you sure you want to mark \"{{value0}}\" as completed? You can then rate and review the freelancer.", { value0: confirmAction.gig.title }) : undefined}
        confirmLabel={confirmAction?.kind === 'delete' ? 'Delete' : 'Complete Gig'}
        loading={confirmBusy}
        error={confirmError}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
      {ratingTarget && (
        <RatingModal
          visible={Boolean(ratingTarget)}
          targetUserId={ratingTarget.userId}
          targetUserName={ratingTarget.userName}
          targetUserPhotoURL={ratingTarget.userPhotoURL}
          targetRole={ratingTarget.targetRole || (isClient ? 'freelancer' : 'client')}
          gigId={ratingTarget.gigId}
          gigTitle={ratingTarget.gigTitle}
          onClose={() => setRatingTarget(null)}
          onSuccess={() => {
            if (ratingTarget?.gigId) {
              setReviewedGigIds((prev) => ({ ...prev, [ratingTarget.gigId]: true }));
            }
            setRatingTarget(null);
            toast.success(tr("Review Submitted! 🌟"), tr("Thank you for sharing your feedback."));
          }}
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
    fontSize: 12,
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
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  ctaCopy: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
  ctaTitle: {
    ...typography.h2,
    color: colors.text,
  },
  ctaSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
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
  appliedAction: {
    flex: 1.2,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.md,
  },
  appliedActionText: {
    ...typography.label,
    fontSize: 14,
    color: colors.success,
  },
  chatAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md,
  },
  acceptedSectionContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  acceptedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  acceptedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceptedSectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.success,
  },
  acceptedViewAllText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  acceptedGigCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.successBorder,
    marginBottom: spacing.sm,
  },
  acceptedCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  acceptedStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  acceptedStatusText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.success,
  },
  acceptedPayText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.success,
  },
  acceptedGigTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    marginBottom: 4,
  },
  acceptedBusinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
  },
  acceptedBusinessText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  acceptedDot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  acceptedLocationText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.textMuted,
  },
  acceptedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  acceptedChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  acceptedChatBtnText: {
    color: colors.primaryOnColor,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  acceptedDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
  },
  acceptedDetailsBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  acceptedRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
  },
  acceptedRateBtnText: {
    color: colors.warning,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  acceptedRatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
  },
  acceptedRatedBadgeText: {
    color: colors.warning,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
  },

  // Active in-progress gigs (Business Owner)
});
