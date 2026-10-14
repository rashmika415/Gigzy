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
import { colors, spacing, borderRadius, fonts, typography } from '../../../constants/theme';
import { formatNumber } from '../../../localization/format';
import { subscribeToClientGigs, subscribeToRecentGigs, deleteGig, updateGigStatus } from '../../../services/gigService';
import { subscribeToUserChats, getOrCreateChat } from '../../../services/chatService';
import { subscribeToMyApplications, getApplicantsForGig } from '../../../services/applicationService';
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
import { ApplicantListModal, ApplicationCard, ApplicationDetailModal } from '../../../components/applications';
import { RatingModal } from '../../../components/reviews';
import { ReportModal } from '../../../components/reports';
import { isHiredStatus, uidOf } from '../../../components/applications/ApplicationCard';
import { hasUserReviewedGig } from '../../../services/reviewService';
import ConfirmSheet from '../../../components/ConfirmSheet';
import BusinessGigActions from '../../../components/business/BusinessGigActions';
import HiredGigCard from '../../../components/business/HiredGigCard';

const openGig = (gig: Gig) => router.push({ pathname: '/(app)/gig/[id]', params: { id: gig.id } });

/** The hired freelancer: from the gig itself, or from the accepted application when older gigs lack it. */
async function resolveHiredYouth(gig: Gig): Promise<{ id: string; name?: string; photoURL?: string } | null> {
  if (gig.assignedYouthId) return { id: gig.assignedYouthId, name: gig.assignedYouthName, photoURL: gig.assignedYouthPhotoURL };
  if (!gig.id) return null;
  try {
    const accepted = (await getApplicantsForGig(gig.id, gig.postedBy?.uid)).find(app => isHiredStatus(app.status));
    const id = accepted ? uidOf(accepted.youthId) : '';
    return id ? { id, name: gig.assignedYouthName || accepted!.youthName, photoURL: gig.assignedYouthPhotoURL || accepted!.youthPhotoURL } : null;
  } catch {
    return null;
  }
}

export default function Home() {
  useTranslation();
  const { user, userData } = useAuth();
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
  const [appsError, setAppsError] = useState('');
  const [appsAttempt, setAppsAttempt] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
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
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'user' | 'gig';
    targetId: string;
    targetUserId?: string;
    targetUserName?: string;
    targetGigId: string;
    targetGigTitle: string;
  } | null>(null);

  const totalApplicants = useMemo(
    () => gigs.reduce((acc, g) => acc + (g.applicantsCount || 0), 0),
    [gigs]
  );

  const acceptedApplications = useMemo(
    () => myApplications.filter((app) => app.status === 'accepted' || app.status === 'completed'),
    [myApplications]
  );

  const inProgressGigs = useMemo(
    () => (isClient ? gigs.filter((g) => g.status === 'in-progress' || g.status === 'completed' || !!g.assignedYouthId) : []),
    [gigs, isClient]
  );

  const spotlightApplications = useMemo(() => {
    const priority: Record<string, number> = { accepted: 3, pending: 2, completed: 1 };
    return myApplications
      .filter((app) => priority[app.status])
      .sort((a, b) => priority[b.status] - priority[a.status]);
  }, [myApplications]);

  const openGigs = useMemo(
    () => gigs.filter((g) => g.status === 'open' || !g.status).slice(0, isClient ? undefined : 10),
    [gigs, isClient]
  );

  // Real-time synchronization of youth applications
  useEffect(() => {
    if (!user || isClient) return;
    return subscribeToMyApplications(
      user.uid,
      (apps) => { setMyApplications(apps); setAppsError(''); },
      (err) => setAppsError(err.message || 'Failed to load applications.')
    );
  }, [user, isClient, appsAttempt]);

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
          const hired = await resolveHiredYouth(gig);
          if (hired && gig.id) {
            try {
              const reviewed = await hasUserReviewedGig(user.uid, hired.id, gig.id);
              if (reviewed) results[gig.id] = true;
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
  }, [user, isClient, inProgressGigs]);

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
        30,
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

  const handleRateFreelancer = async (gig: Gig) => {
    const hired = await resolveHiredYouth(gig);
    if (!hired) {
      toast.info(tr("Freelancer information unavailable."));
      return;
    }
    setRatingTarget({
      userId: hired.id,
      userName: hired.name || tr("Youth Freelancer"),
      userPhotoURL: hired.photoURL,
      targetRole: 'freelancer',
      gigId: gig.id,
      gigTitle: gig.title,
    });
  };

  const handleReportGig = async (gig: Gig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const hired = await resolveHiredYouth(gig);
    setReportTarget(hired
      ? { targetType: 'user', targetId: hired.id, targetUserId: hired.id, targetUserName: hired.name || tr("Assigned Freelancer"), targetGigId: gig.id, targetGigTitle: gig.title }
      : { targetType: 'gig', targetId: gig.id, targetGigId: gig.id, targetGigTitle: gig.title });
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

        {/* My applications (Youth Freelancer) */}
        {!isClient && (spotlightApplications.length > 0 || !!appsError) && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{tr("My Applications")}</Text>
              <Pressable onPress={() => router.push('/(app)/applications' as any)} accessibilityRole="button" hitSlop={12}>
                <Text style={styles.seeAllText}>{tr("See all ({{count}})", { count: myApplications.length })}</Text>
              </Pressable>
            </View>
            {appsError ? (
              <Pressable onPress={() => setAppsAttempt((n) => n + 1)} accessibilityRole="button"
                style={({ pressed }) => [styles.inlineError, pressed && styles.pressed]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={styles.inlineErrorText}>{tr("Couldn't load your applications.")}</Text>
                <Text style={styles.inlineErrorAction}>{tr("Retry")}</Text>
              </Pressable>
            ) : spotlightApplications.slice(0, 3).map((app) => (
              <ApplicationCard key={app.id} application={app} onPress={() => setSelectedApplication(app)} />
            ))}
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
                  onReport={handleReportGig}
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
          ) : openGigs.length === 0 ? (
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
              {openGigs.map((gig) => (
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

      {!isClient && (
        <ApplicationDetailModal
          visible={!!selectedApplication}
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
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
          }}
        />
      )}

      {reportTarget && (
        <ReportModal
          visible
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          targetUserId={reportTarget.targetUserId}
          targetUserName={reportTarget.targetUserName}
          targetGigId={reportTarget.targetGigId}
          targetGigTitle={reportTarget.targetGigTitle}
          onClose={() => setReportTarget(null)}
          onSuccess={() => setReportTarget(null)}
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
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  inlineErrorText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
  },
  inlineErrorAction: {
    ...typography.label,
    color: colors.error,
  },
});
