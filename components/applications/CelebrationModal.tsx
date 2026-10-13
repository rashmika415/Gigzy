import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';

export interface CelebrationModalProps {
  visible: boolean;
  youthName: string;
  gigTitle: string;
  onClose: () => void;
}

export default function CelebrationModal({
  visible,
  youthName,
  gigTitle,
  onClose,
}: CelebrationModalProps) {
  useTranslation();
  if (!visible) return null;

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  const displayName = youthName || 'Youth Freelancer';
  const displayGig = gigTitle || 'Gig';

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
          </View>

          {/* Dismiss / Confirmation Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleClose}
            activeOpacity={0.88}
          >
            <Ionicons name="checkmark-done" size={20} color={colors.primaryOnColor} style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>{tr("Done")}</Text>
          </TouchableOpacity>
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
  actionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.md || 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
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
});
