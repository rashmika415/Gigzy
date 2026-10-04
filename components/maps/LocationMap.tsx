import { Text } from '../LocalizedText';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapCanvas from './MapCanvas';
import type { MapCanvasHandle } from './MapCanvas.types';
import { createGeoapifyMapHTML } from '../../services/geoapifyMap';
import { validCoordinates } from '../../services/discoveryFilters';
import type { Coordinates } from '../../types/gig';
import { colors, borderRadius } from '../../constants/theme';

export default function LocationMap({ point, onChange, disabled }: { point?: Coordinates; onChange?: (point: Coordinates) => void; disabled?: boolean }) {
  const { i18n } = useTranslation();
  return <LocationMapContent key={i18n.resolvedLanguage} point={point} onChange={onChange} disabled={disabled} />;
}
function LocationMapContent({ point, onChange, disabled }: { point?: Coordinates; onChange?: (point: Coordinates) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const apiKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY?.trim() ?? '';
  // Keep the document stable while dragging; send external coordinate changes through the bridge.
  const [html] = useState(() => createGeoapifyMapHTML([], apiKey, { point, editable: !!onChange }, { locations: t('Gig locations'), location: t('Gig location'), group: count => t('Gigs at this location: {{count}}', { count }) }));
  const canvas = useRef<MapCanvasHandle>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latestPoint = useRef(point);
  const lastSent = useRef<Coordinates | undefined>(point);
  useEffect(() => { latestPoint.current = point; }, [point]);
  const receive = useCallback((value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const event = value as { channel?: string; type?: string; point?: Coordinates };
    if (event.channel !== 'gigzy-map') return;
    if (event.type === 'ready') {
      setReady(true);
      lastSent.current = latestPoint.current;
      canvas.current?.send(latestPoint.current ? { type: 'set-location', ...latestPoint.current } : { type: 'clear-location' });
    } else if (event.type === 'loaded') setLoaded(true);
    else if (event.type === 'error') setFailed(true);
    else if (event.type === 'location' && !disabled && validCoordinates(event.point)) { lastSent.current = event.point; onChange?.(event.point); }
  }, [onChange, disabled]);
  useEffect(() => {
    if (!ready || (point?.latitude === lastSent.current?.latitude && point?.longitude === lastSent.current?.longitude)) return;
    lastSent.current = point;
    canvas.current?.send(point ? { type: 'set-location', ...point } : { type: 'clear-location' });
  }, [ready, point]);
  useEffect(() => {
    if (!apiKey || loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), 25000);
    return () => clearTimeout(timer);
  }, [apiKey, loaded, failed, attempt]);
  return <View style={styles.map} pointerEvents={disabled ? 'none' : 'auto'}>
    {!apiKey ? <Text style={styles.note}>{t("Map preview is unavailable. You can still enter coordinates below.")}</Text> : failed ? <View style={styles.overlay}>
      <Text style={styles.note}>{t("Unable to load the map. Your selected location is kept.")}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { setFailed(false); setLoaded(false); setReady(false); setAttempt(value => value + 1); }}><Text style={styles.link}>{t("Retry map")}</Text></TouchableOpacity>
    </View> : <>
      <MapCanvas key={attempt} ref={canvas} html={html} onEvent={receive} />
      {!loaded && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.note}>{t("Loading map...")}</Text></View>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  map: { height: 260, overflow: 'hidden', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
  note: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: 8 },
  loading: { position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 8, flexDirection: 'row', alignItems: 'center' },
  link: { color: colors.primary, padding: 12, fontWeight: '600' },
});
