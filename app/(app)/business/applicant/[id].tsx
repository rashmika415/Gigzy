import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import StatusPill from '../../../../components/StatusPill';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { useApplicants } from '../../../../context/ApplicantsContext';

export default function ApplicantProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { applicants, setStatus } = useApplicants();
  const applicant = useMemo(() => applicants.find((a) => a.id === id), [applicants, id]);

  if (!applicant) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFoundText}>Applicant not found.</Text>
      </SafeAreaView>
    );
  }

  const isDecided = applicant.status !== 'pending';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Applicant</Text>
        <MaterialIcons name="flag" size={20} color={colors.text} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{applicant.name[0]}</Text>
          </View>
          <Text style={styles.name}>{applicant.name}, {applicant.age}</Text>
          <Text style={styles.rating}>{applicant.rating}★ · {applicant.reviewCount} reviews</Text>
          <StatusPill status={applicant.status} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPLIED FOR</Text>
          <Text style={styles.gigTitle}>{applicant.gigTitle}</Text>
          <Text style={styles.appliedText}>
            {applicant.appliedDaysAgo === 0 ? 'Applied today' : `Applied ${applicant.appliedDaysAgo}d ago`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THEIR MESSAGE</Text>
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{applicant.message}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SKILLS</Text>
          <View style={styles.tagWrap}>
            {applicant.skills.map((skill) => (
              <View key={skill} style={styles.tag}>
                <Text style={styles.tagText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AVAILABILITY</Text>
          <View style={styles.tagWrap}>
            {applicant.availability.map((slot) => (
              <View key={slot} style={[styles.tag, styles.tagPrimary]}>
                <Text style={[styles.tagText, styles.tagTextPrimary]}>{slot}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.rejectButton, isDecided && styles.actionButtonDisabled]}
          activeOpacity={0.85}
          disabled={isDecided}
          onPress={() => setStatus(applicant.id, 'rejected')}
        >
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptButton, isDecided && styles.actionButtonDisabled]}
          activeOpacity={0.9}
          disabled={isDecided}
          onPress={() => setStatus(applicant.id, 'accepted')}
        >
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      </View>
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

  scrollContent: { padding: spacing.md, paddingBottom: 100, gap: spacing.lg },

  profileHeader: { alignItems: 'center', gap: 6 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.primary,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  rating: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },

  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  gigTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  appliedText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  messageBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  messageText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  tagPrimary: { borderColor: 'rgba(111, 216, 199, 0.3)' },
  tagText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tagTextPrimary: { color: colors.primary },

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
  rejectButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.error,
  },
  acceptButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.primaryOnColor,
  },
  actionButtonDisabled: { opacity: 0.4 },
});
