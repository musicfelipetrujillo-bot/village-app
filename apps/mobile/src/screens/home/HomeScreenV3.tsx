// HomeScreenV3 — v3 brand kit "lean editorial" Home rebuild.
//
// Pixel-faithful port of `HomeB` from the 2026-05-24 design handoff
// (/Users/gp/Downloads/design_handoff_villie/home.jsx). The v3 Home is
// MUCH leaner than the current production HomeScreen.tsx:
//
//   header → greeting → daily check-in pill → THIS WEEK'S MANUAL hero card
//   (week-overview summary) → EXPLORE THE VILLAGE 2×2 pillar grid → tab bar
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
// Manual hero card shows a short week-overview hook pulled from live
// milestone_library data (weekMilestones), falling back to the current
// milestone's description.

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Animated,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { usePerksStore } from '@store/perks';
import { usePicksStore } from '@store/picks';
import type { PerkCard } from '@api/perks';
import type { VilliePick } from '@api/picks';
import { useT } from '@/i18n';
import { homeApi, type Milestone } from '@api/home';
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
  paper:     COLORS.v2_paper,      // #FFFCF6
  cream:     COLORS.v2_cream,      // #FCF7EF
  parchment: COLORS.v2_parchment,  // #F2E6DD
  butter:    COLORS.v2_butter,     // #F4C53C
  marigold:  COLORS.v2_marigold,   // #F4C53C
  cinnamon:  COLORS.v2_cinnamon,   // #D96C88
  caramel:   COLORS.v2_caramel,    // #E98A6A
  blush:     COLORS.v2_blush,      // #F7C5CB
  salmon:    COLORS.v2_salmon,     // #F7C5CB
  sage:      COLORS.v2_sage,       // #F2E6DD
  moss:      COLORS.v2_moss,       // #E98A6A
  cocoa:     COLORS.v2_cocoa,      // #43260F
  walnut:    COLORS.v2_walnut,     // #7A4A28
  amber:     COLORS.v2_amber,      // #7A4A24
  rule:      'rgba(61,31,14,0.13)',
};

// Wordmark removed 2026-05-24 — editorial masthead is the brand
// signature on in-app surfaces. Auth screens (Splash/Login/SignUp)
// retain the wordmark as the identity moment.

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
// "29th", "1st", "22nd" — ordinal suffix for the week-number title.
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// A warm, journey-POSITION caption for the progress bar — names where the mom
// is in baby's first year, in human terms (no developmental claim, so it stays
// true for every baby and gentle in the fragile early weeks). This is what
// makes the handwritten line earn its place: it interprets the bar.
function journeyNote(week: number): string {
  if (week <= 6)  return 'the fourth trimester';
  if (week <= 17) return 'the early months';
  if (week <= 25) return 'almost halfway';
  if (week <= 34) return 'just past halfway';
  if (week <= 45) return 'the back half';
  return 'almost one';
}

