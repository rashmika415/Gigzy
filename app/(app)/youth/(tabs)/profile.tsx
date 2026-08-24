import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../../../FirebaseConfig';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { YOUTH_PROFILE } from '../../../../data/mockData';

export default function YouthProfile() {
  const handleSignOut = () => signOut(auth);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{YOUTH_PROFILE.name[0]}</Text>
          </View>
          <Text style={styles.name}>{YOUTH_PROFILE.name}</Text>
          <Text style={styles.meta}>{YOUTH_PROFILE.age} · {YOUTH_PROFILE.location}</Text>
        </View>

        <TouchableOpacity style={styles.editButton} activeOpacity={0.85}>
          <MaterialIcons name="edit" size={16} color={colors.text} />
          <Text style={styles.editButtonText}>Edit profile</Text>
        </TouchableOpacity>

        <View style={styles.statsStrip}>
          {[
            { label: 'Gigs done', value: String(YOUTH_PROFILE.gigsCompleted) },
            { label: 'Rating', value: `${YOUTH_PROFILE.rating}★` },
            { label: 'Reviews', value: String(YOUTH_PROFILE.reviewCount) },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <Text style={styles.bioText}>{YOUTH_PROFILE.bio}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SKILLS</Text>
          <View style={styles.tagWrap}>
            {YOUTH_PROFILE.skills.map((skill) => (
              <View key={skill} style={styles.tag}>
                <Text style={styles.tagText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AVAILABILITY</Text>
          <View style={styles.tagWrap}>
            {YOUTH_PROFILE.availability.map((slot) => (
              <View key={slot} style={[styles.tag, styles.tagPrimary]}>
                <MaterialIcons name="check-circle" size={14} color={colors.primary} />
                <Text style={[styles.tagText, styles.tagTextPrimary]}>{slot}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },

  headerSection: { alignItems: 'center', gap: 4 },
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
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },

  editButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  editButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },

  statsStrip: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },

  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  bioText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

  signOutButton: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  signOutText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
