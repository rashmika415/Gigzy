import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../FirebaseConfig';
import { AuthButton, AuthError, AuthField, AuthScreen } from '../../components/auth/AuthUI';
import { authColors, authStyles } from '../../constants/authTheme';
import { fonts } from '../../constants/theme';

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/user-not-found': 'Email or password is incorrect. Try again.',
  'auth/wrong-password': 'Email or password is incorrect. Try again.',
  'auth/invalid-credential': 'Email or password is incorrect. Try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Auth context listener will trigger redirect automatically
    } catch (e: any) {
      setError(getFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return <AuthScreen title="Welcome back" subtitle="Your next opportunity is closer than you think." eyebrow="LET'S GET YOU BACK TO IT">
    <View style={authStyles.form}>
      <AuthField label="Email address" icon="mail-outline" value={email} onChangeText={value => { setEmail(value); setError(''); }}
        placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!loading} returnKeyType="next" />
      <AuthField label="Password" icon="lock-closed-outline" password value={password} onChangeText={value => { setPassword(value); setError(''); }}
        placeholder="Enter your password" autoCapitalize="none" autoComplete="current-password" textContentType="password" editable={!loading} returnKeyType="go" onSubmitEditing={handleLogin} />
      <TouchableOpacity style={styles.forgot} onPress={() => router.push('/(auth)/forgot-password')} accessibilityRole="link" disabled={loading}>
        <Text style={authStyles.link}>Forgot password?</Text>
      </TouchableOpacity>
      <AuthError message={error} />
      <AuthButton title="Sign in" onPress={handleLogin} loading={loading} />
    </View>
    <View style={authStyles.footer}>
      <Text style={authStyles.footerText}>New to Gigzy?</Text>
      <TouchableOpacity style={authStyles.footerLink} accessibilityRole="link" onPress={() => router.push('/(auth)/role-select')} disabled={loading}>
        <Text style={authStyles.link}>Create an account</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.note}>Local people. Meaningful opportunities.</Text>
  </AuthScreen>;
}
const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -8 },
  note: { textAlign: 'center', color: authColors.secondary, fontFamily: fonts.body, fontSize: 12, marginTop: 18 },
});
