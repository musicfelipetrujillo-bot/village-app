// MomHubScreen — "mamas corner" (reworked 2026-07-15)
//
// The all-things-mom hub. Design logic (Felipe: "no wall of hero boxes — make
// it visually make sense"): FIVE different visual forms, one gradient moment.
//   1. editorial opening — typography on the page (check-in as a text link)
//   2. "your day · next up" — a slim live strip from the day plan
//   3. ONE asymmetric bento — calendar gradient tile + two quiet mini-tiles
//   4. "for you" — magazine-style numbered index rows (not cards)
//   5. a single dark ask-villie ribbon to anchor the bottom
// Plan my day + Day Sheet moved here from Home; the customized routine lives
// here (day plan = logs + calendar), while the logs read-back lives in Insights.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { useHomeStore } from '@store/home';
import { useUserStore } from '@store/user';
import { tap, select } from '@utils/haptics';
import { getCalendarPermission, getTodayBusyBlocks } from '@utils/calendar';
import { getPumpCadence, buildDayPlan, fmtTime, type PlanSlot } from '@utils/dayPlan';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

const ROSE = '#E84B79', ROSE_DEEP = '#B0234F', HONEY = '#B98A1E';
const INK = '#43260F', INKSOFT = '#7A5A3A', MUTED = '#A6957F';

const SLOT_TONE: Record<PlanSlot['kind'], { bg: string; border: string; time: string }> = {
  calendar: { bg: '#EFE7DA', border: '#E4D8C4', time: '#8A6A55' },
  nap: { bg: '#FDECEF', border: '#F3C6D2', time: '#C2556F' },
  feed: { bg: '#FDECEF', border: '#F3C6D2', time: '#C2556F' },
  pump: { bg: '#FBF0D5', border: '#EFD9A0', time: HONEY },
};
const SLOT_EMOJI: Partial<Record<PlanSlot['kind'], string>> = { nap: '😴', feed: '🍼', pump: '🍼' };

