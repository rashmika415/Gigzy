import { StyleSheet } from 'react-native';
import { colors, fonts, spacing, typography } from './theme';

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
  form: { gap: spacing.md + 2 },
  paragraph: { ...typography.body, lineHeight: 23, color: authColors.secondary },
  link: { ...typography.body, fontFamily: fonts.bodySemiBold, color: authColors.primary },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
  footerText: { ...typography.body, fontSize: 14, color: authColors.secondary },
  footerLink: { minHeight: 44, justifyContent: 'center' },
});
