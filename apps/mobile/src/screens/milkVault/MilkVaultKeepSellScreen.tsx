// V6 Milk Vault — Share & Sell (the marketplace half of the Milk Hub).
//
// Help-first, reserve-first: leads with "you've got extra", a keep/share
// slider that protects the baby's reserve, and frames any cash as RECOUPING
// pumping costs (never money-first). Estimate-only, cash/P2P only — Villie
// connects moms, it is never a party to the transaction.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FONTS } from '@utils/constants';
import { KeepSellSlider } from '@components/milkVault/VaultUI';
import { useMilkVaultStore } from '@store/milkVault';
import { computeKeepSell } from '@utils/milkVaultCalc';
import { VAULT_LEGAL_COPY } from '@utils/milkVaultConstants';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultKeepSell'>;

const C = {
  cream: '#FCF7EF', paper: '#FFFCF6',
  rose: '#E06A88', roseInk: '#C2556F', roseTint: '#FDECEF',
  honey: '#F5C842', honeyCard: '#FBE9BE', honeyInk: '#B98A1E',
  cocoa: '#3D2116', walnut: '#8A6A55', sage: '#7B8A46', muted: '#A6957F',
  track: '#F0E6D6', hair: 'rgba(61,31,14,0.08)',
};

export default function MilkVaultKeepSellScreen() {
  const nav = useNavigation<Nav>();
  const { core, settings } = useMilkVaultStore();

  const total = core?.totalFreezerOz ?? 0;
  const intake = settings?.average_daily_intake_oz ?? 24;
  const reserveDays = settings?.desired_reserve_days ?? 30;
  const price = settings?.price_per_oz ?? 0;

  const defaultKeep = Math.min(reserveDays * intake, total);
  const [keepOz, setKeepOz] = useState(defaultKeep);

  const result = useMemo(
    () => computeKeepSell({ totalOz: total, averageDailyIntakeOz: intake, desiredReserveDays: reserveDays, pricePerOz: price, keepOz }),
    [total, intake, reserveDays, price, keepOz],
  );

  const canShare = result.availableOz > 0;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>share &amp; sell</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Help-first hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>your freezer's filling up</Text>
            <Text style={styles.heroTitle}>
              You've got <Text style={styles.heroScript}>extra</Text>
              {total > 0 ? ` — about ${result.availableOz} oz.` : '.'}
            </Text>
            <Text style={styles.heroBody}>
              Share your surplus with a mom nearby — moms in your area are looking for screened milk — and offset your pumping costs.
            </Text>
          </View>

          {/* Keep / share split */}
          <View style={styles.splitRow}>
            <View style={styles.splitCol}>
              <Text style={styles.splitLabel}>keep</Text>
              <Text style={styles.splitValue}>{result.keepOz}<Text style={styles.splitUnit}> oz</Text></Text>
              <Text style={styles.splitSub}>{result.babyCoveredDays} days covered</Text>
            </View>
            <View style={styles.splitDivider} />
            <View style={[styles.splitCol, { alignItems: 'flex-end' }]}>
              <Text style={[styles.splitLabel, { color: C.roseInk }]}>share</Text>
              <Text style={[styles.splitValue, { color: C.roseInk }]}>{result.availableOz}<Text style={styles.splitUnit}> oz</Text></Text>
              <Text style={styles.splitSub}>beyond the reserve</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <KeepSellSlider total={total} value={keepOz} onChange={setKeepOz} />
            <Text style={styles.rangeLabel}>drag to decide — you can change it anytime</Text>
          </View>

          {/* Reserve status */}
          <View style={[styles.reserveCard, { backgroundColor: result.belowReserve ? C.roseTint : 'rgba(123,138,70,0.1)' }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d={result.belowReserve ? 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z' : 'M20 6L9 17l-5-5'}
                stroke={result.belowReserve ? C.roseInk : C.sage} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.reserveText}>
              {result.belowReserve
                ? `You're keeping ${result.keepOz} oz — that's ${result.reserveShortfallDays} ${result.reserveShortfallDays === 1 ? 'day' : 'days'} below your ${reserveDays}-day reserve. Consider sharing a little less.`
                : `Your baby's ${reserveDays}-day reserve (${result.desiredReserveOz} oz) is fully protected.`}
            </Text>
          </View>

          {/* Value — framed as offsetting costs */}
          <View style={styles.valueRow}>
            <View>
              <Text style={styles.valueNum}>≈ ${result.estimatedPayout}<Text style={styles.valueSuffix}> to offset costs</Text></Text>
            </View>
            <TouchableOpacity onPress={() => nav.navigate('MilkVaultSettings')} accessibilityRole="button">
              <Text style={styles.priceLink}>you set the price ›</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimer}>planning estimate only · villie connects moms, it never handles the money</Text>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.cta, !canShare && styles.ctaDisabled]}
            onPress={() => nav.navigate('MilkVaultListing', { prefillOunces: result.availableOz })}
            disabled={!canShare}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Share my extra milk"
          >
            <Text style={styles.ctaText}>Share my extra</Text>
          </TouchableOpacity>
          <Text style={styles.consent}>cash or in-person handoff · safety-screened · turn off anytime</Text>

          <Text style={styles.legal}>{VAULT_LEGAL_COPY}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  back: { fontSize: 30, color: C.roseInk, marginTop: -4 },
  title: { fontFamily: FONTS.v2_bold, fontSize: 17, color: C.cocoa },

  hero: { backgroundColor: C.honeyCard, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16 },
  heroEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 1.8, textTransform: 'uppercase', color: C.honeyInk, fontWeight: '600' },
  heroTitle: { fontFamily: FONTS.v2_display_big, fontSize: 24, color: C.cocoa, marginTop: 8, lineHeight: 28 },
  heroScript: { fontFamily: FONTS.v3_display_italic, fontSize: 30, color: C.roseInk },
  heroBody: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: '#5A4030', marginTop: 8 },

  splitRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 4 },
  splitCol: { flex: 1 },
  splitDivider: { width: StyleSheet.hairlineWidth, height: 54, backgroundColor: 'rgba(61,31,14,0.15)', marginHorizontal: 8 },
  splitLabel: { fontFamily: FONTS.v2_label, fontSize: 12.5, color: C.walnut },
  splitValue: { fontFamily: FONTS.v2_display_big, fontSize: 34, color: C.cocoa, marginTop: 2 },
  splitUnit: { fontFamily: FONTS.v2_body, fontSize: 13, color: C.walnut },
  splitSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut, marginTop: 2 },

  rangeLabel: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: C.walnut, textAlign: 'center', marginTop: 10 },

  reserveCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginHorizontal: 16, marginTop: 16, padding: 14, borderRadius: 12 },
  reserveText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: C.cocoa },

  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginHorizontal: 16, marginTop: 18 },
  valueNum: { fontFamily: FONTS.v2_display_big, fontSize: 20, color: C.cocoa },
  valueSuffix: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: '#5A4030' },
  priceLink: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: C.roseInk },
  disclaimer: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.muted, marginHorizontal: 16, marginTop: 6, letterSpacing: 0.2 },

  cta: { backgroundColor: C.rose, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginHorizontal: 16, marginTop: 18 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: '#fff' },
  consent: { fontFamily: FONTS.v2_body, fontSize: 11, color: C.walnut, textAlign: 'center', marginTop: 10, marginHorizontal: 16 },

  legal: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.muted, textAlign: 'center', marginTop: 16, marginHorizontal: 24, lineHeight: 15 },
});
