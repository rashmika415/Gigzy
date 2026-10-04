import { Text } from './LocalizedText';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, fonts, spacing } from '../constants/theme';

type BannerKind = 'youth' | 'business';
const photos = {
  youth: require('../assets/images/app/creative-work.png'),
  business: require('../assets/images/app/local-business.png'),
};

export function AppPhoto({ kind }: { kind: BannerKind }) {
  const [photoWidth, setPhotoWidth] = useState(0);
  return <Image source={photos[kind]} onLayout={event => setPhotoWidth(event.nativeEvent.layout.width)} style={[styles.photo, { height: photoWidth ? photoWidth / 1.5 : 190 }]} resizeMode="cover" accessible={false} />;
}

export default function AppBanner({ kind, title, description, action, onPress, compact = false }: {
  kind: BannerKind;
  title: string;
  description: string;
  action?: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const wide = useWindowDimensions().width >= 900 && !compact;
  return (
    <View style={[styles.card, compact && styles.compact, wide && styles.wide]}>
      {compact ? <Image source={photos[kind]} style={styles.thumbnail} resizeMode="cover" accessible={false} /> : <View style={wide && styles.widePhoto}><AppPhoto kind={kind} /></View>}
      <View style={[styles.content, compact && styles.compactContent, wide && styles.wideContent]}>
        <Text style={[styles.title, compact && styles.compactTitle]}>{t(title)}</Text>
        <Text style={styles.description}>{description}</Text>
        {action && onPress && <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.action} activeOpacity={0.8}>
          <Text style={styles.actionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primaryOnColor} />
        </TouchableOpacity>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.surfaceBorder, overflow: 'hidden', marginBottom: spacing.lg },
  photo: { width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: borderRadius.lg },
  content: { padding: spacing.md, gap: spacing.sm },
  title: { fontFamily: fonts.heading, fontSize: 23, lineHeight: 30, color: colors.text },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  action: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.md },
  actionText: { fontFamily: fonts.bodyMedium, color: colors.primaryOnColor, fontSize: 14 },
  compact: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
  thumbnail: { width: 76, height: 94, borderRadius: borderRadius.md },
  compactContent: { flex: 1, minWidth: 0, padding: spacing.sm },
  compactTitle: { fontSize: 17, lineHeight: 23 },
  wide: { flexDirection: 'row', alignItems: 'center' },
  widePhoto: { width: '44%' },
  wideContent: { flex: 1, padding: spacing.lg },
});
