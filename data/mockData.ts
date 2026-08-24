// Static demo data for the LocalWorks frontend prototype.
// No backend reads/writes — screens mutate local React state only.

export type Category = 'cafe' | 'retail' | 'events' | 'tutoring' | 'delivery' | 'ngo';

export const CATEGORY_LABEL: Record<Category, string> = {
  cafe: 'Cafe/Food',
  retail: 'Retail',
  events: 'Events',
  tutoring: 'Tutoring',
  delivery: 'Delivery',
  ngo: 'NGO',
};

export const CATEGORY_ICON: Record<Category, string> = {
  cafe: 'local-cafe',
  retail: 'storefront',
  events: 'celebration',
  tutoring: 'school',
  delivery: 'pedal-bike',
  ngo: 'volunteer-activism',
};

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

export interface Gig {
  id: string;
  title: string;
  category: Category;
  employerName: string;
  employerRating: number;
  employerReviews: number;
  employerVerified: boolean;
  location: string;
  distanceKm: number;
  pay: number;
  payRate: 'day' | 'hour';
  schedule: string;
  dateLabel: string;
  timeLabel: string;
  description: string;
  requirements: string[];
  postedDaysAgo: number;
}

export const MOCK_GIGS: Gig[] = [
  {
    id: 'g1',
    title: 'Weekend barista helper',
    category: 'cafe',
    employerName: 'Sunrise Cafe',
    employerRating: 4.6,
    employerReviews: 23,
    employerVerified: true,
    location: 'Negombo',
    distanceKm: 1.2,
    pay: 2500,
    payRate: 'day',
    schedule: 'Sat 9am–2pm',
    dateLabel: 'Sat 13 Sep',
    timeLabel: '9:00 am – 2:00 pm',
    description:
      'Help our morning team during the weekend rush. You will take orders, prepare simple drinks and keep the counter tidy. No experience needed — we will train you on the day.',
    requirements: ['Available Saturday mornings', 'Comfortable talking to customers', 'Basic English or Sinhala'],
    postedDaysAgo: 1,
  },
  {
    id: 'g2',
    title: 'Event setup crew (2 days)',
    category: 'events',
    employerName: 'Coastal Events',
    employerRating: 4.8,
    employerReviews: 41,
    employerVerified: true,
    location: 'Negombo',
    distanceKm: 3.0,
    pay: 3000,
    payRate: 'day',
    schedule: '12–13 Sep',
    dateLabel: 'Fri 12 – Sat 13 Sep',
    timeLabel: '7:00 am – 4:00 pm',
    description:
      'Set up chairs, tables and decorations for a wedding weekend. Physical work, small team, friendly organisers. Lunch provided both days.',
    requirements: ['Able to lift 15kg', 'Available both days', 'Own transport to venue'],
    postedDaysAgo: 2,
  },
  {
    id: 'g3',
    title: 'Shop assistant – evenings',
    category: 'retail',
    employerName: 'Nimal Stores',
    employerRating: 4.2,
    employerReviews: 12,
    employerVerified: false,
    location: 'Negombo',
    distanceKm: 0.8,
    pay: 1800,
    payRate: 'day',
    schedule: 'Mon–Fri 5–9pm',
    dateLabel: 'Starts Mon 15 Sep',
    timeLabel: '5:00 pm – 9:00 pm',
    description:
      'Restock shelves, help customers find items and run the till in the evenings after school. Ongoing weekday shifts.',
    requirements: ['Available weekday evenings', 'Basic maths for the till', 'Friendly and reliable'],
    postedDaysAgo: 3,
  },
  {
    id: 'g4',
    title: 'Maths tutor (Grade 8)',
    category: 'tutoring',
    employerName: 'BrightPath Centre',
    employerRating: 4.9,
    employerReviews: 30,
    employerVerified: true,
    location: 'Negombo',
    distanceKm: 2.1,
    pay: 1500,
    payRate: 'hour',
    schedule: 'Sun 10am–12pm',
    dateLabel: 'Sun 14 Sep',
    timeLabel: '10:00 am – 12:00 pm',
    description:
      'Small-group tuition for three Grade 8 students, covering the current school syllabus. Materials are provided.',
    requirements: ['Strong grade 10+ maths', 'Patient with younger students', 'Available Sunday mornings'],
    postedDaysAgo: 1,
  },
  {
    id: 'g5',
    title: 'Weekend delivery rider',
    category: 'delivery',
    employerName: 'QuickDash Logistics',
    employerRating: 4.4,
    employerReviews: 58,
    employerVerified: true,
    location: 'Negombo',
    distanceKm: 4.5,
    pay: 2200,
    payRate: 'day',
    schedule: 'Sat–Sun 10am–6pm',
    dateLabel: 'Sat 13 – Sun 14 Sep',
    timeLabel: '10:00 am – 6:00 pm',
    description:
      'Deliver food and parcel orders around Negombo on weekends. Fuel allowance included on top of the daily rate.',
    requirements: ['Own bicycle or scooter', 'Smartphone with data', 'Knows the local area'],
    postedDaysAgo: 4,
  },
  {
    id: 'g6',
    title: 'Beach cleanup volunteer lead',
    category: 'ngo',
    employerName: 'Green Wave NGO',
    employerRating: 4.7,
    employerReviews: 15,
    employerVerified: true,
    location: 'Negombo',
    distanceKm: 1.9,
    pay: 1000,
    payRate: 'day',
    schedule: 'Sun 7–10am',
    dateLabel: 'Sun 14 Sep',
    timeLabel: '7:00 am – 10:00 am',
    description:
      'Lead a small group of volunteers for our monthly beach cleanup. Stipend covers transport and refreshments.',
    requirements: ['Comfortable speaking to a group', 'Early riser', 'Passionate about the environment'],
    postedDaysAgo: 6,
  },
];

