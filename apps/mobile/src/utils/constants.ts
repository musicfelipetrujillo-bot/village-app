// Design tokens.
//
// ─── Brand Kit v2 · villie · May 2026 (CANONICAL going forward) ────────────
// Source: `/Users/gp/Downloads/the-village-ig/project/The Village - Brand Kit.html`
// Memory: `memory/project_brand_kit_v2.md`
//
// v2 keys are added to COLORS / FONTS below alongside the existing v1
// tokens. New screens should use the v2 names (cinnamon, cocoa, caramel,
// butter, marigold, plus_jakarta_*, caprasimo_*, mono_*).
//
// v1 tokens (Brand Kit v5 — Pink / Coco / Cream) remain in place for the
// 60+ existing screens to keep compiling during the per-screen sweep.
// They will be removed once every screen has migrated to v2 naming.
//
// ─── Brand Kit v5 (v1) · legacy, still in use ──────────────────────────────
// Primary (legacy canonical):
//   pink   #F7C5CB — soft warm blush. Hero washes, accent surfaces, pill
//                     bgs, decorative dot, "i" accent on wordmark.
//   coco   #AD795B — warm caramel brown. Primary CTA, eyebrow accents,
//                     mid-priority text, hairline rules, sienna replacement.
//   cream  #F5EFE6 — page background. Slightly warmer than the prior
//                     ceramic; reads as off-white paper, not yellow.
//
// Secondary support:
//   bark   #3D1F0D — primary text (deep warm brown, not black)
//   sage   #E98A6A — calm/success accent (sits opposite the pinks)
//   mauve  #F2E6DD — soft mid-tone for tags + secondary labels
//   sand   #F2E6DD — warm neutral for inner card surfaces + dividers
//   paper  #FDFAF5 — lifted surface tone for cards
export const COLORS = {
  // ═══════════════════════════════════════════════════════════════════════
  // Brand Kit v2 · villie (May 2026) — CANONICAL going forward.
  // Use these names in new code. v1 keys below kept until per-screen sweep.
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Surfaces ───
  v2_cream:       '#FCF7EF',  // page — almost every layout sits on this
  v2_paper:       '#FFFCF6',  // alt page surface
  v2_parchment:   '#F2E6DD',  // card bg, "Week 30" surfaces
  v2_card:        '#FFFCF6',  // pure-white substitute — use instead of #FFFFFF
  v2_butter:      '#F4C53C',  // sunshine honey — card gradients, hero halos
  v2_marigold:    '#F4C53C',  // IG hero pop ("honey" energy)

  // --- V10 Gen Z named tokens (canonical -- see docs/V10_GENZ_REBRAND.md) ---
  genz_cream:      '#FCF7EF',  // app / page canvas
  genz_bone:       '#FFFCF6',  // cards, raised surfaces
  genz_honey:      '#F4C53C',  // bee, sunshine, secondary button
  genz_rose:       '#D96C88',  // PRIMARY action
  genz_berry:      '#C25A78',  // deep pink -- pressed CTA, small action text
  genz_blush:      '#F7C5CB',  // soft tiles, chips, rings, empathy
  genz_caramel:    '#E98A6A',  // warm chestnut accent, feature tiles
  genz_clay:       '#F2E6DD',  // dividers, dashed borders, muted warm fills
  genz_chestnut:   '#43260F',  // primary text, dark tiles
  genz_softink:    '#7A4A24',  // secondary text, captions, eyebrows

  // ─── Action (one cinnamon per screen) ───
  v2_cinnamon:    '#D96C88',  // wordmark, CTA, link, active tab — the one spark
  v2_cinnamon_dk: '#C25A78',  // pressed CTA

  // ─── Support row ───
  v2_caramel:     '#E98A6A',  // italic-name accent, neutral chips, "second spark" fallback
  v2_blush:       '#F7C5CB',  // empathy moments, "we hear you" cards
  v2_salmon:      '#F7C5CB',  // Feel chapter pill, soft action chips

  // ─── Inks (warm-walnut family) ───
  v2_cocoa:       '#43260F',  // UI headlines, "Good morning" — use instead of #000000
  v2_walnut:      '#7A4A24',  // IG body, body-text on cream
  v2_amber:       '#7A4A24',  // eyebrows, captions, secondary copy

  // ─── Reserve (use sparingly) ───
  v2_sage:        '#F2E6DD',  // cool exhale, "Find moms"
  v2_moss:        '#E98A6A',  // Heal chapter pill ONLY
  v2_persimmon:   '#E0543B',  // IG ONLY — NEVER in app (use cinnamon for app actions)

  // ─── Manual chapter pills · "fresh" preset (in-app default) ───
  v2_pill_feel:   '#F7C5CB',  // salmon
  v2_pill_heal:   '#E98A6A',  // moss
  v2_pill_feed:   '#F4C53C',  // butter
  v2_pill_sleep:  '#F2E6DD',  // caramel
  v2_pill_tips:   '#C25A78',  // cinnamon

  // ─── Manual chapter sub-palette · "original" preset (alternate, not default) ───
  v2_feel_orig:   '#E98A6A',
  v2_heal_orig:   '#E98A6A',
  v2_feed_orig:   '#C7B39B',
  v2_sleep_orig:  '#A1775F',
  v2_tips_orig:   '#986A50',

  // ═══════════════════════════════════════════════════════════════════════
  // Brand Kit v5 (v1) — legacy, still consumed by every screen.
  // ═══════════════════════════════════════════════════════════════════════

  // Brand Kit v5 — Primary triad (canonical).
  // *** 2026-05-15 Phase 3 leverage move: 4 high-traffic v1 tokens routed
  // to v2 brand kit hexes so the entire app's pages/CTAs/headlines pick up
  // the v2 palette without touching component code. Detailed map:
  //   cream  #F5EFE6 → #F4ECD8  (v2 page surface, slightly warmer/yellower)
  //   coco   #AD795B → #C07840  (v2 cinnamon — every primary CTA reads v2)
  //   rust   #AD795B → #C07840  (alias of coco, same swap)
  //   bark   #3D1F0D → #3D1F0E  (v2 cocoa, essentially identical)
  // Untouched: sage, mauve, sand, pink, paper — v1 hex stays because v2
  // counterparts serve different roles (sage v2 is much lighter; pink v2 is
  // a different blush; no v2 mauve/sand equivalent).
  pink:         '#F7C5CB',  // hero accent, decorative wash, pill bg (v1)
  pinkDeep:     '#D96C88',  // pressed/active pink (e.g. selected pill)
  pinkSoft:     '#FAE2DB',  // softer wash for surface tints
  coco:         '#D96C88',  // ▲ ROUTED → v2 cinnamon (was #AD795B)
  cocoDeep:     '#C25A78',  // ▲ ROUTED → v2 cinnamon dark (was #E98A6A)
  cocoSoft:     '#E98A6A',  // ▲ ROUTED → v2 caramel (was #E98A6A)
  cream:        '#FCF7EF',  // ▲ ROUTED → v2 cream (was #F5EFE6)

  // Secondary support
  bark:         '#43260F',  // ▲ ROUTED → v2 cocoa (was #3D1F0D, ~identical)
  barkSoft:     '#7A4A24',  // ▲ ROUTED → v2 walnut (was #7A4A24)
  sienna:       '#D96C88',  // ▲ ROUTED → v2 cinnamon (alias of coco)
  siennaDeep:   '#C25A78',  // ▲ ROUTED → v2 cinnamon dark
  sage:         '#E98A6A',  // calm / success / nature (v1 — v2 sage is a different role)
  sageDeep:     '#E98A6A',
  sageSoft:     '#F2E6DD',  // light sage wash — specialty tiles, success tints
  mauve:        '#F2E6DD',  // tags, secondary labels — @deprecated use textLight
  mauveDeep:    '#7A4A24',  // @deprecated use textLight
  sand:         '#F2E6DD',  // warm neutral surface
  sandSoft:     '#F2E6DD',  // ▲ ROUTED → v2 parchment (was #F2E6DD)
  paper:        '#FFFCF6',  // ▲ ROUTED → v2 card (was #FDFAF5, essentially same)
  // Functional status signals (not brand — used only for status badges)
  statusAlert:   '#D87530', // orange — active/expiring/time-sensitive states
  statusSuccess: '#2E7D32', // green  — verified/fulfilled/complete states
  blush:        '#F7C5CB',  // = pink (legacy callers)
  blushDeep:    '#D96C88',  // = pinkDeep
  ceramic:      '#FCF7EF',  // ▲ ROUTED → v2 cream (was #F5EFE6)

  // ─── Legacy aliases — @deprecated ───────────────────────────────────────
  // These resolve to canonical Brand Kit v5 tokens. New code should use
  // the canonical name directly. Aliases will be removed in a future sweep.
  rust:         '#D96C88',  // ▲ ROUTED → v2 cinnamon (was #AD795B)
  rustDark:     '#C25A78',  // ▲ ROUTED → v2 cinnamon dark
  rustLight:    '#E98A6A',  // ▲ ROUTED → v2 caramel
  diner:        '#D96C88',  // ▲ ROUTED → v2 cinnamon
  dinerDark:    '#C25A78',  // ▲ ROUTED → v2 cinnamon dark
  dinerLight:   '#E98A6A',  // ▲ ROUTED → v2 caramel
  brownDeep:    '#43260F',  // ▲ ROUTED → v2 cocoa
  brownMid:     '#7A4A24',  // ▲ ROUTED → v2 walnut
  textDark:     '#43260F',  // ▲ ROUTED → v2 cocoa
  textMid:      '#7A4A24',  // ▲ ROUTED → v2 walnut
  textLight:    '#7A4A24',  // ▲ ROUTED → v2 amber (was #7A4A24)
  white:        '#FFFCF6',  // ▲ ROUTED → v2 card (no pure white per brand)
  cardBg:       '#FFFCF6',  // ▲ ROUTED → v2 card
  ceramicDeep:  '#F2E6DD',  // ▲ ROUTED → v2 parchment
  creamDeep:    '#F2E6DD',  // ▲ ROUTED → v2 parchment
  // ceramic: defined earlier in this block as legacy alias of cream — removed
  // duplicate here (TS1117 fix). The earlier declaration is the canonical one.
  olive:        '#E98A6A',  // @deprecated → sage (v1 sage stays, v2 sage is different role)
  oliveLight:   '#F2E6DD',  // @deprecated → no equivalent; use sage
  lime:         '#F2E6DD',  // @deprecated → no equivalent; use sage
  limeDeep:     '#E98A6A',  // @deprecated → sageDeep
  yolk:         '#F2E6DD',  // @deprecated → sand
  yolkDark:     '#B59B7A',  // @deprecated → no equivalent; use sand
  yolkLight:    '#F2E6DD',  // @deprecated → sandSoft
  gold:         '#F2E6DD',  // @deprecated → sand
} as const;

