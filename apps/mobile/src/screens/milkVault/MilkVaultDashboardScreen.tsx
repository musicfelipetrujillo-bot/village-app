// V6 Milk Vault — "My Stash" dashboard (Milk Hub landing, freezer-ring design).
//
// A bold rose→honey freezer-fill RING hero (total oz + days of coverage) — the
// same gradient energy as the marketplace — a stat strip, scan / trip actions,
// the next bags to use, and a "share your extra" nudge. A `my stash |
// marketplace` toggle unifies this private stash view with Milk Connect.
//
// EMPTY STATE: instead of a bland placeholder, we render the SAME filled layout
// with dimmed SAMPLE data behind a "here's what your stash will look like"
// banner + a real "scan your first bag" CTA — so a fresh mom sees the payoff.
//
// Personal stash NEVER shows price / payout / sell language — the marketplace
// (Share & Sell) planning lives behind the toggle + the keep/share flow.

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FONTS } from '@utils/constants';
import { useMilkVaultStore } from '@store/milkVault';
import { useHomeStore } from '@store/home';
import { shortDate } from '@utils/milkVaultInsights';
import { VAULT_LEGAL_COPY } from '@utils/milkVaultConstants';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';
import type { MilkVaultBag } from '@api/milkVault';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultDashboard'>;

const C = {
  cream: '#FCF7EF', paper: '#FFFCF6',
  rose: '#E84B79', roseInk: '#B0234F', roseTint: '#FDECEF',
  honey: '#F5C842', honeyCard: '#FBE9BE', honeyInk: '#B98A1E',
  cocoa: '#3D2116', walnut: '#8A6A55', sage: '#7B8A46', track: '#F0E6D6',
  hair: 'rgba(61,31,14,0.08)',
};

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;
const CAMERA = 'M4 8h2.5L8 6h8l1.5 2H20a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM12 17.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z';
const HEART = 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z';
const PLANE = 'M2 12l19-8-6 19-4-7-9-4z';
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// Sample data used only to render the dimmed empty-state preview.
const SAMPLE_BAGS = [
  { id: 's1', ounces: 6, frozen_at: '2026-07-11', notes: 'morning pump' },
  { id: 's2', ounces: 5, frozen_at: '2026-07-09', notes: null },
  { id: 's3', ounces: 4, frozen_at: '2026-07-08', notes: 'fridge stash' },
] as unknown as MilkVaultBag[];

