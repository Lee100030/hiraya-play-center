import { Platform, type TextStyle } from 'react-native';

export const colors = {
  green: '#0B1F14',
  greenMid: '#14301F',
  greenDeep: '#07140D',
  gold: '#C9A227',
  goldSoft: '#f4e7c3',
  cream: '#F4F1E9',
  surface: '#FFFEF8',
  white: '#FFFFFF',
  text: '#1A2E26',
  muted: '#5D6B64',
  placeholder: '#6F7B74',
  line: '#E6DCB8',
  danger: '#C44536',
  dangerSoft: '#FDE8E6',
  success: '#1F7A4D',
  successSoft: '#E4F4EA',
  warn: '#B8860B',
  warnSoft: '#FFF4D6',
  overlay: 'rgba(7, 20, 13, 0.45)',
};

export const space = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};

/** PostScript / load keys — must match `useFonts` in the root layout exactly. */
export const fonts = {
  playfairBold: 'PlayfairDisplay-Bold',
  cormorantBold: 'CormorantGaramond-Bold',
  poppinsRegular: 'Poppins-Regular',
  poppinsSemiBold: 'Poppins-SemiBold',
  poppinsBold: 'Poppins-Bold',
  outfitRegular: 'Outfit-Regular',
} as const;

export const fontAssets = {
  [fonts.playfairBold]: require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
  [fonts.cormorantBold]: require('../assets/fonts/CormorantGaramond-Bold.ttf'),
  [fonts.poppinsRegular]: require('../assets/fonts/Poppins-Regular.ttf'),
  [fonts.poppinsSemiBold]: require('../assets/fonts/Poppins-SemiBold.ttf'),
  [fonts.poppinsBold]: require('../assets/fonts/Poppins-Bold.ttf'),
  [fonts.outfitRegular]: require('../assets/fonts/Outfit-Regular.ttf'),
};

/**
 * Android maps fontWeight onto a family name and will miss the file if we also
 * set 600/700 on an already-weighted face. iOS can keep the semantic weight.
 */
const weight = (value: TextStyle['fontWeight']): TextStyle['fontWeight'] =>
  Platform.OS === 'android' ? 'normal' : value;

export const type = {
  kicker: {
    fontFamily: fonts.poppinsSemiBold,
    fontSize: 11,
    fontWeight: weight('600'),
    color: colors.gold,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontFamily: fonts.playfairBold,
    fontSize: 28,
    fontWeight: weight('700'),
    color: colors.green,
    lineHeight: 34,
  },
  heading: {
    fontFamily: fonts.cormorantBold,
    fontSize: 18,
    fontWeight: weight('700'),
    color: colors.green,
    lineHeight: 24,
  },
  body: {
    fontFamily: fonts.poppinsRegular,
    fontSize: 15,
    fontWeight: weight('400'),
    color: colors.text,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    fontWeight: weight('400'),
    color: colors.muted,
    lineHeight: 20,
  },
  label: {
    fontFamily: fonts.poppinsSemiBold,
    fontSize: 12,
    fontWeight: weight('600'),
    color: colors.green,
    marginBottom: 6,
    letterSpacing: 0.6,
  },
};

export const shadow = {
  card: {
    shadowColor: colors.green,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};
