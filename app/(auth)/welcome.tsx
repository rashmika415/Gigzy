import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient background glows */}
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <MaterialIcons name="bolt" size={40} color={colors.primary} />
        </View>
        <Text style={styles.brandName}>LocalWorks</Text>
        <Text style={styles.tagline}>Short-term work, close to home</Text>
      </View>

      <View style={styles.actionArea}>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/role-select')}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Get started</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.legalText}>
          By continuing you agree to our <Text style={styles.legalLink}>Terms</Text> and{' '}
          <Text style={styles.legalLink}>Privacy Policy</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  glowTopLeft: {
    position: 'absolute',
    top: -100,
    left: -40,
    width: 234,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primaryLight,
    opacity: 0.4,
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: -100,
    right: -40,
    width: 273,
    height: 350,
    borderRadius: 150,
    backgroundColor: colors.accentLight,
    opacity: 0.4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(111, 216, 199, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brandName: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    letterSpacing: -2,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  actionArea: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  buttons: {
    gap: spacing.md,
  },
  primaryButton: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.primaryOnColor,
  },
  secondaryButton: {
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.surfaceBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  legalText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(188, 201, 197, 0.7)',
    textAlign: 'center',
  },
  legalLink: {
    color: colors.primary,
  },
});
