import { translate as tr } from '../../localization/i18n';
import { Text, TextInput } from '../LocalizedText';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { TextInput as NativeTextInput, TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import type { ImageProps } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authColors as palette } from '../../constants/authTheme';
import { borderRadius, colors, fonts, shadows, spacing, typography } from '../../constants/theme';
import { LANGUAGES } from '../../localization/language';
import LanguageSelector from '../LanguageSelector';
import PressableScale from '../PressableScale';

export const authPhoto = require('../../assets/images/auth/gigzy-cafe-hero.png');

// Minimum comfortable touch target and form control height.
const TOUCH = 44;
const CONTROL = 54;

export function AuthBrand() {
  useTranslation();
  return <View style={styles.brand}>
    <View style={styles.brandIcon}><Ionicons name="flash" size={20} color={palette.primary} /></View>
    <Text style={styles.brandName}>{tr("Gigzy")}<Text style={styles.brandDot}>.</Text></Text>
  </View>;
}

export function AuthPhoto({ style, compact = false }: { style?: ImageProps['style']; compact?: boolean }) {
  const { t } = useTranslation();
  return <Image source={authPhoto} style={[styles.photo, compact && styles.compactPhoto, style]}
    // The faces sit in the upper third of the photo; a centred crop cuts them off in short banners.
    contentFit="cover" contentPosition={{ top: '25%', left: '50%' }} transition={200}
    accessibilityLabel={t("Young adults collaborating with a local café owner")} />;
}

