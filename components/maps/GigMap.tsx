import { Text } from '../LocalizedText';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapCanvas from './MapCanvas';
import type { MapCanvasHandle } from './MapCanvas.types';
import { createGeoapifyMapHTML } from '../../services/geoapifyMap';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, fonts, spacing } from '../../constants/theme';
import { getGigMapData } from '../../services/gigMapData';
import { getCurrentCoordinates } from '../../services/locationService';
import EmptyState from '../EmptyState';
import ErrorState from '../ErrorState';
import LoadingState from '../LoadingState';
import GigCard from '../GigCard';
import MapResults from './MapResults';
import type { GigMapProps } from './GigMap.types';

export default function GigMap(props: GigMapProps) {
  const { i18n } = useTranslation();
  // Filtering can unmount the map document. Reset readiness when pins reappear.
  return <GigMapContent key={i18n.resolvedLanguage + JSON.stringify(getGigMapData(props.gigs).pins.map(pin => [pin.key, pin.gigs.map(gig => [gig.id, gig.title])]))} {...props} />;
}

function GigMapContent(props: GigMapProps) {
  const { t } = useTranslation();
  const { pins } = useMemo(() => getGigMapData(props.gigs), [props.gigs]);
  const map = useRef<MapCanvasHandle>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = pins.find(pin => pin.key === selectedKey);
  const apiKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY?.trim() ?? '';
  const configured = !!apiKey;
  const html = useMemo(() => createGeoapifyMapHTML(pins, apiKey, undefined, { locations: t('Gig locations'), location: t('Gig location'), group: count => t('Gigs at this location: {{count}}', { count }) }), [pins, apiKey, t]);
  const fitPins = () => map.current?.send({ type: 'fit' });
  const { onGigPress } = props;
  const receive = useCallback((event: unknown) => {
    if (!event || typeof event !== 'object') return;
    const message = event as { channel?: string; type?: string; key?: string };
    if (message.channel !== 'gigzy-map') return;
    if (message.type === 'ready') setReady(true);
    else if (message.type === 'loaded') setLoaded(true);
    else if (message.type === 'error') setFailed(true);
    else if (message.type === 'pin') {
      const pin = pins.find(item => item.key === message.key);
      if (!pin) return;
      if (pin.gigs.length === 1) onGigPress(pin.gigs[0]);
      else setSelectedKey(pin.key);
    }
  }, [pins, onGigPress]);
  useEffect(() => {
    if (loaded || !configured || !pins.length || failed) return;
    const timer = setTimeout(() => setFailed(true), 25000);
    return () => clearTimeout(timer);
  }, [loaded, configured, pins.length, failed, attempt, html]);

  const locate = async () => {
    setLocating(true); setLocationError('');
    try {
      const coordinates = await getCurrentCoordinates();
      map.current?.send({ type: 'locate', ...coordinates });
    } catch (error) { setLocationError(error instanceof Error ? error.message : 'Your location is unavailable. You can still explore the gig pins.'); }
    finally { setLocating(false); }
  };

  let content;
  if (props.loading && !props.gigs.length) content = <LoadingState message={t("Finding gig locations...")} />;
  else if (props.error && !props.gigs.length) content = <ErrorState title={t("Unable to load gig locations")} message={t(props.error ?? "")} onRetry={props.onRefresh} />;
  else if (!pins.length) content = <EmptyState icon="map-outline" title={props.hasMore ? t("No pins in these results yet") : t("No gig locations to show")}
    description={t("Remote gigs and gigs without coordinates appear in the list. Try other filters or load more opportunities.")}
    actionLabel={t("View gig list")} onAction={props.onShowList} />;
  else if (!configured) content = <EmptyState icon="map-outline" title={t("Map unavailable")} description={t("You can still explore these opportunities in the list.")} actionLabel={t("View gig list")} onAction={props.onShowList} />;
  else if (failed) content = <ErrorState title={t("The map could not load")} message={t("Check your connection and try again, or switch to the list.")} onRetry={() => { setFailed(false); setReady(false); setLoaded(false); setAttempt(value => value + 1); }} />;
  else content = <View style={styles.mapContainer}>
    <MapCanvas key={attempt} ref={map} html={html} onEvent={receive} />
    <View style={styles.controls}>
      <TouchableOpacity style={styles.control} accessibilityRole="button" accessibilityLabel={t("Show all gig pins")} onPress={fitPins} disabled={!ready}><Ionicons name="scan-outline" size={22} color={colors.primary} /></TouchableOpacity>
      <TouchableOpacity style={styles.control} accessibilityRole="button" accessibilityLabel={t("Center map on my location")} onPress={locate} disabled={!ready || locating}><Ionicons name="locate-outline" size={22} color={colors.primary} /></TouchableOpacity>
    </View>
  </View>;

  return <View style={styles.container}>
    <MapResults {...props} />
    {!!locationError && <Text accessibilityRole="alert" style={styles.error}>{t(locationError ?? "")}</Text>}
    <View style={styles.body}>{content}</View>
    <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelectedKey(null)}>
      <SafeAreaView style={styles.container}>
        <View style={styles.modalHeader}><Text style={styles.title}>{t("Gigs at this location")}</Text><TouchableOpacity style={styles.control} accessibilityRole="button" accessibilityLabel={t("Close location gigs")} onPress={() => setSelectedKey(null)}><Ionicons name="close" size={23} color={colors.text} /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={styles.modalList}>{selected?.gigs.map(gig => <GigCard key={gig.id} gig={gig} showBookmark onPress={item => { setSelectedKey(null); props.onGigPress(item); }} />)}</ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, body: { flex: 1 },
  mapContainer: { flex: 1, minHeight: 160 },
  controls: { position: 'absolute', top: spacing.md, right: spacing.md, gap: spacing.sm },
  control: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  error: { color: colors.error, fontSize: 12, padding: spacing.sm },
  modalHeader: { padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  modalList: { padding: spacing.lg, gap: spacing.md },
});
