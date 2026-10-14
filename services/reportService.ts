import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';
import type {
  CreateReportInput,
  Report,
  ReportReason,
  ReportResolutionAction,
  ReportStatus,
  ReportTargetType,
  ResolveReportInput,
} from '../types/report';
import {
  issueUserWarning,
  removeGigFromDiscovery,
  setUserSuspension,
} from './adminService';

export const REPORT_PAGE_SIZE = 25;

export const REPORT_REASONS: { key: ReportReason; label: string; description: string }[] = [
  { key: 'no-show', label: 'No-show / Missed agreement', description: 'Counterpart failed to arrive or show up for agreed gig schedule.' },
  { key: 'harassment', label: 'Harassment or abuse', description: 'Offensive language, discrimination, bullying or threats.' },
  { key: 'scam', label: 'Scam or fraud', description: 'Suspicious requests, advance fee demands, or fake gig listings.' },
  { key: 'inappropriate', label: 'Inappropriate content', description: 'Violating community guidelines, inappropriate images or messages.' },
  { key: 'underage_safety', label: 'Safety concern', description: 'Hazardous conditions, unsafe environment, or welfare concerns.' },
  { key: 'payment_issue', label: 'Payment dispute', description: 'Unpaid wages, pay discrepancy, or off-platform payment coercion.' },
  { key: 'poor_conduct', label: 'Unprofessional conduct', description: 'Severe tardiness, dishonesty, or abandonment of duties.' },
  { key: 'other', label: 'Other violation', description: 'Other community guideline violations not listed above.' },
];

function cleanDetails(details: string): string {
  const clean = details.trim();
  if (clean.length < 5 || clean.length > 1000) {
    throw new Error('Please provide details between 5 and 1,000 characters.');
  }
  return clean;
}

function cleanNotes(notes: string): string {
  const clean = notes.trim();
  if (clean.length < 5 || clean.length > 500) {
    throw new Error('Resolution notes must be between 5 and 500 characters.');
  }
  return clean;
}

/**
 * Submit a report against a user, gig, or no-show incident.
 * Open to both business owners and youth freelancers.
 */
export async function submitReport(input: CreateReportInput): Promise<string> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Please sign in to submit a report.');

  const clean = cleanDetails(input.details);
  const cleanNote = typeof input.note === 'string' ? input.note.trim() : '';
  if (cleanNote.length > 1000) {
    throw new Error('Additional note cannot exceed 1,000 characters.');
  }

  // Fetch reporter profile data if available
  let reporterRole: 'client' | 'freelancer' | 'admin' = 'freelancer';
  let reporterName = actor.displayName || 'LocalWorks Member';

  try {
    const userSnap = await getDoc(doc(db, 'users', actor.uid));
    if (userSnap.exists()) {
      const uData = userSnap.data();
      if (uData.role === 'client' || uData.role === 'admin') {
        reporterRole = uData.role;
      }
      reporterName = uData.fullName || uData.businessName || reporterName;
    }
  } catch {
    // Fall back to actor metadata if offline or restricted
  }

  const reportsCol = collection(db, 'reports');
  const payload: any = {
    reporterId: actor.uid,
    reporterRole,
    reporterName,
    reporterEmail: actor.email || '',
    targetType: input.targetType,
    targetId: input.targetId,
    targetUserId: input.targetUserId || (input.targetType === 'user' ? input.targetId : null),
    targetUserName: input.targetUserName || null,
    targetGigId: input.targetGigId || (input.targetType === 'gig' ? input.targetId : null),
    targetGigTitle: input.targetGigTitle || null,
    targetApplicationId: input.targetApplicationId || null,
    reason: input.reason,
    details: clean,
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  if (cleanNote) {
    payload.note = cleanNote;
  }

  const newDocRef = await addDoc(reportsCol, payload);

  // Acknowledgement notification to the reporter
  try {
    const notifCol = collection(db, 'users', actor.uid, 'notifications');
    await addDoc(notifCol, {
      userId: actor.uid,
      type: 'system',
      title: 'Report received',
      body: 'Thank you for keeping our community safe. Our moderation team will review your report.',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if notification creation fails
  }

  return newDocRef.id;
}

/**
 * Submit a no-show incident report.
 * Either party (freelancer or client) can report if the counterpart failed to attend the agreed gig.
 */
export async function submitNoShowReport(params: {
  counterpartId: string;
  counterpartName: string;
  counterpartRole?: 'client' | 'freelancer';
  gigId: string;
  gigTitle: string;
  applicationId?: string;
  details: string;
  note?: string;
}): Promise<string> {
  const clean = cleanDetails(params.details);

  return submitReport({
    targetType: 'no-show',
    targetId: `${params.gigId}_${params.counterpartId}`,
    targetUserId: params.counterpartId,
    targetUserName: params.counterpartName,
    targetGigId: params.gigId,
    targetGigTitle: params.gigTitle,
    targetApplicationId: params.applicationId,
    reason: 'no-show',
    details: clean,
    note: params.note,
  });
}

/**
 * Fetch reports for the admin moderation queue.
 */
export async function fetchReportsQueue(
  filterStatus?: ReportStatus | 'all',
  filterType?: ReportTargetType | 'all',
  cursor?: QueryDocumentSnapshot<DocumentData>,
): Promise<{ reports: Report[]; cursor?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean }> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Administrator access required.');

  const constraints: any[] = [];

  if (filterStatus && filterStatus !== 'all') {
    constraints.push(where('status', '==', filterStatus));
  }
  if (filterType && filterType !== 'all') {
    constraints.push(where('targetType', '==', filterType));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  constraints.push(limit(REPORT_PAGE_SIZE + 1));

  try {
    const snapshot = await getDocsFromServer(query(collection(db, 'reports'), ...constraints));
    const docs = snapshot.docs.slice(0, REPORT_PAGE_SIZE);

    const reports: Report[] = docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<Report, 'id'>),
    }));

    return {
      reports,
      cursor: docs.at(-1),
      hasMore: snapshot.docs.length > REPORT_PAGE_SIZE,
    };
  } catch (err: any) {
    const isIndexError =
      err?.message?.includes('requires an index') ||
      err?.code === 'failed-precondition' ||
      err?.message?.includes('failed-precondition');

    if (isIndexError) {
      try {
        const fallbackSnapshot = await getDocsFromServer(
          query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))
        );
        let list: Report[] = fallbackSnapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<Report, 'id'>),
        }));
        if (filterStatus && filterStatus !== 'all') {
          list = list.filter(r => r.status === filterStatus);
        }
        if (filterType && filterType !== 'all') {
          list = list.filter(r => r.targetType === filterType);
        }
        return {
          reports: list.slice(0, REPORT_PAGE_SIZE),
          cursor: undefined,
          hasMore: false,
        };
      } catch {
        const simpleSnapshot = await getDocsFromServer(query(collection(db, 'reports'), limit(100)));
        let list: Report[] = simpleSnapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<Report, 'id'>),
        }));
        if (filterStatus && filterStatus !== 'all') {
          list = list.filter(r => r.status === filterStatus);
        }
        if (filterType && filterType !== 'all') {
          list = list.filter(r => r.targetType === filterType);
        }
        return {
          reports: list.slice(0, REPORT_PAGE_SIZE),
          cursor: undefined,
          hasMore: false,
        };
      }
    }
    throw err;
  }
}

