import { formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import type { Application } from '../../types/application';
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
  if (!application) return null;

  const statusTheme = getStatusTheme(application.status);
  const appliedDateStr = formatDate(application.createdAt);

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
});
