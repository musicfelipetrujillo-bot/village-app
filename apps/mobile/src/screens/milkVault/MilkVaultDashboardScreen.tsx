// V6 Milk Vault — dashboard. Branches Personal Stash vs Marketplace.
//
// Personal mode NEVER shows price / payout / sell language.
// Marketplace mode adds reserve-first sharing planning on top of everything
// in personal mode.

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { V3Card } from '@components/shared/V3Card';
import {
  VaultScreen, VaultHeader, SectionLabel, HeroStat, StatTile, TileGrid,
  InsightCard, EthicalBanner, CoverageBar, TagChips, VaultLegalNote, ScrollView,
} from '@components/milkVault/VaultUI';
import { useMilkVaultStore } from '@store/milkVault';
import { personalInsights, marketplaceInsights, shortDate } from '@utils/milkVaultInsights';
import { VAULT_LEGAL_COPY } from '@utils/milkVaultConstants';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';
import type { MilkVaultBag } from '@api/milkVault';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultDashboard'>;

export default function MilkVaultDashboardScreen() {
  const nav = useNavigation<Nav>();
  const {
    settings, core, marketplace, lifetime, lifestyleTags, loading, loaded, fetchAll,
  } = useMilkVaultStore();

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  // Redirect to the mode picker until the user has chosen a mode.
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
      <VaultScreen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <VaultHeader eyebrow="Milk Vault" title="Your freezer stash" accent="mama" onBack={() => nav.goBack()} />
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>{loading ? 'Loading your vault…' : 'Setting things up…'}</Text>
          </View>
        </SafeAreaView>
      </VaultScreen>
    );
  }

  const insights = isMarketplace && marketplace
    ? marketplaceInsights(core, marketplace, settings)
    : personalInsights(core, settings);

  const hasStash = core.totalFreezerOz > 0;

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader
          eyebrow="Milk Vault"
          title="Your freezer stash"
          accent="mama"
          onBack={() => nav.goBack()}
          right={
            <TouchableOpacity
              onPress={() => nav.navigate('MilkVaultSettings')}
              accessibilityRole="button"
              accessibilityLabel="Milk Vault settings"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.gear}>⚙︎</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} tintColor={COLORS.genz_rose} />}
        >
          {/* Hero — total freezer ounces */}
          <View style={{ marginTop: 8 }}>
            <HeroStat
              caption="Freezer Stash"
              value={hasStash ? String(core.totalFreezerOz) : '0'}
              unit="oz"
              sub={hasStash
                ? `${core.totalBags} ${core.totalBags === 1 ? 'bag' : 'bags'} · about ${core.babyCoverageDays} ${core.babyCoverageDays === 1 ? 'day' : 'days'} of milk`
                : 'Log your first bag to start your stash.'}
            />
          </View>

          {lifestyleTags.length > 0 && (
            <TagChips labels={lifestyleTags.map((t) => t.label)} />
          )}

          {/* Ethical framing — marketplace only */}
          {isMarketplace && (
            <EthicalBanner text="Villie helps you protect your baby's reserve first. Selling or donating excess milk is always optional." />
          )}

          {/* Core stat grid */}
          <SectionLabel>Baby coverage</SectionLabel>
          <TileGrid>
            <StatTile label="Baby Coverage" value={String(core.babyCoverageDays)} unit="days" hint={`at ${core.averageDailyIntakeOz} oz/day`} />
            <StatTile label="Total Bags" value={String(core.totalBags)} hint="in the freezer" />
            <StatTile
              label="Oldest Milk"
              value={core.oldestMilkDate ? shortDate(core.oldestMilkDate) : '—'}
              hint={core.oldestMilkDate ? 'rotate oldest first' : 'nothing frozen yet'}
              onPress={() => nav.navigate('MilkVaultBags')}
            />
            <StatTile label="This Week" value={`+${core.weeklyOuncesAdded}`} unit="oz" hint="added in 7 days" />
          </TileGrid>

          {/* Stash goal */}
          {settings.stash_goal_days > 0 && (
            <>
              <SectionLabel>Stash goal</SectionLabel>
              <V3Card style={{ marginHorizontal: 16 }} contentStyle={{ padding: 16 }}>
                <View style={styles.goalRow}>
                  <Text style={styles.goalDays}>{settings.stash_goal_days}-day goal</Text>
                  <Text style={styles.goalPct}>{Math.round(core.stashGoalProgress * 100)}%</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <CoverageBar progress={core.stashGoalProgress} />
                </View>
                <Text style={styles.goalSub}>
                  {core.totalFreezerOz} of {core.stashGoalOz} oz · {core.averageDailyIntakeOz} oz/day
                </Text>
              </V3Card>
            </>
          )}

          {/* Marketplace section */}
          {isMarketplace && marketplace && (
            <>
              <SectionLabel>Beyond your reserve</SectionLabel>
              <TileGrid>
                <StatTile label="Reserved for Baby" value={String(marketplace.reservedOz)} unit="oz" hint={`${settings.desired_reserve_days}-day reserve`} tint={COLORS.genz_blush} />
                <StatTile label="Available to Share" value={String(marketplace.availableOz)} unit="oz" hint="beyond the reserve" />
                <StatTile label="Price / oz" value={`$${settings.price_per_oz.toFixed(2)}`} hint="your set rate" />
                <StatTile label="Est. Payout" value={`$${marketplace.estimatedPayout}`} hint={`$${marketplace.estimatedLowValue}–$${marketplace.estimatedPremiumValue} range`} />
              </TileGrid>

              <View style={styles.mktBtns}>
                <TouchableOpacity
                  style={styles.mktBtn}
                  onPress={() => nav.navigate('MilkVaultKeepSell')}
                  activeOpacity={0.9}
                >
                  <Text style={styles.mktBtnEmoji}>⚖️</Text>
                  <Text style={styles.mktBtnLabel}>Keep vs share</Text>
                  <Text style={styles.mktBtnSub}>Split your stash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mktBtn}
                  onPress={() => nav.navigate('MilkVaultListing', {})}
                  activeOpacity={0.9}
                >
                  <Text style={styles.mktBtnEmoji}>📦</Text>
                  <Text style={styles.mktBtnLabel}>Plan a listing</Text>
                  <Text style={styles.mktBtnSub}>Sell or donate extra</Text>
                </TouchableOpacity>
              </View>

              {lifetime && (lifetime.soldOz > 0 || lifetime.donatedOz > 0) && (
                <>
                  <SectionLabel>Lifetime sharing</SectionLabel>
                  <TileGrid>
                    <StatTile label="Sold" value={String(lifetime.soldOz)} unit="oz" hint={`$${lifetime.lifetimeEarnings} earned`} />
                    <StatTile label="Donated" value={String(lifetime.donatedOz)} unit="oz" hint="given to families" />
                  </TileGrid>
                </>
              )}
            </>
          )}

          {/* Insight cards */}
          {insights.length > 0 && (
            <>
              <SectionLabel>For you</SectionLabel>
              {insights.map((ins, i) => (
                <InsightCard key={`${ins.emoji}-${i}`} emoji={ins.emoji} text={ins.text} />
              ))}
            </>
          )}

          {/* Next bags to use */}
          {core.nextBagsToUse.length > 0 && (
            <>
              <SectionLabel>Next bags to use</SectionLabel>
              <View style={{ marginHorizontal: 16, gap: 8 }}>
                {core.nextBagsToUse.map((b) => (
                  <BagRow key={b.id} bag={b} onPress={() => nav.navigate('MilkVaultBags')} />
                ))}
              </View>
            </>
          )}

          {/* Lifetime */}
          <SectionLabel>Lifetime</SectionLabel>
          <V3Card style={{ marginHorizontal: 16 }} contentStyle={styles.lifetimeInner}>
            <Text style={styles.lifetimeValue}>{core.lifetimeMilkLoggedOz} oz</Text>
            <Text style={styles.lifetimeLabel}>of milk logged since you started 💪</Text>
          </V3Card>

          {/* Actions */}
          <View style={styles.actions}>
            <PrimaryCTA label="＋ Add a milk bag" onPress={() => nav.navigate('MilkVaultAddBag', {})} />
            <View style={styles.secondaryRow}>
              <SecondaryBtn label="📷 Scan a bag" onPress={() => nav.navigate('MilkVaultScan')} />
              <SecondaryBtn label="View all bags" onPress={() => nav.navigate('MilkVaultBags')} />
            </View>
          </View>

          <VaultLegalNote text={VAULT_LEGAL_COPY} />
        </ScrollView>
      </SafeAreaView>
    </VaultScreen>
  );
}

