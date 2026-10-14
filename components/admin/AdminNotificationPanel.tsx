import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../LocalizedText';
import { colors, fonts } from '../../constants/theme';
import {
  createAdminAnnouncement,
  fetchAnnouncementRecipients,
  subscribeToAdminAnnouncements,
  type AdminAnnouncement,
  type AnnouncementRecipient,
  type AnnouncementAudience,
} from '../../services/adminNotificationService';

const AUDIENCES: { value: AnnouncementAudience; label: string }[] = [
  { value: 'all', label: 'All active users' },
  { value: 'freelancer', label: 'Youth only' },
  { value: 'client', label: 'Businesses only' },
  { value: 'user', label: 'One user' },
];

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not send announcement. Please retry.';

function timestamp(value: unknown) {
  const candidate = value as { toDate?: () => Date } | undefined;
  const date = candidate?.toDate?.();
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '';
}

export default function AdminNotificationPanel() {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipients, setRecipients] = useState<AnnouncementRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState('');
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeToAdminAnnouncements(
      next => { setItems(next); setLoading(false); setError(''); },
      failure => { setLoading(false); setError(failure.message); },
    );
    return () => { mounted.current = false; unsubscribe(); };
  }, []);

  const loadRecipients = async () => {
    if (recipientsLoading || recipients.length) return;
    setRecipientsLoading(true); setRecipientsError('');
    try {
      const next = await fetchAnnouncementRecipients();
      if (mounted.current) setRecipients(next);
    } catch {
      if (mounted.current) setRecipientsError('Could not load users. Please retry.');
    } finally {
      if (mounted.current) setRecipientsLoading(false);
    }
  };

  const selectAudience = (next: AnnouncementAudience) => {
    setAudience(next); setError(''); setNotice('');
    if (next === 'user') void loadRecipients();
  };

  const submit = async () => {
    if (sending) return;
    setSending(true); setError(''); setNotice('');
    try {
      await createAdminAnnouncement({ title, body, audience, targetUserId });
      if (!mounted.current) return;
      setTitle(''); setBody(''); setTargetUserId(''); setRecipientSearch(''); setAudience('all');
      setNotice('Announcement delivered.');
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  const search = recipientSearch.trim().toLocaleLowerCase();
  const matchingRecipients = recipients.filter(item => !search || [item.displayName, item.email, item.id]
    .some(value => value.toLocaleLowerCase().includes(search))).slice(0, 8);
  const selectedRecipient = recipients.find(item => item.id === targetUserId);

  return <View style={styles.stack}>
    <View style={styles.section}>
      <View style={styles.headingRow}><View style={styles.icon}><Ionicons name="notifications-outline" size={22} color={colors.primary} /></View>
        <View style={styles.copy}><Text style={styles.title}>{t('Send announcement')}</Text><Text style={styles.secondary}>{t('Deliver an in-app notification to active members.')}</Text></View></View>
      <TextInput accessibilityLabel={t('Announcement title')} placeholder={t('Announcement title')} value={title} onChangeText={setTitle} maxLength={80} editable={!sending} style={styles.input} />
      <TextInput accessibilityLabel={t('Announcement message')} placeholder={t('Announcement message')} value={body} onChangeText={setBody} maxLength={500} multiline editable={!sending} style={[styles.input, styles.message]} />
      <Text style={styles.secondary}>{body.length}/500</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.audiences}>{AUDIENCES.map(option =>
        <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ checked: audience === option.value }} disabled={sending} onPress={() => selectAudience(option.value)} style={[styles.audience, audience === option.value && styles.selected]}>
          <Text style={audience === option.value ? styles.selectedText : styles.secondary}>{t(option.label)}</Text>
        </TouchableOpacity>)}</ScrollView>
      {audience === 'user' && <View style={styles.recipientPicker}>
        <Text style={styles.rowTitle}>{t('Select recipient')}</Text>
        <TextInput accessibilityLabel={t('Search by name or email')} placeholder={t('Search by name or email')} value={recipientSearch} onChangeText={setRecipientSearch} autoCapitalize="none" autoCorrect={false} editable={!sending && !recipientsLoading} style={styles.input} />
        {recipientsLoading ? <ActivityIndicator color={colors.primary} /> : recipientsError ? <View style={styles.retryRow}><Text accessibilityRole="alert" style={styles.error}>{t(recipientsError)}</Text><TouchableOpacity accessibilityRole="button" onPress={loadRecipients}><Text style={styles.selectedText}>{t('Retry')}</Text></TouchableOpacity></View>
          : !matchingRecipients.length ? <Text style={styles.secondary}>{t('No matching users found.')}</Text> : matchingRecipients.map(item =>
            <TouchableOpacity key={item.id} accessibilityRole="radio" accessibilityState={{ checked: targetUserId === item.id }} disabled={sending} onPress={() => setTargetUserId(item.id)} style={[styles.recipient, targetUserId === item.id && styles.selectedRecipient]}>
              <View style={styles.recipientAvatar}><Text style={styles.selectedText}>{item.displayName[0]?.toUpperCase() || '?'}</Text></View><View style={styles.copy}><Text style={styles.rowTitle}>{item.displayName}</Text><Text style={styles.secondary}>{item.email || item.id} · {t(item.role === 'freelancer' ? 'Youth' : 'Business')}</Text></View>{targetUserId === item.id && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
            </TouchableOpacity>)}
        {selectedRecipient && <Text style={styles.selection}>{t('Selected recipient')}: {selectedRecipient.displayName}</Text>}
      </View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{t(notice)}</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: sending, busy: sending }} disabled={sending} onPress={submit} style={[styles.send, sending && styles.disabled]}>
        {sending ? <ActivityIndicator color={colors.primaryOnColor} /> : <><Ionicons name="send" size={17} color={colors.primaryOnColor} /><Text style={styles.sendText}>{t('Send announcement')}</Text></>}
      </TouchableOpacity>
    </View>
    <View style={styles.section}>
      <Text style={styles.title}>{t('Announcement history')}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : !items.length ? <Text style={styles.secondary}>{t('No announcements sent yet.')}</Text> : items.map(item =>
        <View key={item.id} style={styles.historyRow}><View style={styles.copy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.secondary}>{item.body}</Text>
          <Text style={styles.meta}>{t('Audience')}: {t(AUDIENCES.find(option => option.value === item.audience)?.label ?? item.audience)}{item.targetUserId ? ` · ${item.targetUserId}` : ''}</Text>
          <Text style={styles.meta}>{timestamp(item.createdAt)}</Text>{!!item.errorMessage && <Text style={styles.error}>{item.errorMessage}</Text>}</View>
          <View style={[styles.status, item.status === 'failed' && styles.failed]}><Text style={[styles.statusText, item.status === 'failed' && styles.error]}>{t(item.status)} · {item.deliveredCount ?? 0}</Text></View>
        </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 20 }, section: { padding: 20, gap: 14, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.surfaceBorder },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight }, copy: { flex: 1, gap: 5 },
  title: { fontSize: 20, fontFamily: fonts.heading, color: colors.text }, rowTitle: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text }, secondary: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }, meta: { color: colors.textMuted, fontSize: 12 },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 14, minHeight: 48, color: colors.text, fontSize: 15 }, message: { minHeight: 120, textAlignVertical: 'top' },
  recipientPicker: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceElevated }, recipient: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.surfaceBorder }, selectedRecipient: { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder }, recipientAvatar: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, retryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, selection: { color: colors.primary, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  audiences: { gap: 8 }, audience: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surfaceElevated }, selected: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder }, selectedText: { color: colors.primary, fontFamily: fonts.bodyBold },
  send: { minHeight: 46, borderRadius: 11, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, sendText: { color: colors.primaryOnColor, fontFamily: fonts.bodyBold }, disabled: { opacity: 0.5 },
  error: { color: colors.error, lineHeight: 20 }, success: { color: colors.success, backgroundColor: colors.successLight, padding: 12, borderRadius: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 14, borderTopWidth: 1, borderColor: colors.surfaceBorderSubtle }, status: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.primaryLight }, failed: { backgroundColor: colors.errorLight }, statusText: { color: colors.primary, fontSize: 12, fontFamily: fonts.bodySemiBold },
});
