import { formatCurrency, formatDate as localizedDate } from '../../localization/format';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import Chip from '../Chip';
import { ApplicantAvatar, ApplicationStatusPill, toDate } from './ApplicantCard';
import useApplicantDecision from './useApplicantDecision';

interface ApplicantDetailModalProps {
  visible: boolean;
  application: Application | null;
  businessId: string;
  onClose: () => void;
  onStatusChanged?: (newStatus: 'accepted' | 'rejected') => void;
  onAccepted?: (app: Application) => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return <View style={styles.section}>
    <Text style={styles.sectionTitle}>{t(title)}</Text>
    {children}
  </View>;
}

export default function ApplicantDetailModal({ visible, application, businessId, onClose, onStatusChanged, onAccepted }: ApplicantDetailModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [calendarState, setCalendarState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [showRating, setShowRating] = useState(false);
  const { request, busyId, sheet } = useApplicantDecision(businessId, {
    onAccepted: app => {
      onStatusChanged?.('accepted');
      if (onAccepted) onAccepted(app);
      else { toast.success(tr('Application Accepted! 🎉')); onClose(); }
    },
    onRejected: () => { onStatusChanged?.('rejected'); onClose(); },
  });

  if (!application) return null;

  const applied = toDate(application.createdAt);
  const isPending = application.status === 'pending';
  const isHired = application.status === 'accepted' || application.status === 'completed';
  const busy = busyId === application.id;
  const name = application.youthName || t('Youth Freelancer');

  const openChat = () => {
    onClose();
    router.push({ pathname: '/(app)/chat/[id]', params: { id: application.conversationId || `conv_${application.id}` } } as any);
  };

  const addToCalendar = async () => {
    if (calendarState !== 'idle') return;
    setCalendarState('adding');
    try {
      const result = await addGigToCalendar({
        title: application.gigTitle || 'Gig',
        date: application.gigDate || new Date().toISOString().slice(0, 10),
        time: application.gigTime,
        location: application.gigLocation,
        pay: application.gigPay,
        payType: application.gigPayType,
        counterpartName: application.youthName,
        counterpartRole: 'freelancer',
        gigId: application.gigId,
        applicationId: application.id,
        description: `Accepted Gigzy gig with youth freelancer ${application.youthName || ''}`,
      });
      if (!result.success) throw new Error(result.error || 'Could not add gig to calendar.');
      setCalendarState('added');
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success(tr('Added to calendar'));
    } catch (err: any) {
      setCalendarState('idle');
      toast.error(tr('Could not add gig to calendar.'), err?.message ? tr(err.message) : undefined);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Close applicant details')}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.headerTitle}>{t('Applicant Details')}</Text>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profile}>
            <ApplicantAvatar application={application} size={64} />
            <View style={styles.profileCopy}>
              <Text style={styles.name}>{name}</Text>
              {applied && <Text style={styles.meta}>{t('Applied on {{date}}', { date: localizedDate(applied, { month: 'long', day: 'numeric', year: 'numeric' }) })}</Text>}
              {!!application.youthRatingAverage && application.youthRatingAverage > 0 && (
                <View style={styles.rating}>
                  <Ionicons name="star" size={14} color={colors.star} />
                  <Text style={styles.meta}>
                    {application.youthRatingAverage.toFixed(1)}{application.youthRatingCount ? t(' ({{value0}} reviews)', { value0: application.youthRatingCount }) : ''}
                  </Text>
                </View>
              )}
            </View>
            <ApplicationStatusPill status={application.status} />
          </View>

          <Section title="Message">
            <Text style={styles.body}>{application.message || t('No message provided.')}</Text>
          </Section>

          <Section title="Availability">
            <View style={styles.availability}>
              <Ionicons name={application.availabilityConfirmed ? 'checkmark-circle' : 'help-circle-outline'} size={20}
                color={application.availabilityConfirmed ? colors.success : colors.warning} />
              <Text style={styles.body}>
                {application.availabilityConfirmed
                  ? t('Confirmed available on the required date and time.')
                  : t('Has not confirmed availability yet. Ask in chat before hiring.')}
              </Text>
            </View>
          </Section>

          {!!application.youthSkills?.length && (
            <Section title="Skills">
              <View style={styles.skills}>{application.youthSkills.map(skill => <Chip key={skill} label={skill} size="sm" />)}</View>
            </Section>
          )}

          {!!application.youthBio && (
            <Section title="About">
              <Text style={styles.body}>{application.youthBio}</Text>
            </Section>
          )}

          <Section title="Applied for">
            <Text style={styles.gigTitle}>{application.gigTitle || t('Gig Title')}</Text>
            <View style={styles.gigMeta}>
              {!!application.gigLocation && <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.meta}>{application.gigLocation}</Text>
              </View>}
              {application.gigPay != null && <View style={styles.metaItem}>
                <Ionicons name="wallet-outline" size={15} color={colors.primary} />
                <Text style={[styles.meta, styles.pay]}>
                  {formatCurrency(application.gigPay)}{application.gigPayType === 'hourly' ? t('/hr') : t(' fixed')}
                </Text>
              </View>}
            </View>
          </Section>

          {application.status === 'rejected' && (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.meta}>{t('You rejected this application.')}</Text>
            </View>
          )}
        </ScrollView>

        {(isPending || isHired) && (
          <View style={styles.footer}>
            {isPending ? (busy ? <ActivityIndicator color={colors.primary} style={styles.footerBusy} /> : <View style={styles.footerRow}>
              <Pressable onPress={() => request(application, 'reject')} accessibilityRole="button"
                style={({ pressed }) => [styles.button, styles.rejectButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={18} color={colors.error} />
                <Text style={styles.rejectText}>{t('Reject')}</Text>
              </Pressable>
              <Pressable onPress={() => request(application, 'accept')} accessibilityRole="button"
                style={({ pressed }) => [styles.button, styles.primaryButton, styles.grow, pressed && styles.pressed]}>
                <Ionicons name="checkmark" size={18} color={colors.primaryOnColor} />
                <Text style={styles.primaryText}>{t('Accept & hire')}</Text>
              </Pressable>
            </View>) : <>
              <Pressable onPress={openChat} accessibilityRole="button"
                style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed]}>
                <Ionicons name="chatbubbles-outline" size={18} color={colors.primaryOnColor} />
                <Text style={styles.primaryText}>{t('Message Freelancer')}</Text>
              </Pressable>
              <View style={styles.footerRow}>
                <Pressable onPress={addToCalendar} disabled={calendarState !== 'idle'} accessibilityRole="button"
                  accessibilityState={{ busy: calendarState === 'adding', disabled: calendarState !== 'idle' }}
                  style={({ pressed }) => [styles.button, styles.secondaryButton, styles.grow, pressed && styles.pressed]}>
                  {calendarState === 'adding' ? <ActivityIndicator color={colors.primary} /> : <>
                    <Ionicons name={calendarState === 'added' ? 'checkmark-circle' : 'calendar-outline'} size={18}
                      color={calendarState === 'added' ? colors.success : colors.primary} />
                    <Text style={[styles.secondaryText, calendarState === 'added' && { color: colors.success }]}>
                      {calendarState === 'added' ? t('In calendar') : t('Add to Calendar')}
                    </Text>
                  </>}
                </Pressable>
                <Pressable onPress={() => setShowRating(true)} accessibilityRole="button"
                  style={({ pressed }) => [styles.button, styles.secondaryButton, styles.grow, pressed && styles.pressed]}>
                  <Ionicons name="star-outline" size={18} color={colors.star} />
                  <Text style={styles.secondaryText}>{t('Rate')}</Text>
                </Pressable>
              </View>
            </>}
          </View>
        )}

        {sheet}
        {application.youthId ? (
          <RatingModal
            visible={showRating}
            targetUserId={application.youthId}
            targetUserName={name}
            targetUserPhotoURL={application.youthPhotoURL}
            targetRole="freelancer"
            gigId={application.gigId}
            gigTitle={application.gigTitle}
            onClose={() => setShowRating(false)}
            onSuccess={() => { setShowRating(false); toast.success(tr('Review submitted successfully!')); }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  close: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  headerTitle: { ...typography.h3, color: colors.text },
  content: { padding: spacing.md, gap: spacing.sm + spacing.xs, paddingBottom: spacing.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  profileCopy: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.h3, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary, flexShrink: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  body: { ...typography.body, color: colors.text, flexShrink: 1 },
  availability: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  gigTitle: { ...typography.title, color: colors.text },
  gigMeta: { gap: spacing.xs + 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  pay: { color: colors.primary, fontFamily: typography.label.fontFamily },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surfaceElevated },
  footer: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerBusy: { minHeight: 48 },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md },
  grow: { flex: 1 },
  primaryButton: { backgroundColor: colors.primary },
  primaryText: { ...typography.title, fontSize: 15, color: colors.primaryOnColor },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  secondaryText: { ...typography.title, fontSize: 15, color: colors.primary },
  rejectButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.errorBorder },
  rejectText: { ...typography.title, fontSize: 15, color: colors.error },
});
