import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../LocalizedText';
import ApplyModal from './ApplyModal';
import { useAuth } from '../../context/AuthContext';
import { subscribeToUserApplicationForGig } from '../../services/applicationService';
import type { Application } from '../../types/application';
import type { Gig } from '../../types/gig';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', completed: 'Completed' };

export default function GigApplicationAction({ gig }: { gig: Gig }) {
  const { user, userData } = useAuth();
  const { t } = useTranslation();

  if (!user) {
    return <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/login' as any)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.label}>{t('Sign In to Apply')}</Text>
      </Pressable>
    </View>;
  }

  // Prevent client/gig creator or suspended users from applying
  const isClient = userData?.role === 'client';
  const isGigOwner = gig.postedBy?.uid === user.uid;
  if (userData?.suspended) return null;
  if ((isClient || isGigOwner) && process.env.NODE_ENV === 'production') return null;

  return <ApplicationAction key={`${gig.id}-${user.uid}`} gig={gig} />;
}

function ApplicationAction({ gig }: { gig: Gig }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => subscribeToUserApplicationForGig(gig.id, user!.uid, value => {
    setApplication(value); setLoading(false); setError('');
  }, failure => { setLoading(false); setError(failure.message); }), [gig.id, user, attempt]);

  const applied = !!application || submitted;
  const closed = !error && !applied && gig.status !== 'open';
  const label = error ? t('Retry application status')
    : applied ? t('View my application')
    : closed ? t('Applications closed') : t('Apply to this gig');
  const status = application ? t(STATUS_LABEL[application.status] ?? application.status) : submitted ? t('Pending') : '';

  return <View style={styles.container}>
    <Pressable accessibilityRole="button" disabled={loading || closed}
      accessibilityState={{ disabled: loading || closed, busy: loading }}
      accessibilityHint={error ? t(error) : undefined}
      onPress={() => {
        if (error) { setLoading(true); setError(''); setAttempt(value => value + 1); }
        else if (applied) router.push('/(app)/applications');
        else setVisible(true);
      }}
      style={({ pressed }) => [styles.button, applied && styles.secondary, closed && styles.closed, error && styles.errorButton, pressed && styles.pressed]}>
      {loading ? <ActivityIndicator color={colors.primaryOnColor} /> : <>
        {closed && <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />}
        {!!error && <Ionicons name="refresh" size={16} color={colors.error} />}
        <View style={styles.labelWrap}>
          <Text style={[styles.label, applied && styles.secondaryLabel, closed && styles.closedLabel, error && styles.errorLabel]} numberOfLines={1}>{label}</Text>
          {applied && !!status && <Text style={styles.status} numberOfLines={1}>{t('Status: {{status}}', { status })}</Text>}
        </View>
      </>}
    </Pressable>
    {visible && gig.status === 'open' && <ApplyModal visible gig={gig} youthId={user!.uid}
      youthName={userData?.fullName} youthPhotoURL={userData?.photoURL}
      youthSkills={userData?.skills?.split(',').map(value => value.trim()).filter(Boolean)} youthBio={userData?.bio}
      onClose={() => setVisible(false)} onSuccess={() => { setSubmitted(true); setVisible(false); }} />}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  button: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary },
  pressed: { opacity: 0.85 },
  labelWrap: { alignItems: 'center', flexShrink: 1 },
  label: { ...typography.title, color: colors.primaryOnColor, textAlign: 'center' },
  secondary: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder },
  secondaryLabel: { color: colors.primaryDark },
  status: { ...typography.caption, fontFamily: typography.bodySmall.fontFamily, color: colors.primaryDark },
  closed: { backgroundColor: colors.surfaceElevated },
  closedLabel: { color: colors.textSecondary },
  errorButton: { backgroundColor: colors.errorLight },
  errorLabel: { color: colors.error },
});
