import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../FirebaseConfig';
import { colors, spacing, borderRadius } from '../../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Role = 'freelancer' | 'client' | 'admin';

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: colors.error };
  if (score <= 3) return { score: 3, label: 'Fair', color: '#F59E0B' };
  return { score: 5, label: 'Strong', color: colors.success };
}

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState<Role>('freelancer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const strength = getPasswordStrength(password);

  const handlePressIn = () =>
    Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const handlePressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });

      // Store user profile in Firestore
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        createdAt: serverTimestamp(),
      });

      // Auth context listener will trigger redirect automatically
    } catch (e: any) {
      setError(getFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background glow */}
      <View style={styles.glow} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>⚡</Text>
          </View>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join the Gigzy community</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Role selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>I am a</Text>
            <View style={styles.roleToggle}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'freelancer' && styles.roleOptionActive]}
                onPress={() => setRole('freelancer')}
                activeOpacity={0.8}
              >
                <Text style={styles.roleEmoji}>💼</Text>
                <Text
                  style={[styles.roleText, role === 'freelancer' && styles.roleTextActive]}
                >
                  Youth
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, role === 'client' && styles.roleOptionActive]}
                onPress={() => setRole('client')}
                activeOpacity={0.8}
              >
                <Text style={styles.roleEmoji}>🏢</Text>
                <Text
                  style={[styles.roleText, role === 'client' && styles.roleTextActive]}
                >
                  Business
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, role === 'admin' && styles.roleOptionActive]}
                onPress={() => setRole('admin')}
                activeOpacity={0.8}
              >
                <Text style={styles.roleEmoji}>⚡</Text>
                <Text
                  style={[styles.roleText, role === 'admin' && styles.roleTextActive]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={[styles.inputWrapper, nameFocused && styles.inputWrapperFocused]}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(t) => { setFullName(t); setError(''); }}
                placeholder="John Doe"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrapper, passFocused && styles.inputWrapperFocused]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder="Minimum 6 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {/* Strength bar */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            i <= strength.score ? strength.color : colors.surfaceBorder,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputWrapper, confirmFocused && styles.inputWrapperFocused]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeButton}>
                <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.matchError}>Passwords don't match</Text>
            )}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
            </View>
          ) : null}

          {/* CTA Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
              onPress={handleRegister}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.ctaText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Login link */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.loginLink}
          >
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text style={styles.loginAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  glow: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.accentLight,
    opacity: 0.6,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: SCREEN_HEIGHT * 0.07,
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: spacing.sm,
  },
  backIcon: {
    fontSize: 22,
    color: colors.textSecondary,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: `${colors.primary}60`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoEmoji: { fontSize: 26 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
  },

  inputGroup: { marginBottom: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Role toggle
  roleToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  roleOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  roleEmoji: { fontSize: 18 },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleTextActive: {
    color: colors.primary,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 4,
  },
  inputWrapperFocused: {
    borderColor: colors.inputBorderFocus,
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  inputIcon: { fontSize: 16, marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  eyeButton: { padding: spacing.xs },
  eyeIcon: { fontSize: 16 },

  // Strength
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'right',
  },
  matchError: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },

  // Error
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 18 },

  // Button
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaButtonDisabled: { opacity: 0.7 },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  loginLink: { alignItems: 'center', marginTop: spacing.lg },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginAccent: { color: colors.primary, fontWeight: '600' },

  bottomSpacer: { height: spacing.xxl },
});
