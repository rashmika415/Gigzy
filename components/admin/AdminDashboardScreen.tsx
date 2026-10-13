import BusinessVerificationPanel from './BusinessVerificationPanel';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../LocalizedText';
import LanguageSelector from '../LanguageSelector';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../FirebaseConfig';
import { colors as sharedColors, fonts } from '../../constants/theme';
import { fetchAdminPage, fetchAdminStats, removeGigFromDiscovery, setUserSuspension } from '../../services/adminService';
import type { AdminCursor, AdminStats, AdminUser } from '../../services/adminService';
import type { Application } from '../../types/application';
import { formatDate } from '../../localization/format';
import type { Gig } from '../../types/gig';

// A dedicated palette keeps administration visually distinct from the member app.
const colors = {
  ...sharedColors,
  background: '#F3F4FB', surface: '#FFFFFF', surfaceElevated: '#F0F1FA',
  surfaceBorder: '#E2E5F1', surfaceBorderSubtle: '#EDF0F7',
  primary: '#6250C5', primaryLight: '#EEEAFE', accent: '#2879B7',
  text: '#22243C', textSecondary: '#60657E', textMuted: '#747A92',
  inputBorder: '#DDE1EF', success: '#147B68', warning: '#996116',
};
const STAT_TONES = ['#EEEAFE', '#E6F2FC', '#E4F6EF', '#FFF1DB'];

type Panel = 'overview' | 'users' | 'gigs' | 'applications' | 'verification';
type Action = { kind: 'suspend' | 'reinstate' | 'remove'; id: string; name: string };
const PANELS: { key: Panel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'verification', label: 'Business verification', icon: 'shield-checkmark-outline' },
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'gigs', label: 'Gigs', icon: 'briefcase-outline' },
  { key: 'applications', label: 'Applications', icon: 'document-text-outline' },
];
const message = (error: unknown) => error instanceof Error ? error.message : 'Could not load dashboard. Please retry.';

