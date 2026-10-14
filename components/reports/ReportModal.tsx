import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../LocalizedText';
import { colors, fonts, borderRadius, spacing } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import { REPORT_REASONS, submitReport } from '../../services/reportService';
import type { ReportReason, ReportTargetType } from '../../types/report';

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  targetUserName?: string;
  targetGigId?: string;
  targetGigTitle?: string;
  targetApplicationId?: string;
  defaultReason?: ReportReason;
  onSuccess?: () => void;
}

export default function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  targetUserId,
  targetUserName,
  targetGigId,
  targetGigTitle,
  targetApplicationId,
  defaultReason,
  onSuccess,
}: ReportModalProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [reason, setReason] = useState<ReportReason>(
    defaultReason || (targetType === 'no-show' ? 'no-show' : 'other')
  );
  const [details, setDetails] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset the form each time the sheet opens (deferred so it doesn't cascade renders).
  useEffect(() => {
    if (!visible) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setReason(defaultReason || (targetType === 'no-show' ? 'no-show' : 'other'));
      setDetails('');
      setNote('');
      setErrorMsg('');
      setSubmitting(false);
    });
    return () => { active = false; };
  }, [visible, defaultReason, targetType]);

  const handleSubmit = async () => {
    const clean = details.trim();
    if (clean.length < 5) {
      setErrorMsg(t('Please provide at least 5 characters explaining what happened.'));
      return;
    }
    if (clean.length > 1000) {
      setErrorMsg(t('Details cannot exceed 1,000 characters.'));
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await submitReport({
        targetType,
        targetId,
        targetUserId,
        targetUserName,
        targetGigId,
        targetGigTitle,
        targetApplicationId,
        reason,
        details: clean,
        note: note.trim() || undefined,
      });

      toast.success(
        t('Report submitted'),
        t('Our moderation team will review this report shortly.')
      );
      onClose();
      onSuccess?.();
    } catch (err: any) {
      setErrorMsg(err.message || t('Could not submit report. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const getModalTitle = () => {
    if (targetType === 'no-show') return t('Report No-Show');
    if (targetType === 'gig') return t('Report Gig');
    return t('Report User');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.flagIconWrap}>
                <Ionicons name="flag" size={18} color={colors.error} />
              </View>
              <Text style={styles.headerTitle}>{getModalTitle()}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Target context banner */}
            {(targetUserName || targetGigTitle) && (
              <View style={styles.targetBanner}>
                <Ionicons
                  name={targetType === 'gig' ? 'briefcase-outline' : 'person-outline'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.targetBannerText} numberOfLines={1}>
                  {targetUserName ? `${t('Target')}: ${targetUserName}` : ''}
                  {targetUserName && targetGigTitle ? ' · ' : ''}
                  {targetGigTitle ? `${t('Gig')}: ${targetGigTitle}` : ''}
                </Text>
              </View>
            )}

            {/* Reason selector */}
            <Text style={styles.fieldLabel}>{t('Reason for report')}</Text>
            <View style={styles.reasonsGrid}>
              {REPORT_REASONS.map((item) => {
                const selected = reason === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                    onPress={() => setReason(item.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        selected && styles.reasonChipTextSelected,
                      ]}
                    >
                      {t(item.label)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Details input */}
            <View style={styles.detailsHeader}>
              <Text style={styles.fieldLabel}>{t('Details & explanation')}</Text>
              <Text style={styles.charCount}>{details.length}/1000</Text>
            </View>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={4}
              maxLength={1000}
              placeholder={t('Please describe the issue in detail (minimum 5 characters)...')}
              placeholderTextColor={colors.textMuted}
              value={details}
              onChangeText={setDetails}
              editable={!submitting}
            />

            {/* Additional Note input */}
            <View style={[styles.detailsHeader, { marginTop: 14 }]}>
              <Text style={styles.fieldLabel}>{t('Additional Note')}</Text>
              <Text style={styles.charCount}>{note.length}/1000</Text>
            </View>
            <TextInput
              style={[styles.textInput, styles.noteInput]}
              multiline
              numberOfLines={2}
              maxLength={1000}
              placeholder={t('Add extra remarks, reference notes, or context (optional)...')}
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              editable={!submitting}
            />

            {/* Safety & confidentiality disclaimer */}
            <View style={styles.safetyBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={styles.safetyText}>
                {t('Your report is confidential and sent directly to LocalWorks moderators.')}
              </Text>
            </View>

            {/* Error banner */}
            {Boolean(errorMsg) && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.primaryOnColor} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={16} color={colors.primaryOnColor} />
                  <Text style={styles.submitBtnText}>{t('Submit Report')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flagIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  targetBannerText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primary,
    flex: 1,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  reasonChipSelected: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  reasonChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  reasonChipTextSelected: {
    color: colors.error,
    fontFamily: fonts.bodyBold,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.lg,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  noteInput: {
    minHeight: 65,
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  safetyText: {
    fontSize: 12,
    color: colors.primary,
    lineHeight: 18,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  cancelBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.error,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.primaryOnColor,
  },
});