export default function MomHubScreen() {
  const navigation = useNavigation<any>();
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const lang = useUserStore((s) => (s.profile?.preferred_language ?? 'en')) as 'en' | 'es';
  const es = lang === 'es';

  // Best-effort "next up" strip — only when the calendar planner is set up.
  // Never prompts; the strip degrades to a soft invitation.
  const [nextSlots, setNextSlots] = useState<PlanSlot[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [perm, cadence] = await Promise.all([getCalendarPermission(), getPumpCadence()]);
          if (perm !== 'granted' || !cadence) { if (!cancelled) setNextSlots(null); return; }
          const busy = await getTodayBusyBlocks();
          const plan = buildDayPlan({
            busy,
            weekNumber: babyProfile?.current_week_number ?? 8,
            cadence,
            babyName: babyProfile?.baby_name ?? 'baby',
          });
          if (!cancelled) setNextSlots(plan.slots.slice(0, 3));
        } catch { if (!cancelled) setNextSlots(null); }
      })();
      return () => { cancelled = true; };
    }, [babyProfile?.current_week_number, babyProfile?.baby_name]),
  );

  const goCheckin = () => { select(); navigation.navigate('DailyCheckin'); };
  const goDayPlan = () => { tap(); navigation.navigate('DayPlan'); };
  const goDaySheet = () => { tap(); navigation.navigate('DaySheetList'); };
  const askVillie = (seed: string) => {
    tap();
    navigation.getParent()?.getParent()?.navigate('AIHelpChat', { seed, autosend: true });
  };
  const goBody = () => { tap(); navigation.getParent()?.navigate('Experts'); };
  const comingSoon = () => { select(); };

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
        {/* 1 · editorial opening — typography, not a card */}
        <View style={styles.opening}>
          <Text style={styles.eyebrow}>{es ? 'LA PARTE QUE ES TUYA' : "THE PART THAT'S YOURS"}</Text>
          <Text style={styles.title}>
            {es ? '¿cómo estás ' : 'how are '}
            <Text style={styles.titleItalic}>{es ? 'tú' : 'you'}</Text>
            {es ? ', mamá?' : ' doing, mama?'}
          </Text>
          <View style={styles.openingRow}>
            <Text style={styles.openingSub}>{es ? 'no solo el bebé — tú.' : 'not just the baby — you.'}</Text>
            {/* Support framing, not tracking (Felipe 2026-07-15): the check-in
                is a vent + crisis safety net — never a streak or a chart. */}
            <TouchableOpacity onPress={goCheckin} accessibilityRole="button"
              accessibilityLabel={es ? 'Cuéntale a villie cómo vas' : 'Tell villie how it’s going'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.checkinLink}>♥ {es ? 'cuéntale a villie ›' : 'tell villie how it’s going ›'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rule} />

        {/* 2 · your day — slim live strip (or a soft invitation) */}
        <View style={styles.dayHead}>
          <Text style={styles.eyebrow}>{es ? 'TU DÍA · SIGUE' : 'YOUR DAY · NEXT UP'}</Text>
          <TouchableOpacity onPress={goDayPlan} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.dayLink}>{es ? 'planear mi día ›' : 'plan my day ›'}</Text>
          </TouchableOpacity>
        </View>
        {nextSlots && nextSlots.length > 0 ? (
          <View style={styles.slotRow}>
            {nextSlots.map((slot) => {
              const tone = SLOT_TONE[slot.kind];
              return (
                <TouchableOpacity key={slot.id} onPress={goDayPlan} activeOpacity={0.85}
                  style={[styles.slotChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                  <Text style={[styles.slotTime, { color: tone.time }]}>{fmtTime(slot.start)}</Text>
                  <Text style={styles.slotTitle} numberOfLines={1}>
                    {SLOT_EMOJI[slot.kind] ? `${SLOT_EMOJI[slot.kind]} ` : ''}{slot.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <TouchableOpacity onPress={goDayPlan} activeOpacity={0.85} style={styles.dayInvite}
            accessibilityRole="button" accessibilityLabel={es ? 'Planear mi día' : 'Plan my day'}>
            <Text style={styles.dayInviteText}>
              {es
                ? 'conecta tu calendario y villie teje siestas + extracciones alrededor de tus reuniones →'
                : 'connect your calendar and villie weaves naps + pumps around your meetings →'}
            </Text>
          </TouchableOpacity>
        )}

        {/* 3 · one asymmetric bento — the single gradient moment */}
        <View style={styles.bento}>
          <TouchableOpacity style={styles.bentoHero} activeOpacity={0.92} onPress={goDayPlan}
            accessibilityRole="button" accessibilityLabel={es ? 'Tu calendario — planear mi día' : 'Your calendar — plan my day'}>
            <LinearGradient colors={[ROSE, '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bentoHeroInner}>
              <Text style={styles.bentoHeroGlyph}>🗓️</Text>
              <Text style={styles.bentoHeroEyebrow}>{es ? 'TU CALENDARIO' : 'YOUR CALENDAR'}</Text>
              <Text style={styles.bentoHeroTitle}>{es ? 'siestas + pumps,\nentretejidos.' : 'naps + pumps,\nwoven in.'}</Text>
              <View style={styles.bentoHeroPill}><Text style={styles.bentoHeroPillText}>{es ? 'abrir mi día ›' : 'open my day ›'}</Text></View>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.bentoCol}>
            <TouchableOpacity style={[styles.miniTile, { backgroundColor: '#FBEFD0', borderColor: '#EFD9A0' }]}
              activeOpacity={0.88} onPress={goDaySheet} accessibilityRole="button"
              accessibilityLabel={es ? 'Hoja del día' : 'Day sheet'}>
              <Text style={styles.miniGlyph}>📋</Text>
              <Text style={styles.miniTitle}>{es ? 'hoja del día' : 'day sheet'}</Text>
              <Text style={[styles.miniSub, { color: '#8A6A1E' }]}>{es ? 'para la abuela ›' : 'hand off to grandma ›'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.miniTile, { backgroundColor: COLORS.v2_paper, borderColor: '#EFE4D2' }]}
              activeOpacity={0.88}
              onPress={() => askVillie(es
                ? 'Ayúdame a planear algo para mí esta semana — una clase, una cita, o un descanso que quepa en mi agenda.'
                : 'Help me plan something for me this week — a class, an appointment, or just a break that fits my schedule.')}
              accessibilityRole="button" accessibilityLabel={es ? 'Planear algo' : 'Plan something'}>
              <Text style={styles.miniGlyph}>✦</Text>
              <Text style={styles.miniTitle}>{es ? 'planear algo' : 'plan something'}</Text>
              <Text style={styles.miniSub}>{es ? 'yoga · cita · un respiro ›' : 'PT · yoga · a break ›'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 · for you — magazine index, hairlines not cards */}
        <Text style={[styles.eyebrow, styles.forYouHead]}>{es ? 'PARA TI · ESTA SEMANA' : 'FOR YOU · THIS WEEK'}</Text>
        <IndexRow n="01" title={es ? 'trucos de mamá' : 'mom hacks'}
          sub={es ? 'victorias de 5 minutos de mamás que te entienden' : '5-minute wins from moms who get it'}
          soon onPress={comingSoon} />
        <IndexRow n="02" title={es ? 'lecturas para tu etapa' : 'reads for your stage'}
          sub={es ? 'sanar, dormir, y volver a ti' : 'healing, sleep, and coming back to you'}
          soon onPress={comingSoon} />
        <IndexRow n="03" title={es ? 'tu cuerpo, tu ritmo' : 'your body, your pace'}
          sub={es ? 'piso pélvico, movimiento, y cuidado postparto' : 'pelvic floor, movement, recovery care'}
          onPress={goBody} last />

        {/* 5 · dark villie ribbon */}
        <TouchableOpacity style={styles.ribbon} activeOpacity={0.9}
          onPress={() => askVillie(es ? '¿Cuándo puedo tomar una clase de yoga esta semana?' : 'When can I fit a yoga class this week?')}
          accessibilityRole="button" accessibilityLabel={es ? 'Pregúntale a villie' : 'Ask villie'}>
          <View style={styles.ribbonSpark}>
            <LinearGradient colors={[ROSE, '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ribbonSparkInner}>
              <Text style={{ color: '#fff', fontSize: 15 }}>✦</Text>
            </LinearGradient>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.ribbonEyebrow}>{es ? 'PREGÚNTALE A VILLIE' : 'ASK VILLIE'}</Text>
            <Text style={styles.ribbonText} numberOfLines={1}>
              {es ? '"¿cuándo me toca una clase de yoga?"' : '"when can I fit a yoga class this week?"'}
            </Text>
          </View>
          <Text style={styles.ribbonArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function IndexRow({ n, title, sub, onPress, soon = false, last = false }: {
  n: string; title: string; sub: string; onPress: () => void; soon?: boolean; last?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={soon ? 0.7 : 0.8}
      style={[styles.idxRow, !last && styles.idxBorder]} accessibilityRole="button" accessibilityLabel={title}>
      <Text style={styles.idxNum}>{n}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.idxTitle}>{title}</Text>
        <Text style={styles.idxSub}>{sub}</Text>
      </View>
      {soon
        ? <View style={styles.soonPill}><Text style={styles.soonPillText}>soon</Text></View>
        : <Text style={styles.idxChevron}>›</Text>}
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

  eyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600', color: HONEY },

  // 1 · opening
  opening: { paddingHorizontal: 22, paddingTop: 14 },
  title: { marginTop: 6, fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 34, color: INK, letterSpacing: -0.8 },
  titleItalic: { fontFamily: FONTS.v3_display_italic, color: ROSE, fontWeight: '600' },
  openingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  openingSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: INKSOFT },
  checkinLink: { fontFamily: FONTS.v2_bold, fontSize: 12.5, color: ROSE },

  rule: { height: 1, backgroundColor: '#EFE0C8', marginHorizontal: 22, marginTop: 18 },

  // 2 · your day strip
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 8 },
  dayLink: { fontFamily: FONTS.v2_bold, fontSize: 12, color: ROSE },
  slotRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22 },
  slotChip: { flexShrink: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  slotTime: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 0.5 },
  slotTitle: { fontFamily: FONTS.v2_bold, fontSize: 12, color: INK, marginTop: 1 },
  dayInvite: { marginHorizontal: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E0C9A6', borderRadius: 13, padding: 12, backgroundColor: 'rgba(255,253,250,0.7)' },
  dayInviteText: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: INKSOFT },

  // 3 · bento
  bento: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingTop: 18, alignItems: 'stretch' },
  bentoHero: {
    flex: 1.35, borderRadius: 20,
    shadowColor: ROSE_DEEP, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 4,
  },
  bentoHeroInner: { borderRadius: 20, padding: 16, minHeight: 158, overflow: 'hidden' },
  bentoHeroGlyph: { position: 'absolute', top: 10, right: 12, fontSize: 24, opacity: 0.9 },
  bentoHeroEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.6, color: 'rgba(255,255,255,0.88)', fontWeight: '600' },
  bentoHeroTitle: { marginTop: 6, fontFamily: FONTS.v3_display, fontSize: 19, lineHeight: 22, color: '#FFFDF8', letterSpacing: -0.3 },
  bentoHeroPill: { marginTop: 'auto', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 2 },
  bentoHeroPillText: { fontFamily: FONTS.v2_bold, fontSize: 11.5, color: '#fff' },
  bentoCol: { flex: 1, gap: 12 },
  miniTile: { flex: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  miniGlyph: { fontSize: 18 },
  miniTitle: { fontFamily: FONTS.v2_bold, fontSize: 13.5, color: INK, marginTop: 4, lineHeight: 16 },
  miniSub: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: INKSOFT, marginTop: 2 },

  // 4 · index
  forYouHead: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 4 },
  idxRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, marginHorizontal: 22 },
  idxBorder: { borderBottomWidth: 1, borderBottomColor: '#F1E7D8' },
  idxNum: { fontFamily: FONTS.v2_display, fontSize: 17, color: '#E3B4C0' },
  idxTitle: { fontFamily: FONTS.v2_bold, fontSize: 14.5, color: INK },
  idxSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: INKSOFT, marginTop: 1 },
  idxChevron: { fontFamily: FONTS.v2_bold, fontSize: 16, color: '#C9B7A2' },
  soonPill: { backgroundColor: COLORS.v2_parchment, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(192,120,64,0.3)' },
  soonPillText: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: INKSOFT, fontWeight: '600' },

  // 5 · ribbon
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 22, marginTop: 18, backgroundColor: '#43260F', borderRadius: 18, paddingVertical: 13, paddingHorizontal: 15 },
  ribbonSpark: { width: 36, height: 36 },
  ribbonSparkInner: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ribbonEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.6, color: '#F4C868', fontWeight: '600' },
  ribbonText: { fontFamily: FONTS.v2_body, fontSize: 13, color: '#FFFDF8', marginTop: 2, fontWeight: '600' },
  ribbonArrow: { color: '#E98A9F', fontSize: 17, fontFamily: FONTS.v2_bold },
});
