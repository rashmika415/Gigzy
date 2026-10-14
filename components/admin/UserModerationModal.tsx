import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../LocalizedText';
import { colors, fonts } from '../../constants/theme';
import {
  fetchUserModerationHistory,
  issueUserWarning,
  setUserSuspension,
  type AdminUser,
  type ModerationEvent,
  type SuspensionType,
} from '../../services/adminService';

const DURATIONS = [1, 3, 7, 14, 30];
const message = (error: unknown) => error instanceof Error ? error.message : 'Could not save moderation action. Please retry.';
const eventLabel = (type: ModerationEvent['type']) => ({
  warning: 'Warning', temporary_suspension: 'Temporary suspension', permanent_suspension: 'Permanent suspension', reinstated: 'Reinstated',
}[type]);
const dateText = (value: unknown) => {
  const date = (value as { toDate?: () => Date } | undefined)?.toDate?.();
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '';
};

export default function UserModerationModal({ user, onClose, onChanged }: { user?: AdminUser; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [suspensionType, setSuspensionType] = useState<SuspensionType>('temporary');
  const [durationDays, setDurationDays] = useState(7);
  const [history, setHistory] = useState<ModerationEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchUserModerationHistory(user.id).then(items => { if (active) setHistory(items); }, failure => { if (active) setError(message(failure)); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [user]);

  const run = async (kind: 'warning' | 'suspend' | 'reinstate') => {
    if (!user || acting) return;
    setActing(true); setError('');
    try {
      if (kind === 'warning') await issueUserWarning(user.id, reason);
      else if (kind === 'suspend') await setUserSuspension(user.id, true, reason, { type: suspensionType, durationDays });
      else await setUserSuspension(user.id, false, '');
      onChanged(); onClose();
    } catch (failure) { setError(message(failure)); }
    finally { setActing(false); }
  };

  return <Modal visible={!!user} transparent animationType="fade" onRequestClose={() => { if (!acting) onClose(); }}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.dialog} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><View style={styles.icon}><Ionicons name="shield-outline" size={22} color={colors.primary} /></View><View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{t('User moderation')}</Text><Text style={styles.name}>{user?.fullName || user?.businessName || user?.email}</Text>
        </View><TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Close')} disabled={acting} onPress={onClose} style={styles.close}><Ionicons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity></View>

        <View style={styles.summary}><Text style={styles.label}>{user?.suspended ? t('Currently suspended') : t('Account is active')}</Text>
          <Text style={styles.secondary}>{t('Warnings: {{count}}', { count: user?.warningCount ?? 0 })}</Text>
          {!!user?.suspensionReason && <Text style={styles.secondary}>{user.suspensionReason}</Text>}
          {user?.suspensionType === 'temporary' && <Text style={styles.secondary}>{t('Suspended until')}: {dateText(user.suspendedUntil)}</Text>}
        </View>

        {!user?.suspended && <>
          <TextInput accessibilityLabel={t('Moderation reason')} placeholder={t('Reason (5–500 characters)')} value={reason} onChangeText={setReason} maxLength={500} multiline editable={!acting} style={[styles.input, styles.reason]} />
          <View style={styles.actions}><ActionButton title={t('Issue warning')} icon="warning-outline" disabled={acting} onPress={() => run('warning')} />
            <ActionButton title={t('Suspend account')} icon="ban-outline" danger disabled={acting} onPress={() => run('suspend')} /></View>
          <Text style={styles.label}>{t('Suspension type')}</Text><View style={styles.choices}>{(['temporary', 'permanent'] as SuspensionType[]).map(type =>
            <TouchableOpacity key={type} accessibilityRole="radio" accessibilityState={{ checked: suspensionType === type }} onPress={() => setSuspensionType(type)} style={[styles.choice, suspensionType === type && styles.selected]}><Text style={suspensionType === type ? styles.selectedText : styles.secondary}>{t(type === 'temporary' ? 'Temporary' : 'Permanent')}</Text></TouchableOpacity>)}</View>
          {suspensionType === 'temporary' && <><Text style={styles.label}>{t('Duration')}</Text><View style={styles.choices}>{DURATIONS.map(days =>
            <TouchableOpacity key={days} accessibilityRole="radio" accessibilityState={{ checked: durationDays === days }} onPress={() => setDurationDays(days)} style={[styles.choice, durationDays === days && styles.selected]}><Text style={durationDays === days ? styles.selectedText : styles.secondary}>{t('{{count}} days', { count: days })}</Text></TouchableOpacity>)}</View></>}
        </>}
        {user?.suspended && <ActionButton title={t('Reinstate account')} icon="checkmark-circle-outline" primary disabled={acting} onPress={() => run('reinstate')} />}
        {acting && <ActivityIndicator color={colors.primary} />}{!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}

        <View style={styles.history}><Text style={styles.title}>{t('Moderation history')}</Text>
          {historyLoading ? <ActivityIndicator color={colors.primary} /> : !history.length ? <Text style={styles.secondary}>{t('No moderation actions yet.')}</Text> : history.map(item =>
            <View key={item.id} style={styles.historyRow}><View style={[styles.dot, item.type === 'warning' && styles.warningDot]} /><View style={styles.copy}><Text style={styles.name}>{t(eventLabel(item.type))}</Text><Text style={styles.secondary}>{item.reason}</Text><Text style={styles.meta}>{dateText(item.createdAt)} · {item.actorId}</Text></View></View>)}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function ActionButton({ title, icon, onPress, disabled, danger, primary }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; danger?: boolean; primary?: boolean }) {
  const color = primary ? colors.primaryOnColor : danger ? colors.error : colors.primary;
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primaryButton, danger && styles.dangerButton, disabled && styles.disabled]}><Ionicons name={icon} size={18} color={color} /><Text style={[styles.buttonText, { color }]}>{title}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 18 }, dialog: { flexGrow: 0, width: '100%', maxWidth: 620, maxHeight: '92%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 20 }, content: { padding: 22, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, gap: 4 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 19, fontFamily: fonts.heading, color: colors.text }, name: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text },
  summary: { gap: 5, padding: 13, borderRadius: 12, backgroundColor: colors.surfaceElevated }, label: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.text }, secondary: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }, meta: { color: colors.textMuted, fontSize: 11 },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 14, color: colors.text, fontSize: 14 }, reason: { minHeight: 96, textAlignVertical: 'top' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 20, backgroundColor: colors.surfaceElevated }, selected: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder }, selectedText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 13 },
  button: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.surfaceBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { fontFamily: fonts.bodySemiBold, fontSize: 13 }, primaryButton: { backgroundColor: colors.primary, borderColor: colors.primary }, dangerButton: { backgroundColor: colors.errorLight, borderColor: colors.errorBorder }, disabled: { opacity: 0.5 }, error: { color: colors.error, lineHeight: 20 },
  history: { gap: 12, paddingTop: 6 }, historyRow: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderColor: colors.surfaceBorderSubtle }, dot: { width: 9, height: 9, marginTop: 5, borderRadius: 5, backgroundColor: colors.error }, warningDot: { backgroundColor: colors.warning },
});
