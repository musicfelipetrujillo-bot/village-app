// MomHubScreen — "mamas corner"
//
// The all-things-mom hub, rebuilt calm (2026-08-09) after the founder read the
// 5-section editorial version as "anxiety, too many words, chaotic": one line,
// two warm cards (plan my day = daylight/logistics, i need a sec = dusk/
// nervous system), one quiet list, one ask bar.
//
// Plan my day + Day Sheet live here rather than on Home; the day plan is logs +
// calendar, while the logs read-back lives in Insights.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { tap } from '@utils/haptics';
import { getCalendarPermission, getTodayBusyBlocks } from '@utils/calendar';
import {
  getPumpCadence, buildDayPlan, fmtTime, meridiem,
  type PlanSlot, type SlotKind,
} from '@utils/dayPlan';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

const ROSE = '#C24A63', ROSE_DEEP = '#9E2F4C';
const INK = '#43260F', INKSOFT = '#7A5A3A';

// ─── The day arc ───────────────────────────────────────────────────────
// Plan-my-day used to be a flat gradient with a 🗓️ emoji in the corner: it
// announced a feature instead of showing one, and next to "i need a sec" —
// which previews its own breathing rings — it read as the duller of the pair.
//
// It now draws TODAY. A sunrise-to-bedtime arc (the 7am→7pm window buildDayPlan
// itself works in) carries a mark per planned block — naps in cream, pumps in
// honey, her own calendar as a thin tick — with a lit pip for where she is right
// now. Everything on it is real: the same plan the Day Plan screen builds, from
// her saved pump cadence, her baby's week and (only if she's already granted it)
// her calendar. No cadence saved yet → the arc stays a ghost and the card asks
// for the one thing it needs.
// Geometry note: the control point sits well ABOVE the box so the curve's apex
// lands near its top edge (apex y = (p0y + p2y)/4·2 + p1y/2 = 8 here). A gentler
// control point drew a shallow arc floating in the middle of its own box, which
// read as a dead band of gradient rather than a day.
const ARC = { w: 300, h: 72, p0: [10, 62], p1: [150, -46], p2: [290, 62] } as const;
const DAY_START_H = 7, DAY_END_H = 19;

function arcPoint(t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * ARC.p0[0] + 2 * u * t * ARC.p1[0] + t * t * ARC.p2[0],
    y: u * u * ARC.p0[1] + 2 * u * t * ARC.p1[1] + t * t * ARC.p2[1],
  };
}
/** Where a moment sits on the arc, 0 = wake-up, 1 = bedtime. null if outside. */
function dayFraction(d: Date): number | null {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < DAY_START_H || h > DAY_END_H) return null;
  return (h - DAY_START_H) / (DAY_END_H - DAY_START_H);
}

const MARK: Record<SlotKind, { r: number; fill: string; stroke?: string }> = {
  nap:      { r: 5,   fill: '#FFFDF8' },
  pump:     { r: 4.5, fill: '#F6D27A' },
  feed:     { r: 3,   fill: 'rgba(255,253,248,0.62)' },
  calendar: { r: 2.5, fill: 'rgba(255,253,248,0.45)' },
};

