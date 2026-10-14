import { Text } from '../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { AuthScreen, authEntrance } from '../../components/auth/AuthUI';
import PressableScale from '../../components/PressableScale';
import { authColors as palette, authStyles } from '../../constants/authTheme';
import { borderRadius, spacing, typography } from '../../constants/theme';

const ROLES = [
  { key: 'youth', title: 'Find work', subtitle: 'Discover local gigs, earn on your schedule, and grow your skills.', icon: 'briefcase-outline',
    benefits: ['Gigs near you', 'Flexible hours', 'Build your profile'] },
  { key: 'business', title: 'Hire talent', subtitle: 'Post a gig and connect with motivated people in your community.', icon: 'storefront-outline',
    benefits: ['Post a gig in minutes', 'Review applicants', 'Rate and rehire'] },
] as const;

export default function RoleSelect() {
  const { t } = useTranslation();
  const choose = (role: string) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: '/(auth)/register', params: { role } });
  };
  return <AuthScreen title={t("How will you use Gigzy?")} subtitle={t("Pick the one that fits you best.")} photo>
    <View style={styles.roles}>
      {ROLES.map((role, index) => <Animated.View key={role.key} entering={authEntrance(3 + index)}>
        <PressableScale accessibilityRole="button" accessibilityLabel={`${t(role.title)}. ${t(role.subtitle)}`}
          onPress={() => choose(role.key)} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.icon}><Ionicons name={role.icon} size={24} color={palette.primary} /></View>
            <Text style={styles.title}>{t(role.title)}</Text>
            <View style={styles.arrow}><Ionicons name="arrow-forward" size={18} color={palette.primary} /></View>
          </View>
          <Text style={styles.subtitle}>{t(role.subtitle)}</Text>
          <View style={styles.benefits}>{role.benefits.map(benefit => <View key={benefit} style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={16} color={palette.primary} />
            <Text style={styles.benefitText}>{t(benefit)}</Text>
          </View>)}</View>
        </PressableScale>
      </Animated.View>)}
    </View>
    <View style={authStyles.footer}><Text style={authStyles.footerText}>{t("Already have an account?")}</Text>
      <Pressable style={({ pressed }) => [authStyles.footerLink, pressed && styles.pressed]} accessibilityRole="link" onPress={() => router.push('/(auth)/login')}><Text style={authStyles.link}>{t("Sign in")}</Text></Pressable>
    </View>
  </AuthScreen>;
}
const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  roles: { gap: spacing.md },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md + spacing.xs, gap: spacing.sm + spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  icon: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, flex: 1, color: palette.text },
  arrow: { width: 36, height: 36, borderRadius: borderRadius.full, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  subtitle: { ...typography.bodySmall, lineHeight: 20, color: palette.secondary },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.sm, paddingTop: spacing.sm + spacing.xs, borderTopWidth: 1, borderTopColor: palette.border },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  benefitText: { ...typography.caption, color: palette.text },
});
