import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { ActivityIndicator, Platform, View } from 'react-native';
import i18n from './i18n';
import { LANGUAGE_STORAGE_KEY, resolveLanguage, type Language } from './language';
import { colors } from '../constants/theme';

const LanguageContext = createContext<{ changeLanguage: (language: Language) => void; error: string }>({ changeLanguage: () => {}, error: '' });
export const useLanguage = () => useContext(LanguageContext);

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    async function restore() {
      let saved: string | null = null;
      try { saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* Device language remains usable. */ }
      let languages: (string | null)[] = [];
      try { languages = getLocales().map(locale => locale.languageTag); } catch { /* Default to English. */ }
      if (!active) return;
      await i18n.changeLanguage(resolveLanguage(saved, languages));
      if (active) setReady(true);
    }
    void restore();
    const updateDocument = (language: string) => { if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = language; };
    i18n.on('languageChanged', updateDocument);
    return () => { active = false; i18n.off('languageChanged', updateDocument); };
  }, []);
  const changeLanguage = (language: Language) => {
    setError('');
    void i18n.changeLanguage(language);
    writes.current = writes.current.then(async () => {
      try { await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language); setError(''); }
      catch { setError('Language changed, but could not be saved. Please try again.'); }
    });
  };
  return <I18nextProvider i18n={i18n}><LanguageContext.Provider value={{ changeLanguage, error }}>
    {ready ? children : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>}
  </LanguageContext.Provider></I18nextProvider>;
}
