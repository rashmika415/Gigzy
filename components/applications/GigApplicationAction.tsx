import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../LocalizedText';
import ApplyModal from './ApplyModal';
import { useAuth } from '../../context/AuthContext';
import { subscribeToUserApplicationForGig } from '../../services/applicationService';
import type { Application } from '../../types/application';
import type { Gig } from '../../types/gig';
import { colors } from '../../constants/theme';

export default function GigApplicationAction({ gig }: { gig: Gig }) {
  const { user, userData } = useAuth();
  if (!user || userData?.role !== 'freelancer' || userData.suspended || gig.postedBy.uid === user.uid) return null;
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
  return <View style={styles.container}>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
    <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={loading || (!error && !applied && gig.status !== 'open')}
      onPress={() => {
        if (error) { setLoading(true); setError(''); setAttempt(value => value + 1); }
        else if (applied) router.push('/(app)/applications');
        else setVisible(true);
      }}>
      {loading ? <ActivityIndicator color={colors.primaryOnColor} /> : <Text style={styles.label}>
        {error ? t('Retry application status') : applied ? t('View my application') : gig.status === 'open' ? t('Apply to this gig') : t('Applications closed')}
      </Text>}
    </TouchableOpacity>
    {application && <Text style={styles.note}>{t('Application status: {{status}}', { status: t(application.status) })}</Text>}
    {visible && gig.status === 'open' && <ApplyModal visible gig={gig} youthId={user!.uid}
      youthName={userData?.fullName} youthPhotoURL={userData?.photoURL}
      youthSkills={userData?.skills?.split(',').map(value => value.trim()).filter(Boolean)} youthBio={userData?.bio}
      onClose={() => setVisible(false)} onSuccess={() => { setSubmitted(true); setVisible(false); }} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, gap: 8 }, button: { minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.primaryOnColor, fontWeight: '700', textAlign: 'center' }, note: { color: colors.textSecondary, textAlign: 'center' }, error: { color: colors.error },
});
