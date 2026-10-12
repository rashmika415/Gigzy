import { translate as tr } from '../localization/i18n';
import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, TouchableOpacity, StyleSheet } from 'react-native';
import FormField from './FormField';
import { getCurrentCoordinates } from '../services/locationService';
import { addressForCoordinates, searchAddresses, type AddressResult } from '../services/geoapifyGeocoding';
import LocationMap from './maps/LocationMap';
import { validCoordinates } from '../services/discoveryFilters';
import { colors } from '../constants/theme';
import type { Coordinates } from '../types/gig';

export default function GigLocationField({ address, value, onChange, onAddressSelected, error, disabled }: {
  address: string; value?: Coordinates; onChange: (value: Coordinates | undefined) => void; onAddressSelected?: (result: AddressResult) => void; error?: string; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [latitude, setLatitude] = useState(value?.latitude.toString() ?? '');
  const [longitude, setLongitude] = useState(value?.longitude.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [manual, setManual] = useState(false);
  const [editing, setEditing] = useState(!validCoordinates(value));
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const latestCoordinates = useRef(value);
  useEffect(() => { latestCoordinates.current = value; }, [value]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    controller.current?.abort(); controller.current = null;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setResults([]); setFailure(''); setBusy(false);
      setLatitude(latestCoordinates.current?.latitude.toFixed(6) ?? '');
      setLongitude(latestCoordinates.current?.longitude.toFixed(6) ?? '');
    });
    return () => { cancelled = true; };
  }, [address]);
  const selectPoint = (point: Coordinates) => {
    setLatitude(point.latitude.toFixed(6)); setLongitude(point.longitude.toFixed(6));
    setFailure(''); setResults([]); onChange(point);
  };
  const resolvePoint = async (point: Coordinates, active: AbortController) => {
    selectPoint(point);
    try {
      const result = await addressForCoordinates(point, process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY ?? '', active.signal);
      if (mounted.current && controller.current === active && !active.signal.aborted) onAddressSelected?.(result);
    } catch {
      if (mounted.current && controller.current === active) setFailure('Pin selected. Enter or check the meeting address above; automatic address lookup is unavailable.');
    }
  };
  const selectMapPoint = async (point: Coordinates) => {
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    const timeout = setTimeout(() => active.abort(), 15000);
    try { await resolvePoint(point, active); }
    finally { clearTimeout(timeout); }
  };
  const change = (lat: string, lon: string) => {
    controller.current?.abort(); controller.current = null;
    setLatitude(lat); setLongitude(lon); setFailure('');
    const point = { latitude: Number(lat), longitude: Number(lon) };
    if (lat.trim() && lon.trim() && validCoordinates(point)) onChange(point);
    else if (value) onChange(undefined);
  };
  const locate = async (current: boolean) => {
    setBusy(true); setFailure('');
    setResults([]);
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    const timeout = setTimeout(() => active.abort(), 15000);
    try {
      if (current) {
        const point = await getCurrentCoordinates();
        if (mounted.current && controller.current === active && !active.signal.aborted) {
          await resolvePoint(point, active);
          if (mounted.current && controller.current === active) setEditing(false);
        }
      }
      else {
        const matches = await searchAddresses(address, process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY ?? '', active.signal);
        if (!mounted.current || controller.current !== active) return;
        if (!matches.length) setFailure('No matching address. Try a more specific address or choose a map point.');
        else setResults(matches);
      }
    }
    catch (reason) { if (mounted.current && controller.current === active) setFailure(active.signal.aborted ? 'Address search timed out. Please try again.' : reason instanceof Error ? reason.message : 'Unable to locate this gig.'); }
    finally { clearTimeout(timeout); if (mounted.current && controller.current === active) setBusy(false); }
  };
  if (validCoordinates(value) && !editing) return <View style={styles.container}>
    <Text style={styles.note}>{t('Selected meeting point')}</Text>
    {!!address && <Text>{address}</Text>}
    <LocationMap point={value} compact />
    <Text style={styles.note}>{t('Youth will see this map and pin on your gig.')}</Text>
    <TouchableOpacity accessibilityRole="button" disabled={disabled || busy} onPress={() => setEditing(true)}>
      <Text style={styles.link}>{t('Edit location')}</Text>
    </TouchableOpacity>
    {!!(failure || error) && <Text accessibilityRole="alert" style={styles.error}>{t(failure || error || '')}</Text>}
  </View>;
  return <View style={styles.container}>
    <Text style={styles.note}>{t("Search the address above, use your current location, or tap the map. Drag the pin to the exact meeting point.")}</Text>
    <View style={styles.row}>
      <TouchableOpacity accessibilityRole="button" disabled={disabled || busy || address.trim().length < 3} onPress={() => locate(false)}><Text style={styles.link}>{t("Search address")}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={disabled || busy} onPress={() => locate(true)}><Text style={styles.link}>{t("Use my location")}</Text></TouchableOpacity>
    </View>
    {busy && <ActivityIndicator accessibilityLabel={t("Finding location")} color={colors.primary} />}
    {results.map((result, index) => <TouchableOpacity key={`${result.label}-${index}`} accessibilityRole="button" disabled={disabled || busy}
      style={styles.result} onPress={() => { controller.current?.abort(); controller.current = null; selectPoint(result.coordinates); onAddressSelected?.(result); setEditing(false); }}><Text style={styles.link}>{result.label}</Text></TouchableOpacity>)}
    <LocationMap point={value} onChange={selectMapPoint} disabled={disabled || busy} />
    {validCoordinates(value) && <Text style={styles.note}>{value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}</Text>}
    <Text style={styles.note}>{validCoordinates(value) ? t("Meeting point selected. Workers will see this pin on the gig.") : t("Choose a meeting point to show workers where to go.")}</Text>
    {validCoordinates(value) && <Text style={styles.note}>{t("Editing the address keeps this pin. Search again or move the pin if the meeting point changes.")}</Text>}
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: manual }} onPress={() => setManual(previous => !previous)}><Text style={styles.link}>{manual ? t("Hide coordinates") : t("Enter coordinates manually")}</Text></TouchableOpacity>
    {manual && <>
      <FormField label={t("Latitude")} value={latitude} onChangeText={lat => change(lat, longitude)} editable={!disabled && !busy} placeholder={tr("e.g. 6.9271")} keyboardType="numbers-and-punctuation" />
      <FormField label={t("Longitude")} value={longitude} onChangeText={lon => change(latitude, lon)} editable={!disabled && !busy} placeholder={tr("e.g. 79.8612")} keyboardType="numbers-and-punctuation" />
    </>}
    {validCoordinates(value) && <TouchableOpacity accessibilityRole="button" disabled={disabled || busy} onPress={() => setEditing(false)}>
      <Text style={styles.link}>{t('Use this meeting point')}</Text>
    </TouchableOpacity>}
    {!!(failure || error) && <Text accessibilityRole="alert" style={styles.error}>{t(failure || error || '')}</Text>}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  result: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, paddingHorizontal: 12 },
  note: { color: colors.textMuted, lineHeight: 20 }, link: { color: colors.primary, paddingVertical: 12 }, error: { color: colors.error } });
