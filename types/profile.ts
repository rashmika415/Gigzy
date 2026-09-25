export interface UserProfileInput {
  fullName: string;
  age?: number;
  phone?: string;
  photoURL?: string;
  
  // Youth-specific fields
  bio?: string;
  skills?: string;
  availability?: string;
  location?: string;

  // Business-specific fields
  businessName?: string;
  businessCategory?: string;
  businessDetails?: string;
  address?: string;
}

export interface ProfileValidationErrors {
  fullName?: string;
  age?: string;
  phone?: string;
  bio?: string;
  skills?: string;
  availability?: string;
  businessName?: string;
  businessCategory?: string;
  businessDetails?: string;
  location?: string;
  address?: string;
  general?: string;
}

export interface SkillBadge {
  id: string;
  label: string;
  icon?: string;
  earnedAt?: unknown;
}

export interface CommunityEndorsement {
  id: string;
  skill: string;
  endorserName: string;
  createdAt?: unknown;
}

export interface ProfileReview {
  id: string;
  authorId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt?: unknown;
}
