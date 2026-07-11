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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { babyTrackerApi, type RecentStats } from '@api/babyTracker';
import { homeApi } from '@api/home';
import { useHomeStore } from '@store/home';
import { useMilkVaultStore } from '@store/milkVault';
import { FONTS } from '@utils/constants';

const C = {
  cream: '#FCF7EF', paper: '#FFFCF6',
  rose: '#E06A88', roseInk: '#C2556F', roseTint: '#FDECEF',
  honey: '#F5C842', honeyCard: '#FBE9BE', honeyInk: '#B98A1E',
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
const MOOD_DOT = ['#E0D6BE', '#E06A88', '#F3B9C8', '#FBE0A6', '#C3D19A', '#A7C070'];

export default function InsightsScreen() {
  const nav = useNavigation<any>();
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const milestone = useHomeStore((s) => s.currentMilestone);
  const vault = useMilkVaultStore((s) => s.core);
  const fetchVault = useMilkVaultStore((s) => s.fetchAll);

  const [stats, setStats] = useState<RecentStats | null>(null);
  const [moods, setMoods] = useState<{ checkin_date: string; mood_score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const [s, m] = await Promise.all([
          babyTrackerApi.getRecentStats(7).catch(() => null),
          homeApi.getRecentCheckins(7).catch(() => [] as { checkin_date: string; mood_score: number }[]),
        ]);
        fetchVault().catch(() => {});
        if (!cancelled) { setStats(s); setMoods(m); setLoading(false); }
      })();
      return () => { cancelled = true; };
    }, [fetchVault]),
  );

  const babyName = babyProfile?.baby_name ?? 'your baby';
  const week = babyProfile?.current_week_number ?? null;
  const ww = stats?.avgWakeWindowMin ?? null;
  const milkAdded = vault?.weeklyOuncesAdded ?? 0;
  const goodDays = moods.filter((m) => m.mood_score >= 3).length;
  const hardDays = moods.filter((m) => m.mood_score <= 2).length;

  const bits: string[] = [];
  if (ww) bits.push(`${babyName}'s wake windows are averaging about ${fmtMin(ww)}${ww >= 120 ? ' — a sign they may be ready to stretch to fewer, longer naps' : ''}.`);
  if (milkAdded > 0) bits.push(`Your freezer's up ${milkAdded} oz this week.`);
  if (moods.length > 0) bits.push(hardDays > goodDays ? 'A couple of harder days this week — worth a gentle look below.' : `You logged ${goodDays} good ${goodDays === 1 ? 'day' : 'days'}.`);
  const narration = bits.length > 0 ? bits.join(' ') : `Log a few naps, feeds, or a daily check-in and Villie will start reading your week back to you here.`;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>insights</Text>
          <View style={styles.weekChip}><Text style={styles.weekChipText}>this week</Text></View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={C.rose} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
            {/* Villie's read — the gradient "Villie moment" */}
            <LinearGradient colors={['#EE94AC', '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.narrCard}>
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
                <TouchableOpacity onPress={() => nav.getParent()?.navigate('Manual' as never)} accessibilityRole="button"><Text style={styles.emptyLink}>Start logging naps in Playbook →</Text></TouchableOpacity>
              )}
            </View>

            {/* Milk + growth */}
            <View style={styles.twoUp}>
              <View style={[styles.miniCard, { backgroundColor: C.roseTint }]}>
                <Text style={[styles.miniEyebrow, { color: C.roseInk }]}>milk stashed</Text>
                <Text style={styles.miniBig}>+{milkAdded}<Text style={styles.miniUnit}> oz</Text></Text>
                <Text style={styles.miniSub}>{vault?.totalFreezerOz ?? 0} oz in the freezer</Text>
              </View>
              <View style={[styles.miniCard, { backgroundColor: C.honeyCard }]}>
                <Text style={[styles.miniEyebrow, { color: C.honeyInk }]}>{babyName} is</Text>
                <Text style={styles.miniBig}>{week ?? '—'}<Text style={styles.miniUnit}> {week ? 'wks' : ''}</Text></Text>
                <Text style={styles.miniSub} numberOfLines={2}>{milestone?.title ?? 'growing every day'}</Text>
              </View>
            </View>

            {/* Mood */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.rowGap}><Glyph d={ICON.heart} color={C.roseInk} size={15} /><Text style={styles.cardEyebrow}>how you're doing</Text></View>
                {moods.length > 0 && <Text style={styles.cardMeta}>{goodDays} good · {hardDays} hard</Text>}
              </View>
              {moods.length > 0 ? (
                <>
                  <View style={styles.moodRow}>
                    {moods.slice(-7).map((m, i) => (
                      <View key={i} style={[styles.moodDot, { backgroundColor: MOOD_DOT[m.mood_score] ?? MOOD_DOT[0] }, m.mood_score <= 2 && styles.moodDotWarn]} />
                    ))}
                  </View>
                  {hardDays > 0 && (
                    <TouchableOpacity style={styles.moodNudge} onPress={() => nav.navigate('DailyCheckin')} accessibilityRole="button">
                      <Glyph d={ICON.heart} color={C.roseInk} size={16} />
                      <Text style={styles.moodNudgeText}>A rough patch shows here. A quick check-in, or someone to talk to?</Text>
                      <Glyph d={ICON.chev} color="#D19AAA" size={16} />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity onPress={() => nav.navigate('DailyCheckin')} accessibilityRole="button"><Text style={styles.emptyLink}>Do a daily check-in to track how you're feeling →</Text></TouchableOpacity>
              )}
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
  title: { fontFamily: FONTS.v2_bold, fontSize: 17, color: C.cocoa },
  weekChip: { backgroundColor: '#F2E6DD', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  weekChipText: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.3, textTransform: 'uppercase', color: C.walnut, fontWeight: '600' },

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
