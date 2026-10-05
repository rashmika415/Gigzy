import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { ParticipantDetail } from '../../types/messaging';

interface ChatHeaderProps {
  onBack: () => void;
  participant: ParticipantDetail;
  gigTitle?: string;
  gigPay?: number;
  gigPayType?: 'fixed' | 'hourly';
  onToggleGigDetails?: () => void;
}

export default function ChatHeader({
  onBack,
  participant,
  gigTitle,
  gigPay,
  gigPayType,
  onToggleGigDetails,
}: ChatHeaderProps) {
  const isBusiness = participant.role === 'client';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.avatarWrapper}>
        {participant.photoURL ? (
          <Image source={{ uri: participant.photoURL }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarCircle, isBusiness && styles.avatarCircleBusiness]}>
            <Text style={[styles.avatarText, isBusiness && styles.avatarTextBusiness]}>
              {(participant.fullName?.[0] || 'U').toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.onlineDot} />
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.name} numberOfLines={1}>
          {participant.fullName || 'User'}
        </Text>
        {gigTitle ? (
          <TouchableOpacity
            style={styles.gigRow}
            onPress={onToggleGigDetails}
            disabled={!onToggleGigDetails}
            activeOpacity={0.7}
          >
            <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
            <Text style={styles.gigTitle} numberOfLines={1}>
              {gigTitle}
              {gigPay ? ` • $${gigPay}${gigPayType === 'hourly' ? '/hr' : ''}` : ''}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.roleRow}>
            <View style={[styles.roleDot, isBusiness ? styles.roleDotBusiness : styles.roleDotYouth]} />
            <Text style={styles.roleText}>{isBusiness ? 'Business' : 'Youth Freelancer'}</Text>
          </View>
        )}
      </View>

      {gigTitle && onToggleGigDetails && (
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={onToggleGigDetails}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleBusiness: {
    backgroundColor: 'rgba(44, 73, 104, 0.3)',
    borderColor: '#7BA6D6',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  avatarTextBusiness: {
    color: '#ADC9EE',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  infoBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  gigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  gigTitle: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleDotYouth: {
    backgroundColor: colors.primary,
  },
  roleDotBusiness: {
    backgroundColor: '#7BA6D6',
  },
  roleText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailsBtn: {
    padding: spacing.xs,
  },
});
