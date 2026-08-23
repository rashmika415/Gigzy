import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Home() {
  const { user, userData } = useAuth();
  const firstName = userData?.fullName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'there';
  const role = userData?.role ?? 'freelancer';

  const getRoleLabel = () => {
    if (role === 'admin') return 'Platform Admin';
    if (role === 'client') return 'Business Owner';
    return 'Youth (Freelancer)';
  };

  const handleAvatarPress = () => {
    router.push('/(app)/profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}! 👋</Text>
            <Text style={styles.subtitle}>
              Role Profile: <Text style={styles.roleLabel}>{getRoleLabel()}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>
              {(firstName?.[0] ?? '?').toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard Welcome Card */}
        <View style={styles.card}>
          <Text style={styles.cardEmoji}>⚡</Text>
          <Text style={styles.cardTitle}>Welcome to Gigzy</Text>
          <Text style={styles.cardText}>
            You're successfully authenticated! Tap the account icon in the top-right corner to view and customize your User Profile.
          </Text>
        </View>

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Gigs Active', value: '0', emoji: '💼' },
            { label: 'Earnings', value: '$0', emoji: '💰' },
            { label: 'Reviews', value: '0', emoji: '⭐' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statEmoji}>{stat.emoji}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  blob1: {
    position: 'absolute',
    top: -60,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primaryGlow,
    opacity: 0.35,
  },
  blob2: {
    position: 'absolute',
    bottom: 80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentLight,
    opacity: 0.4,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardEmoji: { fontSize: 48, marginBottom: spacing.md },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 22 },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
