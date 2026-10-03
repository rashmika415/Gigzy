import { useState } from 'react';
import { Modal, ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormField from './FormField';
import Chip from './Chip';
import SegmentedControl from './SegmentedControl';
import { colors, spacing } from '../constants/theme';
import { validDate, validTime } from '../services/discoveryFilters';
import { getCurrentCoordinates } from '../services/locationService';
import type { GigFilterOptions } from '../types/gig';

export default function DiscoveryFilters({ visible, value, onApply, onClose }: {
  visible: boolean; value: GigFilterOptions; onApply: (options: GigFilterOptions) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [minPay, setMinPay] = useState(value.minPay?.toString() ?? '');
  const [maxPay, setMaxPay] = useState(value.maxPay?.toString() ?? '');
  const [radius, setRadius] = useState(value.radiusKm?.toString() ?? '');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const apply = () => {
    for (const amount of [minPay, maxPay, radius]) {
      if (amount && (!/^\d+(\.\d+)?$/.test(amount) || !Number.isFinite(Number(amount)))) { setError('Enter valid positive numbers for pay and distance.'); return; }
    }
    if (minPay && maxPay && Number(minPay) > Number(maxPay)) { setError('Minimum pay must not exceed maximum pay.'); return; }
    if (radius && Number(radius) <= 0) { setError('Distance must be greater than zero.'); return; }
    if (radius && !draft.origin) { setError('Use your location before applying a distance filter.'); return; }
    for (const date of [draft.dateFrom, draft.dateTo]) if (date && !validDate(date)) { setError('Use valid dates in YYYY-MM-DD format.'); return; }
    if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) { setError('Start date must not follow end date.'); return; }
    for (const time of [draft.timeFrom, draft.timeTo]) if (time && !validTime(time)) { setError('Use valid times in HH:MM format.'); return; }
    if (draft.timeFrom && draft.timeTo && draft.timeFrom > draft.timeTo) { setError('Start time must not follow end time.'); return; }
    onApply({ ...draft, minPay: minPay ? Number(minPay) : undefined, maxPay: maxPay ? Number(maxPay) : undefined,
      radiusKm: radius ? Number(radius) : undefined }); onClose();
  };
  const locate = async () => {
    setLocating(true); setError('');
    try { const origin = await getCurrentCoordinates(); setDraft(previous => ({ ...previous, origin })); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to get your location.'); }
    finally { setLocating(false); }
  };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.container}>
      <View style={styles.row}><Text style={styles.title}>Filter gigs</Text><TouchableOpacity onPress={onClose}><Text style={styles.link}>Cancel</Text></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Pay</Text>
        <SegmentedControl options={[{ key: 'all', label: 'Any rate' }, { key: 'fixed', label: 'Fixed' }, { key: 'hourly', label: 'Hourly' }]} selectedKey={draft.payType ?? 'all'} onSelect={key => setDraft({ ...draft, payType: key as GigFilterOptions['payType'] })} />
        <FormField label="Minimum pay" value={minPay} onChangeText={setMinPay} keyboardType="decimal-pad" />
        <FormField label="Maximum pay" value={maxPay} onChangeText={setMaxPay} keyboardType="decimal-pad" hint="Choose a rate type to compare similar pay amounts." />
        <Text style={styles.label}>Distance</Text>
        <TouchableOpacity onPress={locate} disabled={locating}><Text style={styles.link}>{locating ? 'Finding your location…' : draft.origin ? 'Update my location' : 'Use my location'}</Text></TouchableOpacity>
        {draft.origin && <Text style={styles.note}>Location ready. Distances are measured in a straight line.</Text>}
        <FormField label="Within (km)" value={radius} onChangeText={setRadius} keyboardType="decimal-pad" hint="Remote gigs are included. Gigs without coordinates are excluded when distance is set." />
        <Text style={styles.label}>Availability</Text>
        <FormField label="Available from" placeholder="YYYY-MM-DD" value={draft.dateFrom ?? ''} onChangeText={dateFrom => setDraft({ ...draft, dateFrom })} />
        <FormField label="Available through" placeholder="YYYY-MM-DD" value={draft.dateTo ?? ''} onChangeText={dateTo => setDraft({ ...draft, dateTo })} />
        <FormField label="Earliest start time" placeholder="HH:MM (24-hour)" value={draft.timeFrom ?? ''} onChangeText={timeFrom => setDraft({ ...draft, timeFrom })} />
        <FormField label="Latest start time" placeholder="HH:MM (24-hour)" value={draft.timeTo ?? ''} onChangeText={timeTo => setDraft({ ...draft, timeTo })} hint="Times use the gig's local time. Gigs without a start time are excluded when time filters are set." />
        <Chip label="Weekends only" variant={draft.weekendsOnly ? 'selected' : 'default'} onPress={() => setDraft({ ...draft, weekendsOnly: !draft.weekendsOnly })} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={apply} disabled={locating}><Text style={styles.buttonText}>Apply filters</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { setDraft({}); setMinPay(''); setMaxPay(''); setRadius(''); setError(''); }}><Text style={styles.link}>Reset filters</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md },
  row: { padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' }, label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  note: { color: colors.textMuted, lineHeight: 20 }, link: { color: colors.primary, fontWeight: '600', paddingVertical: 8 },
  error: { color: colors.error }, button: { backgroundColor: colors.primary, padding: 16, borderRadius: 16, alignItems: 'center' },
  buttonText: { color: colors.primaryOnColor, fontWeight: '700' },
});
