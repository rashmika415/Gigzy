import { Text } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ErrorState, GigCard, LoadingState } from '../../../components';
import BookmarkButton from '../../../components/BookmarkButton';
import { useSavedGigs } from '../../../context/SavedGigsContext';
import { subscribeToGig } from '../../../services/gigService';
import type { Gig } from '../../../types/gig';
import { borderRadius, colors, fonts, spacing } from '../../../constants/theme';

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
      setLoading(true); setError('');
      unsubscribe = subscribeToGig(gigId, value => {
        if (active) { setGig(value); setLoading(false); }
      }, failure => {
        if (active) { setError(failure.message); setLoading(false); }
      });
    });
    return () => { active = false; unsubscribe?.(); };
  }, [gigId, attempt]);

  if (loading) return <View style={styles.unavailable}><LoadingState message={t("Loading saved gig...")} /></View>;
  if (error) return <View style={styles.unavailable}>
    <ErrorState title={t("Unable to load this gig")} message={t(error ?? "")} onRetry={() => setAttempt(value => value + 1)} />
    <BookmarkButton gigId={gigId} showLabel />
  </View>;
  if (!gig) return <View style={styles.unavailable}>
    <View style={styles.unavailableCopy}><Ionicons name="briefcase-outline" size={24} color={colors.textMuted} />
      <Text style={styles.unavailableTitle}>{t("Gig no longer available")}</Text>
      <Text style={styles.subtitle}>{t("This gig has been removed. You can remove it from your saved list.")}</Text>
    </View>
    <BookmarkButton gigId={gigId} showLabel />
  </View>;
  return <GigCard gig={gig} showBookmark onPress={item => router.push({ pathname: '/(app)/gig/[id]', params: { id: item.id } })} />;
}

export default function SavedGigsScreen() {
  const { t } = useTranslation();
  const { enabled, items, loading, error, retry } = useSavedGigs();
  const [visibleCount, setVisibleCount] = useState(20);
  const [revision, setRevision] = useState(0);
  if (!enabled) return <SafeAreaView style={styles.container}><EmptyState title={t("Saved gigs are for youth accounts")} description={t("Sign in with your youth account to keep opportunities for later.")} /></SafeAreaView>;
  const refresh = () => { retry(); setRevision(value => value + 1); };
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
    <View style={styles.header}>
      <View style={styles.heading}><Text style={styles.title}>{t("Saved gigs")}</Text>
        <Text style={styles.subtitle}>{items.length ? t("Saved opportunities: {{count}}", { count: items.length }) : t("Keep your next opportunity close.")}</Text></View>
      <Ionicons name="bookmark" size={25} color={colors.primary} />
    </View>
    <FlatList data={items.slice(0, visibleCount)} keyExtractor={item => `${revision}:${item.gigId}`}
      renderItem={({ item }) => <SavedGigRow gigId={item.gigId} />}
      contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={error && items.length > 0 ? <ErrorState title={t("Saved gigs could not refresh")} message={t(error ?? "")} onRetry={refresh} /> : null}
      ListEmptyComponent={loading ? <LoadingState message={t("Loading your saved gigs...")} /> : error ?
        <ErrorState title={t("Unable to load saved gigs")} message={t(error ?? "")} onRetry={refresh} /> :
        <EmptyState icon="bookmark-outline" title={t("No saved gigs yet")} description={t("Tap the bookmark on a gig to find it here later.")} actionLabel={t("Browse gigs")} actionIcon="compass-outline" onAction={() => router.navigate('/(app)/(tabs)/browse')} />}
      ListFooterComponent={items.length > visibleCount ? <TouchableOpacity accessibilityRole="button" style={styles.more} onPress={() => setVisibleCount(value => value + 20)}><Text style={styles.moreText}>{t("Load more saved gigs")}</Text></TouchableOpacity> : null}
      showsVerticalScrollIndicator={false} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heading: { flex: 1 }, title: { fontFamily: fonts.heading, fontSize: 25, color: colors.text },
  subtitle: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 5 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, width: '100%', maxWidth: 1040, alignSelf: 'center' },
  unavailable: { padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.xl, gap: spacing.md },
  unavailableCopy: { gap: spacing.sm }, unavailableTitle: { fontFamily: fonts.headingSemiBold, fontSize: 17, color: colors.text },
  more: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primaryLight },
  moreText: { fontFamily: fonts.bodyMedium, color: colors.primary },
});
