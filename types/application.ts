export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export type ApplicationFilterStatus = 'all' | ApplicationStatus;

export interface Application {
  id: string;
  applicationId: string;
  gigId: string;
  youthId: string;
  businessId: string;
  message: string;
  availabilityConfirmed: boolean;
  status: ApplicationStatus;
  createdAt: any;
  updatedAt: any;
  // Gig details snapshot
  gigTitle?: string;
  gigLocation?: string;
  gigDate?: string;
  gigPay?: number;
  gigPayType?: 'hourly' | 'fixed';
  gigCategory?: string;
  businessName?: string;
  // Youth applicant details snapshot
  youthName?: string;
  youthPhotoURL?: string;
  youthSkills?: string[];
  youthBio?: string;
}

export interface CreateApplicationInput {
  gigId: string;
  youthId: string;
  message: string;
  availabilityConfirmed: boolean;
  // Optional pre-fetched gig & youth snapshots for fast querying
  gigTitle?: string;
  gigLocation?: string;
  gigDate?: string;
  gigPay?: number;
  gigPayType?: 'hourly' | 'fixed';
  gigCategory?: string;
  businessId?: string;
  businessName?: string;
  youthName?: string;
  youthPhotoURL?: string;
  youthSkills?: string[];
  youthBio?: string;
}

export interface ApplicationStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  completed: number;
}
