import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius } from '../../constants/theme';
import type { Application } from '../../types/application';
import { acceptApplication, rejectApplication } from '../../services/applicationService';
import { getStatusTheme } from './ApplicationCard';

interface ApplicantDetailModalProps {
  visible: boolean;
  application: Application | null;
  businessId: string;
  onClose: () => void;
  onStatusChanged?: (newStatus: 'accepted' | 'rejected') => void;
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

export default function ApplicantDetailModal({
  visible,
  application,
  businessId,
  onClose,
  onStatusChanged,
}: ApplicantDetailModalProps) {
  const [acting, setActing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!application) return null;

  const statusTheme = getStatusTheme(application.status);
  const appliedDateStr = formatDate(application.createdAt);
  const initial = (application.youthName?.[0] || 'Y').toUpperCase();
  const isPending = application.status === 'pending';

  const handleAccept = () => {
    Alert.alert(
      'Accept Application',
      `Are you sure you want to accept ${application.youthName || 'this applicant'} for "${application.gigTitle || 'this gig'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Applicant',
          style: 'default',
          onPress: async () => {
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
              Alert.alert('Applicant Accepted', `${application.youthName || 'The applicant'} has been accepted!`);
              if (onStatusChanged) onStatusChanged('accepted');
              onClose();
            } catch (err: any) {
              setErrorMsg(err.message || 'Failed to accept application.');
            } finally {
              setActing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Application',
      `Are you sure you want to reject this application from ${application.youthName || 'this applicant'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            setErrorMsg('');
            try {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch {}
              await rejectApplication(application.id, businessId);
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              Alert.alert('Application Rejected', 'The application has been rejected.');
              if (onStatusChanged) onStatusChanged('rejected');
              onClose();
            } catch (err: any) {
              setErrorMsg(err.message || 'Failed to reject application.');
            } finally {
              setActing(false);
            }
          },
        },
      ]
    );
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
            accessibilityLabel="Close applicant details"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Applicant Details</Text>
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
              <Text style={styles.errorText}>{errorMsg}</Text>
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
                  {application.youthName || 'Youth Freelancer'}
                </Text>
                <Text style={styles.appliedDate}>Applied on {appliedDateStr}</Text>
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
              <Text style={[styles.statusBannerText, { color: statusTheme.text }]}>
                Application Status: {statusTheme.label}
              </Text>
            </View>
          </View>

          {/* Application Message Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>APPLICATION MESSAGE</Text>
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

          {/* Availability Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>AVAILABILITY CONFIRMATION</Text>
            <View style={styles.availabilityRow}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color="#059669" />
              </View>
              <Text style={styles.availabilityText}>
                Confirmed available on the required date and time.
              </Text>
            </View>
          </View>

          {/* Skills Card */}
          {application.youthSkills && application.youthSkills.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>SKILLS & SPECIALTIES</Text>
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
              <Text style={styles.cardLabel}>BIO / BACKGROUND</Text>
              <Text style={styles.bioText}>{application.youthBio}</Text>
            </View>
          ) : null}

          {/* Gig Context */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>GIG APPLIED FOR</Text>
            <Text style={styles.gigTitle}>{application.gigTitle || 'Gig Title'}</Text>
            {application.gigLocation ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.metaText}>{application.gigLocation}</Text>
              </View>
            ) : null}
            {application.gigPay !== undefined && application.gigPay !== null ? (
              <View style={styles.metaRow}>
                <Ionicons name="wallet-outline" size={15} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.primary, fontWeight: '700' }]}>
                  ${application.gigPay}
                  {application.gigPayType === 'hourly' ? '/hr' : ' fixed'}
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
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                    <Text style={styles.rejectBtnText}>Reject</Text>
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
                    <Text style={styles.acceptBtnText}>Accept</Text>
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
              <Text style={[styles.finalizedNoticeText, { color: statusTheme.text }]}>
                This application has already been {application.status}.
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  nameWrap: {
    flex: 1,
  },
  youthName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  appliedDate: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
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
    fontWeight: '700',
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
    fontWeight: '800',
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
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bioText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  gigTitle: {
    fontSize: 16,
    fontWeight: '700',
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  rejectBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
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
    fontWeight: '700',
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
    fontWeight: '600',
  },
});