export interface Application {
  id: string;
  gigId: string;
  status: ApplicationStatus;
  appliedDaysAgo: number;
  message: string;
}

export const MOCK_APPLICATIONS: Application[] = [
  { id: 'app1', gigId: 'g1', status: 'pending', appliedDaysAgo: 0, message: 'I love coffee and I am free every Saturday morning!' },
  { id: 'app2', gigId: 'g4', status: 'accepted', appliedDaysAgo: 2, message: 'I got an A for maths last term and have tutored my younger cousin before.' },
  { id: 'app3', gigId: 'g3', status: 'rejected', appliedDaysAgo: 5, message: 'I can start any weekday evening this month.' },
  { id: 'app4', gigId: 'g5', status: 'pending', appliedDaysAgo: 1, message: 'I have my own scooter and know Negombo well.' },
];

export const YOUTH_PROFILE = {
  name: 'Amaya Silva',
  age: 19,
  location: 'Negombo, Western Province',
  bio: 'Second-year student looking for flexible weekend and evening gigs around Negombo.',
  rating: 4.8,
  reviewCount: 9,
  gigsCompleted: 12,
  skills: ['Customer service', 'Basic English & Sinhala', 'Reliable & punctual', 'Cash handling'],
  availability: ['Weekends', 'Evenings'],
};

export interface BusinessGig {
  id: string;
  title: string;
  category: Category;
  status: 'open' | 'closed';
  pay: number;
  payRate: 'day' | 'hour';
  schedule: string;
  applicantCount: number;
  postedDaysAgo: number;
}

export const MOCK_BUSINESS_GIGS: BusinessGig[] = [
  { id: 'g1', title: 'Weekend barista helper', category: 'cafe', status: 'open', pay: 2500, payRate: 'day', schedule: 'Sat 9am–2pm', applicantCount: 5, postedDaysAgo: 1 },
  { id: 'bg2', title: 'Holiday sale cashier', category: 'retail', status: 'closed', pay: 2000, payRate: 'day', schedule: 'Daily 10am–6pm', applicantCount: 8, postedDaysAgo: 14 },
  { id: 'bg3', title: 'Weekday cleaning crew', category: 'cafe', status: 'open', pay: 1600, payRate: 'day', schedule: 'Mon–Fri 6–8am', applicantCount: 2, postedDaysAgo: 3 },
];

export interface Applicant {
  id: string;
  gigId: string;
  gigTitle: string;
  name: string;
  age: number;
  rating: number;
  reviewCount: number;
  skills: string[];
  availability: string[];
  appliedDaysAgo: number;
  message: string;
  status: ApplicationStatus;
}

export const MOCK_APPLICANTS: Applicant[] = [
  { id: 'ap1', gigId: 'g1', gigTitle: 'Weekend barista helper', name: 'Amaya Silva', age: 19, rating: 4.8, reviewCount: 9, skills: ['Customer service', 'Cash handling'], availability: ['Weekends'], appliedDaysAgo: 0, message: 'I love coffee and I am free every Saturday morning!', status: 'pending' },
  { id: 'ap2', gigId: 'g1', gigTitle: 'Weekend barista helper', name: 'Kasun Perera', age: 20, rating: 4.5, reviewCount: 6, skills: ['Barista experience', 'Punctual'], availability: ['Weekends', 'Evenings'], appliedDaysAgo: 1, message: 'I worked at a cafe last summer and can start immediately.', status: 'pending' },
  { id: 'ap3', gigId: 'g1', gigTitle: 'Weekend barista helper', name: 'Nadeesha Fonseka', age: 18, rating: 4.9, reviewCount: 11, skills: ['Fast learner', 'Friendly'], availability: ['Weekends'], appliedDaysAgo: 1, message: 'Available all day Saturday, live 10 minutes away.', status: 'accepted' },
  { id: 'ap4', gigId: 'g1', gigTitle: 'Weekend barista helper', name: 'Tharindu Jayasuriya', age: 21, rating: 4.1, reviewCount: 3, skills: ['Cash handling'], availability: ['Weekends'], appliedDaysAgo: 2, message: 'I can help with setup and cleanup too.', status: 'rejected' },
  { id: 'ap5', gigId: 'bg3', gigTitle: 'Weekday cleaning crew', name: 'Ishara Bandara', age: 17, rating: 4.6, reviewCount: 4, skills: ['Detail oriented', 'Early riser'], availability: ['Weekday mornings'], appliedDaysAgo: 0, message: 'I live nearby and can start this week.', status: 'pending' },
];

export const BUSINESS_PROFILE = {
  name: 'Sunrise Cafe',
  category: 'cafe' as Category,
  verified: true,
  rating: 4.6,
  reviewCount: 23,
  location: 'Negombo, Western Province',
  about: 'A neighbourhood cafe serving coffee, breakfast and light meals since 2019. We regularly hire local youth for weekend and holiday shifts.',
  address: '14 Lewis Place, Negombo',
  gigsPosted: 9,
  totalHires: 21,
};
