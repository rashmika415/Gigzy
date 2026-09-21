import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';

type Role = 'youth' | 'business';

function selectRole(role: Role) {
  router.push({ pathname: '/(auth)/register', params: { role } });
}

export default function RoleSelect() {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <MaterialIcons name="explore" size={28} color={colors.primary} />
        </View>
        <Text style={styles.brandName}>LocalWorks</Text>
        <Text style={styles.tagline}>Local work, local people</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>How will you use LocalWorks?</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => selectRole('youth')}
          activeOpacity={0.8}
        >
          <View style={styles.cardIcon}>
            <MaterialIcons name="work" size={22} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>I&apos;m looking for work</Text>
            <Text style={styles.cardSubtitle}>
              Find part-time and short-term gigs near you. Ages 16–25.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => selectRole('business')}
          activeOpacity={0.8}
        >
          <View style={styles.cardIcon}>
            <MaterialIcons name="storefront" size={22} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>I&apos;m hiring</Text>
            <Text style={styles.cardSubtitle}>
              Post gigs and find reliable local youth for your business.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/login')}>
            Log in
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },

  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(111, 216, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brandName: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  body: {
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(111, 216, 199, 0.2)',
    borderRadius: borderRadius.lg,
    padding: spacing.md + 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  footer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  footerLink: {
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
});
