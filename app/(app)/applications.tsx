import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo } from 'react';
import { View, Pressable, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/LocalizedText';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import type { Application, ApplicationFilterStatus } from '../../types/application';
import {
  subscribeToMyApplications,
  getMyApplications,
  subscribeToBusinessApplications,
  getApplicationsForBusiness,
  acceptApplication,
  rejectApplication,
} from '../../services/applicationService';
import {
  ApplicationCard,
  ApplicationDetailModal,
  ApplicantCard,
  ApplicantDetailModal,
} from '../../components/applications';
import { Chip, EmptyState, ErrorState, SearchBar, SkeletonList } from '../../components';
import ConfirmSheet from '../../components/ConfirmSheet';

const FILTERS: { id: ApplicationFilterStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
];

/** Older documents may still use "approved" for accepted applications. */
const normalizedStatus = (app: Application) => {
  const status = (app.status || '').toLowerCase();
  return status === 'approved' ? 'accepted' : status;
};

type Decision = { app: Application; action: 'accept' | 'reject' };
import { RatingModal } from '../../components/reviews';

export default function MyApplicationsScreen() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const toast = useToast();
  const isBusiness = userData?.role === 'client';
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [activeFilter, setActiveFilter] = useState<ApplicationFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [selectedApplicant, setSelectedApplicant] = useState<Application | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [selectedApplicantForRating, setSelectedApplicantForRating] = useState<Application | null>(null);
  const [acceptedCelebrationApp, setAcceptedCelebrationApp] = useState<Application | null>(null);

  // Real-time sync. `attempt` restarts the listener when the user taps Retry.
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    void Promise.resolve().then(() => {
      if (!active) return;
      if (!user) {
        setLoading(false);
        return;
      }
      const onUpdate = (apps: Application[]) => {
        setApplications(apps);
        setLoading(false);
        setErrorMsg('');
      };
      const onError = (error: Error) => {
        setErrorMsg(error.message || 'Failed to load applications.');
        setLoading(false);
      };
      unsubscribe = isBusiness
        ? subscribeToBusinessApplications(user.uid, onUpdate, onError)
        : subscribeToMyApplications(user.uid, onUpdate, onError);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, isBusiness, attempt]);

  const handleRetry = () => {
    setLoading(true);
    setErrorMsg('');
    setAttempt(value => value + 1);
  };

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      setApplications(isBusiness ? await getApplicationsForBusiness(user.uid) : await getMyApplications(user.uid));
      setErrorMsg('');
    } catch (err: any) {
      toast.error(t('Failed to refresh applications.'), err?.message ? t(err.message) : undefined);
    } finally {
      setRefreshing(false);
    }
  };

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: applications.length };
    applications.forEach(app => { const status = normalizedStatus(app); result[status] = (result[status] || 0) + 1; });
    return result;
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return applications.filter(app => {
      if (activeFilter !== 'all' && normalizedStatus(app) !== activeFilter) return false;
      if (!query) return true;
      return [app.gigTitle, app.businessName, app.youthName, app.gigLocation, ...(app.youthSkills || [])]
        .some(value => (value || '').toLowerCase().includes(query));
    });
  }, [applications, activeFilter, searchQuery]);

  const confirmDecision = async () => {
    if (!user || !decision || deciding) return;
    const { app, action } = decision;
    setDeciding(true);
    setDecisionError('');
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (action === 'accept') {
        await acceptApplication(app.id, user.uid);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast.success(t('Application Accepted! 🎉'), t('You have accepted {{value0}} for "{{value1}}". Work is now in progress and a notification has been sent to the youth freelancer\'s dashboard.', {
          value0: app.youthName || t('this applicant'),
          value1: app.gigTitle || t('this gig'),
        }));
      } else {
        await rejectApplication(app.id, user.uid);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        toast.success(t('Application Rejected'), t('The application has been rejected.'));
      }
      setDecision(null);
    } catch (err: any) {
      setDecisionError(err?.message || (action === 'accept' ? 'Failed to accept application.' : 'Failed to reject application.'));
    } finally {
      setDeciding(false);
    }
  };

  const activeLabel = t(FILTERS.find(filter => filter.id === activeFilter)?.label ?? 'All');

  const renderBody = () => {
    if (loading) return <View style={styles.padded}><SkeletonList variant="row" count={4} /></View>;
    if (errorMsg) {
      return <View style={styles.padded}>
        <ErrorState title="Unable to load applications" message={t(errorMsg)} retryLabel="Retry" onRetry={handleRetry} />
      </View>;
    }
    if (filteredApplications.length === 0) {
      return <View style={styles.padded}>
        {searchQuery.trim() ? (
          <EmptyState icon="search-outline" title={t('No matching applications')}
            description={t('Try a different search or filter.')} actionLabel={t('Clear search')} actionIcon="close-circle-outline"
            onAction={() => setSearchQuery('')} secondary />
        ) : activeFilter !== 'all' ? (
          <EmptyState icon="filter-outline" title={t('No {{value0}} applications', { value0: activeLabel })}
            description={t('You do not have any applications marked as "{{value0}}".', { value0: activeLabel })}
            actionLabel={t('Show all')} onAction={() => setActiveFilter('all')} secondary />
        ) : (
          <EmptyState
            icon={isBusiness ? 'people-outline' : 'document-text-outline'}
            title={isBusiness ? t('No applicants yet') : t('No applications yet')}
            description={isBusiness
              ? t('When youth freelancers apply to your gigs, their applications and details will appear here.')
              : t('When you apply to gigs, your applications and their statuses will appear here.')}
            actionLabel={isBusiness ? t('Manage Your Gigs') : t('Browse Available Gigs')}
            actionIcon={isBusiness ? 'briefcase-outline' : 'compass-outline'}
            onAction={() => router.push((isBusiness ? '/(app)/(tabs)/my-gigs' : '/(app)/(tabs)/browse') as any)}
          />
        )}
      </View>;
    }
    return <FlatList
      data={filteredApplications}
      keyExtractor={item => item.id}
      renderItem={({ item }) => isBusiness ? (
        <ApplicantCard
          application={item}
          onPress={() => setSelectedApplicant(item)}
          onAccept={() => { setDecisionError(''); setDecision({ app: item, action: 'accept' }); }}
          onReject={() => { setDecisionError(''); setDecision({ app: item, action: 'reject' }); }}
          busy={deciding && decision?.app.id === item.id}
        />
      ) : (
        <ApplicationCard application={item} onPress={() => setSelectedApplication(item)} />
      )}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    />;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('Back')}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.headerTitle}>
            {isBusiness ? t('Gig Applications') : t('My Applications')}
          </Text>
          {!loading && !errorMsg && <Text style={styles.headerSubtitle}>{t('{{count}} total', { count: applications.length })}</Text>}
        </View>
      </View>

      <View style={styles.searchRow}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery}
          placeholder={isBusiness ? t('Search by applicant, gig, or skill...') : t('Search by gig title or business...')} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map(filter => <Chip key={filter.id} label={t(filter.label)} count={counts[filter.id] || 0}
            variant={activeFilter === filter.id ? 'selected' : 'default'}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveFilter(filter.id); }} />)}
        </ScrollView>
      </View>

      <View style={styles.flex}>{renderBody()}</View>
      {/* Content Body */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {isBusiness ? tr("Syncing received applications...") : tr("Syncing your applications...")}
          </Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>{tr("Unable to load applications")}</Text>
          <Text style={styles.errorSubtitle}>{tr(errorMsg)}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>{tr("Retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredApplications.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconBg}>
            <Ionicons
              name={isBusiness ? 'people-outline' : 'document-text-outline'}
              size={36}
              color={colors.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery
              ? tr("No matching applications")
              : activeFilter === 'all'
              ? isBusiness
                ? tr("No applicants yet")
                : tr("No applications yet")
              : tr("No {{value0}} applications", { value0: activeFilter })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'all'
              ? isBusiness
                ? tr("When youth freelancers apply to your gigs, their applications and details will appear here.")
                : tr("When you apply to gigs, your applications and their statuses will appear here.")
              : tr("You do not have any applications marked as \"{{value0}}\".", { value0: activeFilter })}
          </Text>
          {activeFilter === 'all' && !searchQuery ? (
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() =>
                router.push(
                  isBusiness
                    ? ('/(app)/(tabs)/my-gigs' as any)
                    : ('/(app)/(tabs)/browse' as any)
                )
              }
              activeOpacity={0.85}
            >
              <Ionicons
                name={isBusiness ? 'briefcase-outline' : 'compass-outline'}
                size={18}
                color={colors.primaryOnColor}
              />
              <Text style={styles.exploreBtnText}>
                {isBusiness ? tr("Manage Your Gigs") : tr("Browse Available Gigs")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filteredApplications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            isBusiness ? (
              <ApplicantCard
                application={item}
                onPress={() => setSelectedApplicant(item)}
                onAccept={() => handleQuickAccept(item)}
                onReject={() => handleQuickReject(item)}
                onRate={() => setSelectedApplicantForRating(item)}
              />
            ) : (
              <ApplicationCard
                application={item}
                onPress={() => setSelectedApplication(item)}
              />
            )
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {!isBusiness && (
        <ApplicationDetailModal
          visible={!!selectedApplication}
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      )}

      {isBusiness && (
        <ApplicantDetailModal
          visible={!!selectedApplicant}
          application={selectedApplicant}
          businessId={user?.uid || ''}
          onClose={() => setSelectedApplicant(null)}
          onAccepted={() => setSelectedApplicant(null)}
          onStatusChanged={newStatus => {
            if (selectedApplicant) setSelectedApplicant({ ...selectedApplicant, status: newStatus });
          }}
        />
      )}

      <ConfirmSheet
        visible={!!decision}
        destructive={decision?.action === 'reject'}
        icon={decision?.action === 'reject' ? 'close-circle-outline' : 'checkmark-circle-outline'}
        title={decision?.action === 'reject' ? 'Reject Application' : 'Accept Application'}
        message={decision ? (decision.action === 'reject'
          ? t('Are you sure you want to reject this application from {{value0}}?', { value0: decision.app.youthName || t('this applicant') })
          : t('Are you sure you want to accept {{value0}} for "{{value1}}"?', { value0: decision.app.youthName || t('this applicant'), value1: decision.app.gigTitle || t('this gig') }))
          : undefined}
        confirmLabel={decision?.action === 'reject' ? 'Reject' : 'Accept Applicant'}
        loading={deciding}
        error={decisionError}
        onConfirm={confirmDecision}
        onCancel={() => setDecision(null)}
      {/* Rating Modal for Business Owner to Rate Accepted Youth Freelancer */}
      {isBusiness && selectedApplicantForRating && (
        <RatingModal
          visible={!!selectedApplicantForRating}
          targetUserId={
            typeof selectedApplicantForRating.youthId === 'object' && selectedApplicantForRating.youthId !== null
              ? (selectedApplicantForRating.youthId as any).uid || (selectedApplicantForRating.youthId as any).id || ''
              : String(selectedApplicantForRating.youthId || '')
          }
          targetUserName={selectedApplicantForRating.youthName || tr('Youth Freelancer')}
          targetUserPhotoURL={selectedApplicantForRating.youthPhotoURL}
          targetRole="freelancer"
          gigId={selectedApplicantForRating.gigId}
          gigTitle={selectedApplicantForRating.gigTitle}
          onClose={() => setSelectedApplicantForRating(null)}
          onSuccess={() => {
            setSelectedApplicantForRating(null);
          }}
        />
      )}

      {/* Celebration Modal on Gig Acceptance */}
      <CelebrationModal
        visible={!!acceptedCelebrationApp}
        youthName={acceptedCelebrationApp?.youthName || 'Youth Freelancer'}
        gigTitle={acceptedCelebrationApp?.gigTitle || 'Gig'}
        applicationId={acceptedCelebrationApp?.id}
        gigId={acceptedCelebrationApp?.gigId}
        gigDate={acceptedCelebrationApp?.gigDate}
        gigLocation={acceptedCelebrationApp?.gigLocation}
        gigPay={acceptedCelebrationApp?.gigPay}
        gigPayType={acceptedCelebrationApp?.gigPayType}
        onClose={() => setAcceptedCelebrationApp(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { ...typography.h1, color: colors.text },
  headerSubtitle: { ...typography.caption, color: colors.textSecondary },
  searchRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm + spacing.xs },
  padded: { paddingHorizontal: spacing.md },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
});
