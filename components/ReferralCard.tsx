import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import { useAuth } from '../context/AuthContext';
import { ensureReferralCode, subscribeToReferralCount } from '../services/referralService';
import { colors, fonts } from '../constants/theme';

export default function ReferralCard() {
  const { user, userData } = useAuth();
  if (!user || !userData || userData.suspended) return null;
  return <AccountReferrals key={user.uid} userId={user.uid} />;
}
function AccountReferrals({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [count, setCount] = useState<number>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void ensureReferralCode(userId).then(value => { if (active) setCode(value); }, () => {
      if (active) setError('Invitations are unavailable. Please retry.');
    });
    const unsubscribe = subscribeToReferralCount(userId, value => { if (active) setCount(value); }, () => {
      if (active) setError('Invitations are unavailable. Please retry.');
    });
    return () => { active = false; unsubscribe(); };
  }, [userId, attempt]);
  const share = async () => {
    try { await Share.share({ message: t('Join me on Gigzy! Enter my referral code {{code}} when creating your account.', { code }) }); }
    catch { setError('Could not share the code. You can copy the code above.'); }
  };
  return <View style={styles.card}>
    <Text style={styles.title}>{t('Invite friends')}</Text>
    <Text style={styles.body}>{t('Share your code. Friends can enter it when they sign up as youth or a business.')}</Text>
    {code ? <Text selectable style={styles.code}>{code}</Text> : !error && <ActivityIndicator color={colors.primary} />}
    {count !== undefined && <Text style={styles.body}>{t('Successful signups: {{count}}', { count })}</Text>}
    {!!code && <TouchableOpacity accessibilityRole="button" onPress={share}><Text style={styles.link}>{t('Share referral code')}</Text></TouchableOpacity>}
    {!!error && <><Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { setError(''); setAttempt(value => value + 1); }}><Text style={styles.link}>{t('Retry')}</Text></TouchableOpacity></>}
  </View>;
}
const styles = StyleSheet.create({ card: { marginVertical: 16, padding: 20, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, gap: 12 },
  title: { fontSize: 18, fontFamily: fonts.bodyBold, color: colors.text }, body: { color: colors.textSecondary, lineHeight: 21 }, code: { fontSize: 24, fontFamily: fonts.heading, letterSpacing: 3, color: colors.primary },
  link: { paddingVertical: 10, color: colors.primary, fontFamily: fonts.bodySemiBold }, error: { color: colors.error } });