function ManualHeroCard({ babyName, weekNumber, hook, body, onPress }: {
  babyName: string;
  weekNumber: number;
  /** A SHORT milestone/pain-point teaser (one line, from the week's milestone
   *  data) — a hook to pull the reader into the Manual, NOT the full summary.
   *  The per-chapter TOC was removed (it duplicated the Manual tab). */
  hook: string | null;
  /** One supporting sentence under the hook (the milestone's description), so
   *  the card carries real substance instead of a lone headline. */
  body?: string | null;
  onPress: () => void;
}) {
  // Hero bg = blush per handoff palette (first slot of the kit's default
  // 3-color palette: [accent, primary, heroBg]).
  const heroBg = T.blush;
  // Journey progress — clamp so week 1 still shows a sliver and 52 fills.
  const pct = Math.max(0.04, Math.min(1, weekNumber / 52));
  // Where the bee perches on the track, and which way its speech bubble opens
  // (away from the nearer edge) so the bubble never runs off the card.
  const markerPct = Math.min(0.93, Math.max(0.06, pct));
  const openLeft = markerPct >= 0.5;
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
          style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
          pointerEvents="none"
        />
        <GlassHighlight radius={20} height={14} />
        {/* Marigold halo top-right + a villie bee perched on it (personality:
            the card's resident bee, basking on the honey glow). */}
        <View style={styles.heroHalo} pointerEvents="none" />
        <CornerBee size={48} rotate={16} style={styles.heroCornerBee} />

        <Text style={styles.heroTitle}>
          {babyName}'s <Text style={styles.heroTitleItalic}>{ordinal(weekNumber)} week</Text>
        </Text>

        {/* One milestone hook — a teaser, not the whole week. The pull into
            the Manual is the curiosity gap + the "what to expect" CTA. */}
        {hook ? (
          <>
            <Text style={styles.heroTag}>✦ MILESTONE</Text>
            <Text style={styles.heroHook} numberOfLines={2}>{hook}</Text>
          </>
        ) : (
          <Text style={styles.heroSub} numberOfLines={2}>
            See what’s changing for {babyName} this week.
          </Text>
        )}

        {/* Supporting line — the milestone's own description, so the card has
            body, not just a headline. Hidden when it would duplicate the hook. */}
        {!!body && body !== hook && (
          <Text style={styles.heroBody} numberOfLines={2}>{body}</Text>
        )}

        {/* Journey progress — the bee flies along the 52-week path and, from
            its spot, "says" where you are in a little speech bubble. Bubble +
            bee are one object, so the phrase is never stranded on its own. */}
        <View style={styles.heroProgress}>
          <View
            style={[
              styles.heroBubble,
              openLeft
                ? { right: `${(1 - markerPct) * 100}%`, marginRight: -16 }
                : { left: `${markerPct * 100}%`, marginLeft: -16 },
            ]}
          >
            <Text style={styles.heroBubbleText}>{journeyNote(weekNumber)}</Text>
            <View style={[styles.heroBubbleTail, openLeft ? { right: 16 } : { left: 16 }]} />
          </View>
          <View style={styles.heroProgressTrack}>
            <View style={[styles.heroProgressFill, { width: `${pct * 100}%` }]} />
          </View>
          {/* The bee rides a cream "pin" disc so it reads clearly against the
              blush card + dark track, like a waypoint token on the path. */}
          <View style={[styles.heroBeePin, { left: `${markerPct * 100}%` }]}>
            <CornerBee size={26} rotate={-8} />
          </View>
        </View>

        <Text style={styles.heroCta}>What to expect →</Text>
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
  // Warm analogous palette — every card colored so the page isn't stale, but all
  // sit in one soft pink->honey family at a matched level, so they cohere instead
  // of sore-thumbing. Cohesion = related hues, not neutral cards.
  { label: 'Milk Connect', sub: 'Peer donors',   bg: '#F7C5CB', fg: T.cocoa, icon: 'milk',        iconColor: '#43260F', route: 'Milk' },
  { label: 'Specialists',  sub: 'Verified',      bg: '#F3B79C', fg: T.cocoa, icon: 'specialists', iconColor: '#43260F', route: 'Experts' },
  { label: 'Baby Gear',    sub: 'Hand-me-downs', bg: '#F4C53C', fg: T.cocoa, icon: 'gear',        iconColor: '#43260F', route: 'Gear' },
  { label: 'Villie Plans', sub: 'Tue · 9am',     bg: '#EFB2C8', fg: T.cocoa, icon: 'plans',       iconColor: '#43260F', route: 'Village' },
] as const;

const PILLAR_ICONS = {
  specialists: 'M9 12l2 2 4-4M12 22a10 10 0 100-20 10 10 0 000 20z',
  milk: 'M8 2h8M9 2v3a4 4 0 11-2 7v6a2 2 0 002 2h6a2 2 0 002-2v-6a4 4 0 11-2-7V2',
  gear: 'M3 7h18l-1.5 11a2 2 0 01-2 2H6.5a2 2 0 01-2-2L3 7zM8 7V5a4 4 0 118 0v2',
  plans: 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4',
} as const;

