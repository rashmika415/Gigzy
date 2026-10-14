import { translate as tr } from '../../localization/i18n';
import { Text } from '../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TextInput } from 'react-native';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../FirebaseConfig';
import { AuthButton, AuthError, AuthField, AuthScreen } from '../../components/auth/AuthUI';
import { authStyles } from '../../constants/authTheme';

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/user-not-found': 'Email or password is incorrect. Try again.',
  'auth/wrong-password': 'Email or password is incorrect. Try again.',
  'auth/invalid-credential': 'Email or password is incorrect. Try again.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

export default function Login() {
  const { t } = useTranslation();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Field errors sit under their input; `error` is for server responses only.
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');

  const validate = () => {
    const trimmed = email.trim();
    const nextEmailError = !trimmed ? 'Please enter your email address.'
      : !EMAIL_PATTERN.test(trimmed) ? 'Please enter a valid email address.' : '';
    const nextPasswordError = password ? '' : 'Please enter your password.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError) return false;
    if (nextPasswordError) { passwordRef.current?.focus(); return false; }
    return true;
  };

  const handleLogin = async () => {
    if (loading) return;
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Auth context listener will trigger redirect automatically
    } catch (e: any) {
      if (e.code === 'auth/invalid-email') setEmailError('Please enter a valid email address.');
      else setError(getFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return <AuthScreen title={t("Welcome back")} subtitle={t("Your next opportunity is closer than you think.")}>
    <View style={authStyles.form}>
      <AuthField label={t("Email address")} icon="mail-outline" value={email} error={emailError}
        onChangeText={value => { setEmail(value); setEmailError(''); setError(''); }}
        placeholder={tr("you@example.com")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!loading}
        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />
      <AuthField ref={passwordRef} label={t("Password")} icon="lock-closed-outline" password value={password} error={passwordError}
        onChangeText={value => { setPassword(value); setPasswordError(''); setError(''); }}
        action={{ label: t("Forgot password?"), onPress: () => router.push('/(auth)/forgot-password'), disabled: loading }}
        placeholder={t("Enter your password")} autoCapitalize="none" autoComplete="current-password" textContentType="password" editable={!loading} returnKeyType="go" onSubmitEditing={handleLogin} />
      <AuthError message={t(error ?? "")} />
      <AuthButton title={t("Sign in")} onPress={handleLogin} loading={loading} />
    </View>
    <View style={authStyles.footer}>
      <Text style={authStyles.footerText}>{t("New to LocalWorks?")}</Text>
      <Pressable style={({ pressed }) => [authStyles.footerLink, pressed && styles.pressed]} accessibilityRole="link" onPress={() => router.push('/(auth)/role-select')} disabled={loading}>
        <Text style={authStyles.link}>{t("Create an account")}</Text>
      </Pressable>
    </View>
  </AuthScreen>;
}
const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
});
