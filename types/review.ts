export interface Review {
  id: string;
  targetUserId: string;
  targetRole: 'freelancer' | 'client';
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  authorRole: 'freelancer' | 'client';
  rating: number; // 1 to 5
  comment: string;
  tags: string[];
  gigId?: string;
  gigTitle?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface SubmitReviewInput {
  targetUserId: string;
  targetRole: 'freelancer' | 'client';
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  authorRole: 'freelancer' | 'client';
  rating: number; // 1 to 5
  comment: string;
  tags?: string[];
  gigId?: string;
  gigTitle?: string;
}

export const YOUTH_REVIEW_TAGS: string[] = [
  'Punctual',
  'Great Quality',
  'Fast Learner',
  'Hardworking',
  'Polite & Respectful',
  'Great Communication',
  'Exceeded Expectations',
  'Reliable',
];

export const BUSINESS_REVIEW_TAGS: string[] = [
  'Prompt Payment',
  'Clear Instructions',
  'Supportive & Friendly',
  'Fair Compensation',
  'Safe Workplace',
  'Highly Recommended',
  'Respectful',
];
