import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { colors, spacing, borderRadius, fonts } from '../constants/theme';
import { getReviewTarget, submitGigReview } from '../services/reviewService';
import { router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import { subscribeToProfile } from '../services/profileService';
import ReportModal from './reports/ReportModal';
import type { UserData } from '../context/AuthContext';
import type { Gig } from '../types/gig';

export default function RateUserButton({ gig }: { gig: Gig }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const submitting = useRef(false);
  const target = getReviewTarget(gig, user?.uid, userData?.role);
  const [profile, setProfile] = useState<{ id: string; data: UserData | null } | null>(null);
  const [profileError, setProfileError] = useState('');
  const [reviewError, setReviewError] = useState('');
  useEffect(() => {
    if (!target || !user?.uid) return;
    const stopProfile = subscribeToProfile(target, data => { setProfile({ id: target, data }); setProfileError(''); }, () => setProfileError('Could not load profile.'));
    const stopReview = onSnapshot(doc(db, 'users', target, 'reviews', `${gig.id}_${user.uid}`), snapshot => { setReviewed(snapshot.exists()); setReviewError(''); }, () => setReviewError('Could not check your previous review.'));
    return () => { stopProfile(); stopReview(); };
  }, [target, gig.id, user?.uid]);
  const other = profile?.id === target ? profile.data : null;
  const otherName = other?.businessName || other?.fullName || (target === gig.postedBy.uid ? gig.postedBy.fullName : t('Freelancer'));
  const submit = async () => {
    if (!target || submitting.current) return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { setError(t('Choose a rating from 1 to 5.')); return; }
    if (comment.trim().length < 5) { setError(t('Please write a review with at least 5 characters.')); return; }
    submitting.current = true;
    setSaving(true); setError('');
    try {
      await submitGigReview(gig.id, rating, comment);
      setReviewed(true); setVisible(false);
      toast.success(t('Review submitted.'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('Could not submit review.'));
    } finally { submitting.current = false; setSaving(false); }
  };
  if (!target) return null;
  return <>
    <View style={styles.buttonRow}>
      <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={reviewed} onPress={() => { setError(''); setVisible(true); }}>
        <Ionicons name="star-outline" size={18} color={colors.primary} />
        <Text style={styles.label}>{t(reviewed ? 'Review submitted' : 'Rate User')}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.reportBtn} onPress={() => setShowReportModal(true)} accessibilityLabel={t('Report')}>
        <Ionicons name="flag-outline" size={16} color={colors.error} />
        <Text style={styles.reportBtnText}>{t('Report')}</Text>
      </TouchableOpacity>
    </View>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!submitting.current) setVisible(false); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView style={styles.dialog} contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('Rate User')}</Text>
        <View style={styles.party}>
          {other?.photoURL ? <Image source={{ uri: other.photoURL }} style={styles.avatar} /> : <View style={[styles.avatar, styles.fallback]}><Text style={styles.title}>{otherName?.[0]?.toUpperCase()}</Text></View>}
          <View><Text style={styles.title}>{otherName}</Text><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => { setVisible(false); router.push({ pathname: '/(app)/profile/[id]', params: { id: target } }); }}><Text style={styles.label}>{t('View profile')}</Text></TouchableOpacity></View>
        </View>
        {!!profileError && <Text style={styles.error}>{t(profileError)}</Text>}
        {!!reviewError && <Text style={styles.error}>{t(reviewError)}</Text>}
        <Text style={styles.text}>{t(userData?.role === 'client' ? 'Rate the freelancer' : 'Rate the business')}</Text>
        <Text style={styles.text}>{t('Star rating is required (1-5).')}</Text>
        <View style={styles.actions}>{[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={t('{{count}} stars', { count: value })} accessibilityState={{ selected: rating === value }} disabled={saving} style={styles.star} onPress={() => setRating(value)}>
          <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={30} color={colors.star} />
        </TouchableOpacity>)}</View>
        <TextInput style={styles.input} accessibilityLabel={t('Written Review')} placeholder={t('Please write a review with at least 5 characters.')} placeholderTextColor={colors.textMuted} multiline maxLength={1000} editable={!saving} value={comment} onChangeText={setComment} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} disabled={saving} onPress={() => setVisible(false)}><Text style={styles.text}>{t('Cancel')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.button} disabled={saving || !rating || reviewed} onPress={submit}>{saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.label}>{t('Submit Review')}</Text>}</TouchableOpacity>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.dialogReportBtn}
          disabled={saving}
          onPress={() => {
            setVisible(false);
            setShowReportModal(true);
          }}
        >
          <Ionicons name="flag-outline" size={14} color={colors.error} />
          <Text style={styles.dialogReportText}>{t('Report an issue with this user')}</Text>
        </TouchableOpacity>
      </ScrollView></KeyboardAvoidingView>
    </Modal>
    {showReportModal && (
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="user"
        targetId={target}
        targetUserId={target}
        targetUserName={otherName}
        targetGigId={gig.id}
        targetGigTitle={gig.title}
      />
    )}
  </>;
}
const styles = StyleSheet.create({
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.sm, minHeight: 44, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.md },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: spacing.sm, minHeight: 44, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: borderRadius.md, backgroundColor: colors.errorLight },
  reportBtnText: { color: colors.error, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  dialogReportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, marginTop: spacing.xs },
  dialogReportText: { color: colors.error, fontFamily: fonts.bodyMedium, fontSize: 13 },
  label: { color: colors.primary, fontFamily: fonts.bodyBold },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: borderRadius.xl, maxHeight: '90%' },
  dialogContent: { padding: spacing.lg, gap: spacing.md },
  party: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  fallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: fonts.bodyBold, color: colors.text },
  text: { color: colors.text }, error: { color: colors.error },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  star: { padding: 6, minHeight: 44 },
  input: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.md, padding: spacing.sm, minHeight: 90, color: colors.text, textAlignVertical: 'top' },
});
