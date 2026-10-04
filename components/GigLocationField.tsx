import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FormField from './FormField';
import { coordinatesForAddress, getCurrentCoordinates } from '../services/locationService';
import { validCoordinates } from '../services/discoveryFilters';
import { colors } from '../constants/theme';
import type { Coordinates } from '../types/gig';

export default function GigLocationField({ address, value, onChange, error, disabled }: {
  address: string; value?: Coordinates; onChange: (value: Coordinates | undefined) => void; error?: string; disabled?: boolean;
}) {
  const [latitude, setLatitude] = useState(value?.latitude.toString() ?? '');
  const [longitude, setLongitude] = useState(value?.longitude.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const change = (lat: string, lon: string) => {
    setLatitude(lat); setLongitude(lon); setFailure('');
    const point = { latitude: Number(lat), longitude: Number(lon) };
    if (lat.trim() && lon.trim() && validCoordinates(point)) onChange(point);
    else if (value) onChange(undefined);
  };
  const locate = async (current: boolean) => {
    setBusy(true); setFailure('');
    try { const point = await (current ? getCurrentCoordinates() : coordinatesForAddress(address)); setLatitude(point.latitude.toString()); setLongitude(point.longitude.toString()); onChange(point); }
    catch (reason) { setFailure(reason instanceof Error ? reason.message : 'Unable to locate this gig.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.container}>
    <Text style={styles.note}>Set the gig location so youth can find it by distance. Check the coordinates after address lookup.</Text>
    <View style={styles.row}>
      <TouchableOpacity disabled={disabled || busy} onPress={() => locate(false)}><Text style={styles.link}>Find address</Text></TouchableOpacity>
      <TouchableOpacity disabled={disabled || busy} onPress={() => locate(true)}><Text style={styles.link}>Use current location</Text></TouchableOpacity>
    </View>
    {busy && <Text style={styles.note}>Finding location…</Text>}
    <FormField label="Latitude" value={latitude} onChangeText={lat => change(lat, longitude)} editable={!disabled && !busy} placeholder="e.g. 6.9271" keyboardType="numbers-and-punctuation" />
    <FormField label="Longitude" value={longitude} onChangeText={lon => change(latitude, lon)} editable={!disabled && !busy} placeholder="e.g. 79.8612" keyboardType="numbers-and-punctuation" />
    {!!(failure || error) && <Text accessibilityRole="alert" style={styles.error}>{failure || error}</Text>}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  note: { color: colors.textMuted, lineHeight: 20 }, link: { color: colors.primary, paddingVertical: 10 }, error: { color: colors.error } });
