import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../../constants/theme';
import { subscribeToGig } from '../../../services/gigService';
import { getOrCreateChat } from '../../../services/chatService';
import { StatusPill, Chip, LoadingState, ErrorState } from '../../../components';
import { distanceKm, validCoordinates } from '../../../services/discoveryFilters';
import { getCurrentCoordinates } from '../../../services/locationService';
import type { Gig } from '../../../types/gig';
import { GIG_CATEGORIES } from '../../../types/gig';

/** Resolve category id or name to the category object */
function resolveCategory(raw: string) {
  const found = GIG_CATEGORIES.find(
    (c) => c.id === raw || c.name.toLowerCase() === raw.toLowerCase(),
  );
  return found ?? { id: raw, name: raw, icon: 'grid-outline' };
}

/** Human-readable relative date helper */
function formatPostedDate(ts: any): string {
  if (!ts) return '';
  const millis = ts?.toMillis ? ts.toMillis() : new Date(ts).getTime();
  const diff = Date.now() - millis;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(millis).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, userData } = useAuth();
  const role = userData?.role ?? 'freelancer';
  const [retry, setRetry] = useState(0);
  const [distance, setDistance] = useState<number>();
  const [locating, setLocating] = useState(false);

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingChat, setStartingChat] = useState(false);

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
    catch (failure) { Alert.alert('Location unavailable', failure instanceof Error ? failure.message : 'Try again.'); }
    finally { setLocating(false); }
  };

  const gigOwner = gig?.postedBy?.uid === user?.uid;
  const cat = gig ? resolveCategory(gig.category) : null;

  // ── Actions ──

  const handleShare = async () => {
    if (!gig) return;
    try {
      await Share.share({
        message: `Check out this gig: "${gig.title}" — $${gig.pay} ${gig.payType === 'hourly' ? '/hr' : 'fixed'}\n\nPosted on Gigzy`,
      });
    } catch {}
  };

  const handleContactBusiness = async () => {
    if (!user || !gig) return;
    if (gigOwner) {
      router.push('/(app)/(tabs)/my-gigs' as any);
      return;
    }

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setStartingChat(true);

    try {
      const currentParticipant = {
        uid: user.uid,
        fullName: userData?.fullName || user.displayName || 'Freelancer',
        photoURL: userData?.photoURL || '',
        role: (userData?.role as any) || 'freelancer',
        email: user.email || '',
      };

      const businessParticipant = {
        uid: gig.postedBy.uid,
        fullName: gig.postedBy.fullName || 'Business Owner',
        photoURL: '',
        role: 'client' as const,
        email: gig.postedBy.email || '',
      };

      const chat = await getOrCreateChat(currentParticipant, businessParticipant, gig);
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: chat.id },
      } as any);
    } catch (err: any) {
      Alert.alert('Chat Error', err.message || 'Failed to start conversation.');
    } finally {
      setStartingChat(false);
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <LoadingState message="Loading gig details…" size="large" />
      </SafeAreaView>
    );
  }

  if (error || !gig) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.padH}>
          <ErrorState
            title={gig === null && !error ? 'Gig not found' : 'Failed to load gig'}
            message={error || 'This gig may have been removed or does not exist.'}
            onRetry={error ? () => setRetry(value => value + 1) : undefined}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Header onBack={() => router.back()} onShare={handleShare} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Section ── */}
        <View style={styles.heroSection}>
          {/* Category & Status row */}
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Ionicons name={cat!.icon as any} size={14} color={colors.primary} />
              <Text style={styles.categoryText}>{cat!.name}</Text>
            </View>
            <StatusPill status={gig.status} />
          </View>

          {/* Title */}
          <Text style={styles.gigTitle}>{gig.title}</Text>

          {/* Posted by & time */}
          <View style={styles.postedRow}>
            <View style={styles.posterAvatar}>
              <Text style={styles.posterAvatarText}>
                {(gig.postedBy.fullName?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={styles.posterInfo}>
              <Text style={styles.posterName}>{gig.postedBy.fullName}</Text>
              <Text style={styles.postedTime}>
                Posted {formatPostedDate(gig.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Pay & Key Details Card ── */}
        <View style={styles.detailsCard}>
          {/* Pay highlight */}
          <View style={styles.paySection}>
            <View>
              <Text style={styles.payLabel}>COMPENSATION</Text>
              <View style={styles.payRow}>
                <Text style={styles.payAmount}>${gig.pay.toLocaleString()}</Text>
                <Text style={styles.payType}>
                  {gig.payType === 'hourly' ? ' / hour' : ' Fixed Price'}
                </Text>
              </View>
            </View>
            <View style={styles.payIconCircle}>
              <Ionicons name="wallet" size={22} color={colors.primary} />
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {gig.locationType !== 'remote' && (validCoordinates(gig.coordinates) ?
            <TouchableOpacity onPress={showDistance} disabled={locating}><Text style={styles.categoryText}>
              {locating ? 'Finding your location?' : distance !== undefined ? `${distance.toFixed(1)} km away (straight-line distance)` : 'Show distance from me'}
            </Text></TouchableOpacity> : <Text style={styles.postedTime}>Distance unavailable for this gig.</Text>)}
          {/* Specs Grid */}
          <View style={styles.specsGrid}>
            <SpecItem
              icon="calendar-outline"
              label="Deadline"
              value={`${gig.date || 'Flexible'}${gig.time ? ` at ${gig.time}` : ''}`}
            />
            <SpecItem
              icon={gig.locationType === 'remote' ? 'globe-outline' : 'location-outline'}
              label={`Location (${gig.locationType})`}
              value={gig.location || 'Remote'}
            />
            <SpecItem
              icon="people-outline"
              label="Applicants"
              value={`${gig.applicantsCount || 0} applied`}
            />
            <SpecItem
              icon="eye-outline"
              label="Views"
              value={`${gig.viewsCount || 0} views`}
            />
          </View>
        </View>

        {/* ── Description Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            {'  '}Job Description
          </Text>
          <Text style={styles.descriptionText}>{gig.description}</Text>
        </View>

        {/* ── Skills Section ── */}
        {gig.skills && gig.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="flash-outline" size={16} color={colors.primary} />
              {'  '}Required Skills
            </Text>
            <View style={styles.skillsWrap}>
              {gig.skills.map((skill, i) => (
                <Chip key={i} label={skill} icon="checkmark-circle-outline" />
              ))}
            </View>
          </View>
        )}

        {/* ── Posted By Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="business-outline" size={16} color={colors.primary} />
            {'  '}Posted By
          </Text>
          <View style={styles.posterCard}>
            <View style={styles.posterCardAvatar}>
              <Text style={styles.posterCardAvatarText}>
                {(gig.postedBy.fullName?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={styles.posterCardInfo}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/profile/[id]', params: { id: gig.postedBy.uid } })}>
                <Text style={styles.posterCardName}>{gig.postedBy.fullName}</Text>
                <Text style={styles.categoryText}>View business profile</Text>
              </TouchableOpacity>
              <Text style={styles.posterCardEmail}>{gig.postedBy.email}</Text>
            </View>
            {!gigOwner && role === 'freelancer' && (
              <TouchableOpacity
                style={styles.posterChatBtn}
                onPress={handleContactBusiness}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primaryOnColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Gig ID footer ── */}
        <View style={styles.gigIdRow}>
          <Ionicons name="finger-print-outline" size={13} color={colors.textMuted} />
          <Text style={styles.gigIdText}>ID: {gig.id}</Text>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      {!gigOwner && role === 'freelancer' && gig.status === 'open' && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomPayPreview}>
            <Text style={styles.bottomPayLabel}>Pay</Text>
            <Text style={styles.bottomPayValue}>
              ${gig.pay}{gig.payType === 'hourly' ? '/hr' : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.contactBtn}
            onPress={handleContactBusiness}
            activeOpacity={0.85}
            disabled={startingChat}
          >
            {startingChat ? (
              <ActivityIndicator size="small" color={colors.primaryOnColor} />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryOnColor} />
                <Text style={styles.contactBtnText}>Contact Business</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {gigOwner && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => router.push('/(app)/(tabs)/my-gigs' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primaryOnColor} />
            <Text style={styles.contactBtnText}>Manage This Gig</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ──

function Header({ onBack, onShare }: { onBack: () => void; onShare?: () => void }) {
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

      <Text style={styles.headerTitle}>Gig Details</Text>

      {onShare ? (
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={onShare}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 38 }} />
      )}
    </View>
  );
}

function SpecItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.specItem}>
      <View style={styles.specIconCircle}>
        <Ionicons name={icon as any} size={16} color={colors.primary} />
      </View>
      <View style={styles.specTextWrap}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
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
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.primary,
  },
  gigTitle: {
    fontSize: 24,
    fontWeight: '800',
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
    fontWeight: '700',
    color: colors.primary,
  },
  posterInfo: {
    gap: 1,
  },
  posterName: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  payType: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  specValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.primary,
  },
  posterCardInfo: {
    flex: 1,
    gap: 2,
  },
  posterCardName: {
    fontSize: 15,
    fontWeight: '700',
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
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomPayValue: {
    fontSize: 20,
    fontWeight: '800',
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
    fontWeight: '800',
    color: colors.primaryOnColor,
  },
  manageBtn: {
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
});
