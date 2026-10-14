import { Text } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ErrorState, GigCard, SkeletonList } from '../../../components';
import BookmarkButton from '../../../components/BookmarkButton';
import { useSavedGigs } from '../../../context/SavedGigsContext';
import { subscribeToGig } from '../../../services/gigService';
import type { Gig } from '../../../types/gig';
import { borderRadius, colors, spacing, typography } from '../../../constants/theme';

function SavedGigRow({ gigId }: { gigId: string }) {
  const { t } = useTranslation();
  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void Promise.resolve().then(() => {
      if (!active) return;
      unsubscribe = subscribeToGig(gigId, value => {
        if (active) { setGig(value); setLoading(false); setError(''); }
      }, failure => {
        if (active) { setError(failure.message); setLoading(false); }
      });
    });
    return () => { active = false; unsubscribe?.(); };
  }, [gigId, attempt]);

  if (loading) return <SkeletonList variant="gig" count={1} />;

  // Compact so a network drop doesn't stack a full error card per saved gig.
  if (error) return <View style={styles.notice}>
    <Ionicons name="cloud-offline-outline" size={20} color={colors.error} />
    <Text style={styles.noticeText}>{t('Unable to load this gig')}</Text>
    <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setError(''); setAttempt(value => value + 1); }}
      style={({ pressed }) => [styles.noticeAction, pressed && styles.pressed]}>
      <Text style={styles.retryText}>{t('Retry')}</Text>
    </Pressable>
  </View>;

  if (!gig) return <View style={styles.notice}>
    <Ionicons name="briefcase-outline" size={20} color={colors.textMuted} />
    <View style={styles.noticeCopy}>
      <Text style={styles.noticeTitle}>{t('Gig no longer available')}</Text>
      <Text style={styles.noticeText}>{t('This gig has been removed. You can remove it from your saved list.')}</Text>
    </View>
    <BookmarkButton gigId={gigId} />
  </View>;

  const closed = !!gig.status && gig.status !== 'open';
  return <View style={closed && styles.closedWrap}>
    {closed && <View style={styles.closedNote}>
      <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.closedText}>{t('No longer accepting applications')}</Text>
    </View>}
    <GigCard gig={gig} showBookmark onPress={item => router.push({ pathname: '/(app)/gig/[id]', params: { id: item.id } })} />
  </View>;
}

const Separator = () => <View style={styles.separator} />;

export default function SavedGigsScreen() {
  const { t } = useTranslation();
  const { enabled, items, loading, error, retry } = useSavedGigs();
  const [visibleCount, setVisibleCount] = useState(20);
  const [revision, setRevision] = useState(0);
  if (!enabled) return <SafeAreaView style={styles.container}>
    <View style={styles.padded}>
      <EmptyState title={t('Saved gigs are for youth accounts')} description={t('Sign in with your youth account to keep opportunities for later.')} />
    </View>
  </SafeAreaView>;
  // Bumping the revision remounts every row, so one pull retries all of them.
  const refresh = () => { retry(); setRevision(value => value + 1); };
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>{t('Saved gigs')}</Text>
      <Text style={styles.subtitle}>{items.length ? t('Saved opportunities: {{count}}', { count: items.length }) : t('Keep your next opportunity close.')}</Text>
    </View>
    <FlatList data={items.slice(0, visibleCount)} keyExtractor={item => `${revision}:${item.gigId}`}
      renderItem={({ item }) => <SavedGigRow gigId={item.gigId} />}
      contentContainerStyle={styles.list} ItemSeparatorComponent={Separator}
      refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={error && items.length > 0 ? <View style={styles.headerError}>
        <ErrorState title={t('Saved gigs could not refresh')} message={t(error)} onRetry={refresh} />
      </View> : null}
      ListEmptyComponent={loading ? <SkeletonList variant="gig" count={3} /> : error
        ? <ErrorState title={t('Unable to load saved gigs')} message={t(error)} onRetry={refresh} />
        : <EmptyState icon="bookmark-outline" title={t('No saved gigs yet')} description={t('Tap the bookmark on a gig to find it here later.')}
          actionLabel={t('Browse gigs')} actionIcon="compass-outline" onAction={() => router.navigate('/(app)/(tabs)/browse')} />}
      ListFooterComponent={items.length > visibleCount ? <Pressable accessibilityRole="button" onPress={() => setVisibleCount(value => value + 20)}
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
        <Text style={styles.moreText}>{t('Load more saved gigs')}</Text>
      </Pressable> : null}
      showsVerticalScrollIndicator={false} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  padded: { padding: spacing.md },
  pressed: { opacity: 0.8 },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, width: '100%', maxWidth: 1040, alignSelf: 'center', flexGrow: 1 },
  separator: { height: spacing.md },
  headerError: { marginBottom: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.md, minHeight: 64, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.lg },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { ...typography.label, color: colors.text },
  noticeText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  noticeAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  retryText: { ...typography.label, color: colors.primary },
  closedWrap: { opacity: 0.75 },
  closedNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginBottom: spacing.xs + 2 },
  closedText: { ...typography.caption, color: colors.textSecondary },
  more: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primaryLight },
  moreText: { ...typography.label, color: colors.primary },
});
