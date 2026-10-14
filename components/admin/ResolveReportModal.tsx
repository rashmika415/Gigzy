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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../LocalizedText';
import { colors, fonts, borderRadius, spacing } from '../../constants/theme';
import { resolveReport } from '../../services/reportService';
import type {
  Report,
  ReportResolutionAction,
} from '../../types/report';
import { formatDate } from '../../localization/format';

export interface ResolveReportModalProps {
  visible: boolean;
  report: Report | null;
  onClose: () => void;
  onResolved: () => void;
}

const ACTION_OPTIONS: {
  key: ReportResolutionAction;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
}[] = [
  {
    key: 'dismissed',
    label: 'Dismiss report',
    description: 'No violation found or issue resolved amicably. No penalty to target.',
    icon: 'close-circle-outline',
  },
  {
    key: 'warning',
    label: 'Issue warning',
    description: 'Send an official moderation warning to the reported user.',
    icon: 'warning-outline',
    danger: true,
  },
  {
    key: 'temporary_suspension',
    label: 'Temporary suspension',
    description: 'Suspend user account temporarily (blocks login and applications).',
    icon: 'time-outline',
    danger: true,
  },
  {
    key: 'permanent_suspension',
    label: 'Permanent suspension',
    description: 'Permanently deactivate the reported user account.',
    icon: 'ban-outline',
    danger: true,
  },
  {
    key: 'gig_removed',
    label: 'Remove gig from discovery',
    description: 'Close the gig and prevent further applications or discovery.',
    icon: 'trash-outline',
    danger: true,
  },
  {
    key: 'none',
    label: 'Mark resolved (no action)',
    description: 'Mark report resolved without taking automated moderation penalties.',
    icon: 'checkmark-circle-outline',
  },
];

