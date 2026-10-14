import { formatCalendarDate, formatCurrency, formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Modal, View, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import type { Application } from '../../types/application';
import { addGigToCalendar } from '../../services/calendarService';
import { useToast } from '../../context/ToastContext';
import { RatingModal } from '../reviews';
import { ApplicationStatusPill, getStatusTheme, toDate } from './ApplicationCard';

interface ApplicationDetailModalProps {
  visible: boolean;
  application: Application | null;
  onClose: () => void;
}

const STATUS_COPY: Record<Application['status'], string> = {
  pending: 'Your application is awaiting review by the business owner.',
  accepted: 'Great news! Your application was accepted for this gig.',
  completed: 'This gig and application have been marked as completed.',
  rejected: 'The business decided to go with another applicant.',
};

/** Keyed by application id so calendar/rating state never leaks between applications. */
export default function ApplicationDetailModal({ visible, application, onClose }: ApplicationDetailModalProps) {
  if (!visible || !application) return null;
  return <ApplicationDetail key={application.id} application={application} onClose={onClose} />;
}

function ApplicationDetail({ application, onClose }: { application: Application; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [calendarAdding, setCalendarAdding] = useState(false);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const statusTheme = getStatusTheme(application.status);
  const applied = toDate(application.createdAt);
  const isAccepted = application.status === 'accepted';
  const isCompleted = application.status === 'completed';
  const hasPay = application.gigPay !== undefined && application.gigPay !== null;
  const gigTitle = application.gigTitle || t('Gig');

  const handleMessageBusiness = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    router.push({ pathname: '/(app)/chat/[id]', params: { id: application.conversationId || `conv_${application.id}` } } as any);
  };

  const handleAddToCalendar = async () => {
    setCalendarAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const result = await addGigToCalendar({
      title: application.gigTitle || 'Gig',
      date: application.gigDate || new Date().toISOString().slice(0, 10),
      location: application.gigLocation,
      pay: application.gigPay,
      payType: application.gigPayType,
      counterpartName: application.businessName,
      counterpartRole: 'business',
      gigId: application.gigId,
      applicationId: application.id,
      description: `Accepted Gigzy gig with ${application.businessName || 'Business Owner'}`,
    });
    setCalendarAdding(false);
    if (result.success) {
      setCalendarAdded(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success(t('Added to calendar'), result.method === 'native'
        ? t('Added "{{value0}}" to your device calendar.', { value0: gigTitle })
        : t('Opened calendar for "{{value0}}".', { value0: gigTitle }));
    } else {
      toast.error(t('Could not add gig to calendar.'), result.error ? t(result.error) : undefined);
    }
  };

  const facts: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; highlight?: boolean }[] = [
    ...(hasPay ? [{ icon: 'wallet-outline' as const, label: 'Pay', highlight: true,
      value: `${formatCurrency(application.gigPay!)}${application.gigPayType === 'hourly' ? t('/hr') : t(' fixed')}` }] : []),
    ...(application.gigDate ? [{ icon: 'calendar-outline' as const, label: 'Date & time',
      value: `${formatCalendarDate(application.gigDate)}${application.gigTime ? ` · ${application.gigTime}` : ''}` }] : []),
    ...(application.gigLocation ? [{ icon: 'location-outline' as const, label: 'Location', value: application.gigLocation }] : []),
    ...(application.gigCategory ? [{ icon: 'grid-outline' as const, label: 'Category', value: t(application.gigCategory) }] : []),
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close application details')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.headerTitle}>{t('Application Details')}</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <ApplicationStatusPill status={application.status} />
            <Text style={styles.gigTitle}>{gigTitle}</Text>
            <View style={styles.metaItem}>
              <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.business}>{application.businessName || t('Business Owner')}</Text>
            </View>
          </View>

          {/* Status */}
          <View style={[styles.statusBanner, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}>
            <Ionicons name={statusTheme.icon} size={20} color={statusTheme.text} />
            <Text style={styles.statusDesc}>{t(STATUS_COPY[application.status] ?? STATUS_COPY.pending)}</Text>
          </View>

          {/* Next steps for hired workers */}
          {(isAccepted || isCompleted) && (
            <View style={styles.actions}>
              <Pressable onPress={handleMessageBusiness} accessibilityRole="button"
                style={({ pressed }) => [styles.button, styles.primaryBtn, pressed && styles.pressed]}>
                <Ionicons name="chatbubbles-outline" size={18} color={colors.primaryOnColor} />
                <Text style={styles.primaryBtnText}>{t('Message business')}</Text>
              </Pressable>
              {isAccepted && (
                <Pressable onPress={handleAddToCalendar} disabled={calendarAdding || calendarAdded} accessibilityRole="button"
                  accessibilityState={{ disabled: calendarAdding || calendarAdded, busy: calendarAdding }}
                  style={({ pressed }) => [styles.button, styles.secondaryBtn, calendarAdded && styles.addedBtn, pressed && styles.pressed]}>
                  {calendarAdding ? <ActivityIndicator size="small" color={colors.primary} /> : <>
                    <Ionicons name={calendarAdded ? 'checkmark-circle' : 'calendar-outline'} size={18} color={calendarAdded ? colors.success : colors.primary} />
                    <Text style={[styles.secondaryBtnText, calendarAdded && styles.addedText]}>
                      {calendarAdded ? t('Added to calendar') : t('Add Gig to Calendar')}
                    </Text>
                  </>}
                </Pressable>
              )}
              {isCompleted && !!application.businessId && (
                <Pressable onPress={() => setShowRatingModal(true)} accessibilityRole="button"
                  style={({ pressed }) => [styles.button, styles.secondaryBtn, pressed && styles.pressed]}>
                  <Ionicons name="star-outline" size={18} color={colors.star} />
                  <Text style={styles.secondaryBtnText}>{t('Rate this business')}</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Gig facts */}
          {facts.length > 0 && (
            <View style={styles.card}>
              {facts.map(fact => <View key={fact.label} style={styles.fact}>
                <View style={[styles.factIcon, fact.highlight && styles.factIconHighlight]}>
                  <Ionicons name={fact.icon} size={16} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.factLabel}>{t(fact.label)}</Text>
                  <Text style={[styles.factValue, fact.highlight && styles.factValueHighlight]}>{fact.value}</Text>
                </View>
              </View>)}
            </View>
          )}

          {/* Your application */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Your Application')}</Text>
            <Text style={styles.messageText}>{application.message || t('No message provided.')}</Text>
            <View style={styles.metaItem}>
              <Ionicons
                name={application.availabilityConfirmed ? 'checkmark-circle' : 'help-circle-outline'}
                size={16}
                color={application.availabilityConfirmed ? colors.success : colors.textMuted}
              />
              <Text style={styles.metaText}>
                {application.availabilityConfirmed
                  ? t('Confirmed available on the required date and time.')
                  : t('Availability not confirmed')}
              </Text>
            </View>
            {applied && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                <Text style={styles.metaText}>{t('Applied')} {localizedDate(applied, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              </View>
            )}
          </View>

          <Pressable onPress={() => { onClose(); router.push({ pathname: '/(app)/gig/[id]', params: { id: application.gigId } } as any); }}
            accessibilityRole="button" style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
            <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
            <Text style={styles.linkText}>{t('View gig')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </ScrollView>

        {isCompleted && !!application.businessId && (
          <RatingModal
            visible={showRatingModal}
            targetUserId={application.businessId}
            targetUserName={application.businessName || 'Business Owner'}
            targetRole="client"
            gigId={application.gigId}
            gigTitle={application.gigTitle}
            onClose={() => setShowRatingModal(false)}
            onSuccess={() => setShowRatingModal(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  pressed: { opacity: 0.8 },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { gap: spacing.sm, alignItems: 'flex-start' },
  gigTitle: { ...typography.display, color: colors.text },
  business: { ...typography.body, color: colors.textSecondary, flexShrink: 1 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1 },
  statusDesc: { ...typography.bodySmall, color: colors.text, flex: 1 },
  actions: { gap: spacing.sm },
  button: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.md, paddingHorizontal: spacing.md },
  primaryBtn: { backgroundColor: colors.primary },
  primaryBtnText: { ...typography.title, fontSize: 15, color: colors.primaryOnColor },
  secondaryBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  secondaryBtnText: { ...typography.title, fontSize: 15, color: colors.primary },
  addedBtn: { backgroundColor: colors.successLight, borderColor: colors.successBorder },
  addedText: { color: colors.success },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.surfaceBorder, padding: spacing.md, gap: spacing.sm + spacing.xs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  factIcon: { width: 36, height: 36, borderRadius: borderRadius.sm + 2, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  factIconHighlight: { backgroundColor: colors.primaryLight },
  factLabel: { ...typography.caption, color: colors.textSecondary },
  factValue: { ...typography.body, color: colors.text },
  factValueHighlight: { ...typography.title, color: colors.primary },
  sectionTitle: { ...typography.label, color: colors.text },
  messageText: { ...typography.body, color: colors.textSecondary },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  metaText: { ...typography.bodySmall, color: colors.textSecondary, flexShrink: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  linkText: { ...typography.label, color: colors.primary, flex: 1 },
});
