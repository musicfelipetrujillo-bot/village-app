// villie pro paywall — Build 14 (spec: docs/superpowers/specs/
// 2026-07-29-villie-pro-video-paywall-design.md, mock approved 2026-07-29).
//
// Root-level modal (RootNavigator "Paywall"). Reached from locked Manual
// video cards; accepts { source } for conversion attribution.
//
// Voice: lowercase villie warmth on the pitch; the fine print (auto-renew,
// cancel, restore, legal links) stays sober per the V10 legal carve-out and
// App Store 3.1.2. No medical-efficacy claims anywhere (Guideline 3.1.1 —
// see V5 risk flags).
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useAnalytics } from '@hooks/useAnalytics';
import {
  purchasePro, restorePro, isProEnabled, fetchProPricing,
  ProCancelledError, ProUnavailableError, type ProPlan, type ProPricing,
} from '@/lib/pro';

const T = {
  cream:  COLORS.genz_cream ?? '#FCF7EF',
  bone:   '#FFFCF6',
  rose:   '#C24A63',
  berry:  '#9E2F4C',
  honey:  '#D9789A',
  blush:  '#F7C5CB',
  clay:   '#DDB58C',
  ink:    '#43260F',
  soft:   '#7A4A24',
};

const PRIVACY_URL = 'https://villieapp.com/privacy';
// Apple's standard EULA — required Terms-of-Use link for auto-renewables
// until counsel publishes a custom one (swap here + App Store metadata).
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function PaywallScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const source: string = route.params?.source ?? 'unknown';
  const { trackEvent } = useAnalytics();

  const [plan, setPlan] = useState<ProPlan>('annual');
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [pricing, setPricing] = useState<ProPricing | null>(null);

  useEffect(() => {
    trackEvent('paywall_shown', { source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live storefront pricing + intro-offer eligibility. Never blocks render:
  // the US constants below stand in until (or unless) StoreKit answers.
  useEffect(() => {
    let cancelled = false;
    fetchProPricing().then((p) => {
      if (!cancelled && p) setPricing(p);
    });
    return () => { cancelled = true; };
  }, []);

  // Display values. Fallbacks are the US list prices — the same numbers this
  // screen hardcoded before, so a store hiccup degrades to today's behaviour.
  const annualPrice  = pricing?.annual.price ?? '$49.99';
  const monthlyPrice = pricing?.monthly.price ?? '$6.99';
  const perMonth     = pricing?.annual.perMonth ?? '$4.17';
  const savings      = pricing?.savingsPercent ?? 40;
  // A returning subscriber gets charged immediately — promising them a free
  // week would be false, so the CTA and fine print both swap.
  const trial        = pricing?.trialEligible ?? true;

  const close = () => {
    trackEvent('paywall_dismissed', { source });
    navigation.goBack();
  };

  const onPurchase = async () => {
    if (busy) return;
    setBusy('purchase');
    trackEvent('paywall_purchase_started', { plan, source });
    try {
      const entitled = await purchasePro(plan);
      if (entitled) {
        trackEvent('paywall_purchase_succeeded', { plan, source });
        Alert.alert(t('paywall.welcomeTitle'), t('paywall.welcomeBody'), [
          { text: t('paywall.welcomeCta'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      if (e instanceof ProCancelledError) {
        trackEvent('paywall_purchase_cancelled', { plan, source });
      } else if (e instanceof ProUnavailableError) {
        trackEvent('paywall_purchase_failed', { plan, source, reason: 'unavailable' });
        Alert.alert(t('paywall.soonTitle'), t('paywall.soonBody'));
      } else {
        trackEvent('paywall_purchase_failed', {
          plan, source, reason: String((e as Error).message).slice(0, 120),
        });
        Alert.alert(t('paywall.errorTitle'), t('paywall.errorBody'));
      }
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy('restore');
    try {
      const entitled = await restorePro();
      if (entitled) {
        trackEvent('paywall_restore_succeeded', { source });
        Alert.alert(t('paywall.restoredTitle'), t('paywall.restoredBody'), [
          { text: t('paywall.welcomeCta'), onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(t('paywall.noRestoreTitle'), t('paywall.noRestoreBody'));
      }
    } catch (e) {
      if (e instanceof ProUnavailableError) {
        Alert.alert(t('paywall.soonTitle'), t('paywall.soonBody'));
      } else {
        Alert.alert(t('paywall.errorTitle'), t('paywall.errorBody'));
      }
    } finally {
      setBusy(null);
    }
  };

  const finePrint = plan === 'annual'
    ? t(trial ? 'paywall.finePrintAnnual' : 'paywall.finePrintAnnualNoTrial', { price: annualPrice })
    : t(trial ? 'paywall.finePrintMonthly' : 'paywall.finePrintMonthlyNoTrial', { price: monthlyPrice });
  const ctaLabel = t(trial ? 'paywall.cta' : 'paywall.ctaNoTrial');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>
            villie{' '}
            <Text style={styles.proPill}> pro </Text>
          </Text>
          <TouchableOpacity
            onPress={close}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={styles.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.flourish}>{t('paywall.flourish')}</Text>
        <Text style={styles.headline}>{t('paywall.headline')}</Text>

        <View style={styles.benefits}>
          {(['b1', 'b2', 'b3', 'b4'] as const).map((k) => (
            <View key={k} style={styles.benefitRow}>
              <Text style={styles.benefitTick}>✓</Text>
              <Text style={styles.benefitText}>{t(`paywall.${k}`)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.freeNote}>{t('paywall.freeNote')}</Text>

        <TouchableOpacity
          style={[styles.planCard, plan === 'annual' && styles.planCardActive]}
          onPress={() => setPlan('annual')}
          activeOpacity={0.85}
          accessibilityRole="radio"
          accessibilityState={{ selected: plan === 'annual' }}
          accessibilityLabel={t(
            trial ? 'paywall.annualA11y' : 'paywall.annualA11yNoTrial',
            { price: annualPrice },
          )}
        >
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>
              {t('paywall.bestValue', { percent: savings })}
            </Text>
          </View>
          <Text style={styles.planName}>{t('paywall.annual')}</Text>
          <Text style={styles.planPrice}>
            <Text style={styles.planPriceBig}>{annualPrice}</Text>
            {t('paywall.annualSuffix', { perMonth })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.planCard, plan === 'monthly' && styles.planCardActive]}
          onPress={() => setPlan('monthly')}
          activeOpacity={0.85}
          accessibilityRole="radio"
          accessibilityState={{ selected: plan === 'monthly' }}
          accessibilityLabel={t(
            trial ? 'paywall.monthlyA11y' : 'paywall.monthlyA11yNoTrial',
            { price: monthlyPrice },
          )}
        >
          <Text style={styles.planName}>{t('paywall.monthly')}</Text>
          <Text style={styles.planPrice}>
            <Text style={styles.planPriceBig}>{monthlyPrice}</Text>
            {t('paywall.monthlySuffix')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cta, busy !== null && { opacity: 0.6 }]}
          onPress={onPurchase}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityState={{ busy: busy === 'purchase' }}
          accessibilityLabel={ctaLabel}
        >
          {busy === 'purchase'
            ? <ActivityIndicator color={T.bone} />
            : <Text style={styles.ctaText}>{ctaLabel}</Text>}
        </TouchableOpacity>

        {!isProEnabled() && (
          <Text style={styles.devNote}>{t('paywall.soonBody')}</Text>
        )}

        <Text style={styles.finePrint}>{finePrint}</Text>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={onRestore} disabled={busy !== null} accessibilityRole="button">
            <Text style={styles.legalLink}>
              {busy === 'restore' ? t('paywall.restoring') : t('paywall.restore')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
            <Text style={styles.legalLink}>{t('paywall.terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
            <Text style={styles.legalLink}>{t('paywall.privacy')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  scroll: { paddingHorizontal: 24, paddingBottom: 28 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 14, marginBottom: 18,
  },
  wordmark: { fontFamily: FONTS.headerBold, fontSize: 22, color: T.ink, letterSpacing: -0.5 },
  proPill: {
    fontFamily: FONTS.bodyBold, fontSize: 13, color: T.bone,
    backgroundColor: T.rose, overflow: 'hidden', borderRadius: 999,
  },
  closeX: { fontSize: 18, color: T.soft },

  flourish: { fontFamily: FONTS.headerItalic, fontSize: 24, color: T.rose },
  headline: {
    fontFamily: FONTS.headerBold, fontSize: 34, lineHeight: 37,
    color: T.ink, letterSpacing: -0.8, marginTop: 2, marginBottom: 16,
  },

  benefits: { gap: 8, marginBottom: 10 },
  benefitRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  benefitTick: { fontFamily: FONTS.bodyBold, fontSize: 14, color: T.rose, marginTop: 1 },
  benefitText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14.5, lineHeight: 20, color: T.ink },
  freeNote: { fontFamily: FONTS.body, fontSize: 12.5, color: T.soft, marginBottom: 18 },

  planCard: {
    backgroundColor: T.bone, borderRadius: 16, borderWidth: 1.5, borderColor: T.clay,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
  },
  planCardActive: { borderWidth: 2, borderColor: T.rose },
  planBadge: {
    position: 'absolute', top: -10, left: 14, backgroundColor: T.honey,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2,
  },
  planBadgeText: { fontFamily: FONTS.bodyBold, fontSize: 10.5, color: T.ink },
  planName: { fontFamily: FONTS.bodyBold, fontSize: 15, color: T.ink, marginBottom: 2 },
  planPrice: { fontFamily: FONTS.body, fontSize: 13, color: T.soft },
  planPriceBig: { fontFamily: FONTS.bodyBold, fontSize: 16, color: T.ink },

  cta: {
    backgroundColor: T.berry, borderRadius: 999, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 12,
  },
  ctaText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: T.bone },

  devNote: {
    fontFamily: FONTS.body, fontSize: 12, color: T.soft,
    textAlign: 'center', marginBottom: 10,
  },
  finePrint: {
    fontFamily: FONTS.body, fontSize: 11.5, lineHeight: 17, color: T.soft,
    textAlign: 'center', marginBottom: 10,
  },
  legalRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  legalLink: {
    fontFamily: FONTS.bodyMedium, fontSize: 12, color: T.soft,
    textDecorationLine: 'underline',
  },
  legalDot: { color: T.soft, fontSize: 12 },
});
