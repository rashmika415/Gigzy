import { formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React, { useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import type { Application } from '../../types/application';
import { addGigToCalendar } from '../../services/calendarService';
import { RatingModal } from '../reviews';
import { getStatusTheme } from './ApplicationCard';

interface ApplicationDetailModalProps {
  visible: boolean;
  application: Application | null;
  onClose: () => void;
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

export default function ApplicationDetailModal({
  visible,
  application,
  onClose,
}: ApplicationDetailModalProps) {
  useTranslation();
  const [calendarAdding, setCalendarAdding] = useState(false);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  if (!application) return null;

  const statusTheme = getStatusTheme(application.status);
  const appliedDateStr = formatDate(application.createdAt);
  const isAccepted = application.status === 'accepted';
  const isCompleted = application.status === 'completed';
  const canTakeAction = isAccepted || isCompleted;

  const handleMessageBusiness = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
    const convId = application.conversationId || `conv_${application.id}`;
    router.push({
      pathname: '/(app)/chat/[id]',
      params: { id: convId },
    } as any);
  };

  const handleAddToCalendar = async () => {
    setCalendarAdding(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const result = await addGigToCalendar({
      title: application.gigTitle || 'Gig',
      date: application.gigDate || new Date().toISOString().slice(0, 10),
      location: application.gigLocation,
      pay: application.gigPay,
      payType: application.gigPayType,
      counterpartName: application.businessName,
      counterpartRole: 'business',
      gigId: application.gigId,
      applicationId: application.id,
      description: `Accepted Gigzy gig with ${application.businessName || 'Business Owner'}`,
    });

    setCalendarAdding(false);
    if (result.success) {
      setCalendarAdded(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert(
        'Gig Added to Calendar! 📅',
        result.method === 'native'
          ? `Added "${application.gigTitle || 'Gig'}" to your device calendar.`
          : `Opened calendar for "${application.gigTitle || 'Gig'}".`
      );
    } else {
      Alert.alert('Calendar', result.error || 'Could not add gig to calendar.');
    }
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
            accessibilityLabel={tr("Close application details")}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tr("Application Details")}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Banner */}
          <View
            style={[
              styles.statusBanner,
              { backgroundColor: statusTheme.bg, borderColor: statusTheme.border },
            ]}
          >
            <View style={styles.statusBannerIcon}>
              <Ionicons name={statusTheme.icon} size={24} color={statusTheme.text} />
            </View>
            <View style={styles.statusBannerTextWrap}>
              <Text style={[styles.statusBannerTitle, { color: statusTheme.text }]}>{tr("Status:")}{' '}{tr(statusTheme.label)}
              </Text>
              <Text style={styles.statusBannerDesc}>
                {application.status === 'pending'
                  ? tr("Your application is awaiting review by the business owner.")
                  : application.status === 'accepted'
                  ? tr("Great news! Your application was accepted for this gig.")
                  : application.status === 'completed'
                  ? tr("This gig and application have been marked as completed.")
                  : tr("The business decided to go with another applicant.")}
              </Text>
            </View>
          </View>

          {/* Action Card (Messaging, Calendar, Rating) */}
          {canTakeAction && (
            <View style={styles.acceptedActionCard}>
              <View style={styles.acceptedActionHeader}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.acceptedActionTitle}>
                  {isCompleted ? tr("Gig Completed") : tr("Gig Confirmed & Assigned")}
                </Text>
              </View>

              <Text style={styles.acceptedActionSubtitle}>
                {isCompleted
                  ? tr("This gig is completed. You can leave a review and message the business owner.")
                  : tr("You have been selected for this gig. Coordinate timing with the business owner and add the gig to your calendar.")}
              </Text>

              <View style={styles.acceptedButtonGroup}>
                <TouchableOpacity
                  style={styles.messageBizBtn}
                  onPress={handleMessageBusiness}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubbles" size={17} color={colors.primaryOnColor} />
                  <Text style={styles.messageBizBtnText}>{tr("Message Business Owner")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.calendarSyncBtn,
                    calendarAdded && styles.calendarSyncBtnAdded,
                  ]}
                  onPress={handleAddToCalendar}
                  disabled={calendarAdding || calendarAdded}
                  activeOpacity={0.85}
                >
                  {calendarAdding ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name={calendarAdded ? 'checkmark-circle' : 'calendar-outline'}
                        size={17}
                        color={calendarAdded ? colors.success : colors.primary}
                      />
                      <Text
                        style={[
                          styles.calendarSyncBtnText,
                          calendarAdded && styles.calendarSyncBtnTextAdded,
                        ]}
                      >
                        {calendarAdded ? tr("Scheduled in Calendar ✓") : tr("Add Gig to Calendar")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rateBizBtn}
                  onPress={() => setShowRatingModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="star" size={17} color={colors.star} />
                  <Text style={styles.rateBizBtnText}>{tr("Rate Business Owner")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Gig Overview Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>{tr("GIG OPPORTUNITY")}</Text>
            <Text style={styles.gigTitle}>{application.gigTitle || tr("Gig Title")}</Text>

            <View style={styles.metaRow}>
              <Ionicons name="business" size={16} color={colors.primary} />
              <Text style={styles.metaLabel}>{tr("Posted by:")}</Text>
              <Text style={styles.metaVal}>{application.businessName || tr("Business Owner")}</Text>
            </View>

            {application.gigCategory ? (
              <View style={styles.metaRow}>
                <Ionicons name="grid-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaLabel}>{tr("Category:")}</Text>
                <Text style={styles.metaVal}>{application.gigCategory}</Text>
              </View>
            ) : null}

            {application.gigPay !== undefined && application.gigPay !== null ? (
              <View style={styles.metaRow}>
                <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                <Text style={styles.metaLabel}>{tr("Compensation:")}</Text>
                <Text style={[styles.metaVal, { color: colors.primary, fontFamily: fonts.bodyBold }]}>
                  ${application.gigPay}
                  {application.gigPayType === 'hourly' ? tr("/hr") : tr(" fixed price")}
                </Text>
              </View>
            ) : null}

            {application.gigLocation ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaLabel}>{tr("Location:")}</Text>
                <Text style={styles.metaVal}>{application.gigLocation}</Text>
              </View>
            ) : null}

            {application.gigDate ? (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaLabel}>{tr("Required Date:")}</Text>
                <Text style={styles.metaVal}>{application.gigDate}</Text>
              </View>
            ) : null}
          </View>

          {/* Your Application Message */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>{tr("YOUR APPLICATION MESSAGE")}</Text>
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

          {/* Availability Confirmation */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>{tr("AVAILABILITY COMMITMENT")}</Text>
            <View style={styles.availabilityRow}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color={colors.success} />
              </View>
              <Text style={styles.availabilityText}>{tr("Confirmed available on the required date and time.")}</Text>
            </View>
          </View>

          {/* Timeline & Metadata */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>{tr("APPLICATION TIMELINE")}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaLabel}>{tr("Submitted on:")}</Text>
              <Text style={styles.metaVal}>{appliedDateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="finger-print-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaLabel}>{tr("Application ID:")}</Text>
              <Text style={[styles.metaVal, { fontSize: 11, color: colors.textMuted }]}>
                {application.id}
              </Text>
            </View>
          </View>

          {/* Close Action */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.dismissBtnText}>{tr("Back to Applications")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {application?.businessId ? (
          <RatingModal
            visible={showRatingModal}
            targetUserId={application.businessId}
            targetUserName={application.businessName || 'Business Owner'}
            targetRole="client"
            gigId={application.gigId}
            gigTitle={application.gigTitle}
            onClose={() => setShowRatingModal(false)}
            onSuccess={() => setShowRatingModal(false)}
          />
        ) : null}
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  statusBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerTextWrap: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    marginBottom: 2,
  },
  statusBannerDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  gigTitle: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    width: 100,
  },
  metaVal: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
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
  dismissBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  dismissBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  acceptedActionCard: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  acceptedActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceptedActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },
  acceptedActionSubtitle: {
    fontSize: 12.5,
    color: colors.success,
    lineHeight: 18,
  },
  acceptedButtonGroup: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  messageBizBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  messageBizBtnText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontWeight: '700',
  },
  calendarSyncBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  calendarSyncBtnAdded: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  calendarSyncBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  calendarSyncBtnTextAdded: {
    color: colors.success,
  },
  rateBizBtn: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  rateBizBtnText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
});
