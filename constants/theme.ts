// Shared warm-white and teal design tokens for LocalWorks.

export const colors = {
  background: '#F7F8F8',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F4F3',
  surfaceBorder: '#E6EAE8',
  surfaceBorderSubtle: '#EEF1F0',
  surfaceHover: '#E7F4EF',

  primary: '#087F73',
  primaryDark: '#06665D',
  primaryLight: '#E7F4EF',
  primaryGlow: 'rgba(8, 127, 115, 0.10)',
  primaryBorder: 'rgba(8, 127, 115, 0.25)',
  primaryOnColor: '#FFFFFF',

  accent: '#2C4968',
  accentLight: '#EDF2F8',
  accentBorder: 'rgba(44, 73, 104, 0.25)',

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
  successBorder: 'rgba(20, 125, 84, 0.28)',

  warning: '#986000',
  warningLight: '#FFF5DF',
  warningBorder: 'rgba(152, 96, 0, 0.25)',

  // Completed gigs and other neutral-positive states.
  info: '#5B3CC4',
  infoLight: '#F2EEFC',
  infoBorder: 'rgba(91, 60, 196, 0.25)',

  star: '#E8A317',
  overlay: 'rgba(23, 43, 39, 0.42)',

  inputBg: '#FFFFFF',
  inputBorder: '#E6EAE8',
  inputBorderFocus: '#087F73',
};

// One family (Hanken Grotesk) for all UI text keeps the look calm and sits well
// beside the Noto Sinhala/Tamil fallbacks. Syne is reserved for the wordmark.
export const fonts = {
  brand: 'Syne_700Bold',
  display: 'HankenGrotesk_700Bold',
  heading: 'HankenGrotesk_700Bold',
  headingSemiBold: 'HankenGrotesk_600SemiBold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
};

// Type scale. Custom fonts carry their own weight, so styles set fontFamily
// instead of fontWeight (Android ignores fontWeight on custom families).
// Keep text at 12px or larger so Sinhala and Tamil glyphs stay legible.
export const typography = {
  display: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  h1: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, letterSpacing: -0.1 },
  h3: { fontFamily: fonts.headingSemiBold, fontSize: 18, lineHeight: 24 },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase' as const },
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
