import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
import type { Application, ApplicationFilterStatus } from '../../types/application';
import { subscribeToGigApplicants } from '../../services/applicationService';
import ApplicantCard from './ApplicantCard';
import ApplicantDetailModal from './ApplicantDetailModal';

interface ApplicantListModalProps {
  visible: boolean;
  gigId: string;
  gigTitle: string;
  businessId: string;
  onClose: () => void;
}

export default function ApplicantListModal({
  visible,
  gigId,
  gigTitle,
  businessId,
  onClose,
}: ApplicantListModalProps) {
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<ApplicationFilterStatus>('all');
  const [selectedApplicant, setSelectedApplicant] = useState<Application | null>(null);

  useEffect(() => {
    if (!visible || !gigId) return;

    setLoading(true);
    setLoadError('');

    const unsubscribe = subscribeToGigApplicants(
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

    return () => {
      unsubscribe();
    };
  }, [visible, gigId, businessId]);

  const handleRetry = () => {
    setLoading(true);
    setLoadError('');
    subscribeToGigApplicants(
      gigId,
      businessId,
      (apps: Application[]) => {
        setApplicants(apps);
        setLoading(false);
        setLoadError('');
      },
      (error: Error) => {
        setLoadError(error.message || 'Failed to load applicants.');
        setLoading(false);
      }
    );
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
            accessibilityLabel="Close applicant list"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Gig Applicants</Text>
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
            <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>
              All ({applicants.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, filter === 'pending' && styles.tabActive]}
            onPress={() => setFilter('pending')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'pending' && styles.tabTextActive]}>
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, filter === 'accepted' && styles.tabActive]}
            onPress={() => setFilter('accepted')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'accepted' && styles.tabTextActive]}>
              Accepted ({acceptedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, filter === 'rejected' && styles.tabActive]}
            onPress={() => setFilter('rejected')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'rejected' && styles.tabTextActive]}>
              Rejected ({rejectedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Applicant List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading applicants...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
            </View>
            <Text style={styles.emptyTitle}>Unable to Load Applicants</Text>
            <Text style={styles.emptySubtitle}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredApplicants.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="people-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'all'
                ? 'No Applicants Yet'
                : `No ${filter} applicants`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Youth freelancers who apply to this gig will appear here.'
                : `No applicants currently match the "${filter}" status.`}
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
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Applicant Detail Modal */}
        <ApplicantDetailModal
          visible={!!selectedApplicant}
          application={selectedApplicant}
          businessId={businessId}
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
    fontWeight: '700',
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
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
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
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  retryBtnText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontWeight: '600',
  },
});