export default function MilkVaultDashboardScreen() {
  const nav = useNavigation<Nav>();
  const { settings, core, marketplace, loading, loaded, fetchAll } = useMilkVaultStore();
  const babyName = useHomeStore((s) => s.babyProfile?.baby_name) ?? null;

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  useFocusEffect(
    useCallback(() => {
      if (loaded && settings && !settings.onboarded_at) {
        nav.replace('MilkVaultModePicker', {});
      }
    }, [loaded, settings, nav]),
  );

  const isMarketplace = settings?.mode === 'marketplace';

  if (!core || !settings) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.center} edges={['top']}>
          <Text style={styles.loadingText}>{loading ? 'Loading your stash…' : 'Setting things up…'}</Text>
        </SafeAreaView>
      </View>
    );
  }

  const isEmpty = core.totalFreezerOz <= 0 && core.totalBags <= 0;
  const hasStash = core.totalFreezerOz > 0;
  const realFill = !hasStash
    ? 0
    : core.stashGoalOz > 0 ? clamp01(core.stashGoalProgress) : clamp01(core.babyCoverageDays / 7);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => (nav.canGoBack() ? nav.goBack() : (nav.getParent() as any)?.navigate('Village'))}
              accessibilityRole="button" accessibilityLabel="Back"
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brand}>milk hub</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => nav.navigate('MilkVaultSettings')}
            accessibilityRole="button" accessibilityLabel="Milk Vault settings"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.iconBtn}
          >
            <Path2 d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" color={C.walnut} />
          </TouchableOpacity>
        </View>

        <View style={styles.toggle}>
          <View style={[styles.toggleSeg, styles.toggleSegActive]}><Text style={styles.toggleTextActive}>my stash</Text></View>
          <TouchableOpacity style={styles.toggleSeg} onPress={() => nav.navigate('MilkHome')} accessibilityRole="button" accessibilityLabel="Marketplace">
            <Text style={styles.toggleText}>marketplace</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} tintColor={C.rose} />}
        >
          {isEmpty ? (
            <View>
              {/* Real, honest framing + the one bright action */}
              <Text style={styles.emptyLede}>Your freezer's empty — here's what it'll look like once you start 👇</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={() => nav.navigate('MilkVaultScan')} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Scan your first bag">
                <Path2 d={CAMERA} color="#fff" size={20} />
                <Text style={styles.emptyCtaText}>Scan your first bag</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => nav.navigate('MilkVaultAddBag', {})} style={styles.emptyManual} accessibilityRole="button">
                <Text style={styles.emptyManualText}>or add one manually</Text>
              </TouchableOpacity>

              {/* Clear cut: everything below is a labelled, non-tappable demo */}
              <View style={styles.exampleDivider}>
                <View style={styles.exampleLine} />
                <Text style={styles.exampleLabel}>example</Text>
                <View style={styles.exampleLine} />
              </View>
              <View style={{ opacity: 0.5 }} pointerEvents="none">
                <FilledStash
                  nav={nav} babyName={babyName} sample
                  freezerOz={128} totalBags={14} oldestMilkDate="2026-06-20"
                  weeklyAdded={36} coverageDays={5} fillPct={5 / 7} bags={SAMPLE_BAGS}
                  marketAvailable={0} marketPayout={0} isMarketplace={isMarketplace}
                />
              </View>
            </View>
          ) : (
            <FilledStash
              nav={nav} babyName={babyName}
              freezerOz={core.totalFreezerOz} totalBags={core.totalBags}
              oldestMilkDate={core.oldestMilkDate} weeklyAdded={core.weeklyOuncesAdded}
              coverageDays={core.babyCoverageDays} fillPct={realFill} bags={core.nextBagsToUse}
              marketAvailable={marketplace?.availableOz ?? 0} marketPayout={marketplace?.estimatedPayout ?? 0}
              isMarketplace={isMarketplace}
            />
          )}

          <Text style={styles.legal}>{VAULT_LEGAL_COPY}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Filled stash body — shared by the real dashboard and the empty preview ──
