import { formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React, { useRef, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import type { Application } from '../../types/application';
import { acceptApplication, rejectApplication } from '../../services/applicationService';
import { getStatusTheme } from './ApplicationCard';
import { useToast } from '../../context/ToastContext';

interface ApplicantDetailModalProps {
  visible: boolean;
  application: Application | null;
  businessId: string;
  onClose: () => void;
  onStatusChanged?: (newStatus: 'accepted' | 'rejected') => void;
  onAccepted?: (app: Application) => void;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return 'Recently';
  const date = timestamp?.toDate
    ? timestamp.toDate()
    : timestamp?.toMillis
    ? new Date(timestamp.toMillis())
    : new Date(timestamp);

  if (isNaN(date.getTime())) return 'Recently';
  return localizedDate(date, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ApplicantDetailModal({
  visible,
  application,
  businessId,
  onClose,
  onStatusChanged,
  onAccepted,
}: ApplicantDetailModalProps) {
  useTranslation();
  const [acting, setActing] = useState(false);
  const submitting = useRef(false);
  const toast = useToast();
  const [errorMsg, setErrorMsg] = useState('');

  if (!application) return null;

  const statusTheme = getStatusTheme(application.status);
  const appliedDateStr = formatDate(application.createdAt);
  const initial = (application.youthName?.[0] || 'Y').toUpperCase();
  const isPending = application.status === 'pending';

  const executeAccept = async () => {
    if (submitting.current || !isPending) return;
    submitting.current = true;
    setActing(true);
    setErrorMsg('');
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      await acceptApplication(application.id, businessId);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      if (onAccepted) {
        onAccepted(application);
      } else {
        toast.success(
          tr("Application Accepted! 🎉"),
          tr("You have accepted {{value0}} for \"{{value1}}\". Work is now in progress and a notification has been sent to the youth freelancer's dashboard.", { value0: application.youthName || 'this applicant', value1: application.gigTitle || 'this gig' })
        );
      }
      if (onStatusChanged) onStatusChanged('accepted');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept application.');
    } finally {
      submitting.current = false;
      setActing(false);
    }
  };

  const handleAccept = () => {
    if (Platform.OS === 'web') {
      void executeAccept();
    } else {
      Alert.alert(
        tr("Accept Application"),
        tr("Are you sure you want to accept {{value0}} for \"{{value1}}\"?", { value0: application.youthName || 'this applicant', value1: application.gigTitle || 'this gig' }),
        [
          { text: tr("Cancel"), style: 'cancel' },
          {
            text: tr("Accept Applicant"),
            style: 'default',
            onPress: () => void executeAccept(),
          },
        ]
      );
    }
  };

  const executeReject = async () => {
    if (submitting.current || !isPending) return;
    submitting.current = true; setActing(true); setErrorMsg('');
    try {
      await rejectApplication(application.id, businessId);
      toast.success(tr('Application Rejected'), tr('The application has been rejected.'));
      onStatusChanged?.('rejected'); onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to reject application.');
    } finally { submitting.current = false; setActing(false); }
  };
  const handleReject = () => {
    if (Platform.OS === 'web') { void executeReject(); return; }
    Alert.alert(tr('Reject Application'), tr('Are you sure you want to reject this application from {{value0}}?', { value0: application.youthName || 'this applicant' }), [
      { text: tr('Cancel'), style: 'cancel' },
      { text: tr('Reject'), style: 'destructive', onPress: () => void executeReject() },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={tr("Close applicant details")}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tr("Applicant Details")}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Error Banner if any */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorText}>{tr(errorMsg)}</Text>
            </View>
          ) : null}

          {/* Profile Overview Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarRow}>
              {application.youthPhotoURL ? (
                <Image source={{ uri: application.youthPhotoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.nameWrap}>
                <Text style={styles.youthName}>
                  {application.youthName || tr("Youth Freelancer")}
                </Text>
                <Text style={styles.appliedDate}>{tr("Applied on")}{' '}{appliedDateStr}</Text>
                {application.youthRatingAverage && application.youthRatingAverage > 0 ? (
                  <View style={styles.detailRatingBadge}>
                    <Ionicons name="star" size={13} color={colors.star} />
                    <Text style={styles.detailRatingText}>
                      {application.youthRatingAverage.toFixed(1)}{' '}{tr("Rating")}{application.youthRatingCount ? tr(" ({{value0}} reviews)", { value0: application.youthRatingCount }) : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Status Badge */}
            <View
              style={[
                styles.statusBanner,
                { backgroundColor: statusTheme.bg, borderColor: statusTheme.border },
              ]}
            >
              <Ionicons name={statusTheme.icon} size={18} color={statusTheme.text} />
              <Text style={[styles.statusBannerText, { color: statusTheme.text }]}>{tr("Application Status:")}{' '}{tr(statusTheme.label)}
              </Text>
            </View>
          </View>

          {/* Application Message Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{tr("APPLICATION MESSAGE")}</Text>
            <View style={styles.messageBox}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.messageText}>
                {application.message || tr("No message provided.")}
              </Text>
            </View>
          </View>

          {/* Availability Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{tr("AVAILABILITY CONFIRMATION")}</Text>
            <View style={styles.availabilityRow}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color={colors.success} />
              </View>
              <Text style={styles.availabilityText}>{tr("Confirmed available on the required date and time.")}</Text>
            </View>
          </View>

          {/* Skills Card */}
          {application.youthSkills && application.youthSkills.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{tr("SKILLS & SPECIALTIES")}</Text>
              <View style={styles.skillsWrap}>
                {application.youthSkills.map((skill, idx) => (
                  <View key={idx} style={styles.skillBadge}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
                    <Text style={styles.skillBadgeText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Bio Card */}
          {application.youthBio ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{tr("BIO / BACKGROUND")}</Text>
              <Text style={styles.bioText}>{application.youthBio}</Text>
            </View>
          ) : null}

          {/* Gig Context */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{tr("GIG APPLIED FOR")}</Text>
            <Text style={styles.gigTitle}>{application.gigTitle || tr("Gig Title")}</Text>
            {application.gigLocation ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.metaText}>{application.gigLocation}</Text>
              </View>
            ) : null}
            {application.gigPay !== undefined && application.gigPay !== null ? (
              <View style={styles.metaRow}>
                <Ionicons name="wallet-outline" size={15} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.primary, fontFamily: fonts.bodyBold }]}>
                  ${application.gigPay}
                  {application.gigPayType === 'hourly' ? tr("/hr") : tr(" fixed")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Action Buttons (Only when Pending) */}
          {isPending ? (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.rejectBtn, acting && styles.disabledBtn]}
                onPress={handleReject}
                disabled={acting}
                activeOpacity={0.85}
              >
                {acting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                    <Text style={styles.rejectBtnText}>{tr("Reject")}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptBtn, acting && styles.disabledBtn]}
                onPress={handleAccept}
                disabled={acting}
                activeOpacity={0.85}
              >
                {acting ? (
                  <ActivityIndicator size="small" color={colors.primaryOnColor} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryOnColor} />
                    <Text style={styles.acceptBtnText}>{tr("Accept")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.finalizedNotice}>
              <Ionicons
                name={application.status === 'accepted' ? 'checkmark-circle' : 'information-circle'}
                size={20}
                color={statusTheme.text}
              />
              <Text style={[styles.finalizedNoticeText, { color: statusTheme.text }]}>{tr("This application has already been")}{' '}{tr(application.status)}.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontFamily: fonts.bodyMedium,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceBorder,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.primary,
  },
  nameWrap: {
    flex: 1,
  },
  youthName: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.text,
    letterSpacing: -0.3,
  },
  appliedDate: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  detailRatingText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.warning,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statusBannerText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  messageBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.success,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  skillBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
  },
  bioText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  gigTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  rejectBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.error,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primaryOnColor,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  finalizedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginTop: spacing.sm,
  },
  finalizedNoticeText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
