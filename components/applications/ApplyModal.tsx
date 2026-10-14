import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { createApplication } from '../../services/applicationService';
import { formatCalendarDate, formatCurrency } from '../../localization/format';
import type { Gig } from '../../types/gig';

interface ApplyModalProps {
  visible: boolean;
  gig: Gig | null;
  youthId: string;
  youthName?: string;
  youthPhotoURL?: string;
  youthSkills?: string[];
  youthBio?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const MIN_MESSAGE = 5;
const MAX_MESSAGE = 500;

/** The form only mounts while open, so every opening starts with an empty message and unticked availability. */
export default function ApplyModal({ visible, gig, ...props }: ApplyModalProps) {
  if (!visible || !gig) return null;
  return <ApplyForm key={gig.id} gig={gig} {...props} />;
}

function ApplyForm({
  gig, youthId, youthName, youthPhotoURL, youthSkills, youthBio, onClose, onSuccess,
}: Omit<ApplyModalProps, 'visible' | 'gig'> & { gig: Gig }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inFlight = useRef(false);

  const messageLength = message.trim().length;
  const canSubmit = messageLength >= MIN_MESSAGE && availabilityConfirmed && !submitting;
  const rating = (gig.postedBy as any)?.ratingAverage;

  const handleSubmit = async () => {
    if (inFlight.current) return;
    if (messageLength < MIN_MESSAGE) {
      setErrorMsg('Please write a message explaining why you are suitable (at least 5 characters).');
      return;
    }
    if (!availabilityConfirmed) {
      setErrorMsg('Please confirm your availability on the required date and time.');
      return;
    }

    inFlight.current = true;
    setErrorMsg('');
    setSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await createApplication({
        gigId: gig.id,
        youthId,
        message: message.trim(),
        availabilityConfirmed: true,
        gigTitle: gig.title,
        gigLocation: gig.location,
        gigDate: gig.date,
        gigPay: gig.pay,
        gigPayType: gig.payType,
        gigCategory: gig.category,
        businessId: gig.postedBy?.uid,
        businessName: gig.postedBy?.fullName || 'Business Owner',
        youthName,
        youthPhotoURL,
        youthSkills,
        youthBio,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit your application. Please try again.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel={t('Close')} />

        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.headerTitle}>{t('Apply to Gig')}</Text>
            <Pressable onPress={handleClose} disabled={submitting} accessibilityRole="button" accessibilityLabel={t('Close')}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Gig summary */}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle} numberOfLines={2}>{gig.title}</Text>
              <Text style={styles.summaryPay}>
                {formatCurrency(gig.pay)}
                <Text style={styles.summaryPayType}>{gig.payType === 'hourly' ? t('/hr') : t(' fixed')}</Text>
              </Text>
              <View style={styles.summaryMeta}>
                {!!gig.date && <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{formatCalendarDate(gig.date)}{gig.time ? ` · ${gig.time}` : ''}</Text>
                </View>}
                {!!gig.location && <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText} numberOfLines={1}>{gig.location}</Text>
                </View>}
                {!!gig.postedBy?.fullName && <View style={styles.metaItem}>
                  <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {gig.postedBy.fullName}{typeof rating === 'number' && rating > 0 ? ` · ★ ${rating.toFixed(1)}` : ''}
                  </Text>
                </View>}
              </View>
            </View>

            {/* Message */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>{t('Application Message')}</Text>
              <TextInput
                style={styles.messageInput}
                placeholder={t('Tell the business why you are interested and why you are suitable for this gig.')}
                placeholderTextColor={colors.placeholder}
                value={message}
                onChangeText={text => { setMessage(text); if (errorMsg) setErrorMsg(''); }}
                multiline
                maxLength={MAX_MESSAGE}
                editable={!submitting}
                accessibilityLabel={t('Application Message')}
              />
              <Text style={styles.charCount}>{t('{{count}} / {{max}}', { count: messageLength, max: MAX_MESSAGE })}</Text>
            </View>

            {/* Availability */}
            <Pressable
              style={({ pressed }) => [styles.checkboxRow, availabilityConfirmed && styles.checkboxRowActive, pressed && styles.pressed]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setAvailabilityConfirmed(prev => !prev);
                if (errorMsg) setErrorMsg('');
              }}
              disabled={submitting}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: availabilityConfirmed, disabled: submitting }}
            >
              <View style={[styles.checkbox, availabilityConfirmed && styles.checkboxActive]}>
                {availabilityConfirmed && <Ionicons name="checkmark" size={16} color={colors.primaryOnColor} />}
              </View>
              <Text style={styles.checkboxLabel}>{t('I confirm that I am available on the required date and time.')}</Text>
            </Pressable>

            {!!errorMsg && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorBannerText}>{t(errorMsg)}</Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
            <Pressable onPress={handleClose} disabled={submitting} accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable onPress={handleSubmit} disabled={submitting} accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              style={({ pressed }) => [styles.button, styles.applyBtn, !canSubmit && !submitting && styles.applyBtnDisabled, pressed && styles.pressed]}>
              {submitting ? <ActivityIndicator size="small" color={colors.primaryOnColor} /> : <>
                <Ionicons name="paper-plane" size={16} color={canSubmit ? colors.primaryOnColor : colors.textMuted} />
                <Text style={[styles.applyBtnText, !canSubmit && styles.applyBtnTextDisabled]}>{t('Submit Application')}</Text>
              </>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.surfaceBorder, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  headerTitle: { ...typography.h2, color: colors.text },
  closeBtn: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  pressed: { opacity: 0.8 },
  body: { flexGrow: 0 },
  bodyContent: { padding: spacing.lg, gap: spacing.md },
  summary: { padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.surfaceBorderSubtle, gap: spacing.xs },
  summaryTitle: { ...typography.title, color: colors.text },
  summaryPay: { ...typography.h3, color: colors.primary },
  summaryPayType: { ...typography.bodySmall, color: colors.primary },
  summaryMeta: { gap: spacing.xs, marginTop: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.bodySmall, color: colors.textSecondary, flexShrink: 1 },
  fieldWrap: { gap: spacing.xs + 2 },
  fieldLabel: { ...typography.label, color: colors.text },
  messageInput: { ...typography.body, backgroundColor: colors.inputBg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.inputBorder, padding: spacing.md, color: colors.text, minHeight: 120, textAlignVertical: 'top' },
  charCount: { ...typography.caption, color: colors.textMuted, textAlign: 'right' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.md, minHeight: 56, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  checkboxRowActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryLight },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.surfaceBorder, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { ...typography.bodySmall, color: colors.text, flex: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + spacing.xs, borderRadius: borderRadius.md, backgroundColor: colors.errorLight, borderWidth: 1, borderColor: colors.errorBorder },
  errorBannerText: { ...typography.bodySmall, color: colors.error, flex: 1 },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  button: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.md, paddingHorizontal: spacing.md },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  cancelBtnText: { ...typography.title, fontSize: 15, color: colors.textSecondary },
  applyBtn: { flex: 2, backgroundColor: colors.primary },
  applyBtnDisabled: { backgroundColor: colors.surfaceElevated },
  applyBtnText: { ...typography.title, fontSize: 15, color: colors.primaryOnColor },
  applyBtnTextDisabled: { color: colors.textMuted },
});
