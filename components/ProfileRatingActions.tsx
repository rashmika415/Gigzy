import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import RateUserButton from './RateUserButton';
import { useAuth } from '../context/AuthContext';
import { subscribeToAssignedGigs, subscribeToClientGigs } from '../services/gigService';
import { getReviewTarget } from '../services/reviewService';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import type { Gig } from '../types/gig';

export default function ProfileRatingActions({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [state, setState] = useState<{ viewerId: string; role: string; gigs: Gig[]; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const viewerRole = userData?.role;
  const allowed = !!user && ['client', 'freelancer', 'youth'].includes(viewerRole || '') && user.uid !== userId;
  useEffect(() => {
    if (!allowed || !user || !viewerRole) return;
    const subscribe = viewerRole === 'client' ? subscribeToClientGigs : subscribeToAssignedGigs;
    return subscribe(user.uid,
      gigs => setState({ viewerId: user.uid, role: viewerRole, gigs, error: false }),
      () => setState({ viewerId: user.uid, role: viewerRole, gigs: [], error: true }));
  }, [allowed, user, viewerRole, retry]);
  if (!allowed) return null;
  const current = state?.viewerId === user?.uid && state.role === viewerRole ? state : null;
  const completed = current?.gigs.filter(gig => getReviewTarget(gig, user?.uid, viewerRole) === userId) || [];
  return <View style={styles.card}>
    <Text style={styles.title}>{t('Add Ratings')}</Text>
    {!current ? <ActivityIndicator color={colors.primary} /> : current.error ? <>
      <Text style={styles.text}>{t('Ratings unavailable')}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setState(null); setRetry(value => value + 1); }}><Text style={styles.text}>{t('Retry')}</Text></TouchableOpacity>
    </> : completed.length ? completed.map(gig => <View key={gig.id} style={styles.gig}><Text style={styles.text}>{gig.title}</Text><RateUserButton key={gig.id} gig={gig} /></View>) : <>
      <TouchableOpacity disabled accessibilityRole="button" accessibilityState={{ disabled: true }} style={styles.button}><Text style={styles.muted}>{t('Rate User')}</Text></TouchableOpacity>
      <Text style={styles.muted}>{t(viewerRole === 'client' ? 'Complete a gig with this job seeker to rate them.' : 'Complete a gig with this business to rate them.')}</Text>
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
