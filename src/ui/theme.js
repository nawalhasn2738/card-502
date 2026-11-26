// Design tokens for the whole app. Screens and components read from here so
// the look stays consistent and can be tuned in one place.

export const colors = {
  // Backgrounds
  night: '#070A16',
  ink: '#0B0F1F',
  navy: '#121834',
  navyRaised: '#1A2247',
  navyBorder: 'rgba(255,255,255,0.08)',
  glass: 'rgba(20,26,56,0.72)',
  glassStrong: 'rgba(14,19,42,0.92)',

  // Felt table
  felt: '#0E6B54',
  feltDeep: '#073A2F',
  feltRim: '#C9A55A',

  // Accents
  gold: '#E9C46A',
  goldBright: '#F7DC8F',
  goldDeep: '#B8873A',
  goldInk: '#3A2A08',

  // Text
  text: '#F5F1E6',
  textSoft: '#C7CBE0',
  textMuted: '#8C93B3',
  textDim: '#5E6588',

  // States
  danger: '#FF5D6E',
  dangerDeep: '#B3263A',
  success: '#3DDC97',
  info: '#7AB4FF',
  warning: '#FFB547',

  // Cards
  cardFace: '#FFFBF2',
  cardFaceEdge: '#EDE4D0',
  cardRed: '#D33A3F',
  cardBlack: '#1B2033',
  backA: '#1B2A6B',
  backB: '#0E1641',
};

// Colours for players: gold is always the human; bots take the rest by seat.
export const seatColors = ['#E9C46A', '#7AB4FF', '#FF7E8A', '#5FE3B0', '#C59BFF', '#FFA35C'];

export const fonts = {
  display: 'PlayfairDisplay_800ExtraBold',
  displayBold: 'PlayfairDisplay_700Bold',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  black: 'Outfit_800ExtraBold',
};

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lifted: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  glow: (color) => ({
    shadowColor: color,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  }),
};

// Shared motion timings. Bots act 900 ms after each state change, so every
// game animation finishes well inside that window.
export const motion = {
  fast: 160,
  base: 260,
  fly: 420,
  slow: 600,
};
