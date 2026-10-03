import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../FirebaseConfig';
import { AuthButton, AuthCheckbox, AuthError, AuthField, AuthScreen } from '../../components/auth/AuthUI';
import { authColors, authStyles } from '../../constants/authTheme';
import { fonts } from '../../constants/theme';

type Role = 'youth' | 'business';

const ROLE_LABEL: Record<Role, string> = {
  youth: 'Find work',
  business: 'Hire talent',
};

// The account's stored role uses the app-wide vocabulary consumed by
// home.tsx / profile.tsx, which differs from the role-select URL param.
const ROLE_TO_ACCOUNT_ROLE: Record<Role, 'freelancer' | 'client'> = {
  youth: 'freelancer',
  business: 'client',
};

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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [notifyOnMatch, setNotifyOnMatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (loading) return;
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
        role: ROLE_TO_ACCOUNT_ROLE[role],
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

  return <AuthScreen title="Your next chapter starts here" subtitle={role === 'business' ? 'Find the right local talent for your business.' : 'Find flexible work. Build skills. Make your next move.'}
    eyebrow="MAKE ROOM FOR OPPORTUNITY" compact backTo="role-select">
    <View style={authStyles.form}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change account role" disabled={loading} style={styles.role}
        onPress={() => router.replace('/(auth)/role-select')}>
        <View style={styles.roleLabel}><Ionicons name={role === 'business' ? 'storefront-outline' : 'briefcase-outline'} size={18} color={authColors.primary} />
          <Text style={styles.roleText}>{ROLE_LABEL[role]}</Text></View>
        <Text style={styles.change}>Change</Text>
      </TouchableOpacity>
      <AuthField label="Full name" icon="person-outline" value={fullName} onChangeText={value => { setFullName(value); setError(''); }}
        placeholder="Your full name" autoCapitalize="words" autoCorrect={false} autoComplete="name" textContentType="name" editable={!loading} />
      <AuthField label="Email address" icon="mail-outline" value={email} onChangeText={value => { setEmail(value); setError(''); }}
        placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!loading} />
      <AuthField label="Password" icon="lock-closed-outline" password value={password} onChangeText={value => { setPassword(value); setError(''); }}
        placeholder="Create a password" autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" editable={!loading} hint="At least 8 characters, including one number." />
      <AuthField label="Confirm password" icon="lock-closed-outline" password value={confirmPassword} onChangeText={value => { setConfirmPassword(value); setError(''); }}
        placeholder="Re-enter your password" autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" editable={!loading}
        error={confirmPassword && password !== confirmPassword ? 'Passwords do not match.' : undefined} />
      <View style={styles.checkboxes}>
        <AuthCheckbox checked={agreedToTerms} onPress={() => { setAgreedToTerms(value => !value); setError(''); }} disabled={loading}>
          I am 16 or older and agree to the Terms of Use and Privacy Policy.
        </AuthCheckbox>
        <AuthCheckbox checked={notifyOnMatch} onPress={() => setNotifyOnMatch(value => !value)} disabled={loading}>
          Send me an alert when a gig matches my skills.
        </AuthCheckbox>
      </View>
      <AuthError message={error} />
      <AuthButton title="Create account" onPress={handleRegister} loading={loading} />
    </View>
    <View style={authStyles.footer}><Text style={authStyles.footerText}>Already part of Gigzy?</Text>
      <TouchableOpacity style={authStyles.footerLink} accessibilityRole="link" onPress={() => router.replace('/(auth)/login')} disabled={loading}><Text style={authStyles.link}>Sign in</Text></TouchableOpacity>
    </View>
  </AuthScreen>;
}
const styles = StyleSheet.create({
  role: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 52, padding: 14, backgroundColor: authColors.mint, borderRadius: 13, marginBottom: 2 },
  roleLabel: { flexDirection: 'row', alignItems: 'center', gap: 9 }, roleText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: authColors.primaryDark },
  change: { fontFamily: fonts.bodyMedium, fontSize: 13, color: authColors.primary }, checkboxes: { gap: 4 },
});
