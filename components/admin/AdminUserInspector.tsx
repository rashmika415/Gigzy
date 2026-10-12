import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '../LocalizedText';
import { colors } from '../../constants/theme';
import {
  deleteEndorsementAsAdmin,
  deleteReviewAsAdmin,
  fetchAdminUserDetails,
  setBusinessVerification,
  setProfileFlag,
  setSkillBadges,
  setUserSuspension,
  type AdminUser,
  type AdminUserDetails,
} from '../../services/adminService';

type Editor = 'suspend' | 'flag' | 'badges';
const empty: AdminUserDetails = { reviews: [], endorsements: [], pushTokens: [], pushFailures: [] };
const failureMessage = (value: unknown) => value instanceof Error ? value.message : 'The moderation action failed.';

export default function AdminUserInspector({ member, onClose, onChanged }: { member?: AdminUser; onClose: () => void; onChanged: () => void }) {
  const [details, setDetails] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [editor, setEditor] = useState<Editor>();
  const [input, setInput] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!member) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError('');
      try { const value = await fetchAdminUserDetails(member.id); if (active) setDetails(value); }
      catch (value) { if (active) setError(failureMessage(value)); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [member, revision]);

  if (!member) return null;
  const name = member.role === 'client' ? member.businessName || member.fullName : member.fullName;
  const perform = async (key: string, action: () => Promise<unknown>, message: string, reload = false) => {
    if (busy) return;
    setBusy(key); setError(''); setNotice('');
    try {
      await action(); setNotice(message); setEditor(undefined); onChanged();
      if (reload) setRevision(value => value + 1);
    } catch (value) { setError(failureMessage(value)); }
    finally { setBusy(''); }
  };
  const openEditor = (value: Editor) => {
    setEditor(value); setError('');
    setInput(value === 'badges' ? member.skillBadges?.map(badge => badge.label).join(', ') || '' : value === 'flag' ? member.profileFlagReason || '' : member.suspensionReason || '');
  };
  const submitEditor = () => {
    if (editor === 'suspend') void perform('suspend', () => setUserSuspension(member.id, !member.suspended, input), member.suspended ? 'Account reactivated.' : 'Account suspended.');
    if (editor === 'flag') void perform('flag', () => setProfileFlag(member.id, !member.profileFlagged, input), member.profileFlagged ? 'Profile flag cleared.' : 'Profile flagged.');
    if (editor === 'badges') void perform('badges', () => setSkillBadges(member.id, input.split(',')), 'Skill badges updated.');
  };
  const confirmRemove = (kind: 'review' | 'endorsement', id: string) => {
    const execute = () => perform(`${kind}-${id}`, () => kind === 'review' ? deleteReviewAsAdmin(member.id, id) : deleteEndorsementAsAdmin(member.id, id), `${kind === 'review' ? 'Review' : 'Endorsement'} removed.`, true);
    if (Platform.OS === 'web') { if (window.confirm(`Remove this ${kind}?`)) void execute(); }
    else Alert.alert(`Remove ${kind}`, 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void execute(); } }]);
  };

  return <><Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.title}>Profile inspection</Text><Text style={styles.muted}>{member.id}</Text></View><TouchableOpacity accessibilityLabel="Close profile inspector" onPress={onClose} style={styles.iconButton}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>{member.photoURL ? <Image source={{ uri: member.photoURL }} style={styles.photo} /> : <View style={styles.photoFallback}><Text style={styles.initial}>{(name || '?')[0].toUpperCase()}</Text></View>}
          <View style={styles.headerCopy}><View style={styles.inline}><Text style={styles.name}>{name || 'Unnamed user'}</Text>{member.isVerified && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}</View><Text style={styles.muted}>{member.email} · {member.role}</Text><Text style={styles.muted}>{member.phone || 'No phone'} · {member.location || member.address || 'No location'}</Text></View></View>
        {!!notice && <Text style={styles.success}>{notice}</Text>}{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <Action label={member.suspended ? 'Reactivate' : 'Suspend'} icon={member.suspended ? 'play-circle-outline' : 'ban-outline'} danger={!member.suspended} onPress={() => openEditor('suspend')} />
          {member.role === 'client' && <Action label={member.isVerified ? 'Revoke verification' : 'Verify business'} icon="shield-checkmark-outline" onPress={() => void perform('verify', () => setBusinessVerification(member.id, !member.isVerified), 'Verification updated.')} />}
          <Action label={member.profileFlagged ? 'Clear profile flag' : 'Flag profile'} icon="flag-outline" danger={!member.profileFlagged} onPress={() => openEditor('flag')} />
          {member.role === 'freelancer' && <Action label="Manage badges" icon="ribbon-outline" onPress={() => openEditor('badges')} />}
        </View>
        {member.suspended && <Callout title="Suspended" body={member.suspensionReason || 'No reason recorded.'} danger />}
        {member.profileFlagged && <Callout title="Profile flagged" body={member.profileFlagReason || 'No reason recorded.'} danger />}

        <Section title="Identity and profile"><Detail label="Name" value={member.fullName} /><Detail label="Business" value={member.businessName} /><Detail label="Category" value={member.businessCategory} /><Detail label="Age" value={member.age?.toString()} /><Detail label="Availability" value={member.availability} /><Detail label="Bio / description" value={member.role === 'client' ? member.businessDetails : member.bio} /><Detail label="Skills" value={member.skills} /><Detail label="Rating" value={`${member.ratingAverage ?? 0} (${member.ratingCount ?? 0} reviews)`} /></Section>
        <Section title={`Skill badges (${member.skillBadges?.length || 0})`}><View style={styles.tags}>{member.skillBadges?.map(badge => <Tag key={badge.id} label={badge.label} />)}{!member.skillBadges?.length && <Text style={styles.muted}>No badges awarded.</Text>}</View></Section>
        <Section title={`Reviews (${details.reviews.length})`}>{details.reviews.map(review => <ModerationRow key={review.id} title={`${review.authorName || 'Member'} · ${review.rating || 0}/5`} body={review.comment || ''} busy={busy === `review-${review.id}`} onRemove={() => confirmRemove('review', review.id)} />)}{!details.reviews.length && !loading && <Text style={styles.muted}>No reviews.</Text>}</Section>
        <Section title={`Endorsements (${details.endorsements.length})`}>{details.endorsements.map(item => <ModerationRow key={item.id} title={item.skill || 'Endorsement'} body={item.endorserName || item.endorserId || 'Unknown endorser'} busy={busy === `endorsement-${item.id}`} onRemove={() => confirmRemove('endorsement', item.id)} />)}{!details.endorsements.length && !loading && <Text style={styles.muted}>No endorsements.</Text>}</Section>
        <Section title={`Push devices (${details.pushTokens.length})`}>{details.pushTokens.map(token => <View key={token.id} style={styles.row}><Ionicons name="phone-portrait-outline" size={18} color={colors.primary} /><View style={styles.headerCopy}><Text style={styles.rowTitle}>{token.platform || 'Unknown'} · {token.provider || 'Unknown provider'}</Text><Text numberOfLines={1} style={styles.muted}>{token.token || token.id}</Text></View></View>)}{!details.pushTokens.length && !loading && <Text style={styles.muted}>No push tokens registered.</Text>}</Section>
        <Section title={`Delivery failures (${details.pushFailures.length})`}>{details.pushFailures.map(item => <View key={item.id} style={styles.row}><Ionicons name="warning-outline" size={18} color={colors.error} /><View style={styles.headerCopy}><Text style={styles.rowTitle}>{item.code || 'Delivery failed'}</Text><Text style={styles.muted}>{item.message || item.tokenId}</Text></View></View>)}{!details.pushFailures.length && !loading && <Text style={styles.muted}>No recorded delivery failures.</Text>}</Section>
        {loading && <ActivityIndicator color={colors.primary} />}
      </ScrollView>
    </View></View></Modal>
    <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => !busy && setEditor(undefined)}>
      <View style={styles.dialogOverlay}><View style={styles.dialog}><Text style={styles.title}>{editor === 'badges' ? 'Manage skill badges' : editor === 'flag' ? (member.profileFlagged ? 'Clear profile flag' : 'Flag profile') : member.suspended ? 'Reactivate account' : 'Suspend account'}</Text>
        {editor === 'badges' ? <Text style={styles.muted}>Enter comma-separated badge names. Remove a name to revoke that badge.</Text> : <Text style={styles.muted}>{editor === 'flag' ? 'Record why this profile needs moderation.' : 'Record why access is being suspended.'}</Text>}
        {((editor === 'suspend' && !member.suspended) || (editor === 'flag' && !member.profileFlagged) || editor === 'badges') && <TextInput value={input} onChangeText={setInput} multiline style={[styles.input, editor !== 'badges' && styles.reason]} placeholder={editor === 'badges' ? 'Reliable, Fast learner' : 'Reason (5–500 characters)'} maxLength={editor === 'badges' ? 1000 : 500} />}
        {!!error && <Text style={styles.error}>{error}</Text>}<View style={styles.actions}><Action label="Cancel" icon="close" onPress={() => setEditor(undefined)} /><Action label="Confirm" icon="checkmark" busy={!!busy} onPress={submitEditor} /></View>
      </View></View>
    </Modal>
  </>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Detail({ label, value }: { label: string; value?: string }) { return value ? <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value}</Text></View> : null; }
