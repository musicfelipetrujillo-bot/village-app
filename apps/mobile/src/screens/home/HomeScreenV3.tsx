// HomeScreenV3 — v3 brand kit "lean editorial" Home.
//
// 2026-06-19 layout (Felipe-approved):
//   warm masthead greeting (full-bleed brown→cream gradient)
//   → THIS WEEK'S MANUAL hero card (pill header + milestone blurb +
//     journey progress + dark "what to expect" button)
//   → daily check-in pill
//   → YOUR VILLAGE quick-nav row (5 round tiles)
//   → DISCOVER row (Villie Boxes + this week's 5)
//   → your corner (filled coral→rose mom card)
//
// Differentiated card sizes + a hero masthead so the page reads as a
// designed home, not a uniform stack of hero boxes. Reuses the production
// data hooks (useUserStore profile, useHomeStore babyProfile, milestones)
// so the live screen shows real user state.

import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, PLACEHOLDER_BABY_NAME } from '@utils/constants';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { usePicksStore } from '@store/picks';
import { useT } from '@/i18n';
import { homeApi, type Milestone } from '@api/home';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { DailyCheckinStrip } from '@components/shared/DailyCheckinStrip';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { useFocusEffect } from '@react-navigation/native';

// villie-bee.png — the bee mascot. Rides the manual card's progress track
// as the "you are here" waypoint on the 52-week journey.
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');
const VILLIE_WORDMARK = require('../../../assets/brand/villie-wordmark-trim.png');

// ─── Tokens (v3 brand kit) ─────────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,      // #FFFCF6
  cream:     COLORS.v2_cream,      // #FCF7EF
  butter:    COLORS.v2_butter,     // #F4C53C
  marigold:  COLORS.v2_marigold,   // #F4C53C
  cinnamon:  COLORS.v2_cinnamon,   // #D96C88
  caramel:   COLORS.v2_caramel,    // #E98A6A
  blush:     COLORS.v2_blush,      // #F7C5CB
  salmon:    COLORS.v2_salmon,     // #F7C5CB
  cocoa:     COLORS.v2_cocoa,      // #43260F
  walnut:    COLORS.v2_walnut,     // #7A4A28
  rule:      'rgba(61,31,14,0.13)',
};

// ─── Helpers ───────────────────────────────────────────────────────────
function greetingForHour(hour: number, lang: 'en' | 'es'): string {
  if (lang === 'es') {
    if (hour < 5) return 'buenas noches';
    if (hour < 12) return 'buenos días';
    if (hour < 18) return 'buenas tardes';
    return 'buenas noches';
  }
  if (hour < 5) return 'good evening';
  if (hour < 12) return 'good morning';
  if (hour < 18) return 'good afternoon';
  return 'good evening';
}

// "29th", "1st", "22nd" — ordinal suffix for the week-number title.
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// A warm journey-POSITION caption — names where the mom is in baby's first
// year in human terms (no developmental claim, so it stays true + gentle).
function journeyNote(week: number): string {
  if (week <= 6)  return 'the fourth trimester';
  if (week <= 17) return 'the early months';
  if (week <= 25) return 'almost halfway';
  if (week <= 34) return 'just past halfway';
  if (week <= 45) return 'the back half';
  return 'almost one';
}

// ─── Icon paths (24×24, stroke) ────────────────────────────────────────
const ICON = {
  book:        'M5 4h11a1 1 0 011 1v15H7a3 3 0 00-3 3V6a2 2 0 012-2z',
  droplet:     'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  stethoscope: 'M6 3v6a4 4 0 008 0V3M5 3h2m6 0h2m-3 11v2a5 5 0 0010 0v-1m-1-2a2 2 0 100-4 2 2 0 000 4z',
  bag:         'M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 016 0v2',
  calendar:    'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  gift:        'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M8.5 7C6.6 7 5.5 4 7 3.2 8.6 2.4 12 7 12 7m0 0s3.4-4.6 5-3.8C18.5 4 17.4 7 15.5 7',
  star:        'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 17l-5.4 2.9 1.2-6.1L3.3 9.4l6.1-.8L12 3z',
} as const;

function Glyph({ d, color = '#43260F', size = 22, sw = 2 }: { d: string; color?: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Shared atoms ──────────────────────────────────────────────────────
function Eyebrow({ children, color = T.walnut, style }: { children: React.ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ width: 16, height: 1.5, backgroundColor: color, marginRight: 8 }} />
      <Text style={{
        fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
        textTransform: 'uppercase', fontWeight: '500', color,
      }}>{children}</Text>
    </View>
  );
}

