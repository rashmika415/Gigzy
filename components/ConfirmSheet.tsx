import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './LocalizedText';
import { borderRadius, colors, shadows, spacing, typography } from '../constants/theme';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Label for the confirming action, e.g. "Delete" */
  confirmLabel: string;
  cancelLabel?: string;
  /** Red styling for irreversible actions */
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Shows a spinner on the confirm button and blocks dismissal */
  loading?: boolean;
  /** Inline error shown above the buttons, e.g. after a failed request */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Themed replacement for Alert.alert confirmations. Works the same on iOS, Android and web. */
export default function ConfirmSheet({
  visible, title, message, confirmLabel, cancelLabel = 'Cancel', destructive = false,
  icon, loading = false, error, onConfirm, onCancel,
}: ConfirmSheetProps) {
  const { t } = useTranslation();
  const tone = destructive ? colors.error : colors.primary;
  const close = () => { if (!loading) onCancel(); };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t(cancelLabel)} />
      <View style={styles.dialog} accessibilityViewIsModal>
        {icon && <View style={[styles.icon, { backgroundColor: destructive ? colors.errorLight : colors.primaryLight }]}>
          <Ionicons name={icon} size={24} color={tone} />
        </View>}
        <Text accessibilityRole="header" style={styles.title}>{t(title)}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
        <View style={styles.actions}>
          <Pressable onPress={close} disabled={loading} accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>{t(cancelLabel)}</Text>
          </Pressable>
          <Pressable onPress={onConfirm} disabled={loading} accessibilityRole="button" accessibilityState={{ busy: loading }}
            style={({ pressed }) => [styles.button, { backgroundColor: tone }, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator color={colors.primaryOnColor} /> : <Text style={styles.confirmText}>{t(confirmLabel)}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, gap: spacing.sm, ...shadows.card },
  icon: { width: 48, height: 48, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  title: { ...typography.h3, color: colors.text },
  message: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.error },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, minHeight: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  cancel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  cancelText: { ...typography.title, fontSize: 15, color: colors.text },
  confirmText: { ...typography.title, fontSize: 15, color: colors.primaryOnColor },
  pressed: { opacity: 0.8 },
});
