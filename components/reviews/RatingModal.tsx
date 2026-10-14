import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Text, TextInput } from '../LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  submitReview,
  canReviewUser,
  REVIEW_LOCKED_MESSAGE,
} from '../../services/reviewService';
import {
  YOUTH_REVIEW_TAGS,
  BUSINESS_REVIEW_TAGS,
} from '../../types/review';

export interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
  targetUserPhotoURL?: string;
  targetRole: 'freelancer' | 'client';
  gigId?: string;
  gigTitle?: string;
  onSuccess?: (reviewId: string) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Outstanding! 🎉',
};

export default function RatingModal({
  visible,
  onClose,
  targetUserId,
  targetUserName,
  targetUserPhotoURL,
  targetRole,
  gigId,
  gigTitle,
  onSuccess,
}: RatingModalProps) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const toast = useToast();

  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  // null = checking, true = accepted application exists, false = locked
  // The result is keyed to who is rating whom, so switching target shows "checking" again.
  const eligibilityKey = `${user?.uid}|${targetUserId}|${gigId ?? ''}`;
  const [eligibility, setEligibility] = useState<{ key: string; ok: boolean } | null>(null);
  const eligible = eligibility?.key === eligibilityKey ? eligibility.ok : null;

  useEffect(() => {
    if (!visible || !user?.uid || !targetUserId) return;
    let cancelled = false;
    canReviewUser(user.uid, targetUserId, gigId)
      .then((ok) => { if (!cancelled) setEligibility({ key: eligibilityKey, ok }); })
      .catch(() => { if (!cancelled) setEligibility({ key: eligibilityKey, ok: false }); });
    return () => { cancelled = true; };
  }, [visible, user?.uid, targetUserId, gigId, eligibilityKey]);

  if (!visible) return null;
  const locked = eligible === false;
  const checking = eligible === null;

  const isRatingYouth = targetRole === 'freelancer';
  const availableTags = isRatingYouth ? YOUTH_REVIEW_TAGS : BUSINESS_REVIEW_TAGS;

  const handleStarPress = (starIndex: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setRating(starIndex);
    setErrorMessage('');
  };

  const handleTagToggle = (tag: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleResetAndClose = () => {
    setRating(5);
    setSelectedTags([]);
    setComment('');
    setErrorMessage('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!user) {
      setErrorMessage(t('You must be signed in to submit a rating.'));
      return;
    }

    if (user.uid === targetUserId) {
      setErrorMessage(t('You cannot rate yourself.'));
      return;
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length < 5) {
      setErrorMessage(t('Please write a review with at least 5 characters.'));
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      const authorRole = (userData?.role as 'freelancer' | 'client') || (isRatingYouth ? 'client' : 'freelancer');
      const authorName = userData?.fullName || user.displayName || (authorRole === 'client' ? 'Business Client' : 'Youth Freelancer');
      const authorPhotoURL = userData?.photoURL || user.photoURL || '';

      const reviewId = await submitReview({
        targetUserId,
        targetRole,
        authorId: user.uid,
        authorName,
        authorPhotoURL,
        authorRole,
        rating,
        comment: trimmedComment,
        tags: selectedTags,
        gigId,
        gigTitle,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      toast.success(
        t('Review Submitted! ⭐'),
        t('Thank you for rating {{name}}. Your feedback helps keep the Gigzy community trusted and safe.', {
          name: targetUserName,
        })
      );

      handleResetAndClose();
      if (onSuccess) onSuccess(reviewId);
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to submit review. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const initial = (targetUserName?.[0] || 'U').toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleResetAndClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialogContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.modalTitle}>
                {isRatingYouth ? t('Rate Youth Freelancer') : t('Rate Business Client')}
              </Text>
              <Text style={styles.modalSubtitle}>
                {t('Share your honest experience and feedback')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleResetAndClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t('Close')}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {locked ? (
              <View style={styles.errorBox}>
                <Ionicons name="lock-closed" size={16} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{t(REVIEW_LOCKED_MESSAGE)}</Text>
              </View>
            ) : null}

            {/* Target User Info Banner */}
            <View style={styles.targetUserBanner}>
              {targetUserPhotoURL ? (
                <Image source={{ uri: targetUserPhotoURL }} style={styles.targetAvatar} />
              ) : (
                <View style={styles.targetAvatarFallback}>
                  <Text style={styles.targetAvatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.targetUserInfo}>
                <Text style={styles.targetUserName} numberOfLines={1}>
                  {targetUserName}
                </Text>
                <View style={styles.targetRoleRow}>
                  <View
                    style={[
                      styles.roleDot,
                      isRatingYouth ? styles.roleDotYouth : styles.roleDotBusiness,
                    ]}
                  />
                  <Text style={styles.targetRoleText}>
                    {isRatingYouth ? t('Youth Freelancer') : t('Business Client')}
                  </Text>
                </View>
                {gigTitle ? (
                  <View style={styles.gigTagRow}>
                    <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                    <Text style={styles.gigTagText} numberOfLines={1}>
                      {gigTitle}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Star Rating Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.ratingHeaderRow}>
                <Text style={styles.sectionHeading}>{t('Overall Rating')}</Text>
                <View style={styles.ratingScorePill}>
                  <Ionicons name="star" size={13} color={colors.star} />
                  <Text style={styles.ratingScoreNumber}>{rating}.0</Text>
                  <Text style={styles.ratingScoreDivider}>•</Text>
                  <Text style={styles.ratingScoreDescriptor}>
                    {RATING_LABELS[rating] ? t(RATING_LABELS[rating]) : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.starsCard}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((starNum) => {
                    const isSelected = starNum <= rating;
                    return (
                      <TouchableOpacity
                        key={starNum}
                        onPress={() => handleStarPress(starNum)}
                        activeOpacity={0.7}
                        style={[
                          styles.starTouch,
                          starNum === rating && styles.starTouchCurrent,
                        ]}
                        accessibilityLabel={`${starNum} stars`}
                      >
                        <Ionicons
                          name={isSelected ? 'star' : 'star-outline'}
                          size={38}
                          color={isSelected ? colors.star : colors.surfaceBorder}
                        />
                        <Text style={[styles.starNumLabel, isSelected && styles.starNumLabelActive]}>
                          {starNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.tapToRateHint}>{t('Tap a star to set rating')}</Text>
              </View>
            </View>

            {/* Quick Feedback Tags */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>
                {isRatingYouth ? t('Freelancer Highlights') : t('Client Highlights')}
              </Text>
              <Text style={styles.sectionSubtext}>
                {t('Select all quick tags that apply')}
              </Text>
              <View style={styles.tagsWrap}>
                {availableTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, active && styles.tagChipActive]}
                      onPress={() => handleTagToggle(tag)}
                      activeOpacity={0.8}
                    >
                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={colors.primary}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Written Review */}
            <View style={styles.sectionContainer}>
              <View style={styles.reviewLabelRow}>
                <Text style={styles.sectionHeading}>{t('Written Review')}</Text>
                <Text style={styles.charCount}>{comment.length} / 1000</Text>
              </View>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={(text) => {
                  setComment(text);
                  if (errorMessage) setErrorMessage('');
                }}
                maxLength={1000}
                placeholder={
                  isRatingYouth
                    ? t('Describe punctuality, quality of work, and communication...')
                    : t('Describe working conditions, promptness of payment, and client support...')
                }
                placeholderTextColor={colors.textMuted}
                textAlignVertical="top"
              />
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleResetAndClose}
                activeOpacity={0.8}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, (submitting || locked || checking) && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={submitting || locked || checking}
              >
                {submitting || checking ? (
                  <ActivityIndicator size="small" color={colors.primaryOnColor} />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color={colors.primaryOnColor} style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>{t('Submit Review')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 99999,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl || 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.25,
        shadowRadius: 28,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    marginBottom: spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  targetUserBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md || 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  targetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  targetAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryOnColor,
  },
  targetUserInfo: {
    flex: 1,
  },
  targetUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  targetRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleDotYouth: {
    backgroundColor: colors.primary,
  },
  roleDotBusiness: {
    backgroundColor: colors.accent,
  },
  targetRoleText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  gigTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  gigTagText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  sectionContainer: {
    marginBottom: spacing.md,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginBottom: spacing.xs + 2,
  },
  ratingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  ratingScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  ratingScoreNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.warning,
  },
  ratingScoreDivider: {
    fontSize: 10,
    color: colors.warning,
  },
  ratingScoreDescriptor: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.warning,
  },
  starsCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg || 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  starTouch: {
    alignItems: 'center',
    padding: 6,
    borderRadius: borderRadius.md,
  },
  starTouchCurrent: {
    backgroundColor: colors.warningLight,
  },
  starNumLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  starNumLabelActive: {
    color: colors.warning,
    fontWeight: '700',
  },
  tapToRateHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  tagChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tagChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  reviewLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  textArea: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md || 12,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 88,
    marginTop: spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md || 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md || 12,
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryOnColor,
  },
});