export const FONTS = {
  // ═══════════════════════════════════════════════════════════════════════
  // v1 — legacy font names. *** 2026-05-15 Phase 3 leverage move:
  // body/bodyMedium/bodySemiBold/bodyBold rerouted from Inter to Plus
  // Jakarta Sans (the v2 body family) so every screen using these names
  // auto-switches to v2 typography. Inter is no longer loaded in App.tsx.
  // headerItalic rerouted from Playfair 400 italic to Playfair 600 italic
  // (the v2 "flourish" weight). header (Playfair 400 roman) stays — it's
  // rarely used; new code should reach for v2_display (Playfair 700) instead.
  // ═══════════════════════════════════════════════════════════════════════
  // ▲ ROUTED 2026-05-24 — v3 brand kit grotesk display.
  // Same Plus Jakarta Sans + Fraunces values as the v2_display* tokens
  // below. Flips every screen that uses FONTS.headerBold / headerItalic
  // (51 files) to v3 typography without per-file sweeps. The Playfair
  // 400 Regular on `header` stays — it's used in <2 places.
  header:       'BricolageGrotesque_400Regular',
  headerBold:   'BricolageGrotesque_700Bold',                 // ▲ was Playfair 700
  headerItalic: 'Caveat_600SemiBold',             // ▲ was Playfair italic 600
  // ▼ Body family rerouted to Plus Jakarta Sans (v2 canonical body)
  body:         'HankenGrotesk_400Regular',   // ▲ was Inter_400Regular
  bodyMedium:   'HankenGrotesk_500Medium',    // ▲ was Inter_500Medium
  bodySemiBold: 'HankenGrotesk_600SemiBold',  // ▲ was Inter_600SemiBold
  bodyBold:     'HankenGrotesk_700Bold',      // ▲ was Inter_700Bold

  // ═══════════════════════════════════════════════════════════════════════
  // v2 brand kit (villie · May 2026) — CANONICAL going forward.
  // Mapping cheat sheet from project_brand_kit_v2.md:
  //   v2_display          → greetings, headlines, card titles (default Playfair)
  //   v2_display_italic   → the per-screen italic flourish
  //   v2_display_big      → big numbers (week count, stats)
  //   v2_wordmark         → Caprasimo, used inline for "villie" in body copy ONLY
  //   v2_body / _label /  → Plus Jakarta Sans, replaces Inter for v2 surfaces
  //   _link / _bold
  //   v2_mono             → JetBrains Mono — eyebrows, dates, metadata, tracking 0.26em
  // ═══════════════════════════════════════════════════════════════════════
  // ▲ ROUTED 2026-05-24 — v3 brand kit grotesk display family.
  // Was Playfair (editorial serif), now Plus Jakarta Sans Bold for
  // display + Fraunces SemiBold Italic for the per-screen italic
  // flourish. Every screen referencing v2_display* automatically picks
  // up the v3 treatment without per-file edits.
  v2_display:        'BricolageGrotesque_700Bold',           // ▲ was Playfair 700
  v2_display_italic: 'Caveat_600SemiBold',       // ▲ was Playfair italic
  v2_display_big:    'BricolageGrotesque_800ExtraBold',           // ▲ was Playfair 800 (no 800 grotesk loaded; 700 reads big enough at large sizes)
  v2_wordmark:       'Caprasimo_400Regular',              // KEEP current logo — inline wordmark fallback stays Caprasimo (Felipe 2026-05-29: don't adopt kit's Bricolage wordmark)
  v2_light:          'HankenGrotesk_300Light',          // refined light subtitles
  v2_body:           'HankenGrotesk_400Regular',        // body text
  v2_label:          'HankenGrotesk_500Medium',         // form labels
  v2_link:           'HankenGrotesk_600SemiBold',       // buttons + links
  v2_bold:           'HankenGrotesk_700Bold',           // emphasis
  v2_mono:           'HankenGrotesk_600SemiBold',           // eyebrows + metadata
  v2_mono_light:     'HankenGrotesk_500Medium',          // long mono blocks (rare)

  // ═══════════════════════════════════════════════════════════════════════
  // Brand Kit v3 (villie · May 24, 2026) — grotesk + Fraunces "wonky moment"
  //
  // The v3 design handoff (2026-05-24) shifts display typography from
  // Playfair (editorial serif) to Plus Jakarta Sans (grotesk modern),
  // with Fraunces SemiBold Italic for the per-screen italic accent
  // ("manual.", "here.", "Feli." — the "wonky moment").
  //
  // Currently scoped to v3 preview screens only (HomeScreenV3 /
  // VillageHomeScreenV3 / ManualScrollV3). The Playfair-based v2_display*
  // tokens above stay live on the production screens until the wider
  // typography sweep ships (separate commit, ~50 mastheads).
  // ═══════════════════════════════════════════════════════════════════════
  v3_display:        'BricolageGrotesque_700Bold',      // display heads — grotesk modern
  v3_display_italic: 'Caveat_600SemiBold',
  // --- V10 Gen Z marker layer (Caveat handwriting) ---
  v2_script:         'Caveat_400Regular',
  marker:            'Caveat_400Regular',  // italic accent — "wonky moment"
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
