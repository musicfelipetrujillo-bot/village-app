// V6 Milk Vault — Keep-vs-Sell slider (marketplace mode only).
//
// Reserve-first: divides the whole stash into "keep for baby" and "available
// to sell/donate", live-updating days covered + estimated payout, and warns
// when the kept amount drops below the desired reserve.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { V3Card } from '@components/shared/V3Card';
import {
  VaultScreen, VaultHeader, KeepSellSlider, EthicalBanner, VaultLegalNote, ScrollView,
} from '@components/milkVault/VaultUI';
import { useMilkVaultStore } from '@store/milkVault';
import { computeKeepSell } from '@utils/milkVaultCalc';
import { VAULT_LEGAL_COPY } from '@utils/milkVaultConstants';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultKeepSell'>;

export default function MilkVaultKeepSellScreen() {
  const nav = useNavigation<Nav>();
  const { core, settings } = useMilkVaultStore();

  const total = core?.totalFreezerOz ?? 0;
  const intake = settings?.average_daily_intake_oz ?? 24;
  const reserveDays = settings?.desired_reserve_days ?? 30;
  const price = settings?.price_per_oz ?? 0;

  // Default the slider to the desired reserve (or whole stash if smaller).
  const defaultKeep = Math.min(reserveDays * intake, total);
  const [keepOz, setKeepOz] = useState(defaultKeep);

  const result = useMemo(
    () => computeKeepSell({ totalOz: total, averageDailyIntakeOz: intake, desiredReserveDays: reserveDays, pricePerOz: price, keepOz }),
    [total, intake, reserveDays, price, keepOz],
  );

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader eyebrow="Keep vs share" title="Protect the reserve first" onBack={() => nav.goBack()} />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <EthicalBanner text="Slide to decide how much stays in your baby's reserve. Everything above the line is optional to sell or donate." />

          {/* Big split readout */}
          <View style={styles.splitRow}>
            <View style={styles.splitCol}>
              <Text style={styles.splitValue}>{result.keepOz}</Text>
              <Text style={styles.splitUnit}>oz kept</Text>
              <Text style={styles.splitSub}>{result.babyCoveredDays} days covered</Text>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitCol}>
              <Text style={[styles.splitValue, { color: COLORS.genz_berry }]}>{result.availableOz}</Text>
              <Text style={styles.splitUnit}>oz available</Text>
              <Text style={styles.splitSub}>${result.estimatedPayout} est. payout</Text>
            </View>
          </View>

          <KeepSellSlider total={total} value={keepOz} onChange={setKeepOz} />

          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <Text style={styles.rangeLabel}>0 oz — {total} oz total stash</Text>
          </View>

          {/* Reserve warning */}
          {result.belowReserve ? (
            <V3Card tinted={'rgba(194,90,120,0.08)'} style={styles.warnCard} contentStyle={styles.warnInner}>
              <Text style={styles.warnEmoji}>⚠️</Text>
              <Text style={styles.warnText}>
                You're keeping {result.keepOz} oz — that's {result.reserveShortfallDays}{' '}
                {result.reserveShortfallDays === 1 ? 'day' : 'days'} below your {reserveDays}-day reserve goal
                ({result.desiredReserveOz} oz). Consider sharing a little less.
              </Text>
            </V3Card>
          ) : (
            <V3Card tinted={'rgba(96,110,70,0.08)'} style={styles.warnCard} contentStyle={styles.warnInner}>
              <Text style={styles.warnEmoji}>✅</Text>
              <Text style={styles.warnText}>
                Your baby's {reserveDays}-day reserve ({result.desiredReserveOz} oz) is fully protected.
              </Text>
            </V3Card>
          )}

          {/* Summary card */}
          <V3Card style={{ marginHorizontal: 16, marginTop: 12 }} contentStyle={{ padding: 16 }}>
            <SummaryLine label="Total stash" value={`${total} oz`} />
            <SummaryLine label="Average daily intake" value={`${intake} oz/day`} />
            <SummaryLine label="Keep for baby" value={`${result.keepOz} oz`} />
            <SummaryLine label="Baby covered" value={`${result.babyCoveredDays} days`} />
            <SummaryLine label="Available to sell / donate" value={`${result.availableOz} oz`} />
            <SummaryLine label="Price" value={`$${price.toFixed(2)}/oz`} />
            <SummaryLine label="Estimated payout" value={`$${result.estimatedPayout}`} strong />
          </V3Card>

          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <PrimaryCTA
              label="Plan a listing with this amount"
              onPress={() => nav.navigate('MilkVaultListing', { prefillOunces: result.availableOz })}
              disabled={result.availableOz <= 0}
            />
          </View>

          <VaultLegalNote text={VAULT_LEGAL_COPY} />
        </ScrollView>
      </SafeAreaView>
    </VaultScreen>
  );
}

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.sumLine}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumValue, strong && styles.sumValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splitRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16 },
  splitCol: { flex: 1, alignItems: 'center' },
  splitDivider: { width: StyleSheet.hairlineWidth, height: 56, backgroundColor: 'rgba(61,31,14,0.15)' },
  splitValue: { fontFamily: FONTS.v2_display_big, fontSize: 40, color: COLORS.genz_rose },
  splitUnit: { fontFamily: FONTS.v2_label, fontSize: 13, color: COLORS.genz_chestnut, marginTop: -2 },
  splitSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.genz_softink, marginTop: 4 },
  rangeLabel: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.genz_softink, textAlign: 'center' },
  warnCard: { marginHorizontal: 16, marginTop: 16 },
  warnInner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14 },
  warnEmoji: { fontSize: 16, marginTop: 1 },
  warnText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 19, color: COLORS.genz_chestnut },
  sumLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.08)' },
  sumLabel: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: COLORS.genz_softink },
  sumValue: { fontFamily: FONTS.v2_label, fontSize: 13.5, color: COLORS.genz_chestnut },
  sumValueStrong: { fontFamily: FONTS.v2_display_big, fontSize: 18, color: COLORS.genz_rose },
});
