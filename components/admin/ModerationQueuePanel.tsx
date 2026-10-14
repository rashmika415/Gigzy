import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../LocalizedText';
import { colors, fonts, borderRadius, spacing } from '../../constants/theme';
import { fetchReportsQueue } from '../../services/reportService';
import { fetchAdminReviews, deleteReviewByAdmin } from '../../services/reviewService';
import type { Report, ReportStatus, ReportTargetType } from '../../types/report';
import type { Review } from '../../types/review';
import ResolveReportModal from './ResolveReportModal';
import { formatDate } from '../../localization/format';

export default function ModerationQueuePanel() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'reports' | 'reviews'>('reports');

  // Reports Queue State
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<any>();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<ReportTargetType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Reviews State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsErrorMsg, setReviewsErrorMsg] = useState('');
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsCursor, setReviewsCursor] = useState<any>();
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [reviewsSearch, setReviewsSearch] = useState('');
  const [deletingReview, setDeletingReview] = useState<Review | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccessNotice, setDeleteSuccessNotice] = useState('');
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  const mounted = useRef(true);

  const loadReports = async (isRefresh = false) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetchReportsQueue(
        statusFilter === 'all' ? undefined : statusFilter,
        typeFilter === 'all' ? undefined : typeFilter,
        isRefresh ? undefined : cursor
      );
      if (!mounted.current) return;
      if (isRefresh) {
        setReports(res.reports);
      } else {
        setReports((prev) => [...prev, ...res.reports]);
      }
      setCursor(res.cursor);
      setHasMore(res.hasMore);
    } catch (err: any) {
      if (mounted.current) {
        setErrorMsg(err.message || t('Failed to load moderation reports.'));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const loadReviews = async (isRefresh = false) => {
    setReviewsLoading(true);
    setReviewsErrorMsg('');
    try {
      const res = await fetchAdminReviews(
        ratingFilter === 'all' ? undefined : ratingFilter,
        isRefresh ? undefined : reviewsCursor
      );
      if (!mounted.current) return;
      if (isRefresh) {
        setReviews(res.reviews);
      } else {
        setReviews((prev) => [...prev, ...res.reviews]);
      }
      setReviewsCursor(res.cursor);
      setReviewsHasMore(res.hasMore);
    } catch (err: any) {
      if (mounted.current) {
        setReviewsErrorMsg(err.message || t('Failed to load reviews.'));
      }
    } finally {
      if (mounted.current) setReviewsLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    setCursor(undefined);
    setReports([]);
    loadReports(true);
    return () => {
      mounted.current = false;
    };
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      setReviewsCursor(undefined);
      setReviews([]);
      loadReviews(true);
    }
  }, [activeTab, ratingFilter]);

  const handleRefresh = () => {
    if (activeTab === 'reports') {
      setCursor(undefined);
      loadReports(true);
    } else {
      setReviewsCursor(undefined);
      loadReviews(true);
    }
  };

  const handleLoadMoreReports = () => {
    if (!loading && hasMore) {
      loadReports(false);
    }
  };

  const handleLoadMoreReviews = () => {
    if (!reviewsLoading && reviewsHasMore) {
      loadReviews(false);
    }
  };

  const confirmDeleteReview = async () => {
    if (!deletingReview) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteReviewByAdmin(deletingReview.id, deletingReview.targetUserId);
      if (!mounted.current) return;
      setReviews((prev) => prev.filter((r) => r.id !== deletingReview.id));
      setDeleteSuccessNotice(t('Review deleted successfully.'));
      setDeletingReview(null);
      setTimeout(() => {
        if (mounted.current) setDeleteSuccessNotice('');
      }, 3500);
    } catch (err: any) {
      if (mounted.current) {
        setDeleteError(err.message || t('Failed to delete review.'));
      }
    } finally {
      if (mounted.current) setIsDeleting(false);
    }
  };

  const visibleReports = reports.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const words = [
      r.id,
      r.reporterName,
      r.targetUserName,
      r.targetGigTitle,
      r.targetId,
      r.reason,
      r.details,
      r.note,
    ];
    return words.some((w) => w?.toLowerCase().includes(q));
  });

  const visibleReviews = reviews.filter((rev) => {
    if (!reviewsSearch.trim()) return true;
    const q = reviewsSearch.trim().toLowerCase();
    const words = [
      rev.id,
      rev.authorName,
      rev.authorId,
      rev.targetUserId,
      rev.gigTitle,
      rev.gigId,
      rev.comment,
      ...(rev.tags || []),
    ];
    return words.some((w) => w?.toLowerCase().includes(q));
  });

  const getTargetTypeBadgeStyle = (type: ReportTargetType) => {
    switch (type) {
      case 'no-show':
        return {
          bg: colors.warningLight,
          text: colors.warning,
          icon: 'calendar-outline' as const,
        };
      case 'gig':
        return {
          bg: colors.accentLight,
          text: colors.accent,
          icon: 'briefcase-outline' as const,
        };
      default:
        return {
          bg: colors.primaryLight,
          text: colors.primary,
          icon: 'person-outline' as const,
        };
    }
  };

  const getStatusBadgeStyle = (status: ReportStatus) => {
    switch (status) {
      case 'pending':
        return { bg: colors.warningLight, text: colors.warning };
      case 'in_review':
        return { bg: colors.infoLight, text: colors.info };
      case 'resolved':
        return { bg: colors.successLight, text: colors.success };
      case 'dismissed':
        return { bg: colors.surfaceElevated, text: colors.textMuted };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header & Title */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{t('Moderation & Reports Queue')}</Text>
          <Text style={styles.subtitle}>
            {activeTab === 'reports'
              ? t('Review reported users, gigs, and no-show disputes.')
              : t('Moderate platform reviews and ratings.')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={loading || reviewsLoading}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          <Text style={styles.refreshBtnText}>{t('Refresh')}</Text>
        </TouchableOpacity>
      </View>

      {/* Segment Switcher: Reports Queue vs User Reviews */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'reports' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('reports')}
        >
          <Ionicons
            name="flag-outline"
            size={16}
            color={activeTab === 'reports' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === 'reports' && styles.segmentBtnTextActive,
            ]}
          >
            {t('Reports Queue')}
          </Text>
          {reports.length > 0 && (
            <View
              style={[
                styles.countBadge,
                activeTab === 'reports' ? styles.countBadgeActive : styles.countBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.countBadgeText,
                  activeTab === 'reports' ? styles.countBadgeTextActive : styles.countBadgeTextInactive,
                ]}
              >
                {reports.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'reviews' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('reviews')}
        >
          <Ionicons
            name="star-outline"
            size={16}
            color={activeTab === 'reviews' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === 'reviews' && styles.segmentBtnTextActive,
            ]}
          >
            {t('User Reviews')}
          </Text>
          {reviews.length > 0 && (
            <View
              style={[
                styles.countBadge,
                activeTab === 'reviews' ? styles.countBadgeActive : styles.countBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.countBadgeText,
                  activeTab === 'reviews' ? styles.countBadgeTextActive : styles.countBadgeTextInactive,
                ]}
              >
                {reviews.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'reports' ? (
        /* ================= REPORTS QUEUE TAB ================= */
        <>
          {/* Search Input */}
          <TextInput
            style={styles.searchInput}
            placeholder={t('Search by user, gig, reporter, or keywords...')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />

          {/* Filter Tabs: Status */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['all', 'pending', 'resolved', 'dismissed'] as const).map((st) => {
              const active = statusFilter === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setStatusFilter(st)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {st === 'all'
                      ? t('All Status')
                      : st === 'pending'
                      ? t('Pending Review')
                      : st === 'resolved'
                      ? t('Resolved')
                      : t('Dismissed')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Filter Tabs: Target Type */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['all', 'no-show', 'user', 'gig'] as const).map((tp) => {
              const active = typeFilter === tp;
              return (
                <TouchableOpacity
                  key={tp}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setTypeFilter(tp)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      active && styles.typeChipTextActive,
                    ]}
                  >
                    {tp === 'all'
                      ? t('All Types')
                      : tp === 'no-show'
                      ? t('No-Shows')
                      : tp === 'user'
                      ? t('Users')
                      : t('Gigs')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Error state */}
          {Boolean(errorMsg) && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Reports List */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading && reports.length > 0}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {visibleReports.map((report) => {
              const typeBadge = getTargetTypeBadgeStyle(report.targetType);
              const statusBadge = getStatusBadgeStyle(report.status);
              const isExpanded = expandedReportId === report.id;
              const createdDate = report.createdAt?.toDate?.()
                ? formatDate(report.createdAt.toDate())
                : t('Recently');

              return (
                <View key={report.id} style={styles.reportCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.badgesGroup}>
                      <View
                        style={[
                          styles.targetBadge,
                          { backgroundColor: typeBadge.bg },
                        ]}
                      >
                        <Ionicons
                          name={typeBadge.icon}
                          size={13}
                          color={typeBadge.text}
                        />
                        <Text
                          style={[styles.targetBadgeText, { color: typeBadge.text }]}
                        >
                          {report.targetType === 'no-show'
                            ? t('No-Show')
                            : report.targetType === 'gig'
                            ? t('Gig')
                            : t('User')}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusBadge.bg },
                        ]}
                      >
                        <Text
                          style={[styles.statusBadgeText, { color: statusBadge.text }]}
                        >
                          {t(report.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.cardDate}>{createdDate}</Text>
                  </View>

                  {/* Target & Reporter Info */}
                  <View style={styles.participantsRow}>
                    <View style={styles.participantBlock}>
                      <Text style={styles.participantLabel}>{t('Target')}</Text>
                      <Text style={styles.participantName}>
                        {report.targetUserName || report.targetGigTitle || report.targetId}
                      </Text>
                      <Text style={styles.participantSub}>ID: {report.targetId}</Text>
                    </View>

                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.textMuted}
                    />

                    <View style={styles.participantBlock}>
                      <Text style={styles.participantLabel}>{t('Reporter')}</Text>
                      <Text style={styles.participantName}>
                        {report.reporterName || report.reporterRole || t('User')}
                      </Text>
                      <Text style={styles.participantSub}>ID: {report.reporterId}</Text>
                    </View>
                  </View>

                  {/* Report Reason */}
                  <View style={styles.reasonRow}>
                    <View style={styles.reasonBadge}>
                      <Text style={styles.reasonBadgeText}>
                        {t(report.reason)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={styles.detailsText}
                    numberOfLines={isExpanded ? undefined : 3}
                  >
                    {report.details}
                  </Text>

                  {report.details.length > 120 && (
                    <TouchableOpacity
                      onPress={() =>
                        setExpandedReportId(isExpanded ? null : report.id)
                      }
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Text style={styles.expandText}>
                        {isExpanded ? t('Show less') : t('Read full details')}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Reporter Note if provided */}
                  {Boolean(report.note) && (
                    <View style={styles.reportNoteBox}>
                      <View style={styles.reportNoteHeader}>
                        <Ionicons
                          name="document-text-outline"
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={styles.reportNoteLabel}>
                          {t('Reporter Note')}
                        </Text>
                      </View>
                      <Text style={styles.reportNoteText}>{report.note}</Text>
                    </View>
                  )}

                  {/* If Resolved or Dismissed: show resolution outcome */}
                  {report.status !== 'pending' && (
                    <View style={styles.resolutionOutcomeBox}>
                      <View style={styles.resolutionHeader}>
                        <Ionicons
                          name="shield-checkmark"
                          size={14}
                          color={
                            report.status === 'resolved'
                              ? colors.success
                              : colors.textSecondary
                          }
                        />
                        <Text style={styles.resolutionActionText}>
                          {t('Outcome')}: {t(report.resolutionAction || report.status)}
                        </Text>
                      </View>
                      {Boolean(report.resolutionNotes) && (
                        <Text style={styles.resolutionNotesText}>
                          {report.resolutionNotes}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.reportIdText}>ID: {report.id}</Text>

                    <TouchableOpacity
                      style={[
                        styles.resolveBtn,
                        report.status !== 'pending' && styles.resolveBtnSecondary,
                      ]}
                      onPress={() => setReviewingReport(report)}
                    >
                      <Ionicons
                        name="build-outline"
                        size={14}
                        color={
                          report.status === 'pending'
                            ? colors.primaryOnColor
                            : colors.primary
                        }
                      />
                      <Text
                        style={[
                          styles.resolveBtnText,
                          report.status !== 'pending' && styles.resolveBtnTextSecondary,
                        ]}
                      >
                        {report.status === 'pending'
                          ? t('Review & Resolve')
                          : t('Change Action')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {loading && (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loader}
              />
            )}

            {!loading && !visibleReports.length && (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={48}
                  color={colors.success}
                />
                <Text style={styles.emptyTitle}>{t('No Reports Found')}</Text>
                <Text style={styles.emptyText}>
                  {t('There are no reports matching the selected filters.')}
                </Text>
              </View>
            )}

            {hasMore && !loading && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={handleLoadMoreReports}
              >
                <Text style={styles.loadMoreBtnText}>{t('Load More Reports')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      ) : (
        /* ================= USER REVIEWS & RATINGS TAB ================= */
        <>
          {/* Search Reviews */}
          <TextInput
            style={styles.searchInput}
            placeholder={t('Search reviews by user, gig, or comment...')}
            placeholderTextColor={colors.textMuted}
            value={reviewsSearch}
            onChangeText={setReviewsSearch}
            autoCapitalize="none"
          />

          {/* Filter Chips: Rating Stars */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['all', 5, 4, 3, 2, 1] as const).map((starVal) => {
              const active = ratingFilter === starVal;
              return (
                <TouchableOpacity
                  key={String(starVal)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setRatingFilter(starVal)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {starVal === 'all'
                      ? t('All Ratings')
                      : starVal === 5
                      ? t('5 Stars')
                      : starVal === 4
                      ? t('4 Stars')
                      : starVal === 3
                      ? t('3 Stars')
                      : starVal === 2
                      ? t('2 Stars')
                      : t('1 Star')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Success notice */}
          {Boolean(deleteSuccessNotice) && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={styles.successText}>{deleteSuccessNotice}</Text>
            </View>
          )}

          {/* Error notice */}
          {Boolean(reviewsErrorMsg) && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{reviewsErrorMsg}</Text>
            </View>
          )}

          {/* Reviews List */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={reviewsLoading && reviews.length > 0}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {visibleReviews.map((rev) => {
              const ratingScore = Math.max(1, Math.min(5, Math.round(Number(rev.rating) || 5)));
              const isExpanded = expandedReviewId === rev.id;
              const createdDate = rev.createdAt?.toDate?.()
                ? formatDate(rev.createdAt.toDate())
                : t('Recently');

              return (
                <View key={rev.id} style={styles.reportCard}>
                  {/* Card Header: Stars & Role badge & Date */}
                  <View style={styles.cardHeader}>
                    <View style={styles.reviewStarsGroup}>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons
                            key={i}
                            name={i <= ratingScore ? 'star' : 'star-outline'}
                            size={16}
                            color={colors.star}
                          />
                        ))}
                      </View>
                      <Text style={styles.ratingNumberText}>{ratingScore}.0</Text>
                    </View>

                    <View style={styles.badgesGroup}>
                      <View
                        style={[
                          styles.roleBadge,
                          rev.authorRole === 'client'
                            ? { backgroundColor: colors.accentLight }
                            : { backgroundColor: colors.primaryLight },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            rev.authorRole === 'client'
                              ? { color: colors.accent }
                              : { color: colors.primary },
                          ]}
                        >
                          {rev.authorRole === 'client' ? t('Business') : t('Youth')}
                        </Text>
                      </View>
                      <Text style={styles.cardDate}>{createdDate}</Text>
                    </View>
                  </View>

                  {/* Reviewer & Recipient row */}
                  <View style={styles.participantsRow}>
                    <View style={styles.participantBlock}>
                      <Text style={styles.participantLabel}>{t('Reviewer')}</Text>
                      <Text style={styles.participantName}>
                        {rev.authorName || rev.authorId}
                      </Text>
                      <Text style={styles.participantSub}>ID: {rev.authorId}</Text>
                    </View>

                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.textMuted}
                    />

                    <View style={styles.participantBlock}>
                      <Text style={styles.participantLabel}>{t('Recipient')}</Text>
                      <Text style={styles.participantName}>
                        {rev.targetUserId || t('User')}
                      </Text>
                      <Text style={styles.participantSub}>
                        {rev.targetRole === 'client' ? t('Business') : t('Youth')}
                      </Text>
                    </View>
                  </View>

                  {/* Gig link if present */}
                  {Boolean(rev.gigTitle || rev.gigId) && (
                    <View style={styles.gigLinkBadge}>
                      <Ionicons
                        name="briefcase-outline"
                        size={13}
                        color={colors.primary}
                      />
                      <Text style={styles.gigLinkText} numberOfLines={1}>
                        {rev.gigTitle || rev.gigId}
                      </Text>
                    </View>
                  )}

                  {/* Review Tags */}
                  {Boolean(rev.tags && rev.tags.length > 0) && (
                    <View style={styles.tagsContainer}>
                      {rev.tags.map((tag, tIdx) => (
                        <View key={tIdx} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Review Comment Body */}
                  <Text
                    style={styles.detailsText}
                    numberOfLines={isExpanded ? undefined : 3}
                  >
                    "{rev.comment}"
                  </Text>

                  {rev.comment.length > 120 && (
                    <TouchableOpacity
                      onPress={() =>
                        setExpandedReviewId(isExpanded ? null : rev.id)
                      }
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Text style={styles.expandText}>
                        {isExpanded ? t('Show less') : t('Read full details')}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Card Footer: ID & Admin Delete Action */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.reportIdText}>ID: {rev.id}</Text>

                    <TouchableOpacity
                      style={styles.deleteReviewBtn}
                      onPress={() => {
                        setDeleteError('');
                        setDeletingReview(rev);
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color={colors.error}
                      />
                      <Text style={styles.deleteReviewBtnText}>
                        {t('Delete Review')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {reviewsLoading && (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loader}
              />
            )}

            {!reviewsLoading && !visibleReviews.length && (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="star-outline"
                  size={48}
                  color={colors.warning}
                />
                <Text style={styles.emptyTitle}>{t('No Reviews Found')}</Text>
                <Text style={styles.emptyText}>
                  {t('There are no reviews matching the selected criteria.')}
                </Text>
              </View>
            )}

            {reviewsHasMore && !reviewsLoading && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={handleLoadMoreReviews}
              >
                <Text style={styles.loadMoreBtnText}>{t('Load More Reviews')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      )}

      {/* Resolve Report Modal */}
      {reviewingReport && (
        <ResolveReportModal
          visible={Boolean(reviewingReport)}
          report={reviewingReport}
          onClose={() => setReviewingReport(null)}
          onResolved={() => {
            handleRefresh();
          }}
        />
      )}

      {/* Delete Review Confirmation Modal */}
      {Boolean(deletingReview) && (
        <Modal
          visible={Boolean(deletingReview)}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isDeleting) setDeletingReview(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning-outline" size={24} color={colors.error} />
                <Text style={styles.modalTitle}>{t('Delete User Review')}</Text>
              </View>

              <Text style={styles.modalWarningText}>
                {t(
                  "Are you sure you want to delete this review? The recipient's rating average will be recalculated."
                )}
              </Text>

              {Boolean(deletingReview?.comment) && (
                <View style={styles.modalPreviewBox}>
                  <Text style={styles.modalPreviewText} numberOfLines={3}>
                    "{deletingReview?.comment}"
                  </Text>
                </View>
              )}

              {Boolean(deleteError) && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{deleteError}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setDeletingReview(null)}
                  disabled={isDeleting}
                >
                  <Text style={styles.modalCancelBtnText}>{t('Cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={confirmDeleteReview}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={colors.primaryOnColor} />
                  ) : (
                    <>
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={colors.primaryOnColor}
                      />
                      <Text style={styles.modalConfirmBtnText}>
                        {t('Confirm Delete')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  refreshBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countBadgeActive: {
    backgroundColor: colors.primaryLight,
  },
  countBadgeInactive: {
    backgroundColor: colors.surfaceBorderSubtle,
  },
  countBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  countBadgeTextActive: {
    color: colors.primary,
  },
  countBadgeTextInactive: {
    color: colors.textMuted,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.primaryOnColor,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  typeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
  },
  successText: {
    fontSize: 13,
    color: colors.success,
    flex: 1,
    fontFamily: fonts.bodyMedium,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewStarsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingNumberText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.text,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  roleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  targetBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  cardDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    padding: 10,
    borderRadius: borderRadius.md,
    gap: 8,
  },
  participantBlock: {
    flex: 1,
    gap: 2,
  },
  participantLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  participantName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.text,
  },
  participantSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  gigLinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  gigLinkText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.full,
  },
  reasonBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.warning,
  },
  detailsText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  expandText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.primary,
  },
  reportNoteBox: {
    padding: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
    gap: 4,
    marginTop: 4,
  },
  reportNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportNoteLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.primary,
  },
  reportNoteText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  resolutionOutcomeBox: {
    padding: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    gap: 4,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resolutionActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.text,
  },
  resolutionNotesText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorderSubtle,
  },
  reportIdText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  resolveBtnSecondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  resolveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.primaryOnColor,
  },
  resolveBtnTextSecondary: {
    color: colors.primary,
  },
  deleteReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  deleteReviewBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.error,
  },
  loader: {
    paddingVertical: 24,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    color: colors.text,
  },
  emptyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadMoreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  loadMoreBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  modalWarningText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  modalPreviewBox: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  modalPreviewText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  modalCancelBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
  },
  modalConfirmBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.primaryOnColor,
  },
});