function CornerBee({ size = 26, rotate = 0, style }: { size?: number; rotate?: number; style?: any }) {
  return (
    <Image source={VILLIE_BEE} resizeMode="contain" accessible={false}
      style={[{ width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }, style]} />
  );
}

// ─── Masthead greeting (full-bleed warm gradient) ──────────────────────
function HomeGreeting({ firstName }: { firstName: string }) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const greet = greetingForHour(new Date().getHours(), lang);
  const now = new Date();
  const days = lang === 'es' ? ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const mons = lang === 'es'
    ? ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    : ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const dateLabel = `${days[now.getDay()]} · ${mons[now.getMonth()]} ${now.getDate()}`;
  return (
    <View style={styles.masthead}>
      {/* Soft honey glow — a warm radial breath at the top edge (no muddy band).
          Type carries the header; the greeting is cocoa-on-cream, the name the
          single rose accent. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id="homeGlow" cx="44%" cy="0%" r="75%">
            <Stop offset="0" stopColor="#FBE4B8" stopOpacity={0.9} />
            <Stop offset="0.5" stopColor="#FBE4B8" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FBE4B8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeGlow)" />
      </Svg>

      <Image source={VILLIE_WORDMARK} resizeMode="stretch" accessibilityLabel="villie" style={styles.mastheadLogo} />

      <View style={styles.mastheadEyebrowRow}>
        <View style={styles.mastheadEyebrowBar} />
        <Text style={styles.mastheadEyebrow}>{dateLabel}</Text>
      </View>
      <Text style={styles.mastheadText} numberOfLines={2}>
        {greet},{'\n'}<Text style={styles.mastheadName}>{firstName}</Text>
      </Text>
      <View style={styles.mastheadHairline} />
    </View>
  );
}

// ─── This week's manual hero card ──────────────────────────────────────
function ManualHeroCard({ babyName, weekNumber, hook, body, onPress }: {
  babyName: string;
  weekNumber: number;
  hook: string | null;
  body?: string | null;
  onPress: () => void;
}) {
  const pct = Math.max(0.04, Math.min(1, weekNumber / 52));
  const markerPct = Math.min(0.93, Math.max(0.06, pct));
  const blurb = hook ?? body ?? `tiny but mighty — see what's changing for ${babyName} this week.`;
  return (
    <TouchableOpacity activeOpacity={0.94} onPress={onPress} style={{ marginTop: 18 }}>
      <LinearGradient
        colors={['#F8CDD3', '#F6DFCC']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.manualCard}
      >
        <LinearGradient
          colors={['rgba(253,251,246,0.34)', 'rgba(253,251,246,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
          pointerEvents="none"
        />
        <GlassHighlight radius={22} height={14} />
        <View style={styles.manualHalo} pointerEvents="none" />

        <View style={styles.manualPillRow}>
          <View style={styles.manualPill}>
            <Glyph d={ICON.book} color="#fff" size={12} sw={2.2} />
            <Text style={styles.manualPillText}>this week's manual</Text>
          </View>
          <View style={styles.manualHex} pointerEvents="none">
            <Glyph d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" color="rgba(67,38,15,0.28)" size={20} sw={1.6} />
          </View>
        </View>

        <Text style={styles.manualTitle}>
          {babyName}'s <Text style={styles.manualTitleEm}>{ordinal(weekNumber)} week</Text>
        </Text>

        <Text style={styles.manualBlurb} numberOfLines={2}>{blurb}</Text>

        {/* Journey progress — the bee rides a cream pin as the waypoint. */}
        <View style={styles.manualProgress}>
          <View style={styles.manualTrack}>
            <View style={[styles.manualFill, { width: `${pct * 100}%` }]} />
          </View>
          <View style={[styles.manualBeePin, { left: `${markerPct * 100}%` }]}>
            <CornerBee size={24} rotate={-8} />
          </View>
        </View>

        <View style={styles.manualCtaBtn}>
          <Text style={styles.manualCtaText}>what to expect this week →</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Your village — 5 round quick-nav tiles ────────────────────────────
type Tile = { key: string; label: string; bg: string; icon: keyof typeof ICON; dot?: boolean; go: () => void };

function VillageTiles({ tiles, onAll }: { tiles: Tile[]; onAll: () => void }) {
  return (
    <View style={{ marginTop: 28 }}>
      <View style={styles.sectionHead}>
        <Eyebrow>your village</Eyebrow>
        <TouchableOpacity onPress={onAll} accessibilityRole="link">
          <Text style={styles.sectionLink}>All →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tileRow}>
        {tiles.map((t) => (
          <TouchableOpacity key={t.key} onPress={t.go} activeOpacity={0.85} style={styles.tile} accessibilityRole="button" accessibilityLabel={t.label}>
            <View style={[styles.tileChip, { backgroundColor: t.bg }]}>
              <Glyph d={ICON[t.icon]} color={T.cocoa} size={23} sw={1.9} />
              {t.dot ? <View style={styles.tileDot} /> : null}
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Discover — two feature cards (image-cap + caption) ────────────────
function DiscoverCard({ cap, capIcon, imageUrl, eyebrow, eyebrowColor, title, sub, onPress }: {
  cap: readonly [string, string]; capIcon: keyof typeof ICON; imageUrl?: string | null;
  eyebrow: string; eyebrowColor: string; title: string; sub: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.discCard} accessibilityRole="button" accessibilityLabel={title}>
      <LinearGradient colors={cap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.discCap}>
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          : <Glyph d={ICON[capIcon]} color="#fff" size={30} sw={1.9} />}
      </LinearGradient>
      <View style={styles.discBody}>
        <Text style={[styles.discEyebrow, { color: eyebrowColor }]} numberOfLines={1}>{eyebrow}</Text>
        <Text style={styles.discTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.discSub} numberOfLines={1}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DiscoverRow({ showBoxes, picksImage, onBoxes, onPicks }: { showBoxes: boolean; picksImage?: string | null; onBoxes: () => void; onPicks: () => void }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Eyebrow>discover</Eyebrow>
      <View style={styles.discoverRow}>
        {showBoxes && (
          <DiscoverCard
            cap={['#D96C88', '#C2556F']} capIcon="gift"
            eyebrow="new · curated" eyebrowColor={T.cinnamon}
            title="Villie Boxes" sub="delivery · newborn · mama"
            onPress={onBoxes}
          />
        )}
        <DiscoverCard
          cap={['#F4C53C', '#EAB52C']} capIcon="star" imageUrl={picksImage}
          eyebrow="villie picks" eyebrowColor="#A9761F"
          title="this week's 5" sub="tested, mom-approved"
          onPress={onPicks}
        />
      </View>
    </View>
  );
}

// ─── Your corner — filled coral→rose mom card ──────────────────────────
function MomCornerCard({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} accessibilityRole="button"
      accessibilityLabel={t('momHub.homeCardA11y')} style={{ marginTop: 26 }}>
      <LinearGradient colors={['#E98A6A', '#D96C88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cornerCard}>
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
          pointerEvents="none"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 16, height: 1.5, backgroundColor: 'rgba(255,255,255,0.85)', marginRight: 8 }} />
          <Text style={styles.cornerEyebrow}>{t('momHub.homeCardEyebrow')}</Text>
        </View>
        <Text style={styles.cornerTitle}>
          <Text style={styles.cornerTitleLead}>{t('momHub.titleLead')} </Text>
          <Text style={styles.cornerTitleEm}>{t('momHub.titleEm')}</Text>
        </Text>
        <Text style={styles.cornerBlurb}>{t('momHub.homeCardBlurb')}</Text>
        <View style={styles.cornerArrowBtn}>
          <Text style={styles.cornerArrow}>→</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Villie Boxes ships behind a flag (default OFF) until launch gates clear.
const VILLIE_BOXES_ENABLED = process.env.EXPO_PUBLIC_VILLIE_BOXES_ENABLED === '1';

// ─── Screen ────────────────────────────────────────────────────────────
export default function HomeScreenV3() {
  const navigation = useNavigation<any>();
  const profile = useUserStore((s) => s.profile);
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const currentMilestone = useHomeStore((s) => s.currentMilestone);

  // Villie Picks — fetch so the "this week's 5" discover card can use a real
  // pick photo as its cover (falls back to the star glyph until loaded).
  const picks = usePicksStore((s) => s.picks);
  const fetchPicks = usePicksStore((s) => s.fetchPicks);
  React.useEffect(() => { fetchPicks(); }, [fetchPicks]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Alana';
  const babyName = babyProfile?.baby_name ?? null;
  const weekNumber = babyProfile?.current_week_number ?? null;

  const heroBabyName = babyName ?? PLACEHOLDER_BABY_NAME;
  const heroWeek = weekNumber ?? 1;

  // Cross-tab nav uses the parent tab navigator; Boxes lives on the Home stack.
  const goTab = (route: string) => navigation.getParent()?.navigate(route as never);
  const goManual = () => navigation.navigate('Manual' as never);

  const tiles: Tile[] = [
    { key: 'milk',    label: 'Milk',    bg: '#F7C5CB', icon: 'droplet',     go: () => goTab('Milk') },
    { key: 'experts', label: 'Experts', bg: '#F3B79C', icon: 'stethoscope', go: () => goTab('Experts') },
    { key: 'gear',    label: 'Gear',    bg: '#F4C53C', icon: 'bag',         go: () => goTab('Gear') },
    { key: 'plans',   label: 'Plans',   bg: '#EFB2C8', icon: 'calendar',    go: () => goTab('Village') },
    ...(VILLIE_BOXES_ENABLED
      ? [{ key: 'boxes', label: 'Boxes', bg: '#E8C4B6', icon: 'gift', dot: true, go: () => navigation.navigate('BoxesHub' as never) } as Tile]
      : []),
  ];

  // Atmospheric backdrop — parallax bees + warm wash.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [triggerAnim, setTriggerAnim] = React.useState(0);

  // Live week milestones feed the manual card's blurb.
  const [weekMilestones, setWeekMilestones] = React.useState<Milestone[]>([]);
  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      if (weekNumber && weekNumber >= 1 && weekNumber <= 52) {
        homeApi.getMilestonesForWeek(weekNumber)
          .then(setWeekMilestones)
          .catch(() => setWeekMilestones([]));
      }
      return () => {};
    }, [weekNumber]),
  );

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={triggerAnim} />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <HomeGreeting firstName={firstName} />

        <ManualHeroCard
          babyName={heroBabyName}
          weekNumber={heroWeek}
          hook={weekMilestones[0]?.title ?? currentMilestone?.description ?? null}
          body={weekMilestones[0]?.description ?? currentMilestone?.description ?? null}
          onPress={goManual}
        />

        <View style={{ marginTop: 16 }}>
          <DailyCheckinStrip state="pending" onPress={() => navigation.navigate('DailyCheckin' as never)} />
        </View>

        <VillageTiles tiles={tiles} onAll={() => navigation.navigate('Village' as never)} />

        <DiscoverRow
          showBoxes={VILLIE_BOXES_ENABLED}
          picksImage={picks[0]?.image_url ?? null}
          onBoxes={() => navigation.navigate('BoxesHub' as never)}
          onPicks={() => navigation.navigate('PerksList' as never)}
        />

        <MomCornerCard onPress={() => navigation.navigate('MomHub' as never)} />

        {/* Emergency quick-reference — kept quietly at the foot of the page
            (also reachable from the Me tab + the Manual masthead shield). */}
        <TouchableOpacity
          style={styles.emergencyRow}
          activeOpacity={0.85}
          onPress={() => navigation.getParent()?.getParent()?.navigate('QuickReference' as never)}
          accessibilityRole="button"
          accessibilityLabel="In an emergency — quick reference"
        >
          <View style={styles.emergencyIcon}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#BE3A2E" strokeWidth={1.9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.emergencyTitle}>In an emergency</Text>
            <Text style={styles.emergencySub}>infant CPR, fevers, when to call</Text>
          </View>
          <Text style={styles.emergencyArrow}>→</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper, overflow: 'hidden' },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 96 },

  // ── Masthead greeting ─────────────────────────────────────────────────
  masthead: {
    marginTop: -56, marginHorizontal: -22,
    paddingTop: 84, paddingBottom: 6, paddingHorizontal: 22,
    overflow: 'hidden',
  },
  // villie wordmark. Sized as a masthead brand signature — a touch wider than the
  // asset's native 2.318:1 (stretch fill) for more horizontal presence, height kept
  // modest so the greeting spacing below (marginBottom) is unchanged.
  mastheadLogo: { width: 118, height: 47, marginBottom: 14 },
  mastheadEyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  mastheadEyebrowBar: { width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 },
  mastheadEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2.2,
    textTransform: 'uppercase', color: T.walnut, fontWeight: '500',
  },
  mastheadText: {
    fontFamily: FONTS.v3_display, fontSize: 32, lineHeight: 35,
    color: T.cocoa, letterSpacing: -1.2,
  },
  mastheadName: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon },
  mastheadHairline: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,14,0.1)',
    marginTop: 16,
  },
  emergencyRow: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.paper, borderRadius: 16, padding: 13,
    borderWidth: 1, borderColor: 'rgba(190,58,46,0.22)',
  },
  emergencyIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FBE4E0', alignItems: 'center', justifyContent: 'center' },
  emergencyTitle: { fontFamily: FONTS.v3_display, fontSize: 15, color: T.cocoa, letterSpacing: -0.3 },
  emergencySub: { fontFamily: FONTS.v2_body, fontSize: 11, color: T.walnut, marginTop: 1 },
  emergencyArrow: { fontFamily: FONTS.v2_link, fontSize: 16, color: '#BE3A2E' },

  // ── Section heads (eyebrow + link) ────────────────────────────────────
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 10,
  },
  sectionLink: {
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.cinnamon, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: '600',
  },

  // ── This week's manual hero card ──────────────────────────────────────
  manualCard: {
    borderRadius: 22, padding: 20, overflow: 'hidden',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.26, shadowRadius: 36, elevation: 6,
  },
  manualHalo: {
    position: 'absolute', top: -50, right: -50,
    width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(244,197,60,0.18)',
  },
  manualPillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manualPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.cinnamon, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5,
  },
  manualPillText: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: '700', color: '#fff',
  },
  manualHex: { opacity: 0.9 },
  manualTitle: {
    fontFamily: FONTS.v3_display, fontSize: 29, lineHeight: 32,
    color: T.cocoa, letterSpacing: -1.0, marginTop: 14,
  },
  manualTitleEm: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon },
  manualBlurb: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: T.walnut, marginTop: 8,
  },
  manualProgress: { marginTop: 22, marginBottom: 8, height: 10, justifyContent: 'center' },
  manualTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(67,38,15,0.16)', overflow: 'hidden' },
  manualFill: { height: '100%', borderRadius: 3, backgroundColor: T.walnut },
  manualBeePin: {
    position: 'absolute', marginLeft: -16,
    width: 32, height: 32, borderRadius: 16, backgroundColor: T.paper,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.20)',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 7, elevation: 4,
  },
  manualCtaBtn: {
    marginTop: 16, backgroundColor: T.cocoa, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center',
  },
  manualCtaText: { fontFamily: FONTS.v3_display, fontSize: 14.5, color: '#fff', letterSpacing: -0.2 },

  // ── Your village tiles ────────────────────────────────────────────────
  tileRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { alignItems: 'center', width: 60 },
  tileChip: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 2,
  },
  tileDot: {
    position: 'absolute', top: -2, right: 6,
    width: 13, height: 13, borderRadius: 7, backgroundColor: T.cinnamon,
    borderWidth: 2, borderColor: T.cream,
  },
  tileLabel: { fontFamily: FONTS.v2_bold, fontSize: 11.5, color: T.cocoa, marginTop: 8 },

  // ── Discover row ──────────────────────────────────────────────────────
  discoverRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  discCard: {
    flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: T.paper,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 18, elevation: 2,
  },
  discCap: { height: 92, alignItems: 'center', justifyContent: 'center' },
  discBody: { padding: 14 },
  discEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: '700',
  },
  discTitle: { fontFamily: FONTS.v3_display, fontSize: 17, color: T.cocoa, letterSpacing: -0.5, marginTop: 6 },
  discSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 3 },

  // ── Your corner (filled mom card) ─────────────────────────────────────
  cornerCard: {
    borderRadius: 22, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22, overflow: 'hidden',
    shadowColor: T.cinnamon, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28, shadowRadius: 26, elevation: 5,
  },
  cornerEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500', color: 'rgba(255,255,255,0.92)',
  },
  cornerTitle: { marginTop: 12, fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 32, letterSpacing: -1.0 },
  cornerTitleLead: { color: '#FFFDF8', fontWeight: '700' },
  cornerTitleEm: { fontFamily: FONTS.v3_display_italic, color: '#FFF1DC' },
  cornerBlurb: {
    marginTop: 8, fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: 'rgba(255,253,248,0.92)', maxWidth: '78%',
  },
  cornerArrowBtn: {
    position: 'absolute', right: 20, bottom: 20,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center',
  },
  cornerArrow: { color: '#fff', fontSize: 22, fontFamily: FONTS.v3_display, marginTop: -2 },
});
