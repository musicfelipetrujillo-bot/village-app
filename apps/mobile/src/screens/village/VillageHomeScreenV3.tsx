// VillageHomeScreenV3 — v3 brand kit Village rebuild.
//
// Pixel-faithful port of `VillageC` from the 2026-05-24 design handoff
// (/Users/gp/Downloads/design_handoff_villie/village.jsx). Equal-weight
// 2×2 colored tile grid (Milk / Specialists / Gear / Plans), each with
// its own brand hue + paper top-sheen + warm shadow. Below: a small
// "On the calendar" list previewing upcoming Villie Plans.
//
// SHIPPING STATUS: side-by-side preview. NOT wired into the navigator —
// to A/B against the current VillageHomeScreen, swap the import in
// `apps/mobile/src/navigation/VillageNavigator.tsx`:
//
//     // import VillageHomeScreen from '@screens/village/VillageHomeScreen';
//     import VillageHomeScreen from '@screens/village/VillageHomeScreenV3';
//
// Tile labels/copy + the dry "Your backup is here." masthead come from
// the handoff verbatim. Calendar list is static handoff data; wiring it
// to the live events store is a follow-up after layout approval.

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useUserStore } from '@store/user';
import { useT } from '@/i18n';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { HoneycombBackdrop } from '@components/shared/HoneycombBackdrop';

// ─── Tokens (v3 brand kit) ─────────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,      // #FFFCF6
  cream:     COLORS.v2_cream,      // #FCF7EF
  parchment: COLORS.v2_parchment,  // #F2E6DD
  butter:    COLORS.v2_butter,     // #F4C53C
  cinnamon:  COLORS.v2_cinnamon,   // #D96C88
  blush:     COLORS.v2_blush,      // #F7C5CB
  salmon:    COLORS.v2_salmon,     // #F7C5CB
  sage:      COLORS.v2_sage,       // #F2E6DD
  moss:      COLORS.v2_moss,       // #E98A6A
  cocoa:     COLORS.v2_cocoa,      // #43260F
  walnut:    COLORS.v2_walnut,     // #7A4A28
  rule:      'rgba(61,31,14,0.13)',
};

// Wordmark removed 2026-05-24 — editorial masthead is the brand
// signature on in-app surfaces. Auth retains the wordmark.
// Inline bee asset removed alongside (was unused after the wordmark
// header collapsed); atmospheric bees still ship via WarmGlowBackdrop.

// ─── Atoms ─────────────────────────────────────────────────────────────
function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 }} />
      <Text style={{
        fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
        textTransform: 'uppercase', fontWeight: '500', color: T.walnut,
      }}>{children}</Text>
    </View>
  );
}

// ─── Verticals (from handoff verbatim) ─────────────────────────────────
type Vertical = {
  num: string;
  title: string;
  sub: string;
  stat: string;
  bg: string;
  route: string;
};

// `route` is the TAB name (not the inner stack screen), since goVertical
// uses navigation.getParent().navigate(route) to cross-tab. Tab names
// per AppNavigator.tsx: Home, Manual, Village, Inbox, Experts, Milk,
// Gear, Profile. Cross-tab targets must match those exactly.
const VERTICALS: Vertical[] = [
  { num: '01', title: 'Milk Connect', sub: 'Peer milk, screened moms.',     stat: '8 near you',    bg: T.blush,     route: 'Milk' },
  { num: '02', title: 'Specialists',  sub: 'OB, doula, lactation, sleep.',  stat: '12 verified',   bg: '#F3B79C',   route: 'Experts' },
  { num: '03', title: 'Baby Gear',    sub: 'Hand-me-downs from real moms.', stat: '37 listed',     bg: T.butter,    route: 'Gear' },
  { num: '04', title: 'Villie Plans', sub: 'Classes, circles, real coffee.',stat: '5 this week',   bg: '#EFB2C8',   route: 'Village' },
];

// ─── Stage-aware support ─────────────────────────────────────────────────
// Replaces the calendar preview (redundant with the Villie Plans tile). Reads
// the mom's stage and surfaces 3 things moms typically reach for *right now*,
// each routing into a vertical. Buckets mirror the onboarding stage picker.
type SupportRoute = 'Experts' | 'Milk' | 'Gear' | 'Manual' | 'Plans';
type SupportItem = {
  emoji: string;
  title: { en: string; es: string };
  why: { en: string; es: string };
  route: SupportRoute;
  specialty?: string;   // when route === 'Experts', pre-selects that specialist chip
  category?: string;    // when route === 'Manual', deep-links into that chapter (e.g. 'feed')
  audience?: 'mom' | 'baby'; // Manual chapter audience — defaults to 'baby'
};
type StageSupport = { eyebrow: { en: string; es: string }; items: SupportItem[] };

