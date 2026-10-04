import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
import type { Application } from '../../types/application';
import { getStatusTheme } from './ApplicationCard';

interface ApplicantCardProps {
  application: Application;
  onPress: () => void;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp?.toDate
    ? timestamp.toDate()
    : timestamp?.toMillis
    ? new Date(timestamp.toMillis())
    : new Date(timestamp);

  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function ApplicantCard({ application, onPress }: ApplicantCardProps) {
  const statusTheme = getStatusTheme(application.status);
  const appliedDate = formatDate(application.createdAt);
  const initial = (application.youthName?.[0] || 'Y').toUpperCase();
  const skills = (application.youthSkills || []).slice(0, 3);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Applicant ${application.youthName || 'Youth'}, status ${statusTheme.label}`}
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
            {application.youthName || 'Youth Freelancer'}
          </Text>
          {appliedDate ? (
            <Text style={styles.appliedDate}>Applied {appliedDate}</Text>
          ) : null}
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
            {statusTheme.label}
          </Text>
        </View>
      </View>

      {/* Message preview */}
      {application.message ? (
        <Text style={styles.messagePreview} numberOfLines={2}>
          "{application.message}"
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
              +{application.youthSkills!.length - 3} more
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Action Footer */}
      <View style={styles.footerRow}>
        <View style={styles.availabilityBadge}>
          <Ionicons name="checkmark-circle" size={13} color="#059669" />
          <Text style={styles.availabilityText}>Available</Text>
        </View>

        <View style={styles.viewApplicantBtn}>
          <Text style={styles.viewApplicantText}>View Applicant</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  youthName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  appliedDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
    fontWeight: '700',
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
    fontWeight: '600',
    color: colors.textSecondary,
  },
  moreSkillsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
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
    fontWeight: '600',
    color: '#059669',
  },
  viewApplicantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewApplicantText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
