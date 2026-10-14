import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from './LocalizedText';
import { borderRadius, colors, fonts, spacing } from '../constants/theme';
import { formatDate, formatNumber } from '../localization/format';
import type { ProfileReview } from '../types/profile';

export function ReviewSummary({ average, count, loading, error }: { average: number; count: number; loading: boolean; error: string }) {
  const { t } = useTranslation();
  if (loading) return <ActivityIndicator color={colors.primary} />;
  if (error) return <Text style={styles.muted}>{t('Ratings unavailable')}</Text>;
  return <View style={styles.summary}><Ionicons name={count ? 'star' : 'star-outline'} size={16} color={count ? colors.star : colors.textMuted} /><Text style={styles.text}>{count ? formatNumber(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : t('No ratings yet')}</Text><Text style={styles.muted}>· {t('Reviews: {{count}}', { count })}</Text></View>;
}

function reviewDate(value: unknown) {
  if (!value) return '';
  const timestamp = value as { toDate?: () => Date; seconds?: number };
  const date = timestamp.toDate ? timestamp.toDate() : typeof timestamp.seconds === 'number' ? new Date(timestamp.seconds * 1000) : new Date(value as string);
  return formatDate(date);
}

export function ReviewHistory({ reviews, loading, error }: { reviews: ProfileReview[]; loading: boolean; error: string }) {
  const { t } = useTranslation();
  return <View style={styles.card}>
    <Text style={styles.title}>{t('Reviews')}</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text accessibilityRole="alert" style={styles.muted}>{t('Could not load reviews.')}</Text> : !reviews.length ? <Text style={styles.muted}>{t('No reviews yet.')}</Text> : reviews.map(review => <View key={review.id} style={styles.review}>
      <View style={styles.head}><TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(app)/profile/[id]', params: { id: review.reviewerId || review.authorId } })}><Text style={styles.name}>{review.authorName || t('User')}</Text></TouchableOpacity><Text style={styles.stars}>{'\u2605'.repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}</Text></View>
      <Text style={styles.muted}>{[review.reviewerRole === 'client' ? t('Business') : review.reviewerRole ? t('Freelancer') : '', reviewDate(review.createdAt)].filter(Boolean).join(' \u00b7 ')}</Text>
      {!!review.comment && <Text style={styles.text}>{review.comment}</Text>}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16, marginBottom: spacing.sm },
  review: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, gap: 5 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: { color: colors.primary, fontFamily: fonts.bodyBold },
  stars: { color: colors.star }, text: { color: colors.text, lineHeight: 21 }, muted: { color: colors.textMuted, fontSize: 13 },
});
