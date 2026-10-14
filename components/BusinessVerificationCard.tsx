import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from './LocalizedText';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';
import { submitBusinessVerification, subscribeToVerificationRequest, type VerificationRequest } from '../services/businessVerificationService';
export default function BusinessVerificationCard() {
  const { t } = useTranslation(); const { user, userData } = useAuth();
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [details, setDetails] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!user || userData?.role !== 'client') return;
    return subscribeToVerificationRequest(user.uid, setRequest, failure => setError(failure.message));
  }, [user, userData?.role]);
  if (!user || userData?.role !== 'client') return null;
  const status = userData.verificationStatus;
  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try { await submitBusinessVerification(details); setDetails(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not submit verification.'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <View style={styles.card}><Text style={styles.title}>{t('Business verification')}</Text>
    {!!status && <Text style={styles.text}>{t(status)}</Text>}
    {status === 'PENDING' ? <Text style={styles.text}>{t('Your verification request is awaiting admin review.')}</Text> : status === 'VERIFIED' ? <Text style={styles.text}>{t('Your business is verified.')}</Text> : <>
      {!!request?.rejectionReason && <Text style={styles.error}>{request.rejectionReason}</Text>}
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/edit-profile')}><Text style={styles.link}>{t('Edit Profile')}</Text></TouchableOpacity>
      <Text style={styles.text}>{t('Provide your business registration information and any details that help verify your business.')}</Text>
      <TextInput accessibilityLabel={t('Verification details')} placeholder={t('Verification details')} value={details} onChangeText={setDetails} multiline maxLength={2000} editable={!saving} style={styles.input} />
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={submit} style={styles.button}>{saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.link}>{t('Submit for verification')}</Text>}</TouchableOpacity>
    </>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: spacing.lg, gap: spacing.sm, marginBottom: spacing.md, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder }, title: { color: colors.text, fontSize: 17, fontWeight: '700' }, text: { color: colors.textSecondary, lineHeight: 21 }, link: { color: colors.primary, fontWeight: '600' }, input: { minHeight: 100, textAlignVertical: 'top', color: colors.text, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: spacing.sm }, button: { minHeight: 44, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12 }, error: { color: colors.error } });
