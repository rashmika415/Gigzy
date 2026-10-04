import { Text } from '../LocalizedText';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../constants/theme';
import { getGigMapData } from '../../services/gigMapData';
import type { GigMapProps } from './GigMap.types';

export default function MapResults(props: GigMapProps) {
  const { t } = useTranslation();
  const { mappedCount, remoteCount, missingLocationCount } = getGigMapData(props.gigs);
  return <View style={styles.container}>
    <Text style={styles.text}>{t("Mapped gigs: {{count}}", { count: mappedCount })}</Text>
    {(remoteCount > 0 || missingLocationCount > 0) && <TouchableOpacity accessibilityRole="button" onPress={props.onShowList}>
      <Text style={styles.link}>{t("Remote: {{remoteCount}} · Without coordinates: {{missingCount}} — view in list", { remoteCount, missingCount: missingLocationCount })}</Text>
    </TouchableOpacity>}
    {!!props.error && <Text accessibilityRole="alert" style={styles.error}>{t(props.error ?? "")}</Text>}
    <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Refresh map results")} disabled={props.loading || props.refreshing || props.loadingMore} onPress={props.onRefresh} style={styles.action}>
        {props.refreshing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="refresh" size={17} color={colors.primary} />}
        <Text style={styles.link}>{t("Refresh")}</Text>
      </TouchableOpacity>
      {props.hasMore && <TouchableOpacity accessibilityRole="button" disabled={props.loading || props.refreshing || props.loadingMore} style={styles.action} onPress={props.onLoadMore}>
        {props.loadingMore && <ActivityIndicator color={colors.primary} />}
        <Text style={styles.link}>{props.error ? t("Retry loading more") : props.loadingMore ? t("Loading...") : t("Load more gigs")}</Text>
      </TouchableOpacity>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 4, backgroundColor: colors.surface },
  text: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  link: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, color: colors.primary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  action: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18 },
});
