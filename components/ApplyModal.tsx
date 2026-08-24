import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';

interface ApplyModalProps {
  visible: boolean;
  gigTitle: string;
  employerName: string;
  onClose: () => void;
  onSubmit: (message: string) => void;
}

export default function ApplyModal({ visible, gigTitle, employerName, onClose, onSubmit }: ApplyModalProps) {
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMessage('');
      setSubmitted(false);
    }
  }, [visible]);

  const handleSubmit = () => {
    onSubmit(message.trim());
    setSubmitted(true);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrapper}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {submitted ? (
            <View style={styles.successState}>
              <View style={styles.successIcon}>
                <MaterialIcons name="check" size={28} color={colors.primaryOnColor} />
              </View>
              <Text style={styles.successTitle}>Application sent!</Text>
              <Text style={styles.successText}>
                {employerName} will review your application and get back to you soon.
              </Text>
              <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.9}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Apply for this gig</Text>
              <Text style={styles.subtitle}>{gigTitle} · {employerName}</Text>

              <Text style={styles.label}>MESSAGE (OPTIONAL)</Text>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Tell them why you're a good fit…"
                placeholderTextColor={colors.placeholder}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.9}>
                <Text style={styles.submitText}>Send application</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceBorder,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  messageInput: {
    minHeight: 96,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  submitButton: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.primaryOnColor,
  },

  successState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  successTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  successText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneButton: {
    width: '100%',
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  doneText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.primaryOnColor,
  },
});
