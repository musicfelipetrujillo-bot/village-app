// Design tokens — matches village-moodboard v3 (Diner/Yolk/Blush/Lime/Ceramic).
// Legacy keys (rust/cream/gold/olive) are aliased to the new palette so the
// 100+ existing screens render with the new tokens automatically; new screens
// should reach for the editorial keys (diner/yolk/blush/lime/ceramic) directly.
export const COLORS = {
  // Editorial palette (canonical)
  // Tan-burnt terracotta (was #E68420 dusty terracotta) — small shift
  // 2026-04-29: hue rotated ~5° toward brown + saturation dropped ~5%
  // so the orange reads as earthier / less neon. Still warm enough to
  // function as the primary CTA accent without competing with
  // photography-led editorial surfaces.
  diner:        '#D87530',  // primary CTA, active tab, hero cards
  dinerDark:    '#A85E1B',
  dinerLight:   '#E1A05B',
  yolk:         '#DEAB44',  // secondary accent, completion checks
  yolkDark:     '#B5862C',
  yolkLight:    '#EDC579',
  blush:        '#F4C5CC',  // tertiary, soft tile bgs
  blushDeep:    '#E89AA5',
  lime:         '#B8C25C',  // tertiary, calm states
  limeDeep:     '#8E9842',
  ceramic:      '#F4ECDF',  // background
  ceramicDeep:  '#E8DCC8',  // card border, subtle shadow base
  brownDeep:    '#2C1A0E',
  brownMid:     '#4A2E1A',
  textDark:     '#1C1008',
  textMid:      '#5A3E28',
  textLight:    '#9A8070',
  white:        '#FFFFFF',
  paper:        '#FDFAF5',  // raised surfaces

  // Legacy aliases (kept until every screen migrates)
  cream:        '#F4ECDF',  // was #F5F0E8 — now ceramic
  rust:         '#D87530',  // was #E68420 dusty terracotta → tan-burnt (2026-04-29)
  rustDark:     '#A85E1B',
  rustLight:    '#E1A05B',
  olive:        '#8E9842',  // was #5C6B3A — now limeDeep
  oliveLight:   '#B8C25C',
  gold:         '#DEAB44',  // was #C4A35A — now yolk (tan-shift 2026-04-29)
  cardBg:       '#FFFFFF',
} as const;

export const FONTS = {
  // Playfair Display — editorial serif (headlines, hero, italic accents)
  header:       'PlayfairDisplay_400Regular',
  headerBold:   'PlayfairDisplay_700Bold',
  headerItalic: 'PlayfairDisplay_400Regular_Italic',
  // Inter — sans body (labels, nav, body, metadata, buttons)
  body:         'Inter_400Regular',
  bodyMedium:   'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold:     'Inter_700Bold',
} as const;

export const NAV_HEIGHT = 72;

// Fallback for surfaces that render before the user profile has loaded.
// Once `useUserStore.profile` is hydrated we prefer `profile.search_radius_miles`
// (A2.a — `users.search_radius_miles`, migration 031). Keep in sync with the
// DB column default.
export const DEFAULT_SEARCH_RADIUS_MILES = 25;
export const MIN_SEARCH_RADIUS_MILES = 1;
export const MAX_SEARCH_RADIUS_MILES = 100;
export const MILES_TO_KM = 1.60934;

// Discrete chip options shown in RadiusPreferenceScreen + milk FilterDrawer /
// MilkMatch — keeps the picker tactile; a slider is a nice-to-have.
export const RADIUS_CHOICES_MILES = [5, 10, 25, 50, 75, 100] as const;

// Postpartum-only audience (decision 2026-04-27): hospital-discharge GTM means
// every primary user is a postpartum mom. TTC + trimester values still exist in
// the DB enum for legacy rows but are never offered in the UI picker.
export const PREGNANCY_STAGES = [
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
