export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-LK' },
  { code: 'si', label: 'සිංහල', locale: 'si-LK' },
  { code: 'ta', label: 'தமிழ்', locale: 'ta-LK' },
] as const;
export type Language = typeof LANGUAGES[number]['code'];
export const LANGUAGE_STORAGE_KEY = 'localworks.language';
/** Key used before the rename; read once so existing users keep their language. */
export const LEGACY_LANGUAGE_STORAGE_KEY = 'gigzy.language';
export function isLanguage(value: unknown): value is Language { return LANGUAGES.some(language => language.code === value); }
export function resolveLanguage(saved: unknown, deviceLanguages: (string | null)[]): Language {
  if (isLanguage(saved)) return saved;
  for (const locale of deviceLanguages) {
    const code = locale?.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(code)) return code;
  }
  return 'en';
}
