// VillageHomeScreenV3 — the Village tab, rebuilt with Home's energy (2026-09-10).
//
// The screen had been sanded down to a header and four flat rows: no icons, no
// events, two translucent atmosphere layers stacked over everything. It read
// dull and foggy. This rebuild borrows Home's exact structure — a bold gradient
// masthead with the honeycomb lattice and the bee, then a lifted cream sheet
// that slides up over it carrying the doing — and fills it with what the Village
// tab actually owns:
//
//   1. the four pillars as a 2×2 grid of illustrated-icon tiles (the milk drop,
//      the care hearts, the pram, the plans calendar — the art was already in
//      assets/village, just unused since `7c8d285`)
//   2. the events block the file was originally built around: a featured
//      gathering + upcoming rows, wired to the live events store
//
// Fog: the page used to stack WarmGlowBackdrop (18 bees + hex echoes) UNDER
// HoneycombBackdrop, so every element sat behind two veils. The hero carries
// the texture now; the sheet below is clean cream, and colour does the talking.

import React, { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useUserStore } from '@store/user';
import { useEventsStore } from '@store/events';
import { formatDistance, type EventCard } from '@api/events';
import { HeroHoneycomb } from '@components/shared/HeroHoneycomb';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// ─── Placeholder pillar glyphs ─────────────────────────────────────────
// STAND-IN ART (2026-09-10). The founder's hand-picked illustrations still
// live in `assets/village/*.png` — they are deliberately NOT deleted, so the
// incoming brand designer has the original direction to work from. Until that
// lands, each pillar gets a drawn duotone glyph instead: one soft fill in the
// pillar's tone under a crisp 2.3px stroke, all on the same 48×48 grid so the
// four read as a set rather than four borrowed pictures.
//
// Swapping back = restore the requires and point `Tile` at <Image> again.
type GlyphName = 'drop' | 'care' | 'onesie' | 'plans';

// A baby bodysuit: shoulders → sleeves → body → the two legs with a crotch
// notch. Reads instantly at 30px, where a stroller's wheels and handle collapse
// into a wheelbarrow.
const ONESIE =
  'M18 11h12l7.5 4.5-3.5 6.5-4-2.2V34a2.5 2.5 0 0 1-2.5 2.5h-3.6L24 32l-3.4 4.5H17A2.5 2.5 0 0 1 14.5 34V19.8l-4 2.2L7 15.5z';

function PillarGlyph({ name, color, size = 30 }: { name: GlyphName; color: string; size?: number }) {
  const common = {
    stroke: color, strokeWidth: 2.3, fill: 'none',
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {name === 'drop' && (
        <>
          <Path d="M24 7c0 0 11 12.6 11 20.6a11 11 0 1 1-22 0C13 19.6 24 7 24 7z" fill={color} fillOpacity={0.16} />
          <Path d="M24 7c0 0 11 12.6 11 20.6a11 11 0 1 1-22 0C13 19.6 24 7 24 7z" {...common} />
          <Path d="M24 34s-5-3.1-5-6.4a2.8 2.8 0 0 1 5-1.7 2.8 2.8 0 0 1 5 1.7c0 3.3-5 6.4-5 6.4z" fill={color} />
        </>
      )}
      {name === 'care' && (
        <>
          <Path d="M24 39s-13-8.1-13-16.3A7.3 7.3 0 0 1 24 18a7.3 7.3 0 0 1 13 4.7C37 30.9 24 39 24 39z" fill={color} fillOpacity={0.16} />
          <Path d="M24 39s-13-8.1-13-16.3A7.3 7.3 0 0 1 24 18a7.3 7.3 0 0 1 13 4.7C37 30.9 24 39 24 39z" {...common} />
          <Path d="M14.5 26h5l2.4-5.2 3.6 9.4 2.4-4.2h5.6" {...common} strokeWidth={2} />
        </>
      )}
      {name === 'onesie' && (
        <>
          <Path d={ONESIE} fill={color} fillOpacity={0.16} />
          <Path d={ONESIE} {...common} />
          <Path d="M20.5 13.5a3.5 3.5 0 0 0 7 0" {...common} strokeWidth={2} />
        </>
      )}
      {name === 'plans' && (
        <>
          <Path d="M10 15h28v25a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1z" fill={color} fillOpacity={0.16} />
          <Path d="M10 15h28v25a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1z" {...common} />
          <Path d="M10 23h28" {...common} />
          <Path d="M17.5 10v7M30.5 10v7" {...common} />
          <Path d="M24 27.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" fill={color} />
        </>
      )}
    </Svg>
  );
}