function FilledStash({
  nav, babyName, freezerOz, totalBags, oldestMilkDate, weeklyAdded, coverageDays,
  fillPct, bags, marketAvailable, marketPayout, isMarketplace, sample,
}: {
  nav: Nav; babyName: string | null; freezerOz: number; totalBags: number;
  oldestMilkDate: string | null; weeklyAdded: number; coverageDays: number;
  fillPct: number; bags: MilkVaultBag[]; marketAvailable: number; marketPayout: number;
  isMarketplace: boolean; sample?: boolean;
}) {
  const hasStash = freezerOz > 0;
  const dash = clamp01(fillPct) * RING_C;
  const goTrip = () => (nav.getParent()?.getParent() as any)?.navigate('AIHelpChat', { seed: 'Help me plan how much milk I need for a trip', autosend: true });
  const goShare = () => isMarketplace ? nav.navigate('MilkVaultKeepSell') : nav.navigate('MilkVaultModePicker', { switching: true });

  return (
    <>
      {/* Bold rose→honey freezer-ring hero (same energy as the marketplace) */}
      <LinearGradient colors={['#E84B79', '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroWrap}>
        {sample ? <View style={styles.sampleTag}><Text style={styles.sampleTagText}>example</Text></View> : null}
        <Text style={styles.heroEyebrow}>your freezer</Text>
        <View style={styles.ringWrap}>
          <Svg width={184} height={184} viewBox="0 0 120 120">
            <Circle cx={60} cy={60} r={RING_R} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={12} />
            <Circle
              cx={60} cy={60} r={RING_R} fill="none" stroke="#FFFDF9" strokeWidth={12}
              strokeLinecap="round" strokeDasharray={[dash, RING_C]}
              rotation={-90} originX={60} originY={60}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringNum}>{hasStash ? freezerOz : 0}</Text>
            <Text style={styles.ringUnit}>ounces</Text>
            {hasStash ? <Text style={styles.ringFeeds}>❄️ ≈ {Math.max(1, Math.round(freezerOz / 6))} feeds</Text> : null}
          </View>
        </View>
        <Text style={styles.coverage}>
          {hasStash
            ? `about ${coverageDays} ${coverageDays === 1 ? 'day' : 'days'} banked${babyName ? ` · for ${babyName}` : ''}`
            : 'snap your first bag to start'}
        </Text>
      </LinearGradient>

      {/* Stat strip */}
      <View style={styles.strip}>
        <Stat value={String(totalBags)} label="bags" />
        <View style={styles.stripDiv} />
        <Stat value={oldestMilkDate ? shortDate(oldestMilkDate) : '—'} label="oldest" />
        <View style={styles.stripDiv} />
        <Stat value={`+${weeklyAdded}`} label="this week" tint={C.roseInk} />
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionTile, { backgroundColor: C.rose }]} activeOpacity={0.9} onPress={() => nav.navigate('MilkVaultScan')} accessibilityRole="button" accessibilityLabel="Scan a bag">
          <Path2 d={CAMERA} color="#fff" size={22} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.actionTitleLight}>Add a bag</Text>
            <Text style={styles.actionSubLight}>snap it</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionTile, { backgroundColor: C.honeyCard }]} activeOpacity={0.9} onPress={goTrip} accessibilityRole="button" accessibilityLabel="Trip planner">
          <Path2 d={PLANE} color={C.honeyInk} size={22} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.actionTitle}>Trip</Text>
            <Text style={styles.actionSub}>plan it</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Recent bags */}
      {bags.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>your bags</Text>
            <TouchableOpacity onPress={() => nav.navigate('MilkVaultBags')} accessibilityRole="button">
              <Text style={styles.sectionLink}>see all {totalBags}</Text>
            </TouchableOpacity>
          </View>
          {bags.slice(0, 3).map((b, i) => (
            <BagRow key={b.id} bag={b} first={i === 0} onPress={() => nav.navigate('MilkVaultBags')} />
          ))}
        </View>
      )}

      {/* Share your extra */}
      {marketAvailable > 0 ? (
        <TouchableOpacity style={styles.shareCard} activeOpacity={0.9} onPress={() => nav.navigate('MilkVaultKeepSell')} accessibilityRole="button" accessibilityLabel="Keep vs share your milk">
          <View style={styles.shareIcon}><Path2 d={HEART} color="#fff" size={22} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shareText}>Share <Text style={{ fontFamily: FONTS.v2_bold, color: C.cocoa }}>{marketAvailable} oz</Text> beyond your reserve.</Text>
            <Text style={styles.shareEarn}>≈ ${marketPayout} to offset costs · keep vs share ›</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.shareCard} activeOpacity={0.9} onPress={goShare} accessibilityRole="button" accessibilityLabel="Share your extra milk">
          <View style={styles.shareIcon}><Path2 d={HEART} color="#fff" size={22} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shareText}>Have <Text style={{ fontFamily: FONTS.v2_bold, color: C.cocoa }}>extra</Text>? Share it with a family nearby.</Text>
          </View>
          <Text style={styles.shareArrow}>›</Text>
        </TouchableOpacity>
      )}

      {!sample && (
        <TouchableOpacity onPress={() => nav.navigate('MilkVaultAddBag', {})} style={styles.addManual} accessibilityRole="button">
          <Text style={styles.addManualText}>＋ add a bag manually</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.statValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BagRow({ bag, first, onPress }: { bag: MilkVaultBag; first: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.bagRow, !first && styles.bagRowBorder]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.bagOz}><Text style={styles.bagOzText}>{bag.ounces}oz</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bagDate}>Frozen {shortDate(bag.frozen_at)}</Text>
        {bag.notes ? <Text style={styles.bagNotes} numberOfLines={1}>{bag.notes}</Text> : null}
      </View>
      <Text style={styles.bagChevron}>›</Text>
    </TouchableOpacity>
  );
}

