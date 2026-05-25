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
import { useEventsStore } from '@store/events';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';

// ─── Tokens (v3 brand kit) ─────────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,      // #FDFBF6
  cream:     COLORS.v2_cream,      // #F4ECD8
  parchment: COLORS.v2_parchment,  // #EAE0C8
  butter:    COLORS.v2_butter,     // #FAD080
  cinnamon:  COLORS.v2_cinnamon,   // #C07840
  blush:     COLORS.v2_blush,      // #F5BEB6
  salmon:    COLORS.v2_salmon,     // #EDA8A0
  sage:      COLORS.v2_sage,       // #D8CEB0
  moss:      COLORS.v2_moss,       // #606E46
  cocoa:     COLORS.v2_cocoa,      // #3D1F0E
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
  { num: '02', title: 'Specialists',  sub: 'OB, doula, lactation, sleep.',  stat: '12 verified',   bg: T.sage,      route: 'Experts' },
  { num: '03', title: 'Baby Gear',    sub: 'Hand-me-downs from real moms.', stat: '37 listed',     bg: T.butter,    route: 'Gear' },
  { num: '04', title: 'Villie Plans', sub: 'Classes, circles, real coffee.',stat: '5 this week',   bg: T.parchment, route: 'Village' },
];

// Calendar fallback — static handoff data, used only when the live
// events store returns nothing (cold start / empty feed). Once
// useEventsStore.fetchUpcoming resolves with real events, the live
// rows replace these placeholders via formatPlanRow below.
// id: null on placeholders → calendar-row tap falls back to "All plans"
// (full events list) since there's no real event row to drill into.
const PLACEHOLDER_PLANS: Array<{
  id: string | null; day: string; date: string; time: string;
  name: string; loc: string; going: number;
}> = [
  { id: null, day: 'TUE', date: '19', time: '9:00 AM',  name: 'Postpartum yoga',        loc: 'Prospect Park · 1.2mi',      going: 12 },
  { id: null, day: 'THU', date: '21', time: '10:30 AM', name: 'Sensory play, 0–9m',     loc: 'Park Slope library · 0.6mi', going: 8 },
  { id: null, day: 'SAT', date: '23', time: '10:00 AM', name: 'Stroller walk + coffee', loc: '7th & Smith · 0.9mi',        going: 24 },
];

// Format a live EventCard into the calendar row shape used by the
// render block. Keeps the visual treatment identical between live +
// placeholder data so the screen never flickers structurally.
function formatPlanRow(e: { id?: string; starts_at: string; title: string; venue_name: string | null; city: string | null; distance_km: number | null; going_count: number; timezone?: string }, lang: 'en' | 'es') {
  const d = new Date(e.starts_at);
  const dayNames = lang === 'es'
    ? ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']
    : ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const hour12 = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  const time = `${hour12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
  const distance = e.distance_km != null
    ? ` · ${(e.distance_km * 0.621371).toFixed(1)}mi`
    : '';
  const loc = `${e.venue_name ?? e.city ?? 'TBD'}${distance}`;
  return {
    id: e.id ?? null,
    day: dayNames[d.getDay()],
    date: String(d.getDate()),
    time,
    name: e.title,
    loc,
    going: e.going_count,
  };
}

// ─── Screen ────────────────────────────────────────────────────────────
export default function VillageHomeScreenV3() {
  const navigation = useNavigation<any>();
  const profile = useUserStore((s) => s.profile);
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

  // Location line — neighborhood + count are placeholder; wire to
  // `users.zip_code` reverse-geocode + count-in-radius RPC in follow-up.
  const locationLine = lang === 'es'
    ? 'Brooklyn, NY · 62 en tu radio'
    : 'Brooklyn, NY · 62 in your radius';

  const goVertical = (route: string) => {
    navigation.getParent()?.navigate(route as never);
  };
  // Wired 2026-05-25 nav audit — these were dead handlers / display-only
  // Views before. Now the calendar plan rows + "All plans →" link route
  // to the events list within the Village stack; the map-pin button
  // routes to the donor map (only map surface in the app today) as the
  // closest sensible destination.
  const goAllPlans   = () => navigation.navigate('EventsList' as never);
  const goPlanDetail = (eventId: string) =>
    navigation.navigate('EventDetail' as never, { id: eventId } as never);
  const goMap        = () =>
    navigation.getParent()?.navigate('Milk' as never, { screen: 'DonorMap' } as never);

  const scrollY = useRef(new Animated.Value(0)).current;
  const [triggerAnim, setTriggerAnim] = useState(0);

  // Live events feed — fetches on focus, falls back to PLACEHOLDER_PLANS
  // when the store is empty (cold start, no events in radius, or error).
  const upcomingEvents = useEventsStore((s) => s.upcoming);
  const fetchUpcoming = useEventsStore((s) => s.fetchUpcoming);
  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      // Fire-and-forget refresh — store handles its own loading state +
      // error logging. Cap to 3 so we don't overflow the small preview
      // list on the page.
      fetchUpcoming().catch(() => {});
      return () => {};
    }, [fetchUpcoming]),
  );

  // Format the live events into row shape; fall back to handoff placeholders
  // when the store hasn't returned anything yet (or there are no upcoming
  // events near the user).
  const planRows = upcomingEvents.length > 0
    ? upcomingEvents.slice(0, 3).map((e) => formatPlanRow(e, lang))
    : PLACEHOLDER_PLANS;

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={triggerAnim} />
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

        {/* Eyebrow + headline */}
        <View style={{ marginTop: 22 }}><Eyebrow>{lang === 'es' ? 'Refuerzos' : 'Reinforcements'}</Eyebrow></View>
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
              onPress={() => goVertical(v.route)}
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

        {/* On the calendar */}
        <View style={{ marginTop: 28 }}>
          <View style={styles.sectionHead}>
            <Eyebrow>{lang === 'es' ? 'En el calendario' : 'On the calendar'}</Eyebrow>
            <TouchableOpacity accessibilityRole="link" onPress={goAllPlans}>
              <Text style={styles.sectionLink}>
                {lang === 'es' ? 'Todos →' : 'All plans →'}
              </Text>
            </TouchableOpacity>
          </View>
          {planRows.map((e, i) => {
            const isLast = i === planRows.length - 1;
            // Tappable when we have a real event id from the store;
            // placeholder rows (no id) tap to the full events list as
            // the next-best destination. Both routes live in this
            // Village stack so the back button returns here.
            const onPress = e.id
              ? () => goPlanDetail(e.id!)
              : goAllPlans;
            return (
              <TouchableOpacity
                key={`${e.date}-${i}`}
                onPress={onPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${e.name} · ${e.time}`}
                style={[styles.calRow, { borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth }]}
              >
                <View style={styles.calDayBlock}>
                  <Text style={styles.calDayName}>{e.day}</Text>
                  <Text style={styles.calDayNum}>{e.date}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.calName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.calMeta} numberOfLines={1}>{e.time} · {e.loc}</Text>
                </View>
                <Text style={styles.calGoing}>
                  <Text style={styles.calGoingNum}>{e.going}</Text> {lang === 'es' ? 'van' : 'going'}
                </Text>
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
    fontFamily: FONTS.v3_display, fontSize: 44, lineHeight: 44,
    color: T.cocoa, letterSpacing: -1.76,
    marginTop: 14,
  },
  headlineItalic: {
    fontFamily: FONTS.v3_display_italic, color: T.salmon,
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
