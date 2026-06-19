// Villie Boxes — checkout (shipping + Stripe PaymentSheet).
//
// First-party physical-goods checkout. Mirrors the Specialist PaymentScreen
// flow: collect a shipping address, ask the edge function for a PaymentIntent
// (which recomputes the authoritative amount server-side from the catalog),
// init + present the Stripe PaymentSheet, then on capture clear the cart and
// route to the order-confirmation screen.
//
// The amount shown here is the client's own estimate; the charge is whatever
// the server computed (returned as amount_cents) — they agree unless someone
// tampered with the client, in which case the server wins.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { COLORS, FONTS } from '@utils/constants';
import { boxesApi, formatPrice, type BoxId, type BoxShipping } from '@api/boxes';
import { useBoxesStore, cartTotal } from '@store/boxes';
import { useAuthStore } from '@store/auth';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

const T = {
  paper: COLORS.v2_paper,
  cream: COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  cinnamon: COLORS.v2_cinnamon,
  caramel: COLORS.v2_caramel,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rule: 'rgba(61,31,14,0.13)',
};

type Nav = NativeStackNavigationProp<HomeStackParamList>;

interface Field {
  key: keyof BoxShipping;
  label: string;
  placeholder: string;
  required: boolean;
  half?: boolean;
  autoCap?: 'words' | 'characters' | 'none';
  keyboard?: 'default' | 'number-pad' | 'phone-pad';
}

const FIELDS: Field[] = [
  { key: 'name', label: 'Full name', placeholder: 'Alana Rivera', required: true, autoCap: 'words' },
  { key: 'line1', label: 'Address', placeholder: '123 Palm Ave', required: true, autoCap: 'words' },
  { key: 'line2', label: 'Apt / unit (optional)', placeholder: 'Apt 4B', required: false, autoCap: 'words' },
  { key: 'city', label: 'City', placeholder: 'Miami', required: true, half: true, autoCap: 'words' },
  { key: 'state', label: 'State', placeholder: 'FL', required: true, half: true, autoCap: 'characters' },
  { key: 'zip', label: 'ZIP', placeholder: '33101', required: true, half: true, keyboard: 'number-pad' },
  { key: 'phone', label: 'Phone (optional)', placeholder: '(305) 555-0142', required: false, half: true, keyboard: 'phone-pad' },
];

