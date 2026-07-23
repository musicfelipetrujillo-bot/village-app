// V1 Phase 4 — Stripe PaymentSheet for appointment payment.
//
// Error UX is the most-exposed surface in the app — money changes hands and
// the user is mid-purchase. Three paths matter:
//
//   1. Init failure (network / 4xx / 5xx from create-payment-intent, or
//      Stripe initPaymentSheet error). Recoverable: offer "Try again" before
//      "Go back" so a flaky cell signal doesn't kill a booking.
//   2. PaymentSheet present failure. Stripe surfaces structured error codes
//      (Canceled / Failed / Timeout / Unknown) plus underlying decline_code
//      from the gateway. Map to copy that tells the user *what* failed and
//      whether to retry — "card declined" is recoverable, "authentication
//      required" they need to handle on the card sheet itself.
//   3. **Charge succeeded but appointment-create failed.** The legally most
//      exposed branch — Stripe captured the money, but our DB row is missing.
//      Auto-retry once on transient errors, then surface a critical-state
//      alert with the payment_intent_id as a support reference so ops can
//      reconcile manually. We still navigate forward to BookingConfirm so
//      the user has a record of their charge.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { useT } from '@/i18n';
import { useAuthStore } from '@store/auth';
import { supabase } from '@/lib/supabase';
import { appointmentsApi } from '@api/appointments';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'Payment'>;
type TFn = (key: string, params?: Record<string, string | number>) => string;

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPPORT_EMAIL = 'support@thevillageapp.com';

// Map Stripe PaymentSheet error codes + underlying decline_code to copy a
// user can act on. Anything we don't recognize falls through to "Payment
// failed" with the raw message — which is what the old code did for everything.
function mapStripeError(
  err: { code?: string; declineCode?: string; message?: string },
  t: TFn,
): { title: string; body: string; retryable: boolean } {
  const code = err.code ?? '';
  const decline = err.declineCode ?? '';

  // User dismissed the sheet — not an error, caller should swallow.
  if (code === 'Canceled') {
    return { title: t('payment.errCanceledTitle'), body: t('payment.errCanceledBody'), retryable: true };
  }

  // Decline reasons the user can fix themselves.
  if (decline === 'insufficient_funds') {
    return {
      title: t('payment.errInsufficientTitle'),
      body: t('payment.errInsufficientBody'),
      retryable: true,
    };
  }
  if (decline === 'expired_card' || code === 'card_declined' && decline === 'expired_card') {
    return {
      title: t('payment.errExpiredTitle'),
      body: t('payment.errExpiredBody'),
      retryable: true,
    };
  }
  if (decline === 'incorrect_cvc') {
    return {
      title: t('payment.errCvcTitle'),
      body: t('payment.errCvcBody'),
      retryable: true,
    };
  }
  if (code === 'card_declined' || decline === 'generic_decline' || decline === 'do_not_honor') {
    return {
      title: t('payment.errDeclinedTitle'),
      body: t('payment.errDeclinedBody'),
      retryable: true,
    };
  }

  // 3D Secure / SCA challenge failed — usually means the user closed the
  // bank's authentication window. They can retry and complete it.
  if (code === 'authentication_required' || decline === 'authentication_required') {
    return {
      title: t('payment.errAuthTitle'),
      body: t('payment.errAuthBody'),
      retryable: true,
    };
  }

  // Network / Stripe-side issues — definitely retryable.
  if (code === 'Timeout' || code === 'timeout') {
    return {
      title: t('payment.errTimeoutTitle'),
      body: t('payment.errTimeoutBody'),
      retryable: true,
    };
  }
  if (code === 'Failed' || code === 'Unknown' || code === 'processing_error') {
    return {
      title: t('payment.errFailedTitle'),
      body: err.message ?? t('payment.errFailedBody'),
      retryable: true,
    };
  }

  return {
    title: t('payment.errGenericTitle'),
    body: err.message ?? t('payment.errGenericBody'),
    retryable: true,
  };
}

