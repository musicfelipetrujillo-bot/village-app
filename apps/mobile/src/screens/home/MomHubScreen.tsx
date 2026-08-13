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

const ROSE = '#C24A63', ROSE_DEEP = '#9E2F4C', HONEY = '#B98A1E';
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

  const goDayPlan = () => { tap(); navigation.navigate('DayPlan'); };
  const goDaySheet = () => { tap(); navigation.navigate('DaySheetList'); };
  const goReset = () => { tap(); navigation.navigate('ResetRecharge'); };
  const goTips = () => { tap(); navigation.navigate('MomTips'); };
  const askVillie = (seed: string) => {
    tap();
    navigation.getParent()?.getParent()?.navigate('AIHelpChat', { seed, autosend: true });
  };
  const openChat = () => { tap(); navigation.getParent()?.getParent()?.navigate('AIHelpChat', {}); };
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
        {/* one calm line — the whole intent, no editorial stack */}
        <Text style={styles.intro}>{es ? 'La parte que es tuya.' : "The part that's yours."}</Text>

        {/* the one warm moment — plan my day */}
        <TouchableOpacity style={styles.planCard} activeOpacity={0.92} onPress={goDayPlan}
          accessibilityRole="button" accessibilityLabel={es ? 'Planear mi día' : 'Plan my day'}>
          <LinearGradient colors={[ROSE, '#E894AC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planInner}>
            <Text style={styles.planGlyph}>🗓️</Text>
            <Text style={styles.planTitle}>{es ? 'Planea mi día' : 'Plan my day'}</Text>
            <Text style={styles.planSub}>{es ? 'siestas y pumps alrededor de tu agenda' : 'naps + pumps around your schedule'}</Text>
            <View style={styles.planPill}><Text style={styles.planPillText}>{es ? 'abrir ›' : 'open ›'}</Text></View>
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
          <MomRow emoji="📋" title={es ? 'Hoja del día' : 'Day sheet'}
            sub={es ? 'pásasela a la abuela' : 'hand off to grandma'} onPress={goDaySheet} />
          <MomRow emoji="✦" title={es ? 'Planea algo para ti' : 'Plan something for you'}
            sub={es ? 'una clase, cita o un respiro' : 'a class, an appointment, or a break'}
            onPress={() => askVillie(es
              ? 'Ayúdame a planear algo para mí esta semana — una clase, una cita, o un descanso que quepa en mi agenda.'
              : 'Help me plan something for me this week — a class, an appointment, or just a break that fits my schedule.')} />
          <MomRow emoji="🌿" title={es ? 'Tu cuerpo, tu ritmo' : 'Your body, your pace'}
            sub={es ? 'piso pélvico y recuperación' : 'pelvic floor + recovery'} onPress={goBody} />
          <MomRow emoji="💡" title={es ? 'Tips de mamá' : 'Mom tips'}
            sub={es ? 'Una idea al día, para su semana' : "One idea a day, for her week"}
            onPress={goTips} />
          <MomRow emoji="📖" title={es ? 'Lecturas para tu etapa' : 'Reads for your stage'} soon onPress={comingSoon} last />
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
  planInner: { borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18, minHeight: 128, overflow: 'hidden' },
  planGlyph: { position: 'absolute', top: 14, right: 16, fontSize: 26, opacity: 0.9 },
  planTitle: { fontFamily: FONTS.v3_display, fontSize: 22, color: '#FFFDF8', letterSpacing: -0.4 },
  planSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: 'rgba(255,253,248,0.92)', marginTop: 4, maxWidth: '82%' },
  planPill: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  planPillText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#fff', letterSpacing: 0.3 },

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
