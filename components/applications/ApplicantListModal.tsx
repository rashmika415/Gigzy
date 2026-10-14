import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import type { Application, ApplicationFilterStatus } from '../../types/application';
import { subscribeToGigApplicants } from '../../services/applicationService';
import Chip from '../Chip';
import EmptyState from '../EmptyState';
import ErrorState from '../ErrorState';
import SkeletonList from '../Skeleton';
import ApplicantCard from './ApplicantCard';
import ApplicantDetailModal from './ApplicantDetailModal';
import CelebrationModal from './CelebrationModal';
import useApplicantDecision from './useApplicantDecision';

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

const FILTERS: { id: ApplicationFilterStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
];

export default function ApplicantListModal({
  visible, gigId, gigTitle, businessId, onClose, gigDate, gigTime, gigLocation, gigPay, gigPayType,
}: ApplicantListModalProps) {
  const { t } = useTranslation();
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<ApplicationFilterStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hired, setHired] = useState<Application | null>(null);

  // Hiring someone shows the celebration (with calendar + chat shortcuts) on top of this list.
  const { request, busyId, sheet } = useApplicantDecision(businessId, { onAccepted: app => { setSelectedId(null); setHired(app); } });

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
        apps => { setApplicants(apps); setLoading(false); setLoadError(''); },
        error => { setLoadError(error.message || 'Failed to load applicants.'); setLoading(false); },
      );
    });
    return () => { active = false; unsubscribe(); };
  }, [visible, gigId, businessId, retry]);

  const counts = useMemo(() => ({
    all: applicants.length,
    pending: applicants.filter(a => a.status === 'pending').length,
    accepted: applicants.filter(a => a.status === 'accepted').length,
    rejected: applicants.filter(a => a.status === 'rejected').length,
    completed: applicants.filter(a => a.status === 'completed').length,
  }), [applicants]);
  const filtered = filter === 'all' ? applicants : applicants.filter(app => app.status === filter);
  const selected = applicants.find(app => app.id === selectedId) ?? null;
  const filterLabel = t(FILTERS.find(item => item.id === filter)?.label ?? '').toLowerCase();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Close applicant list')}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.headerTitle}>{t('Gig Applicants')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{gigTitle}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map(item => <Chip key={item.id} label={t(item.label)} count={counts[item.id]}
              variant={filter === item.id ? 'selected' : 'default'} onPress={() => setFilter(item.id)} />)}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.listContent}><SkeletonList variant="row" count={4} /></View>
        ) : loadError ? (
          <View style={styles.listContent}>
            <ErrorState title="Unable to Load Applicants" message={loadError} retryLabel="Try Again" onRetry={() => setRetry(value => value + 1)} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.listContent}>
            {filter === 'all'
              ? <EmptyState icon="people-outline" title="No Applicants Yet" description={t('Youth freelancers who apply to this gig will appear here.')} />
              : <EmptyState icon="filter-outline" title={t('No {{value0}} applicants', { value0: filterLabel })}
                description={t('Try another filter to see more applicants.')} actionLabel="Show all" onAction={() => setFilter('all')} secondary />}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <ApplicantCard application={item} busy={busyId === item.id}
              onPress={() => setSelectedId(item.id)}
              onAccept={() => request(item, 'accept')}
              onReject={() => request(item, 'reject')} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        <ApplicantDetailModal
          visible={!!selected}
          application={selected}
          businessId={businessId}
          onClose={() => setSelectedId(null)}
          onAccepted={app => { setSelectedId(null); setHired(app); }}
        />

        <CelebrationModal
          visible={!!hired}
          youthName={hired?.youthName || t('Youth Freelancer')}
          gigTitle={hired?.gigTitle || gigTitle || t('Gig')}
          applicationId={hired?.id}
          gigId={hired?.gigId || gigId}
          gigDate={gigDate || hired?.gigDate}
          gigTime={gigTime || hired?.gigTime}
          gigLocation={gigLocation || hired?.gigLocation}
          gigPay={gigPay ?? hired?.gigPay}
          gigPayType={gigPayType || hired?.gigPayType}
          onClose={() => { setHired(null); onClose(); }}
        />
        {sheet}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  pressed: { opacity: 0.75 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  close: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.h3, color: colors.text },
  headerSubtitle: { ...typography.bodySmall, color: colors.textSecondary },
  filters: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  separator: { height: spacing.sm + spacing.xs },
});
