import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../../../constants/theme';

export default function BusinessAlerts() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Alerts</Text>
      <View style={styles.emptyState}>
        <MaterialIcons name="notifications-none" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No alerts yet</Text>
        <Text style={styles.emptyText}>
          We&apos;ll let you know when someone applies to one of your gigs, or when a gig is about to expire.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
