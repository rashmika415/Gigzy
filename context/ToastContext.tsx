import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/LocalizedText';
import { translate } from '../localization/i18n';
import { colors, borderRadius, spacing, shadows, typography } from '../constants/theme';

// Non-blocking feedback for success and error messages. Confirmations that need
// a decision (delete, discard, accept) still use Alert.alert.
export type ToastType = 'success' | 'error' | 'info';
interface ToastOptions { type?: ToastType; title: string; message?: string; duration?: number }
interface ToastState extends Required<Omit<ToastOptions, 'message'>> { id: number; message?: string }

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

const TONE: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string }> = {
  success: { icon: 'checkmark-circle', color: colors.success, bg: colors.successLight, border: colors.successBorder },
  error: { icon: 'alert-circle', color: colors.error, bg: colors.errorLight, border: colors.errorBorder },
  info: { icon: 'information-circle', color: colors.primary, bg: colors.primaryLight, border: colors.primaryBorder },
};
const useNativeDriver = Platform.OS !== 'web';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ type: 'info', duration: 3500, ...options, id: nextId.current });
    AccessibilityInfo.announceForAccessibility([options.title, options.message].filter(Boolean).join('. '));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} onHide={() => setToast(current => current?.id === toast.id ? null : current)} />}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onHide }: { toast: ToastState; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const tone = TONE[toast.type];

  const hide = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver }).start(onHide);
  }, [progress, onHide]);

  useEffect(() => {
    Animated.spring(progress, { toValue: 1, useNativeDriver, friction: 8, tension: 80 }).start();
    const timer = setTimeout(hide, toast.duration);
    return () => clearTimeout(timer);
  }, [progress, hide, toast.duration]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      <Animated.View style={[styles.toast, { backgroundColor: tone.bg, borderColor: tone.border, opacity: progress, transform: [{ translateY }] }]}>
        <Pressable style={styles.row} onPress={hide} accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityHint={translate("Dismiss")}>
          <Ionicons name={tone.icon} size={22} color={tone.color} />
          <View style={styles.textBlock}>
            <Text style={styles.title}>{toast.title}</Text>
            {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return useMemo(() => ({
    show,
    success: (title: string, message?: string) => show({ type: 'success', title, message }),
    error: (title: string, message?: string) => show({ type: 'error', title, message }),
    info: (title: string, message?: string) => show({ type: 'info', title, message }),
  }), [show]);
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 56,
  },
  textBlock: { flex: 1, gap: 2 },
  title: { ...typography.title, fontSize: 15, color: colors.text },
  message: { ...typography.bodySmall, color: colors.textSecondary },
});
