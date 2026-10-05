import { formatNumber } from '../../../localization/format';
import { Text } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import AppBanner, { AppPhoto } from '../../../components/AppBanner';
import React, { useEffect, useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../FirebaseConfig';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../../constants/theme';
import { subscribeToClientGigs, subscribeToRecentGigs, deleteGig, deduplicateGigs } from '../../../services/gigService';
import { subscribeToUserChats, getOrCreateChat } from '../../../services/chatService';
import { Gig } from '../../../types/gig';
import { subscribeToNotifications, sendNotification } from '../../../services/notificationService';
import {
  subscribeToMyApplications,
  subscribeToBusinessApplications,
  acceptApplication,
  rejectApplication,
} from '../../../services/applicationService';
import type { Application } from '../../../types/application';
import { ApplicantDetailModal, CelebrationModal } from '../../../components/applications';

export default function Home() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const firstName = userData?.fullName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'there';
  const role = userData?.role ?? 'freelancer';
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loadingGigs, setLoadingGigs] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [startingChatGigId, setStartingChatGigId] = useState<string | null>(null);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [acceptedApplications, setAcceptedApplications] = useState<Application[]>([]);
  const [businessApplications, setBusinessApplications] = useState<Application[]>([]);
  const [selectedApplicantForDetail, setSelectedApplicantForDetail] = useState<Application | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [celebrationDialog, setCelebrationDialog] = useState<{
    visible: boolean;
    youthName: string;
    gigTitle: string;
  } | null>(null);

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

  const isInitialNotifLoadRef = useRef(true);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, (items) => {
      const unread = items.filter((item) => !item.read);
      setUnreadNotificationCount(unread.length);

      // Alert youth on their dashboard when an application is accepted
      if (role !== 'client') {
        if (isInitialNotifLoadRef.current) {
          isInitialNotifLoadRef.current = false;
          // Check if there is an unread accepted notification on launch
          const recentAccepted = unread.find(
            (n) => n.type === 'application' && n.title?.includes('Accepted')
          );
          if (recentAccepted && !seenNotifIdsRef.current.has(recentAccepted.id)) {
            seenNotifIdsRef.current.add(recentAccepted.id);
            Alert.alert(
              recentAccepted.title,
              recentAccepted.body,
              [
                {
                  text: t("View Gig"),
                  onPress: () => {
                    if (recentAccepted.route) {
                      router.push(recentAccepted.route as any);
                    }
                  },
                },
                { text: t("OK"), style: "cancel" },
              ]
            );
          }
          items.forEach((item) => seenNotifIdsRef.current.add(item.id));
        } else {
          // Check for newly arrived accepted application notification in real-time
          const newAcceptedNotif = unread.find(
            (n) => n.type === 'application' && n.title?.includes('Accepted') && !seenNotifIdsRef.current.has(n.id)
          );

          if (newAcceptedNotif) {
            seenNotifIdsRef.current.add(newAcceptedNotif.id);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
            Alert.alert(
              newAcceptedNotif.title,
              newAcceptedNotif.body,
              [
                {
                  text: t("View Gig"),
                  onPress: () => {
                    if (newAcceptedNotif.route) {
                      router.push(newAcceptedNotif.route as any);
                    }
                  },
                },
                { text: t("OK"), style: "cancel" },
              ]
            );
          }
          items.forEach((item) => seenNotifIdsRef.current.add(item.id));
        }
      }
    }, () => {});
  }, [user, role, t]);

  const notifiedAppIdsRef = useRef<Set<string>>(new Set());

  // Real-time listener for youth's applications
  useEffect(() => {
    if (!user || role === 'client') {
      setMyApplications([]);
      setAcceptedApplications([]);
      return;
    }

    const unsub = subscribeToMyApplications(
      user.uid,
      (apps) => {
        setMyApplications(apps);
      },
      () => {}
    );
    return () => unsub();
  }, [user, role]);

  // Real-time listener for business owner's received applications across all gigs
  useEffect(() => {
    if (!user || role !== 'client') {
      setBusinessApplications([]);
      return;
    }

    const unsub = subscribeToBusinessApplications(
      user.uid,
      (apps) => {
        setBusinessApplications(apps);
      },
      (err) => {
        console.warn('Error syncing business applications:', err);
      }
    );
    return () => unsub();
  }, [user, role]);

  // Deduplicate gigs across all views
  const uniqueGigs = useMemo(() => deduplicateGigs(gigs), [gigs]);

  // Deduplicate accepted applications so each gig appears at most once
  const uniqueAcceptedApplications = useMemo(() => {
    const seenGigIds = new Set<string>();
    return acceptedApplications.filter((app) => {
      const key = app.gigId || app.id;
      if (seenGigIds.has(key)) return false;
      seenGigIds.add(key);
      return true;
    });
  }, [acceptedApplications]);

  // Set of gig IDs the youth freelancer has already applied for
  const appliedGigIds = useMemo(() => {
    return new Set(myApplications.map((app) => app.gigId).filter(Boolean));
  }, [myApplications]);

  // Gigs displayed in the Explore Latest Gigs / Your Posted Gigs section:
  // - Business owners see their posted unique gigs
  // - Youth freelancers: automatically removes all gigs they have already applied for!
  const displayedGigs = useMemo(() => {
    if (role === 'client') {
      return uniqueGigs;
    }
    return uniqueGigs.filter((gig) => !appliedGigIds.has(gig.id));
  }, [uniqueGigs, role, appliedGigIds]);

  const pendingApplications = useMemo(() => {
    const seenYouthGigPairs = new Set<string>();
    // Exclude gigs that are already accepted, in-progress, completed, or have an assigned youth (one youth can't accept twice for gig)
    const assignedGigIds = new Set<string>(
      uniqueGigs
        .filter(
          (g) =>
            g.status === 'in-progress' ||
            g.status === 'completed' ||
            g.status === 'filled' ||
            Boolean(g.assignedYouthId)
        )
        .map((g) => g.id)
    );

    return businessApplications.filter((app) => {
      const isPending = (app.status || '').toLowerCase() === 'pending';
      if (!isPending) return false;

      // If this gig is already in progress / assigned, it cannot accept another applicant
      if (app.gigId && assignedGigIds.has(app.gigId)) {
        return false;
      }

      // A youth cannot appear twice for the same gig
      const pairKey = `${app.gigId}_${app.youthId}`;
      if (seenYouthGigPairs.has(pairKey)) {
        return false;
      }
      seenYouthGigPairs.add(pairKey);

      return true;
    });
  }, [businessApplications, uniqueGigs]);

  // Real-time calculation and cross-referencing of accepted applications
  useEffect(() => {
    if (!user || role === 'client') {
      setAcceptedApplications([]);
      return;
    }

    const currentUserId = user.uid;
    let isMounted = true;

    async function evaluateAcceptedGigs() {
      if (myApplications.length === 0) {
        if (isMounted) setAcceptedApplications([]);
        return;
      }

      const directlyAccepted = myApplications.filter((a) => {
        const st = (a.status || '').toLowerCase();
        return st === 'accepted' || st === 'approved';
      });

      const acceptedAppIds = new Set(directlyAccepted.map((a) => a.id));
      const additionalAccepted: Application[] = [];

      for (const app of myApplications) {
        if (acceptedAppIds.has(app.id)) continue;

        let gigStatus = '';
        let gigData: any = null;

        const matchingGig = gigs.find((g) => g.id === app.gigId);
        if (matchingGig) {
          gigStatus = matchingGig.status;
          gigData = matchingGig;
        } else if (app.gigId) {
          try {
            const gSnap = await getDoc(doc(db, 'gigs', app.gigId));
            if (gSnap.exists()) {
              gigData = gSnap.data();
              gigStatus = gigData.status;
            }
          } catch {}
        }

        if (gigStatus === 'in-progress' || gigStatus === 'filled' || gigData?.assignedYouthId === currentUserId) {
          const acceptedApp: Application = {
            ...app,
            status: 'accepted',
            gigTitle: app.gigTitle || gigData?.title || 'Gig',
            businessName: app.businessName || gigData?.postedBy?.fullName || 'Business Owner',
            gigPay: app.gigPay !== undefined ? app.gigPay : (gigData?.pay ?? null),
            gigPayType: app.gigPayType || gigData?.payType || 'fixed',
            gigLocation: app.gigLocation || gigData?.location || '',
          };
          additionalAccepted.push(acceptedApp);
          acceptedAppIds.add(app.id);

          // Dispatch in-app notification to youth if not already notified in this session
          if (!notifiedAppIdsRef.current.has(app.id)) {
            notifiedAppIdsRef.current.add(app.id);
            try {
              await sendNotification(currentUserId, {
                userId: currentUserId,
                type: 'application',
                title: 'Application Accepted! 🎉',
                body: `Congratulations! Your application for "${acceptedApp.gigTitle}" was accepted. The gig is now in progress.`,
                read: false,
                route: `/(app)/gig/${app.gigId}`,
                entityId: app.id,
              });
            } catch {}
          }
        }
      }

      if (isMounted) {
        setAcceptedApplications([...directlyAccepted, ...additionalAccepted]);
      }
    }

    void evaluateAcceptedGigs();

    return () => {
      isMounted = false;
    };
  }, [user, role, myApplications, gigs]);

  // Real-time Firestore synchronization
  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    let unsubscribe: () => void = () => {};
    void Promise.resolve().then(() => {
    if (!active) return;
    setLoadingGigs(true);
    setLoadError('');

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

    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, role]);

  const handleDeleteGig = (gigId: string, gigTitle: string) => {
    Alert.alert(
      t("Delete Gig"),
      t("Are you sure you want to remove \"{{value0}}\"? This cannot be undone.", { value0: gigTitle }),
      [
        { text: t("Cancel"), style: 'cancel' },
        {
          text: t("Delete"),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGig(gigId);
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}
            } catch (err: any) {
              Alert.alert(t("Error"), err.message || t("Failed to delete gig."));
            }
          },
        },
      ]
    );
  };

  const handleContactBusiness = async (gig: Gig) => {
    if (!user) {
      Alert.alert(t("Sign In Required"), t("Please sign in to contact the gig author."));
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
      Alert.alert(t("Chat Error"), err.message || t("Failed to start conversation."));
    } finally {
      setStartingChatGigId(null);
    }
  };

  const handleChatForApplication = async (app: Application) => {
    if (!user) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setStartingChatGigId(app.gigId);

    try {
      const currentParticipant = {
        uid: user.uid,
        fullName: userData?.fullName || user.displayName || 'Freelancer',
        photoURL: userData?.photoURL || '',
        role: (userData?.role as any) || 'freelancer',
        email: user.email || '',
      };

      const businessParticipant = {
        uid: app.businessId,
        fullName: app.businessName || 'Business Owner',
        photoURL: '',
        role: 'client' as const,
        email: '',
      };

      const gigObj: Partial<Gig> = {
        id: app.gigId,
        title: app.gigTitle || 'Gig',
        pay: app.gigPay || 0,
        payType: app.gigPayType || 'fixed',
        location: app.gigLocation || '',
        postedBy: {
          uid: app.businessId,
          fullName: app.businessName || 'Business Owner',
          email: '',
        },
      };

      const chat = await getOrCreateChat(currentParticipant, businessParticipant, gigObj as Gig);
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: chat.id },
      } as any);
    } catch (err: any) {
      Alert.alert(t("Chat Error"), err.message || t("Failed to start conversation."));
    } finally {
      setStartingChatGigId(null);
    }
  };

  const handleAcceptApplicant = async (app: Application) => {
    if (!user) return;
    setActionLoadingId(app.id);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      // Immediately remove the card from dashboard's Applicants Awaiting Review
      setBusinessApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'accepted' } : a))
      );

      // Optimistically update gig status to in-progress with assigned youth
      if (app.gigId) {
        setGigs((prev) =>
          prev.map((g) =>
            g.id === app.gigId
              ? { ...g, status: 'in-progress', assignedYouthId: app.youthId }
              : g
          )
        );
      }

      await acceptApplication(app.id, user.uid);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // A celebration message dialog appears on the business owner's screen:
      // Application Accepted! 🎉
      // "You have accepted {Youth Name} for '{Gig Title}'. Work is now in progress and a notification has been sent to the youth freelancer's dashboard."
      setCelebrationDialog({
        visible: true,
        youthName: app.youthName || 'Youth Freelancer',
        gigTitle: app.gigTitle || 'Gig',
      });
    } catch (err: any) {
      // Revert if error
      setBusinessApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'pending' } : a))
      );
      if (app.gigId) {
        setGigs((prev) =>
          prev.map((g) =>
            g.id === app.gigId
              ? { ...g, status: 'open', assignedYouthId: undefined }
              : g
          )
        );
      }
      Alert.alert(t("Action Notice"), err.message || t("Failed to accept applicant."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectApplicant = async (app: Application) => {
    if (!user) return;
    setActionLoadingId(app.id);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      // Immediately remove the card from dashboard's Applicants Awaiting Review
      setBusinessApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'rejected' } : a))
      );

      await rejectApplication(app.id, user.uid);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      Alert.alert(
        t("Application Declined"),
        t("The application from {{name}} for \"{{title}}\" has been declined.", {
          name: app.youthName || t("this applicant"),
          title: app.gigTitle || t("the gig"),
        })
      );
    } catch (err: any) {
      // Revert if error
      setBusinessApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'pending' } : a))
      );
      Alert.alert(t("Error"), err.message || t("Failed to decline applicant."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChatWithApplicant = async (app: Application) => {
    if (!user) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setStartingChatGigId(app.gigId);

    try {
      const currentParticipant = {
        uid: user.uid,
        fullName: userData?.fullName || user.displayName || 'Business Owner',
        photoURL: userData?.photoURL || '',
        role: 'client' as const,
        email: user.email || '',
      };

      const youthParticipant = {
        uid: app.youthId,
        fullName: app.youthName || 'Youth Freelancer',
        photoURL: app.youthPhotoURL || '',
        role: 'freelancer' as const,
        email: '',
      };

      const gigObj: Partial<Gig> = {
        id: app.gigId,
        title: app.gigTitle || 'Gig',
        pay: app.gigPay || 0,
        payType: app.gigPayType || 'fixed',
        location: app.gigLocation || '',
        postedBy: {
          uid: user.uid,
          fullName: userData?.fullName || 'Business Owner',
          email: user.email || '',
        },
      };

      const chat = await getOrCreateChat(currentParticipant, youthParticipant, gigObj as Gig);
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: chat.id },
      } as any);
    } catch (err: any) {
      Alert.alert(t("Chat Error"), err.message || t("Failed to start conversation."));
    } finally {
      setStartingChatGigId(null);
    }
  };

  const formatApplicantDate = (timestamp: any) => {
    if (!timestamp) return t("Recently");
    const date = timestamp?.toDate
      ? timestamp.toDate()
      : timestamp?.toMillis
      ? new Date(timestamp.toMillis())
      : new Date(timestamp);
    if (isNaN(date.getTime())) return t("Recently");
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleLabel = () => {
    if (role === 'admin') return 'Platform Admin';
    if (role === 'client') return 'Business Owner';
    return 'Youth (Freelancer)';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerGreetingBlock}>
            <Text style={styles.greeting}>{t("Hello,")}{firstName}!</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.roleLabel}>{t(getRoleLabel())}</Text>
            </Text>
          </View>

          <View style={styles.headerActionsRight}>
            <TouchableOpacity
              style={styles.messagesHeaderBtn}
              onPress={() => router.push('/(app)/notifications' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.primary} />
              {unreadNotificationCount > 0 && (
                <View style={styles.headerBadgePill}><Text style={styles.headerBadgeText}>{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</Text></View>
              )}
            </TouchableOpacity>
            {/* Messages inbox button */}
            <TouchableOpacity
              style={styles.messagesHeaderBtn}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                router.push('/(app)/(tabs)/messages' as any);
              }}
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
              activeOpacity={0.8}
            >
              {userData?.photoURL && failedPhoto !== userData.photoURL ? (
                <Image
                  source={{ uri: userData.photoURL }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => setFailedPhoto(userData.photoURL ?? null)}
                />
              ) : <Text style={styles.avatarText}>
                {(firstName?.[0] ?? '?').toUpperCase()}
              </Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Business Owner / Post Gig CTA Banner — only visible to clients */}
        {role !== 'client' && <AppBanner kind="youth" title={t("Your next opportunity starts here.")} description={t("Find local gigs that fit your skills and your schedule.")} action="Explore gigs" onPress={() => router.push('/(app)/(tabs)/browse')} />}

        {/* Youth Accepted Gigs Spotlight — displays when business owner accepts an application */}
        {role !== 'client' && uniqueAcceptedApplications.length > 0 && (
          <View style={styles.acceptedSectionContainer}>
            <View style={styles.acceptedSectionHeader}>
              <View style={styles.acceptedTitleRow}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                <Text style={styles.acceptedSectionTitle}>
                  {t("Accepted Gigs")} ({uniqueAcceptedApplications.length})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(app)/applications' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.acceptedViewAllText}>{t("View All")} →</Text>
              </TouchableOpacity>
            </View>

            {uniqueAcceptedApplications.map((app) => (
              <View key={app.id} style={styles.acceptedGigCard}>
                <View style={styles.acceptedCardTopRow}>
                  <View style={styles.acceptedStatusBadge}>
                    <Ionicons name="sparkles" size={12} color="#059669" />
                    <Text style={styles.acceptedStatusText}>{t("Application Accepted!")}</Text>
                  </View>
                  {app.gigPay ? (
                    <Text style={styles.acceptedPayText}>
                      ${app.gigPay}{app.gigPayType === 'hourly' ? '/hr' : ' fixed'}
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.acceptedGigTitle} numberOfLines={1}>
                  {app.gigTitle || t("Gig Title")}
                </Text>

                <View style={styles.acceptedBusinessRow}>
                  <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.acceptedBusinessText} numberOfLines={1}>
                    {app.businessName || t("Business Owner")}
                  </Text>
                  {app.gigLocation ? (
                    <>
                      <Text style={styles.acceptedDot}>•</Text>
                      <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.acceptedLocationText} numberOfLines={1}>
                        {app.gigLocation}
                      </Text>
                    </>
                  ) : null}
                </View>

                <View style={styles.acceptedActionsRow}>
                  <TouchableOpacity
                    style={styles.acceptedChatBtn}
                    onPress={() => handleChatForApplication(app)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color={colors.primaryOnColor} />
                    <Text style={styles.acceptedChatBtnText}>{t("Message Business")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.acceptedDetailsBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/gig/[id]',
                        params: { id: app.gigId },
                      } as any)
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                    <Text style={styles.acceptedDetailsBtnText}>{t("View Gig")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {role === 'client' && (
        <View style={styles.ctaCard}>
          <View style={{ marginBottom: spacing.md }}><AppPhoto kind="business" /></View>
          <View style={styles.ctaBadge}>
            <Ionicons name="flash" size={14} color={colors.primaryOnColor} />
            <Text style={styles.ctaBadgeText}>{t("FOR BUSINESS OWNERS")}</Text>
          </View>
          <Text style={styles.ctaTitle}>{t("Need Help with a Task?")}</Text>
          <Text style={styles.ctaSubtitle}>{t("Post a new gig in minutes and connect with local skilled youth and talented freelancers.")}</Text>

          <View style={styles.ctaButtonsRow}>
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
              <Ionicons name="add-circle-outline" size={20} color={colors.primaryOnColor} />
              <Text style={styles.postGigButtonText}>{t("Post New Gig")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manageGigsButton}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                router.push('/(app)/(tabs)/my-gigs' as any);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="list-outline" size={18} color={colors.primary} />
              <Text style={styles.manageGigsButtonText}>{t("My Posted Gigs (")}{uniqueGigs.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Business Owner Incoming Applicants Spotlight — displays in real-time when youth apply */}
        {role === 'client' && pendingApplications.length > 0 && (
          <View style={styles.applicantSectionContainer}>
            <View style={styles.applicantSectionHeader}>
              <View style={styles.applicantTitleRow}>
                <View style={styles.applicantHeaderIconWrap}>
                  <Ionicons name="people" size={17} color={colors.primary} />
                </View>
                <Text style={styles.applicantSectionTitle}>
                  {t("Applicants Awaiting Review")}
                </Text>
                <View style={styles.applicantPendingBadge}>
                  <View style={styles.applicantPendingDot} />
                  <Text style={styles.applicantPendingBadgeText}>
                    {pendingApplications.length} {t("Action Required")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(app)/applications' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.applicantViewAllText}>{t("View All (")}{businessApplications.length}) →</Text>
              </TouchableOpacity>
            </View>

            {/* Display up to 3 pending applications (newest first) */}
            {pendingApplications
              .slice(0, 3)
              .map((app) => {
                const isPending = (app.status || '').toLowerCase() === 'pending';
                const isAccepted = (app.status || '').toLowerCase() === 'accepted' || (app.status || '').toLowerCase() === 'approved';
                const isActionLoading = actionLoadingId === app.id;
                const initial = (app.youthName?.[0] || 'Y').toUpperCase();

                return (
                  <TouchableOpacity
                    key={app.id}
                    style={[
                      styles.applicantCard,
                      isPending && styles.applicantCardPendingBorder,
                    ]}
                    activeOpacity={0.92}
                    onPress={() => setSelectedApplicantForDetail(app)}
                  >
                    {/* Top Row: Avatar, Youth Name, Gig title, Status Pill */}
                    <View style={styles.applicantCardTopRow}>
                      <View style={styles.applicantInfoLeft}>
                        {app.youthPhotoURL ? (
                          <Image source={{ uri: app.youthPhotoURL }} style={styles.applicantAvatar} />
                        ) : (
                          <View style={styles.applicantAvatarFallback}>
                            <Text style={styles.applicantAvatarText}>{initial}</Text>
                          </View>
                        )}
                        <View style={styles.applicantNameWrap}>
                          <Text style={styles.applicantYouthName} numberOfLines={1}>
                            {app.youthName || t("Youth Freelancer")}
                          </Text>
                          <View style={styles.applicantGigRow}>
                            <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                            <Text style={styles.applicantGigTitle} numberOfLines={1}>
                              {app.gigTitle || t("Gig")}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Status badge */}
                      <View
                        style={[
                          styles.applicantStatusPill,
                          isPending && styles.statusPillPending,
                          isAccepted && styles.statusPillAccepted,
                          !isPending && !isAccepted && styles.statusPillRejected,
                        ]}
                      >
                        <Ionicons
                          name={isPending ? "time-outline" : isAccepted ? "checkmark-circle" : "close-circle"}
                          size={12}
                          color={isPending ? "#B45309" : isAccepted ? "#059669" : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.applicantStatusPillText,
                            isPending && { color: "#B45309" },
                            isAccepted && { color: "#059669" },
                            !isPending && !isAccepted && { color: colors.textMuted },
                          ]}
                        >
                          {isPending ? t("Pending Review") : isAccepted ? t("Accepted") : t("Declined")}
                        </Text>
                      </View>
                    </View>

                    {/* Meta Row: Applied date, Compensation, Rating */}
                    <View style={styles.applicantMetaRow}>
                      <View style={styles.applicantDateRow}>
                        <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.applicantDateText}>
                          {t("Applied")} {formatApplicantDate(app.createdAt)}
                        </Text>
                      </View>

                      {app.gigPay ? (
                        <View style={styles.applicantPayRow}>
                          <Ionicons name="wallet-outline" size={12} color={colors.primary} />
                          <Text style={styles.applicantPayText}>
                            ${app.gigPay}{app.gigPayType === 'hourly' ? t("/hr") : t(" fixed")}
                          </Text>
                        </View>
                      ) : null}

                      {app.youthRatingAverage && app.youthRatingAverage > 0 ? (
                        <View style={styles.applicantRatingRow}>
                          <Ionicons name="star" size={11} color="#92400E" />
                          <Text style={styles.applicantRatingText}>
                            {app.youthRatingAverage.toFixed(1)}
                            {app.youthRatingCount ? ` (${app.youthRatingCount})` : ''}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Message Preview */}
                    {app.message ? (
                      <View style={styles.applicantMessageBubble}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.primary} style={{ marginTop: 1 }} />
                        <Text style={styles.applicantMessageText} numberOfLines={2}>
                          "{app.message}"
                        </Text>
                      </View>
                    ) : null}

                    {/* Action Buttons Row ("while he get action") */}
                    <View style={styles.applicantActionsRow}>
                      {isPending ? (
                        <>
                          <TouchableOpacity
                            style={[styles.applicantAcceptBtn, isActionLoading && styles.btnDisabled]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleAcceptApplicant(app);
                            }}
                            disabled={isActionLoading}
                            activeOpacity={0.85}
                          >
                            {isActionLoading ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.applicantAcceptBtnText}>{t("Accept")}</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.applicantDeclineBtn, isActionLoading && styles.btnDisabled]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleRejectApplicant(app);
                            }}
                            disabled={isActionLoading}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="close-circle-outline" size={15} color={colors.error} />
                            <Text style={styles.applicantDeclineBtnText}>{t("Decline")}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.applicantChatBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleChatWithApplicant(app);
                            }}
                            activeOpacity={0.85}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.applicantDetailsBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedApplicantForDetail(app);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.applicantDetailsBtnText}>{t("Review")}</Text>
                            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                          </TouchableOpacity>
                        </>
                      ) : isAccepted ? (
                        <>
                          <TouchableOpacity
                            style={styles.applicantChatBtnWide}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleChatWithApplicant(app);
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="chatbubbles-outline" size={16} color={colors.primaryOnColor} />
                            <Text style={styles.applicantChatBtnWideText}>{t("Message Freelancer")}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.applicantDetailsBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedApplicantForDetail(app);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.applicantDetailsBtnText}>{t("View Details")}</Text>
                            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.applicantDetailsBtnWide}
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedApplicantForDetail(app);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.applicantDetailsBtnText}>{t("View Application Details")}</Text>
                          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          {[
            {
              label: role === 'client' ? 'Gigs Posted' : 'Accepted Gigs',
              value: role === 'client' ? uniqueGigs.length.toString() : uniqueAcceptedApplications.length.toString(),
              emoji: role === 'client' ? '💼' : '🎉',
              onPress: role === 'client'
                ? () => router.push('/(app)/(tabs)/my-gigs' as any)
                : () => router.push('/(app)/applications' as any),
            },
            {
              label: role === 'client'
                ? (pendingApplications.length > 0 ? 'New Applicants' : 'Applications')
                : 'My Applications',
              value: role === 'client'
                ? (pendingApplications.length > 0 ? `${pendingApplications.length} New` : businessApplications.length.toString())
                : myApplications.length.toString(),
              emoji: role === 'client' ? '👥' : '📋',
              onPress: () => router.push('/(app)/applications' as any),
            },
            { label: t("Rating"), value: userData?.ratingCount ? (userData.ratingAverage ?? 0).toFixed(1) : '\u2014', emoji: '⭐', onPress: undefined },
          ].map((stat) => (
            <TouchableOpacity
              key={t(stat.label)}
              style={styles.statCard}
              onPress={stat.onPress}
              disabled={!stat.onPress}
              activeOpacity={stat.onPress ? 0.75 : 1}
            >
              <Text style={styles.statEmoji}>{stat.emoji}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Real-time Gigs List Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                {role === 'client' ? t("Your Posted Gigs") : t("Explore Latest Gigs")}
              </Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t("Live Sync")}</Text>
              </View>
            </View>

            {role === 'client' ? (
              <TouchableOpacity
                onPress={() => router.push('/(app)/(tabs)/my-gigs' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.seeAllText}>{t("Manage All (")}{uniqueGigs.length}) →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/browse' as any)}>
                <Text style={styles.seeAllText}>{t("Browse All")} →</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingGigs && user ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.loadingText}>{t("Syncing with Cloud Firestore...")}</Text>
            </View>
          ) : loadError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
              <Text style={styles.errorText}>{t(loadError)}</Text>
            </View>
          ) : displayedGigs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>{role !== 'client' && appliedGigIds.size > 0 ? '✨' : '📋'}</Text>
              <Text style={styles.emptyTitle}>
                {role === 'client'
                  ? t("No Gigs Found")
                  : appliedGigIds.size > 0
                  ? t("All Caught Up!")
                  : t("No Gigs Found")}
              </Text>
              <Text style={styles.emptyText}>
                {role === 'client'
                  ? t("You have not posted any gigs yet. Tap \"Post a New Gig\" above to create your first listing in Firestore!")
                  : appliedGigIds.size > 0
                  ? t("You have applied to all available gigs in this feed. Tap \"Browse All\" above to discover more opportunities, or check your dashboard!")
                  : t("Be the first to create or browse new opportunities on the platform.")}
              </Text>
            </View>
          ) : (
            <View style={styles.gigsList}>
              {displayedGigs.map((gig) => (
                <TouchableOpacity
                  key={gig.id}
                  style={styles.gigItemCard}
                  onPress={() => {
                    if (role === 'client') {
                      router.push('/(app)/(tabs)/my-gigs' as any);
                    } else {
                      router.push({
                        pathname: '/(app)/gig/[id]',
                        params: { id: gig.id },
                      } as any);
                    }
                  }}
                  activeOpacity={0.9}
                >
                  {/* Top Header: Category & Status Badge on Left, Pay Badge on Right */}
                  <View style={styles.gigItemHeader}>
                    <View style={styles.gigHeaderBadges}>
                      <View style={styles.gigCategoryBadge}>
                        <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                        <Text style={styles.gigCategoryBadgeText}>{gig.category}</Text>
                      </View>
                      {gig.status && (
                        <View
                          style={[
                            styles.gigStatusPill,
                            gig.status === 'open' && styles.gigStatusOpen,
                            gig.status === 'in-progress' && styles.gigStatusProgress,
                            gig.status === 'completed' && styles.gigStatusCompleted,
                            gig.status === 'cancelled' && styles.gigStatusCancelled,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              gig.status === 'open' && { backgroundColor: '#10B981' },
                              gig.status === 'in-progress' && { backgroundColor: '#F59E0B' },
                              gig.status === 'completed' && { backgroundColor: '#8B5CF6' },
                              gig.status === 'cancelled' && { backgroundColor: '#EF4444' },
                            ]}
                          />
                          <Text
                            style={[
                              styles.gigStatusPillText,
                              gig.status === 'open' && { color: '#047857' },
                              gig.status === 'in-progress' && { color: '#B45309' },
                              gig.status === 'completed' && { color: '#6D28D9' },
                              gig.status === 'cancelled' && { color: '#B91C1C' },
                            ]}
                          >
                            {gig.status === 'in-progress' ? t("In Progress") : gig.status}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.gigHeaderRight}>
                      <View style={styles.gigPayBadge}>
                        <Text style={styles.gigPayAmount}>${gig.pay}</Text>
                        <Text style={styles.gigPayType}>
                          {gig.payType === 'hourly' ? t("/hr") : t(" fixed")}
                        </Text>
                      </View>
                      {role === 'client' && (
                        <TouchableOpacity
                          style={styles.deleteGigBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteGig(gig.id, gig.title);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Gig Title */}
                  <Text style={styles.gigItemTitle} numberOfLines={2}>
                    {gig.title}
                  </Text>

                  {/* Gig Description */}
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
                        <View style={styles.moreSkillsChip}>
                          <Text style={styles.moreSkillsText}>+{gig.skills.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Divider line */}
                  <View style={styles.cardDivider} />

                  {/* Footer: Meta info (Location & Date) and Actions (Chat icon & Apply button) */}
                  <View style={styles.gigItemFooter}>
                    <View style={styles.metaInfoGroup}>
                      <View style={styles.gigMetaRow}>
                        <Ionicons
                          name={gig.locationType === 'remote' ? 'globe-outline' : 'location-outline'}
                          size={13}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.gigMetaText} numberOfLines={1}>
                          {gig.location || t("Remote")}
                        </Text>
                      </View>
                      <View style={styles.gigMetaRow}>
                        <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                        <Text style={styles.gigMetaText}>{gig.date || t("Flexible")}</Text>
                      </View>
                    </View>

                    {role === 'client' ? (
                      <View style={styles.cardActionsGroup}>
                        <TouchableOpacity
                          style={styles.manageCardBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push('/(app)/(tabs)/my-gigs' as any);
                          }}
                          activeOpacity={0.8}
                          accessibilityLabel="Manage your gig"
                        >
                          <Text style={styles.manageCardBtnText}>{t("Manage")}</Text>
                          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.cardActionsGroup}>
                        {/* Chat Icon Button */}
                        <TouchableOpacity
                          style={styles.chatIconButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleContactBusiness(gig);
                          }}
                          disabled={startingChatGigId === gig.id}
                          activeOpacity={0.75}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Chat with business"
                        >
                          {startingChatGigId === gig.id ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Ionicons
                              name="chatbubble-ellipses-outline"
                              size={17}
                              color={colors.primary}
                            />
                          )}
                        </TouchableOpacity>

                        {/* Apply Button */}
                        <TouchableOpacity
                          style={styles.applyCardBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push({
                              pathname: '/(app)/gig/[id]',
                              params: { id: gig.id },
                            } as any);
                          }}
                          activeOpacity={0.85}
                          accessibilityLabel="Apply for this gig"
                        >
                          <Text style={styles.applyCardBtnText}>{t("Apply")}</Text>
                          <Ionicons
                            name="arrow-forward"
                            size={13}
                            color={colors.primaryOnColor}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Business Owner Applicant Details & Action Modal */}
      {user && role === 'client' && (
        <ApplicantDetailModal
          visible={!!selectedApplicantForDetail}
          application={selectedApplicantForDetail}
          businessId={user.uid}
          onClose={() => setSelectedApplicantForDetail(null)}
          onAccepted={(app) => {
            setCelebrationDialog({
              visible: true,
              youthName: app.youthName || 'Youth Freelancer',
              gigTitle: app.gigTitle || 'Gig',
            });
          }}
          onStatusChanged={(newStatus) => {
            if (selectedApplicantForDetail) {
              setBusinessApplications((prev) =>
                prev.map((a) =>
                  a.id === selectedApplicantForDetail.id ? { ...a, status: newStatus } : a
                )
              );
              if (newStatus === 'accepted' && selectedApplicantForDetail.gigId) {
                setGigs((prev) =>
                  prev.map((g) =>
                    g.id === selectedApplicantForDetail.gigId
                      ? {
                          ...g,
                          status: 'in-progress',
                          assignedYouthId: selectedApplicantForDetail.youthId,
                        }
                      : g
                  )
                );
              }
            }
            setSelectedApplicantForDetail(null);
          }}
        />
      )}

      {/* Celebration Message Dialog */}
      <CelebrationModal
        visible={Boolean(celebrationDialog?.visible)}
        youthName={celebrationDialog?.youthName || ''}
        gigTitle={celebrationDialog?.gigTitle || ''}
        onClose={() => setCelebrationDialog(null)}
      />
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
  messagesHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBadgePill: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryOnColor,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  contactEmployerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginLeft: 'auto',
  },
  contactEmployerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryOnColor,
  },

  // CTA Card
  ctaCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
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
    color: colors.primaryOnColor,
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
  ctaButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  postGigButton: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  postGigButtonText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontWeight: '800',
  },
  manageGigsButton: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  manageGigsButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
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
    textAlign: 'center',
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gigItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  gigHeaderBadges: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  gigCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  gigCategoryBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  gigStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gigStatusOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  gigStatusProgress: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  gigStatusCompleted: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: 'rgba(124, 58, 237, 0.28)',
  },
  gigStatusCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.28)',
  },
  gigStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  gigHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gigPayBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(8, 127, 115, 0.18)',
  },
  gigPayAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  gigPayType: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 2,
  },
  deleteGigBtn: {
    padding: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.errorLight,
  },
  gigItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
  gigItemDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  skillChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  skillChipText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  moreSkillsChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  moreSkillsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.surfaceBorderSubtle,
    marginVertical: 2,
  },
  gigItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metaInfoGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
  },
  gigMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gigMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  applyCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryOnColor,
  },
  manageCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  manageCardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  acceptedSectionContainer: {
    marginHorizontal: spacing.lg,
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
    fontWeight: '800',
    color: colors.text,
  },
  acceptedViewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  acceptedGigCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  acceptedStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  acceptedPayText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  acceptedGigTitle: {
    fontSize: 16,
    fontWeight: '700',
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
    color: colors.textSecondary,
    fontWeight: '500',
  },
  acceptedDot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  acceptedLocationText: {
    fontSize: 12,
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
    fontWeight: '700',
  },
  acceptedDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  acceptedDetailsBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Business Owner Applicant Spotlight
  applicantSectionContainer: {
    marginBottom: spacing.lg,
  },
  applicantSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  applicantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  applicantHeaderIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  applicantPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  applicantPendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  applicantPendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  applicantViewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  applicantCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  applicantCardPendingBorder: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  applicantCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  applicantInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  applicantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceBorder,
  },
  applicantAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  applicantNameWrap: {
    flex: 1,
  },
  applicantYouthName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  applicantGigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  applicantGigTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  applicantStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusPillPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusPillAccepted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPillRejected: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorder,
  },
  applicantStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  applicantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  applicantDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  applicantDateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  applicantPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  applicantPayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  applicantRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  applicantRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  applicantMessageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  applicantMessageText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 17,
    flex: 1,
  },
  applicantActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  applicantAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  applicantAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  applicantDeclineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
  },
  applicantDeclineBtnText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  applicantChatBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantChatBtnWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
  },
  applicantChatBtnWideText: {
    color: colors.primaryOnColor,
    fontSize: 13,
    fontWeight: '700',
  },
  applicantDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
  },
  applicantDetailsBtnWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
  },
  applicantDetailsBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
