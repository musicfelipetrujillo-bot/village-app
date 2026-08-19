// Milk hub — feeding-cost planner.
//
// A few taps (ounces/day → formula brand → combo split) → a side-by-side
// monthly-cost comparison across feeding options, plus a first-year outlook
// for "nurse now, switch to formula later". Prices are tight historical
// estimates the mom can compare against (see utils/formulaCosts).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { VaultScreen } from '@components/milkVault/VaultUI';
import { ScreenHeader } from '@components/shared/ScreenHeader';
import { babyTrackerApi } from '@api/babyTracker';
import {
  FORMULA_BRANDS, feedingScenarios, yearOutlook, rangeLabel, type FormulaBrand,
} from '@utils/formulaCosts';

const T = {
  paper: COLORS.v2_paper,
  card: COLORS.v2_card,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rose: '#C24A63',
  roseInk: '#9E2F4C',
  roseTint: '#FDECEF',
  rule: 'rgba(61,31,14,0.13)',
};

const OZ_MIN = 8;
const OZ_MAX = 40;
const COMBO_OPTS = [
  { label: 'mostly milk', share: 0.25 },
  { label: 'half & half', share: 0.5 },
  { label: 'mostly formula', share: 0.75 },
];

function Stepper({ value, onDec, onInc, suffix }: { value: string; onDec: () => void; onInc: () => void; suffix?: string }) {
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={onDec} accessibilityRole="button" accessibilityLabel="decrease">
        <Text style={s.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={s.stepValue}>{value}{suffix ? <Text style={s.stepSuffix}> {suffix}</Text> : null}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={onInc} accessibilityRole="button" accessibilityLabel="increase">
        <Text style={s.stepBtnText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MilkFeedCostScreen() {
  const nav = useNavigation<any>();
  const [ozPerDay, setOzPerDay] = useState(26);
  const [pulledFromLogs, setPulledFromLogs] = useState(false);
  const [brandId, setBrandId] = useState('enfamil');
  const [comboShare, setComboShare] = useState(0.5);
  const [switchMonth, setSwitchMonth] = useState(4);

  // Pre-fill ounces/day from the mom's own bottle logs (best-effort). Only if
  // she hasn't already nudged the stepper — never fight a manual change.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const avg = await babyTrackerApi.avgFeedOzPerDay();
      if (cancelled || touched || avg == null) return;
      setOzPerDay(Math.min(OZ_MAX, Math.max(OZ_MIN, avg)));
      setPulledFromLogs(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const bumpOz = (delta: number) => {
    setTouched(true);
    setPulledFromLogs(false);
    setOzPerDay((v) => Math.min(OZ_MAX, Math.max(OZ_MIN, v + delta)));
  };

  const brand: FormulaBrand = FORMULA_BRANDS.find((b) => b.id === brandId) ?? FORMULA_BRANDS[0];
  const scenarios = useMemo(
    () => feedingScenarios({ ozPerDay, brand, comboFormulaShare: comboShare }),
    [ozPerDay, brand, comboShare],
  );
  const outlook = useMemo(() => yearOutlook(ozPerDay, brand, switchMonth), [ozPerDay, brand, switchMonth]);

  return (
    <VaultScreen>
      <ScreenHeader title="feeding costs" onBack={() => nav.goBack()} backColor={T.rose} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.lede}>Plan what feeding will cost — and compare your options.</Text>

        {/* Q1 — ounces/day */}
        <Text style={s.q}>How much does baby drink a day?</Text>
        <Stepper
          value={String(ozPerDay)} suffix="oz"
          onDec={() => bumpOz(-2)}
          onInc={() => bumpOz(2)}
        />
        <Text style={s.hint}>
          {pulledFromLogs
            ? '✓ pulled from your recent bottle logs — adjust anytime'
            : 'newborn ≈ 24 · 3 months ≈ 30'}
        </Text>

        {/* Q2 — formula brand */}
        <Text style={s.q}>Which formula? <Text style={s.qLight}>(for the formula options)</Text></Text>
        <View style={s.chips}>
          {FORMULA_BRANDS.map((b) => {
            const on = b.id === brandId;
            return (
              <TouchableOpacity
                key={b.id}
                style={[s.chip, on && s.chipOn]}
                onPress={() => setBrandId(b.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={b.name}
              >
                <View style={[s.mono, { backgroundColor: b.tone }]}><Text style={s.monoText}>{b.name[0]}</Text></View>
                <View style={{ minWidth: 0 }}>
                  <Text style={[s.chipName, on && s.chipNameOn]} numberOfLines={1}>{b.name}</Text>
                  <Text style={s.chipTier} numberOfLines={1}>{b.tier}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Q3 — combo split */}
        <Text style={s.q}>In a combo day, how much is formula?</Text>
        <View style={s.seg}>
          {COMBO_OPTS.map((o) => {
            const on = Math.abs(o.share - comboShare) < 0.01;
            return (
              <TouchableOpacity
                key={o.label}
                style={[s.segItem, on && s.segItemOn]}
                onPress={() => setComboShare(o.share)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.segText, on && s.segTextOn]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Results — monthly comparison */}
        <Text style={s.section}>Monthly cost</Text>
        <View style={s.card}>
          {scenarios.map((sc, i) => (
            <View key={sc.key}>
              {i > 0 && <View style={s.divider} />}
              <View style={s.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowLabel}>{sc.label}</Text>
                  {sc.note ? <Text style={s.rowNote}>{sc.note}</Text> : null}
                </View>
                <Text style={[s.rowCost, sc.monthly.high === 0 && s.rowCostFree]}>
                  {rangeLabel(sc.monthly)}<Text style={s.rowPer}>{sc.monthly.high === 0 ? '' : '/mo'}</Text>
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* First-year outlook */}
        <Text style={s.section}>First year</Text>
        <View style={s.outlookRow}>
          <Text style={s.outlookLabel}>Nurse until month</Text>
          <Stepper
            value={String(switchMonth)}
            onDec={() => setSwitchMonth((v) => Math.max(0, v - 1))}
            onInc={() => setSwitchMonth((v) => Math.min(12, v + 1))}
          />
        </View>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={[s.rowLabel, { flex: 1 }]}>Nurse to month {switchMonth}, then {brand.name}</Text>
            <Text style={s.rowCost}>{rangeLabel(outlook.nurseThenSwitch)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={[s.rowLabel, { flex: 1 }]}>Formula only, all year</Text>
            <Text style={s.rowCost}>{rangeLabel(outlook.fullYear)}</Text>
          </View>
        </View>

        <Text style={s.disclaimer}>
          Estimates from typical 2025 retail prices — your actual cost will vary by store, size, and sales. Not financial advice.
        </Text>
      </ScrollView>
    </VaultScreen>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  lede: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20, color: T.walnut, marginTop: 2, marginBottom: 6 },

  q: { fontFamily: FONTS.v2_display, fontSize: 16.5, color: T.cocoa, letterSpacing: -0.2, marginTop: 22, marginBottom: 12 },
  qLight: { fontFamily: FONTS.v2_body, fontSize: 13, color: T.walnut },
  hint: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut, marginTop: 8 },

  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.rule },
  stepBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: FONTS.v2_display, fontSize: 22, color: T.rose, marginTop: -2 },
  stepValue: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: T.cocoa, minWidth: 64, textAlign: 'center' },
  stepSuffix: { fontFamily: FONTS.v2_body, fontSize: 13, color: T.walnut },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.rule, paddingVertical: 8, paddingHorizontal: 10 },
  chipOn: { borderColor: T.rose, backgroundColor: T.roseTint },
  mono: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: FONTS.v2_bold, fontSize: 14, color: '#fff' },
  chipName: { fontFamily: FONTS.v2_label, fontSize: 14, color: T.cocoa },
  chipNameOn: { color: T.roseInk },
  chipTier: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: T.walnut },

  seg: { flexDirection: 'row', backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.rule, padding: 4, gap: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segItemOn: { backgroundColor: T.rose },
  segText: { fontFamily: FONTS.v2_label, fontSize: 12.5, color: T.walnut },
  segTextOn: { color: '#fff' },

  section: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.walnut, marginTop: 30, marginBottom: 12 },

  card: { backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.rule, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowLabel: { fontFamily: FONTS.v2_label, fontSize: 14.5, color: T.cocoa },
  rowNote: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut, marginTop: 2 },
  rowCost: { fontFamily: FONTS.v2_display_big, fontSize: 18, color: T.roseInk },
  rowCostFree: { color: '#7B8A46' },
  rowPer: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut },
  divider: { height: 1, backgroundColor: T.rule },

  outlookRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  outlookLabel: { fontFamily: FONTS.v2_label, fontSize: 14.5, color: T.cocoa },

  disclaimer: { fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 16, color: T.walnut, marginTop: 26, textAlign: 'center' },
});