function DayArc({ slots, ghost }: { slots: PlanSlot[]; ghost: boolean }) {
  const now = React.useMemo(() => dayFraction(new Date()), []);
  const marks = ghost
    ? []
    : slots
        .map((s) => ({ slot: s, t: dayFraction(s.start) }))
        .filter((m): m is { slot: PlanSlot; t: number } => m.t !== null);
  const d = `M${ARC.p0[0]} ${ARC.p0[1]} Q${ARC.p1[0]} ${ARC.p1[1]} ${ARC.p2[0]} ${ARC.p2[1]}`;
  const nowPt = now === null ? null : arcPoint(now);
  return (
    // `key` forces a remount whenever the arc's content changes. Without it the
    // SVG subtree went stale on the ghost→live flip: the footer switched to the
    // live pill but the path kept its dashed stroke and no marks ever mounted.
    <Svg
      key={`arc-${ghost ? 'ghost' : 'live'}-${marks.length}`}
      width="100%" height={ARC.h} viewBox={`0 0 ${ARC.w} ${ARC.h}`} pointerEvents="none"
    >
      <Path
        d={d} fill="none" strokeLinecap="round"
        stroke={ghost ? 'rgba(255,253,248,0.26)' : 'rgba(255,253,248,0.42)'}
        strokeWidth={1.6}
        strokeDasharray={ghost ? '3 5' : '0'}
      />
      {marks.map(({ slot, t }) => {
        const p = arcPoint(t);
        const m = MARK[slot.kind];
        // Blocks already behind her sit back; what's still ahead reads at full
        // strength, so the arc shows progress through the day, not just a list.
        const past = now !== null && t < now;
        return (
          <Circle
            key={slot.id} cx={p.x} cy={p.y} r={m.r} fill={m.fill}
            opacity={past ? 0.42 : 1}
          />
        );
      })}
      {nowPt && !ghost ? (
        <G>
          <Circle cx={nowPt.x} cy={nowPt.y} r={11} fill="rgba(255,253,248,0.20)" />
          <Circle cx={nowPt.x} cy={nowPt.y} r={6.5} fill="none" stroke="#FFFDF8" strokeWidth={1.6} />
          <Circle cx={nowPt.x} cy={nowPt.y} r={2.6} fill="#FFFDF8" />
        </G>
      ) : null}
    </Svg>
  );
}

type DayPreview = { cadenceSet: boolean; slots: PlanSlot[] };

