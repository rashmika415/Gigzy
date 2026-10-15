import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from './LocalizedText';
import { colors, spacing } from '../constants/theme';
import type { UserData } from '../context/AuthContext';
import { isBusinessVerified, submitBusinessVerification, subscribeToVerificationRequest, type VerificationRequest } from '../services/businessVerificationService';

export default function BusinessVerificationCard({ userId, profile }: { userId: string; profile: UserData | null }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    return subscribeToVerificationRequest(userId, value => {
      setRequest(value);
      setLoading(false);
      setLoadError('');
      setSubmitted(false);
    }, () => {
      setLoadError('Could not load verification status. Please retry.');
      setLoading(false);
    });
  }, [userId, retry]);

  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await submitBusinessVerification(details);
      setSubmitted(true);
      setDetails('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not submit verification. Please retry.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const verified = isBusinessVerified(profile);
  const pending = submitted || profile?.verificationStatus === 'PENDING' || request?.status === 'PENDING';
  return <View style={styles.card}>
    <Text style={styles.title}>{t('Business verification')}</Text>
    {verified ? <Text style={styles.status}>{t('Verified Business')}</Text>
      : loading ? <ActivityIndicator color={colors.primary} />
      : loadError ? <>
        <Text accessibilityRole="alert" style={styles.error}>{t(loadError)}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setLoading(true); setLoadError(''); setRetry(value => value + 1); }}><Text style={styles.buttonText}>{t('Retry')}</Text></TouchableOpacity>
      </> : pending ? <Text accessibilityLiveRegion="polite" style={styles.status}>{t('Verification pending. Your request has been sent to the admin for review.')}</Text>
      : <>
        {request?.status === 'REJECTED' && <Text style={styles.error}>{t('Verification rejected')}: {request.rejectionReason}</Text>}
        <Text style={styles.body}>{t('Complete your business name, email, phone, address and business description in Edit Profile before applying. Add your registration details below for the admin to review.')}</Text>
        <TextInput accessibilityLabel={t('Verification details')} placeholder={t('Business registration number and supporting details')} value={details} onChangeText={setDetails} multiline maxLength={2000} editable={!busy} style={styles.input} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || details.trim().length < 5, busy }} style={[styles.button, (busy || details.trim().length < 5) && styles.disabled]} disabled={busy || details.trim().length < 5} onPress={() => void submit()}>
          {busy ? <ActivityIndicator color={colors.primaryOnColor} /> : <Text style={styles.buttonText}>{t('Apply for Verification')}</Text>}
        </TouchableOpacity>
      </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.textSecondary, lineHeight: 22 },
  status: { color: colors.primary, lineHeight: 22, fontWeight: '600' },
  error: { color: colors.error, lineHeight: 22 },
  input: { color: colors.text, padding: spacing.md, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, minHeight: 100, textAlignVertical: 'top' },
  button: { minHeight: 48, padding: spacing.md, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.primaryOnColor, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
