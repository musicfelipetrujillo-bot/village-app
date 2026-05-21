// V2 M3 — MilkPurchaseScreen
// Quantity + fulfillment + Stripe PaymentSheet → milk-purchase-intent → confirm.
//
// ──────────────────────────────────────────────────────────────────────
// ⚠️  DEPRECATED — 2026-05-21
// ──────────────────────────────────────────────────────────────────────
// V2 Milk Hub is now CASH-ONLY (see memory/project_milk_cash_only.md).
// Navigation to this screen is gated behind EXPO_PUBLIC_MILK_STRIPE_ENABLED
// in DonorProfileScreen — in production builds the flag is OFF so this
// screen is unreachable. The Stripe purchase flow stays in tree so the
// code path can be re-enabled if/when the money-transmitter posture
// changes (would require a FinCEN/Florida counsel review per
// docs/source/Village_Risk_and_Compliance.md).
//
// Active path for cash arrangements: DonorProfileScreen "Message" button
// → SafeMilkHandoffModal → getOrCreateThread → MilkMessageDetailScreen.
// No on-platform payment.
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { useAuthStore } from '@store/auth';
import {
  getDonorProfile, getDonorActiveListing,
  createPurchaseIntent, confirmPurchase,
  hasAcceptedLegal,
  type DonorPublicProfile, type MilkListing,
} from '@api/milk';
import { LegalDisclosureModal } from '@components/milk/LegalDisclosureModal';
import { useAnalytics } from '@hooks/useAnalytics';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkPurchase'>;

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