export default function AdminDashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const wide = useWindowDimensions().width >= 900;
  const [panel, setPanel] = useState<Panel>('overview');
  const [stats, setStats] = useState<AdminStats>();
  const [statsError, setStatsError] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<(AdminUser | Gig | Application)[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<AdminCursor>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedGig, setExpandedGig] = useState('');
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<Action>();
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const pageRequest = useRef(0);
  const mounted = useRef(true);
  const actionLock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    void fetchAdminStats().then(value => { if (!cancelled) { setStats(value); setStatsLoading(false); } }, error => {
      if (!cancelled) { setStatsError(message(error)); setStatsLoading(false); }
    });
    return () => { cancelled = true; };
  }, [revision]);
  useEffect(() => {
    const request = ++pageRequest.current;
    if (panel === 'overview' || panel === 'verification') return;
    void Promise.resolve().then(async () => {
      if (!mounted.current || request !== pageRequest.current) return;
      setListLoading(true); setListError(''); setCursor(undefined); setHasMore(false); setRows([]);
      try {
        const page = await fetchAdminPage(panel);
        if (!mounted.current || request !== pageRequest.current) return;
        setRows(page.rows); setCursor(page.cursor); setHasMore(page.hasMore);
      } catch (error) { if (mounted.current && request === pageRequest.current) setListError(message(error)); }
      finally { if (mounted.current && request === pageRequest.current) setListLoading(false); }
    });
  }, [panel, revision]);
  const refresh = () => { setStatsLoading(true); setStatsError(''); setRevision(value => value + 1); };
  const selectPanel = (next: Panel) => { if (next === panel) return; pageRequest.current++; setListLoading(false); setPanel(next); setSearch(''); setFilter('all'); setNotice(''); setExpandedGig(''); };
  const loadMore = async () => {
    if (listLoading || !hasMore || (panel === 'overview' || panel === 'verification')) return;
    const request = ++pageRequest.current;
    setListLoading(true); setListError('');
    try {
      const page = await fetchAdminPage(panel, cursor);
      if (!mounted.current || request !== pageRequest.current) return;
      setRows(value => [...value, ...page.rows]); setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (error) { if (mounted.current && request === pageRequest.current) setListError(message(error)); }
    finally { if (mounted.current && request === pageRequest.current) setListLoading(false); }
  };
  const openAction = (value: Action) => { setAction(value); setReason(''); setActionError(''); setNotice(''); };
  const confirmAction = async () => {
    if (!action || actionLock.current) return;
    actionLock.current = true; setActing(true); setActionError('');
    try {
      if (action.kind === 'remove') await removeGigFromDiscovery(action.id, reason);
      else await setUserSuspension(action.id, action.kind === 'suspend', reason);
      if (!mounted.current) return;
      setNotice('Changes saved.'); setAction(undefined); refresh();
    } catch (error) { if (mounted.current) setActionError(message(error)); }
    finally { actionLock.current = false; if (mounted.current) setActing(false); }
  };
  const logout = async () => {
    if (loggingOut || acting) return;
    setLoggingOut(true); setLogoutError('');
    try { await signOut(auth); }
    catch { if (mounted.current) setLogoutError('Could not sign out. Please retry.'); }
    finally { if (mounted.current) setLoggingOut(false); }
  };
  const label = (value: string) => t(({ all: 'All', active: 'Active', suspended: 'Suspended', freelancer: 'Youth', client: 'Business', admin: 'Administrator', removed: 'Removed' } as Record<string, string>)[value] || value);
  const filters = panel === 'users' ? ['all', 'active', 'suspended', 'freelancer', 'client', 'admin'] : panel === 'applications' ? ['all', 'pending', 'accepted', 'rejected', 'completed'] : ['all', 'open', 'filled', 'in-progress', 'completed', 'closed', 'cancelled', 'removed'];
  const visible = rows.filter(row => {
    const item = row as AdminUser & Gig & Application;
    const words = panel === 'users' ? [item.fullName, item.businessName, item.email, item.id] : panel === 'applications' ? [item.gigTitle, item.youthName, item.businessName, item.message, item.gigId, item.youthId, item.businessId, item.id] : [item.title, item.location, item.postedBy?.fullName, item.id];
    const matchesText = words.some(value => value?.toLowerCase().includes(search.trim().toLowerCase()));
    const matchesFilter = filter === 'all' || (panel === 'users'
      ? filter === 'suspended' ? item.suspended : filter === 'active' ? !item.suspended : item.role === filter
      : panel === 'applications' ? item.status === filter : filter === 'removed' ? item.moderationRemoved : item.status === filter && !item.moderationRemoved);
    return matchesText && matchesFilter;
  });
  const cards: { label: string; key: keyof AdminStats; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { label: 'Total users', key: 'users', icon: 'people-outline', color: colors.primary },
    { label: 'Total gigs', key: 'gigs', icon: 'briefcase-outline', color: colors.accent },
    { label: 'Total applications', key: 'applications', icon: 'document-text-outline', color: colors.success },
    { label: 'Open gigs', key: 'openGigs', icon: 'flash-outline', color: colors.warning },
  ];
  const navigation = <View style={[styles.navigation, !wide && styles.mobileNavigation]}>{PANELS.map(item =>
    <TouchableOpacity key={item.key} accessibilityRole="tab" accessibilityState={{ selected: panel === item.key }} onPress={() => selectPanel(item.key)} style={[styles.navItem, !wide && { flexGrow: 1, flexBasis: '44%', minWidth: 0 }, panel === item.key && (wide ? styles.sidebarSelected : styles.selected)]}>
      <Ionicons name={item.icon} size={20} color={wide ? panel === item.key ? '#FFFFFF' : '#B9BDD8' : panel === item.key ? colors.primary : colors.textSecondary} /><Text style={wide ? panel === item.key ? styles.sidebarSelectedText : styles.sidebarText : panel === item.key ? styles.selectedText : styles.secondary}>{t(item.label)}</Text>
    </TouchableOpacity>)}</View>;
  return <SafeAreaView style={styles.page}>
    <View style={[styles.shell, wide && styles.shellWide]}>
      {wide && <View style={styles.sidebar}><View style={styles.brand}><Ionicons name="shield-checkmark" size={25} color="#B9ACFF" /><Text style={styles.brandText}>Gigzy</Text></View>
        <Text style={styles.sidebarText}>{t('Administration')}</Text>{navigation}<Text style={styles.sidebarNote}>{t('Manage your community and opportunities.')}</Text></View>}
      <View style={styles.main}>
        <View style={styles.header}><View style={styles.headerCopy}><Text accessibilityRole="header" style={styles.heading}>{t('Admin dashboard')}</Text>
          <Text style={styles.secondary}>{t('Signed in as {{email}}', { email: user?.email || '' })}</Text></View><Button title={t('Sign out')} icon="log-out-outline" busy={loggingOut} disabled={acting} onPress={logout} /></View>
        {!wide && navigation}
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={statsLoading && !!stats} onRefresh={refresh} tintColor={colors.primary} />}>
          <View style={styles.hero}>
            <View style={styles.heroOrb} pointerEvents="none" />
            <View style={styles.heroCopy}><Text style={styles.heroEyebrow}>{t('Administration')}</Text>
              <Text style={styles.heroTitle}>{t('Manage your community and opportunities.')}</Text>
              <Text style={styles.heroCaption}>{t('Suspend accounts or remove gigs from discovery with a recorded reason.')}</Text>
            </View>
            <View style={styles.heroEmblem}><Ionicons name="shield-checkmark-outline" size={44} color="#D9D0FF" /></View>
          </View>
          <View style={styles.toolbar}><LanguageSelector /><Button title={t('Refresh')} icon="refresh-outline" onPress={refresh} disabled={statsLoading || listLoading} /></View>
          {!!logoutError && <Text accessibilityRole="alert" style={styles.error}>{t(logoutError)}</Text>}
          {!!notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{t(notice)}</Text>}
          <View style={styles.statsGrid}>{cards.map((card, index) => <TouchableOpacity key={card.key} accessibilityRole="button" onPress={() => selectPanel(card.key === 'users' ? 'users' : card.key === 'applications' ? 'applications' : 'gigs')} activeOpacity={0.85} style={[styles.statCard, { backgroundColor: STAT_TONES[index] }]}>
            <View style={[styles.statIcon, { backgroundColor: '#FFFFFFB3' }]}><Ionicons name={card.icon} size={23} color={card.color} /></View>
            <Text style={styles.statValue}>{statsError ? '—' : stats ? stats[card.key].toLocaleString() : '…'}</Text><Text style={styles.secondary}>{t(card.label)}</Text>
          </TouchableOpacity>)}</View>
          {!!statsError && <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{t('Could not load platform statistics.')}</Text><Button title={t('Retry')} onPress={refresh} /></View>}
          {panel === 'verification' ? <BusinessVerificationPanel /> : panel === 'overview' ? <>
            <View style={styles.section}><Text style={styles.sectionTitle}>{t('Community overview')}</Text>
              {statsLoading && !stats ? <ActivityIndicator color={colors.primary} /> : statsError ? <Text style={styles.secondary}>{t('Refresh to load current totals.')}</Text> : stats && <>
                <SummaryRow label={t('Youth')} value={stats.youth} total={stats.users} /><SummaryRow label={t('Businesses')} value={stats.businesses} total={stats.users} />
                <SummaryRow label={t('Suspended accounts')} value={stats.suspended} total={stats.users} warning />
              </>}
            </View>
            <View style={styles.section}><Text style={styles.sectionTitle}>{t('Quick actions')}</Text><View style={styles.actions}>
              <Button title={t('Manage users')} icon="people-outline" onPress={() => selectPanel('users')} primary /><Button title={t('Manage gigs')} icon="briefcase-outline" onPress={() => selectPanel('gigs')} /><Button title={t('Review applications')} icon="document-text-outline" onPress={() => selectPanel('applications')} />
            </View><Text style={styles.secondary}>{t('Suspend accounts or remove gigs from discovery with a recorded reason.')}</Text></View>
          </> : <View style={styles.section}>
            <Text style={styles.sectionTitle}>{panel === 'users' ? t('User management') : panel === 'applications' ? t('Application activity') : t('Gig management')}</Text>
            <TextInput accessibilityLabel={t('Search loaded records')} placeholder={t('Search loaded records')} value={search} onChangeText={setSearch} style={styles.input} autoCapitalize="none" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map(value =>
              <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.selected]}><Text style={filter === value ? styles.selectedText : styles.secondary}>{label(value)}</Text></TouchableOpacity>)}</ScrollView>
            <Text style={styles.secondary}>{t('Search and filters apply to {{count}} loaded records. Load more to include additional records.', { count: rows.length })}</Text>
            {visible.map(row => {
              if (panel === 'users') {
                const item = row as AdminUser;
                return <View key={item.id} style={styles.row}><View style={styles.avatar}><Text style={styles.selectedText}>{(item.fullName || item.businessName || '?')[0].toUpperCase()}</Text></View>
                  <View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.fullName || item.businessName || t('Unnamed user')}</Text><Text selectable style={styles.secondary}>{item.email || item.id}</Text>
                    <View style={styles.badges}><Badge label={label(item.role)} /><Badge label={item.suspended ? t('Suspended') : t('Active')} danger={!!item.suspended} /></View>
                    {!!item.suspended && !!item.suspensionReason && <Text style={styles.secondary}>{item.suspensionReason}</Text>}</View>
                  {item.role !== 'admin' && item.id !== user?.uid && <Button title={item.suspended ? t('Reinstate') : t('Suspend')} danger={!item.suspended}
                    onPress={() => openAction({ kind: item.suspended ? 'reinstate' : 'suspend', id: item.id, name: item.fullName || item.email || item.id })} />}</View>;
              }
              if (panel === 'applications') {
                const item = row as Application;
                const date = item.createdAt?.toDate?.();
                return <View key={item.id} style={styles.row}><View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.gigTitle || item.gigId}</Text>
                  <Text style={styles.secondary}>{t('Applicant')}: {item.youthName || item.youthId}</Text>
                  <Text style={styles.secondary}>{t('Business')}: {item.businessName || item.businessId}</Text>
                  <View style={styles.badges}><Badge label={t(item.status)} />{date && <Text style={styles.secondary}>{formatDate(date)}</Text>}</View>
                  <Text style={styles.secondary}>{item.message}</Text>
                  <Text style={styles.secondary}>{t('Availability confirmed')}: {item.availabilityConfirmed ? t('Yes') : t('No')}</Text>
                  <Text selectable style={styles.recordId}>{item.id}</Text>
                </View></View>;
              }
              const item = row as Gig;
              return <View key={item.id} style={styles.row}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title || t('Untitled gig')}</Text>
                <Text style={styles.secondary}>{item.postedBy?.fullName || t('Unknown business')} · {item.location || t('Remote')}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: expandedGig === item.id }} onPress={() => setExpandedGig(value => value === item.id ? '' : item.id)}>
                  <Text style={styles.selectedText}>{t('Details')} {expandedGig === item.id ? '−' : '+'}</Text>
                </TouchableOpacity>
                {expandedGig === item.id && <View style={styles.rowCopy}>
                  <Text style={styles.secondary}>{item.description}</Text>
                  <Text style={styles.secondary}>{t('Pay')}: {item.pay} {item.payType === 'hourly' ? t('/hr') : t('Fixed')}</Text>
                  <Text style={styles.secondary}>{item.date} {item.time}</Text>
                </View>}
                <View style={styles.badges}><Badge label={item.moderationRemoved ? t('Removed') : t(item.status)} danger={!!item.moderationRemoved} /><Text style={styles.secondary}>{t('Applications: {{count}}', { count: item.applicantsCount || 0 })}</Text></View>
                {!!item.moderationReason && <Text style={styles.secondary}>{item.moderationReason}</Text>}<Text selectable style={styles.recordId}>{item.id}</Text></View>
                {!item.moderationRemoved && <Button title={t('Remove from discovery')} danger onPress={() => openAction({ kind: 'remove', id: item.id, name: item.title || item.id })} />}</View>;
            })}
            {listLoading && <ActivityIndicator style={styles.loader} color={colors.primary} />}
            {!!listError && <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{t('Could not load records. Please retry.')}</Text><Button title={t('Retry')} onPress={cursor ? loadMore : refresh} /></View>}
            {!listLoading && !listError && !visible.length && <View style={styles.empty}><Ionicons name="search-outline" size={32} color={colors.textMuted} /><Text style={styles.secondary}>{t('No matching records loaded.')}</Text></View>}
            {hasMore && !listLoading && <Button title={t('Load more')} onPress={loadMore} />}
          </View>}
        </ScrollView>
      </View>
    </View>
    <Modal visible={!!action} transparent animationType="fade" onRequestClose={() => { if (!acting) setAction(undefined); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView style={styles.dialog} contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.sectionTitle}>{action?.kind === 'remove' ? t('Remove from discovery') : action?.kind === 'suspend' ? t('Suspend account') : t('Reinstate account')}</Text><Text style={styles.rowTitle}>{action?.name}</Text>
        <Text style={styles.secondary}>{action?.kind === 'remove' ? t('This closes the gig, stops new applications and prevents the business from reopening it. Existing applications are preserved.')
          : action?.kind === 'suspend' ? t('This blocks the member from posting, applying and messaging until reinstated.') : t('This restores the member’s access to the platform.')}</Text>
        {action?.kind !== 'reinstate' && <TextInput accessibilityLabel={t('Reason')} placeholder={t('Reason (5–500 characters)')} value={reason} onChangeText={setReason} multiline maxLength={500} editable={!acting} style={[styles.input, styles.reason]} />}
        {!!actionError && <Text accessibilityRole="alert" style={styles.error}>{t(actionError)}</Text>}
        <View style={styles.actions}><Button title={t('Cancel')} disabled={acting} onPress={() => setAction(undefined)} /><Button title={t('Confirm')} danger={action?.kind !== 'reinstate'} primary={action?.kind === 'reinstate'} busy={acting} onPress={confirmAction} /></View>
      </ScrollView></KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

function Button({ title, onPress, primary, danger, disabled, busy, icon }: { title: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; busy?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const color = primary ? colors.primaryOnColor : danger ? colors.error : colors.primary;
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }} disabled={disabled || busy} onPress={onPress} style={[styles.button, primary && styles.primaryButton, danger && styles.dangerButton, (disabled || busy) && styles.disabled]}>
    {busy ? <ActivityIndicator color={color} /> : <>{icon && <Ionicons name={icon} size={18} color={color} />}<Text style={[styles.buttonText, { color }]}>{title}</Text></>}
  </TouchableOpacity>;
}
function Badge({ label, danger }: { label: string; danger?: boolean }) {
  return <View style={[styles.badge, danger && styles.dangerButton]}><Text style={[styles.badgeText, danger && styles.error]}>{label}</Text></View>;
}
function SummaryRow({ label, value, total, warning }: { label: string; value: number; total: number; warning?: boolean }) {
  return <View style={styles.summaryRow}><View style={styles.summaryLabels}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowTitle}>{value.toLocaleString()}</Text></View>
    <View style={styles.track}><View style={[styles.progress, { width: `${Math.min(100, total ? value / total * 100 : 0)}%`, backgroundColor: warning ? colors.warning : colors.primary }]} /></View></View>;
}
const styles = StyleSheet.create({
  sidebarText: { color: '#B9BDD8', fontSize: 13, flexShrink: 1 },
  sidebarSelected: { backgroundColor: '#6250C5', borderWidth: 1, borderColor: '#8170DF' },
  sidebarSelectedText: { color: '#FFFFFF', fontWeight: '700', flexShrink: 1 },
  hero: { backgroundColor: '#34305E', borderRadius: 24, padding: 28, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 },
  heroCopy: { flex: 1, minWidth: 180, gap: 12 },
  heroEyebrow: { color: '#C1B5FF', letterSpacing: 2, textTransform: 'uppercase', fontSize: 11, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontFamily: fonts.heading, fontSize: 26, lineHeight: 35, maxWidth: 570 },
  heroCaption: { color: '#D3CFEA', fontSize: 13, lineHeight: 22, maxWidth: 560 },
  heroEmblem: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#4B447A', borderWidth: 1, borderColor: '#69608F', alignItems: 'center', justifyContent: 'center' },
  heroOrb: { position: 'absolute', right: -60, top: -90, width: 300, height: 300, borderRadius: 150, backgroundColor: '#403966' },
  page: { flex: 1, backgroundColor: colors.background }, shell: { flex: 1 }, shellWide: { flexDirection: 'row' }, sidebar: { width: 248, padding: 24, gap: 24, backgroundColor: '#22213C', borderRightWidth: 1, borderColor: colors.surfaceBorder },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandText: { fontFamily: fonts.heading, fontSize: 28, color: '#FFFFFF' }, sidebarNote: { marginTop: 'auto', color: '#B9BDD8', lineHeight: 22 },
  navigation: { gap: 8 }, mobileNavigation: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12 }, navItem: { minHeight: 48, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 12 }, selected: { backgroundColor: colors.primaryLight }, selectedText: { color: colors.primary, fontWeight: '700', flexShrink: 1 },
  main: { flex: 1, minWidth: 0 }, header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, justifyContent: 'space-between', padding: 24, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.surfaceBorder }, headerCopy: { flex: 1, minWidth: 190, gap: 6 }, heading: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  content: { padding: 20, gap: 20, maxWidth: 1250, width: '100%', alignSelf: 'center', paddingBottom: 40 }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, secondary: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, statCard: { flex: 1, minWidth: 130, padding: 22, gap: 12, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.surfaceBorder }, statIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, statValue: { fontFamily: fonts.heading, color: colors.text, fontSize: 32 },
  section: { padding: 24, gap: 18, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.surfaceBorder }, sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.surfaceBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { fontWeight: '600', fontSize: 13, flexShrink: 1 }, primaryButton: { backgroundColor: colors.primary, borderColor: colors.primary }, dangerButton: { backgroundColor: colors.errorLight, borderColor: colors.errorBorder }, disabled: { opacity: 0.5 },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 14, minHeight: 48, color: colors.text, fontSize: 15 }, filters: { gap: 8 }, filter: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surfaceElevated },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: 16, borderWidth: 1, borderRadius: 16, backgroundColor: '#FAFBFF', borderColor: colors.surfaceBorderSubtle }, rowCopy: { flex: 1, minWidth: 160, gap: 6 }, rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text }, avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, badge: { borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: colors.primaryLight }, badgeText: { fontSize: 12, color: colors.primary, fontWeight: '600' }, recordId: { fontSize: 11, color: colors.textMuted },
  summaryRow: { gap: 8 }, summaryLabels: { flexDirection: 'row', justifyContent: 'space-between' }, track: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceElevated }, progress: { height: 7, borderRadius: 4 }, error: { color: colors.error, lineHeight: 22 }, success: { color: colors.success, backgroundColor: colors.successLight, padding: 12, borderRadius: 10 },
  errorBox: { gap: 10, padding: 12, backgroundColor: colors.errorLight, borderRadius: 10 }, loader: { padding: 20 }, empty: { alignItems: 'center', gap: 12, padding: 28 }, overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 }, dialog: { flexGrow: 0, width: '100%', maxWidth: 520, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 20 }, dialogContent: { padding: 24, gap: 20 }, reason: { minHeight: 110, textAlignVertical: 'top' },
});
