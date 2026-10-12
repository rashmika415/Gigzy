import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../localization/language';
import { useLanguage } from '../localization/LanguageProvider';
import { Text } from './LocalizedText';
import { colors, borderRadius, spacing } from '../constants/theme';

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const { changeLanguage, error } = useLanguage();
  return <View style={styles.container}>
    <Text style={styles.heading}>{t('Language')}</Text>
    <View style={styles.options}>{LANGUAGES.map(language => {
      const selected = i18n.resolvedLanguage === language.code;
      return <TouchableOpacity key={language.code} accessibilityRole="radio" accessibilityLabel={language.label}
        accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => changeLanguage(language.code)} style={[styles.option, selected && styles.selected]}>
        <Text style={[styles.label, selected && styles.selectedLabel]}>{language.label}</Text>
      </TouchableOpacity>;
    })}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: '100%', paddingVertical: spacing.md, gap: spacing.sm }, heading: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { minHeight: 44, minWidth: 80, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.primaryLight, borderColor: colors.primary }, label: { fontSize: 14, color: colors.text }, selectedLabel: { color: colors.primary }, error: { color: colors.error, fontSize: 12 },
});
