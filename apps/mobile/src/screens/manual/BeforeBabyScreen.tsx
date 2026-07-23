// BeforeBabyScreen — the "before baby arrives" prep surface. Two checklists
// (hospital bag / home ready) on the Milk-Hub skeleton: compact header, one
// gradient progress hero, one segmented toggle. Check-state persists locally;
// the list prints/shares via the Day Sheet output path.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import { BackButton } from '@components/shared/BackButton';
import { useUserStore } from '@store/user';
import { BEFORE_BABY, BEFORE_BABY_TOTAL, beforeBabyHtml } from '@/manual/beforeBaby';

const STORE_KEY = 'village.beforeBaby.checked.v1';
const GRAD: [string, string] = ['#E84B79', '#F6C94F'];

function weeksAlong(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return null;
  const daysToDue = (due - Date.now()) / 86400000;
  if (daysToDue <= 0 || daysToDue > 300) return null; // past due / not plausibly pregnant
  const w = Math.round(40 - daysToDue / 7);
  return w >= 1 && w <= 42 ? w : null;
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 30, c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <View style={s.ringWrap}>
      <Svg width={78} height={78} viewBox="0 0 78 78">
        <Circle cx={39} cy={39} r={r} stroke="rgba(255,255,255,0.4)" strokeWidth={7} fill="none" />
        <Circle cx={39} cy={39} r={r} stroke="#FFFFFF" strokeWidth={7} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform="rotate(-90 39 39)" />
      </Svg>
      <View style={s.ringInner}>
        <Text style={s.ringNum}>{done}</Text>
        <Text style={s.ringOf}>of {total}</Text>
      </View>
    </View>
  );
}

