import { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import ApplicantListModal from './applications/ApplicantListModal';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import type { Gig } from '../types/gig';

export default function ViewApplicantsButton({ gig }: { gig: Gig }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [visible, setVisible] = useState(false);
  if (!user || userData?.role !== 'client' || gig.postedBy.uid !== user.uid) return null;
  return <>
    <TouchableOpacity style={styles.button} accessibilityRole="button" onPress={() => setVisible(true)}>
      <Ionicons name="people-outline" size={18} color={colors.primary} />
      <Text style={styles.label}>{t('View Applications')} ({gig.applicantsCount || 0})</Text>
    </TouchableOpacity>
    <ApplicantListModal key={gig.id} visible={visible} gigId={gig.id} gigTitle={gig.title} businessId={user.uid} onClose={() => setVisible(false)} />
  </>;
}
const styles = StyleSheet.create({
  button: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 44, padding: spacing.sm, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.md },
  label: { color: colors.primary, fontFamily: fonts.bodyBold },
});