// ─── Tokens (v3 brand kit, elevated rose+honey) ───────────────────────
const T = {
  paper:     COLORS.v2_paper,
  cream:     COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  cocoa:     COLORS.v2_cocoa,
  walnut:    COLORS.v2_walnut,
  rose:      '#E14A32',
  roseInk:   '#B03A22',
  honey:     '#DA9A2C',
  rule:      'rgba(61,31,14,0.13)',
  sheet:     '#FBF4E6',
};

// Village's masthead is honey where Home's is raspberry — sibling treatment,
// its own time of day, so the two tabs never read as the same screen.
// The sheet's horizontal padding and the gap between tiles. Declared once
// because the tile width is measured from them — a percentage width can't be
// trusted here: flexBasis/width percentages inside the wrapping grid resolved
// to a full-width line rather than two columns.
const SHEET_PAD = 22;
const TILE_GAP = 12;

const HERO_GRADIENT = ['#FCE7C3', '#F7D097', '#F2B98C'] as const;
const HERO_INK      = '#8A4A1E';
const HERO_INK_SOFT = '#A5673A';

const ArrowRight = ({ color }: { color: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M5 12h14M13 5l7 7-7 7" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Verticals ─────────────────────────────────────────────────────────
// The illustrated icon leads and a soft per-pillar tint carries its identity.
// `route` is the TAB name (goVertical cross-tabs via getParent()).
type Vertical = {
  title: string;
  sub: string;
  route: string;
  tone: string;                      // per-pillar accent (arrow, title rule)
  tile: readonly [string, string];   // the tile's own soft gradient
  glyph: GlyphName;
  isNew?: boolean;
};

const VERTICALS: Vertical[] = [
  { title: 'Milk Hub',     sub: 'your stash + peer milk',     route: 'Milk',    tone: '#C24A63', tile: ['#FDE8EE', '#F8CEDA'], glyph: 'drop',  isNew: true },
  { title: 'Care',         sub: 'doctors, doulas, lactation', route: 'Experts', tone: '#D96F4E', tile: ['#FDEBE1', '#F7D2BE'], glyph: 'care'  },
  { title: 'Baby Gear',    sub: 'hand-me-downs from moms',    route: 'Gear',    tone: '#C08A22', tile: ['#FCF0D6', '#F4DCA6'], glyph: 'onesie'},
  { title: 'Villie Plans', sub: 'classes, circles, meetups',  route: 'Village', tone: '#CB5480', tile: ['#FCE5EE', '#F5C9DE'], glyph: 'plans' },
];

// Short weekday + day-of-month for the calendar chip.
function dayParts(iso: string): { wd: string; day: number } {
  const d = new Date(iso);
  return { wd: d.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase(), day: d.getDate() };
}
function eventMeta(e: EventCard): string {
  const where = e.type === 'webinar' ? 'webinar' : (e.city ?? formatDistance(e.distance_km) ?? 'nearby');
  return `${where} · ${e.going_count} going`;
}

// ─── Screen ────────────────────────────────────────────────────────────
export default function VillageHomeScreenV3() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  // Exactly two tiles per row at any screen size, gutter included.
  const cellW = Math.floor((winW - SHEET_PAD * 2 - TILE_GAP) / 2);
  const profile = useUserStore((s) => s.profile);
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';
  const es = lang === 'es';

  const upcoming = useEventsStore((s) => s.upcoming);
  const fetchUpcoming = useEventsStore((s) => s.fetchUpcoming);

  // Real location, best-effort: reverse-geocode the device position when the
  // permission is already granted (never prompts here). Falls back to a
  // neutral line — no fabricated city or counts.
  const [geoCity, setGeoCity] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({}));
        if (!pos) return;
        const geos = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const g = geos?.[0];
        const city = g?.city ?? g?.subregion;
        if (city && !cancelled) setGeoCity(g?.region ? `${city}, ${g.region}` : city);
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const locationLine = geoCity ?? (es ? 'Cerca de ti' : 'Near you');

  const goVertical = (route: string) => navigation.getParent()?.navigate(route as never);
  const goAllPlans = () => navigation.navigate('EventsList' as never);
  const goEvent = (id: string) => navigation.navigate('EventDetail' as never, { id } as never);
  const goMap = () =>
    navigation.getParent()?.navigate('Milk' as never, { screen: 'DonorMap' } as never);

  const scrollY = useRef(new Animated.Value(0)).current;
  // Collapsed bar — same treatment as Home's: once the masthead has mostly
  // slid behind the sheet, a cream cap fades in so tile art and event rows
  // don't run under the clock and the notch.
  const miniOpacity = scrollY.interpolate({ inputRange: [120, 210], outputRange: [0, 1], extrapolate: 'clamp' });

  useFocusEffect(
    React.useCallback(() => {
      fetchUpcoming().catch(() => {});
      return () => {};
    }, [fetchUpcoming]),
  );

  const featured = upcoming[0];
  const rest = upcoming.slice(1, 3);

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Masthead — PINNED, exactly as Home's: it counter-translates by the
            scroll offset so it stays put while the cream sheet slides UP over
            it, instead of the top half scrolling away. */}
        <Animated.View style={{ transform: [{ translateY: scrollY }] }}>
          <LinearGradient
            colors={HERO_GRADIENT}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 8 }]}
          >
            <HeroHoneycomb height={260} color="#C9772F" />

            <View style={styles.heroBee} pointerEvents="none">
              <Svg width={52} height={28} viewBox="0 0 66 40">
                <Path
                  d="M2 34 C 16 30, 20 12, 40 12"
                  fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.3}
                  strokeDasharray="2.5 3.5" strokeLinecap="round"
                />
              </Svg>
              <Image source={VILLIE_BEE} resizeMode="contain" style={styles.heroBeeImg} />
            </View>

            <View style={styles.heroTopRow}>
              <View style={styles.heroPin}>
                <Svg width={13} height={13} viewBox="0 0 24 24">
                  <Path
                    d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"
                    stroke={HERO_INK} strokeWidth={2} fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                  <Circle cx={12} cy={10} r={3} stroke={HERO_INK} strokeWidth={2} fill="none" />
                </Svg>
                <Text style={styles.heroPinText} numberOfLines={1}>{locationLine.toLowerCase()}</Text>
              </View>

              <TouchableOpacity
                style={styles.mapBtn}
                accessibilityRole="button"
                accessibilityLabel={es ? 'Mapa de donantes' : 'Donor map'}
                onPress={goMap}
                activeOpacity={0.85}
              >
                <Svg width={17} height={17} viewBox="0 0 24 24">
                  <Path
                    d="M9 20l-5.5 2V6L9 4m0 16l6-2m-6 2V4m6 14l5.5 2V4l-5.5 2m0 12V6m0 0L9 4"
                    stroke={HERO_INK} strokeWidth={1.9} fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>

            <Text style={styles.heroTitle}>{es ? 'tu aldea' : 'your village'}</Text>
            <Text style={styles.heroSub}>
              {es ? 'todo lo que te rodea, en un solo lugar' : 'everyone close to you, in one place'}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Lifted cream sheet — slides up over the pinned masthead. */}
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {/* The four pillars — the illustrated icon leads, the tile's tint
              carries the pillar's identity. */}
          <View style={styles.grid}>
            {VERTICALS.map((v) => (
              <TouchableOpacity
                key={v.title}
                onPress={v.route === 'Village' ? goAllPlans : () => goVertical(v.route)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={v.title}
                style={[styles.cell, { width: cellW }]}
              >
                <LinearGradient
                  colors={v.tile}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.tile, { borderColor: `${v.tone}2E` }]}
                >
                  <View style={styles.tileTop}>
                    <View style={[styles.iconBadge, { backgroundColor: `${v.tone}1F`, borderColor: `${v.tone}33` }]}>
                      <PillarGlyph name={v.glyph} color={v.tone} />
                    </View>
                    {v.isNew && (
                      <View style={styles.newDot}>
                        <Text style={[styles.newDotText, { color: v.tone }]}>{es ? 'nuevo' : 'new'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tileTitle} numberOfLines={1}>{v.title}</Text>
                  <Text style={styles.tileSub} numberOfLines={2}>{v.sub}</Text>
                  <View style={styles.tileArrow}>
                    <ArrowRight color={v.tone} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* What's on — the part of the Village only this tab owns. */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{es ? 'qué hay cerca' : "what's on"}</Text>
            <TouchableOpacity onPress={goAllPlans} accessibilityRole="button" activeOpacity={0.7}
              accessibilityLabel={es ? 'Ver todos los planes' : 'See all plans'}>
              <Text style={styles.sectionLink}>{es ? 'ver todo' : 'see all'}</Text>
            </TouchableOpacity>
          </View>

          {featured ? (
            <>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => goEvent(featured.id)}
                accessibilityRole="button"
                accessibilityLabel={featured.title}
                style={styles.eventCard}
              >
                {featured.cover_image_url ? (
                  <Image source={{ uri: featured.cover_image_url }} style={styles.eventCover} resizeMode="cover" />
                ) : (
                  <LinearGradient
                    colors={['#F4C64A', '#E8873A']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.eventCover, styles.eventCoverFallback]}
                  >
                    <PillarGlyph name="plans" color="#FFFCF6" size={46} />
                  </LinearGradient>
                )}
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{featured.title}</Text>
                  <View style={styles.eventFooterRow}>
                    <Text style={styles.eventMeta} numberOfLines={1}>{eventMeta(featured)}</Text>
                    <View style={styles.joinBtn}>
                      <Text style={styles.joinText}>{es ? 'ver' : 'see it'}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>

              {rest.map((e) => {
                const { wd, day } = dayParts(e.starts_at);
                return (
                  <TouchableOpacity
                    key={e.id}
                    activeOpacity={0.75}
                    onPress={() => goEvent(e.id)}
                    accessibilityRole="button"
                    accessibilityLabel={e.title}
                    style={styles.eventRow}
                  >
                    <View style={styles.dayChip}>
                      <Text style={styles.dayWd}>{wd}</Text>
                      <Text style={styles.dayNum}>{day}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.eventRowTitle} numberOfLines={1}>{e.title}</Text>
                      <Text style={styles.eventRowMeta} numberOfLines={1}>{eventMeta(e)}</Text>
                    </View>
                    <ArrowRight color={T.honey} />
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <TouchableOpacity
              style={styles.eventEmpty}
              activeOpacity={0.85}
              onPress={goAllPlans}
              accessibilityRole="button"
              accessibilityLabel={es ? 'Ver todos los planes' : 'Browse all plans'}
            >
              <Text style={styles.eventEmptyText}>
                {es
                  ? 'Todavía no hay encuentros cerca de ti.'
                  : 'No gatherings near you just yet.'}
              </Text>
              <Text style={styles.eventEmptyLink}>{es ? 'ver todos los planes ›' : 'browse all plans ›'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[styles.miniBar, { height: insets.top + 44, opacity: miniOpacity }]}
      >
        <Text style={[styles.miniTitle, { marginTop: insets.top }]} numberOfLines={1}>
          {es ? 'tu aldea' : 'your village'}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.sheet, overflow: 'hidden' },
  miniBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: T.sheet, justifyContent: 'center', paddingHorizontal: SHEET_PAD,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  miniTitle: {
    fontFamily: FONTS.v2_display, fontSize: 17, color: T.cocoa, letterSpacing: -0.3,
    height: 44, lineHeight: 44,
  },
  scroll: { paddingTop: 0, paddingBottom: 0 },

  // ── Masthead ────────────────────────────────────────────────────────
  hero: { paddingHorizontal: 22, paddingBottom: 44, overflow: 'hidden' },
  heroBee: { position: 'absolute', top: 92, right: 30, flexDirection: 'row', alignItems: 'flex-start' },
  heroBeeImg: { width: 26, height: 26, marginLeft: -6, marginTop: -3 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroPin: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,252,246,0.55)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6, maxWidth: '70%',
  },
  heroPinText: {
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: HERO_INK, flexShrink: 1,
  },
  mapBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,252,246,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: FONTS.v2_display, fontSize: 38, lineHeight: 44,
    color: HERO_INK, letterSpacing: -1, marginTop: 26,
  },
  heroSub: {
    fontFamily: FONTS.v2_body, fontSize: 13.5, color: HERO_INK_SOFT, marginTop: 4, maxWidth: '78%',
  },

  // ── The lifted sheet ────────────────────────────────────────────────
  sheet: {
    marginTop: -26, paddingHorizontal: SHEET_PAD, paddingTop: 6, paddingBottom: 120,
    backgroundColor: T.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30,
    shadowColor: T.walnut, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 8,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#EBDCC2', alignSelf: 'center', marginTop: 6, marginBottom: 18 },

  // ── Pillar tiles ────────────────────────────────────────────────────
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: TILE_GAP, columnGap: TILE_GAP },
  // flexBasis + grow, NOT a fixed percentage: with `columnGap` the two tiles
  // plus the gap have to fit the content width, and `width: '48.4%'` overflowed
  // it by well under a point (173.3 × 2 + 12 > 358) — enough to wrap every
  // second tile into its own row. A basis under half the width can always seat
  // two, and grow divides the leftover exactly, at any screen size.
  cell: {},
  tile: {
    borderRadius: 20, padding: 13, borderWidth: 1, overflow: 'hidden',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 2,
  },
  // Badge + glyph replaces the full-bleed illustration: a smaller, quieter
  // mark keeps the tile about the words until the designer's art arrives.
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconBadge: {
    width: 50, height: 50, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  newDot: {
    backgroundColor: 'rgba(255,252,246,0.94)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2.5, marginTop: 2,
  },
  newDotText: {
    fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: '600',
  },
  // The arrow gets its own row. Sharing one with the subtitle meant the tile
  // with the longest sub ("hand-me-downs from moms") pushed it off the edge.
  tileArrow: { alignSelf: 'flex-end', marginTop: 6 },
  tileTitle: { fontFamily: FONTS.v2_display, fontSize: 16.5, color: T.cocoa, letterSpacing: -0.4, marginTop: 14 },
  // Two lines reserved everywhere so a one-line sub ('your stash + peer milk')
  // and a two-line one ('doctors, doulas, lactation') keep their feet aligned.
  tileSub: {
    fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 15, minHeight: 30,
    color: T.walnut, marginTop: 2,
  },

  // ── What's on ───────────────────────────────────────────────────────
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 30, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  sectionTitle: { fontFamily: FONTS.v2_display, fontSize: 21, color: T.cocoa, letterSpacing: -0.5 },
  sectionLink: {
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.roseInk, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '600',
  },

  eventCard: {
    marginTop: 14, borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.1)',
    backgroundColor: T.paper,
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10, shadowRadius: 14, elevation: 2,
  },
  eventCover: { width: '100%', height: 116 },
  eventCoverFallback: { alignItems: 'center', justifyContent: 'center' },
  eventCoverIcon: { width: 70, height: 70, opacity: 0.92 },
  eventBody: { padding: 14 },
  eventTitle: { fontFamily: FONTS.v2_display, fontSize: 19, lineHeight: 23, color: T.cocoa, letterSpacing: -0.4 },
  eventFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  eventMeta: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut },
  joinBtn: { backgroundColor: T.rose, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  joinText: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: '#FFFCF6', fontWeight: '500' },

  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.07)',
  },
  dayChip: {
    width: 42, height: 50, borderRadius: 12, backgroundColor: '#FBE6C8',
    alignItems: 'center', justifyContent: 'center',
  },
  dayWd: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase', color: '#A8701A', fontWeight: '600' },
  dayNum: { fontFamily: FONTS.v2_display, fontSize: 19, color: T.cocoa, lineHeight: 22 },
  eventRowTitle: { fontFamily: FONTS.v2_link, fontSize: 14, color: T.cocoa, fontWeight: '500' },
  eventRowMeta: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 2 },

  eventEmpty: {
    marginTop: 14, borderRadius: 16, padding: 20,
    backgroundColor: T.cream, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  eventEmptyText: { fontFamily: FONTS.v2_body, fontSize: 13, color: T.walnut, textAlign: 'center' },
  eventEmptyLink: {
    marginTop: 8, fontFamily: FONTS.v2_mono, fontSize: 10,
    letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: '600', color: T.roseInk,
  },
});
