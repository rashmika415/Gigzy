import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../FirebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Home() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';
  const role = ''; // Will be fetched from Firestore later

  const handleSignOut = async () => {
    await signOut(auth);
    // Root layout useEffect will redirect to the welcome screen
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background blob */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}! 👋</Text>
            <Text style={styles.subtitle}>Welcome to Gigzy</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>
              {(user?.displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Placeholder card — home content will be built in the next phase */}
        <View style={styles.card}>
          <Text style={styles.cardEmoji}>🚧</Text>
          <Text style={styles.cardTitle}>App Coming Soon</Text>
          <Text style={styles.cardText}>
            You're successfully authenticated! The main app experience is being built next.
          </Text>
        </View>

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Gigs', value: '0', emoji: '💼' },
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

        {/* Sign out button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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
    opacity: 0.4,
  },
  blob2: {
    position: 'absolute',
    bottom: 80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentLight,
    opacity: 0.5,
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

  // Sign out
  signOutButton: {
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
