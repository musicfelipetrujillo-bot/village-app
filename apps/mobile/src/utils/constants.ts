// Design tokens — matches prototype v2
export const COLORS = {
  cream: '#F5F0E8',
  rust: '#B85C38',
  rustDark: '#9A4A2B',
  rustLight: '#D4744F',
  brownDeep: '#2C1A0E',
  brownMid: '#4A2E1A',
  olive: '#5C6B3A',
  oliveLight: '#7A8A50',
  gold: '#C4A35A',
  textDark: '#1C1008',
  textMid: '#5A3E28',
  textLight: '#9A8070',
  white: '#FDFAF5',
  cardBg: '#FFFFFF',
} as const;

export const FONTS = {
  header: 'PlayfairDisplay_400Regular',
  headerBold: 'PlayfairDisplay_700Bold',
  headerItalic: 'PlayfairDisplay_400Regular_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
} as const;

export const NAV_HEIGHT = 72;

export const PREGNANCY_STAGES = [
  'trying',
  'first_trimester',
  'second_trimester',
  'third_trimester',
  'postpartum_0_6mo',
  'postpartum_6_12mo',
  'postpartum_1yr_plus',
] as const;

export const SPECIALIST_TYPES = [
  'ob_gyn',
  'midwife',
  'doula',
  'lactation_consultant',
  'pediatrician',
  'sleep_coach',
  'pelvic_floor_pt',
  'perinatal_dietitian',
  'ppd_therapist',
] as const;

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;

// Crisis resources — always available
export const CRISIS_RESOURCES = {
  mentalHealth: { label: 'Mental health crisis', contact: '988', type: 'call' as const },
  psi: { label: 'PSI Postpartum helpline', contact: '18009444773', type: 'call' as const },
  miamiCrisis: { label: 'Miami-Dade crisis line', contact: '3053584357', type: 'call' as const },
  crisisText: { label: 'Crisis Text Line', contact: '741741', body: 'HOME', type: 'sms' as const },
  emergency: { label: 'Emergency', contact: '911', type: 'call' as const },
};