function BagRow({ bag, onPress }: { bag: MilkVaultBag; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.bagRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.bagOz}><Text style={styles.bagOzText}>{bag.ounces}</Text><Text style={styles.bagOzUnit}>oz</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bagDate}>Frozen {shortDate(bag.frozen_at)}</Text>
        {bag.notes ? <Text style={styles.bagNotes} numberOfLines={1}>{bag.notes}</Text> : null}
      </View>
      <Text style={styles.bagChevron}>›</Text>
    </TouchableOpacity>
  );
}

function SecondaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: FONTS.v2_body, fontSize: 15, color: COLORS.genz_softink },
  gear: { fontSize: 22, color: COLORS.genz_chestnut },

  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalDays: { fontFamily: FONTS.v2_bold, fontSize: 16, color: COLORS.genz_chestnut },
  goalPct: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: COLORS.genz_rose },
  goalSub: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: COLORS.genz_softink, marginTop: 8 },

  mktBtns: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  mktBtn: {
    flex: 1, backgroundColor: COLORS.genz_bone, borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
  },
  mktBtnEmoji: { fontSize: 22 },
  mktBtnLabel: { fontFamily: FONTS.v2_bold, fontSize: 15, color: COLORS.genz_chestnut, marginTop: 8 },
  mktBtnSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.genz_softink, marginTop: 2 },

  bagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.genz_bone,
    borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.14)',
  },
  bagOz: { width: 52, height: 52, borderRadius: 12, backgroundColor: COLORS.genz_blush, alignItems: 'center', justifyContent: 'center' },
  bagOzText: { fontFamily: FONTS.v2_display_big, fontSize: 20, color: COLORS.genz_chestnut },
  bagOzUnit: { fontFamily: FONTS.v2_label, fontSize: 10, color: COLORS.genz_softink, marginTop: -2 },
  bagDate: { fontFamily: FONTS.v2_label, fontSize: 14, color: COLORS.genz_chestnut },
  bagNotes: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: COLORS.genz_softink, marginTop: 2 },
  bagChevron: { fontSize: 22, color: COLORS.genz_clay },

  lifetimeInner: { padding: 18, alignItems: 'center' },
  lifetimeValue: { fontFamily: FONTS.v2_display_big, fontSize: 34, color: COLORS.genz_chestnut },
  lifetimeLabel: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: COLORS.genz_softink, marginTop: 4, textAlign: 'center' },

  actions: { paddingHorizontal: 16, marginTop: 24, gap: 10 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1, backgroundColor: COLORS.genz_bone, borderRadius: 999, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(217,108,136,0.4)',
  },
  secondaryBtnText: { fontFamily: FONTS.v2_link, fontSize: 14, color: COLORS.genz_berry },
});
