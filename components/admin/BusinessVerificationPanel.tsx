import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../LocalizedText';
import { colors, spacing } from '../../constants/theme';
import { decideBusinessVerification, subscribeToPendingVerifications, type VerificationRequest } from '../../services/businessVerificationService';
export default function BusinessVerificationPanel() {
  const { t } = useTranslation(); const [rows, setRows] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => subscribeToPendingVerifications(items => { setRows(items); setLoading(false); setError(''); }, failure => { setError(failure.message); setLoading(false); }), [retry]);
  return <View style={styles.panel}><Text style={styles.title}>{t('Business verification')}</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <><Text style={styles.error}>{t(error)}</Text><TouchableOpacity style={styles.button} onPress={() => { setLoading(true); setRetry(value => value + 1); }}><Text>{t('Retry')}</Text></TouchableOpacity></> : !rows.length ? <Text style={styles.text}>{t('No pending verification requests.')}</Text> : rows.map(item => <Request key={item.id} item={item} />)}
  </View>;
}
function Request({ item }: { item: VerificationRequest }) {
  const { t } = useTranslation(); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const decide = async (status: 'VERIFIED' | 'REJECTED') => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await decideBusinessVerification(item.businessId, status, reason); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update verification.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={styles.card}><Text style={styles.title}>{item.businessName}</Text>
    <Text selectable style={styles.text}>{item.fullName}{'\n'}{item.email}{'\n'}{item.phone}{'\n'}{item.address}</Text>
    <Text style={styles.text}>{item.businessCategory}</Text><Text style={styles.text}>{item.businessDetails}</Text>
    <Text style={styles.label}>{t('Verification details')}</Text><Text selectable style={styles.text}>{item.details}</Text>
    <TextInput accessibilityLabel={t('Rejection reason')} placeholder={t('Rejection reason')} value={reason} onChangeText={setReason} maxLength={500} editable={!busy} multiline style={styles.input} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
    <View style={styles.actions}><TouchableOpacity style={styles.button} accessibilityRole="button" disabled={busy} onPress={() => void decide('VERIFIED')}><Text style={styles.link}>{t('Approve')}</Text></TouchableOpacity><TouchableOpacity style={styles.button} accessibilityRole="button" disabled={busy} onPress={() => void decide('REJECTED')}><Text style={styles.error}>{t('Reject')}</Text></TouchableOpacity>{busy && <ActivityIndicator color={colors.primary} />}</View>
  </View>;
}
const styles = StyleSheet.create({ panel: { gap: spacing.md }, card: { padding: spacing.lg, gap: spacing.sm, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder }, title: { color: colors.text, fontSize: 20, fontWeight: '700' }, label: { color: colors.text, fontWeight: '600' }, text: { color: colors.textSecondary, lineHeight: 22 }, input: { color: colors.text, padding: spacing.sm, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, minHeight: 70 }, actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }, button: { padding: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, minHeight: 44 }, link: { color: colors.primary, fontWeight: '600' }, error: { color: colors.error } });
