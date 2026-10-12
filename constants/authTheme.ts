import { StyleSheet } from 'react-native';
import { colors, fonts } from './theme';

export const authColors = {
  background: colors.background,
  surface: colors.surface,
  primary: colors.primary,
  primaryDark: colors.primaryDark,
  mint: colors.primaryLight,
  text: colors.text,
  secondary: colors.textSecondary,
  placeholder: colors.placeholder,
  border: colors.surfaceBorder,
  error: colors.error,
  errorBackground: colors.errorLight,
};

export const authStyles = StyleSheet.create({
  form: { gap: 18 },
  paragraph: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: authColors.secondary },
  link: { fontFamily: fonts.bodyMedium, color: authColors.primary, fontSize: 15 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 24 },
  footerText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: authColors.secondary },
  footerLink: { minHeight: 44, justifyContent: 'center' },
});
