import { formatCalendarDate, formatCurrency, formatRelativeDate } from '../../../localization/format';
import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../../localization/i18n';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../../components/LocalizedText';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { borderRadius, colors, spacing, typography } from '../../../constants/theme';
import { subscribeToGig } from '../../../services/gigService';
import { getOrCreateChat } from '../../../services/chatService';
import { Chip, ErrorState, LoadingState, StatusPill } from '../../../components';
import BookmarkButton from '../../../components/BookmarkButton';
import GigMeetingPoint from '../../../components/GigMeetingPoint';
import GigApplicationAction from '../../../components/applications/GigApplicationAction';
import { ApplicantListModal } from '../../../components/applications';
import { RatingModal } from '../../../components/reviews';
import { ReportModal } from '../../../components/reports';
import type { ReportReason } from '../../../types/report';
import { distanceKm, validCoordinates } from '../../../services/discoveryFilters';
import { getCurrentCoordinates } from '../../../services/locationService';
import type { Gig } from '../../../types/gig';
import { GIG_CATEGORIES } from '../../../types/gig';
import { useToast } from '../../../context/ToastContext';

/** Resolve category id or name to the category object */
function resolveCategory(raw: string) {
  const found = GIG_CATEGORIES.find(c => c.id === raw || c.name.toLowerCase() === raw.toLowerCase());
  return found ?? { id: raw, name: raw, icon: 'grid-outline' };
}

function formatPostedDate(ts: any): string {
  if (!ts) return '';
  const millis = ts?.toMillis ? ts.toMillis() : new Date(ts).getTime();
  return formatRelativeDate(new Date(millis));
}

const LOCATION_LABEL: Record<string, string> = { remote: 'Remote', 'on-site': 'On-site', hybrid: 'Hybrid' };

