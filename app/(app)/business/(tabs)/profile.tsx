import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../../../FirebaseConfig';
import { colors, fonts, spacing, borderRadius } from '../../../../constants/theme';
import { BUSINESS_PROFILE, CATEGORY_LABEL } from '../../../../data/mockData';

export default function BusinessProfile() {
  const handleSignOut = () => signOut(auth);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.avatar}>
            <MaterialIcons name="storefront" size={32} color={colors.primary} />
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{BUSINESS_PROFILE.name}</Text>
            {BUSINESS_PROFILE.verified && <MaterialIcons name="verified" size={16} color={colors.primary} />}
          </View>
          <Text style={styles.meta}>{CATEGORY_LABEL[BUSINESS_PROFILE.category]} · {BUSINESS_PROFILE.location}</Text>
        </View>

        <TouchableOpacity style={styles.editButton} activeOpacity={0.85}>
          <MaterialIcons name="edit" size={16} color={colors.text} />
          <Text style={styles.editButtonText}>Edit business profile</Text>
        </TouchableOpacity>

        <View style={styles.statsStrip}>
          {[
            { label: 'Rating', value: `${BUSINESS_PROFILE.rating}★` },
            { label: 'Gigs posted', value: String(BUSINESS_PROFILE.gigsPosted) },
            { label: 'Total hires', value: String(BUSINESS_PROFILE.totalHires) },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <Text style={styles.bioText}>{BUSINESS_PROFILE.about}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ADDRESS</Text>
          <View style={styles.addressRow}>
            <MaterialIcons name="location-on" size={16} color={colors.primary} />
            <Text style={styles.addressText}>{BUSINESS_PROFILE.address}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REVIEWS</Text>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewScore}>{BUSINESS_PROFILE.rating}★</Text>
            <Text style={styles.reviewCount}>based on {BUSINESS_PROFILE.reviewCount} reviews from past hires</Text>
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
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addressText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewScore: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.primary,
  },
  reviewCount: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },

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
