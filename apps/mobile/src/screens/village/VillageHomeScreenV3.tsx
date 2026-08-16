// VillageHomeScreenV3 — v3 brand kit Village rebuild.
//
// Grid + events layout (approved 2026-07-10). Top: the four verticals as a
// 2×2 grid, with the reworked **Milk Hub** tile (was "Milk Connect") reflecting
// the vault unification. Below: a leaned-in **events** block — a featured
// gathering + upcoming rows, wired to the live events store — because local
// community (meetups, circles, classes) is what the Village tab uniquely owns.

import React, { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image,
  StyleProp, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  rose:      '#E14A32',
  roseInk:   '#B03A22',
  honey:     '#DA9A2C',
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
// Unified NEUTRAL tiles — the colourful illustrated icon badge does the talking
// (founder 2026-08-16), not a rainbow of tile colours. Milk + Care have real
// illustrated icons; Gear + Plans use a placeholder line glyph until their real
// icons land. `route` is the TAB name (goVertical cross-tabs via getParent()).
const MILK_ICON = require('../../../assets/village/milk-hub-icon.png');
const CARE_ICON = require('../../../assets/village/care-icon.png');
const GLYPH: Record<string, string> = {
  bag: 'M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 016 0v2',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
};

type Vertical = {
  title: string;
  route: string;
  icon?: number;              // require() asset — the illustrated badge
  glyph?: keyof typeof GLYPH; // fallback line glyph until a real icon exists
  isNew?: boolean;
};

const VERTICALS: Vertical[] = [
  { title: 'Milk Hub',     icon: MILK_ICON,   route: 'Milk',    isNew: true },
  { title: 'Care',         icon: CARE_ICON,   route: 'Experts' },
  { title: 'Baby Gear',    glyph: 'bag',      route: 'Gear'    },
  { title: 'Villie Plans', glyph: 'calendar', route: 'Village' },
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
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

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
  const locationLine = geoCity ?? (lang === 'es' ? 'Cerca de ti' : 'Near you');

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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Quiet header — an eyebrow, not a big bold headline (founder 2026-08-16) */}
        <View style={styles.header}>
          <Eyebrow>{lang === 'es' ? 'tu aldea' : 'your village'}</Eyebrow>
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

        {/* 2×2 vertical grid — unified tiles, illustrated icon badges */}
        <View style={styles.gridWrap}>
          {VERTICALS.map((v) => (
            <TouchableOpacity
              key={v.title}
              onPress={v.route === 'Village' ? goAllPlans : () => goVertical(v.route)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={v.title}
              style={styles.tile}
            >
              {v.isNew && (
                <View style={styles.tileBadge}>
                  <Text style={styles.tileBadgeText}>new</Text>
                </View>
              )}
              <View style={styles.iconBadge}>
                {v.icon ? (
                  <Image source={v.icon} style={styles.badgeImg} resizeMode="cover" />
                ) : (
                  <Svg width={26} height={26} viewBox="0 0 24 24">
                    <Path d={GLYPH[v.glyph!]} stroke="#B08A5E" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </View>
              <Text style={styles.tileTitle}>{v.title}</Text>
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

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF4E6', overflow: 'hidden' },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 96 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  mapBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: T.parchment,
    alignItems: 'center', justifyContent: 'center',
  },

  gridWrap: {
    marginTop: 16,
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  // One unified neutral tile — the illustrated icon badge carries the colour.
  tile: {
    width: '48%', minHeight: 128,
    padding: 16,
    borderRadius: 18, overflow: 'hidden',
    justifyContent: 'flex-start',
    backgroundColor: '#FDF7EF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.12)',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 2,
  },
  iconBadge: {
    width: 56, height: 56, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#F2E7D6', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  badgeImg: { width: 56, height: 56 },
  tileBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(255,252,246,0.85)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  tileBadgeText: {
    fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: '600', color: '#C24A63',
  },
  tileTitle: {
    fontFamily: FONTS.v3_display, fontSize: 21, lineHeight: 24,
    color: T.cocoa, letterSpacing: -0.5,
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
  eventCoverFallback: { backgroundColor: '#DA9A2C', alignItems: 'center', justifyContent: 'center' },
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