function PurchaseContent({ navigation, route }: Props) {
  const { donorProfileId, listingId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { trackEvent } = useAnalytics();
  const t = useT();

  const [donor, setDonor] = useState<DonorPublicProfile | null>(null);
  const [listing, setListing] = useState<MilkListing | null>(null);
  const [oz, setOz] = useState<number>(8);
  const [fulfillment, setFulfillment] = useState<'pickup' | 'shipping'>('pickup');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [disclosureVisible, setDisclosureVisible] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getDonorProfile(donorProfileId), getDonorActiveListing(donorProfileId)])
      .then(([d, l]) => {
        if (!mounted) return;
        setDonor(d);
        setListing(l);
        if (l) {
          setOz(Math.max(l.min_order_oz, 8));
          setFulfillment(l.pickup_available ? 'pickup' : 'shipping');
        }
      })
      .catch((e) => Alert.alert(t('milkPurchase.errorTitle'), e.message ?? t('milkPurchase.errorLoadDonor')))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [donorProfileId, listingId]);

  // Check previously accepted disclosure (same version) to avoid re-prompting
  useEffect(() => {
    if (!user?.id) return;
    hasAcceptedLegal(user.id, 'milk_purchase_disclaimer_v1')
      .then((accepted) => setLegalAccepted(accepted))
      .catch(() => { /* non-fatal — we'll re-prompt */ });
  }, [user?.id]);

  const pricing = useMemo(() => {
    if (!listing) return { subtotal: 0, shipping: 0, fee: 0, total: 0 };
    const subtotal = Number(listing.price_per_oz) * oz;
    const shipping = fulfillment === 'shipping' && listing.shipping_price ? Number(listing.shipping_price) : 0;
    const total = subtotal + shipping;
    const fee = subtotal * 0.15;
    return { subtotal, shipping, fee, total };
  }, [listing, oz, fulfillment]);

  const adjustOz = (delta: number) => {
    if (!listing) return;
    const next = Math.max(listing.min_order_oz, Math.min(listing.oz_available, oz + delta));
    setOz(next);
  };

  // Gate: if legal disclosure not yet accepted for this version, show modal first.
  const handlePayPressed = () => {
    if (!user || !donor || !listing) return;
    trackEvent('milk_purchase_start', {
      donor_profile_id: donorProfileId,
      fulfillment_method: fulfillment,
      amount_cents: Math.round(pricing.total * 100),
    });
    if (!legalAccepted) {
      setDisclosureVisible(true);
      return;
    }
    handlePay();
  };

  const handlePay = async () => {
    if (!user || !donor || !listing) return;
    setPaying(true);
    try {
      // 1. Create purchase intent
      const intent = await createPurchaseIntent({
        donor_profile_id: donorProfileId,
        listing_id: listing.id,
        oz,
        fulfillment_method: fulfillment,
        recipient_notes: notes.trim() || undefined,
      });

      // 2. Init PaymentSheet (Connect destination charge requires stripeAccountId in some flows;
      //    we use the platform account since transfer_data routes funds.)
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Villie — Milk Connect',
        paymentIntentClientSecret: intent.client_secret,
        defaultBillingDetails: { name: user.email ?? '' },
      });
      if (initError) throw new Error(initError.message);

      // 3. Present PaymentSheet
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') Alert.alert(t('milkPurchase.paymentFailedTitle'), error.message);
        return;
      }

      // 4. Confirm — sends Twilio SMS to both parties
      await confirmPurchase(intent.transaction_id);

      trackEvent('milk_purchase_payment_success', {
        transaction_id: intent.transaction_id,
        donor_profile_id: donorProfileId,
        amount_cents: intent.total_cents,
        fulfillment_method: fulfillment,
      });
      trackEvent('milk_purchase_confirmed', {
        transaction_id: intent.transaction_id,
        donor_profile_id: donorProfileId,
      });

      navigation.replace('MilkOrderConfirm', {
        transactionId: intent.transaction_id,
        donorProfileId,
        donorDisplayName: donor.display_name,
        oz,
        totalCents: intent.total_cents,
        fulfillmentMethod: fulfillment,
      });
    } catch (e: any) {
      Alert.alert(t('milkPurchase.purchaseFailedTitle'), e.message ?? t('milkPurchase.purchaseFailedBody'));
    } finally {
      setPaying(false);
    }
  };

  if (loading || !donor || !listing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C07840" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('milkPurchase.back')}
        >
          <Text style={styles.back}>{t('milkPurchase.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('milkPurchase.headerTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Donor strip */}
        <View style={styles.donorStrip}>
          <Text style={styles.donorName}>{donor.display_name}</Text>
          <Text style={styles.donorMeta}>
            {donor.city}{donor.state ? `, ${donor.state}` : ''} · ${Number(listing.price_per_oz).toFixed(2)}/oz
          </Text>
        </View>

        {/* Quantity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('milkPurchase.qtyTitle')}</Text>
          <Text style={styles.cardHelp}>{t('milkPurchase.qtyHelp', { min: listing.min_order_oz, max: listing.oz_available })}</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => adjustOz(-4)}
              accessibilityRole="button"
              accessibilityLabel={t('milkPurchase.qtyDecreaseA11y')}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <View
              style={styles.qtyDisplay}
              accessibilityLiveRegion="polite"
              accessibilityLabel={t('milkPurchase.qtyOzA11y', { oz })}
            >
              <Text style={styles.qtyValue}>{oz}</Text>
              <Text style={styles.qtyUnit}>{t('milkPurchase.ozUnit')}</Text>
            </View>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => adjustOz(4)}
              accessibilityRole="button"
              accessibilityLabel={t('milkPurchase.qtyIncreaseA11y')}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fulfillment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('milkPurchase.fulfillmentTitle')}</Text>
          <View style={styles.fulfillRow}>
            {listing.pickup_available && (
              <TouchableOpacity
                style={[styles.fulfillBtn, fulfillment === 'pickup' && styles.fulfillBtnActive]}
                onPress={() => setFulfillment('pickup')}
                accessibilityRole="radio"
                accessibilityState={{ selected: fulfillment === 'pickup' }}
                accessibilityLabel={t('milkPurchase.pickupA11y')}
              >
                <Text style={[styles.fulfillBtnText, fulfillment === 'pickup' && styles.fulfillBtnTextActive]}>
                  {t('milkPurchase.pickupLabel')}
                </Text>
                <Text style={styles.fulfillSub}>{t('milkPurchase.pickupSub')}</Text>
              </TouchableOpacity>
            )}
            {listing.shipping_available && (
              <TouchableOpacity
                style={[styles.fulfillBtn, fulfillment === 'shipping' && styles.fulfillBtnActive]}
                onPress={() => setFulfillment('shipping')}
                accessibilityRole="radio"
                accessibilityState={{ selected: fulfillment === 'shipping' }}
                accessibilityLabel={t('milkPurchase.shippingA11y', { price: Number(listing.shipping_price ?? 0).toFixed(2) })}
              >
                <Text style={[styles.fulfillBtnText, fulfillment === 'shipping' && styles.fulfillBtnTextActive]}>
                  {t('milkPurchase.shippingLabel')}
                </Text>
                <Text style={styles.fulfillSub}>
                  {t('milkPurchase.shippingSubPrice', { price: Number(listing.shipping_price ?? 0).toFixed(2) })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('milkPurchase.notesTitle')}</Text>
          <TextInput
            style={styles.notesInput}
            placeholder={t('milkPurchase.notesPlaceholder')}
            placeholderTextColor="#B5A095"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={300}
          />
        </View>

        {/* Pricing */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceKey}>{t('milkPurchase.priceLine', { oz, rate: Number(listing.price_per_oz).toFixed(2) })}</Text>
            <Text style={styles.priceVal}>${pricing.subtotal.toFixed(2)}</Text>
          </View>
          {pricing.shipping > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceKey}>{t('milkPurchase.priceShipping')}</Text>
              <Text style={styles.priceVal}>${pricing.shipping.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.priceTotal]}>
            <Text style={styles.priceTotalKey}>{t('milkPurchase.priceTotal')}</Text>
            <Text style={styles.priceTotalVal}>${pricing.total.toFixed(2)}</Text>
          </View>
          <Text style={styles.priceFooter}>
            {t('milkPurchase.priceFooter', { donorAmount: (pricing.total - pricing.fee).toFixed(2) })}
          </Text>
        </View>

        {/* Safety */}
        <View style={styles.safetyNote}>
          <Text style={styles.safetyText}>
            {t('milkPurchase.safetyNote')}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky pay bar */}
      <View style={styles.payBar}>
        <PrimaryCTA
          shape="rect"
          label={t('milkPurchase.payButton', { amount: pricing.total.toFixed(2) })}
          onPress={handlePayPressed}
          loading={paying}
          accessibilityLabel={t('milkPurchase.payButtonA11y', { amount: pricing.total.toFixed(2) })}
        />
      </View>

      <LegalDisclosureModal
        visible={disclosureVisible}
        onClose={() => setDisclosureVisible(false)}
        onAccepted={() => {
          setLegalAccepted(true);
          setDisclosureVisible(false);
          // Resume payment flow immediately after acceptance
          setTimeout(() => { void handlePay(); }, 500);
        }}
        documentKey="milk_purchase_disclaimer_v1"
        transactionContext={{
          donor_profile_id: donorProfileId,
          listing_id: listing.id,
          oz,
          fulfillment_method: fulfillment,
        }}
      />
    </View>
  );
}

