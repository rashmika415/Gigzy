import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, TouchableOpacity, StyleSheet } from 'react-native';
import FormField from './FormField';
import { getCurrentCoordinates } from '../services/locationService';
import { searchAddresses, type AddressResult } from '../services/geoapifyGeocoding';
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
  const change = (lat: string, lon: string) => {
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
      if (current) { const point = await getCurrentCoordinates(); if (mounted.current && controller.current === active) selectPoint(point); }
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
  return <View style={styles.container}>
    <Text style={styles.note}>{t("Search the address above, use your current location, or tap the map. Drag the pin to the exact meeting point.")}</Text>
    <View style={styles.row}>
      <TouchableOpacity accessibilityRole="button" disabled={disabled || busy || address.trim().length < 3} onPress={() => locate(false)}><Text style={styles.link}>{t("Search address")}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={disabled || busy} onPress={() => locate(true)}><Text style={styles.link}>{t("Use my location")}</Text></TouchableOpacity>
    </View>
    {busy && <ActivityIndicator accessibilityLabel={t("Finding location")} color={colors.primary} />}
    {results.map((result, index) => <TouchableOpacity key={`${result.label}-${index}`} accessibilityRole="button" disabled={disabled || busy}
      style={styles.result} onPress={() => { selectPoint(result.coordinates); onAddressSelected?.(result); }}><Text style={styles.link}>{result.label}</Text></TouchableOpacity>)}
    <LocationMap point={value} onChange={selectPoint} disabled={disabled || busy} />
    <Text style={styles.note}>{validCoordinates(value) ? t("Meeting point selected. Workers will see this pin on the gig.") : t("Choose a meeting point to show workers where to go.")}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: manual }} onPress={() => setManual(previous => !previous)}><Text style={styles.link}>{manual ? t("Hide coordinates") : t("Enter coordinates manually")}</Text></TouchableOpacity>
    {manual && <>
      <FormField label={t("Latitude")} value={latitude} onChangeText={lat => change(lat, longitude)} editable={!disabled && !busy} placeholder="e.g. 6.9271" keyboardType="numbers-and-punctuation" />
      <FormField label={t("Longitude")} value={longitude} onChangeText={lon => change(latitude, lon)} editable={!disabled && !busy} placeholder="e.g. 79.8612" keyboardType="numbers-and-punctuation" />
    </>}
    {!!(failure || error) && <Text accessibilityRole="alert" style={styles.error}>{t(failure || error || '')}</Text>}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  result: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, paddingHorizontal: 12 },
  note: { color: colors.textMuted, lineHeight: 20 }, link: { color: colors.primary, paddingVertical: 12 }, error: { color: colors.error } });