// V5 Phase 5.1 — Mom hero card.
// Sits between the Manual hero (baby-led) and the Village strip on Home.
// Salmon + blush so it reads as "for mom" without competing with the
// cinnamon Manual hero. Single Playfair italic on the title word
// ("corner.") — same one-italic-per-card rule as every other v3 surface.
// Tap opens MomHubScreen — the dedicated mom-side surface that replaced
// the now-removed Mom Manual track inside the Manual tab.
function MomHeroCard({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <View style={{ marginTop: 22 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel={t('momHub.homeCardA11y')}
        style={styles.momCard}
      >
        {/* Soft blush halo top-right — same recipe as auth/confirm */}
        <View style={styles.momHalo} pointerEvents="none" />

        {/* The shared Eyebrow uses walnut by default; override the dash + text
            color inline so the Mom card eyebrow reads salmon-pink. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 16, height: 1.5, backgroundColor: T.salmon, marginRight: 8 }} />
          <Text style={{
            fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
            textTransform: 'uppercase', fontWeight: '500', color: T.salmon,
          }}>{t('momHub.homeCardEyebrow')}</Text>
        </View>

        <Text style={styles.momTitle}>
          <Text style={styles.momTitleLead}>{t('momHub.titleLead')} </Text>
          <Text style={styles.momTitleEm}>{t('momHub.titleEm')}</Text>
        </Text>

        <Text style={styles.momBlurb}>{t('momHub.homeCardBlurb')}</Text>

        <View style={styles.momCtaRow}>
          <Text style={styles.momCta}>{t('momHub.homeCardCta')}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

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
              <Text style={[styles.pillarLabel, { color: p.fg }]} numberOfLines={1}>{p.label}</Text>
              <Text style={[styles.pillarSub, { color: p.fg }]} numberOfLines={1}>{p.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Villie's picks & perks ──────────────────────────────────────────────
// Weekly editorial product picks (villie_picks) + brand-partner perks
// (brand_deals). Picks build trust (recommendations); perks give tangible
// value. Both come from stores — real on native, web-dev-seeded in the
// browser preview. FTC disclosure inline. Pick tile colors are assigned
// client-side (the data carries no color) from the warm palette.
const PICK_TINTS = ['#F7C5CB', '#F3B79C', '#EFB2C8', '#FBE3A6'];

function PicksAndPerks({ picks, perks, onSeeAll }: { picks: VilliePick[]; perks: PerkCard[]; onSeeAll: () => void }) {
  if (picks.length === 0 && perks.length === 0) return null;
  return (
    <View style={{ marginTop: 26 }}>
      <View style={styles.sectionHead}>
        <Eyebrow>Villie&apos;s picks &amp; perks</Eyebrow>
        <TouchableOpacity onPress={onSeeAll} accessibilityRole="link">
          <Text style={styles.sectionLink}>All →</Text>
        </TouchableOpacity>
      </View>

      {/* Picks — weekly editorial carousel (bleeds to screen edges) */}
      {picks.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -22 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 4, gap: 12 }}
        >
          {picks.map((p, i) => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.88}
              onPress={onSeeAll}
              accessibilityRole="button"
              accessibilityLabel={p.name}
              style={{ width: 132 }}
            >
              <View style={{ height: 96, borderRadius: 16, backgroundColor: PICK_TINTS[i % PICK_TINTS.length], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p.image_url
                  ? <Image source={{ uri: p.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <Text style={{ fontSize: 42 }}>{p.emoji ?? '🤍'}</Text>}
              </View>
              <Text style={{ fontFamily: FONTS.v2_bold, fontSize: 13, color: T.cocoa, marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
              <Text style={{ fontFamily: FONTS.v2_body, fontSize: 11, lineHeight: 14, color: T.walnut, marginTop: 2 }} numberOfLines={2}>{p.blurb}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Perks — brand-partner rows (top 2) */}
      {perks.length > 0 && (
        <View style={{ marginTop: 14, gap: 8 }}>
          {perks.slice(0, 2).map((p) => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.85}
              onPress={onSeeAll}
              accessibilityRole="button"
              accessibilityLabel={`${p.brand_name}: ${p.discount_label ?? p.title}`}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: T.paper, borderRadius: 14, padding: 12,
                borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(201,108,120,0.18)',
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.blush, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
                {p.brand_logo_url
                  ? <Image source={{ uri: p.brand_logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <Text style={{ fontFamily: FONTS.v2_bold, fontSize: 15, color: T.cocoa }}>{p.brand_name.charAt(0)}</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: FONTS.v2_bold, fontSize: 13, color: T.cocoa }} numberOfLines={1}>{p.brand_name}</Text>
                <Text style={{ fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut }} numberOfLines={1}>{p.discount_label ?? p.title}</Text>
              </View>
              <Text style={{ fontFamily: FONTS.v2_link, fontSize: 12, color: T.cinnamon }}>Get →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* FTC disclosure — required wherever affiliate / partner deals appear */}
      <Text style={{ fontFamily: FONTS.v2_body, fontSize: 10, lineHeight: 14, color: T.walnut, opacity: 0.75, marginTop: 10 }}>
        Villie may earn a little when you shop these — we only pick things we&apos;d tell a friend about.
      </Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────
export default function HomeScreenV3() {
  const navigation = useNavigation<any>();
  const profile = useUserStore((s) => s.profile);
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const currentMilestone = useHomeStore((s) => s.currentMilestone);
  const _t = useT(); void _t; // reserved for future i18n in subcomponents
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

  // Picks & perks — read from stores. On native these fetch real rows
  // (villie_picks + brand_deals); the web-dev seed noop's the fetchers so
  // the browser preview keeps its seeded data.
  const picks = usePicksStore((s) => s.picks);
  const fetchPicks = usePicksStore((s) => s.fetchPicks);
  const perks = usePerksStore((s) => s.perks);
  const fetchPerks = usePerksStore((s) => s.fetchPerks);
  useEffect(() => {
    fetchPicks();
    fetchPerks();
  }, [fetchPicks, fetchPerks]);

  // Greeting data — fall back to "Alana" / "your" if we don't have a name yet.
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Alana';
  const babyName = babyProfile?.baby_name ?? null;
  const weekNumber = babyProfile?.current_week_number ?? null;
  const monthsOld = babyMonthsFromDob(babyProfile?.date_of_birth ?? null);
  const dateLabel = formatDateEyebrow(new Date(), lang);

  // Navigation handlers — uses parent tab navigator for cross-tab moves.
  const goManual = () => navigation.navigate('Manual' as never);
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

  // Live week milestones — feed the Manual hero card's hook (a short
  // week-overview line; see the render below). Empty until fetched.
  const [weekMilestones, setWeekMilestones] = React.useState<Milestone[]>([]);
  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      // Only fetch when we have a real week — pre-baby state stays on
      // the fallback summary. Fire-and-forget; empty array is handled.
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
          hook={
            // A short hook, not the whole summary: prefer a concrete milestone
            // title, fall back to the current milestone's one-line description.
            weekMilestones[0]?.title
              ?? currentMilestone?.description
              ?? null
          }
          body={
            // The milestone's description as a supporting line (only when the
            // hook is the title, so it doesn't echo the hook).
            weekMilestones[0]?.description
              ?? currentMilestone?.description
              ?? null
          }
          onPress={goManual}
        />

        {/* V5 Phase 5.1 (2026-05-29) — Mom hero card.
            Sits below the Manual hero so the page reads as "baby first,
            then mama" — same order as the brand's tagline "for every mom"
            but interior context is baby-led. Salmon/blush palette so it
            visually separates from the cinnamon manual hero. Taps land
            on MomHubScreen — see ../home/MomHubScreen.tsx. */}
        <MomHeroCard onPress={() => navigation.navigate('MomHub' as never)} />

        <PicksAndPerks picks={picks} perks={perks} onSeeAll={() => navigation.navigate('PerksList' as never)} />

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
    // Geometry matched to momCard (radius 20, generous padding) so the two
    // peer hero cards read as one system. The Manual hero keeps visual
    // primacy through its saturated blush bg + heavier shadow, not geometry.
    marginTop: 12, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 18,
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
    // Matched to momTitle (32 / -1.0) so the two peer hero titles balance —
    // one step (1.25x) below the 40px greeting.
    fontFamily: FONTS.v3_display, fontSize: 32, lineHeight: 34,
    color: T.cocoa, letterSpacing: -1.0,
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
  // ── Spacing pass — tighter, even rhythm so the card reads as one block ──
  heroTag: {
    alignSelf: 'flex-start', marginTop: 12, overflow: 'hidden',
    backgroundColor: T.marigold, color: T.cocoa,
    fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, fontWeight: '600',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  heroHook: {
    fontFamily: FONTS.v2_bold, fontSize: 15.5, lineHeight: 21,
    color: T.cocoa, marginTop: 9,
  },
  // Subtitle on the "This week's manual" card — Bricolage Grotesque Regular
  // (the display family's light weight, same family as the card titles), not
  // italic, for a refined feel. Sized up for presence.
  heroSub: {
    fontFamily: FONTS.v2_display_regular, fontSize: 21, lineHeight: 28,
    color: T.cocoa, letterSpacing: 0.1, marginTop: 12,
  },
  heroBody: {
    fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 19,
    color: T.walnut, marginTop: 5, maxWidth: '92%',
  },
  heroCornerBee: {
    position: 'absolute', top: 15, right: 20, opacity: 0.92,
  },
  // Progress block — track + flying bee + the bee's speech bubble. paddingTop
  // reserves the room the bubble needs to float above the track.
  heroProgress: {
    marginTop: 18, paddingTop: 46, position: 'relative',
  },
  heroProgressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(67,38,15,0.14)', overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%', borderRadius: 3, backgroundColor: T.walnut,
  },
  // Cream pin the bee rides — makes the bee pop off the busy blush card and
  // reads as a clear "you are here" token on the track.
  heroBeePin: {
    position: 'absolute', bottom: -13, marginLeft: -17,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: T.paper,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.20)',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 7, elevation: 4,
  },
  // The bee's speech bubble — a cream lozenge floating above the pin, with a
  // small diamond tail dropping toward the bee.
  heroBubble: {
    position: 'absolute', bottom: 26,
    backgroundColor: T.paper, borderRadius: 13,
    paddingHorizontal: 13, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20, shadowRadius: 12, elevation: 5,
  },
  heroBubbleText: {
    fontFamily: FONTS.v3_display_italic, fontSize: 17.5, color: T.cocoa,
  },
  heroBubbleTail: {
    position: 'absolute', bottom: -4, width: 10, height: 10,
    backgroundColor: T.paper, transform: [{ rotate: '45deg' }],
    borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(173,121,91,0.18)',
  },
  heroCta: {
    fontFamily: FONTS.v2_link, fontSize: 13, color: T.cinnamon, marginTop: 18,
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

  // ── V5 Phase 5.1 — Mom hero card ─────────────────────────────────────
  // Paper-tone base + blush halo top-right + cinnamon CTA. Same lift recipe
  // as the daily check-in strip + manual hero (subtle shadow, hairline
  // border) so the page reads as a coherent vertical stack of cards.
  momCard: {
    backgroundColor: T.paper,
    borderRadius: 20,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1, borderColor: 'rgba(237, 168, 160, 0.45)',
    shadowColor: T.cocoa,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 3,
  },
  momHalo: {
    position: 'absolute',
    top: -36, right: -36,
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: T.blush,
    opacity: 0.32,
  },
  momTitle: {
    marginTop: 10,
    fontFamily: FONTS.v3_display, fontSize: 32, lineHeight: 34,
    color: T.cocoa, letterSpacing: -1.0,
  },
  momTitleLead: { color: T.cocoa, fontWeight: '700' },
  momTitleEm: {
    fontFamily: FONTS.v3_display_italic, color: T.salmon, fontWeight: '600',
  },
  momBlurb: {
    marginTop: 8,
    fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 19,
    color: T.walnut, maxWidth: 320,
  },
  momCtaRow: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center',
  },
  momCta: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '500',
    color: T.cinnamon,
  },
});
