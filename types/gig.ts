export type PayType = 'fixed' | 'hourly';
export type LocationType = 'remote' | 'on-site' | 'hybrid';
export type GigStatus = 'open' | 'in-progress' | 'completed' | 'cancelled';

export interface GigCategory {
  id: string;
  name: string;
  icon: string;
}

export const GIG_CATEGORIES: GigCategory[] = [
  { id: 'tech', name: 'Tech & IT', icon: 'code-slash-outline' },
  { id: 'design', name: 'Design & Creative', icon: 'color-palette-outline' },
  { id: 'marketing', name: 'Marketing & Sales', icon: 'trending-up-outline' },
  { id: 'writing', name: 'Writing & Translation', icon: 'document-text-outline' },
  { id: 'trades', name: 'Trades & Repair', icon: 'hammer-outline' },
  { id: 'delivery', name: 'Delivery & Logistics', icon: 'car-outline' },
  { id: 'events', name: 'Events & Hospitality', icon: 'wine-outline' },
  { id: 'admin', name: 'Admin & Office', icon: 'briefcase-outline' },
  { id: 'other', name: 'Other Services', icon: 'grid-outline' },
];

export interface Gig {
  id: string;
  title: string;
  description: string;
  category: string;
  pay: number;
  payType: PayType;
  date: string;
  location: string;
  locationType: LocationType;
  skills: string[];
  status: GigStatus;
  postedBy: {
    uid: string;
    fullName: string;
    email: string;
  };
  applicantsCount: number;
  viewsCount?: number;
  searchKeywords?: string[];
  createdAt: any;
  updatedAt?: any;
}

export interface GigInput {
  title: string;
  description: string;
  category: string;
  pay: string; // Form input string, parsed to number on submit
  payType: PayType;
  date: string;
  location: string;
  locationType: LocationType;
  skills: string[];
}

export interface GigValidationErrors {
  title?: string;
  description?: string;
  category?: string;
  pay?: string;
  payType?: string;
  date?: string;
  location?: string;
  locationType?: string;
  skills?: string;
  general?: string;
  [key: string]: string | undefined;
}

export interface GigCreationResult {
  success: boolean;
  gigId?: string;
  error?: string;
}

export type GigSortOption = 'newest' | 'oldest' | 'pay-high' | 'pay-low' | 'applicants';

export interface BusinessGigStats {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  totalBudget: number;
  totalApplicants: number;
}

export interface GigFilterOptions {
  status?: GigStatus | 'all';
  category?: string;
  searchQuery?: string;
  sortBy?: GigSortOption;
}

