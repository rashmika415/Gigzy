import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthBrand, AuthButton, AuthPhoto } from '../../components/auth/AuthUI';
import { authColors as palette } from '../../constants/authTheme';
import { fonts } from '../../constants/theme';

const FEATURES: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Local gigs', icon: 'location-outline' },
  { label: 'Flexible work', icon: 'time-outline' },
  { label: 'Build experience', icon: 'sparkles-outline' },
];
export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const picture = <View style={[styles.picture, wide && styles.widePicture]}>
    <AuthPhoto style={{ height: wide ? 510 : Math.min(310, Math.max(210, height * 0.31)), borderRadius: 26 }} />
    <View style={styles.photoNote}>
      <View style={styles.noteIcon}><Ionicons name="location-outline" size={18} color={palette.primary} /></View>
      <View><Text style={styles.noteTitle}>Opportunity starts nearby</Text><Text style={styles.noteSubtitle}>Your skills. Your community.</Text></View>
    </View>
  </View>;
  return <SafeAreaView style={styles.page}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.header}><AuthBrand />
        <TouchableOpacity accessibilityRole="link" onPress={() => router.push('/(auth)/login')} style={styles.headerLink}><Text style={styles.signIn}>Sign in</Text><Ionicons name="arrow-forward" size={16} color={palette.primary} /></TouchableOpacity>
      </View>
      <View style={[styles.hero, wide && styles.wideHero]}>
        {!wide && picture}
        <View style={[styles.copy, wide && styles.wideCopy]}>
          <View style={styles.eyebrowRow}><View style={styles.dot} /><Text style={styles.eyebrow}>LOCAL WORK. REAL OPPORTUNITY.</Text></View>
          <Text accessibilityRole="header" style={[styles.title, width < 360 && styles.smallTitle, wide && styles.wideTitle]}>
            Find your next gig,<Text style={styles.highlight}> close to home.</Text>
          </Text>
          <Text style={styles.subtitle}>Connect with local businesses. Put your skills to work. Build something for yourself.</Text>
          <View style={styles.features}>{FEATURES.map(feature => <View style={styles.feature} key={feature.label}>
            <Ionicons name={feature.icon} size={15} color={palette.primary} /><Text style={styles.featureText}>{feature.label}</Text>
          </View>)}</View>
          <View style={styles.actions}><AuthButton title="Get started" onPress={() => router.push('/(auth)/role-select')} />
            <Text style={styles.actionNote}>For people finding work and businesses hiring.</Text>
          </View>
        </View>
        {wide && picture}
      </View>
      <View style={styles.footer}><Text style={styles.footerText}>Good work starts with a connection.</Text><Text style={styles.footerBrand}>Made for your community.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background }, scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  header: { width: '100%', maxWidth: 1080, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, marginBottom: 10 },
  headerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }, signIn: { fontFamily: fonts.bodyMedium, fontSize: 14, color: palette.primary },
  hero: { width: '100%', maxWidth: 480, alignSelf: 'center', flex: 1, justifyContent: 'center', gap: 30 },
  wideHero: { maxWidth: 1080, flexDirection: 'row', alignItems: 'center', gap: 64, paddingVertical: 48 },
  picture: { width: '100%', paddingBottom: 16 }, widePicture: { flex: 1, width: undefined },
  photoNote: { position: 'absolute', bottom: 0, left: 16, right: 16, alignSelf: 'flex-start', backgroundColor: palette.surface, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#172B27', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3 },
  noteIcon: { backgroundColor: palette.mint, borderRadius: 12, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  noteTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: palette.text }, noteSubtitle: { fontFamily: fonts.body, fontSize: 11, color: palette.secondary, marginTop: 3 },
  copy: { width: '100%' }, wideCopy: { flex: 1, width: undefined }, eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary }, eyebrow: { fontFamily: fonts.bodyMedium, color: palette.primary, fontSize: 10, letterSpacing: 1.25 },
  title: { fontFamily: fonts.heading, fontSize: 37, lineHeight: 44, letterSpacing: -1.6, color: palette.text }, smallTitle: { fontSize: 32, lineHeight: 39 }, wideTitle: { fontSize: 56, lineHeight: 63, letterSpacing: -2.4 },
  highlight: { color: palette.primary }, subtitle: { fontFamily: fonts.body, color: palette.secondary, fontSize: 16, lineHeight: 25, marginTop: 16, maxWidth: 390 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, marginTop: 22 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 5 }, featureText: { fontFamily: fonts.bodyMedium, color: palette.secondary, fontSize: 11 },
  actions: { gap: 12, marginTop: 28, maxWidth: 400 }, actionNote: { fontFamily: fonts.body, fontSize: 12, color: palette.secondary, textAlign: 'center', lineHeight: 18 },
  footer: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingTop: 32, marginTop: 26, borderTopWidth: 1, borderTopColor: palette.border, alignItems: 'center', gap: 6 },
  footerText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: palette.text }, footerBrand: { fontFamily: fonts.body, fontSize: 11, color: palette.secondary },
});
