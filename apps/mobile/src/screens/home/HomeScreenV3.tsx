// HomeScreenV3 — v3 brand kit "lean editorial" Home rebuild.
//
// Pixel-faithful port of `HomeB` from the 2026-05-24 design handoff
// (/Users/gp/Downloads/design_handoff_villie/home.jsx). The v3 Home is
// MUCH leaner than the current production HomeScreen.tsx:
//
//   header → greeting → daily check-in pill → THIS WEEK'S MANUAL hero card
//   with 5-row chapter TOC → EXPLORE THE VILLAGE 2×2 pillar grid → tab bar
//
// No WelcomeCard, no Help card, no Explore card, no quiet-hours strip,
// no weekly-journey inline checklist. Those were v9 surfaces that the
// v3 redesign deliberately removed in favor of the editorial-magazine
// "what's the one thing for today + what's the manual saying this week"
// posture per the handoff README.
//
// SHIPPING STATUS: side-by-side preview. NOT wired into the navigator —
// to A/B against the current HomeScreen, swap the Home tab's component
// import in `apps/mobile/src/navigation/HomeNavigator.tsx`:
//
//     // import HomeScreen from '@screens/home/HomeScreen';
//     import HomeScreen from '@screens/home/HomeScreenV3';
//
// Reuses the production data hooks (useUserStore profile, useHomeStore
// babyProfile, navigation) so the preview shows real user state. The
// 5-row chapter TOC is currently static "this week's subjects" copy
// from the handoff — wiring it to live milestone_library data is
// Phase 4.1 (after the layout itself is approved).

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { useT } from '@/i18n';
import { homeApi, type Milestone, type MilestoneCategory } from '@api/home';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { DailyCheckinStrip } from '@components/shared/DailyCheckinStrip';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { useFocusEffect } from '@react-navigation/native';

// villie-bee.png — the meticulously-designed bee mascot from the v9 brand
// work. Used here as the breathing "How are you feeling?" affordance on the
// daily check-in pill + as a corner accent on the manual hero card. The
// atmospheric background bees (drifting swarm + fly-in stagger) come from
// the shared WarmGlowBackdrop component, not from this file.
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// ─── Tokens (v3 brand kit) ─────────────────────────────────────────────
// All values pulled from constants.ts v2_* — verified pixel-identical to
// the handoff `shared.jsx` BRAND block.
const T = {
  paper:     COLORS.v2_paper,      // #FDFBF6
  cream:     COLORS.v2_cream,      // #F4ECD8
  parchment: COLORS.v2_parchment,  // #EAE0C8
  butter:    COLORS.v2_butter,     // #FAD080
  marigold:  COLORS.v2_marigold,   // #F2C130
  cinnamon:  COLORS.v2_cinnamon,   // #C07840
  caramel:   COLORS.v2_caramel,    // #D4A880
  blush:     COLORS.v2_blush,      // #F5BEB6
  salmon:    COLORS.v2_salmon,     // #EDA8A0
  sage:      COLORS.v2_sage,       // #D8CEB0
  moss:      COLORS.v2_moss,       // #606E46
  cocoa:     COLORS.v2_cocoa,      // #3D1F0E
  walnut:    COLORS.v2_walnut,     // #7A4A28
  amber:     COLORS.v2_amber,      // #A77349
  rule:      'rgba(61,31,14,0.13)',
};

// Wordmark removed 2026-05-24 — editorial masthead is the brand
// signature on in-app surfaces. Auth screens (Splash/Login/SignUp)
// retain the wordmark as the identity moment.

// ─── Chapter sub-palette ───────────────────────────────────────────────
// Matches the CHAPTERS map in the handoff's shared.jsx — used for the
// 3px color stripe in the TOC rows. Baby chapters here because HomeB's
// hero card is "Feli's manual" (baby side). Mom chapters apply when
// the user is in a pre-baby stage — not surfaced in this preview.
const CHAPTERS: Record<string, { bg: string; fg: string }> = {
  sleep: { bg: T.caramel,  fg: T.cocoa }, // warm caramel — "milk before bed" (was sage-olive)
  feed:  { bg: T.butter,   fg: T.cocoa }, // butter
  grow:  { bg: T.blush,    fg: T.cocoa }, // blush pink
  care:  { bg: '#F2C0C8',  fg: T.cocoa }, // rose pink
  wins:  { bg: T.marigold, fg: T.cocoa }, // marigold
};

