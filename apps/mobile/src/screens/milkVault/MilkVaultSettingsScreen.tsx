// V6 Milk Vault — settings.
//
// Mode switch (personal ↔ marketplace), average daily intake, stash goal,
// desired reserve, and (marketplace) pricing + fulfillment defaults.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import {
  VaultScreen, VaultHeader, SectionLabel, RadioRow, ScrollView,
} from '@components/milkVault/VaultUI';
import { useMilkVaultStore } from '@store/milkVault';
import {
  updateSettings,
  FULFILLMENT_LABELS, SHIPPING_RESPONSIBILITY_LABELS,
  type FulfillmentMethod, type ShippingResponsibility,
} from '@api/milkVault';
import { success } from '@utils/haptics';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultSettings'>;

const FULFILLMENT_ORDER: FulfillmentMethod[] = [
  'local_pickup', 'local_dropoff', 'ship_to_buyer', 'donate_locally', 'donate_by_shipping',
];
const RESPONSIBILITY_ORDER: ShippingResponsibility[] = [
  'buyer_pays', 'seller_pays', 'split', 'deduct_from_payout',
];

function n(v: string, fallback: number): number {
  const x = parseFloat(v);
  return Number.isFinite(x) && x >= 0 ? x : fallback;
}

export default function MilkVaultSettingsScreen() {
  const nav = useNavigation<Nav>();
  const { settings, setSettings } = useMilkVaultStore();

  const [intake, setIntake] = useState(String(settings?.average_daily_intake_oz ?? 24));
  const [goalDays, setGoalDays] = useState(String(settings?.stash_goal_days ?? 30));
  const [reserveDays, setReserveDays] = useState(String(settings?.desired_reserve_days ?? 30));
  const [price, setPrice] = useState((settings?.price_per_oz ?? 2.5).toFixed(2));
  const [lowPrice, setLowPrice] = useState((settings?.low_price_per_oz ?? 1.5).toFixed(2));
  const [premPrice, setPremPrice] = useState((settings?.premium_price_per_oz ?? 3.5).toFixed(2));
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>(settings?.default_fulfillment_method ?? 'local_pickup');
  const [responsibility, setResponsibility] = useState<ShippingResponsibility>(settings?.default_shipping_payment_responsibility ?? 'buyer_pays');
  const [saving, setSaving] = useState(false);

  const isMarketplace = settings?.mode === 'marketplace';

  const onSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSettings({
        average_daily_intake_oz: n(intake, 24),
        stash_goal_days: Math.round(n(goalDays, 30)),
        desired_reserve_days: Math.round(n(reserveDays, 30)),
        price_per_oz: n(price, 2.5),
        low_price_per_oz: n(lowPrice, 1.5),
        premium_price_per_oz: n(premPrice, 3.5),
        default_fulfillment_method: fulfillment,
        default_shipping_payment_responsibility: responsibility,
      });
      setSettings(updated);
      success();
      nav.goBack();
    } catch (err) {
      console.error('[milkVault] saveSettings', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader eyebrow="Milk Vault" title="Settings" onBack={() => nav.goBack()} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={12}>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Mode */}
            <SectionLabel>Mode</SectionLabel>
            <TouchableOpacity
              style={styles.modeRow}
              onPress={() => nav.navigate('MilkVaultModePicker', { switching: true })}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.modeValue}>{isMarketplace ? 'Marketplace' : 'Personal stash'}</Text>
                <Text style={styles.modeSub}>
                  {isMarketplace
                    ? 'Tracking your stash + planning to share extra milk'
                    : "Tracking milk for your baby's freezer stash"}
                </Text>
              </View>
              <Text style={styles.modeChevron}>Switch ›</Text>
            </TouchableOpacity>

            {/* Coverage */}
            <SectionLabel>Coverage</SectionLabel>
            <View style={styles.pad}>
              <NumField label="Average daily intake (oz/day)" value={intake} onChange={setIntake} />
              <NumField label="Stash goal (days)" value={goalDays} onChange={setGoalDays} />
              <NumField label="Desired reserve (days)" value={reserveDays} onChange={setReserveDays} />
            </View>

            {/* Pricing (marketplace only) */}
            {isMarketplace && (
              <>
                <SectionLabel>Pricing</SectionLabel>
                <View style={styles.pad}>
                  <View style={styles.twoUp}>
                    <NumField label="Low ($/oz)" value={lowPrice} onChange={setLowPrice} />
                    <NumField label="Typical ($/oz)" value={price} onChange={setPrice} />
                    <NumField label="Premium ($/oz)" value={premPrice} onChange={setPremPrice} />
                  </View>
                </View>

                <SectionLabel>Default fulfillment</SectionLabel>
                {FULFILLMENT_ORDER.map((m) => (
                  <RadioRow key={m} label={FULFILLMENT_LABELS[m]} selected={fulfillment === m} onPress={() => setFulfillment(m)} />
                ))}

                <SectionLabel>Default shipping payment</SectionLabel>
                {RESPONSIBILITY_ORDER.map((r) => (
                  <RadioRow key={r} label={SHIPPING_RESPONSIBILITY_LABELS[r]} selected={responsibility === r} onPress={() => setResponsibility(r)} />
                ))}
              </>
            )}

            <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
              <PrimaryCTA label={saving ? 'Saving…' : 'Save settings'} onPress={onSave} loading={saving} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </VaultScreen>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholderTextColor={COLORS.genz_clay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, marginTop: 8 },
  twoUp: { flexDirection: 'row', gap: 10 },
  label: { fontFamily: FONTS.v2_label, fontSize: 13, color: COLORS.genz_chestnut, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.genz_bone, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FONTS.v2_body, fontSize: 15, color: COLORS.genz_chestnut,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.16)',
  },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, padding: 16,
    backgroundColor: COLORS.genz_bone, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
  },
  modeValue: { fontFamily: FONTS.v2_bold, fontSize: 16, color: COLORS.genz_chestnut },
  modeSub: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: COLORS.genz_softink, marginTop: 2 },
  modeChevron: { fontFamily: FONTS.v2_link, fontSize: 14, color: COLORS.genz_berry },
});
