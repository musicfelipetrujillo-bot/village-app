// Insights — the narrated "you + baby, this week" view.
//
// Villie reads your own data back in plain language (top), with the supporting
// numbers underneath. Everything is patterns-from-your-logs, never medical
// advice. Sources: baby tracker (RecentStats), Milk Vault (core), home
// (baby profile + milestone), daily check-ins (mood trend).

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { babyTrackerApi, type RecentStats } from '@api/babyTracker';
import { homeApi } from '@api/home';
import { useHomeStore } from '@store/home';
import { useMilkVaultStore } from '@store/milkVault';
import { FONTS } from '@utils/constants';
import { ScreenHeader } from '@components/shared/ScreenHeader';
import { useUserStore } from '@store/user';
import PlaybookTracker from '@/components/manual/PlaybookTracker';

const C = {
  cream: '#FCF7EF', paper: '#FFFCF6',
  rose: '#C24A63', roseInk: '#9E2F4C', roseTint: '#FDECEF',
  honey: '#D9789A', honeyCard: '#FBE0E8', honeyInk: '#A84A66',
  cocoa: '#3D2116', walnut: '#8A6A55', sage: '#7B8A46', muted: '#A6957F',
  hair: 'rgba(61,31,14,0.08)',
};

const ICON = {
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
  chev: 'M9 6l6 6-6 6',
} as const;

