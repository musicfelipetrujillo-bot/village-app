import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useMilkVaultStore } from '@store/milkVault';
import {
  computeStashMetrics, selectStashInsights, type StashInsight,
} from '@api/milkVault';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import MilkVaultDisclaimer from '@components/milk/MilkVaultDisclaimer';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'VaultHome'>;

function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function fmtOz(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function MilkVaultHomeScreen({ navigation }: Props) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en');
  const { settings, bags, loading, loaded, fetchVault } = useMilkVaultStore();

  useEffect(() => {
    if (user) fetchVault(user.id);
  }, [user?.id]);

  // No settings row => user hasn't chosen a mode yet. Send to the picker.
  useEffect(() => {
    if (loaded && !loading && !settings) navigation.replace('VaultModePicker');
  }, [loaded, loading, settings]);

  const todayISO = localISO(new Date());
  const metrics = useMemo(
    () => (settings ? computeStashMetrics(bags, settings, todayISO) : null),
    [bags, settings, todayISO],
  );
  const insights = useMemo(
    () => (settings && metrics ? selectStashInsights(metrics, settings, todayISO) : []),
    [metrics, settings, todayISO],
  );

  const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', {
      month: 'short', day: 'numeric',
    });

  const insightText = (ins: StashInsight): string => {
    switch (ins.kind) {
      case 'coverage': return t('milkVault.insightCoverage', { days: ins.days ?? 0 });
      case 'weekly_added': return t('milkVault.insightWeekly', { oz: ins.oz ?? 0 });
      case 'reserve_proximity':
        return t('milkVault.insightReserveProximity', { days: ins.days ?? 0, goalDays: ins.goalDays ?? 0 });
      case 'goal_pace':
        return t('milkVault.insightGoalPace', { goalDays: ins.goalDays ?? 0, date: fmtDate(ins.dateISO ?? todayISO) });
      case 'oldest_rotate':
        return t('milkVault.insightOldest', { date: fmtDate(ins.dateISO ?? todayISO) });
      default: return '';
    }
  };

  if (loading && !loaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <V9PageBackdrop />
        <ActivityIndicator color={COLORS.v2_cinnamon} />
      </View>
    );
  }
  if (!settings || !metrics) {
    return <View style={styles.container}><V9PageBackdrop /></View>;
  }

  const coverageWeeks = metrics.babyCoverageDays / 7;
  const goalPct = Math.round(metrics.stashGoalProgress * 100);
  const isEmpty = metrics.totalBags === 0;

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Masthead */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('VaultSettings')}
            accessibilityRole="button"
            accessibilityLabel={t('milkVault.settingsA11y')}
          >
            <Text style={styles.gear}>⚙︎</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>{t('milkVault.eyebrow')}</Text>
        <Text style={styles.title}>
          {t('milkVault.homeTitleRoman')}{' '}
          <Text style={styles.titleScript}>{t('milkVault.homeTitleScript')}</Text>
        </Text>

        {settings.mode === 'marketplace' && (
          <View style={styles.mktBanner}>
            <Text style={styles.mktBannerText}>{t('milkVault.marketplaceComingSoonBanner')}</Text>
          </View>
        )}

        {isEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🧊</Text>
            <Text style={styles.emptyTitle}>{t('milkVault.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('milkVault.emptyBody')}</Text>
          </View>
        ) : (
          <>
            {/* Hero — Freezer Stash */}
            <LinearGradient
              colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroLabel}>{t('milkVault.cardFreezerStash')}</Text>
              <Text style={styles.heroNumber}>{fmtOz(metrics.totalFreezerOz)}<Text style={styles.heroUnit}> oz</Text></Text>
              <Text style={styles.heroSub}>{t('milkVault.bagsCount', { count: metrics.totalBags })}</Text>
            </LinearGradient>

            {/* Two-up: Baby Coverage + This Week */}
            <View style={styles.row}>
              <View style={[styles.statCard, styles.rowHalf]}>
                <Text style={styles.statLabel}>{t('milkVault.cardBabyCoverage')}</Text>
                <Text style={styles.statNumber}>{Math.round(metrics.babyCoverageDays)}</Text>
                <Text style={styles.statUnit}>{t('milkVault.daysCovered', { weeks: coverageWeeks.toFixed(1) })}</Text>
              </View>
              <View style={[styles.statCard, styles.rowHalf]}>
                <Text style={styles.statLabel}>{t('milkVault.cardThisWeek')}</Text>
                <Text style={styles.statNumber}>+{fmtOz(metrics.weeklyOuncesAdded)}</Text>
                <Text style={styles.statUnit}>{t('milkVault.ozThisWeek')}</Text>
              </View>
            </View>

            {/* Stash Goal */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardLabel}>{t('milkVault.cardStashGoal')}</Text>
                <Text style={styles.cardPct}>{goalPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(goalPct, 100)}%` }]} />
              </View>
              <Text style={styles.cardFoot}>
                {t('milkVault.stashGoalFoot', {
                  have: fmtOz(metrics.totalFreezerOz),
                  goal: fmtOz(metrics.stashGoalOunces),
                  days: settings.stash_goal_days,
                })}
              </Text>
            </View>

            {/* Oldest Milk */}
            {metrics.oldestMilkDate && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>{t('milkVault.cardOldestMilk')}</Text>
                <Text style={styles.oldestDate}>{fmtDate(metrics.oldestMilkDate)}</Text>
                <Text style={styles.cardFoot}>{t('milkVault.oldestFoot')}</Text>
              </View>
            )}

            {/* AI insights */}
            {insights.length > 0 && (
              <View style={styles.insightWrap}>
                {insights.map((ins, i) => (
                  <View key={`${ins.kind}-${i}`} style={styles.insightRow}>
                    <Text style={styles.insightSpark}>✦</Text>
                    <Text style={styles.insightText}>{insightText(ins)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Next bags to use */}
            {metrics.nextBagsToUse.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>{t('milkVault.cardNextToUse')}</Text>
                {metrics.nextBagsToUse.map((b) => (
                  <View key={b.id} style={styles.bagRow}>
                    <Text style={styles.bagRowDate}>{fmtDate(b.frozen_at)}</Text>
                    <Text style={styles.bagRowOz}>{fmtOz(b.ounces)} oz</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.lifetime}>
              {t('milkVault.lifetimeLogged', { oz: fmtOz(metrics.lifetimeMilkLogged) })}
            </Text>
          </>
        )}

        {/* Actions */}
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('VaultAddBag')}>
          <Text style={styles.ctaText}>{t('milkVault.addBagBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctaSecondary} onPress={() => navigation.navigate('VaultScanBag')}>
          <Text style={styles.ctaSecondaryText}>{t('milkVault.scanBagBtn')}</Text>
        </TouchableOpacity>

        <MilkVaultDisclaimer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  back: { fontSize: 22, color: COLORS.v2_walnut, fontFamily: FONTS.v2_link },
  gear: { fontSize: 20, color: COLORS.v2_walnut },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: COLORS.v2_amber, fontFamily: FONTS.v2_mono },
  title: { fontSize: 30, lineHeight: 36, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, letterSpacing: -0.5, marginTop: 6, marginBottom: 18 },
  titleScript: { fontFamily: FONTS.v2_script, color: COLORS.v2_cinnamon, fontSize: 34 },

  mktBanner: { backgroundColor: 'rgba(217,108,136,0.10)', borderRadius: 12, padding: 12, marginBottom: 16 },
  mktBannerText: { fontSize: 12.5, lineHeight: 18, color: COLORS.v2_cinnamon_dk, fontFamily: FONTS.v2_link },

  heroCard: { borderRadius: 22, padding: 22, marginBottom: 12 },
  heroLabel: { fontSize: 12.5, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.v2_walnut, fontFamily: FONTS.v2_mono },
  heroNumber: { fontSize: 48, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, letterSpacing: -1, marginTop: 4 },
  heroUnit: { fontSize: 22, color: COLORS.v2_walnut, fontFamily: FONTS.v2_display },
  heroSub: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body, marginTop: 2 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rowHalf: { flex: 1 },
  statCard: { backgroundColor: COLORS.v2_card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(122,74,36,0.10)' },
  statLabel: { fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.v2_amber, fontFamily: FONTS.v2_mono },
  statNumber: { fontSize: 30, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, letterSpacing: -0.6, marginTop: 6 },
  statUnit: { fontSize: 12.5, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body, marginTop: 2 },

  card: { backgroundColor: COLORS.v2_card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(122,74,36,0.10)' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardLabel: { fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.v2_amber, fontFamily: FONTS.v2_mono },
  cardPct: { fontSize: 18, color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_display },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: COLORS.v2_parchment, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: COLORS.v2_cinnamon },
  cardFoot: { fontSize: 12.5, lineHeight: 18, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body, marginTop: 10 },
  oldestDate: { fontSize: 24, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, marginTop: 6 },

  insightWrap: { marginTop: 4, marginBottom: 12, gap: 10 },
  insightRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  insightSpark: { fontSize: 14, color: COLORS.v2_cinnamon, marginTop: 2 },
  insightText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_body },

  bagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(122,74,36,0.08)' },
  bagRowDate: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body },
  bagRowOz: { fontSize: 14, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_link },

  lifetime: { fontSize: 12.5, color: COLORS.v2_amber, fontFamily: FONTS.v2_body, textAlign: 'center', marginTop: 4, marginBottom: 8 },

  emptyCard: { backgroundColor: COLORS.v2_card, borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(122,74,36,0.10)' },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 19, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, marginTop: 12 },
  emptyBody: { fontSize: 14, lineHeight: 20, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body, textAlign: 'center', marginTop: 6 },

  cta: { marginTop: 8, backgroundColor: COLORS.v2_cinnamon, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: COLORS.v2_card, fontSize: 16, fontFamily: FONTS.v2_link },
  ctaSecondary: { marginTop: 12, backgroundColor: COLORS.v2_card, borderRadius: 999, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(217,108,136,0.30)' },
  ctaSecondaryText: { color: COLORS.v2_cinnamon, fontSize: 16, fontFamily: FONTS.v2_link },
});