export default function BeforeBabyScreen() {
  const insets = useSafeAreaInsets();
  const profile = useUserStore((st) => st.profile);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'hospital' | 'home'>('hospital');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
      } catch { /* first run — empty */ }
    })();
  }, []);

  const persist = (next: Set<string>) => {
    AsyncStorage.setItem(STORE_KEY, JSON.stringify([...next])).catch(() => {});
  };

  const toggle = (id: string) => {
    select();
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persist(next);
      return next;
    });
  };

  const done = checked.size;
  const wk = weeksAlong(profile?.due_date ?? null);
  const list = useMemo(() => BEFORE_BABY.find((l) => l.key === tab)!, [tab]);
  const babyName = profile?.full_name ? undefined : undefined; // baby name not on user profile; keep generic

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      tap();
      const { uri } = await Print.printToFileAsync({ html: beforeBabyHtml(checked, babyName) });
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch {
      Alert.alert('Couldn’t create the file', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <BackButton color={COLORS.v2_cinnamon} />
        <View style={s.dot} />
        <Text style={s.hTitle}>before baby</Text>
        <TouchableOpacity style={s.hShare} onPress={share} accessibilityRole="button" accessibilityLabel="Share checklist">
          <Text style={s.hShareIcon}>⤴</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View style={s.heroWrap}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <ProgressRing done={done} total={BEFORE_BABY_TOTAL} />
            <View style={s.heroText}>
              <Text style={s.heroEyebrow}>{wk ? `${wk} WEEKS · GETTING READY` : 'GETTING READY'}</Text>
              <Text style={s.heroTitle}>{done >= BEFORE_BABY_TOTAL ? 'all set.' : done > BEFORE_BABY_TOTAL / 2 ? 'almost packed.' : 'let’s get ready.'}</Text>
              <Text style={s.heroSub}>you’ve got this — a bit at a time.</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={s.toggle}>
          {BEFORE_BABY.map((l) => {
            const on = l.key === tab;
            return (
              <TouchableOpacity key={l.key} style={[s.tab, on && s.tabOn]} activeOpacity={0.9}
                onPress={() => { select(); setTab(l.key); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[s.tabText, on && s.tabTextOn]}>{l.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.blurb}>{list.blurb}</Text>

        {list.groups.map((g) => (
          <View key={g.title} style={s.group}>
            <Text style={s.groupTitle}>{g.title}</Text>
            <View style={s.card}>
              {g.items.map((it, i) => {
                const on = checked.has(it.id);
                return (
                  <TouchableOpacity key={it.id} activeOpacity={0.8} onPress={() => toggle(it.id)}
                    style={[s.row, i > 0 && s.rowBorder]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <View style={[s.bx, on && s.bxOn]}>{on && <Text style={s.bxCheck}>✓</Text>}</View>
                    <View style={s.rowText}>
                      <Text style={[s.rowLabel, on && s.rowLabelOn]}>{it.label}</Text>
                      {!!it.note && <Text style={s.rowNote}>{it.note}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={s.tipNote}>
          <Text style={s.tipSpark}>✦</Text>
          <Text style={s.tipText}>villie built this from your due date. tap any line to add or skip what fits your family.</Text>
        </View>

        <View style={s.footRow}>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.9} onPress={share} disabled={busy}
            accessibilityRole="button" accessibilityLabel="Share with partner">
            <Text style={s.shareBtnText}>{busy ? 'preparing…' : 'share with partner'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const INK = '#43260F', INKSOFT = '#7A5A3A', ROSE = COLORS.v2_cinnamon, HONEY = '#B98A1E';
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.v2_cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.genz_honey },
  hTitle: { fontFamily: FONTS.headerBold, fontSize: 19, color: INK },
  hShare: { marginLeft: 'auto', width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  hShareIcon: { fontSize: 19, color: INKSOFT },

  heroWrap: { paddingHorizontal: 16, paddingTop: 4 },
  hero: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringWrap: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  ringInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: FONTS.v2_display_big, fontSize: 24, color: '#4A1F2C', lineHeight: 26 },
  ringOf: { fontFamily: FONTS.bodySemiBold, fontSize: 10, color: '#5c3b2a' },
  heroText: { flex: 1 },
  heroEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10.5, letterSpacing: 1.4, color: '#4A1F2C' },
  heroTitle: { fontFamily: FONTS.v2_display, fontSize: 24, color: '#4A1F2C', marginTop: 3 },
  heroSub: { fontFamily: FONTS.body, fontSize: 12.5, color: '#5c3b2a', marginTop: 2 },

  toggle: { flexDirection: 'row', backgroundColor: '#F1E7D8', borderRadius: 14, padding: 4, marginHorizontal: 16, marginTop: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  tabOn: { backgroundColor: ROSE },
  tabText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: INKSOFT },
  tabTextOn: { fontFamily: FONTS.bodyBold, color: '#fff' },

  blurb: { fontFamily: FONTS.body, fontSize: 13, color: INKSOFT, marginHorizontal: 22, marginTop: 12 },

  group: { marginTop: 14, paddingHorizontal: 16 },
  groupTitle: { fontFamily: FONTS.bodyBold, fontSize: 13, color: ROSE, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: COLORS.v2_paper, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(67,38,15,0.07)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 15 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(67,38,15,0.06)' },
  bx: { width: 23, height: 23, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(67,38,15,0.22)', alignItems: 'center', justifyContent: 'center' },
  bxOn: { backgroundColor: ROSE, borderColor: ROSE },
  bxCheck: { color: '#fff', fontSize: 12, fontWeight: '800' },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 14.5, color: INK },
  rowLabelOn: { textDecorationLine: 'line-through', color: INKSOFT },
  rowNote: { fontFamily: FONTS.body, fontSize: 12.5, color: INKSOFT, marginTop: 1 },

  tipNote: { flexDirection: 'row', gap: 8, backgroundColor: '#FDF7E8', borderWidth: 1, borderColor: '#E7CE9A', borderStyle: 'dashed', borderRadius: 13, padding: 12, marginHorizontal: 16, marginTop: 18 },
  tipSpark: { fontFamily: FONTS.bodyBold, fontSize: 13, color: HONEY },
  tipText: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: '#5c3b2a' },

  footRow: { paddingHorizontal: 16, marginTop: 16 },
  shareBtn: { backgroundColor: ROSE, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  shareBtnText: { fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#fff' },
});
