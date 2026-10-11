import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { createApplication } from '../../services/applicationService';
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

export default function ApplyModal({
  visible,
  gig,
  youthId,
  youthName,
  youthPhotoURL,
  youthSkills,
  youthBio,
  onClose,
  onSuccess,
}: ApplyModalProps) {
  const [message, setMessage] = useState('');
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!gig) return null;

  const isMessageValid = message.trim().length >= 5;
  const canSubmit = isMessageValid && availabilityConfirmed && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (!isMessageValid) {
        setErrorMsg('Please write a message explaining why you are suitable (at least 5 characters).');
      } else if (!availabilityConfirmed) {
        setErrorMsg('Please confirm your availability on the required date and time.');
      }
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

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

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      setMessage('');
      setAvailabilityConfirmed(false);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to submit your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Apply to Gig</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {gig.title}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              disabled={submitting}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Gig Summary Pill */}
            <View style={styles.gigSummaryPill}>
              <Ionicons name="briefcase-outline" size={14} color={colors.primary} />
              <Text style={styles.gigSummaryText} numberOfLines={1}>
                {gig.title} • ${gig.pay}{gig.payType === 'hourly' ? '/hr' : ' fixed'} • {gig.location}
              </Text>
            </View>

            {/* Error Message if any */}
            {Boolean(errorMsg) && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.errorText} />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            {/* Message input */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>
                Application Message <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Tell the business why you are interested and why you are suitable for this gig."
                placeholderTextColor={colors.placeholder}
                value={message}
                onChangeText={(text) => {
                  setMessage(text);
                  if (errorMsg) setErrorMsg('');
                }}
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!submitting}
              />
              <Text style={styles.charCount}>{message.trim().length} / 500 characters</Text>
            </View>

            {/* Availability Confirmation Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setAvailabilityConfirmed((prev) => !prev);
                if (errorMsg) setErrorMsg('');
              }}
              activeOpacity={0.8}
              disabled={submitting}
            >
              <View style={[styles.checkbox, availabilityConfirmed && styles.checkboxActive]}>
                {availabilityConfirmed && <Ionicons name="checkmark" size={16} color={colors.primaryOnColor} />}
              </View>
              <Text style={styles.checkboxLabel}>
                I confirm that I am available on the required date and time. <Text style={styles.requiredStar}>*</Text>
              </Text>
            </TouchableOpacity>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.applyBtn, !canSubmit && styles.applyBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.primaryOnColor} />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color={colors.primaryOnColor} />
                    <Text style={styles.applyBtnText}>Submit Application</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
    gap: spacing.sm,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  gigSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  gigSummaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorBannerText: {
    fontSize: 12,
    color: colors.error,
    flex: 1,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  requiredStar: {
    color: colors.error,
  },
  messageInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  applyBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryOnColor,
  },
});
