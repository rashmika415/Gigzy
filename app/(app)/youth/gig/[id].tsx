import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import ApplyModal from '../../../../components/ApplyModal';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { MOCK_GIGS, MOCK_APPLICATIONS, CATEGORY_ICON } from '../../../../data/mockData';

export default function GigDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gig = useMemo(() => MOCK_GIGS.find((g) => g.id === id), [id]);
  const existingApplication = useMemo(() => MOCK_APPLICATIONS.find((a) => a.gigId === id), [id]);

  const [applied, setApplied] = useState(!!existingApplication);
  const [applyOpen, setApplyOpen] = useState(false);

  if (!gig) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFoundText}>Gig not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gig details</Text>
        <MaterialIcons name="bookmark-border" size={22} color={colors.text} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <MaterialIcons name={CATEGORY_ICON[gig.category] as any} size={44} color={colors.primary} />
        </View>

        <Text style={styles.title}>{gig.title}</Text>

        <View style={styles.employerRow}>
          <View style={styles.employerIcon}>
            <MaterialIcons name="storefront" size={18} color={colors.primary} />
          </View>
          <View style={styles.employerText}>
            <View style={styles.employerNameRow}>
              <Text style={styles.employerName}>{gig.employerName}</Text>
              {gig.employerVerified && <MaterialIcons name="verified" size={14} color={colors.primary} />}
            </View>
            <Text style={styles.employerMeta}>{gig.employerRating}★ ({gig.employerReviews} reviews) · {gig.location}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <MaterialIcons name="payments" size={18} color={colors.primary} />
            <Text style={styles.infoLabel}>Pay</Text>
            <Text style={styles.infoValue}>Rs {gig.pay.toLocaleString()}/{gig.payRate}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="event" size={18} color={colors.primary} />
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{gig.dateLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={18} color={colors.primary} />
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{gig.timeLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={18} color={colors.primary} />
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>{gig.distanceKm}km away</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this gig</Text>
          <Text style={styles.sectionText}>{gig.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What you need</Text>
          {gig.requirements.map((req) => (
            <View key={req} style={styles.reqRow}>
              <MaterialIcons name="check-circle" size={16} color={colors.primary} />
              <Text style={styles.reqText}>{req}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.shareButton}
          activeOpacity={0.85}
          onPress={() => Share.share({ message: `Check out this gig: ${gig.title} at ${gig.employerName}` })}
        >
          <MaterialIcons name="ios-share" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.applyButton, applied && styles.applyButtonDisabled]}
          activeOpacity={0.9}
          disabled={applied}
          onPress={() => setApplyOpen(true)}
        >
          <Text style={styles.applyText}>{applied ? 'Applied' : 'Apply now'}</Text>
        </TouchableOpacity>
      </View>

      <ApplyModal
        visible={applyOpen}
        gigTitle={gig.title}
        employerName={gig.employerName}
        onClose={() => setApplyOpen(false)}
        onSubmit={() => setApplied(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  notFoundText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.text,
  },

  scrollContent: { paddingBottom: 100 },
  banner: {
    height: 140,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },

  employerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  employerIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employerText: { flex: 1 },
  employerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  employerName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  employerMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },

  infoGrid: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  infoValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },

  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  sectionText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reqText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(13, 21, 21, 0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorderSubtle,
    padding: spacing.md,
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: { opacity: 0.5 },
  applyText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.primaryOnColor,
  },
});
