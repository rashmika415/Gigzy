import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../FirebaseConfig';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';

type Role = 'youth' | 'business';

type Role = 'freelancer' | 'client' | 'admin';

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

function isValidPassword(password: string): boolean {
  return password.length >= 8 && /\d/.test(password);
}

export default function Register() {
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const role: Role = roleParam === 'business' ? 'business' : 'youth';

  useEffect(() => {
    if (roleParam !== 'youth' && roleParam !== 'business') {
      router.replace('/(auth)/role-select');
    }
  }, [roleParam]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [notifyOnMatch, setNotifyOnMatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (!isValidPassword(password)) {
      setError('Password must be at least 8 characters, with one number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Use and Privacy Policy.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });

      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        notifyOnMatch,
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create account</Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.rolePanel}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <View style={styles.rolePanelLeft}>
            <MaterialIcons name="person" size={16} color={colors.primary} />
            <Text style={styles.rolePanelText}>{ROLE_LABEL[role]}</Text>
          </View>
          <Text style={styles.changeText}>CHANGE</Text>
        </TouchableOpacity>

        <View style={styles.form}>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="you@example.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder="Enter a password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.showButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.showButtonText}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>At least 8 characters, with one number.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm((v) => !v)}
                style={styles.showButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.showButtonText}>{showConfirm ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.matchError}>{"Passwords don't match"}</Text>
            )}
          </View>

          <View style={styles.checkboxes}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreedToTerms((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <MaterialIcons name="check" size={13} color={colors.background} />}
              </View>
              <Text style={styles.checkboxLabel}>
                I am 16 or older and I agree to the Terms of Use and Privacy Policy.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setNotifyOnMatch((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, notifyOnMatch && styles.checkboxChecked]}>
                {notifyOnMatch && <MaterialIcons name="check" size={13} color={colors.background} />}
              </View>
              <Text style={styles.checkboxLabel}>
                Send me an alert when a gig matches my skills.
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="warning" size={18} color={colors.error} style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.fixedBottomBar}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryOnColor} size="small" />
          ) : (
            <Text style={styles.submitText}>Create account</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/login')}>
            Log in
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
  },
  backButton: {
    position: 'absolute',
    left: spacing.md,
    padding: spacing.sm,
    zIndex: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -1,
    color: colors.text,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },

  rolePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.sm + 1,
  },
  rolePanelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  rolePanelText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  changeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: '#ADC9EE',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  form: { gap: spacing.lg },
  inputGroup: { gap: spacing.xs },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  input: {
    height: 48,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: 17,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  passwordWrapper: { justifyContent: 'center' },
  passwordInput: { paddingRight: 60 },
  showButton: {
    position: 'absolute',
    right: spacing.md,
  },
  showButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.primary,
  },
  hintText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  checkboxes: { gap: spacing.md },
  checkboxRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 16,
    height: 16,
    marginTop: 4,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: borderRadius.sm,
    padding: 13,
  },
  errorIcon: { marginTop: 1 },
  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.errorText,
  },

  bottomSpacer: { height: 128 },

  fixedBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(13, 21, 21, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(111, 216, 199, 0.1)',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md + 1,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  submitButton: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.primaryOnColor,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
});
