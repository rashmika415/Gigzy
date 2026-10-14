export type ReportTargetType = 'user' | 'gig' | 'no-show';

export type ReportReason =
  | 'no-show'
  | 'harassment'
  | 'scam'
  | 'inappropriate'
  | 'underage_safety'
  | 'payment_issue'
  | 'poor_conduct'
  | 'other';

export type ReportStatus = 'pending' | 'in_review' | 'resolved' | 'dismissed';

export type ReportResolutionAction =
  | 'none'
  | 'warning'
  | 'temporary_suspension'
  | 'permanent_suspension'
  | 'gig_removed'
  | 'dismissed';

export interface Report {
  id: string;
  reporterId: string;
  reporterRole: 'client' | 'freelancer' | 'admin';
  reporterName: string;
  reporterEmail?: string;

  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  targetUserName?: string;
  targetGigId?: string;
  targetGigTitle?: string;
  targetApplicationId?: string;

  reason: ReportReason;
  details: string;
  note?: string;

  status: ReportStatus;

  resolutionAction?: ReportResolutionAction;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: any;

  createdAt: any;
  updatedAt?: any;
}

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  targetUserName?: string;
  targetGigId?: string;
  targetGigTitle?: string;
  targetApplicationId?: string;
  reason: ReportReason;
  details: string;
  note?: string;
}

export interface ResolveReportInput {
  reportId: string;
  action: ReportResolutionAction;
  notes: string;
  suspensionDurationDays?: number;
}
