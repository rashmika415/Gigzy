import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
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
  return date.toLocaleDateString(undefined, {
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
            accessibilityLabel="Close application details"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Application Details</Text>
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
              <Text style={[styles.statusBannerTitle, { color: statusTheme.text }]}>
                Status: {statusTheme.label}
              </Text>
              <Text style={styles.statusBannerDesc}>
                {application.status === 'pending'
                  ? 'Your application is awaiting review by the business owner.'
                  : application.status === 'accepted'
                  ? 'Great news! Your application was accepted for this gig.'
                  : application.status === 'completed'
                  ? 'This gig and application have been marked as completed.'
                  : 'The business decided to go with another applicant.'}
              </Text>
            </View>
          </View>

          {/* Gig Overview Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>GIG OPPORTUNITY</Text>
            <Text style={styles.gigTitle}>{application.gigTitle || 'Gig Title'}</Text>

            <View style={styles.metaRow}>
              <Ionicons name="business" size={16} color={colors.primary} />
              <Text style={styles.metaLabel}>Posted by:</Text>
              <Text style={styles.metaVal}>{application.businessName || 'Business Owner'}</Text>
            </View>

            {application.gigCategory ? (
              <View style={styles.metaRow}>
                <Ionicons name="grid-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaLabel}>Category:</Text>
                <Text style={styles.metaVal}>{application.gigCategory}</Text>
              </View>
            ) : null}

            {application.gigPay !== undefined && application.gigPay !== null ? (
              <View style={styles.metaRow}>
                <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                <Text style={styles.metaLabel}>Compensation:</Text>
                <Text style={[styles.metaVal, { color: colors.primary, fontWeight: '700' }]}>
                  ${application.gigPay}
                  {application.gigPayType === 'hourly' ? '/hr' : ' fixed price'}
                </Text>
              </View>
            ) : null}

            {application.gigLocation ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaLabel}>Location:</Text>
                <Text style={styles.metaVal}>{application.gigLocation}</Text>
              </View>
            ) : null}

            {application.gigDate ? (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaLabel}>Required Date:</Text>
                <Text style={styles.metaVal}>{application.gigDate}</Text>
              </View>
            ) : null}
          </View>

          {/* Your Application Message */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>YOUR APPLICATION MESSAGE</Text>
            <View style={styles.messageBox}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.messageText}>
                {application.message || 'No message provided.'}
              </Text>
            </View>
          </View>

          {/* Availability Confirmation */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>AVAILABILITY COMMITMENT</Text>
            <View style={styles.availabilityRow}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color="#059669" />
              </View>
              <Text style={styles.availabilityText}>
                Confirmed available on the required date and time.
              </Text>
            </View>
          </View>

          {/* Timeline & Metadata */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>APPLICATION TIMELINE</Text>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaLabel}>Submitted on:</Text>
              <Text style={styles.metaVal}>{appliedDateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="finger-print-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaLabel}>Application ID:</Text>
              <Text style={[styles.metaVal, { fontSize: 11, color: colors.textMuted }]}>
                {application.id}
              </Text>
            </View>
          </View>

          {/* Close Action */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.dismissBtnText}>Back to Applications</Text>
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  gigTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '500',
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
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
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
    fontWeight: '600',
    color: colors.text,
  },
});
