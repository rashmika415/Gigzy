import { translate as tr } from '../../localization/i18n';
import { Text } from '../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../FirebaseConfig';
import { AuthButton, AuthError, AuthField, AuthScreen } from '../../components/auth/AuthUI';
import { authColors, authStyles } from '../../constants/authTheme';
import { borderRadius, spacing, typography } from '../../constants/theme';

// No "user not found" message on purpose: the screen never reveals whether an
// email has an account, so an unknown address is treated the same as a sent link.
const FIREBASE_ERRORS: Record<string, string> = {
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(seconds => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendResetLink = async () => {
    if (loading) return;
    const trimmed = email.trim();
    const nextEmailError = !trimmed ? 'Please enter your email address.'
      : !EMAIL_PATTERN.test(trimmed) ? 'Please enter a valid email address.' : '';
    setEmailError(nextEmailError);
    setError('');
    if (nextEmailError) return;
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') { setSent(true); setCooldown(RESEND_COOLDOWN_SECONDS); }
      else if (e.code === 'auth/invalid-email') { setSent(false); setEmailError('Please enter a valid email address.'); }
      else setError(getFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return <AuthScreen title={sent ? t("Check your inbox") : t("A fresh start")} backTo="login"
    subtitle={sent ? t("Follow the link in your email to choose a new password.") : t("Forgot your password? We will help you get back to your next opportunity.")}>
    {sent ? <View style={authStyles.form}>
      <View style={styles.success}>
        <View style={styles.successIcon}><Ionicons name="mail-open-outline" size={32} color={authColors.primary} /></View>
        <Text style={styles.sentTo}>{email.trim()}</Text>
        <Text style={[authStyles.paragraph, styles.center]}>{t("If an account exists for {{email}}, you will receive a password reset link. Check your spam folder too.", { email: email.trim() })}</Text>
      </View>
      <AuthError message={t(error ?? "")} />
      <AuthButton title={t("Back to sign in")} arrow={false} onPress={() => router.replace('/(auth)/login')} />
      <AuthButton secondary arrow={false} loading={loading} disabled={cooldown > 0} onPress={sendResetLink}
        title={cooldown > 0 ? t("Resend in {{seconds}}s", { seconds: cooldown }) : t("Resend email")} />
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        onPress={() => { setSent(false); setError(''); setCooldown(0); }}>
        <Text style={authStyles.link}>{t("Try another email address")}</Text>
      </Pressable>
    </View> : <View style={authStyles.form}>
      <AuthField label={t("Email address")} icon="mail-outline" value={email} error={emailError}
        onChangeText={value => { setEmail(value); setEmailError(''); setError(''); }}
        placeholder={tr("you@example.com")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!loading}
        returnKeyType="send" onSubmitEditing={sendResetLink} />
      <AuthError message={t(error ?? "")} />
      <AuthButton title={t("Send reset link")} onPress={sendResetLink} loading={loading} />
      <View style={authStyles.footer}><Text style={authStyles.footerText}>{t("Remember your password?")}</Text>
        <Pressable accessibilityRole="link" style={({ pressed }) => [authStyles.footerLink, pressed && styles.pressed]} onPress={() => router.replace('/(auth)/login')}><Text style={authStyles.link}>{t("Sign in")}</Text></Pressable>
      </View>
    </View>}
  </AuthScreen>;
}
const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  success: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md + spacing.xs, borderRadius: borderRadius.lg, backgroundColor: authColors.surface, borderWidth: 1, borderColor: authColors.border, gap: spacing.sm + spacing.xs },
  successIcon: { width: 72, height: 72, borderRadius: borderRadius.full, backgroundColor: authColors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  sentTo: { ...typography.title, color: authColors.text, textAlign: 'center' },
  center: { textAlign: 'center' },
  retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
