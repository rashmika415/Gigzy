import { formatRelativeDate } from '../../../localization/format';
import { Text, TextInput } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../../constants/theme';
import { subscribeToUserChats } from '../../../services/chatService';
import { Chat, ParticipantDetail } from '../../../types/chat';

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return formatRelativeDate(date);
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'gigs'>('all');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user) return;

    let active = true;
    let unsubscribe: () => void = () => {};
    void Promise.resolve().then(() => {
    if (!active) return;
    setLoading(true);
    setErrorMsg('');

    unsubscribe = subscribeToUserChats(
      user.uid,
      (userChats) => {
        setChats(userChats);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        setErrorMsg(err.message || 'Failed to load conversations.');
        setLoading(false);
        setRefreshing(false);
      }
    );

    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const getOtherParticipant = useCallback((chat: Chat): ParticipantDetail => {
    if (!user) return { uid: '', fullName: 'User', role: 'freelancer' };
    const otherUid = chat.participants.find((p) => p !== user.uid) || '';
    return (
      chat.participantDetails?.[otherUid] || {
        uid: otherUid,
        fullName: 'User',
        role: 'freelancer',
      }
    );
  }, [user]);

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      const other = getOtherParticipant(chat);
      const name = other.fullName?.toLowerCase() || '';
      const gig = chat.gigTitle?.toLowerCase() || '';
      const lastMsg = (
        typeof chat.lastMessage === 'string'
          ? chat.lastMessage
          : chat.lastMessage?.text || ''
      ).toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query || name.includes(query) || gig.includes(query) || lastMsg.includes(query);

      if (!matchesSearch) return false;

      const unread = user ? (chat.unreadCount?.[user.uid] || 0) : 0;

      if (activeTab === 'unread') {
        return unread > 0;
      }
      if (activeTab === 'gigs') {
        return Boolean(chat.gigId);
      }
      return true;
    });
  }, [chats, searchQuery, activeTab, user, getOtherParticipant]);

  const totalUnread = useMemo(() => {
    if (!user) return 0;
    return chats.reduce((acc, c) => acc + (c.unreadCount?.[user.uid] || 0), 0);
  }, [chats, user]);

  const handleOpenChat = (chat: Chat) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.push({
      pathname: '/(app)/chat/[id]',
      params: { id: chat.id },
    } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Subtle background ambient glows */}


      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t("Messages")}</Text>
          {totalUnread > 0 && (
            <View style={styles.headerUnreadBadge}>
              <Text style={styles.headerUnreadText}>{totalUnread}{t("new")}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => router.push('/(app)/(tabs)/home' as any)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="compass-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.placeholder} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("Search messages, names, or gigs...")}
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'unread', 'gigs'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'all' ? 'All Chats' : tab === 'unread' ? `Unread (${totalUnread})` : 'Gig Inquiries';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setActiveTab(tab);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {t(label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Conversations List */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t("Syncing conversations...")}</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
            <Text style={styles.errorText}>{t(errorMsg ?? "")}</Text>
          </View>
        ) : filteredChats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? t("No matching conversations") : activeTab === 'unread' ? t("All caught up!") : t("No conversations yet")}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? t("Try searching with a different name or keyword.") : activeTab === 'unread' ? t("You have read all received messages.") : t("Connect with employers or youth freelancers from gig listings to start chatting.")}
            </Text>

            {!searchQuery && (
              <TouchableOpacity
                style={styles.exploreButton}
                onPress={() => router.push('/(app)/(tabs)/home' as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="briefcase-outline" size={18} color={colors.primaryOnColor} />
                <Text style={styles.exploreButtonText}>{t("Explore Gigs")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredChats.map((chat) => {
            const other = getOtherParticipant(chat);
            const unread = user ? (chat.unreadCount?.[user.uid] || 0) : 0;
            const isSentByMe =
              typeof chat.lastMessage === 'object' &&
              chat.lastMessage?.senderId === user?.uid;
            const isBusiness = other.role === 'client';
            const lastMsgPreview =
              typeof chat.lastMessage === 'string'
                ? chat.lastMessage
                : chat.lastMessage?.text || 'Started a new conversation';
            const timestampValue =
              chat.lastMessageAt ||
              (typeof chat.lastMessage === 'object' ? chat.lastMessage?.createdAt : null) ||
              chat.updatedAt;

            return (
              <TouchableOpacity
                key={chat.id}
                style={[styles.chatCard, unread > 0 && styles.chatCardUnread]}
                onPress={() => handleOpenChat(chat)}
                activeOpacity={0.75}
              >
                {/* Avatar */}
                <View style={styles.avatarWrapper}>
                  {other.photoURL ? (
                    <Image source={{ uri: other.photoURL }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarCircle, isBusiness && styles.avatarCircleBusiness]}>
                      <Text style={[styles.avatarText, isBusiness && styles.avatarTextBusiness]}>
                        {(other.fullName?.[0] || 'U').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {unread > 0 && <View style={styles.onlineBadge} />}
                </View>

                {/* Main Content */}
                <View style={styles.chatDetails}>
                  <View style={styles.chatHeaderRow}>
                    <View style={styles.nameRoleContainer}>
                      <Text style={[styles.userName, unread > 0 && styles.userNameBold]} numberOfLines={1}>
                        {other.fullName || t("User")}
                      </Text>
                      <View style={[styles.roleTag, isBusiness ? styles.roleTagBusiness : styles.roleTagYouth]}>
                        <Text style={[styles.roleTagText, isBusiness ? styles.roleTagTextBusiness : styles.roleTagTextYouth]}>
                          {isBusiness ? t("Client") : t("Freelancer")}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.timeText, unread > 0 && styles.timeTextUnread]}>
                      {formatTimestamp(timestampValue)}
                    </Text>
                  </View>

                  {/* Gig Context Pill */}
                  {chat.gigTitle && (
                    <View style={styles.gigPill}>
                      <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                      <Text style={styles.gigPillText} numberOfLines={1}>
                        {chat.gigTitle}
                        {chat.gigPay ? t(" • ${{value0}}{{value1}}", { value0: chat.gigPay, value1: chat.gigPayType === 'hourly' ? t("/hr") : '' }) : ''}
                      </Text>
                    </View>
                  )}

                  {/* Last Message Preview & Unread Pill */}
                  <View style={styles.messagePreviewRow}>
                    <Text
                      style={[styles.lastMessageText, unread > 0 && styles.lastMessageTextUnread]}
                      numberOfLines={1}
                    >
                      {isSentByMe ? 'You: ' : ''}
                      {lastMsgPreview}
                    </Text>

                    {unread > 0 && (
                      <View style={styles.unreadPill}>
                        <Text style={styles.unreadPillText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
  },
  headerBackBtn: {
    padding: spacing.xs,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerUnreadBadge: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  headerUnreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  headerActionBtn: {
    padding: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(135, 147, 144, 0.1)',
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: colors.errorText,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  exploreButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
  },
  exploreButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryOnColor,
  },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  chatCardUnread: {
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleBusiness: {
    backgroundColor: colors.accentLight,
    borderColor: '#2C4968',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  avatarTextBusiness: {
    color: '#2C4968',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  chatDetails: {
    flex: 1,
    gap: 4,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  userNameBold: {
    fontWeight: '800',
    color: colors.text,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  roleTagYouth: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.surfaceBorder,
  },
  roleTagBusiness: {
    backgroundColor: colors.accentLight,
    borderColor: 'rgba(123, 166, 214, 0.4)',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleTagTextYouth: {
    color: colors.primary,
  },
  roleTagTextBusiness: {
    color: '#2C4968',
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timeTextUnread: {
    color: colors.primary,
    fontWeight: '700',
  },
  gigPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginVertical: 2,
  },
  gigPillText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  messagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessageText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  lastMessageTextUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  unreadPill: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryOnColor,
  },
});
