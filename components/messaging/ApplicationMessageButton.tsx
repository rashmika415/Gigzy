import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, borderRadius, spacing } from '../../constants/theme';
import { createConversation } from '../../services/messaging/conversationService';

interface ApplicationMessageButtonProps {
  applicationId: string;
  gigId: string;
  youthId: string;
  businessId: string;
  status: 'accepted' | 'pending' | 'rejected' | string;
  currentRole: 'freelancer' | 'client' | string;
  gigTitle?: string;
  gigPay?: number;
  youthName?: string;
  businessName?: string;
  onSuccess?: (conversationId: string) => void;
}

export default function ApplicationMessageButton({
  applicationId,
  gigId,
  youthId,
  businessId,
  status,
  currentRole,
  gigTitle,
  gigPay,
  youthName,
  businessName,
  onSuccess,
}: ApplicationMessageButtonProps) {
  const [loading, setLoading] = useState(false);

  const isAccepted = status.toLowerCase() === 'accepted';
  const isBusiness = currentRole === 'client';
  const buttonLabel = isBusiness ? 'Message Applicant' : 'Message Business';

  const handleOpenConversation = async () => {
    if (!isAccepted) {
      Alert.alert(
        'Messaging Unavailable',
        'Direct messaging opens once the application is accepted by the business.'
      );
      return;
    }

    setLoading(true);
    try {
      const conv = await createConversation({
        applicationId,
        gigId,
        youthId,
        businessId,
        gigTitle,
        gigPay,
        youthName,
        businessName,
        initialMessage: `Application for "${gigTitle || 'Gig'}" accepted. Start chatting here.`,
      });

      if (onSuccess) {
        onSuccess(conv.id);
      } else {
        router.push({
          pathname: '/(app)/chat/[id]',
          params: { id: conv.id },
        } as any);
      }
    } catch (err: any) {
      Alert.alert('Conversation Error', err.message || 'Could not start conversation.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAccepted) {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
        <Text style={styles.lockedText}>Messaging unlocks upon acceptance</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleOpenConversation}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryOnColor} />
      ) : (
        <>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.primaryOnColor} />
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: 8,
  },
  buttonText: {
    color: colors.primaryOnColor,
    fontSize: 14,
    fontWeight: '700',
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
  },
  lockedText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
