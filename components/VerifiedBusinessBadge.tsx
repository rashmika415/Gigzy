import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import { subscribeToProfile } from '../services/profileService';
import { isBusinessVerified } from '../services/businessVerificationService';
import { colors } from '../constants/theme';
export default function VerifiedBusinessBadge({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    return subscribeToProfile(userId, profile => setVerifiedId(isBusinessVerified(profile) ? userId : null), () => setVerifiedId(null));
  }, [userId]);
  if (verifiedId !== userId) return null;
  return <View style={styles.badge}><Ionicons name="checkmark-circle" size={15} color={colors.primary} /><Text style={styles.text}>{t('Verified Business')}</Text></View>;
}
const styles = StyleSheet.create({ badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryLight }, text: { color: colors.primary, fontSize: 12, fontWeight: '600' } });
