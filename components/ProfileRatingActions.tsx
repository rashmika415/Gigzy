import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import RateUserButton from './RateUserButton';
import { useAuth } from '../context/AuthContext';
import { subscribeToClientGigs } from '../services/gigService';
import { getReviewTarget } from '../services/reviewService';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import type { Gig } from '../types/gig';

export default function ProfileRatingActions({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [state, setState] = useState<{ ownerId: string; gigs: Gig[]; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const allowed = !!user && userData?.role === 'client' && user.uid !== userId;
  useEffect(() => {
    if (!allowed || !user) return;
    return subscribeToClientGigs(user.uid,
      gigs => setState({ ownerId: user.uid, gigs, error: false }),
      () => setState({ ownerId: user.uid, gigs: [], error: true }));
  }, [allowed, user, retry]);
  if (!allowed) return null;
  const current = state?.ownerId === user?.uid ? state : null;
  const completed = current?.gigs.filter(gig => getReviewTarget(gig, user?.uid, 'client') === userId) || [];
  return <View style={styles.card}>
    <Text style={styles.title}>{t('Add Ratings')}</Text>
    {!current ? <ActivityIndicator color={colors.primary} /> : current.error ? <>
      <Text style={styles.text}>{t('Ratings unavailable')}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setState(null); setRetry(value => value + 1); }}><Text style={styles.text}>{t('Retry')}</Text></TouchableOpacity>
    </> : completed.length ? completed.map(gig => <View key={gig.id} style={styles.gig}><Text style={styles.text}>{gig.title}</Text><RateUserButton key={gig.id} gig={gig} /></View>) : <>
      <TouchableOpacity disabled accessibilityRole="button" accessibilityState={{ disabled: true }} style={styles.button}><Text style={styles.muted}>{t('Rate User')}</Text></TouchableOpacity>
      <Text style={styles.muted}>{t('Complete a gig with this job seeker to rate them.')}</Text>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: spacing.md, gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16 },
  text: { color: colors.text }, muted: { color: colors.textMuted, lineHeight: 20 },
  button: { minHeight: 44, padding: spacing.sm, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  gig: { gap: spacing.sm },
});
