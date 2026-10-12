// Shared warm-white and teal design tokens for Gigzy.

export const colors = {
  background: '#FAF9F6',
  surface: '#FFFFFF',
  surfaceElevated: '#F3F6F3',
  surfaceBorder: '#DFE7E2',
  surfaceBorderSubtle: '#ECF0EC',
  surfaceHover: '#E7F4EF',

  primary: '#087F73',
  primaryDark: '#06665D',
  primaryLight: '#E7F4EF',
  primaryGlow: 'rgba(8, 127, 115, 0.10)',
  primaryOnColor: '#FFFFFF',

  accent: '#2C4968',
  accentLight: '#EDF2F8',

  text: '#172B27',
  textSecondary: '#61716B',
  textMuted: '#6B7B74',
  placeholder: '#788780',

  error: '#B42318',
  errorText: '#B42318',
  errorLight: '#FFF1EE',
  errorBorder: '#F3C5BD',

  success: '#147D54',
  successLight: '#EAF6EF',

  warning: '#986000',
  warningLight: '#FFF5DF',
  overlay: 'rgba(23, 43, 39, 0.42)',

  inputBg: '#FFFFFF',
  inputBorder: '#DFE7E2',
  inputBorderFocus: '#087F73',
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
};