function Tag({ label }: { label: string }) { return <View style={styles.tag}><Text style={styles.tagText}>{label}</Text></View>; }
function Callout({ title, body, danger }: { title: string; body: string; danger?: boolean }) { return <View style={[styles.callout, danger && styles.calloutDanger]}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.muted}>{body}</Text></View>; }
function Action({ label, icon, onPress, danger, busy }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean; busy?: boolean }) { return <TouchableOpacity disabled={busy} onPress={onPress} style={[styles.action, danger && styles.actionDanger]}>{busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={icon} size={17} color={danger ? colors.error : colors.primary} />}<Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text></TouchableOpacity>; }
function ModerationRow({ title, body, onRemove, busy }: { title: string; body: string; onRemove: () => void; busy: boolean }) { return <View style={styles.row}><View style={styles.headerCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.muted}>{body}</Text></View><TouchableOpacity disabled={busy} onPress={onRemove} style={styles.iconButton}>{busy ? <ActivityIndicator color={colors.error} /> : <Ionicons name="trash-outline" size={19} color={colors.error} />}</TouchableOpacity></View>; }

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'flex-end' }, sheet: { width: '100%', maxWidth: 720, height: '100%', backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.surfaceBorder }, headerCopy: { flex: 1, minWidth: 0 }, title: { fontSize: 20, fontWeight: '800', color: colors.text }, iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, gap: 16, paddingBottom: 50 }, identity: { flexDirection: 'row', alignItems: 'center', gap: 14 }, photo: { width: 70, height: 70, borderRadius: 35 }, photoFallback: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, initial: { fontSize: 27, fontWeight: '800', color: colors.primary }, inline: { flexDirection: 'row', alignItems: 'center', gap: 6 }, name: { fontSize: 22, fontWeight: '800', color: colors.text }, muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 10, backgroundColor: colors.surface }, actionDanger: { borderColor: colors.errorBorder, backgroundColor: colors.errorLight }, actionText: { color: colors.primary, fontWeight: '700', fontSize: 13 }, dangerText: { color: colors.error }, section: { padding: 16, gap: 10, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 16, backgroundColor: colors.surface }, sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text }, detail: { gap: 3, paddingVertical: 4 }, detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }, detailValue: { color: colors.text, fontSize: 14, lineHeight: 20 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.primaryLight }, tagText: { color: colors.primary, fontSize: 12, fontWeight: '700' }, row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderTopWidth: 1, borderColor: colors.surfaceBorderSubtle }, rowTitle: { color: colors.text, fontWeight: '700', fontSize: 14 }, callout: { gap: 4, padding: 12, borderRadius: 10, backgroundColor: colors.surfaceElevated }, calloutDanger: { backgroundColor: colors.errorLight }, success: { color: colors.success, backgroundColor: colors.successLight, padding: 10, borderRadius: 9 }, error: { color: colors.error, backgroundColor: colors.errorLight, padding: 10, borderRadius: 9 }, dialogOverlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay }, dialog: { width: '100%', maxWidth: 520, gap: 15, padding: 20, borderRadius: 18, backgroundColor: colors.surface }, input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, color: colors.text }, reason: { minHeight: 110, textAlignVertical: 'top' },
});
