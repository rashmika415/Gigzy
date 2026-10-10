import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import si from '../locales/si.json';
import ta from '../locales/ta.json';

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, si: { translation: si }, ta: { translation: ta } },
  lng: 'en', fallbackLng: 'en', supportedLngs: ['en', 'si', 'ta'],
  keySeparator: false, nsSeparator: false, initAsync: false,
  interpolation: { escapeValue: false }, react: { useSuspense: false }, returnEmptyString: false,
});
// English text is also the stable lookup key. Missing translations fall back to English.
export const translate = (key: string, values?: Record<string, unknown>) => String(i18n.t(key, values ?? {}));
export default i18n;
