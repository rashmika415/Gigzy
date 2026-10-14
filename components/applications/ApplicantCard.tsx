import { formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import type { Application } from '../../types/application';
import { getStatusTheme } from './ApplicationCard';

interface ApplicantCardProps {
  application: Application;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRate?: () => void;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp?.toDate
    ? timestamp.toDate()
    : timestamp?.toMillis
    ? new Date(timestamp.toMillis())
    : new Date(timestamp);

  if (isNaN(date.getTime())) return '';
  return localizedDate(date, {
    month: 'short',
    day: 'numeric',
  });
}

export default function ApplicantCard({
  application,
  onPress,
  onAccept,
  onReject,
  onRate,
}: ApplicantCardProps) {
  useTranslation();
  const statusTheme = getStatusTheme(application.status);
  const appliedDate = formatDate(application.createdAt);
  const initial = (application.youthName?.[0] || 'Y').toUpperCase();
  const skills = (application.youthSkills || []).slice(0, 3);
  const statusLower = (application.status || '').toLowerCase();
  const isPending = statusLower === 'pending';
  const isAccepted = ['accepted', 'approved', 'in-progress', 'completed'].includes(statusLower);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={tr("Applicant {{value0}}, status {{value1}}", { value0: application.youthName || 'Youth', value1: statusTheme.label })}
    >
      {/* Top Row: Avatar, Name, Status */}
      <View style={styles.topRow}>
        {/* Avatar */}
        {application.youthPhotoURL ? (
          <Image source={{ uri: application.youthPhotoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}

        {/* Name and Info */}
        <View style={styles.nameContainer}>
          <Text style={styles.youthName} numberOfLines={1}>
            {application.youthName || tr("Youth Freelancer")}
          </Text>
          <View style={styles.metaRow}>
            {appliedDate ? (
              <Text style={styles.appliedDate}>{tr("Applied")}{' '}{appliedDate}</Text>
            ) : null}
            {application.youthRatingAverage && application.youthRatingAverage > 0 ? (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={11} color={colors.star} />
                <Text style={styles.ratingText}>
                  {application.youthRatingAverage.toFixed(1)}
                  {application.youthRatingCount ? ` (${application.youthRatingCount})` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Status Pill */}
        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusTheme.bg, borderColor: statusTheme.border },
          ]}
        >
          <Ionicons name={statusTheme.icon} size={11} color={statusTheme.text} />
          <Text style={[styles.statusText, { color: statusTheme.text }]}>
            {tr(statusTheme.label)}
          </Text>
        </View>
      </View>

      {/* Gig Title Tag if available */}
      {application.gigTitle ? (
        <View style={styles.gigTagContainer}>
          <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
          <Text style={styles.gigTagText} numberOfLines={1}>
            {application.gigTitle}
          </Text>
        </View>
      ) : null}

      {/* Message preview */}
      {application.message ? (
        <Text style={styles.messagePreview} numberOfLines={2}>
          {'“'}{application.message}{'”'}
        </Text>
      ) : null}

      {/* Skills chips */}
      {skills.length > 0 ? (
        <View style={styles.skillsRow}>
          {skills.map((skill, idx) => (
            <View key={idx} style={styles.skillChip}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
          {(application.youthSkills?.length || 0) > 3 ? (
            <Text style={styles.moreSkillsText}>
              +{application.youthSkills!.length - 3}{' '}{tr("more")}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Action Footer */}
      <View style={styles.footerRow}>
        <View style={styles.viewApplicantBtn}>
          <Text style={styles.viewApplicantText}>{tr("View Details")}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>

        {isPending && (onAccept || onReject) ? (
          <View style={styles.decisionBtnsRow}>
            {onReject && (
              <TouchableOpacity
                style={styles.cardRejectBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onReject();
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={tr("Reject")}
              >
                <Ionicons name="close-circle-outline" size={15} color={colors.error} />
                <Text style={styles.cardRejectBtnText}>{tr("Reject")}</Text>
              </TouchableOpacity>
            )}

            {onAccept && (
              <TouchableOpacity
                style={styles.cardAcceptBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onAccept();
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={tr("Accept")}
              >
                <Ionicons name="checkmark-circle" size={15} color={colors.primaryOnColor} />
                <Text style={styles.cardAcceptBtnText}>{tr("Accept")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isAccepted && onRate ? (
          <TouchableOpacity
            style={styles.cardRateBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onRate();
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={tr("Rate Freelancer")}
          >
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={styles.cardRateBtnText}>{tr("Rate Freelancer")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.availabilityBadge}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={styles.availabilityText}>{tr("Available")}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceBorder,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  youthName: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  appliedDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.warning,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
  },
  messagePreview: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  skillChip: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  skillText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
  },
  moreSkillsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availabilityText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.success,
  },
  viewApplicantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewApplicantText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  gigTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  gigTagText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  decisionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  cardRejectBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.error,
  },
  cardAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  cardAcceptBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryOnColor,
  },
  cardRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  cardRateBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.warning,
  },
});