/**
 * Resolve or dismiss a report as an administrator.
 * Automatically executes the appropriate moderation action (warning, suspension, or gig removal)
 * and updates the report status.
 */
export async function resolveReport(input: ResolveReportInput): Promise<void> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Administrator access required.');

  const adminSnap = await getDoc(doc(db, 'users', actor.uid));
  if (!adminSnap.exists() || adminSnap.data().role !== 'admin' || adminSnap.data().suspended) {
    throw new Error('Administrator access required.');
  }

  const clean = cleanNotes(input.notes);

  const reportRef = doc(db, 'reports', input.reportId);
  const reportSnap = await getDoc(reportRef);
  if (!reportSnap.exists()) {
    throw new Error('This report does not exist.');
  }

  const report = reportSnap.data() as Report;
  const now = serverTimestamp();

  // Execute moderation actions based on the action selected
  if (input.action === 'warning') {
    if (!report.targetUserId) {
      throw new Error('Cannot issue warning: No target user associated with this report.');
    }
    await issueUserWarning(report.targetUserId, clean);
  } else if (input.action === 'temporary_suspension') {
    if (!report.targetUserId) {
      throw new Error('Cannot suspend user: No target user associated with this report.');
    }
    await setUserSuspension(report.targetUserId, true, clean, {
      type: 'temporary',
      durationDays: input.suspensionDurationDays || 7,
    });
  } else if (input.action === 'permanent_suspension') {
    if (!report.targetUserId) {
      throw new Error('Cannot suspend user: No target user associated with this report.');
    }
    await setUserSuspension(report.targetUserId, true, clean, {
      type: 'permanent',
    });
  } else if (input.action === 'gig_removed') {
    const gigId = report.targetGigId || (report.targetType === 'gig' ? report.targetId : null);
    if (!gigId) {
      throw new Error('Cannot remove gig: No target gig associated with this report.');
    }
    await removeGigFromDiscovery(gigId, clean);
  }

  // Determine final status: 'dismissed' if dismissed, otherwise 'resolved'
  const newStatus: ReportStatus = input.action === 'dismissed' ? 'dismissed' : 'resolved';

  await updateDoc(reportRef, {
    status: newStatus,
    resolutionAction: input.action,
    resolutionNotes: clean,
    resolvedBy: actor.uid,
    resolvedAt: now,
    updatedAt: now,
  });

  // Notify the original reporter
  if (report.reporterId) {
    try {
      const notifCol = collection(db, 'users', report.reporterId, 'notifications');
      await addDoc(notifCol, {
        userId: report.reporterId,
        type: 'system',
        title: input.action === 'dismissed' ? 'Report reviewed' : 'Report resolved',
        body: input.action === 'dismissed'
          ? 'Our moderation team reviewed your report and determined no further action is required at this time.'
          : 'Our moderation team has investigated your report and taken appropriate action. Thank you for helping keep LocalWorks safe.',
        read: false,
        createdAt: now,
      });
    } catch {
      // Non-fatal
    }
  }
}
