import { Text } from '../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AuthBrand, AuthButton, AuthLanguageButton, AuthPhoto, authEntrance } from '../../components/auth/AuthUI';
import { authColors as palette } from '../../constants/authTheme';
import { borderRadius, fonts, shadows, spacing, typography } from '../../constants/theme';

const FEATURES: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Local gigs', icon: 'location-outline' },
  { label: 'Flexible work', icon: 'time-outline' },
  { label: 'Build experience', icon: 'sparkles-outline' },
];
export default function Welcome() {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const picture = <Animated.View entering={authEntrance(0)} style={[styles.picture, wide && styles.widePicture]}>
    <AuthPhoto style={{ height: wide ? 510 : Math.min(310, Math.max(210, height * 0.31)), borderRadius: borderRadius.xl }} />
    <View style={styles.photoNote}>
      <View style={styles.noteIcon}><Ionicons name="location-outline" size={18} color={palette.primary} /></View>
      <View><Text style={styles.noteTitle}>{t("Opportunity starts nearby")}</Text><Text style={styles.noteSubtitle}>{t("Your skills. Your community.")}</Text></View>
    </View>
  </Animated.View>;
  return <SafeAreaView style={styles.page}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.header}><AuthBrand /><AuthLanguageButton /></View>
      <View style={[styles.hero, wide && styles.wideHero]}>
        {!wide && picture}
        <Animated.View entering={authEntrance(1)} style={[styles.copy, wide && styles.wideCopy]}>
          <View style={styles.eyebrowRow}><View style={styles.dot} /><Text style={styles.eyebrow}>{t("LOCAL WORK. REAL OPPORTUNITY.")}</Text></View>
          <Text accessibilityRole="header" style={[styles.title, width < 360 && styles.smallTitle, wide && styles.wideTitle]}>{t("Find your next gig,")}{' '}<Text style={styles.highlight}>{t("close to home.")}</Text>
          </Text>
          <Text style={styles.subtitle}>{t("Connect with local businesses. Put your skills to work. Build something for yourself.")}</Text>
          <View style={styles.features}>{FEATURES.map(feature => <View style={styles.feature} key={feature.label}>
            <Ionicons name={feature.icon} size={16} color={palette.primary} /><Text style={styles.featureText}>{t(feature.label)}</Text>
          </View>)}</View>
          <Animated.View entering={authEntrance(3)} style={styles.actions}>
            <AuthButton title={t("Get started")} onPress={() => router.push('/(auth)/role-select')} />
            <AuthButton title={t("I already have an account")} secondary arrow={false} onPress={() => router.push('/(auth)/login')} />
            <Text style={styles.actionNote}>{t("For people finding work and businesses hiring.")}</Text>
          </Animated.View>
        </Animated.View>
        {wide && picture}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background }, scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  header: { width: '100%', maxWidth: 1080, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, marginBottom: 10 },
  hero: { width: '100%', maxWidth: 480, alignSelf: 'center', flex: 1, justifyContent: 'center', gap: 30 },
  wideHero: { maxWidth: 1080, flexDirection: 'row', alignItems: 'center', gap: 64, paddingVertical: 48 },
  picture: { width: '100%', paddingBottom: 16 }, widePicture: { flex: 1, width: undefined },
  photoNote: { position: 'absolute', bottom: 0, left: spacing.md, right: spacing.md, alignSelf: 'flex-start', backgroundColor: palette.surface, borderRadius: borderRadius.md, padding: spacing.sm + spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, ...shadows.card },
  noteIcon: { backgroundColor: palette.mint, borderRadius: borderRadius.sm + 2, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  noteTitle: { ...typography.label, color: palette.text }, noteSubtitle: { ...typography.caption, fontFamily: fonts.body, color: palette.secondary, marginTop: 2 },
  copy: { width: '100%' }, wideCopy: { flex: 1, width: undefined }, eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm + spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary }, eyebrow: { ...typography.overline, color: palette.primary },
  title: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 41, letterSpacing: -0.6, color: palette.text }, smallTitle: { fontSize: 30, lineHeight: 37 }, wideTitle: { fontSize: 52, lineHeight: 60, letterSpacing: -1 },
  highlight: { color: palette.primary }, subtitle: { ...typography.body, fontSize: 16, lineHeight: 25, color: palette.secondary, marginTop: spacing.md, maxWidth: 390 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm + spacing.xs, borderRadius: borderRadius.full, backgroundColor: palette.mint },
  featureText: { ...typography.label, color: palette.primaryDark },
  actions: { gap: spacing.sm + spacing.xs, marginTop: spacing.xl, maxWidth: 400 }, actionNote: { ...typography.caption, fontFamily: fonts.body, lineHeight: 18, color: palette.secondary, textAlign: 'center', marginTop: spacing.xs },
});
