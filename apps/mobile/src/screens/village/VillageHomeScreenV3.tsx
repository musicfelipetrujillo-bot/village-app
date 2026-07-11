// VillageHomeScreenV3 — v3 brand kit Village rebuild.
//
// Grid + events layout (approved 2026-07-10). Top: the four verticals as a
// 2×2 grid, with the reworked **Milk Hub** tile (was "Milk Connect") reflecting
// the vault unification. Below: a leaned-in **events** block — a featured
// gathering + upcoming rows, wired to the live events store — because local
// community (meetups, circles, classes) is what the Village tab uniquely owns.

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useUserStore } from '@store/user';
import { useEventsStore } from '@store/events';
import { formatDistance, type EventCard } from '@api/events';
import { useT } from '@/i18n';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { HoneycombBackdrop } from '@components/shared/HoneycombBackdrop';

// ─── Tokens (v3 brand kit, elevated rose+honey) ───────────────────────
const T = {
  paper:     COLORS.v2_paper,
  cream:     COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  cocoa:     COLORS.v2_cocoa,
  walnut:    COLORS.v2_walnut,
  rose:      '#E06A88',
  roseInk:   '#C2556F',
  honey:     '#F5C842',
  rule:      'rgba(61,31,14,0.13)',
};

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

const ArrowRight = ({ color }: { color: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M5 12h14M13 5l7 7-7 7" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Verticals ─────────────────────────────────────────────────────────
// `route` is the TAB name (goVertical cross-tabs via getParent().navigate).
type Vertical = {
  title: string;
  sub: string;
  stat: string;
  bg: string;
  ink: string;
  route: string;
  isNew?: boolean;
};

const VERTICALS: Vertical[] = [
  { title: 'Milk Hub',     sub: 'Your stash, plus peer milk.',    stat: 'track · share · find', bg: '#F7C5CB', ink: '#9B4B60', route: 'Milk',    isNew: true },
  { title: 'Specialists',  sub: 'OB, doula, lactation, sleep.',   stat: '12 verified',          bg: '#F3B79C', ink: '#8A4A2E', route: 'Experts' },
  { title: 'Baby Gear',    sub: 'Hand-me-downs from real moms.',  stat: '37 listed',            bg: '#F5C842', ink: '#8A6A1E', route: 'Gear'    },
  { title: 'Villie Plans', sub: 'Classes, circles, real coffee.', stat: '5 this week',          bg: '#EFB2C8', ink: '#94436A', route: 'Village' },
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
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

  const upcoming = useEventsStore((s) => s.upcoming);
  const fetchUpcoming = useEventsStore((s) => s.fetchUpcoming);

  const locationLine = lang === 'es'
    ? 'Brooklyn, NY · 62 cerca de ti'
    : 'Brooklyn, NY · 62 nearby';

  const goVertical = (route: string) => navigation.getParent()?.navigate(route as never);
  const goAllPlans = () => navigation.navigate('EventsList' as never);
  const goEvent = (id: string) => navigation.navigate('EventDetail' as never, { id } as never);
  const goMap = () =>
    navigation.getParent()?.navigate('Milk' as never, { screen: 'DonorMap' } as never);

  const scrollY = useRef(new Animated.Value(0)).current;
  const [triggerAnim, setTriggerAnim] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      fetchUpcoming().catch(() => {});
      return () => {};
    }, [fetchUpcoming]),
  );

  const featured = upcoming[0];
  const rest = upcoming.slice(1, 3);

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={triggerAnim} />
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

        <View style={{ marginTop: -10 }}><Eyebrow>{lang === 'es' ? 'Refuerzos' : 'Reinforcements'}</Eyebrow></View>
        <Text style={styles.headline}>
          {lang === 'es' ? 'Tu refuerzo está ' : 'Your backup is '}
          <Text style={styles.headlineItalic}>{lang === 'es' ? 'aquí.' : 'here.'}</Text>
        </Text>
        <Text style={styles.locMono}>{locationLine}</Text>

        {/* 2×2 vertical grid */}
        <View style={styles.gridWrap}>
          {VERTICALS.map((v) => (
            <TouchableOpacity
              key={v.title}
              onPress={v.route === 'Village' ? goAllPlans : () => goVertical(v.route)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={v.title}
              style={[styles.tile, { backgroundColor: v.bg }]}
            >
              <LinearGradient
                colors={['rgba(253,251,246,0.22)', 'rgba(253,251,246,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.42 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
                pointerEvents="none"
              />
              {v.isNew && (
                <View style={styles.tileBadge}>
                  <Text style={[styles.tileBadgeText, { color: v.ink }]}>new</Text>
                </View>
              )}
              <View>
                <Text style={styles.tileTitle}>{v.title}.</Text>
                <Text style={[styles.tileSub, { color: v.ink }]}>{v.sub}</Text>
              </View>
              <View style={[styles.tileFooter, { borderTopColor: hexAlpha(v.ink, 0.28) }]}>
                <Text style={[styles.tileStat, { color: v.ink }]}>{v.stat}</Text>
                <ArrowRight color={v.ink} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Events — the leaned-in local block */}
        <View style={{ marginTop: 28 }}>
          <View style={styles.sectionHead}>
            <Eyebrow>{lang === 'es' ? 'Esta semana' : 'Happening this week'}</Eyebrow>
            <TouchableOpacity onPress={goAllPlans} accessibilityRole="button">
              <Text style={styles.sectionLink}>{lang === 'es' ? 'ver todo' : 'see all'}</Text>
            </TouchableOpacity>
          </View>

          {featured ? (
            <>
              <TouchableOpacity
                style={styles.eventCard}
                activeOpacity={0.92}
                onPress={() => goEvent(featured.id)}
                accessibilityRole="button"
                accessibilityLabel={featured.title}
              >
                {featured.cover_image_url ? (
                  <Image source={{ uri: featured.cover_image_url }} style={styles.eventCover} resizeMode="cover" />
                ) : (
                  <View style={[styles.eventCover, styles.eventCoverFallback]}>
                    <Svg width={34} height={34} viewBox="0 0 24 24">
                      <Path d="M8 2v3M16 2v3M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                        stroke="#B98A1E" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                )}
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{featured.title}</Text>
                  <View style={styles.eventFooterRow}>
                    <Text style={styles.eventMeta} numberOfLines={1}>{eventMeta(featured)}</Text>
                    <View style={styles.joinBtn}><Text style={styles.joinText}>{lang === 'es' ? 'Unirme' : 'Join'}</Text></View>
                  </View>
                </View>
              </TouchableOpacity>

              {rest.map((e) => {
                const dp = dayParts(e.starts_at);
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.eventRow}
                    activeOpacity={0.85}
                    onPress={() => goEvent(e.id)}
                    accessibilityRole="button"
                    accessibilityLabel={e.title}
                  >
                    <View style={styles.dayChip}>
                      <Text style={styles.dayWd}>{dp.wd}</Text>
                      <Text style={styles.dayNum}>{dp.day}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.eventRowTitle} numberOfLines={1}>{e.title}</Text>
                      <Text style={styles.eventRowMeta} numberOfLines={1}>{eventMeta(e)}</Text>
                    </View>
                    <ArrowRight color="#C9B79F" />
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <TouchableOpacity style={styles.eventEmpty} onPress={goAllPlans} activeOpacity={0.85}>
              <Text style={styles.eventEmptyText}>
                {lang === 'es'
                  ? 'Nada cerca de ti todavía — mira todos los planes.'
                  : "Nothing near you yet — browse all plans."}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// Small hex→rgba helper for tile hairlines (ink at low alpha).
function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper, overflow: 'hidden' },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 96 },

  header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  mapBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: T.parchment,
    alignItems: 'center', justifyContent: 'center',
  },

  headline: {
    fontFamily: FONTS.v3_display, fontSize: 44, lineHeight: 52,
    color: T.cocoa, letterSpacing: -1.76, marginTop: 14,
  },
  headlineItalic: {
    fontFamily: FONTS.v3_display_italic, color: '#E98A6A',
    fontSize: 54, lineHeight: 52,
  },
  locMono: {
    marginTop: 12,
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.walnut, letterSpacing: 2.0,
    textTransform: 'uppercase', fontWeight: '500',
  },

  gridWrap: {
    marginTop: 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  tile: {
    width: '48%', minHeight: 150,
    padding: 16, paddingBottom: 14,
    borderRadius: 14, overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 26, elevation: 3,
  },
  tileBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(255,252,246,0.72)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  tileBadgeText: {
    fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: '600',
  },
  tileTitle: {
    fontFamily: FONTS.v3_display, fontSize: 23, lineHeight: 24,
    color: T.cocoa, letterSpacing: -0.67,
  },
  tileSub: { fontFamily: FONTS.v2_body, fontSize: 12, marginTop: 6, lineHeight: 16.5 },
  tileFooter: {
    marginTop: 12, paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tileStat: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: '600',
  },

  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  sectionLink: {
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.roseInk, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '600',
  },

  eventCard: {
    marginTop: 14, borderRadius: 16, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.1)',
    backgroundColor: T.paper,
  },
  eventCover: { width: '100%', height: 96 },
  eventCoverFallback: { backgroundColor: '#F5C842', alignItems: 'center', justifyContent: 'center' },
  eventBody: { padding: 13 },
  eventTitle: { fontFamily: FONTS.v3_display, fontSize: 20, color: T.cocoa, letterSpacing: -0.4 },
  eventFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  eventMeta: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut },
  joinBtn: { backgroundColor: T.rose, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  joinText: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: '#FFFCF6', fontWeight: '500' },

  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.07)',
  },
  dayChip: {
    width: 42, height: 50, borderRadius: 11, backgroundColor: '#FDECEF',
    alignItems: 'center', justifyContent: 'center',
  },
  dayWd: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase', color: T.roseInk, fontWeight: '600' },
  dayNum: { fontFamily: FONTS.v3_display, fontSize: 19, color: T.cocoa, lineHeight: 20 },
  eventRowTitle: { fontFamily: FONTS.v2_link, fontSize: 14, color: T.cocoa, fontWeight: '500' },
  eventRowMeta: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 2 },

  eventEmpty: {
    marginTop: 14, borderRadius: 14, padding: 18,
    backgroundColor: T.cream, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  eventEmptyText: { fontFamily: FONTS.v2_body, fontSize: 13, color: T.walnut, textAlign: 'center' },
});
