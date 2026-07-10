// V6 Milk Vault — listing planner + shipping workflow (marketplace mode only).
//
// Estimate-only / cash-only: no payment is processed. Encodes the fulfillment
// options, the shipping-payment-responsibility split, the supplies checklist,
// and the exact buyer_total / seller_payout math from the spec.

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { V3Card } from '@components/shared/V3Card';
import {
  VaultScreen, VaultHeader, SectionLabel, RadioRow, VaultLegalNote, ScrollView,
} from '@components/milkVault/VaultUI';
import { useMilkVaultStore } from '@store/milkVault';
import { computeShippingSplit, type ShippingResponsibility } from '@utils/milkVaultCalc';
import { VAULT_LEGAL_COPY } from '@utils/milkVaultConstants';
import {
  createListing, upsertShippingKit, isShippingMethod,
  DEFAULT_SHIPPING_SUPPLIES, FULFILLMENT_LABELS, SHIPPING_RESPONSIBILITY_LABELS,
  type FulfillmentMethod, type ShippingSupplyItem,
} from '@api/milkVault';
import { success } from '@utils/haptics';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultListing'>;

const FULFILLMENT_ORDER: FulfillmentMethod[] = [
  'local_pickup', 'local_dropoff', 'ship_to_buyer', 'donate_locally', 'donate_by_shipping',
];
const RESPONSIBILITY_ORDER: ShippingResponsibility[] = [
  'buyer_pays', 'seller_pays', 'split', 'deduct_from_payout',
];

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function MilkVaultListingScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<MilkStackParamList, 'MilkVaultListing'>>();
  const { settings, marketplace, fetchAll } = useMilkVaultStore();

  const availableOz = marketplace?.availableOz ?? 0;
  const defaultOz = route.params?.prefillOunces ?? availableOz;

  const [ounces, setOunces] = useState(defaultOz > 0 ? String(defaultOz) : '');
  const [price, setPrice] = useState((settings?.price_per_oz ?? 2.5).toFixed(2));
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>(
    settings?.default_fulfillment_method ?? 'local_pickup',
  );
  const [responsibility, setResponsibility] = useState<ShippingResponsibility>(
    settings?.default_shipping_payment_responsibility ?? 'buyer_pays',
  );
  const [supplyCost, setSupplyCost] = useState('');
  const [carrierCost, setCarrierCost] = useState('');
  const [bagCount, setBagCount] = useState('');
  const [originZip, setOriginZip] = useState('');
  const [destZip, setDestZip] = useState('');
  const [supplies, setSupplies] = useState<ShippingSupplyItem[]>(
    DEFAULT_SHIPPING_SUPPLIES.map((s) => ({ ...s })),
  );
  const [saving, setSaving] = useState(false);

  const shipping = isShippingMethod(fulfillment);
  const isDonation = fulfillment === 'donate_locally' || fulfillment === 'donate_by_shipping';

  const split = useMemo(
    () => computeShippingSplit({
      availableOz: num(ounces),
      pricePerOz: isDonation ? 0 : num(price),
      supplyCost: shipping ? num(supplyCost) : 0,
      carrierCost: shipping ? num(carrierCost) : 0,
      responsibility: shipping ? responsibility : 'buyer_pays',
    }),
    [ounces, price, supplyCost, carrierCost, responsibility, shipping, isDonation],
  );

  const toggleSupply = (key: string) =>
    setSupplies((prev) => prev.map((s) => (s.key === key ? { ...s, checked: !s.checked } : s)));

  const onSave = async () => {
    const oz = num(ounces);
    if (oz <= 0) { Alert.alert('Add an amount', 'How many ounces are you planning to share?'); return; }
    setSaving(true);
    try {
      const listing = await createListing({
        ounces: oz,
        price_per_oz: isDonation ? 0 : num(price),
        fulfillment_method: fulfillment,
        shipping_payment_responsibility: shipping ? responsibility : null,
        shipping_supply_cost: shipping ? num(supplyCost) : 0,
        estimated_carrier_cost: shipping ? num(carrierCost) : 0,
        milk_subtotal: split.milkSubtotal,
        buyer_total: split.buyerTotal,
        seller_payout: split.sellerPayout,
        status: 'draft',
      });
      if (shipping) {
        await upsertShippingKit({
          listing_id: listing.id,
          supply_items: supplies,
          supply_cost: num(supplyCost),
          origin_zip: originZip.trim() || null,
          destination_zip: destZip.trim() || null,
        });
      }
      await fetchAll();
      success();
      Alert.alert('Listing planned', 'Saved as a draft in your vault. Sharing is always optional.', [
        { text: 'Done', onPress: () => nav.navigate('MilkVaultDashboard') },
      ]);
    } catch (err) {
      console.error('[milkVault] createListing', err);
      Alert.alert('Could not save', 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader eyebrow="Plan a listing" title="Share your extra milk" onBack={() => nav.goBack()} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={12}>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Amount + price */}
            <View style={styles.pad}>
              <View style={styles.twoUp}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Ounces to share</Text>
                  <TextInput style={styles.input} value={ounces} onChangeText={(v) => setOunces(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.genz_clay} />
                  {availableOz > 0 && <Text style={styles.helper}>{availableOz} oz available beyond your reserve</Text>}
                </View>
                {!isDonation && (
                  <View style={{ width: 120 }}>
                    <Text style={styles.label}>Price / oz</Text>
                    <TextInput style={styles.input} value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="2.50" placeholderTextColor={COLORS.genz_clay} />
                  </View>
                )}
              </View>
            </View>

            {/* Fulfillment */}
            <SectionLabel>How will it get there?</SectionLabel>
            {FULFILLMENT_ORDER.map((m) => (
              <RadioRow key={m} label={FULFILLMENT_LABELS[m]} selected={fulfillment === m} onPress={() => setFulfillment(m)} />
            ))}

            {/* Shipping workflow — only when a shipping method is chosen */}
            {shipping && (
              <>
                <SectionLabel>Who pays for shipping supplies and shipping?</SectionLabel>
                {RESPONSIBILITY_ORDER.map((r) => (
                  <RadioRow
                    key={r}
                    label={SHIPPING_RESPONSIBILITY_LABELS[r]}
                    sublabel={r === 'buyer_pays' ? 'Default' : undefined}
                    selected={responsibility === r}
                    onPress={() => setResponsibility(r)}
                  />
                ))}

                <SectionLabel>Shipping supplies checklist</SectionLabel>
                <View style={styles.pad}>
                  {supplies.map((s) => (
                    <TouchableOpacity key={s.key} style={styles.checkRow} onPress={() => toggleSupply(s.key)} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: s.checked }} accessibilityLabel={s.label}>
                      <View style={[styles.checkbox, s.checked && styles.checkboxOn]}>{s.checked ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
                      <Text style={styles.checkLabel}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <SectionLabel>Shipping estimate</SectionLabel>
                <View style={styles.pad}>
                  <View style={styles.twoUp}>
                    <NumField label="Supply cost ($)" value={supplyCost} onChange={setSupplyCost} placeholder="0" />
                    <NumField label="Carrier cost ($)" value={carrierCost} onChange={setCarrierCost} placeholder="0" />
                  </View>
                  <View style={styles.twoUp}>
                    <NumField label="# of bags" value={bagCount} onChange={setBagCount} placeholder="0" />
                    <View style={{ flex: 1 }} />
                  </View>
                  <View style={styles.twoUp}>
                    <TextField label="Origin ZIP" value={originZip} onChange={setOriginZip} placeholder="33101" />
                    <TextField label="Destination ZIP" value={destZip} onChange={setDestZip} placeholder="10001" />
                  </View>
                </View>
              </>
            )}

            {/* Live calc */}
            <SectionLabel>Estimate</SectionLabel>
            <V3Card style={{ marginHorizontal: 16 }} contentStyle={{ padding: 16 }}>
              <CalcLine label={isDonation ? 'Milk value (donation)' : 'Milk subtotal'} value={`$${split.milkSubtotal}`} />
              {shipping && <CalcLine label="Shipping (supplies + carrier)" value={`$${split.shippingCost}`} />}
              <View style={styles.calcDivider} />
              <CalcLine label="Buyer pays" value={`$${split.buyerTotal}`} strong />
              <CalcLine label="Your payout" value={`$${split.sellerPayout}`} strong accent />
              <Text style={styles.calcNote}>Estimate only — Villie does not process this payment.</Text>
            </V3Card>

            <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
              <PrimaryCTA label={saving ? 'Saving…' : 'Save listing plan'} onPress={onSave} loading={saving} />
            </View>

            <VaultLegalNote text={VAULT_LEGAL_COPY} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </VaultScreen>
  );
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={COLORS.genz_clay} />
    </View>
  );
}
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="number-pad" placeholder={placeholder} placeholderTextColor={COLORS.genz_clay} maxLength={10} />
    </View>
  );
}
function CalcLine({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <View style={styles.calcLine}>
      <Text style={[styles.calcLabel, strong && styles.calcLabelStrong]}>{label}</Text>
      <Text style={[styles.calcValue, strong && styles.calcValueStrong, accent && { color: COLORS.genz_rose }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, marginTop: 8 },
  twoUp: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  label: { fontFamily: FONTS.v2_label, fontSize: 13, color: COLORS.genz_chestnut, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.genz_bone, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FONTS.v2_body, fontSize: 15, color: COLORS.genz_chestnut,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.16)',
  },
  helper: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: COLORS.genz_softink, marginTop: 5 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.genz_clay, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: COLORS.genz_rose, borderColor: COLORS.genz_rose },
  checkboxMark: { color: COLORS.genz_bone, fontSize: 13, fontFamily: FONTS.v2_bold },
  checkLabel: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.genz_chestnut },
  calcLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  calcLabel: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.genz_softink },
  calcLabelStrong: { fontFamily: FONTS.v2_label, color: COLORS.genz_chestnut },
  calcValue: { fontFamily: FONTS.v2_label, fontSize: 14, color: COLORS.genz_chestnut },
  calcValueStrong: { fontFamily: FONTS.v2_display_big, fontSize: 18 },
  calcDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,14,0.12)', marginVertical: 8 },
  calcNote: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: COLORS.genz_softink, marginTop: 10 },
});
