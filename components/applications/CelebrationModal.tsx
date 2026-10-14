import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useToast } from '../../context/ToastContext';
import { router } from 'expo-router';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import { addGigToCalendar } from '../../services/calendarService';

export interface CelebrationModalProps {
  visible: boolean;
  youthName: string;
  gigTitle: string;
  onClose: () => void;
  applicationId?: string;
  gigId?: string;
  gigDate?: string;
  gigTime?: string;
  gigLocation?: string;
  gigPay?: number;
  gigPayType?: string;
  onOpenChat?: () => void;
}

export default function CelebrationModal({
  visible,
  youthName,
  gigTitle,
  onClose,
  applicationId,
  gigId,
  gigDate,
  gigTime,
  gigLocation,
  gigPay,
  gigPayType,
  onOpenChat,
}: CelebrationModalProps) {
  useTranslation();
  const toast = useToast();
  const [calendarAdding, setCalendarAdding] = useState(false);
  const [calendarAdded, setCalendarAdded] = useState(false);

  if (!visible) return null;

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
    router.push('/(app)/(tabs)/home' as any);
  };

  const displayName = youthName || 'Youth Freelancer';
  const displayGig = gigTitle || 'Gig';

  const handleMessage = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
    if (onOpenChat) {
      onOpenChat();
    } else if (applicationId) {
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: `conv_${applicationId}` },
      } as any);
    } else {
      router.push('/(app)/(tabs)/messages' as any);
    }
  };

  const handleAddToCalendar = async () => {
    setCalendarAdding(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    try {
      const result = await addGigToCalendar({
        title: displayGig,
        date: gigDate || new Date().toISOString().slice(0, 10),
        time: gigTime,
        location: gigLocation,
        pay: gigPay,
        payType: gigPayType,
        counterpartName: displayName,
        counterpartRole: 'freelancer',
        gigId,
        applicationId,
        description: `Gigzy scheduled gig with ${displayName}`,
      });
      if (!result.success) throw new Error(result.error || 'Could not add gig to calendar.');
      setCalendarAdded(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      toast.success(tr('Added to calendar'));
    } catch (err: any) {
      toast.error(tr('Could not add gig to calendar.'), err?.message ? tr(err.message) : undefined);
    } finally {
      setCalendarAdding(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogContainer}>
          {/* Top Decorative Confetti / Celebration Icon */}
          <View style={styles.iconCircleWrap}>
            <View style={styles.iconCircleOuter}>
              <View style={styles.iconCircleInner}>
                <Text style={styles.emojiIcon}>🎉</Text>
              </View>
            </View>
          </View>

          {/* Micro pill badge */}
          <View style={styles.badgePill}>
            <Ionicons name="sparkles" size={13} color={colors.success} style={{ marginRight: 4 }} />
            <Text style={styles.badgePillText}>{tr("APPLICATION ACCEPTED")}</Text>
          </View>

          {/* Main Title */}
          <Text style={styles.title}>{tr("Application Accepted! 🎉")}</Text>

          {/* Celebration Quote Message */}
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{tr('You accepted {{name}} for {{gig}}. Work is now in progress.', { name: displayName, gig: displayGig })}</Text>
          </View>

          {/* Status / Overview Mini Card */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <View style={styles.overviewIconCol}>
                <Ionicons name="person-circle" size={20} color={colors.primary} />
              </View>
              <View style={styles.overviewTextCol}>
                <Text style={styles.overviewLabel}>{tr("Freelancer Assigned")}</Text>
                <Text style={styles.overviewValue} numberOfLines={1}>{displayName}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.overviewRow}>
              <View style={styles.overviewIconCol}>
                <Ionicons name="briefcase" size={18} color={colors.primary} />
              </View>
              <View style={styles.overviewTextCol}>
                <Text style={styles.overviewLabel}>{tr("Gig Title")}</Text>
                <Text style={styles.overviewValue} numberOfLines={1}>{displayGig}</Text>
              </View>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillText}>{tr("In Progress")}</Text>
              </View>
            </View>

            {gigDate ? (
              <>
                <View style={styles.divider} />
                <View style={styles.overviewRow}>
                  <View style={styles.overviewIconCol}>
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.overviewTextCol}>
                    <Text style={styles.overviewLabel}>Scheduled Date & Time</Text>
                    <Text style={styles.overviewValue} numberOfLines={1}>
                      {gigDate}{gigTime ? ` at ${gigTime}` : ''}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {/* Actions Stack */}
          <View style={styles.buttonStack}>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={handleMessage}
              activeOpacity={0.88}
            >
              <Ionicons name="chatbubbles" size={19} color={colors.primaryOnColor} style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>{tr("Message Freelancer")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.calendarButton,
                calendarAdded && styles.calendarButtonAdded,
              ]}
              onPress={handleAddToCalendar}
              disabled={calendarAdding || calendarAdded}
              activeOpacity={0.88}
            >
              {calendarAdding ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name={calendarAdded ? 'checkmark-circle' : 'calendar-outline'}
                    size={19}
                    color={calendarAdded ? colors.success : colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.calendarButtonText,
                      calendarAdded && styles.calendarButtonTextAdded,
                    ]}
                  >
                    {calendarAdded ? tr("Scheduled in Calendar ✓") : tr("Add to Calendar")}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleClose}
              activeOpacity={0.88}
            >
              <Ionicons name="home-outline" size={18} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.doneButtonText}>{tr("Go to Dashboard")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 99999,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl || 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + 4,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  iconCircleWrap: {
    marginBottom: spacing.md,
  },
  iconCircleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.successBorder,
  },
  iconCircleInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiIcon: {
    fontSize: 32,
    textAlign: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  badgePillText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.success,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  messageBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md || 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: spacing.lg,
    width: '100%',
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  boldText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  overviewCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md || 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: spacing.sm,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewIconCol: {
    width: 28,
    alignItems: 'flex-start',
  },
  overviewTextCol: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  overviewValue: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
    marginRight: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.warning,
  },
  buttonStack: {
    width: '100%',
    gap: spacing.sm,
  },
  messageButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: borderRadius.md || 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 12px rgba(8, 127, 115, 0.25)',
      },
    }),
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primaryOnColor,
    letterSpacing: 0.2,
  },
  calendarButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md || 12,
  },
  calendarButtonAdded: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  calendarButtonText: {
    fontSize: 14.5,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  calendarButtonTextAdded: {
    color: colors.success,
  },
  doneButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md || 12,
  },
  doneButtonText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  actionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: borderRadius.md || 12,
  },
});
