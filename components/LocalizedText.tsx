import { forwardRef } from 'react';
import { Text as NativeText, TextInput as NativeInput, StyleSheet, type TextProps, type TextInputProps, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
// Type and value exports intentionally share React Native's component names.
export type TextInput = NativeInput;
export type Text = NativeText;

function scriptStyle(language: string, style: TextProps['style'], content: unknown): TextStyle | undefined {
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.filter(value => typeof value === 'string').join('') : '';
  const script = /[\u0D80-\u0DFF]/.test(text) ? 'si' : /[\u0B80-\u0BFF]/.test(text) ? 'ta' : language;
  if (script !== 'si' && script !== 'ta') return;
  const flat = StyleSheet.flatten(style) ?? {};
  const bold = Number(flat.fontWeight) >= 600 || /(?:600|700|800|900)/.test(flat.fontFamily ?? '');
  return { fontFamily: `${script === 'si' ? 'NotoSansSinhala' : 'NotoSansTamil'}_${bold ? '700Bold' : '400Regular'}`,
    fontWeight: 'normal', letterSpacing: 0, lineHeight: Math.max(flat.lineHeight ?? 0, Math.ceil((flat.fontSize ?? 14) * 1.65)) };
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Text = forwardRef<NativeText, TextProps>(function LocalizedText({ style, children, ...props }, ref) {
  const { i18n } = useTranslation();
  return <NativeText {...props} ref={ref} style={[style, scriptStyle(i18n.resolvedLanguage ?? 'en', style, children)]}>{children}</NativeText>;
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TextInput = forwardRef<NativeInput, TextInputProps>(function LocalizedInput({ style, ...props }, ref) {
  const { i18n } = useTranslation();
  return <NativeInput {...props} ref={ref} style={[style, scriptStyle(i18n.resolvedLanguage ?? 'en', style, props.value ?? props.placeholder)]} />;
});