// ─── Helpers ───────────────────────────────────────────────────────────
function greetingForHour(hour: number, lang: 'en' | 'es'): string {
  if (lang === 'es') {
    if (hour < 5) return 'Buenas noches';
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDateEyebrow(d: Date, lang: 'en' | 'es'): string {
  // "Sun · May 17, 2026" / "Dom · 17 may 2026"
  const days = lang === 'es'
    ? ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = lang === 'es'
    ? ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayName = days[d.getDay()];
  const mo = months[d.getMonth()];
  const date = d.getDate();
  const year = d.getFullYear();
  return lang === 'es'
    ? `${dayName} · ${date} ${mo} ${year}`
    : `${dayName} · ${mo} ${date}, ${year}`;
}

function babyMonthsFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return Math.max(0, months);
}

// ─── Shared atoms ──────────────────────────────────────────────────────
// Mono eyebrow with optional 16×1.5 dash prefix. Matches the handoff's
// `Eyebrow` component exactly.
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

// Small static bee — used as a corner accent / atmospheric decoration.
function CornerBee({ size = 26, rotate = 0, style }: {
  size?: number; rotate?: number; style?: any;
}) {
  return (
    <Image
      source={VILLIE_BEE}
      resizeMode="contain"
      accessible={false}
      style={[
        { width: size, height: size, transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    />
  );
}

// ─── Sections ──────────────────────────────────────────────────────────
function HomeGreeting({ firstName, babyName, weekNumber, monthsOld, dateLabel }: {
  firstName: string;
  babyName: string | null;
  weekNumber: number | null;
  monthsOld: number | null;
  dateLabel: string;
}) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const now = new Date();
  const greet = greetingForHour(now.getHours(), lang);
  // Mono baby info — only when we have a baby profile + week.
  const babyLine = babyName && monthsOld != null && weekNumber
    ? `${babyName} · ${monthsOld} ${lang === 'es' ? 'meses' : 'months'} · ${lang === 'es' ? 'semana' : 'week'} ${weekNumber}`
    : null;
  return (
    <View style={styles.greetingBlock}>
      {/* Greeting-corner bee swarm 2026-05-24 — first pass had 3 bees in
          a rigid triangle that Felipe read as forced. Five-bee swarm now
          with deliberately varied sizes (14-26px) + non-uniform rotation
          + opacity drift, no clean alignment. Reads as flight path /
          accidental wandering, not arranged decoration. Layered ABOVE
          the page wash but pointerEvents=none so taps fall through. */}
      <View pointerEvents="none" style={styles.greetingBeeCluster}>
        <CornerBee size={24} rotate={-22} style={styles.greetingBee1} />
        <CornerBee size={14} rotate={48}  style={styles.greetingBee2} />
        <CornerBee size={20} rotate={-6}  style={styles.greetingBee3} />
        <CornerBee size={18} rotate={31}  style={styles.greetingBee4} />
        <CornerBee size={16} rotate={-44} style={styles.greetingBee5} />
      </View>

      <View style={{ marginTop: 22 }}><Eyebrow>{dateLabel}</Eyebrow></View>
      <Text style={styles.greeting}>
        {greet},{'\n'}
        <Text style={styles.greetingItalic}>{firstName}.</Text>
      </Text>
      {babyLine ? (
        <Text style={styles.babyMonoLine}>{babyLine}</Text>
      ) : null}
    </View>
  );
}

// ─── This week's manual hero card ──────────────────────────────────────
// Handoff design uses 5 chapter names (Sleep/Feed/Grow/Care/Wins);
// milestone_library in the DB uses 7 different category names
// (motor/social/communication/sleep/feeding/sensory/cognitive). This
// mapping bridges the two so the TOC can pull live per-week copy.
// Lossy by design — see Phase 4.4 commit notes. Re-seed milestone_library
// in the handoff vocabulary to retire this map.
const CHAPTER_TO_CATEGORY: Record<string, MilestoneCategory> = {
  Sleep: 'sleep',
  Feed:  'feeding',
  Grow:  'motor',         // physical growth / pulling up / sitting / crawling
  Care:  'sensory',       // textures / soothing / what baby's noticing
  Wins:  'social',        // smiling / stranger awareness / first tiny milestones
};

// Static placeholder copy — used when milestone_library has no row for
// the mapped category for the current week. Keeps the screen alive on
// cold start and on weeks the library hasn't been seeded for.
const TOC_PLACEHOLDERS: Record<string, string> = {
  Sleep: 'Separation anxiety wakings',
  Feed:  "Cluster feeding isn't low supply",
  Grow:  'Pulling up week',
  Care:  'Teething, or just fussy?',
  Wins:  'Burp at the switch',
};

const TOC_DURATIONS: Record<string, string> = {
  Sleep: '4′', Feed: '3′', Grow: '5′', Care: '4′', Wins: '2′',
};

const TOC_CHAPTER_ORDER = ['Sleep', 'Feed', 'Grow', 'Care', 'Wins'] as const;

// Derive a short row sub from a Milestone — prefer title (curated short
// phrase) over description (full paragraph). Fall back to placeholder
// when no milestone row matched for this week's category.
function tocSubFor(chapter: string, milestones: Milestone[]): string {
  const cat = CHAPTER_TO_CATEGORY[chapter];
  const hit = milestones.find((m) => m.category === cat);
  if (hit?.title) return hit.title;
  return TOC_PLACEHOLDERS[chapter] ?? '';
}

function ManualHeroCard({ babyName, weekNumber, milestones, onPress, onChapterPress }: {
  babyName: string;
  weekNumber: number;
  /** Live milestones for the current week, mapped to TOC rows via
   *  CHAPTER_TO_CATEGORY. Empty array falls back to TOC_PLACEHOLDERS. */
  milestones: Milestone[];
  onPress: () => void;
  /** Tap a specific chapter row → opens Manual tab pre-selected to that
   *  chapter via route params. Falls back to the card-level `onPress`
   *  if the row's TouchableOpacity isn't wired through (defensive). */
  onChapterPress: (chapter: string) => void;
}) {
  // Hero bg = blush per handoff palette (first slot of the kit's default
  // 3-color palette: [accent, primary, heroBg]).
  const heroBg = T.blush;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.sectionHead}>
        <Eyebrow>This week's manual</Eyebrow>
        <TouchableOpacity onPress={onPress} accessibilityRole="link">
          <Text style={styles.sectionLink}>Open Manual →</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[styles.heroCard, { backgroundColor: heroBg }]}>
        {/* Top-edge paper sheen + iOS-26 wet glass — same immersive recipe
            as the daily check-in card so both cards lift the same way. */}
        <LinearGradient
          colors={['rgba(253,251,246,0.32)', 'rgba(253,251,246,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]}
          pointerEvents="none"
        />
        <GlassHighlight radius={10} height={14} />
        {/* Marigold halo top-right */}
        <View style={styles.heroHalo} pointerEvents="none" />

        <View style={styles.heroTitleRow}>
          <Text style={styles.heroTitle}>
            {babyName}'s <Text style={styles.heroTitleItalic}>manual.</Text>
          </Text>
          <Text style={styles.heroMeta}>Wk {weekNumber} · 18′</Text>
        </View>

        <View style={styles.heroToc}>
          {TOC_CHAPTER_ORDER.map((chapter, i) => {
            const cc = CHAPTERS[chapter.toLowerCase()];
            const isLast = i === TOC_CHAPTER_ORDER.length - 1;
            const num = String(i + 1).padStart(2, '0');
            const sub = tocSubFor(chapter, milestones);
            const dur = TOC_DURATIONS[chapter] ?? '';
            return (
              // Each row is its own tap target — deep-links to Manual
              // with this chapter pre-selected via route params. The
              // parent card's whole-area onPress (line above) is still
              // active for taps outside the rows (hero title, halo).
              <TouchableOpacity
                key={chapter}
                onPress={() => onChapterPress(chapter)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${chapter} — ${sub}`}
                style={[
                  styles.tocRow,
                  { borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={styles.tocNum}>{num}</Text>
                <View style={[styles.tocStripe, { backgroundColor: cc.bg }]} />
                <Text style={styles.tocChapter} numberOfLines={1}>{chapter}</Text>
                <Text style={styles.tocSub} numberOfLines={1}>{sub}</Text>
                <Text style={styles.tocDur}>{dur}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Village 2×2 pillar grid ───────────────────────────────────────────
// `route` is the TAB name (not the inner stack screen), since the pillar
// tap calls navigation.getParent().navigate(route) to cross-tab. Tab
// names per AppNavigator.tsx: Home, Manual, Village, Inbox, Experts,
// Milk, Gear, Profile. Same fix as commit f662bd7 in VillageHomeV3.
const VILLAGE_PILLARS = [
  { label: 'Milk Connect', sub: 'Peer donors',   bg: T.blush,     icon: 'milk',        iconColor: T.cinnamon, route: 'Milk' },
  { label: 'Specialists',  sub: 'Verified',      bg: T.sage,      icon: 'specialists', iconColor: T.moss,     route: 'Experts' },
  { label: 'Baby Gear',    sub: 'Hand-me-downs', bg: T.butter,    icon: 'gear',        iconColor: T.walnut,   route: 'Gear' },
  { label: 'Villie Plans', sub: 'Tue · 9am',     bg: T.parchment, icon: 'plans',       iconColor: T.cinnamon, route: 'Village' },
] as const;

const PILLAR_ICONS = {
  specialists: 'M9 12l2 2 4-4M12 22a10 10 0 100-20 10 10 0 000 20z',
  milk: 'M8 2h8M9 2v3a4 4 0 11-2 7v6a2 2 0 002 2h6a2 2 0 002-2v-6a4 4 0 11-2-7V2',
  gear: 'M3 7h18l-1.5 11a2 2 0 01-2 2H6.5a2 2 0 01-2-2L3 7zM8 7V5a4 4 0 118 0v2',
  plans: 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4',
} as const;

function VillageStrip({ onPillar, onAll }: { onPillar: (route: string) => void; onAll: () => void }) {
  return (
    <View style={{ marginTop: 26 }}>
      <View style={styles.sectionHead}>
        <Eyebrow>Explore the village</Eyebrow>
        <TouchableOpacity onPress={onAll} accessibilityRole="link">
          <Text style={styles.sectionLink}>All →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pillarGrid}>
        {VILLAGE_PILLARS.map((p) => (
          <TouchableOpacity
            key={p.label}
            onPress={() => onPillar(p.route)}
            activeOpacity={0.85}
            style={[styles.pillarCard, { backgroundColor: p.bg }]}
          >
            <LinearGradient
              colors={['rgba(253,251,246,0.35)', 'rgba(253,251,246,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
              pointerEvents="none"
            />
            <View style={styles.pillarIconChip}>
              <Svg width={15} height={15} viewBox="0 0 24 24">
                <Path
                  d={PILLAR_ICONS[p.icon]}
                  stroke={p.iconColor} strokeWidth={2} fill="none"
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.pillarLabel} numberOfLines={1}>{p.label}</Text>
              <Text style={styles.pillarSub} numberOfLines={1}>{p.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────
export default function HomeScreenV3() {
  const navigation = useNavigation<any>();
  const profile = useUserStore((s) => s.profile);
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const _t = useT(); void _t; // reserved for future i18n in subcomponents
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

  // Greeting data — fall back to "friend" / "your" if we don't have a name yet.
  const firstName = profile?.full_name?.split(' ')[0] ?? 'friend';
  const babyName = babyProfile?.baby_name ?? null;
  const weekNumber = babyProfile?.current_week_number ?? null;
  const monthsOld = babyMonthsFromDob(babyProfile?.date_of_birth ?? null);
  const dateLabel = formatDateEyebrow(new Date(), lang);

  // Navigation handlers — uses parent tab navigator for cross-tab moves.
  const goManual = () => navigation.navigate('Manual' as never);
  // Deep-link to Manual tab with a specific chapter pre-selected via
  // route params. Wired 2026-05-25 UX audit: the TOC rows on the Home
  // ManualHeroCard previously routed only to the Manual tab home
  // (any chapter row → same destination), so the user had to manually
  // switch to the chapter they'd just tapped. Now the row's intent is
  // honored at the destination.
  const goManualChapter = (chapter: string) =>
    navigation.navigate('Manual' as never, {
      screen: 'ManualHome',
      params: { audience: 'baby', chapter },
    } as never);
  // goBell removed 2026-05-24 alongside the header bell.
  const goVillagePillar = (route: string) => {
    // The handoff routes map to existing tab names. "Experts" = experts tab,
    // "MilkConnect" = milk tab landing, etc. Fall back to AllExploreScreen
    // if a route doesn't exist in the current navigator.
    navigation.getParent()?.navigate(route as never);
  };
  const goVillageAll = () => navigation.navigate('Village' as never);

  // Hero requires a baby profile to render with personalized data; in
  // pre-baby state we fall back to a placeholder name.
  const heroBabyName = babyName ?? 'Your';
  const heroWeek = weekNumber ?? 1;

  // Atmospheric backdrop — bees + warm gradient. scrollY drives the
  // parallax drift, triggerAnim drives the fly-in stagger on focus.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [triggerAnim, setTriggerAnim] = React.useState(0);

  // Live week milestones for the Manual hero card TOC. Falls back to
  // the static TOC_PLACEHOLDERS in tocSubFor when none returned.
  const [weekMilestones, setWeekMilestones] = React.useState<Milestone[]>([]);
  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      // Only fetch when we have a real week — pre-baby state stays on
      // placeholder copy. Fire-and-forget; tocSubFor handles empty array.
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
      {/* WarmGlowBackdrop — U-shape gradient + 12 atmospheric bees scattered
          through the page with fly-in stagger on focus + parallax drift on
          scroll. Replaces the hand-rolled radial washes. */}
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
        {/* HomeHeader removed 2026-05-24 per Felipe — bell + wordmark
            both gone; the editorial greeting opens the page directly.
            NotificationsScreen stays registered on HomeNavigator for
            deep-link compatibility but has no in-app entry point. */}
        <HomeGreeting
          firstName={firstName}
          babyName={babyName}
          weekNumber={weekNumber}
          monthsOld={monthsOld}
          dateLabel={dateLabel}
        />

        {/* v9 production check-in strip — single source of truth for the
            "How are you feeling?" pill across both v9 + v3 Home. The
            shared component owns the immersive recipe (GlassHighlight +
            breathing bee + floating shadow + asymmetric padding). */}
        <View style={{ marginTop: 22 }}>
          <DailyCheckinStrip
            state="pending"
            onPress={() => navigation.navigate('DailyCheckin' as never)}
          />
        </View>

        <ManualHeroCard
          babyName={heroBabyName}
          weekNumber={heroWeek}
          milestones={weekMilestones}
          onPress={goManual}
          onChapterPress={goManualChapter}
        />

        <VillageStrip onPillar={goVillagePillar} onAll={goVillageAll} />
      </Animated.ScrollView>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper, overflow: 'hidden' },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 96 },

  // ── Header / bell styles removed 2026-05-24 alongside HomeHeader. ────

  // ── Greeting block ────────────────────────────────────────────────────
  greetingBlock: { position: 'relative' },
  // Bee cluster overlay — fills the upper-right rail next to the short
  // "Good evening," line. Sits inside the greeting block's relative
  // container so the bees stay anchored to this surface (not the
  // scroll content as a whole, which would put them in different
  // visual spots per screen).
  // Wider canvas so the swarm can drift further from any one anchor.
  greetingBeeCluster: {
    position: 'absolute', top: -8, right: -6, width: 140, height: 200,
    zIndex: 1,
  },
  // Five-bee organic swarm — each at a deliberately non-uniform
  // position + opacity. Positions chosen by eye to feel like a flight
  // path passing through the right rail (top-right → lower-left of the
  // cluster), not a stack or a triangle. Opacities vary so the closer
  // bees feel "near" and the smaller ones recede.
  greetingBee1: { position: 'absolute', top: 6,   right: 14, opacity: 0.32 },
  greetingBee2: { position: 'absolute', top: 38,  right: 78, opacity: 0.18 },
  greetingBee3: { position: 'absolute', top: 82,  right: 36, opacity: 0.26 },
  greetingBee4: { position: 'absolute', top: 122, right: 88, opacity: 0.20 },
  greetingBee5: { position: 'absolute', top: 152, right: 24, opacity: 0.22 },

  greeting: {
    fontFamily: FONTS.v3_display,    // Plus Jakarta Sans 700 — brand kit grotesk display
    fontSize: 40, lineHeight: 41,
    color: T.cocoa, letterSpacing: -1.4,
    marginTop: 14,
  },
  greetingItalic: {
    fontFamily: FONTS.v3_display_italic,
    color: T.salmon,                  // v3 italic accent — was rust-deep in v9, salmon in v3
  },
  babyMonoLine: {
    marginTop: 10,
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.walnut, letterSpacing: 2.0,
    textTransform: 'uppercase', fontWeight: '500',
  },

  // ── Section heads (eyebrow + link) ────────────────────────────────────
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

  // ── This week's manual hero card ──────────────────────────────────────
  heroCard: {
    marginTop: 12, borderRadius: 10,
    padding: 14, paddingBottom: 12,
    overflow: 'hidden',
    // shadowHero from handoff — warm cocoa-tinted, deeper than shadowSm
    shadowColor: T.walnut,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.32,
    shadowRadius: 44,
    elevation: 6,
  },
  heroHalo: {
    position: 'absolute', top: -50, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(242,193,48,0.20)',
  },
  heroTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    gap: 10,
  },
  heroTitle: {
    fontFamily: FONTS.v3_display, fontSize: 22, lineHeight: 23,
    color: T.cocoa, letterSpacing: -0.55,
    flexShrink: 1,
  },
  heroTitleItalic: {
    fontFamily: FONTS.v3_display_italic, color: T.cinnamon,
  },
  heroMeta: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5,
    color: T.cocoa, opacity: 0.7,
    letterSpacing: 1.7, textTransform: 'uppercase', fontWeight: '500',
  },
  heroToc: {
    marginTop: 10, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(61,31,14,0.13)',
  },
  tocRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 7,
    borderBottomColor: 'rgba(61,31,14,0.10)',
  },
  tocNum: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5,
    color: T.cocoa, opacity: 0.6, letterSpacing: 1.3,
    width: 16,
  },
  tocStripe: { width: 3, height: 18, borderRadius: 2 },
  tocChapter: {
    fontFamily: FONTS.v2_bold, fontSize: 12.5, color: T.cocoa,
    letterSpacing: -0.05, width: 46,
  },
  tocSub: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.cocoa,
    opacity: 0.78, lineHeight: 15,
  },
  tocDur: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5,
    color: T.cocoa, opacity: 0.65, fontWeight: '600', letterSpacing: 0.55,
  },

  // ── Village 2×2 pillar grid ───────────────────────────────────────────
  pillarGrid: {
    marginTop: 14,
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10,
  },
  pillarCard: {
    // (cardWidth - 22*2 - 10) / 2 — RN flexBasis math; minWidth 0 forces grid.
    width: '48%',
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14,
    overflow: 'hidden',
    shadowColor: T.walnut,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 2,
  },
  pillarIconChip: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(253,251,246,0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.08)',
  },
  pillarLabel: {
    fontFamily: FONTS.v2_bold, fontSize: 12.5,
    color: T.cocoa, lineHeight: 14,
  },
  pillarSub: {
    fontFamily: FONTS.v2_body, fontSize: 10.5,
    color: T.walnut, marginTop: 2,
  },
});