export default function MomHubScreen() {
  const navigation = useNavigation<any>();
  const lang = useUserStore((s) => (s.profile?.preferred_language ?? 'en')) as 'en' | 'es';
  const es = lang === 'es';
  // The hub subscribes to the baby profile now that the hero previews today —
  // buildDayPlan needs the week (for wake windows) and the baby's name.
  const baby = useHomeStore((s) => s.babyProfile);
  const babyName = baby?.baby_name ?? 'baby';
  const week = baby?.current_week_number ?? 8;

  // Rebuilt on every focus so coming back from the Day Plan screen (where she
  // may have just picked a cadence) shows the real arc immediately.
  const [preview, setPreview] = React.useState<DayPreview | null>(null);
  useFocusEffect(React.useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const cadence = await getPumpCadence();
        if (cancelled) return;
        if (!cadence) { setPreview({ cadenceSet: false, slots: [] }); return; }
        // Only read the calendar when she has ALREADY granted it — the hub must
        // never be the screen that pops a permission dialog at her.
        const busy = (await getCalendarPermission()) === 'granted'
          ? await getTodayBusyBlocks().catch(() => [])
          : [];
        if (cancelled) return;
        // buildDayPlan drops slots that have already passed — right for the Day
        // Plan timeline, wrong for an arc, which is the shape of the whole day.
        // Seeding `now` at dawn keeps every block (its cutoff is now-20min), and
        // the real clock is still what drives the "now" pip and "next up".
        const dawn = new Date(); dawn.setHours(6, 0, 0, 0);
        setPreview({
          cadenceSet: true,
          slots: buildDayPlan({ busy, weekNumber: week, cadence, babyName, now: dawn }).slots,
        });
      } catch {
        if (!cancelled) setPreview({ cadenceSet: false, slots: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [week, babyName]));

  const ghost = !preview?.cadenceSet;
  const nextSlot = React.useMemo(() => {
    if (!preview?.cadenceSet) return null;
    const now = Date.now();
    return preview.slots
      .filter((s) => s.kind !== 'calendar' && s.start.getTime() > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;
  }, [preview]);

  const goDayPlan = () => { tap(); navigation.navigate('DayPlan'); };
  const goDaySheet = () => { tap(); navigation.navigate('DaySheetList'); };
  const goReset = () => { tap(); navigation.navigate('ResetRecharge'); };
  const goTips = () => { tap(); navigation.navigate('MomTips'); };
  // No week param — the screen resolves it from the baby profile itself, so
  // the hub doesn't need to subscribe to the home store just to pass a number.
  const goWeek = () => { tap(); navigation.navigate('WeeklyJourney'); };
  const askVillie = (seed: string) => {
    tap();
    navigation.getParent()?.getParent()?.navigate('AIHelpChat', { seed, autosend: true });
  };
  const openChat = () => { tap(); navigation.getParent()?.getParent()?.navigate('AIHelpChat', {}); };
  const goBody = () => { tap(); navigation.getParent()?.navigate('Experts'); };

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.40)', 'rgba(247,197,203,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.5, 1]}
        style={styles.pageWash}
      />

      <View style={styles.header}>
        <BackButton color={ROSE} />
        <View style={styles.dot} />
        <Text style={styles.hTitle}>{es ? 'rincón de mamá' : 'mamas corner'}</Text>
        <View style={styles.beeWrap}><Image source={VILLIE_BEE} style={styles.bee} /></View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* one calm line — the whole intent, no editorial stack */}
        <Text style={styles.intro}>{es ? 'La parte que es tuya.' : "The part that's yours."}</Text>

        {/* the one warm moment — plan my day, now showing TODAY on an arc */}
        <TouchableOpacity style={styles.planCard} activeOpacity={0.92} onPress={goDayPlan}
          accessibilityRole="button"
          accessibilityLabel={es ? 'Planear mi día' : 'Plan my day'}
          accessibilityHint={
            ghost
              ? (es ? 'Elige tu ritmo de extracción para ver el día trazado' : 'Pick your pump rhythm to see the day mapped out')
              : nextSlot
                ? (es ? `Lo próximo: ${nextSlot.title} a las ${fmtTime(nextSlot.start)} ${meridiem(nextSlot.start)}`
                      : `Next up: ${nextSlot.title} at ${fmtTime(nextSlot.start)} ${meridiem(nextSlot.start)}`)
                : undefined
          }>
          <LinearGradient colors={[ROSE, '#E894AC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planInner}>
            <View style={styles.planHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.planTitle}>{es ? 'Planea mi día' : 'Plan my day'}</Text>
                <Text style={styles.planSub}>{es ? 'siestas y pumps alrededor de tu agenda' : 'naps + pumps around your schedule'}</Text>
              </View>
              <View style={styles.planArrow}><Text style={styles.planArrowText}>›</Text></View>
            </View>

            <View style={styles.planArcWrap}>
              <DayArc slots={preview?.slots ?? []} ghost={ghost} />
              <View style={styles.planArcEnds} pointerEvents="none">
                <Text style={styles.planArcEnd}>{es ? '7 am · despertar' : '7am · wake'}</Text>
                <Text style={styles.planArcEnd}>{es ? 'dormir · 7 pm' : 'bed · 7pm'}</Text>
              </View>
            </View>

            {ghost ? (
              <View style={styles.planFootRow}>
                <View style={styles.planPill}>
                  <Text style={styles.planPillText}>
                    {es ? 'elige tu ritmo ›' : 'pick your rhythm ›'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.planFootRow}>
                {nextSlot ? (
                  <View style={styles.planPill}>
                    <Text style={styles.planPillText} numberOfLines={1}>
                      {es ? 'lo próximo' : 'next up'} · {nextSlot.title.replace(/^[^\p{L}\d]+/u, '')} {fmtTime(nextSlot.start)}{meridiem(nextSlot.start)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.planPill}>
                    <Text style={styles.planPillText}>{es ? 'el día está hecho ✓' : "today's done ✓"}</Text>
                  </View>
                )}
                <View style={styles.planKey}>
                  <View style={[styles.planKeyDot, { backgroundColor: '#FFFDF8' }]} />
                  <Text style={styles.planKeyText}>{es ? 'siestas' : 'naps'}</Text>
                  <View style={[styles.planKeyDot, { backgroundColor: '#F6D27A', marginLeft: 9 }]} />
                  <Text style={styles.planKeyText}>{es ? 'pumps' : 'pumps'}</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Reset & Recharge — the nervous-system half of the corner.
            Sage-on-cream made it read as the first row of the quiet list below
            rather than a peer of plan-my-day. It's now the DUSK counterpart:
            same footprint, different time of day. Plan-my-day is warm daylight
            and logistics; this is dusk and breathing. Differentiated by tone,
            not by shouting louder — so it has presence without two rose
            gradients fighting each other. */}
        <TouchableOpacity style={styles.resetCard} activeOpacity={0.92} onPress={goReset}
          accessibilityRole="button" accessibilityLabel={es ? 'Necesito un momento' : 'I need a sec'}>
          <LinearGradient colors={['#3F2C4D', '#6A4463']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resetInner}>
            {/* Breathing rings, bled off the right — previews what's inside. */}
            <View style={styles.resetRings} pointerEvents="none">
              <View style={[styles.resetRing, { width: 132, height: 132, borderWidth: 1 }]} />
              <View style={[styles.resetRing, { width: 92, height: 92, borderWidth: 1.5 }]} />
              <View style={[styles.resetRing, { width: 54, height: 54, borderWidth: 2, backgroundColor: 'rgba(255,253,248,0.10)' }]} />
            </View>
            <Text style={styles.resetTitle}>{es ? 'Necesito un momento' : 'I need a sec'}</Text>
            <Text style={styles.resetSub}>
              {es ? 'respira, sonidos, un reinicio' : 'breathe, sounds, a reset'}
            </Text>
            <View style={styles.resetPill}>
              <Text style={styles.resetPillText}>{es ? 'abrir ›' : 'open ›'}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* everything else — one quiet list */}
        <View style={styles.momCard}>
          {/* First in the list because it is the only row that CHANGES every
              week — the rest are static tools. It also had no way in at all
              until now: WeeklyJourneyScreen's only tap-path lived on the
              legacy v9 Home, which stopped being mounted when Home V3 landed,
              so ~900 rows of her weekly content were reachable only through
              Billy. */}
          <MomRow emoji="📖" title={es ? 'Esta semana, para ti' : 'This week, for you'}
            sub={es ? 'una lectura, una lista, en quién apoyarte' : 'a read, a checklist, who to lean on'}
            onPress={goWeek} />
          <MomRow emoji="📋" title={es ? 'Hoja del día' : 'Day sheet'}
            sub={es ? 'pásasela a la abuela' : 'hand off to grandma'} onPress={goDaySheet} />
          <MomRow emoji="✦" title={es ? 'Planea algo para ti' : 'Plan something for you'}
            sub={es ? 'una clase, cita o un respiro' : 'a class, an appointment, or a break'}
            onPress={() => askVillie(es
              ? 'Ayúdame a planear algo para mí esta semana — una clase, una cita, o un descanso que quepa en mi agenda.'
              : 'Help me plan something for me this week — a class, an appointment, or just a break that fits my schedule.')} />
          <MomRow emoji="🌿" title={es ? 'Tu cuerpo, tu ritmo' : 'Your body, your pace'}
            sub={es ? 'piso pélvico y recuperación' : 'pelvic floor + recovery'} onPress={goBody} />
          {/* "Reads for your stage" is gone rather than demoted: it was a
              `soon` chip with nothing behind it, and the row above is the real
              version of what it promised. The corner now has no dead ends. */}
          <MomRow emoji="💡" title={es ? 'Tips de mamá' : 'Mom tips'}
            sub={es ? 'Una idea al día, para su semana' : "One idea a day, for her week"}
            onPress={goTips} last />
        </View>

        {/* one clean ask bar */}
        <TouchableOpacity style={styles.askBar} activeOpacity={0.9} onPress={openChat}
          accessibilityRole="button" accessibilityLabel={es ? 'Pregúntale a villie' : 'Ask villie'}>
          <View style={styles.askBarBee}><Image source={VILLIE_BEE} style={{ width: 16, height: 16 }} resizeMode="contain" /></View>
          <Text style={styles.askBarText}>{es ? 'pregúntale o dile a villie…' : 'ask or tell villie anything…'}</Text>
          <Text style={styles.askBarArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function MomRow({ emoji, title, sub, onPress, soon = false, last = false }: {
  emoji: string; title: string; sub?: string; onPress: () => void; soon?: boolean; last?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={[styles.momRow, !last && styles.momDivider]} accessibilityRole="button" accessibilityLabel={title}>
      <View style={styles.momIcon}><Text style={{ fontSize: 17 }}>{emoji}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.momTitle}>{title}</Text>
        {sub ? <Text style={styles.momSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {soon
        ? <View style={styles.soonPill}><Text style={styles.soonPillText}>soon</Text></View>
        : <Text style={styles.momChevron}>›</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingTop: 58, paddingBottom: 6, paddingHorizontal: 18,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ROSE },
  hTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: INK },
  beeWrap: { marginLeft: 'auto', opacity: 0.65 },
  bee: { width: 38, height: 38, transform: [{ rotate: '-12deg' }] },

  scroll: { paddingBottom: 90 },

  // Intro — one calm line, no eyebrow stack
  intro: { paddingHorizontal: 22, paddingTop: 12, fontFamily: FONTS.v3_display, fontSize: 22, lineHeight: 28, color: INK, letterSpacing: -0.5 },

  // Plan my day — the one warm moment
  planCard: {
    marginHorizontal: 22, marginTop: 18, borderRadius: 20,
    shadowColor: ROSE_DEEP, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.20, shadowRadius: 20, elevation: 4,
  },
  planInner: { borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18, overflow: 'hidden' },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planArrow: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  planArrowText: { fontFamily: FONTS.v2_link, fontSize: 19, color: '#FFFDF8', marginTop: -2 },
  planTitle: { fontFamily: FONTS.v3_display, fontSize: 22, color: '#FFFDF8', letterSpacing: -0.4 },
  planSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: 'rgba(255,253,248,0.92)', marginTop: 4, maxWidth: '92%' },
  // The arc sits full-bleed-ish inside the card, with its two ends labelled so
  // the marks read as a day rather than decoration.
  planArcWrap: { marginTop: 4, marginHorizontal: -4 },
  planArcEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2, paddingHorizontal: 2 },
  planArcEnd: {
    fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.1,
    textTransform: 'uppercase', color: 'rgba(255,253,248,0.66)',
  },
  planFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  planPill: { flexShrink: 1, backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  planPillText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#fff', letterSpacing: 0.3 },
  planKey: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planKeyDot: { width: 7, height: 7, borderRadius: 4 },
  planKeyText: {
    fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: 'rgba(255,253,248,0.8)',
  },

  // Quiet list — everything else, one calm group
  // Sage, not rose: the corner already has one gradient spark (plan my day).
  // This is the exhale — it should read calm, not compete.
  resetCard: {
    marginHorizontal: 22, marginTop: 12, borderRadius: 20,
    shadowColor: '#2E1F3A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 4,
  },
  resetInner: { borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18, minHeight: 128, overflow: 'hidden' },
  resetRings: { position: 'absolute', top: -26, right: -30, width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  resetRing: { position: 'absolute', borderRadius: 999, borderColor: 'rgba(255,253,248,0.28)' },
  resetTitle: { fontFamily: FONTS.v3_display, fontSize: 22, color: '#FFFDF8', letterSpacing: -0.4 },
  resetSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: 'rgba(255,253,248,0.88)', marginTop: 4, maxWidth: '78%' },
  resetPill: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  resetPillText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#fff', letterSpacing: 0.3 },
  momCard: {
    marginHorizontal: 22, marginTop: 20, backgroundColor: COLORS.v2_paper, borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
  },
  momRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15 },
  momDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(122,74,40,0.12)' },
  momIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F6EAF0', alignItems: 'center', justifyContent: 'center' },
  momTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: INK, letterSpacing: -0.3 },
  momSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: INKSOFT, marginTop: 1 },
  momChevron: { fontFamily: FONTS.v2_link, fontSize: 20, color: '#C9B7A2' },
  soonPill: { backgroundColor: COLORS.v2_parchment, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(192,120,64,0.3)' },
  soonPillText: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: INKSOFT, fontWeight: '600' },

  // Ask bar — one clean entry, no dark ribbon
  askBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 22, marginTop: 20,
    backgroundColor: '#F7EAD8', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: 'rgba(194,74,99,0.32)',
  },
  askBarBee: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  askBarText: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 13.5, color: '#A87A54' },
  askBarArrow: { fontFamily: FONTS.v2_link, fontSize: 20, color: ROSE },
});