function PaymentContent({ navigation, route }: Props) {
  const t = useT();
  const { specialistId, serviceName, amountCents, appointmentAt, isTelehealth, specialistName, telehealth_link } = route.params;
  const user = useAuthStore((s) => s.user);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Refs (not state) for double-tap protection. State updates aren't
  // synchronous — a fast double-tap can fire handlePay twice before
  // setPaying(true) lands. Ref flips immediately and short-circuits the
  // second tap.
  const payingRef = useRef(false);

  const appointmentDate = new Date(appointmentAt);

  useEffect(() => {
    initSheet();
    // initSheet only depends on params (stable from navigation) — re-running
    // it would tear down a working PaymentSheet, so we deliberately skip
    // the dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initSheet = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let res: Response;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ amount_cents: amountCents, specialist_id: specialistId, service_name: serviceName }),
        });
      } catch (netErr: any) {
        // TypeError on fetch = no network. Distinct copy from a server-side
        // error so the user knows to check their connection vs. blame Stripe.
        throw new Error('NETWORK: ' + (netErr?.message ?? 'Network request failed'));
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`SERVER_${res.status}: ${text || 'Could not set up payment'}`);
      }

      const { client_secret, payment_intent_id, error } = await res.json();
      if (error) throw new Error(error);
      if (!client_secret) throw new Error('Missing payment session from server');

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Villie',
        paymentIntentClientSecret: client_secret,
        defaultBillingDetails: { name: user?.email ?? '' },
      });

      if (initError) throw new Error(initError.message);
      // Stash the PI id so we can pass it to the appointment row AND surface
      // it as a support reference if the post-charge insert fails.
      if (payment_intent_id) setPaymentIntentId(payment_intent_id);
      setReady(true);
    } catch (e: any) {
      const raw = e?.message ?? '';
      const isNetwork = raw.startsWith('NETWORK:');
      const isServer = raw.startsWith('SERVER_');
      const title = isNetwork ? t('payment.errInitConnTitle') : t('payment.errInitServerTitle');
      const body = isNetwork
        ? t('payment.errInitConnBody')
        : isServer
        ? t('payment.errInitServerBody')
        : raw || t('payment.errInitGenericBody');
      Alert.alert(title, body, [
        { text: t('payment.errInitGoBack'), style: 'cancel', onPress: () => navigation.goBack() },
        { text: t('payment.errInitTryAgain'), onPress: () => initSheet() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Persist the appointment row after a successful charge. Retries once on
  // transient failure (network, 5xx) before giving up — the cost of a missing
  // row is high (user paid but has no record visible to them) so we trade one
  // extra network call for resilience.
  const persistAppointmentWithRetry = async (): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    const payload = {
      user_id: user.id,
      specialist_id: specialistId,
      source: 'in_app' as const,
      appointment_at: appointmentAt,
      service_type: serviceName,
      is_telehealth: isTelehealth,
      amount_cents: amountCents,
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    };
    try {
      await appointmentsApi.create(payload);
    } catch (firstErr) {
      // Single-shot retry. Wait briefly so transient flakes (DNS, brief 503)
      // have a chance to clear, but don't make the user wait long.
      await new Promise((r) => setTimeout(r, 800));
      await appointmentsApi.create(payload);
      // Let the second throw bubble — caller handles it as the critical-state
      // branch.
      void firstErr;
    }
  };

  const handlePay = async () => {
    if (!ready || !user) return;
    if (payingRef.current) return;       // double-tap guard
    payingRef.current = true;
    setPaying(true);
    try {
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return;  // user dismissed; silent
        const mapped = mapStripeError(presentError, t);
        Alert.alert(mapped.title, mapped.body);
        return;
      }

      // Charge captured. Now persist the appointment row.
      try {
        await persistAppointmentWithRetry();
      } catch (dbErr: any) {
        // CRITICAL PATH: money was taken, DB row failed. Tell the user
        // exactly what happened, give them a payment reference, and still
        // navigate them forward — the BookingConfirm screen has the details
        // of their charge so they have a screenshot-able record.
        const ref = paymentIntentId ?? 'unavailable';
        Alert.alert(
          t('payment.criticalTitle'),
          t('payment.criticalBody', { amount: Math.round(amountCents / 100), email: SUPPORT_EMAIL, ref }),
          [
            { text: t('payment.criticalContinue'), onPress: () => {
              navigation.replace('BookingConfirm', {
                specialistId,
                specialistName,
                serviceName,
                appointmentAt,
                isTelehealth,
                telehealth_link,
                amountCents,
              });
            } },
          ],
          { cancelable: false },
        );
        return;
      }

      navigation.replace('BookingConfirm', {
        specialistId,
        specialistName,
        serviceName,
        appointmentAt,
        isTelehealth,
        telehealth_link,
        amountCents,
      });
    } catch (e: any) {
      // Defensive — shouldn't reach here. presentPaymentSheet returns errors
      // via the destructured object rather than throwing, and persist errors
      // are caught above.
      Alert.alert(t('payment.errFatalTitle'), e?.message ?? t('payment.errFatalBody', { email: SUPPORT_EMAIL }));
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      {/* v9 editorial header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('payment.back')}</Text>
        </TouchableOpacity>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrow}>{t('payment.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>
          {t('payment.titleLead')} <Text style={styles.titleEm}>{t('payment.titleEm')}</Text>
        </Text>
        <View style={styles.headerRule} />
      </View>

      <View style={styles.content}>
        {/* Appointment summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('payment.summaryLabel')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment.rowProvider')}</Text>
            <Text style={styles.summaryVal}>{specialistName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment.rowService')}</Text>
            <Text style={styles.summaryVal}>{serviceName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment.rowDateTime')}</Text>
            <Text style={styles.summaryVal}>
              {t('payment.dateTimeFormat', {
                date: appointmentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                time: appointmentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment.rowType')}</Text>
            <Text style={styles.summaryVal}>{isTelehealth ? t('payment.typeTelehealth') : t('payment.typeInPerson')}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalKey}>{t('payment.rowTotal')}</Text>
            <Text style={styles.summaryTotalVal}>{t('payment.totalAmount', { amount: Math.round(amountCents / 100) })}</Text>
          </View>
        </View>

        {/* Stripe badge */}
        <View style={styles.stripeBadge}>
          <Text style={styles.stripeBadgeText}>{t('payment.secureBadge')}</Text>
        </View>

        {/* Info */}
        <Text style={styles.info}>
          {t('payment.info')}
        </Text>
      </View>

      {/* Pay button */}
      <View style={styles.ctaBar}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#E84B79" />
            <Text style={styles.loadingText}>{t('payment.settingUp')}</Text>
          </View>
        ) : (
          <PrimaryCTA
            shape="rect"
            label={t('payment.payCta', { amount: Math.round(amountCents / 100) })}
            onPress={handlePay}
            loading={paying}
            disabled={!ready}
          />
        )}
      </View>
    </View>
  );
}