const STAGE_SUPPORT: Record<string, StageSupport> = {
  postpartum_0_6mo: {
    eyebrow: { en: 'First weeks · what helps now', es: 'Primeras semanas · qué ayuda ahora' },
    items: [
      { emoji: '🤱', title: { en: 'Latch & feeding help', es: 'Ayuda con la lactancia' }, why: { en: 'Lactation consults, on demand', es: 'Consultas de lactancia cuando las necesites' }, route: 'Experts', specialty: 'lactation_consultant' },
      { emoji: '🩺', title: { en: 'Your recovery', es: 'Tu recuperación' }, why: { en: 'The 6-week check, healing, pelvic floor', es: 'El control de 6 semanas, sanar, suelo pélvico' }, route: 'Experts', specialty: 'pelvic_floor_pt' },
      { emoji: '🌙', title: { en: 'Newborn sleep', es: 'Sueño del recién nacido' }, why: { en: "What's normal this week, what's not", es: 'Qué es normal esta semana y qué no' }, route: 'Manual', category: 'sleep' },
    ],
  },
  postpartum_6_12mo: {
    eyebrow: { en: '6–12 months · what helps now', es: '6–12 meses · qué ayuda ahora' },
    items: [
      { emoji: '🍼', title: { en: 'Gear for movers', es: 'Equipo para bebés activos' }, why: { en: 'High chairs, gates, hand-me-downs', es: 'Sillas altas, rejas, de segunda mano' }, route: 'Gear' },
      { emoji: '🌙', title: { en: 'Sleep regressions', es: 'Regresiones del sueño' }, why: { en: 'The ~8-month shift, sleep coaches', es: 'El cambio de los ~8 meses, asesores de sueño' }, route: 'Experts', specialty: 'sleep_coach' },
    ],
  },
  postpartum_1yr_plus: {
    eyebrow: { en: 'Toddler stage · what helps now', es: 'Etapa de niño pequeño · qué ayuda ahora' },
    items: [
      { emoji: '🍽️', title: { en: 'Toddler meals', es: 'Comidas del niño' }, why: { en: 'Picky eating, nutrition help', es: 'Alimentación selectiva, ayuda nutricional' }, route: 'Experts', specialty: 'perinatal_dietitian' },
      { emoji: '☕', title: { en: 'Meetups & playdates', es: 'Encuentros y citas de juego' }, why: { en: 'Moms and babies near you', es: 'Mamás y bebés cerca de ti' }, route: 'Plans' },
      { emoji: '🧸', title: { en: 'Outgrown gear?', es: '¿Equipo que ya no usan?' }, why: { en: 'Pass it on, find the next size', es: 'Pásalo, encuentra la siguiente talla' }, route: 'Gear' },
    ],
  },
};
const SUPPORT_FALLBACK = STAGE_SUPPORT.postpartum_0_6mo;

