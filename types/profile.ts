export interface UserProfileInput {
  fullName: string;
  phone?: string;
  photoURL?: string;
  
  // Youth-specific fields
  bio?: string;
  skills?: string;
  availability?: string;

  // Business-specific fields
  businessName?: string;
  businessCategory?: string;
  businessDetails?: string;
  location?: string;
}

export interface ProfileValidationErrors {
  fullName?: string;
  phone?: string;
  bio?: string;
  skills?: string;
  availability?: string;
  businessName?: string;
  businessCategory?: string;
  businessDetails?: string;
  location?: string;
  general?: string;
}
