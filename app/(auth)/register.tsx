import { translate as tr } from '../../localization/i18n';
import { Text } from '../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../FirebaseConfig';
import { createRegisteredProfile, lookupReferral } from '../../services/referralService';
import Animated from 'react-native-reanimated';
import { AuthButton, AuthCheckbox, AuthError, AuthField, AuthScreen, authEntrance } from '../../components/auth/AuthUI';
import { authColors, authStyles } from '../../constants/authTheme';
import { borderRadius, spacing, typography } from '../../constants/theme';

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
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'Includes a number', test: (value: string) => /\d/.test(value) },
];

function isValidPassword(password: string): boolean {
  return PASSWORD_RULES.every(rule => rule.test(password));
}

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'confirmPassword', string>>;

export default function Register() {
  const { t } = useTranslation();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const role: Role = roleParam === 'business' ? 'business' : 'youth';

  useEffect(() => {
    if (roleParam !== 'youth' && roleParam !== 'business') {
      router.replace('/(auth)/role-select');
    }
  }, [roleParam]);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [notifyOnMatch, setNotifyOnMatch] = useState(false);
  const [loading, setLoading] = useState(false);
  // Field errors sit under their input; `error` is for terms and server responses.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');

  const clearError = (field: keyof FieldErrors) => {
    setFieldErrors(previous => ({ ...previous, [field]: undefined }));
    setError('');
  };

  const [step, setStep] = useState<1 | 2>(1);

  const validateDetails = () => {
    const trimmedEmail = email.trim();
    const next: FieldErrors = {
      fullName: fullName.trim() ? undefined : 'Please enter your full name.',
      email: !trimmedEmail ? 'Please enter your email address.'
        : !EMAIL_PATTERN.test(trimmedEmail) ? 'Please enter a valid email address.' : undefined,
      password: !password ? 'Please enter your password.'
        : !isValidPassword(password) ? 'Password must be at least 8 characters, with one number.' : undefined,
      confirmPassword: password !== confirmPassword ? 'Passwords do not match.' : undefined,
    };
    setFieldErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const goToChoices = () => {
    setError('');
    if (validateDetails()) setStep(2);
  };

  const handleRegister = async () => {
    if (loading) return;
    setError('');
    if (!validateDetails()) { setStep(1); return; }
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Use and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      const referral = await lookupReferral(referralCode);
      const credential = auth.currentUser?.email?.toLowerCase() === email.trim().toLowerCase()
        ? { user: auth.currentUser } : await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });

      await createRegisteredProfile(credential.user.uid, {
        uid: credential.user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        role: ROLE_TO_ACCOUNT_ROLE[role],
        notifyOnMatch,
      }, referral);

      // Auth context listener will trigger redirect automatically
    } catch (e: any) {
      // Email problems belong to step 1, so send the user back to fix them there.
      if (e.code === 'auth/invalid-email' || e.code === 'auth/email-already-in-use') {
        setFieldErrors(previous => ({ ...previous, email: e.code === 'auth/invalid-email' ? 'Please enter a valid email address.' : getFirebaseError(e.code) }));
        setStep(1);
      } else setError(e.code?.startsWith('auth/') ? getFirebaseError(e.code) : e.message || 'Could not finish registration. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const stepIndicator = <View style={styles.steps} accessibilityRole="progressbar"
    accessibilityValue={{ min: 1, max: 2, now: step }} accessibilityLabel={t("Step {{current}} of {{total}}", { current: step, total: 2 })}>
    <Text style={styles.stepText}>{t("Step {{current}} of {{total}}", { current: step, total: 2 })}</Text>
    <View style={styles.stepBars}>
      <View style={[styles.stepBar, styles.stepBarDone]} />
      <View style={[styles.stepBar, step === 2 && styles.stepBarDone]} />
    </View>
  </View>;

  return <AuthScreen photo={step === 1} backTo="role-select" above={stepIndicator}
    onBack={step === 2 && !loading ? () => { setError(''); setStep(1); } : undefined}
    title={step === 2 ? t("Almost done") : role === 'business' ? t("Start hiring local talent") : t("Start finding local work")}
    subtitle={step === 2 ? t("Just a couple of choices before you start.")
      : role === 'business' ? t("Find the right local talent for your business.") : t("Find flexible work. Build skills. Make your next move.")}>
    {step === 1 ? <Animated.View key="details" entering={authEntrance(0)} style={authStyles.form}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Change account role")} disabled={loading}
        style={({ pressed }) => [styles.role, pressed && styles.pressed]} onPress={() => router.replace('/(auth)/role-select')}>
        <View style={styles.roleLabel}><Ionicons name={role === 'business' ? 'storefront-outline' : 'briefcase-outline'} size={18} color={authColors.primary} />
          <Text style={styles.roleText}>{t(ROLE_LABEL[role])}</Text></View>
        <Text style={styles.change}>{t("Change")}</Text>
      </Pressable>
      <AuthField label={t("Full name")} icon="person-outline" value={fullName} error={fieldErrors.fullName}
        onChangeText={value => { setFullName(value); clearError('fullName'); }}
        placeholder={t("Your full name")} autoCapitalize="words" autoCorrect={false} autoComplete="name" textContentType="name" editable={!loading}
        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} />
      <AuthField ref={emailRef} label={t("Email address")} icon="mail-outline" value={email} error={fieldErrors.email}
        onChangeText={value => { setEmail(value); clearError('email'); }}
        placeholder={tr("you@example.com")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!loading}
        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />
      <View style={styles.passwordGroup}>
        <AuthField ref={passwordRef} label={t("Password")} icon="lock-closed-outline" password value={password} error={fieldErrors.password}
          onChangeText={value => { setPassword(value); clearError('password'); }}
          placeholder={t("Create a password")} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" editable={!loading}
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => confirmRef.current?.focus()} />
        {!fieldErrors.password && <View style={styles.rules}>{PASSWORD_RULES.map(rule => {
          const met = rule.test(password);
          return <View key={rule.label} style={styles.rule} accessibilityState={{ checked: met }}>
            <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={met ? authColors.primary : authColors.placeholder} />
            <Text style={[styles.ruleText, met && styles.ruleMet]}>{t(rule.label)}</Text>
          </View>;
        })}</View>}
      </View>
      <AuthField ref={confirmRef} label={t("Confirm password")} icon="lock-closed-outline" password value={confirmPassword}
        onChangeText={value => { setConfirmPassword(value); clearError('confirmPassword'); }}
        placeholder={t("Re-enter your password")} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" editable={!loading}
        returnKeyType="next" onSubmitEditing={goToChoices}
        error={fieldErrors.confirmPassword ?? (confirmPassword && password !== confirmPassword ? 'Passwords do not match.' : undefined)} />
      <AuthButton title={t("Continue")} onPress={goToChoices} />
    </Animated.View> : <Animated.View key="choices" entering={authEntrance(0)} style={authStyles.form}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Edit")} disabled={loading} onPress={() => setStep(1)}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
        <View style={styles.icon}><Ionicons name={role === 'business' ? 'storefront-outline' : 'briefcase-outline'} size={18} color={authColors.primary} /></View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryName} numberOfLines={1}>{fullName.trim()}</Text>
          <Text style={styles.summaryEmail} numberOfLines={1}>{email.trim()}</Text>
        </View>
        <Text style={styles.change}>{t("Edit")}</Text>
      </Pressable>
      <View style={styles.checkboxes}>
        <AuthCheckbox checked={agreedToTerms} onPress={() => { setAgreedToTerms(value => !value); setError(''); }} disabled={loading}>{t("I am 16 or older and agree to the Terms of Use and Privacy Policy.")}</AuthCheckbox>
        <AuthCheckbox checked={notifyOnMatch} onPress={() => setNotifyOnMatch(value => !value)} disabled={loading}>{t("Send me an alert when a gig matches my skills.")}</AuthCheckbox>
      </View>
      {showReferral || referralCode
        ? <AuthField label={t('Referral code (optional)')} icon="gift-outline" value={referralCode}
          onChangeText={value => { setReferralCode(value.toUpperCase()); setError(''); }}
          autoCapitalize="characters" autoCorrect={false} maxLength={10} editable={!loading} placeholder={t('Enter a friend’s code')} autoFocus={showReferral && !referralCode} />
        : <Pressable accessibilityRole="button" disabled={loading} onPress={() => setShowReferral(true)}
          style={({ pressed }) => [styles.referralLink, pressed && styles.pressed]}>
          <Ionicons name="gift-outline" size={18} color={authColors.primary} />
          <Text style={authStyles.link}>{t("Have a referral code?")}</Text>
        </Pressable>}
      <AuthError message={t(error ?? "")} />
      <AuthButton title={t("Create account")} onPress={handleRegister} loading={loading} />
    </Animated.View>}
    <View style={authStyles.footer}><Text style={authStyles.footerText}>{t("Already part of LocalWorks?")}</Text>
      <Pressable style={({ pressed }) => [authStyles.footerLink, pressed && styles.pressed]} accessibilityRole="link" onPress={() => router.replace('/(auth)/login')} disabled={loading}><Text style={authStyles.link}>{t("Sign in")}</Text></Pressable>
    </View>
  </AuthScreen>;
}
const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  role: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm + spacing.xs, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, backgroundColor: authColors.mint, borderRadius: borderRadius.md },
  roleLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, roleText: { ...typography.label, fontSize: 14, color: authColors.primaryDark },
  change: { ...typography.label, color: authColors.primary },
  passwordGroup: { gap: spacing.sm + 2 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  ruleText: { ...typography.caption, fontFamily: typography.bodySmall.fontFamily, color: authColors.secondary }, ruleMet: { color: authColors.primaryDark },
  checkboxes: { gap: spacing.xs },
  steps: { gap: spacing.sm, marginBottom: spacing.xs },
  stepText: { ...typography.caption, color: authColors.secondary },
  stepBars: { flexDirection: 'row', gap: spacing.xs + 2 },
  stepBar: { flex: 1, height: 4, borderRadius: borderRadius.full, backgroundColor: authColors.border },
  stepBarDone: { backgroundColor: authColors.primary },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: authColors.border, backgroundColor: authColors.surface },
  icon: { width: 36, height: 36, borderRadius: borderRadius.sm + 2, backgroundColor: authColors.mint, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryName: { ...typography.title, fontSize: 15, color: authColors.text },
  summaryEmail: { ...typography.bodySmall, color: authColors.secondary },
  referralLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, alignSelf: 'flex-start' },
});
