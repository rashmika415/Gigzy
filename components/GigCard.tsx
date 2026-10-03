import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import StatusPill from './StatusPill';
import Chip from './Chip';
import { categoryId } from '../services/discoveryFilters';
import { GIG_CATEGORIES } from '../types/gig';
import type { Gig } from '../types/gig';

interface GigCardProps {
  /** Gig data to display */
  gig: Gig;
  /** Fired when the card body is pressed */
  onPress?: (gig: Gig) => void;
  /** Fired when the status pill is pressed (e.g. to open a status-change modal) */
  onStatusPress?: (gig: Gig) => void;
  /** Render a custom action row at the bottom (e.g. delete, edit buttons).
   *  When omitted, no footer is rendered. */
  renderActions?: (gig: Gig) => React.ReactNode;
  /** Maximum skills shown before a "+N more" chip appears */
  maxSkills?: number;
  /** Additional style applied to the outer container */
  style?: ViewStyle;
}

export default function GigCard({
  gig,
  onPress,
  onStatusPress,
  renderActions,
  maxSkills = 3,
  style,
}: GigCardProps) {
  const locationIcon =
    gig.locationType === 'remote' ? 'globe-outline' : 'location-outline';

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress?.(gig)}
      activeOpacity={onPress ? 0.9 : 1}
      disabled={!onPress}
    >
      {/* ── Top Row: category & status ── */}
      <View style={styles.topRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{GIG_CATEGORIES.find(category => category.id === categoryId(gig.category))?.name ?? gig.category}</Text>
        </View>

        <StatusPill
          status={gig.status}
          showChevron={!!onStatusPress}
          onPress={onStatusPress ? () => onStatusPress(gig) : undefined}
        />
      </View>

      {/* ── Title & Pay ── */}
      <View style={styles.titlePayRow}>
        <Text style={styles.title} numberOfLines={2}>
          {gig.title}
        </Text>
        <View style={styles.payPill}>
          <Text style={styles.payAmount}>${gig.pay}</Text>
          <Text style={styles.payType}>
            {gig.payType === 'hourly' ? '/hr' : ' fixed'}
          </Text>
        </View>
      </View>

      {/* ── Description ── */}
      <Text style={styles.description} numberOfLines={2}>
        {gig.description}
      </Text>

      {/* ── Skill Chips ── */}
      {gig.skills && gig.skills.length > 0 && (
        <View style={styles.skillsRow}>
          {gig.skills.slice(0, maxSkills).map((skill, idx) => (
            <Chip key={`${gig.id}-skill-${idx}`} label={skill} size="sm" />
          ))}
          {gig.skills.length > maxSkills && (
            <View style={styles.moreChip}>
              <Text style={styles.moreChipText}>
                +{gig.skills.length - maxSkills}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Meta Row: location, date, applicants ── */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name={locationIcon as any} size={13} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {gig.location || 'Remote'}{gig.distanceKm !== undefined ? ` - ${gig.distanceKm.toFixed(1)} km` : ''}
          </Text>
        </View>

        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.metaText}>{gig.date || 'Flexible'}</Text>
        </View>

        <View
          style={[
            styles.applicantsChip,
            gig.applicantsCount > 0 && styles.applicantsChipActive,
          ]}
        >
          <Ionicons
            name="people"
            size={12}
            color={gig.applicantsCount > 0 ? '#10B981' : colors.textMuted}
          />
          <Text
            style={[
              styles.applicantsText,
              gig.applicantsCount > 0 && styles.applicantsTextActive,
            ]}
          >
            {gig.applicantsCount || 0}
          </Text>
        </View>
      </View>

      {/* ── Optional Action Footer ── */}
      {renderActions && (
        <View style={styles.actionsFooter}>{renderActions(gig)}</View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Title & pay
  titlePayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  payPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  payAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  payType: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },

  // Description
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Skills
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  moreChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moreChipText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  applicantsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  applicantsChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  applicantsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  applicantsTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },

  // Actions footer
  actionsFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
});