export default function MilkPurchaseScreen(props: Props) {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <PurchaseContent {...props} />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodyMedium },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },

  scroll: { flex: 1 },

  donorStrip: {
    margin: 16, padding: 16, borderRadius: 12,
    backgroundColor: COLORS.pinkSoft, borderWidth: 1, borderColor: '#F0D9C8',
  },
  donorName: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  donorMeta: { fontSize: 13, color: '#6B5C52', marginTop: 4 },

  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16,
    // v9 paper lift
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#6B2E0E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 18, elevation: 5,
  },
  cardTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 4 },
  cardHelp: { fontSize: 12, color: '#9A8070', marginBottom: 14 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  qtyBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.pinkSoft, borderWidth: 1.5, borderColor: COLORS.coco,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 28, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },
  qtyDisplay: { alignItems: 'center' },
  qtyValue: { fontSize: 36, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  qtyUnit: { fontSize: 12, color: '#9A8070', fontFamily: FONTS.bodyMedium },

  fulfillRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  fulfillBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#F5F0E8', borderWidth: 1.5, borderColor: 'transparent',
  },
  fulfillBtnActive: { backgroundColor: COLORS.pinkSoft, borderColor: COLORS.coco },
  fulfillBtnText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#6B5C52' },
  fulfillBtnTextActive: { color: COLORS.coco },
  fulfillSub: { fontSize: 11, color: '#9A8070', marginTop: 4 },

  notesInput: {
    minHeight: 80, padding: 12, borderRadius: 10,
    backgroundColor: '#F5F0E8', fontSize: 14, color: '#2C1810',
    textAlignVertical: 'top',
  },

  priceCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, gap: 0,
  },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  priceKey: { fontSize: 14, color: '#6B5C52' },
  priceVal: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: '#2C1810' },
  priceTotal: {
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)', marginTop: 6, paddingTop: 12,
  },
  priceTotalKey: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  priceTotalVal: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },
  priceFooter: { fontSize: 11, color: '#9A8070', marginTop: 8, textAlign: 'center' },

  safetyNote: { marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: COLORS.paper, borderRadius: 10 },
  safetyText: { fontSize: 12, color: '#9A8070', textAlign: 'center', lineHeight: 18 },

  payBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)',
  },
  payBtn: {
    backgroundColor: '#C07840', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: '#FDFBF6', fontSize: 17, fontFamily: FONTS.bodySemiBold },
});
