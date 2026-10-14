import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { translate as tr } from '../../localization/i18n';
import { acceptApplication, rejectApplication } from '../../services/applicationService';
import { useToast } from '../../context/ToastContext';
import ConfirmSheet from '../ConfirmSheet';
import type { Application } from '../../types/application';

type Decision = 'accept' | 'reject';

const notify = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(type).catch(() => {});
};

/**
 * Confirm-then-act flow for accepting or rejecting an applicant.
 * Guards against double taps and exposes which application is being processed.
 */
export default function useApplicantDecision(businessId: string, { onAccepted, onRejected }: {
  onAccepted?: (app: Application) => void;
  onRejected?: (app: Application) => void;
} = {}) {
  const toast = useToast();
  const [pending, setPending] = useState<{ app: Application; decision: Decision } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const request = (app: Application, decision: Decision) => {
    if (inFlight.current || app.status !== 'pending') return;
    setError('');
    setPending({ app, decision });
  };

  const confirm = async () => {
    if (!pending || inFlight.current) return;
    const { app, decision } = pending;
    inFlight.current = true;
    setBusyId(app.id);
    setError('');
    try {
      if (decision === 'accept') {
        await acceptApplication(app.id, businessId);
        notify(Haptics.NotificationFeedbackType.Success);
        setPending(null);
        if (onAccepted) onAccepted(app);
        else toast.success(tr('Application Accepted! 🎉'));
      } else {
        await rejectApplication(app.id, businessId);
        notify(Haptics.NotificationFeedbackType.Warning);
        setPending(null);
        toast.success(tr('Application Rejected'), tr('The application has been rejected.'));
        onRejected?.(app);
      }
    } catch (err: any) {
      setError(err?.message || (decision === 'accept' ? 'Failed to accept application.' : 'Failed to reject application.'));
    } finally {
      inFlight.current = false;
      setBusyId(null);
    }
  };

  const name = pending?.app.youthName || tr('this applicant');
  const sheet = <ConfirmSheet
    visible={!!pending}
    destructive={pending?.decision === 'reject'}
    icon={pending?.decision === 'reject' ? 'close-circle-outline' : 'checkmark-circle-outline'}
    title={pending?.decision === 'reject' ? 'Reject Application' : 'Accept Application'}
    message={pending?.decision === 'reject'
      ? tr('Are you sure you want to reject this application from {{value0}}?', { value0: name })
      : tr('Are you sure you want to accept {{value0}} for "{{value1}}"?', { value0: name, value1: pending?.app.gigTitle || tr('this gig') })}
    confirmLabel={pending?.decision === 'reject' ? 'Reject' : 'Accept Applicant'}
    loading={!!busyId}
    error={error}
    onConfirm={confirm}
    onCancel={() => setPending(null)}
  />;

  return { request, busyId, sheet };
}
