import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';
import type { Application, ApplicationFilterStatus } from '../../types/application';
import {
  subscribeToMyApplications,
  getMyApplications,
  subscribeToBusinessApplications,
  getApplicationsForBusiness,
} from '../../services/applicationService';
import {
  ApplicationCard,
  ApplicationDetailModal,
  ApplicantCard,
  ApplicantDetailModal,
} from '../../components/applications';

export default function MyApplicationsScreen() {
  const { user, userData } = useAuth();
  const isBusiness = userData?.role === 'client';
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeFilter, setActiveFilter] = useState<ApplicationFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [selectedApplicant, setSelectedApplicant] = useState<Application | null>(null);

  // Real-time synchronization of applications (freelancer youth or business client)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const onUpdate = (apps: Application[]) => {
      setApplications(apps);
      setLoading(false);
      setErrorMsg('');
    };

    const onError = (error: Error) => {
      setErrorMsg(error.message || 'Failed to load applications.');
      setLoading(false);
    };

    const unsubscribe = isBusiness
      ? subscribeToBusinessApplications(user.uid, onUpdate, onError)
      : subscribeToMyApplications(user.uid, onUpdate, onError);

    return () => {
      unsubscribe();
    };
  }, [user, isBusiness]);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const fresh = isBusiness
        ? await getApplicationsForBusiness(user.uid)
        : await getMyApplications(user.uid);
      setApplications(fresh);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to refresh applications.');
    } finally {
      setRefreshing(false);
    }
  };

  // Status counts
  const counts = useMemo(() => {
    return {
      all: applications.length,
      pending: applications.filter((a) => (a.status || '').toLowerCase() === 'pending').length,
      accepted: applications.filter((a) => {
        const s = (a.status || '').toLowerCase();
        return s === 'accepted' || s === 'approved';
      }).length,
      rejected: applications.filter((a) => (a.status || '').toLowerCase() === 'rejected').length,
      completed: applications.filter((a) => (a.status || '').toLowerCase() === 'completed').length,
    };
  }, [applications]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // 1. Status Filter
      if (activeFilter !== 'all') {
        const appStatus = (app.status || '').toLowerCase();
        const targetFilter = activeFilter.toLowerCase();
        if (targetFilter === 'accepted') {
          if (appStatus !== 'accepted' && appStatus !== 'approved') return false;
        } else if (appStatus !== targetFilter) {
          return false;
        }
      }
      // 2. Search Query Filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (app.gigTitle || '').toLowerCase().includes(query);
        const businessMatch = (app.businessName || '').toLowerCase().includes(query);
        const youthMatch = (app.youthName || '').toLowerCase().includes(query);
        const locationMatch = (app.gigLocation || '').toLowerCase().includes(query);
        const skillsMatch = (app.youthSkills || []).some((s) => s.toLowerCase().includes(query));
        return titleMatch || businessMatch || youthMatch || locationMatch || skillsMatch;
      }
      return true;
    });
  }, [applications, activeFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>
            {isBusiness ? 'Gig Applications' : 'My Applications'}
          </Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              isBusiness
                ? 'Search by applicant, gig, or skill...'
                : 'Search by gig title or business...'
            }
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && Platform.OS !== 'ios' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.filterTabsWrap}>
        <FilterTab
          label="All"
          count={counts.all}
          active={activeFilter === 'all'}
          onPress={() => setActiveFilter('all')}
        />
        <FilterTab
          label="Pending"
          count={counts.pending}
          active={activeFilter === 'pending'}
          onPress={() => setActiveFilter('pending')}
        />
        <FilterTab
          label="Accepted"
          count={counts.accepted}
          active={activeFilter === 'accepted'}
          onPress={() => setActiveFilter('accepted')}
        />
        <FilterTab
          label="Rejected"
          count={counts.rejected}
          active={activeFilter === 'rejected'}
          onPress={() => setActiveFilter('rejected')}
        />
        <FilterTab
          label="Completed"
          count={counts.completed}
          active={activeFilter === 'completed'}
          onPress={() => setActiveFilter('completed')}
        />
      </View>

      {/* Content Body */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {isBusiness ? 'Syncing received applications...' : 'Syncing your applications...'}
          </Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Unable to load applications</Text>
          <Text style={styles.errorSubtitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
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
              ? 'No matching applications'
              : activeFilter === 'all'
              ? isBusiness
                ? 'No applicants yet'
                : 'No applications yet'
              : `No ${activeFilter} applications`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'all'
              ? isBusiness
                ? 'When youth freelancers apply to your gigs, their applications and details will appear here.'
                : 'When you apply to gigs, your applications and their statuses will appear here.'
              : `You do not have any applications marked as "${activeFilter}".`}
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
                {isBusiness ? 'Manage Your Gigs' : 'Browse Available Gigs'}
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

      {/* Application Detail View Modal (Youth Freelancer View) */}
      {!isBusiness && (
        <ApplicationDetailModal
          visible={!!selectedApplication}
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      )}

      {/* Applicant Detail View Modal with Accept/Reject Actions (Business Owner View) */}
      {isBusiness && (
        <ApplicantDetailModal
          visible={!!selectedApplicant}
          application={selectedApplicant}
          businessId={user?.uid || ''}
          onClose={() => setSelectedApplicant(null)}
          onStatusChanged={(newStatus) => {
            if (selectedApplicant) {
              setSelectedApplicant({
                ...selectedApplicant,
                status: newStatus,
              });
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

function FilterTab({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
        {label}
      </Text>
      <View style={[styles.filterCountBadge, active && styles.filterCountBadgeActive]}>
        <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
          {count}
        </Text>
      </View>
    </TouchableOpacity>
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  backBtn: {
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
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 4,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterTabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.primaryOnColor,
  },
  filterCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterCountTextActive: {
    color: colors.primaryOnColor,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryOnColor,
  },
  emptyBox: {
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
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  exploreBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryOnColor,
  },
});