function Glyph({ d, color, size = 16, sw = 1.8 }: { d: string; color: string; size?: number; sw?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function fmtMin(m: number | null | undefined): string {
  if (!m || m <= 0) return '—';
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
const MOOD_DOT = ['#E0D6BE', '#C24A63', '#F3B9C8', '#FBE0A6', '#C3D19A', '#A7C070'];

export default function InsightsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const setBabyProfile = useHomeStore((s) => s.setBabyProfile);
  const milestone = useHomeStore((s) => s.currentMilestone);
  const vault = useMilkVaultStore((s) => s.core);
  const fetchVault = useMilkVaultStore((s) => s.fetchAll);

  const [stats, setStats] = useState<RecentStats | null>(null);
  const [loading, setLoading] = useState(true);
  // 0 = this week; 1 = last week; etc. The "this week" chip steps this back so
  // moms can see past weeks' real patterns.
  const [weekOffset, setWeekOffset] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        // The tracker's logging (feed/sleep/diaper) is a silent no-op unless a
        // baby profile is loaded. Don't rely on Home having populated the store
        // — if it's missing, pull it here so L/R, diaper, and sleep actually work.
        if (!babyProfile) {
          homeApi.getMyBabyProfile().then((p) => { if (!cancelled && p) setBabyProfile(p); }).catch(() => {});
        }
        const s = await babyTrackerApi.getRecentStats(7, weekOffset).catch(() => null);
        fetchVault().catch(() => {});
        if (!cancelled) { setStats(s); setLoading(false); }
      })();
      return () => { cancelled = true; };
    }, [fetchVault, babyProfile, setBabyProfile, weekOffset]),
  );

  const babyName = babyProfile?.baby_name ?? 'your baby';
  const week = babyProfile?.current_week_number ?? null;
  const lang = (useUserStore.getState().profile?.preferred_language ?? 'en') as 'en' | 'es';
  const ww = stats?.avgWakeWindowMin ?? null;
  const milkAdded = vault?.weeklyOuncesAdded ?? 0;
  const isCurrentWeek = weekOffset === 0;
  const displayWeek = week != null ? Math.max(1, week - weekOffset) : null;
  const weekLabel = weekOffset === 0
    ? (lang === 'es' ? 'esta semana' : 'this week')
    : weekOffset === 1
      ? (lang === 'es' ? 'semana pasada' : 'last week')
      : (lang === 'es' ? `hace ${weekOffset} sem` : `${weekOffset} wks ago`);

  const bits: string[] = [];
  if (ww) bits.push(`${babyName}'s wake windows averaged about ${fmtMin(ww)} ${isCurrentWeek ? 'this week' : 'that week'}${ww >= 120 ? ' — a sign they may be ready to stretch to fewer, longer naps' : ''}.`);
  if (isCurrentWeek && milkAdded > 0) bits.push(`Your freezer's up ${milkAdded} oz this week.`);
  const narration = bits.length > 0
    ? bits.join(' ')
    : (isCurrentWeek
        ? `Log a few naps or feeds and Villie will start reading your week back to you here.`
        : `No naps or feeds logged ${weekLabel}.`);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={[]}>
        <ScreenHeader
          title={lang === 'es' ? 'tu día' : 'your day'}
          onBack={() => nav.goBack()}
          backColor={C.roseInk}
          right={
            <View style={styles.weekStepper}>
              <TouchableOpacity
                onPress={() => setWeekOffset((o) => Math.min(o + 1, week != null ? week - 1 : 12))}
                disabled={weekOffset >= (week != null ? week - 1 : 12)}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 6 }}
                accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Semana anterior' : 'Previous week'}
              >
                <Text style={[styles.weekArrow, weekOffset >= (week != null ? week - 1 : 12) && { opacity: 0.25 }]}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.weekStepperText}>{weekLabel}</Text>
              <TouchableOpacity
                onPress={() => setWeekOffset((o) => Math.max(o - 1, 0))}
                disabled={weekOffset === 0}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 8 }}
                accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Semana siguiente' : 'Next week'}
              >
                <Text style={[styles.weekArrow, weekOffset === 0 && { opacity: 0.25 }]}>›</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={C.rose} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
            {/* Two clearly-labeled zones (founder 2026-08-10): LOG at the top (do),
                INSIGHTS below (read back). Quick-log on Home lands here. */}
            <Text style={styles.sectionLabel}>{lang === 'es' ? 'Registrar' : 'Log'}</Text>
            <PlaybookTracker
              babyProfileId={babyProfile?.id ?? null}
              babyName={babyProfile?.baby_name ?? 'baby'}
              week={week ?? 1}
              lang={lang}
              initialPane={route.params?.pane}
              onNeedBaby={() => nav.navigate('BabyProfileSetup')}
              onSeeAll={() => nav.navigate('LogHistory')}
            />

            <Text style={[styles.sectionLabel, { marginTop: 26 }]}>{lang === 'es' ? 'Análisis' : 'Insights'}</Text>

            {/* Villie's read — the gradient "Villie moment" */}
            <LinearGradient colors={['#C24A63', '#E894AC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.narrCard}>
              <View style={styles.narrHead}>
                <View style={styles.narrBee}><Glyph d={ICON.spark} color={C.honeyInk} size={15} /></View>
                <Text style={styles.narrEyebrow}>villie's read on your week</Text>
              </View>
              <Text style={styles.narrText}>{narration}</Text>
            </LinearGradient>

            {/* Sleep */}
            <View style={[styles.card, { backgroundColor: '#F1F5E6', borderColor: 'rgba(123,138,70,0.16)' }]}>
              <View style={styles.cardHead}>
                <View style={styles.rowGap}><Glyph d={ICON.moon} color={C.sage} size={15} /><Text style={styles.cardEyebrow}>{babyName}'s sleep</Text></View>
              </View>
              {ww || stats?.avgNapMin ? (
                <>
                  <Text style={styles.bigVal}>{fmtMin(ww)}<Text style={styles.bigValSub}> avg wake window</Text></Text>
                  <Text style={styles.cardBody}>Naps averaging {fmtMin(stats?.avgNapMin)} · {stats?.sleepSessions ?? 0} logged this week.</Text>
                </>
              ) : (
                <Text style={styles.cardBody}>{lang === 'es' ? 'Registra una siesta arriba ↑ y tus patrones de sueño aparecen aquí.' : 'Log a nap up in Log ↑ and your sleep patterns show up here.'}</Text>
              )}
            </View>

            {/* Milk + growth */}
            <View style={styles.twoUp}>
              {isCurrentWeek ? (
                <View style={[styles.miniCard, { backgroundColor: C.roseTint }]}>
                  <Text style={[styles.miniEyebrow, { color: C.roseInk }]}>milk stashed</Text>
                  <Text style={styles.miniBig}>+{milkAdded}<Text style={styles.miniUnit}> oz</Text></Text>
                  <Text style={styles.miniSub}>{vault?.totalFreezerOz ?? 0} oz in the freezer</Text>
                </View>
              ) : (
                <View style={[styles.miniCard, { backgroundColor: C.roseTint }]}>
                  <Text style={[styles.miniEyebrow, { color: C.roseInk }]}>feeds a day</Text>
                  <Text style={styles.miniBig}>{stats?.feedsPerDay ?? '—'}</Text>
                  <Text style={styles.miniSub}>{stats?.feeds ?? 0} feeds logged that week</Text>
                </View>
              )}
              <View style={[styles.miniCard, { backgroundColor: C.honeyCard }]}>
                <Text style={[styles.miniEyebrow, { color: C.honeyInk }]}>{babyName} {isCurrentWeek ? 'is' : 'was'}</Text>
                <Text style={styles.miniBig}>{displayWeek ?? '—'}<Text style={styles.miniUnit}> {displayWeek ? 'wks' : ''}</Text></Text>
                <Text style={styles.miniSub} numberOfLines={2}>{isCurrentWeek ? (milestone?.title ?? 'growing every day') : 'looking back'}</Text>
              </View>
            </View>

            <Text style={styles.disclaimer}>patterns from your own logs — not medical advice</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  back: { fontSize: 30, color: C.roseInk, marginTop: -4 },
  // Editorial masthead (not the 17px HubHeader spec — Insights is a destination
  // screen, not a vertical hub): Bricolage display at 28, lowercase brand voice.
  title: { fontFamily: FONTS.headerBold, fontSize: 28, color: C.cocoa, letterSpacing: -0.5 },
  weekChip: { backgroundColor: '#F2E6DD', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  weekChipText: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.3, textTransform: 'uppercase', color: C.walnut, fontWeight: '600' },
  weekStepper: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F2E6DD', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  weekStepperText: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: C.walnut, fontWeight: '600', minWidth: 64, textAlign: 'center' },
  weekArrow: { fontFamily: FONTS.v2_link, fontSize: 18, color: C.roseInk, paddingHorizontal: 3, marginTop: -2 },
  sectionLabel: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.walnut, fontWeight: '600', marginHorizontal: 16, marginTop: 6, marginBottom: 8 },

  narrCard: { borderRadius: 18, padding: 18, marginHorizontal: 16, overflow: 'hidden' },
  narrHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  narrBee: { width: 27, height: 27, borderRadius: 14, backgroundColor: 'rgba(255,252,246,0.6)', alignItems: 'center', justifyContent: 'center' },
  narrEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: '#8A3A54', fontWeight: '600' },
  narrText: { fontFamily: FONTS.v2_body, fontSize: 15, lineHeight: 24, color: '#43260F' },

  card: { backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 16, padding: 16, marginHorizontal: 16, marginTop: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: C.walnut, fontWeight: '500' },
  cardMeta: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: C.walnut, fontWeight: '600' },
  bigVal: { fontFamily: FONTS.v2_display_big, fontSize: 26, color: '#5B6B37', marginTop: 12 },
  bigValSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: C.walnut },
  cardBody: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: '#5A4030', marginTop: 8 },
  emptyLink: { fontFamily: FONTS.v2_link, fontSize: 13.5, color: C.roseInk, marginTop: 12 },

  twoUp: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 12 },
  miniCard: { flex: 1, borderRadius: 14, padding: 14 },
  miniEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '600' },
  miniBig: { fontFamily: FONTS.v2_display_big, fontSize: 26, color: C.cocoa, marginTop: 8 },
  miniUnit: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut },
  miniSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: '#5A4030', marginTop: 4, lineHeight: 15 },

  moodRow: { flexDirection: 'row', gap: 7, marginTop: 14, alignItems: 'center' },
  moodDot: { width: 26, height: 26, borderRadius: 13 },
  moodDotWarn: { borderWidth: 2, borderColor: C.rose },
  moodNudge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.roseTint, borderRadius: 11, padding: 11, marginTop: 14 },
  moodNudgeText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 17, color: '#5A4030' },

  disclaimer: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.muted, textAlign: 'center', marginTop: 20, marginHorizontal: 24 },
});