export default function ResolveReportModal({
  visible,
  report,
  onClose,
  onResolved,
}: ResolveReportModalProps) {
  const { t } = useTranslation();

  const [action, setAction] = useState<ReportResolutionAction>('dismissed');
  const [durationDays, setDurationDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset the form for each report (deferred so it doesn't cascade renders).
  useEffect(() => {
    if (!visible || !report) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      // Default recommended action based on target
      setAction(report.targetType === 'gig' ? 'gig_removed' : 'warning');
      setNotes('');
      setDurationDays(7);
      setErrorMsg('');
      setSubmitting(false);
    });
    return () => { active = false; };
  }, [visible, report]);

  if (!report) return null;

  const handleResolve = async () => {
    const clean = notes.trim();
    if (clean.length < 5) {
      setErrorMsg(t('Resolution notes must be at least 5 characters.'));
      return;
    }
    if (clean.length > 500) {
      setErrorMsg(t('Resolution notes cannot exceed 500 characters.'));
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await resolveReport({
        reportId: report.id,
        action,
        notes: clean,
        suspensionDurationDays: durationDays,
      });

      onResolved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || t('Failed to resolve report.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isUserTarget = Boolean(report.targetUserId || report.targetType === 'user');
  const isGigTarget = Boolean(report.targetGigId || report.targetType === 'gig');

  const filteredActions = ACTION_OPTIONS.filter((opt) => {
    if (opt.key === 'gig_removed' && !isGigTarget) return false;
    if (
      (opt.key === 'warning' ||
        opt.key === 'temporary_suspension' ||
        opt.key === 'permanent_suspension') &&
      !isUserTarget
    ) {
      return false;
    }
    return true;
  });

  const createdDate = report.createdAt?.toDate?.()
    ? formatDate(report.createdAt.toDate())
    : t('Recently');

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
              <View style={styles.iconWrap}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              </View>
              <Text style={styles.headerTitle}>{t('Review & Resolve Report')}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Meta summary card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Target Type')}:</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {report.targetType.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.summaryLabel}>{t('Reason')}:</Text>
                <View style={styles.reasonBadge}>
                  <Text style={styles.reasonBadgeText}>{report.reason}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Reporter')}:</Text>
                <Text style={styles.summaryValue}>
                  {report.reporterName} ({report.reporterRole})
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Target')}:</Text>
                <Text style={styles.summaryValueBold}>
                  {report.targetUserName || report.targetGigTitle || report.targetId}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Submitted')}:</Text>
                <Text style={styles.summaryValue}>{createdDate}</Text>
              </View>

              <View style={styles.detailsBox}>
                <Text style={styles.detailsBoxLabel}>{t('Report Details')}:</Text>
                <Text style={styles.detailsBoxText}>{report.details}</Text>
              </View>

              {Boolean(report.note) && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteBoxLabel}>{t('Additional Note')}:</Text>
                  <Text style={styles.noteBoxText}>{report.note}</Text>
                </View>
              )}
            </View>

            {/* Action selection */}
            <Text style={styles.sectionTitle}>{t('Moderation Action')}</Text>
            <View style={styles.actionsList}>
              {filteredActions.map((opt) => {
                const selected = action === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.actionOption, selected && styles.actionOptionSelected]}
                    onPress={() => setAction(opt.key)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.actionRadio,
                        selected && styles.actionRadioSelected,
                        opt.danger && selected && styles.actionRadioDanger,
                      ]}
                    >
                      {selected && <View style={styles.actionRadioInner} />}
                    </View>
                    <View style={styles.actionContent}>
                      <View style={styles.actionTitleRow}>
                        <Ionicons
                          name={opt.icon}
                          size={16}
                          color={
                            opt.danger ? colors.error : colors.primary
                          }
                        />
                        <Text
                          style={[
                            styles.actionTitle,
                            opt.danger && styles.actionTitleDanger,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </View>
                      <Text style={styles.actionDesc}>{t(opt.description)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Suspension duration options */}
            {action === 'temporary_suspension' && (
              <View style={styles.durationSection}>
                <Text style={styles.fieldLabel}>{t('Suspension Duration')}</Text>
                <View style={styles.durationPills}>
                  {[3, 7, 14, 30].map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.durationPill,
                        durationDays === days && styles.durationPillSelected,
                      ]}
                      onPress={() => setDurationDays(days)}
                    >
                      <Text
                        style={[
                          styles.durationPillText,
                          durationDays === days && styles.durationPillTextSelected,
                        ]}
                      >
                        {days} {t('days')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Resolution notes */}
            <View style={styles.notesHeader}>
              <Text style={styles.fieldLabel}>
                {t('Resolution Notes & Findings')}
              </Text>
              <Text style={styles.charCount}>{notes.length}/500</Text>
            </View>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={3}
              maxLength={500}
              placeholder={t('Enter explanation of action taken (5-500 characters)...')}
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              editable={!submitting}
            />

            {/* Error display */}
            {Boolean(errorMsg) && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
              onPress={handleResolve}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.primaryOnColor} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={16} color={colors.primaryOnColor} />
                  <Text style={styles.confirmBtnText}>{t('Apply & Resolve')}</Text>
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
    maxWidth: 580,
    maxHeight: '92%',
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
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  summaryValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.text,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  typeBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.primary,
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warningLight,
  },
  reasonBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.warning,
  },
  detailsBox: {
    marginTop: 6,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
    gap: 4,
  },
  detailsBoxLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailsBoxText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  noteBox: {
    marginTop: 6,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
    gap: 4,
  },
  noteBoxLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.primary,
  },
  noteBoxText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  actionsList: {
    gap: 8,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  actionOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  actionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  actionRadioSelected: {
    borderColor: colors.primary,
  },
  actionRadioDanger: {
    borderColor: colors.error,
  },
  actionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  actionContent: {
    flex: 1,
    gap: 3,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  actionTitleDanger: {
    color: colors.error,
  },
  actionDesc: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  durationSection: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.text,
  },
  durationPills: {
    flexDirection: 'row',
    gap: 8,
  },
  durationPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  durationPillSelected: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  durationPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  durationPillTextSelected: {
    color: colors.error,
    fontFamily: fonts.bodyBold,
  },
  notesHeader: {
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
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
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
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.primaryOnColor,
  },
});
