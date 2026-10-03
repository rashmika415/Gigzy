import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthScreen } from '../../components/auth/AuthUI';
import { authColors as palette, authStyles } from '../../constants/authTheme';
import { fonts } from '../../constants/theme';

const ROLES = [
  { key: 'youth', title: 'Find work', subtitle: 'Discover local gigs, earn on your schedule, and grow your skills.', icon: 'briefcase-outline' },
  { key: 'business', title: 'Hire talent', subtitle: 'Post a gig and connect with motivated people in your community.', icon: 'storefront-outline' },
] as const;
export default function RoleSelect() {
  return <AuthScreen title="How will you use Gigzy?" subtitle="Choose your path. We will take care of the next step." eyebrow="A PLACE FOR YOUR NEXT MOVE" compact>
    <View style={styles.roles}>
      {ROLES.map(role => <TouchableOpacity key={role.key} accessibilityRole="button" accessibilityLabel={role.title}
        onPress={() => router.push({ pathname: '/(auth)/register', params: { role: role.key } })} activeOpacity={0.8} style={styles.card}>
        <View style={styles.icon}><Ionicons name={role.icon} size={23} color={palette.primary} /></View>
        <View style={styles.copy}><Text style={styles.title}>{role.title}</Text><Text style={styles.subtitle}>{role.subtitle}</Text></View>
        <Ionicons name="arrow-forward" size={19} color={palette.primary} />
      </TouchableOpacity>)}
    </View>
    <View style={authStyles.footer}><Text style={authStyles.footerText}>Already have an account?</Text>
      <TouchableOpacity style={authStyles.footerLink} accessibilityRole="link" onPress={() => router.push('/(auth)/login')}><Text style={authStyles.link}>Sign in</Text></TouchableOpacity>
    </View>
  </AuthScreen>;
}
const styles = StyleSheet.create({
  roles: { gap: 16 }, card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 },
  title: { fontFamily: fonts.headingSemiBold, fontSize: 19, color: palette.text, marginBottom: 7 }, subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: palette.secondary },
});
