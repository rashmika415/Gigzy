import { Text, TextInput } from '../LocalizedText';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import type { ImageProps } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authColors as palette } from '../../constants/authTheme';
import { fonts } from '../../constants/theme';
import LanguageSelector from '../LanguageSelector';

export const authPhoto = require('../../assets/images/auth/gigzy-cafe-hero.png');

export function AuthBrand() {
  return <View style={styles.brand}>
    <View style={styles.brandIcon}><Ionicons name="flash" size={20} color={palette.primary} /></View>
    <Text style={styles.brandName}>Gigzy<Text style={styles.brandDot}>.</Text></Text>
  </View>;
}

export function AuthPhoto({ style, compact = false }: { style?: ImageProps['style']; compact?: boolean }) {
  const { t } = useTranslation();
  return <Image source={authPhoto} style={[styles.photo, compact && styles.compactPhoto, style]}
    contentFit="cover" contentPosition="center" transition={200}
    accessibilityLabel={t("Young adults collaborating with a local café owner")} />;
}

export function AuthScreen({ title, subtitle, eyebrow = 'YOUR NEXT CHAPTER', children, compact = false, backTo = 'welcome' }: {
  title: string; subtitle: string; eyebrow?: string; children: ReactNode; compact?: boolean;
  backTo?: 'welcome' | 'role-select' | 'login';
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/(auth)/${backTo}`);
  };
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel={t("Go back")} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </TouchableOpacity>
          <AuthBrand />
          <View style={styles.headerSpacer} />
        </View>
        <View style={[styles.layout, wide && styles.wideLayout]}>
          {wide && <View style={styles.story}>
            <AuthPhoto style={styles.storyPhoto} />
            <View style={styles.storyCopy}>
              <View style={styles.storyLabel}><Ionicons name="location-outline" size={16} color={palette.primary} /><Text style={styles.storyEyebrow}>{t("GOOD WORK. CLOSE TO HOME.")}</Text></View>
              <Text style={styles.storyTitle}>{t("Small gigs.")}{ '\n' }{t("Big possibilities.")}</Text>
              <Text style={styles.storyBody}>{t("Meet local businesses, put your skills to work, and make your next move.")}</Text>
            </View>
          </View>}
          <View style={[styles.formColumn, wide && styles.wideFormColumn]}>
            {!wide && <AuthPhoto compact={compact} />}
            <LanguageSelector />
            <View style={styles.intro}>
              <Text style={styles.eyebrow}>{t(eyebrow)}</Text>
              <Text accessibilityRole="header" style={styles.title}>{t(title)}</Text>
              <Text style={styles.subtitle}>{t(subtitle)}</Text>
            </View>
            {children}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

type AuthFieldProps = TextInputProps & {
  label: string; icon: keyof typeof Ionicons.glyphMap; password?: boolean; hint?: string; error?: string;
};
export function AuthField({ label, icon, password = false, hint, error, ...props }: AuthFieldProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{t(label)}</Text>
    <View style={[styles.inputWrap, focused && styles.focused, !!error && styles.invalid]}>
      <Ionicons name={icon} size={19} color={focused ? palette.primary : palette.secondary} />
      <TextInput {...props} accessibilityLabel={t(label)} style={styles.input}
        placeholderTextColor={palette.placeholder} secureTextEntry={password && !visible}
        onFocus={event => { setFocused(true); props.onFocus?.(event); }}
        onBlur={event => { setFocused(false); props.onBlur?.(event); }} />
      {password && <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible ? t("Hide {{value0}}", { value0: label.toLowerCase() }) : t("Show {{value0}}", { value0: label.toLowerCase() })}
        accessibilityState={{ disabled: props.editable === false }} disabled={props.editable === false}
        style={styles.eye} onPress={() => setVisible(previous => !previous)}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.secondary} />
      </TouchableOpacity>}
    </View>
    {!!(error || hint) && <Text style={[styles.hint, !!error && styles.errorText]}>{t(error || hint || '')}</Text>}
  </View>;
}

export function AuthButton({ title, onPress, loading = false, disabled = false, secondary = false }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean;
}) {
  const { t } = useTranslation();
  return <TouchableOpacity onPress={onPress} disabled={loading || disabled} activeOpacity={0.85}
    accessibilityRole="button" accessibilityState={{ disabled: loading || disabled, busy: loading }}
    aria-disabled={loading || disabled} aria-busy={loading}
    style={[styles.button, secondary && styles.secondaryButton, (loading || disabled) && styles.disabled]}>
    {loading ? <ActivityIndicator color={secondary ? palette.primary : palette.surface} /> : <>
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{t(title)}</Text>
      <Ionicons name="arrow-forward" size={18} color={secondary ? palette.primary : palette.surface} />
    </>}
  </TouchableOpacity>;
}

export function AuthError({ message }: { message: string }) {
  const { t } = useTranslation();
  if (!message) return null;
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" aria-live="polite" style={styles.error}>
    <Ionicons name="alert-circle-outline" size={20} color={palette.error} />
    <Text style={styles.errorMessage}>{t(message)}</Text>
  </View>;
}

export function AuthCheckbox({ checked, onPress, children, disabled = false }: {
  checked: boolean; onPress: () => void; children: ReactNode; disabled?: boolean;
}) {
  return <TouchableOpacity style={styles.checkboxRow} onPress={onPress} disabled={disabled} activeOpacity={0.8}
    accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} aria-checked={checked} aria-disabled={disabled}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Ionicons name="checkmark" size={15} color={palette.surface} />}
    </View>
    <Text style={styles.checkboxText}>{children}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background }, flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  header: { width: '100%', maxWidth: 1080, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, marginBottom: 8 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  headerSpacer: { width: 44 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: fonts.heading, fontSize: 26, letterSpacing: -1.3, color: palette.text }, brandDot: { color: palette.primary },
  layout: { width: '100%', maxWidth: 480, alignSelf: 'center', flex: 1 },
  wideLayout: { maxWidth: 1080, flexDirection: 'row', gap: 72, alignItems: 'center', paddingVertical: 32 },
  formColumn: { width: '100%' }, wideFormColumn: { flex: 1, maxWidth: 440 },
  photo: { height: 160, width: '100%', borderRadius: 20, backgroundColor: palette.mint }, compactPhoto: { height: 108 },
  story: { flex: 1 }, storyPhoto: { height: 340, borderRadius: 28 }, storyCopy: { paddingTop: 28, paddingHorizontal: 8 },
  storyLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 }, storyEyebrow: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.5, color: palette.primary },
  storyTitle: { fontFamily: fonts.heading, fontSize: 38, lineHeight: 44, letterSpacing: -1.5, color: palette.text, marginTop: 12 },
  storyBody: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: palette.secondary, maxWidth: 350, marginTop: 12 },
  intro: { paddingTop: 26, paddingBottom: 26, gap: 9 }, eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.7, color: palette.primary },
  title: { fontFamily: fonts.heading, fontSize: 31, lineHeight: 39, letterSpacing: -1.2, color: palette.text },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: palette.secondary },
  field: { gap: 8 }, label: { fontFamily: fonts.bodyMedium, color: palette.text, fontSize: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingLeft: 16, paddingRight: 8, gap: 11 },
  focused: { borderColor: palette.primary }, invalid: { borderColor: palette.error },
  input: { flex: 1, minWidth: 0, height: 52, fontFamily: fonts.body, fontSize: 16, color: palette.text, ...Platform.select({ web: { outlineWidth: 0 } }) },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: palette.secondary }, errorText: { color: palette.error },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 15 },
  buttonText: { flexShrink: 1, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 16, color: palette.surface },
  secondaryButton: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { color: palette.primary }, disabled: { opacity: 0.65 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, backgroundColor: palette.errorBackground },
  errorMessage: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: palette.error },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, minHeight: 44, paddingVertical: 6 },
  checkbox: { width: 21, height: 21, borderWidth: 1, borderColor: palette.placeholder, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: palette.primary, borderColor: palette.primary },
  checkboxText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 21, color: palette.secondary },
});
