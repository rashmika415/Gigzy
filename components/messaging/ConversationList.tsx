import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { Conversation } from '../../types/messaging';
import ConversationItem from './ConversationItem';

interface ConversationListProps {
  conversations: Conversation[];
  currentUserId: string;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: 'all' | 'unread' | 'gigs';
  onTabChange: (tab: 'all' | 'unread' | 'gigs') => void;
  onExploreGigs?: () => void;
}

export default function ConversationList({
  conversations,
  currentUserId,
  loading,
  refreshing,
  onRefresh,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  onExploreGigs,
}: ConversationListProps) {
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const otherUid =
        conv.participants?.find((p) => p !== currentUserId) ||
        (conv.youthId === currentUserId ? conv.businessId : conv.youthId) ||
        '';
      const other = conv.participantDetails?.[otherUid];
      const name = other?.fullName?.toLowerCase() || '';
      const gig = conv.gigTitle?.toLowerCase() || '';
      const lastMsg =
        typeof conv.lastMessage === 'string'
          ? conv.lastMessage.toLowerCase()
          : conv.lastMessage?.text?.toLowerCase() || '';
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch = !q || name.includes(q) || gig.includes(q) || lastMsg.includes(q);
      if (!matchesSearch) return false;

      const unreadCount = conv.unreadCount?.[currentUserId] || 0;
      if (activeTab === 'unread') {
        return unreadCount > 0 || Boolean(conv.unread);
      }
      if (activeTab === 'gigs') {
        return Boolean(conv.gigId || conv.applicationId);
      }
      return true;
    });
  }, [conversations, currentUserId, searchQuery, activeTab]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount?.[currentUserId] || 0), 0);
  }, [conversations, currentUserId]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.placeholder} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations, names, or gigs..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
              onPress={() => onTabChange(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Conversations Stream */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Syncing conversations...</Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={38} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery
                ? 'No matching conversations'
                : activeTab === 'unread'
                ? 'All caught up!'
                : 'No conversations yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term or check spelling.'
                : activeTab === 'unread'
                ? 'You have read all received messages.'
                : 'Connect with employers or youth freelancers from gig applications to start chatting.'}
            </Text>

            {onExploreGigs && !searchQuery && (
              <TouchableOpacity style={styles.exploreButton} onPress={onExploreGigs} activeOpacity={0.85}>
                <Ionicons name="briefcase-outline" size={16} color={colors.primaryOnColor} />
                <Text style={styles.exploreButtonText}>Explore Gigs</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id || conv.conversationId}
              conversation={conv}
              currentUserId={currentUserId}
              onPress={onSelectConversation}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
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
  scroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  centerContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(111, 216, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 270,
  },
  exploreButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
  },
  exploreButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryOnColor,
  },
});