function Path2({ d, color, size = 18 }: { d: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: FONTS.v2_body, fontSize: 15, color: C.walnut },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 },
  backArrow: { fontSize: 30, color: C.walnut, marginTop: -4, fontWeight: '400' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.honey },
  brand: { fontFamily: FONTS.v2_bold, fontSize: 17, color: C.cocoa },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F2E6DD', alignItems: 'center', justifyContent: 'center' },

  toggle: { flexDirection: 'row', backgroundColor: C.track, borderRadius: 999, padding: 4, marginHorizontal: 18, marginBottom: 6 },
  toggleSeg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleSegActive: { backgroundColor: C.rose },
  toggleText: { fontFamily: FONTS.v2_link, fontSize: 13.5, color: C.walnut },
  toggleTextActive: { fontFamily: FONTS.v2_bold, fontSize: 13.5, color: '#fff' },

  // Empty-state hybrid (honest CTA + labelled example)
  emptyLede: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: '#5A4030', lineHeight: 19, marginHorizontal: 18, marginTop: 6, marginBottom: 12 },
  exampleDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 22, marginBottom: 4 },
  exampleLine: { flex: 1, height: 1, backgroundColor: 'rgba(61,31,14,0.12)' },
  exampleLabel: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: '#A9906B', fontWeight: '700', backgroundColor: C.track, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  sampleTag: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,253,249,0.9)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, zIndex: 2 },
  sampleTagText: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.4, textTransform: 'uppercase', color: '#7A3548', fontWeight: '700' },

  heroWrap: { alignItems: 'center', paddingTop: 18, paddingBottom: 18, marginHorizontal: 18, borderRadius: 24, overflow: 'hidden', shadowColor: C.rose, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24, shadowRadius: 24, elevation: 4 },
  heroEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#7A3548', fontWeight: '700' },
  ringWrap: { width: 184, height: 184, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: FONTS.v2_display_big, fontSize: 50, color: '#43260F', lineHeight: 54 },
  ringUnit: { fontFamily: FONTS.v2_body, fontSize: 13, color: '#7A3548', marginTop: -2, fontWeight: '600' },
  ringFeeds: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: '#8A4A5C', marginTop: 5 },
  coverage: { fontFamily: FONTS.v3_display_italic, fontSize: 24, color: '#7A3548', marginTop: 8, textAlign: 'center', paddingHorizontal: 16 },

  strip: { flexDirection: 'row', backgroundColor: C.paper, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, paddingVertical: 13, marginHorizontal: 18, marginTop: 16 },
  stripDiv: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,14,0.1)' },
  statValue: { fontFamily: FONTS.v2_display_big, fontSize: 19, color: C.cocoa },
  statLabel: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.2, textTransform: 'uppercase', color: C.walnut, marginTop: 3, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 12, marginHorizontal: 18, marginTop: 14 },
  actionTile: { flex: 1, borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center' },
  actionTitle: { fontFamily: FONTS.v2_bold, fontSize: 14, color: C.cocoa },
  actionSub: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.walnut, marginTop: 2 },
  actionTitleLight: { fontFamily: FONTS.v2_bold, fontSize: 14, color: '#fff' },
  actionSubLight: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: '#FBD9E1', marginTop: 2 },

  section: { marginTop: 24, marginHorizontal: 18 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)', marginBottom: 4 },
  sectionLabel: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: C.walnut, fontWeight: '500' },
  sectionLink: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: C.roseInk, fontWeight: '600' },

  bagRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  bagRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(61,31,14,0.07)' },
  bagOz: { width: 40, height: 34, borderRadius: 9, backgroundColor: '#E7EEF2', alignItems: 'center', justifyContent: 'center' },
  bagOzText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#4E6A7C' },
  bagDate: { fontFamily: FONTS.v2_link, fontSize: 13.5, color: C.cocoa },
  bagNotes: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut, marginTop: 1 },
  bagChevron: { fontSize: 20, color: '#C9B79F' },

  shareCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.roseTint, borderWidth: 1, borderColor: 'rgba(224,106,136,0.22)', borderRadius: 16, padding: 13, marginHorizontal: 18, marginTop: 20 },
  shareIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.rose },
  shareText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13, color: '#5A4030', lineHeight: 18 },
  shareEarn: { fontFamily: FONTS.v2_link, fontSize: 12, color: C.roseInk, marginTop: 3 },
  shareArrow: { fontSize: 20, color: C.roseInk },

  addManual: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  addManualText: { fontFamily: FONTS.v2_link, fontSize: 14, color: C.roseInk },

  legal: { fontFamily: FONTS.v2_body, fontSize: 9.5, color: '#B7A896', textAlign: 'center', marginTop: 20, marginHorizontal: 28, lineHeight: 14 },

  emptyCta: { backgroundColor: C.rose, borderRadius: 14, paddingVertical: 16, marginHorizontal: 18, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyCtaText: { fontFamily: FONTS.v2_bold, fontSize: 15.5, color: '#fff' },
  emptyManual: { alignItems: 'center', paddingVertical: 14 },
  emptyManualText: { fontFamily: FONTS.v2_link, fontSize: 13.5, color: C.roseInk },
});