// ─── Screen ────────────────────────────────────────────────────────────
export default function VillageHomeScreenV3() {
  const navigation = useNavigation<any>();
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';
  const support = STAGE_SUPPORT[profile?.pregnancy_stage ?? ''] ?? SUPPORT_FALLBACK;

  // Location line — neighborhood + count are placeholder; wire to
  // `users.zip_code` reverse-geocode + count-in-radius RPC in follow-up.
  const locationLine = lang === 'es'
    ? 'Brooklyn, NY · 62 en tu radio'
    : 'Brooklyn, NY · 62 in your radius';

  const goVertical = (route: string) => {
    navigation.getParent()?.navigate(route as never);
  };
  // goAllPlans → full events list (Villie Plans tile + stage-aware "Plans" row).
  // goMap → donor map (only map surface today).
  const goAllPlans = () => navigation.navigate('EventsList' as never);
  const goMap      = () =>
    navigation.getParent()?.navigate('Milk' as never, { screen: 'DonorMap' } as never);
  // Deep-link into the Experts tab with a specialist type pre-selected
  // (ExpertsHome reads route.params.specialty and pre-checks that chip).
  const goExpertSpecialty = (specialty: string) =>
    navigation.getParent()?.navigate('Experts' as never, { screen: 'ExpertsHome', params: { specialty } } as never);
  // Deep-link into the Manual tab with a specific chapter open (e.g. Feed for
  // "Starting solids"). Bare navigate('Manual') only lands on the tab's default
  // chapter, which is the bug behind "Starting solids doesn't take you to Feed".
  const goManualCategory = (category: string, audience: 'mom' | 'baby' = 'baby') => {
    // Unified Manual experience: open the new week-gated Manual home at this
    // chapter (the legacy ManualCategory topic screen is no longer routed to).
    const chapter = category.charAt(0).toUpperCase() + category.slice(1);
    navigation.getParent()?.navigate('Manual' as never, {
      screen: 'ManualHome',
      params: { chapter, audience },
    } as never);
  };

  const scrollY = useRef(new Animated.Value(0)).current;
  const [triggerAnim, setTriggerAnim] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      return () => {};
    }, []),
  );

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={triggerAnim} />
      {/* Honeycomb masthead — the umbrella hub gets the same comb the sub-
          sections wear, with a "whole hive gathers" bee scene + honey accent.
          Subtle intensity (vs the Manual's playful) keeps the comb faint +
          short so it never fights the "here." headline for legibility. */}
      <HoneycombBackdrop accent="#E0A23E" scene="village" intensity="subtle" topOffset={92} />
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Header — map-pin button only. Wordmark removed 2026-05-24 per
            Felipe — the editorial masthead ("Your backup is here.") IS
            the brand signature on in-app surfaces. Map-pin flush-right. */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.mapBtn}
            accessibilityRole="button"
            accessibilityLabel="Donor map"
            onPress={goMap}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path
                d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"
                stroke={T.walnut} strokeWidth={1.8} fill="none"
                strokeLinecap="round" strokeLinejoin="round"
              />
              <Circle cx={12} cy={10} r={3} stroke={T.walnut} strokeWidth={1.8} fill="none" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Eyebrow + headline — pulled up over the right-aligned map button
            (negative margin) so the headline lands at the same ~82px height as
            the Manual title, keeping the two pages vertically balanced. */}
        <View style={{ marginTop: -10 }}><Eyebrow>{lang === 'es' ? 'Refuerzos' : 'Reinforcements'}</Eyebrow></View>
        <Text style={styles.headline}>
          {lang === 'es' ? 'Tu refuerzo está ' : 'Your backup is '}
          <Text style={styles.headlineItalic}>{lang === 'es' ? 'aquí.' : 'here.'}</Text>
        </Text>
        <Text style={styles.deck}>
          {lang === 'es' ? 'Apoyo, desde todos los ángulos. Toca uno.' : 'Support, from every angle. Tap one.'}
        </Text>
        <Text style={styles.locMono}>{locationLine}</Text>

        {/* 2×2 vertical grid */}
        <View style={styles.gridWrap}>
          {VERTICALS.map((v) => (
            <TouchableOpacity
              key={v.title}
              // "Villie Plans" tile self-references the current tab (route: 'Village')
              // — that's a no-op. Route it into the EventsList screen in this same
              // stack so tapping the tile actually does something. Every other tile
              // still cross-tabs via goVertical.
              onPress={v.route === 'Village' ? goAllPlans : () => goVertical(v.route)}
              activeOpacity={0.88}
              style={[styles.tile, { backgroundColor: v.bg }]}
            >
              <LinearGradient
                colors={['rgba(253,251,246,0.22)', 'rgba(253,251,246,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.42 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
                pointerEvents="none"
              />
              <View>
                <Text style={styles.tileTitle}>{v.title}.</Text>
                <Text style={styles.tileSub}>{v.sub}</Text>
              </View>
              <View style={styles.tileFooter}>
                <Text style={styles.tileStat}>{v.stat}</Text>
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path
                    d="M5 12h14M13 5l7 7-7 7"
                    stroke={T.cocoa} strokeWidth={2.2} fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stage-aware support — what moms reach for at this stage.
            Replaces the calendar preview (redundant with Villie Plans). */}
        <View style={{ marginTop: 28 }}>
          <View style={styles.sectionHead}>
            <Eyebrow>{support.eyebrow[lang]}</Eyebrow>
          </View>
          {support.items.map((it, i) => {
            const isLast = i === support.items.length - 1;
            const onPress = it.route === 'Plans'
              ? goAllPlans
              : it.route === 'Experts' && it.specialty
                ? () => goExpertSpecialty(it.specialty!)
                : it.route === 'Manual' && it.category
                  ? () => goManualCategory(it.category!, it.audience)
                  : () => goVertical(it.route);
            return (
              <TouchableOpacity
                key={it.title.en}
                onPress={onPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={it.title[lang]}
                style={[styles.calRow, { borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth }]}
              >
                <Text style={{ fontSize: 22, marginRight: 14 }}>{it.emoji}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.calName} numberOfLines={1}>{it.title[lang]}</Text>
                  <Text style={styles.calMeta} numberOfLines={2}>{it.why[lang]}</Text>
                </View>
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path
                    d="M5 12h14M13 5l7 7-7 7"
                    stroke={T.cocoa} strokeWidth={2.2} fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper, overflow: 'hidden' },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 96 },

  haloSalmon: {
    position: 'absolute', top: -60, right: -120,
    width: 340, height: 340, borderRadius: 170,
    backgroundColor: 'rgba(237,168,160,0.20)',
  },
  haloButter: {
    position: 'absolute', top: 360, left: -90,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(250,208,128,0.15)',
  },
  // Atmosphere bees — scattered background swarm, scrolls with content.
  atmosphereBee1: {
    position: 'absolute', top: 100, right: 36,
    width: 32, height: 32,
    transform: [{ rotate: '22deg' }],
    opacity: 0.18,
  },
  atmosphereBee2: {
    position: 'absolute', top: 280, left: 24,
    width: 26, height: 26,
    transform: [{ rotate: '-28deg' }],
    opacity: 0.22,
  },
  atmosphereBee3: {
    position: 'absolute', top: 580, right: 48,
    width: 38, height: 38,
    transform: [{ rotate: '14deg' }],
    opacity: 0.16,
  },
  atmosphereBee4: {
    position: 'absolute', top: 880, left: 40,
    width: 28, height: 28,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.20,
  },

  header: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
  },
  mapBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: T.parchment,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Headline block ────────────────────────────────────────────────────
  headline: {
    fontFamily: FONTS.v3_display, fontSize: 44, lineHeight: 52,
    color: T.cocoa, letterSpacing: -1.76,
    marginTop: 14,
  },
  // Caveat (the script accent) has a much smaller x-height than Bricolage, so
  // at the same point size it reads visually smaller. Bump it ~25% + nudge the
  // baseline so "here." matches the weight of "Your backup is" inline.
  headlineItalic: {
    fontFamily: FONTS.v3_display_italic, color: T.salmon,
    fontSize: 54, lineHeight: 52,
  },
  deck: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: T.walnut, marginTop: 12, maxWidth: 300,
  },
  locMono: {
    marginTop: 10,
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.walnut, letterSpacing: 2.0,
    textTransform: 'uppercase', fontWeight: '500',
  },

  // ── 2×2 tile grid ─────────────────────────────────────────────────────
  gridWrap: {
    marginTop: 22, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  tile: {
    width: '48%', minHeight: 170,
    padding: 16, paddingBottom: 14,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: T.walnut,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 3,
  },
  tileTitle: {
    fontFamily: FONTS.v3_display, fontSize: 24, lineHeight: 24,
    color: T.cocoa, letterSpacing: -0.67,
  },
  tileSub: {
    fontFamily: FONTS.v2_body, fontSize: 12.5,
    color: T.cocoa, opacity: 0.78,
    marginTop: 8, lineHeight: 17,
  },
  tileFooter: {
    marginTop: 14, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(61,31,14,0.18)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tileStat: {
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.cocoa, letterSpacing: 1.4,
    textTransform: 'uppercase', fontWeight: '600',
  },

  // ── Section heads ─────────────────────────────────────────────────────
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  sectionLink: {
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.cinnamon, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '600',
  },

  // ── Calendar list ─────────────────────────────────────────────────────
  calRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 12,
    borderBottomColor: T.rule,
  },
  calDayBlock: { width: 36, alignItems: 'center' },
  calDayName: {
    fontFamily: FONTS.v2_mono, fontSize: 9,
    color: T.walnut, letterSpacing: 1.5, fontWeight: '500',
  },
  calDayNum: {
    fontFamily: FONTS.v3_display, fontSize: 18,
    color: T.cocoa, letterSpacing: -0.36, lineHeight: 18,
  },
  calName: {
    fontFamily: FONTS.v2_link, fontSize: 13.5,
    color: T.cocoa,
  },
  calMeta: {
    marginTop: 2,
    fontFamily: FONTS.v2_mono, fontSize: 9.5,
    color: T.walnut, letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  calGoing: {
    fontFamily: FONTS.v2_body, fontSize: 11, color: T.walnut,
  },
  calGoingNum: {
    fontFamily: FONTS.v2_bold, color: T.cocoa,
  },
});
