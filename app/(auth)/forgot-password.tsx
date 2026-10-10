import { Text } from '../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../FirebaseConfig';
import { AuthButton, AuthError, AuthField, AuthScreen } from '../../components/auth/AuthUI';
import { authColors, authStyles } from '../../constants/authTheme';

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendResetLink = async () => {
    if (loading) return;
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (e: any) {
      setError(getFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return <AuthScreen title={sent ? t("Check your inbox") : t("A fresh start")} eyebrow={t("LET'S GET YOU BACK IN")} compact backTo="login"
    subtitle={sent ? t("Follow the link in your email to choose a new password.") : t("Forgot your password? We will help you get back to your next opportunity.")}>
    {sent ? <View style={authStyles.form}>
      <View style={styles.success}><Ionicons name="mail-open-outline" size={28} color={authColors.primary} />
        <Text style={authStyles.paragraph}>{t("If an account exists for")}{email.trim()}{t(", you will receive a password reset link. Check your spam folder too.")}</Text>
      </View>
      <AuthButton title={t("Back to sign in")} onPress={() => router.replace('/(auth)/login')} />
      <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => { setSent(false); setError(''); }}><Text style={authStyles.link}>{t("Try another email address")}</Text></TouchableOpacity>
    </View> : <View style={authStyles.form}>
      <AuthField label={t("Email address")} icon="mail-outline" value={email} onChangeText={value => { setEmail(value); setError(''); }}
        placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!loading}
        returnKeyType="send" onSubmitEditing={handleSendResetLink} />
      <AuthError message={t(error ?? "")} />
      <AuthButton title={t("Send reset link")} onPress={handleSendResetLink} loading={loading} />
      <View style={authStyles.footer}><Text style={authStyles.footerText}>{t("Remember your password?")}</Text>
        <TouchableOpacity accessibilityRole="link" style={authStyles.footerLink} onPress={() => router.replace('/(auth)/login')}><Text style={authStyles.link}>{t("Sign in")}</Text></TouchableOpacity>
      </View>
    </View>}
  </AuthScreen>;
}
const styles = StyleSheet.create({
  success: { padding: 20, borderRadius: 16, backgroundColor: authColors.mint, gap: 12 },
  retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
