import { Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import LocationMap from './maps/LocationMap';
import { validCoordinates } from '../services/discoveryFilters';
import { gigDirectionsUrl } from '../services/gigDirections';
import { colors, borderRadius } from '../constants/theme';
import type { Gig } from '../types/gig';

export default function GigMeetingPoint({ gig }: { gig: Gig }) {
  const { t } = useTranslation();
  if (gig.locationType === 'remote') return null;
  const hasPin = validCoordinates(gig.coordinates);
  const url = gigDirectionsUrl(gig.location, gig.coordinates);
  const openDirections = async () => {
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert(t('Unable to open maps'), t('Please try again or search the meeting address in your maps app.')); }
  };
  return <View style={styles.card}>
    <Text style={styles.title}>{t('Meeting point')}</Text>
    <Text selectable style={styles.address}>{gig.location || t('See the selected pin below.')}</Text>
    {hasPin ? <LocationMap point={gig.coordinates} compact /> : <Text style={styles.note}>{t('The business has not added an exact pin. Confirm the meeting point before travelling.')}</Text>}
    {!!url && <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={openDirections}>
      <Ionicons name="navigate-outline" size={20} color={colors.primary} />
      <Text style={styles.buttonText}>{hasPin ? t('Get directions') : t('Find address in Maps')}</Text>
    </TouchableOpacity>}
    {hasPin && <Text style={styles.note}>{t('Directions use the exact pin selected by the business.')}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, marginHorizontal: 20, marginBottom: 20, borderRadius: borderRadius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  address: { fontSize: 15, lineHeight: 22, color: colors.text },
  note: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.primary },
  buttonText: { fontWeight: '600', color: colors.primary },
});