function CheckoutContent() {
  const navigation = useNavigation<Nav>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const user = useAuthStore((s) => s.user);

  const cart = useBoxesStore((s) => s.cart);
  const clearCart = useBoxesStore((s) => s.clearCart);
  const estimate = cartTotal(cart);

  const [ship, setShip] = useState<BoxShipping>({
    name: '', line1: '', line2: '', city: '', state: '', zip: '', phone: '',
  });
  const [paying, setPaying] = useState(false);

  const set = (k: keyof BoxShipping, v: string) => setShip((s) => ({ ...s, [k]: v }));

  const missing = FIELDS.filter((f) => f.required && !ship[f.key]?.trim()).map((f) => f.label);
  const canPay = missing.length === 0 && cart.length > 0 && !paying;

  const handlePay = async () => {
    if (!canPay || !user) return;
    setPaying(true);
    try {
      const bundle = cart.some((l) => l.kind === 'bundle');
      const lines = cart
        .filter((l): l is Extract<typeof l, { kind: 'box' }> => l.kind === 'box')
        .map((l) => ({ box_id: l.boxId as BoxId, removed: l.removed, addons: l.addons }));

      const res = await boxesApi.createPaymentIntent({ lines, bundle, shipping: ship });

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Villie',
        paymentIntentClientSecret: res.client_secret,
        defaultBillingDetails: { name: ship.name, email: user.email ?? '' },
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return; // user dismissed — silent
        Alert.alert('Payment failed', presentError.message ?? 'Please try again.');
        return;
      }

      // Charge captured. The edge function already wrote the draft order; a
      // Stripe webhook will flip it to 'paid'. Clear the cart + confirm.
      clearCart();
      navigation.replace('BoxOrderConfirm', {
        orderId: res.order_id,
        amountCents: res.amount_cents,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not set up payment.';
      Alert.alert('Checkout error', msg);
    } finally {
      setPaying(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backBtn}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke={T.cocoa} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          <Text style={styles.title}>Ship it <Text style={styles.titleEm}>to you</Text></Text>
          <Text style={styles.sub}>Where should we send your box{cart.length > 1 ? 'es' : ''}?</Text>

          {/* Shipping form */}
          <View style={styles.form}>
            {FIELDS.map((f) => (
              <View key={f.key} style={[styles.fieldWrap, f.half && styles.fieldHalf]}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  value={ship[f.key] ?? ''}
                  onChangeText={(v) => set(f.key, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor="rgba(122,74,36,0.4)"
                  autoCapitalize={f.autoCap ?? 'sentences'}
                  keyboardType={f.keyboard ?? 'default'}
                  style={styles.input}
                  accessibilityLabel={f.label}
                />
              </View>
            ))}
          </View>

          {/* Order total */}
          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalVal}>{formatPrice(estimate)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Shipping</Text>
              <Text style={styles.totalFree}>Free</Text>
            </View>
            <View style={[styles.totalRow, styles.totalGrand]}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandVal}>{formatPrice(estimate)}</Text>
            </View>
          </View>

          <Text style={styles.secure}>🔒 Payments are processed securely by Stripe. Villie never sees your card.</Text>
        </ScrollView>

        {/* Pay bar */}
        <View style={styles.payBar}>
          {!canPay && missing.length > 0 ? (
            <Text style={styles.missingNote} numberOfLines={1}>
              Add your {missing.slice(0, 2).join(' & ').toLowerCase()} to continue
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={handlePay}
            disabled={!canPay}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPay, busy: paying }}
            accessibilityLabel={`Pay ${formatPrice(estimate)}`}
            style={[styles.payBtn, !canPay && styles.payBtnDisabled]}
          >
            {paying ? (
              <ActivityIndicator color={T.paper} />
            ) : (
              <Text style={styles.payBtnText}>Pay {formatPrice(estimate)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function BoxesCheckoutScreen() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <CheckoutContent />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 40 },

  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
    marginLeft: -4, marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.v3_display, fontSize: 34, lineHeight: 36,
    color: T.cocoa, letterSpacing: -1.2, marginTop: 8,
  },
  titleEm: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon, fontSize: 32 },
  sub: { fontFamily: FONTS.v2_body, fontSize: 14, color: T.walnut, marginTop: 8 },

  form: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    marginTop: 22,
  },
  fieldWrap: { width: '100%', marginBottom: 14 },
  fieldHalf: { width: '48%' },
  fieldLabel: {
    fontFamily: FONTS.v2_label, fontSize: 12, color: T.walnut, marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: T.paper, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: FONTS.v2_body, fontSize: 15, color: T.cocoa,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },

  totalCard: {
    backgroundColor: T.paper, borderRadius: 16, padding: 16, marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  totalLabel: { fontFamily: FONTS.v2_label, fontSize: 13, color: T.walnut },
  totalVal: { fontFamily: FONTS.v2_bold, fontSize: 14, color: T.cocoa },
  totalFree: { fontFamily: FONTS.v2_bold, fontSize: 13, color: T.caramel },
  totalGrand: {
    marginBottom: 0, marginTop: 4, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  grandLabel: { fontFamily: FONTS.v2_bold, fontSize: 16, color: T.cocoa },
  grandVal: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: T.cocoa },

  secure: {
    fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 16,
    color: T.walnut, opacity: 0.8, marginTop: 16, textAlign: 'center',
  },

  payBar: {
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30,
    backgroundColor: T.paper,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  missingNote: {
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut,
    textAlign: 'center', marginBottom: 8,
  },
  payBtn: {
    backgroundColor: T.cinnamon, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { fontFamily: FONTS.v2_bold, fontSize: 16, color: T.paper },
});