/** Compact header button showing the current language; opens a sheet with all options. */
export function AuthLanguageButton() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(language => language.code === i18n.resolvedLanguage) ?? LANGUAGES[0];
  return <>
    <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${t("Language")}: ${current.label}`}
      hitSlop={4} style={({ pressed }) => [styles.languageButton, pressed && styles.pressed]}>
      <Ionicons name="globe-outline" size={16} color={palette.primary} />
      <Text style={styles.languageText} numberOfLines={1}>{current.label}</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
      <View style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t("Close")} />
        <View style={styles.sheet}>
          <LanguageSelector onSelect={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </>;
}

/** Gentle staggered entrance; Reanimated skips it when the OS "reduce motion" setting is on. */
export const authEntrance = (order = 0) => FadeInDown.duration(380).delay(order * 70).reduceMotion(ReduceMotion.System);

export function AuthScreen({ title, subtitle, children, photo = false, backTo = 'welcome', onBack, above }: {
  title: string; subtitle: string; children: ReactNode;
  /** Show the hero photo above the form on narrow screens. Keep it off for short task screens. */
  photo?: boolean;
  backTo?: 'welcome' | 'role-select' | 'login';
  /** Overrides the header back button, e.g. to step back inside a multi-step form. */
  onBack?: () => void;
  /** Rendered above the title, e.g. a step indicator. */
  above?: ReactNode;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const goBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace(`/(auth)/${backTo}`);
  };
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t("Go back")}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <Ionicons name="arrow-back" size={20} color={palette.text} />
            </Pressable>
          </View>
          <AuthBrand />
          <View style={[styles.headerSide, styles.headerEnd]}><AuthLanguageButton /></View>
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
            {!wide && photo && <Animated.View entering={authEntrance(0)}><AuthPhoto compact /></Animated.View>}
            <Animated.View entering={authEntrance(1)} style={styles.intro}>
              {above}
              <Text accessibilityRole="header" style={styles.title}>{t(title)}</Text>
              <Text style={styles.subtitle}>{t(subtitle)}</Text>
            </Animated.View>
            <Animated.View entering={authEntrance(2)}>{children}</Animated.View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

type AuthFieldProps = TextInputProps & {
  label: string; icon: keyof typeof Ionicons.glyphMap; password?: boolean; hint?: string; error?: string;
  ref?: Ref<NativeTextInput>;
  /** Small link shown at the end of the label row, e.g. "Forgot password?". */
  action?: { label: string; onPress: () => void; disabled?: boolean };
};
export function AuthField({ label, icon, password = false, hint, error, ref, action, ...props }: AuthFieldProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{t(label)}</Text>
      {action && <Pressable onPress={action.onPress} disabled={action.disabled} accessibilityRole="link" hitSlop={12}
        style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.labelAction}>{t(action.label)}</Text>
      </Pressable>}
    </View>
    <View style={[styles.inputWrap, focused && styles.focused, !!error && styles.invalid]}>
      <Ionicons name={icon} size={19} color={error ? palette.error : focused ? palette.primary : palette.secondary} />
      <TextInput {...props} ref={ref} accessibilityLabel={t(label)} aria-invalid={!!error} style={styles.input}
        placeholderTextColor={palette.placeholder} secureTextEntry={password && !visible}
        onFocus={event => { setFocused(true); props.onFocus?.(event); }}
        onBlur={event => { setFocused(false); props.onBlur?.(event); }} />
      {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? t("Hide {{value0}}", { value0: label.toLowerCase() }) : t("Show {{value0}}", { value0: label.toLowerCase() })}
        accessibilityState={{ disabled: props.editable === false }} disabled={props.editable === false}
        style={({ pressed }) => [styles.eye, pressed && styles.pressed]} onPress={() => setVisible(previous => !previous)}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.secondary} />
      </Pressable>}
    </View>
    {!!(error || hint) && <Text style={[styles.hint, !!error && styles.errorText]}
      accessibilityLiveRegion={error ? 'polite' : 'none'}>{t(error || hint || '')}</Text>}
  </View>;
}

export function AuthButton({ title, onPress, loading = false, disabled = false, secondary = false, arrow = true }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean;
  /** Trailing arrow for forward-moving actions. Turn off for "back" or neutral actions. */
  arrow?: boolean;
}) {
  const { t } = useTranslation();
  const inactive = loading || disabled;
  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };
  return <PressableScale onPress={handlePress} disabled={inactive}
    accessibilityRole="button" accessibilityState={{ disabled: inactive, busy: loading }}
    aria-disabled={inactive} aria-busy={loading}
    style={[styles.button, secondary && styles.secondaryButton, inactive && styles.disabled]}>
    {loading ? <ActivityIndicator color={secondary ? palette.primary : palette.surface} /> : <>
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{t(title)}</Text>
      {arrow && <Ionicons name="arrow-forward" size={18} color={secondary ? palette.primary : palette.surface} />}
    </>}
  </PressableScale>;
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
  useTranslation();
  return <Pressable style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]} onPress={onPress} disabled={disabled}
    accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} aria-checked={checked} aria-disabled={disabled}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Ionicons name="checkmark" size={15} color={palette.surface} />}
    </View>
    <Text style={styles.checkboxText}>{children}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background }, flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  pressed: { opacity: 0.7 },

  header: { width: '100%', maxWidth: 1080, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },
  headerSide: { flex: 1, alignItems: 'flex-start' }, headerEnd: { alignItems: 'flex-end' },
  back: { width: TOUCH, height: TOUCH, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandIcon: { width: 34, height: 34, borderRadius: borderRadius.md, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: fonts.brand, fontSize: 26, letterSpacing: -1, color: palette.text }, brandDot: { color: palette.primary },

  languageButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: TOUCH, maxWidth: 120, paddingHorizontal: spacing.sm + spacing.xs, borderRadius: borderRadius.full, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  languageText: { ...typography.caption, color: palette.text, flexShrink: 1 },
  sheetWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.overlay },
  sheet: { width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: palette.surface, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, ...shadows.card },

  layout: { width: '100%', maxWidth: 480, alignSelf: 'center', flex: 1 },
  wideLayout: { maxWidth: 1080, flexDirection: 'row', gap: 72, alignItems: 'center', paddingVertical: spacing.xl },
  formColumn: { width: '100%' }, wideFormColumn: { flex: 1, maxWidth: 440 },
  photo: { height: 160, width: '100%', borderRadius: borderRadius.lg, backgroundColor: palette.mint }, compactPhoto: { height: 140 },
  story: { flex: 1 }, storyPhoto: { height: 340, borderRadius: borderRadius.xl }, storyCopy: { paddingTop: spacing.lg, paddingHorizontal: spacing.sm },
  storyLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }, storyEyebrow: { ...typography.overline, color: palette.primary },
  storyTitle: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 42, letterSpacing: -0.6, color: palette.text, marginTop: spacing.sm + spacing.xs },
  storyBody: { ...typography.body, fontSize: 16, lineHeight: 25, color: palette.secondary, maxWidth: 350, marginTop: spacing.sm + spacing.xs },

  intro: { paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  title: { ...typography.display, color: palette.text },
  subtitle: { ...typography.body, color: palette.secondary },

  field: { gap: spacing.sm }, label: { ...typography.label, color: palette.text, flexShrink: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  labelAction: { ...typography.label, color: palette.primary },
  inputWrap: { flexDirection: 'row', alignItems: 'center', minHeight: CONTROL, borderRadius: borderRadius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingLeft: spacing.md, paddingRight: spacing.sm, gap: spacing.sm + spacing.xs },
  focused: { borderColor: palette.primary }, invalid: { borderColor: palette.error },
  input: { flex: 1, minWidth: 0, height: CONTROL - 2, fontFamily: fonts.body, fontSize: 16, color: palette.text, ...Platform.select({ web: { outlineWidth: 0 } }) },
  eye: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  hint: { ...typography.caption, fontFamily: fonts.body, lineHeight: 18, color: palette.secondary }, errorText: { color: palette.error },

  button: { minHeight: CONTROL, borderRadius: borderRadius.md, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm + spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  buttonText: { ...typography.title, flexShrink: 1, textAlign: 'center', color: palette.surface },
  secondaryButton: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { color: palette.primary }, disabled: { opacity: 0.65 },

  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: palette.errorBackground },
  errorMessage: { ...typography.body, fontSize: 14, lineHeight: 21, flex: 1, color: palette.error },

  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + spacing.xs, minHeight: TOUCH, paddingVertical: spacing.xs + 2 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: palette.placeholder, borderRadius: borderRadius.sm - 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: palette.primary, borderColor: palette.primary },
  checkboxText: { ...typography.bodySmall, lineHeight: 21, flex: 1, color: palette.secondary },
});
