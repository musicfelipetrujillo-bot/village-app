// cardLift — the canonical "lifted card" shadow recipe.
//
// Spread into any StyleSheet block to give a card surface the same lift
// as the DailyCheckinStrip / V3Card / VillageHomeV3 tile family. Pairs
// with `cardLiftBorder` for the matching hairline border.
//
// Pattern:
//   strip: {
//     backgroundColor: COLORS.v2_card,
//     borderRadius: 14,
//     padding: 16,
//     ...cardLiftBorder,
//     ...cardLift,
//   }
//
// Use `cardLiftDeep` for hero / full-bleed cards that need to sit even
// further off the page (matches V3Card `deepShadow` prop).
//
// Defined here as a plain JS object (not a StyleSheet block) so it's
// spreadable into any screen's local stylesheet without forcing an
// import of V3Card or its underlying GlassHighlight + inner-glow stack
// — those land via V3Card when the surface uses the component. This
// constant is the "I'll keep my own bg + padding + content, just give
// me the lift" escape hatch for screens that don't want to refactor to
// V3Card outright.

import { StyleSheet } from 'react-native';

export const cardLift = {
  // Cocoa-tinted floating shadow — matches DailyCheckinStrip exactly.
  // Was the v9 canon (0.22 / offset 10 / radius 22 / elev 6) before V3Card
  // landed; staying in lockstep so all "lifted" surfaces in the app share
  // the same shadow signature.
  shadowColor: '#43260F',
  shadowOpacity: 0.22,
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 22,
  elevation: 6,
} as const;

export const cardLiftDeep = {
  // Heavier shadow for hero / full-bleed cards (matches V3Card.deepShadow).
  shadowColor: '#43260F',
  shadowOpacity: 0.28,
  shadowOffset: { width: 0, height: 14 },
  shadowRadius: 24,
  elevation: 8,
} as const;

export const cardLiftBorder = {
  // Hairline rust border — pairs with cardLift on paper-bg surfaces so
  // the edge reads even on warm page washes where the bg-to-wash contrast
  // is low. Keep `borderRadius` separate at the call site (often varies).
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(150,80,50,0.18)',
} as const;
