import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavedGigs } from '../context/SavedGigsContext';
import { borderRadius, colors, fonts } from '../constants/theme';

export default function BookmarkButton({ gigId, title, showLabel = false }: { gigId: string; title?: string; showLabel?: boolean }) {
  const { t } = useTranslation();
  const { enabled, savedIds, pendingIds, loading, error: loadError, retry, toggle } = useSavedGigs();
  const [error, setError] = useState('');
  if (!enabled) return null;
  const saved = savedIds.has(gigId);
  const pending = pendingIds.has(gigId);
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("{{value0}}{{value1}}", { value0: saved ? t("Remove saved gig") : t("Save gig"), value1: title ? t(": {{value0}}", { value0: title }) : '' })}
      accessibilityState={{ selected: saved, disabled: loading || pending || !!loadError, busy: pending }}
      aria-pressed={saved} disabled={loading || pending || !!loadError}
      style={({ pressed }) => [styles.button, saved && styles.saved, pressed && styles.pressed]}
      onPress={async event => {
        event.stopPropagation(); setError('');
        try { await toggle(gigId); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save this gig.'); }
      }}>
      {pending || loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={colors.primary} />}
      {showLabel && <Text style={styles.label}>{saved ? t("Remove") : t("Save gig")}</Text>}
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error ?? "")}</Text>}
    {!!loadError && <>
      <Text accessibilityRole="alert" style={styles.error}>{t(loadError)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Retry saved gigs')} style={styles.retry}
        onPress={event => { event.stopPropagation(); setError(''); retry(); }}>
        <Text style={styles.label}>{t('Retry')}</Text>
      </Pressable>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  container: { alignItems: 'flex-end', maxWidth: 180 },
  button: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.md },
  saved: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  pressed: { opacity: 0.7 }, label: { fontFamily: fonts.bodyMedium, color: colors.primary, fontSize: 13 },
  error: { color: colors.error, fontSize: 12, lineHeight: 17, marginTop: 4 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
});
