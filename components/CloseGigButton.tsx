import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { borderRadius, colors, spacing } from '../constants/theme';
import { closeGig } from '../services/gigService';
import type { Gig } from '../types/gig';

export default function CloseGigButton({ gig }: { gig: Gig }) {
  const { user, userData } = useAuth();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const canClose = !!user && userData?.role === 'client' && gig.postedBy.uid === user.uid && gig.status === 'open';

  const confirm = async () => {
    if (!canClose || submitting.current) return;
    submitting.current = true;
    setClosing(true);
    setError('');
    try {
      await closeGig(gig.id);
      setVisible(false);
      if (Platform.OS === 'web') window.alert('Gig closed successfully.');
      else Alert.alert('Success', 'Gig closed successfully.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not close gig. Please try again.');
    } finally {
      submitting.current = false;
      setClosing(false);
    }
  };

  if (!canClose && !visible) return null;
  return <>
    {canClose && <TouchableOpacity style={styles.button} accessibilityRole="button" onPress={() => { setError(''); setVisible(true); }}>
      <Ionicons name="lock-closed-outline" size={16} color={colors.error} />
      <Text style={styles.buttonText}>Close Gig</Text>
    </TouchableOpacity>}
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!submitting.current) setVisible(false); }}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Close Gig</Text>
          <Text style={styles.message}>Are you sure you want to close this gig?</Text>
          <Text style={styles.message}>{gig.title}</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.buttonText}>{error}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} disabled={closing} onPress={() => setVisible(false)}>
              <Text style={styles.message}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} disabled={closing || !canClose} onPress={confirm}>
              {closing ? <ActivityIndicator color={colors.error} /> : <Text style={styles.buttonText}>Close Gig</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  buttonText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.xl, gap: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  message: { color: colors.text, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
