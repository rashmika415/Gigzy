import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React, { useState, useEffect } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import type { Application, ApplicationFilterStatus } from '../../types/application';
import { subscribeToGigApplicants, acceptApplication, rejectApplication } from '../../services/applicationService';
import { router } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import ApplicantCard from './ApplicantCard';
import ApplicantDetailModal from './ApplicantDetailModal';
import CelebrationModal from './CelebrationModal';

interface ApplicantListModalProps {
  visible: boolean;
  gigId: string;
  gigTitle: string;
  businessId: string;
  onClose: () => void;
  gigDate?: string;
  gigTime?: string;
  gigLocation?: string;
  gigPay?: number;
  gigPayType?: string;
}

export default function ApplicantListModal({
  visible,
  gigId,
  gigTitle,
  businessId,
  onClose,
  gigDate,
  gigTime,
  gigLocation,
  gigPay,
  gigPayType,
}: ApplicantListModalProps) {
  useTranslation();
  const toast = useToast();
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<ApplicationFilterStatus>('all');
  const [selectedApplicant, setSelectedApplicant] = useState<Application | null>(null);
  const [acceptedCelebrationApp, setAcceptedCelebrationApp] = useState<Application | null>(null);

  useEffect(() => {
    if (!visible || !gigId) return;

    let active = true;
    let unsubscribe = () => {};
    void Promise.resolve().then(() => {
    if (!active) return;
    setLoading(true);
    setLoadError('');
    unsubscribe = subscribeToGigApplicants(
      gigId,
      businessId,
      (apps: Application[]) => {
        setApplicants(apps);
        setLoading(false);
        setLoadError('');
      },
      (error: Error) => {
        console.error('Error fetching applicants:', error);
        setLoadError(error.message || 'Failed to load applicants.');
        setLoading(false);
      }
    );

    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [visible, gigId, businessId, retry]);

  const handleRetry = () => setRetry(value => value + 1);

  const handleQuickAccept = (app: Application) => {
    if (Platform.OS === 'web') {
      const confirmPrompt = tr("Are you sure you want to accept {{value0}} for \"{{value1}}\"?", {
        value0: app.youthName || 'this applicant',
        value1: app.gigTitle || gigTitle || 'this gig',
      });
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm(confirmPrompt)) {
          void executeAccept(app);
        }
      } else {
        void executeAccept(app);
      }
    } else {
      Alert.alert(
        tr("Accept Application"),
        tr("Are you sure you want to accept {{value0}} for \"{{value1}}\"?", {
          value0: app.youthName || 'this applicant',
          value1: app.gigTitle || gigTitle || 'this gig',
        }),
        [
          { text: tr("Cancel"), style: 'cancel' },
          {
            text: tr("Accept Applicant"),
            style: 'default',
            onPress: () => void executeAccept(app),
          },
        ]
      );
    }
  };

  const executeAccept = async (app: Application) => {
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      await acceptApplication(app.id, businessId);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      toast.success(
        tr("Application Accepted! 🎉"),
        tr("You have accepted {{value0}} for \"{{value1}}\". Work is now in progress and a notification has been sent to the youth freelancer's dashboard.", {
          value0: app.youthName || 'this applicant',
          value1: app.gigTitle || gigTitle || 'this gig',
        })
      );
      onClose();
      router.push('/(app)/(tabs)/home' as any);
    } catch (err: any) {
      toast.error(err.message || tr("Failed to accept application."));
    }
  };

  const handleQuickReject = (app: Application) => {
    if (Platform.OS === 'web') {
      const confirmPrompt = tr("Are you sure you want to reject this application from {{value0}}?", {
        value0: app.youthName || 'this applicant',
      });
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm(confirmPrompt)) {
          void executeReject(app);
        }
      } else {
        void executeReject(app);
      }
    } else {
      Alert.alert(
        tr("Reject Application"),
        tr("Are you sure you want to reject this application from {{value0}}?", {
          value0: app.youthName || 'this applicant',
        }),
        [
          { text: tr("Cancel"), style: 'cancel' },
          {
            text: tr("Reject"),
            style: 'destructive',
            onPress: () => void executeReject(app),
          },
        ]
      );
    }
  };

  const executeReject = async (app: Application) => {
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      await rejectApplication(app.id, businessId);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      toast.success(tr("Application Rejected"), tr("The application has been rejected."));
    } catch (err: any) {
      toast.error(err.message || tr("Failed to reject application."));
    }
  };

  const filteredApplicants = applicants.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const pendingCount = applicants.filter((a) => a.status === 'pending').length;
  const acceptedCount = applicants.filter((a) => a.status === 'accepted').length;
  const rejectedCount = applicants.filter((a) => a.status === 'rejected').length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={tr("Close applicant list")}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{tr("Gig Applicants")}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {gigTitle}
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, filter === 'all' && styles.tabActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>{tr("All (")}{applicants.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, filter === 'pending' && styles.tabActive]}
            onPress={() => setFilter('pending')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'pending' && styles.tabTextActive]}>{tr("Pending (")}{pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, filter === 'accepted' && styles.tabActive]}
            onPress={() => setFilter('accepted')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'accepted' && styles.tabTextActive]}>{tr("Accepted (")}{acceptedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, filter === 'rejected' && styles.tabActive]}
            onPress={() => setFilter('rejected')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'rejected' && styles.tabTextActive]}>{tr("Rejected (")}{rejectedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Applicant List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{tr("Loading applicants...")}</Text>
          </View>
        ) : loadError ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBg, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
            </View>
            <Text style={styles.emptyTitle}>{tr("Unable to Load Applicants")}</Text>
            <Text style={styles.emptySubtitle}>{tr(loadError)}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>{tr("Try Again")}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredApplicants.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="people-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'all'
                ? tr("No Applicants Yet")
                : tr("No {{value0}} applicants", { value0: filter })}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? tr("Youth freelancers who apply to this gig will appear here.")
                : tr("No applicants currently match the \"{{value0}}\" status.", { value0: filter })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredApplicants}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ApplicantCard
                application={item}
                onPress={() => setSelectedApplicant(item)}
                onAccept={() => handleQuickAccept(item)}
                onReject={() => handleQuickReject(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Applicant Detail Modal */}
        <ApplicantDetailModal
          visible={!!selectedApplicant}
          application={applicants.find(item => item.id === selectedApplicant?.id) || selectedApplicant}
          businessId={businessId}
          onClose={() => setSelectedApplicant(null)}
          onAccepted={() => {
            setSelectedApplicant(null);
            onClose();
            router.push('/(app)/(tabs)/home' as any);
          }}
          onStatusChanged={(newStatus) => {
            if (selectedApplicant) {
              setSelectedApplicant({
                ...selectedApplicant,
                status: newStatus,
              });
            }
          }}
        />

        {/* Celebration Modal on Gig Acceptance */}
        <CelebrationModal
          visible={!!acceptedCelebrationApp}
          youthName={acceptedCelebrationApp?.youthName || 'Youth Freelancer'}
          gigTitle={acceptedCelebrationApp?.gigTitle || gigTitle || 'Gig'}
          applicationId={acceptedCelebrationApp?.id}
          gigId={acceptedCelebrationApp?.gigId || gigId}
          gigDate={gigDate || acceptedCelebrationApp?.gigDate}
          gigTime={gigTime}
          gigLocation={gigLocation || acceptedCelebrationApp?.gigLocation}
          gigPay={gigPay || acceptedCelebrationApp?.gigPay}
          gigPayType={gigPayType || acceptedCelebrationApp?.gigPayType}
          onClose={() => {
            setAcceptedCelebrationApp(null);
            onClose();
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    maxWidth: 200,
    marginTop: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  tab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    minHeight: 36,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primaryOnColor,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
});