// Wrap in StripeProvider at screen level so it's scoped to the payment flow
export default function PaymentScreen(props: Props) {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <PaymentContent {...props} />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodyMedium },
  // v9 editorial masthead
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eyebrowBar: { width: 22, height: 2, backgroundColor: '#7A4A24', marginRight: 10, borderRadius: 1 },
  eyebrow: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 32,
    color: COLORS.bark,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  titleEm: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#E84B79' },
  headerRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 10, width: 48,
  },

  content: { flex: 1, padding: 20, gap: 16 },

  summaryCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 16,
    padding: 16,
    gap: 0,
    // v9 paper lift
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#43260F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 5,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  summaryKey: { fontSize: 14, color: COLORS.textLight, fontFamily: FONTS.body },
  summaryVal: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: COLORS.bark, maxWidth: '55%', textAlign: 'right' },
  summaryTotal: {
    borderBottomWidth: 0,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  summaryTotalKey: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  summaryTotalVal: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },

  stripeBadge: {
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  stripeBadgeText: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },

  info: { fontSize: 12, color: COLORS.textLight, lineHeight: 18, textAlign: 'center', fontFamily: FONTS.body },

  ctaBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56 },
  loadingText: { fontSize: 14, color: COLORS.textLight, fontFamily: FONTS.body },
  payBtn: {
    backgroundColor: '#E84B79',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { color: '#FFFCF6', fontSize: 17, fontFamily: FONTS.bodySemiBold },
});
