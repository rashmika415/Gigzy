// Design tokens for the LocalWorks app
// Dark, teal-accented youth gig-marketplace aesthetic

export const colors = {
  background: '#0D1515',
  surface: '#151D1D',
  surfaceElevated: '#192121',
  surfaceBorder: 'rgba(135, 147, 144, 0.2)',
  surfaceBorderSubtle: 'rgba(61, 73, 70, 0.3)',
  surfaceHover: 'rgba(111, 216, 199, 0.08)',

  primary: '#6FD8C7',
  primaryDark: '#2B9E8F',
  primaryLight: 'rgba(111, 216, 199, 0.15)',
  primaryGlow: 'rgba(111, 216, 199, 0.25)',
  primaryOnColor: '#003731',

  accent: '#2C4968',
  accentLight: 'rgba(44, 73, 104, 0.15)',

  text: '#DCE4E4',
  textSecondary: '#BCC9C5',
  textMuted: '#879390',
  placeholder: '#6B7280',

  error: '#FFB4AB',
  errorText: '#FFDAD6',
  errorLight: 'rgba(147, 0, 10, 0.2)',
  errorBorder: 'rgba(255, 180, 171, 0.5)',

  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.12)',

  inputBg: '#151D1D',
  inputBorder: 'rgba(135, 147, 144, 0.2)',
  inputBorderFocus: '#6FD8C7',
};

export const fonts = {
  display: 'Syne_800ExtraBold',
  heading: 'Syne_700Bold',
  headingSemiBold: 'Syne_600SemiBold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
};
