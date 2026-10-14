import { Text } from '../LocalizedText';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../constants/theme';
import { getGigMapData } from '../../services/gigMapData';
import type { GigMapProps } from './GigMap.types';

export default function MapResults(props: GigMapProps) {
  const { t } = useTranslation();
  const { mappedCount, remoteCount, missingLocationCount } = getGigMapData(props.gigs);
  const busy = props.loading || props.refreshing || props.loadingMore;
  return <View style={styles.container}>
    <Text style={styles.text}>{t("Mapped gigs: {{count}}", { count: mappedCount })}</Text>
    {(remoteCount > 0 || missingLocationCount > 0) && <Pressable accessibilityRole="button" onPress={props.onShowList}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Text style={styles.link}>{t("Remote: {{remoteCount}} · Without coordinates: {{missingCount}} — view in list", { remoteCount, missingCount: missingLocationCount })}</Text>
    </Pressable>}
    {/* With no gigs loaded, GigMap shows the error as a full ErrorState instead. */}
    {!!props.error && props.gigs.length > 0 && <Text accessibilityRole="alert" style={styles.error}>{t(props.error ?? "")}</Text>}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Refresh map results")} disabled={busy} onPress={props.onRefresh}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
        {props.refreshing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="refresh" size={17} color={colors.primary} />}
        <Text style={styles.link}>{t("Refresh")}</Text>
      </Pressable>
      {props.hasMore && <Pressable accessibilityRole="button" disabled={busy} onPress={props.onLoadMore}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
        {props.loadingMore && <ActivityIndicator color={colors.primary} />}
        <Text style={styles.link}>{props.error ? t("Retry loading more") : props.loadingMore ? t("Loading...") : t("Load more gigs")}</Text>
      </Pressable>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, backgroundColor: colors.background },
  text: { ...typography.caption, color: colors.textSecondary },
  link: { ...typography.label, color: colors.primary, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  action: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  error: { ...typography.caption, color: colors.error },
});