export default function GigDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, userData } = useAuth();
  const toast = useToast();
  const role = userData?.role ?? 'freelancer';
  const [retry, setRetry] = useState(0);
  const [distance, setDistance] = useState<number>();
  const [locating, setLocating] = useState(false);

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  const [showApplicantsModal, setShowApplicantsModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportModalConfig, setReportModalConfig] = useState<{
    targetType: 'user' | 'gig' | 'no-show';
    defaultReason?: ReportReason;
    targetUserId?: string;
    targetUserName?: string;
  }>({ targetType: 'gig' });

  const handleOpenReportGig = () => {
    setReportModalConfig({
      targetType: 'gig',
      targetUserId: typeof gig?.postedBy === 'object' ? gig?.postedBy?.uid : gig?.postedBy,
      targetUserName: typeof gig?.postedBy === 'object' ? gig?.postedBy?.fullName : undefined,
    });
    setShowReportModal(true);
  };

  const handleOpenNoShowReport = () => {
    const targetUid = gigOwner
      ? (gig?.assignedYouthId || '')
      : (typeof gig?.postedBy === 'object' ? gig?.postedBy?.uid : gig?.postedBy || '');
    const targetName = gigOwner
      ? (gig?.assignedYouthName || tr("Youth Freelancer"))
      : (typeof gig?.postedBy === 'object' ? gig?.postedBy?.fullName : tr("Business Owner"));
    setReportModalConfig({
      targetType: 'no-show',
      defaultReason: 'no-show',
      targetUserId: targetUid,
      targetUserName: targetName,
    });
    setShowReportModal(true);
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (!id) { setError('No gig was selected.'); setLoading(false); return; }
      setLoading(true); setError(''); setDistance(undefined);
      unsubscribe = subscribeToGig(id, result => { setGig(result); setLoading(false); setError(''); }, failure => {
        setError(failure.message); setLoading(false);
      });
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [id, retry]);

  const showDistance = async () => {
    if (!validCoordinates(gig?.coordinates)) return;
    setLocating(true);
    try { setDistance(distanceKm(await getCurrentCoordinates(), gig.coordinates)); }
    catch (failure) { toast.error(tr('Location unavailable'), failure instanceof Error ? failure.message : tr('Try again.')); }
    finally { setLocating(false); }
  };

  const gigOwner = !!gig && gig.postedBy?.uid === user?.uid;
  const isWorker = role === 'freelancer' && !gigOwner;
  const isHiredWorker = !!gig && !!user && gig.assignedYouthId === user.uid;
  // Workers can ask questions while a gig is open; the hired worker can keep talking afterwards.
  const canMessage = isWorker && !!gig && (gig.status === 'open' || isHiredWorker);
  const canRate = !!gig && gig.status === 'completed' && (gigOwner ? !!gig.assignedYouthId : isHiredWorker);
  const cat = gig ? resolveCategory(gig.category) : null;

  const handleShare = async () => {
    if (!gig) return;
    try {
      await Share.share({
        message: tr('Check out {{title}} on Gigzy: {{pay}} {{rate}}', { title: gig.title, pay: formatCurrency(gig.pay), rate: gig.payType === 'hourly' ? tr('/hr') : tr(' Fixed Price').trim() }),
      });
    } catch {}
  };

  const handleEditGig = () => {
    if (!gig) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/(app)/post-gig', params: { editGigId: gig.id } } as any);
  };

  const handleContactBusiness = async () => {
    if (startingChat || !user || !gig || !canMessage) return;
    const businessUid = gig.postedBy?.uid || (gig as any).businessId || (gig as any).clientId || '';
    if (!businessUid) { toast.error(tr('Chat Error'), tr('Unable to identify the gig creator.')); return; }
    setStartingChat(true);
    try {
      const chat = await getOrCreateChat(
        { uid: user.uid, fullName: userData?.fullName || user.displayName || 'Freelancer', photoURL: userData?.photoURL || '', role: (userData?.role as any) || 'freelancer', email: user.email || '' },
        { uid: businessUid, fullName: gig.postedBy?.fullName || (gig as any).businessName || 'Business Owner', photoURL: '', role: 'client', email: gig.postedBy?.email || '' },
        gig,
      );
      router.push({ pathname: '/(app)/chat/[id]', params: { id: chat.id } } as any);
    } catch (err: any) {
      toast.error(tr('Failed to start conversation.'), err?.message);
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.container}>
      <Header onBack={() => router.back()} />
      <LoadingState message={tr('Loading gig details…')} size="large" />
    </SafeAreaView>;
  }

  if (error || !gig || gig.moderationRemoved) {
    const missingId = !id;
    return <SafeAreaView style={styles.container}>
      <Header onBack={() => router.back()} />
      <View style={styles.padH}>
        <ErrorState
          title={gig?.moderationRemoved ? tr('Gig removed by a moderator') : (gig === null && !error) || missingId ? tr('Gig not found') : tr('Failed to load gig')}
          message={gig?.moderationRemoved ? tr('This gig is no longer available. Existing applications remain in your application history.') : error && !missingId ? error : tr('This gig may have been removed or does not exist.')}
          onRetry={error && !missingId ? () => setRetry(value => value + 1) : undefined}
        />
      </View>
    </SafeAreaView>;
  }

  const rating = (gig.postedBy as any)?.ratingAverage;
  const ratingCount = (gig.postedBy as any)?.ratingCount;
  const when = gig.date
    ? gig.time ? tr('{{date}} at {{time}}', { date: formatCalendarDate(gig.date), time: gig.time }) : formatCalendarDate(gig.date)
    : tr('Flexible');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header onBack={() => router.back()} onShare={handleShare} />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Title block ── */}
        <View style={styles.hero}>
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Header
        onBack={() => router.back()}
        onShare={handleShare}
        onEdit={gigOwner ? handleEditGig : undefined}
        onReport={!gigOwner ? handleOpenReportGig : undefined}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Section ── */}
        <View style={styles.heroSection}>
          {/* Category & Status row */}
          <View style={styles.badgeRow}>
            <Chip label={t(cat!.name)} icon={cat!.icon as any} size="sm" />
            <StatusPill status={gig.status} />
          </View>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.gigTitle}>{gig.title}</Text>
            {role === 'freelancer' && <BookmarkButton gigId={gig.id} title={gig.title} />}
          </View>
          <Text style={styles.posted}>{t('Posted {{date}}', { date: formatPostedDate(gig.createdAt) })}</Text>
        </View>

        {/* ── Key facts ── */}
        <View style={styles.card}>
          <Fact icon="wallet-outline" label="Pay" highlight
            value={`${formatCurrency(gig.pay)}${gig.payType === 'hourly' ? t('/hr') : ` · ${t('Fixed price')}`}`} />
          <Fact icon="calendar-outline" label="Date & time" value={when} />
          <Fact icon={gig.locationType === 'remote' ? 'globe-outline' : 'location-outline'}
            label={LOCATION_LABEL[gig.locationType] ?? 'Location'} value={gig.location || t('Remote')}>
            {gig.locationType !== 'remote' && (validCoordinates(gig.coordinates)
              ? <Pressable onPress={showDistance} disabled={locating} hitSlop={8} accessibilityRole="button" style={styles.inlineLink}>
                {locating && <ActivityIndicator size="small" color={colors.primary} />}
                <Text style={styles.linkText}>
                  {locating ? t('Finding your location…') : distance !== undefined ? t('{{value0}} km away (straight-line distance)', { value0: distance.toFixed(1) }) : t('Show distance from me')}
                </Text>
              </Pressable>
              : <Text style={styles.factHint}>{t('Distance unavailable for this gig.')}</Text>)}
          </Fact>
          <Fact icon="people-outline" label="Applicants" value={String(gig.applicantsCount || 0)} last />
        </View>

        <GigMeetingPoint gig={gig} />

        {/* ── Description ── */}
        <Section icon="document-text-outline" title="Job Description">
          <Text style={styles.body}>{gig.description}</Text>
        </Section>

        {gig.skills?.length > 0 && (
          <Section icon="flash-outline" title="Required Skills">
            <View style={styles.skillsWrap}>
              {gig.skills.map(skill => <Chip key={skill} label={skill} icon="checkmark-circle-outline" />)}
            </View>
          </Section>
        )}

        {/* ── Business ── */}
        <Section icon="business-outline" title="Posted By">
          <View style={styles.posterCard}>
            <Pressable onPress={() => router.push({ pathname: '/(app)/profile/[id]', params: { id: gig.postedBy.uid } })}
              accessibilityRole="button" accessibilityLabel={t('View business profile')}
              style={({ pressed }) => [styles.posterMain, pressed && styles.pressed]}>
              <View style={styles.posterAvatar}>
                <Text style={styles.posterAvatarText}>{(gig.postedBy.fullName?.[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={styles.posterInfo}>
                <Text style={styles.posterName} numberOfLines={1}>{gig.postedBy.fullName}</Text>
                {typeof rating === 'number' && rating > 0
                  ? <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={colors.star} />
                    <Text style={styles.factHint}>
                      {rating.toFixed(1)}{ratingCount ? ` · ${t('{{count}} reviews', { count: ratingCount })}` : ''}
                    </Text>
                  </View>
                  : <Text style={styles.linkText}>{t('View business profile')}</Text>}
              </View>
            </Pressable>
            {canMessage && (
              <Pressable onPress={handleContactBusiness} disabled={startingChat} accessibilityRole="button" accessibilityLabel={t('Message business')}
                style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}>
                {startingChat ? <ActivityIndicator color={colors.primaryOnColor} /> : <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primaryOnColor} />}
              </Pressable>
            )}
          </View>
          {canRate && !gigOwner && (
            <Pressable onPress={() => setShowRatingModal(true)} accessibilityRole="button"
              style={({ pressed }) => [styles.rateButton, pressed && styles.pressed]}>
              <Ionicons name="star-outline" size={18} color={colors.star} />
              <Text style={styles.rateText}>{t('Rate this business')}</Text>
            </Pressable>
          )}
        </Section>
      </ScrollView>

      {/* ── Sticky action bar ── */}
      {!gigOwner && role !== 'client' && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <View style={styles.bottomPay}>
            <Text style={styles.bottomPayLabel}>{t('Pay')}</Text>
            <Text style={styles.bottomPayValue} numberOfLines={1}>
              {formatCurrency(gig.pay)}{gig.payType === 'hourly' ? <Text style={styles.bottomPayType}>{t('/hr')}</Text> : null}
            </Text>
          </View>
          <GigApplicationAction gig={gig} />
        </SafeAreaView>
      )}

      {gigOwner && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <Pressable onPress={() => setShowApplicantsModal(true)} accessibilityRole="button"
            style={({ pressed }) => [styles.barButton, styles.barPrimary, pressed && styles.pressed]}>
            <Ionicons name="people-outline" size={18} color={colors.primaryOnColor} />
            <Text style={styles.barPrimaryText}>{t('Applicants ({{count}})', { count: gig.applicantsCount || 0 })}</Text>
          </Pressable>
          {canRate && (
            <Pressable onPress={() => setShowRatingModal(true)} accessibilityRole="button" accessibilityLabel={t('Rate Freelancer')}
              style={({ pressed }) => [styles.barIcon, pressed && styles.pressed]}>
              <Ionicons name="star-outline" size={20} color={colors.star} />
            </Pressable>

          {Boolean(gig.assignedYouthId === user?.uid && (gig.status === 'in-progress' || gig.status === 'completed')) && (
            <>
              <TouchableOpacity
                style={styles.rateFreelancerBtn}
                onPress={() => setShowRatingModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="star" size={16} color={colors.star} />
                <Text style={styles.rateFreelancerBtnText}>{tr("Rate Client")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportNoShowBtn}
                onPress={handleOpenNoShowReport}
                activeOpacity={0.85}
              >
                <Ionicons name="flag-outline" size={15} color={colors.error} />
                <Text style={styles.reportNoShowBtnText}>{tr("No-Show")}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {gigOwner && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.applicantsBtn}
            onPress={() => setShowApplicantsModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={17} color={colors.primaryOnColor} />
            <Text style={styles.applicantsBtnText}>
              {tr("Applicants")} ({gig.applicantsCount || 0})
            </Text>
          </TouchableOpacity>

          {Boolean(gig.assignedYouthId && (gig.status === 'in-progress' || gig.status === 'completed')) && (
            <>
              <TouchableOpacity
                style={styles.rateFreelancerBtn}
                onPress={() => setShowRatingModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="star" size={16} color={colors.star} />
                <Text style={styles.rateFreelancerBtnText}>{tr("Rate Freelancer")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportNoShowBtn}
                onPress={handleOpenNoShowReport}
                activeOpacity={0.85}
              >
                <Ionicons name="flag-outline" size={15} color={colors.error} />
                <Text style={styles.reportNoShowBtnText}>{tr("No-Show")}</Text>
              </TouchableOpacity>
            </>
          )}
          <Pressable onPress={handleEditGig} accessibilityRole="button"
            style={({ pressed }) => [styles.barButton, styles.barSecondary, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.barSecondaryText}>{t('Edit')}</Text>
          </Pressable>
        </SafeAreaView>
      )}

      {showApplicantsModal && (
        <ApplicantListModal visible gigId={gig.id} gigTitle={gig.title} businessId={user?.uid || ''}
          gigDate={gig.date} gigTime={gig.time} gigLocation={gig.location} gigPay={gig.pay} gigPayType={gig.payType}
          onClose={() => setShowApplicantsModal(false)} />
      )}

      {showRatingModal && (
        <RatingModal
          visible
          targetUserId={gigOwner ? (gig.assignedYouthId || '') : (gig.postedBy?.uid || '')}
          targetUserName={gigOwner ? (gig.assignedYouthName || tr('Youth Freelancer')) : (gig.postedBy?.fullName || tr('Business Owner'))}
          targetUserName={gigOwner ? (gig.assignedYouthName || tr("Youth Freelancer")) : (gig.postedBy?.fullName || tr("Business Owner"))}
          targetUserPhotoURL={gigOwner ? gig.assignedYouthPhotoURL : undefined}
          targetRole={gigOwner ? 'freelancer' : 'client'}
          gigId={gig.id}
          gigTitle={gig.title}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => { setShowRatingModal(false); toast.success(tr('Review submitted successfully!')); }}
        />
      )}

      {gig && showReportModal && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetType={reportModalConfig.targetType}
          targetId={reportModalConfig.targetType === 'no-show' ? `${gig.id}_${reportModalConfig.targetUserId || ''}` : gig.id}
          targetGigId={gig.id}
          targetGigTitle={gig.title}
          targetUserId={reportModalConfig.targetUserId}
          targetUserName={reportModalConfig.targetUserName}
          defaultReason={reportModalConfig.defaultReason}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ──

function Header({ onBack, onShare }: { onBack: () => void; onShare?: () => void }) {
  const { t } = useTranslation();
  return <View style={styles.header}>
    <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('Go back')}
      style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
    <Text accessibilityRole="header" style={styles.headerTitle}>{t('Gig Details')}</Text>
    {onShare
      ? <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel={t('Share')}
        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
        <Ionicons name="share-outline" size={20} color={colors.primary} />
      </Pressable>
      : <View style={styles.headerBtn} />}
  </View>;
function Header({ onBack, onShare, onEdit, onReport }: { onBack: () => void; onShare?: () => void; onEdit?: () => void; onReport?: () => void }) {
  useTranslation();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={onBack}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>{tr("Gig Details")}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {onEdit && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onEdit}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onReport && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onReport}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={tr("Report")}
          >
            <Ionicons name="flag-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        )}
        {onShare ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onShare}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="share-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : !onEdit && !onReport ? (
          <View style={{ width: 38 }} />
        ) : null}
      </View>
    </View>
  );
}

function Section({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text accessibilityRole="header" style={styles.sectionTitle}>{t(title)}</Text>
    </View>
    {children}
  </View>;
}

function Fact({ icon, label, value, highlight = false, last = false, children }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; highlight?: boolean; last?: boolean; children?: ReactNode;
}) {
  const { t } = useTranslation();
  return <View style={[styles.fact, !last && styles.factDivider]}>
    <View style={[styles.factIcon, highlight && styles.factIconHighlight]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={styles.factCopy}>
      <Text style={styles.factLabel}>{t(label)}</Text>
      <Text style={[styles.factValue, highlight && styles.factValueHighlight]}>{value}</Text>
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  padH: { paddingHorizontal: spacing.md },
  pressed: { opacity: 0.75 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerBtn: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, color: colors.text },

  hero: { gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  gigTitle: { ...typography.display, flex: 1, color: colors.text },
  posted: { ...typography.bodySmall, color: colors.textSecondary },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.surfaceBorder, paddingHorizontal: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + spacing.xs, paddingVertical: spacing.sm + spacing.xs },
  factDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceBorder },
  factIcon: { width: 36, height: 36, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  factIconHighlight: { backgroundColor: colors.primaryLight },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  factLabel: { ...typography.caption, fontFamily: typography.bodySmall.fontFamily, color: colors.textSecondary },
  factValue: { ...typography.body, color: colors.text },
  factValueHighlight: { ...typography.h3, color: colors.primaryDark },
  factHint: { ...typography.bodySmall, color: colors.textSecondary },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 32 },
  linkText: { ...typography.label, color: colors.primary },

  section: { gap: spacing.sm + spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text },
  body: { ...typography.body, lineHeight: 24, color: colors.textSecondary },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  posterCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.sm + spacing.xs, borderRadius: borderRadius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  posterMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  posterAvatar: { width: 48, height: 48, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  posterAvatarText: { ...typography.h3, color: colors.primary },
  posterInfo: { flex: 1, minWidth: 0, gap: 2 },
  posterName: { ...typography.title, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chatButton: { width: 48, height: 48, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  rateButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  rateText: { ...typography.title, fontSize: 15, color: colors.text },

  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm + spacing.xs, paddingBottom: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  bottomPay: { minWidth: 96, maxWidth: 140 },
  bottomPayLabel: { ...typography.caption, fontFamily: typography.bodySmall.fontFamily, color: colors.textSecondary },
  bottomPayValue: { ...typography.title, color: colors.text },
  bottomPayType: { ...typography.caption, color: colors.textSecondary },
  barButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md },
  barPrimary: { flex: 1, backgroundColor: colors.primary },
  barPrimaryText: { ...typography.title, fontSize: 15, color: colors.primaryOnColor },
  barSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  barSecondaryText: { ...typography.title, fontSize: 15, color: colors.primary },
  barIcon: { width: 48, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  padH: { paddingHorizontal: spacing.lg },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    letterSpacing: -0.2,
  },

  // Hero
  heroSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  gigTitle: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  postedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  posterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterAvatarText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  posterInfo: {
    gap: 1,
  },
  posterName: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  postedTime: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // Details Card
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  paySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  payAmount: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  payType: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
  },
  payIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceElevated,
    marginVertical: spacing.md,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 8,
    paddingVertical: 6,
  },
  specIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specTextWrap: {
    flex: 1,
    gap: 1,
  },
  specLabel: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  specValue: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Poster card
  posterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: 12,
  },
  posterCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterCardAvatarText: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  posterCardInfo: {
    flex: 1,
    gap: 2,
  },
  posterCardName: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  posterCardEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  posterChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Gig ID
  gigIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    opacity: 0.5,
  },
  gigIdText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 28,
    gap: spacing.md,
  },
  bottomPayPreview: {
    gap: 1,
  },
  bottomPayLabel: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomPayValue: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.primary,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  contactBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primaryOnColor,
  },
  applicantsBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  applicantsBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primaryOnColor,
  },
  updateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    gap: 6,
  },
  updateBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  manageBtn: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    gap: 6,
  },
  manageBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  rateFreelancerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
  },
  rateFreelancerBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.warning,
  },
  reportNoShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
  },
  reportNoShowBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.error,
  },
});
