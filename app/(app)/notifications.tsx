import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from '../../services/notificationService';
import { AppNotification, NotificationType } from '../../types/notification';
import { borderRadius, colors, spacing } from '../../constants/theme';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  gig_match: 'briefcase-outline', application: 'document-text-outline', message: 'chatbubble-outline',
  review: 'star-outline', endorsement: 'ribbon-outline', system: 'notifications-outline',
};

function formatDate(value: any) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : 'Just now';
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, (next) => { setItems(next); setLoading(false); }, () => setLoading(false));
  }, [user]);

  const openNotification = async (item: AppNotification) => {
    if (!user) return;
    if (!item.read) await markNotificationRead(user.uid, item.id);
    if (item.route) router.push(item.route as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={23} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</Text>
        </View>
        <TouchableOpacity disabled={!unreadCount || !user} onPress={() => user && markAllNotificationsRead(user.uid, items)}>
          <Text style={[styles.markAll, !unreadCount && styles.disabled]}>Read all</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? (
            <View style={styles.empty}><Ionicons name="notifications-off-outline" size={42} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No notifications yet</Text><Text style={styles.emptyText}>Gig updates, reviews and endorsements will appear here.</Text></View>
          ) : items.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.card, !item.read && styles.unreadCard]} onPress={() => openNotification(item)}>
              <View style={styles.notificationIcon}><Ionicons name={ICONS[item.type] ?? ICONS.system} size={20} color={colors.primary} /></View>
              <View style={styles.copy}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.date}>{formatDate(item.createdAt)}</Text></View>
              {!item.read && <View style={styles.dot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:colors.background,paddingTop:48}, header:{flexDirection:'row',alignItems:'center',paddingHorizontal:spacing.lg,paddingBottom:spacing.md,borderBottomWidth:1,borderBottomColor:colors.surfaceBorder}, iconButton:{paddingRight:spacing.md}, headerCopy:{flex:1}, title:{fontSize:22,fontWeight:'800',color:colors.text}, subtitle:{fontSize:12,color:colors.textMuted,marginTop:2}, markAll:{color:colors.primary,fontWeight:'700'}, disabled:{opacity:.35}, loader:{marginTop:60}, content:{padding:spacing.lg,gap:spacing.sm,paddingBottom:spacing.xxl}, card:{flexDirection:'row',gap:spacing.md,padding:spacing.md,backgroundColor:colors.surface,borderRadius:borderRadius.lg,borderWidth:1,borderColor:colors.surfaceBorder}, unreadCard:{borderColor:colors.primary,backgroundColor:colors.primaryLight}, notificationIcon:{width:40,height:40,borderRadius:20,backgroundColor:colors.primaryLight,alignItems:'center',justifyContent:'center'}, copy:{flex:1}, itemTitle:{fontSize:15,fontWeight:'700',color:colors.text}, body:{fontSize:13,color:colors.textSecondary,lineHeight:18,marginTop:3}, date:{fontSize:11,color:colors.textMuted,marginTop:6}, dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.primary,marginTop:5}, empty:{alignItems:'center',paddingTop:90,paddingHorizontal:spacing.xl}, emptyTitle:{fontSize:18,fontWeight:'700',color:colors.text,marginTop:spacing.md}, emptyText:{fontSize:14,color:colors.textSecondary,textAlign:'center',marginTop:spacing.sm,lineHeight:20}
});
