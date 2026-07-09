import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMilkStore } from '@store/milk';
import { createListing, updateDonorProfile, getStripeConnectUrl } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

// Legacy Stripe Connect donor onboarding is gated behind this flag (default OFF).
// In cash-only mode a new listing just activates the donor profile — no Stripe detour.
const MILK_STRIPE_ENABLED = process.env.EXPO_PUBLIC_MILK_STRIPE_ENABLED === '1';

type Props = NativeStackScreenProps<MilkStackParamList, 'CreateListing'>;

export default function CreateListingScreen({ route, navigation }: Props) {
  const { donorProfileId } = route.params;
  const { setMyListings, myListings, donorProfile, setDonorProfile } = useMilkStore();
  const t = useT();

  const [ozAvailable, setOzAvailable] = useState('');
  const [pricePerOz, setPricePerOz] = useState('1.00');
  const [minOrderOz, setMinOrderOz] = useState('4');
  const [pickupAvailable, setPickupAvailable] = useState(true);
  const [shippingAvailable, setShippingAvailable] = useState(false);
  const [shippingPrice, setShippingPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const totalEstimate = parseFloat(pricePerOz || '0') * parseFloat(ozAvailable || '0');

  const handleSave = async () => {
    const oz = parseInt(ozAvailable, 10);
    const price = parseFloat(pricePerOz);
    const minOz = parseInt(minOrderOz, 10);

    if (!oz || oz <= 0) { Alert.alert(t('createListing.errOz')); return; }
    if (!price || price <= 0) { Alert.alert(t('createListing.errPrice')); return; }

    setSaving(true);
    try {
      const listing = await createListing({
        donor_profile_id: donorProfileId,
        oz_available: oz,
        price_per_oz: price,
        min_order_oz: minOz || 4,
        pickup_available: pickupAvailable,
        shipping_available: shippingAvailable,
        shipping_price: shippingAvailable ? parseFloat(shippingPrice || '0') : undefined,
        notes: notes.trim() || undefined,
      });

      // Update donor profile supply
      if (donorProfile) {
        const updated = await updateDonorProfile(donorProfileId, {
          price_per_oz: price,
          supply_oz_available: oz,
        });
        setDonorProfile(updated);
      }

      setMyListings([listing, ...myListings]);

      // Cash-only (default): activate the listing and return home. The legacy Stripe
      // Connect onboarding detour only applies when EXPO_PUBLIC_MILK_STRIPE_ENABLED is on.
      if (MILK_STRIPE_ENABLED && !donorProfile?.stripe_onboarding_complete) {
        navigation.replace('StripeOnboarding', { donorProfileId });
      } else {
        // Activate profile
        if (donorProfile) {
          const activated = await updateDonorProfile(donorProfileId, { is_active: true });
          setDonorProfile(activated);
        }
        navigation.replace('MilkHome');
      }
    } catch (err) {
      console.error('CreateListing error:', err);
      Alert.alert(t('createListing.errorTitle'), t('createListing.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('createListing.title')}</Text>
        <Text style={styles.subtitle}>{t('createListing.subtitle')}</Text>

        {/* oz available */}
        <Text style={styles.label}>{t('createListing.ozLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('createListing.ozPlaceholder')}
          value={ozAvailable}
          onChangeText={setOzAvailable}
          keyboardType="numeric"
          placeholderTextColor="#7A4A24"
        />

        {/* Price per oz */}
        <Text style={styles.label}>{t('createListing.priceLabel')}</Text>
        <View style={styles.dollarRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={[styles.input, styles.dollarInput]}
            value={pricePerOz}
            onChangeText={setPricePerOz}
            keyboardType="decimal-pad"
            placeholderTextColor="#7A4A24"
          />
        </View>
        {!!ozAvailable && !!pricePerOz && (
          <Text style={styles.estimate}>
            {t('createListing.estimate')}<Text style={styles.estimateNum}>{t('createListing.estimateAmount', { amount: totalEstimate.toFixed(2) })}</Text>
          </Text>
        )}

        {/* Min order */}
        <Text style={styles.label}>{t('createListing.minOrderLabel')}</Text>
        <TextInput
          style={styles.input}
          value={minOrderOz}
          onChangeText={setMinOrderOz}
          keyboardType="numeric"
          placeholderTextColor="#7A4A24"
        />

        {/* Pickup / Shipping */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>{t('createListing.pickupLabel')}</Text>
            <Text style={styles.toggleSub}>{t('createListing.pickupSub')}</Text>
          </View>
          <Switch
            value={pickupAvailable}
            onValueChange={setPickupAvailable}
            trackColor={{ false: '#E0D5C5', true: COLORS.coco }}
            thumbColor='#FFFCF6'
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>{t('createListing.shippingLabel')}</Text>
            <Text style={styles.toggleSub}>{t('createListing.shippingSub')}</Text>
          </View>
          <Switch
            value={shippingAvailable}
            onValueChange={setShippingAvailable}
            trackColor={{ false: '#E0D5C5', true: COLORS.coco }}
            thumbColor='#FFFCF6'
          />
        </View>

        {shippingAvailable && (
          <>
            <Text style={styles.label}>{t('createListing.shippingPriceLabel')}</Text>
            <View style={styles.dollarRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={[styles.input, styles.dollarInput]}
                placeholder={t('createListing.shippingPricePlaceholder')}
                value={shippingPrice}
                onChangeText={setShippingPrice}
                keyboardType="decimal-pad"
                placeholderTextColor="#7A4A24"
              />
            </View>
          </>
        )}

        {/* Notes */}
        <Text style={styles.label}>{t('createListing.notesLabel')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={t('createListing.notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          placeholderTextColor="#7A4A24"
          textAlignVertical="top"
        />

        {/* Platform fee note */}
        <View style={styles.feeNote}>
          <Text style={styles.feeNoteText}>{t('createListing.feeNote')}</Text>
        </View>

        {/* Next step preview */}
        <View style={styles.nextStepCard}>
          <Text style={styles.nextStepTitle}>{t('createListing.nextStepTitle')}</Text>
          <Text style={styles.nextStepBody}>{t('createListing.nextStepBody')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('createListing.saving') : t('createListing.saveCta')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 140 },
  title: { fontSize: 28, fontFamily: FONTS.headerBold, color: '#43260F', marginBottom: 8, letterSpacing: -0.4, lineHeight: 34 },
  subtitle: { fontSize: 14, color: '#7A4A24', lineHeight: 21, marginBottom: 28, fontFamily: FONTS.body },
  label: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: COLORS.paper, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 16, color: '#43260F',
    borderWidth: 1.5, borderColor: '#E0D5C5', fontFamily: FONTS.body,
  },
  dollarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dollarSign: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: '#7A4A24' },
  dollarInput: { flex: 1 },
  estimate: { fontSize: 13, color: '#7A4A24', marginTop: 6, fontFamily: FONTS.body },
  estimateNum: { color: '#E98A6A', fontFamily: FONTS.bodySemiBold },
  multiline: { height: 100, paddingTop: 12 },
  // v9 card lift — soft drop so toggle rows read as discrete switches.
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.paper, borderRadius: 12, padding: 16, marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#43260F', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 1,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#43260F' },
  toggleSub: { fontSize: 12, color: '#7A4A24', marginTop: 2, fontFamily: FONTS.body },
  // v9: side-stripe border was a v9 absolute ban — rewritten as full hairline
  // border + warm cream fill so the fee note still reads as a callout box.
  feeNote: {
    marginTop: 24, backgroundColor: '#FFF9F0', borderRadius: 10,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(192,120,64,0.30)',
  },
  feeNoteText: { fontSize: 13, color: '#7A4A24', lineHeight: 19, fontFamily: FONTS.body },
  nextStepCard: {
    marginTop: 16, backgroundColor: '#F2E6DD', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: '#F2E6DD',
  },
  nextStepTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#43260F', marginBottom: 6 },
  nextStepBody: { fontSize: 13, color: '#7A4A24', lineHeight: 19, fontFamily: FONTS.body },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 36,
    backgroundColor: '#F5F0E8', borderTopWidth: 1, borderTopColor: '#E8E0D5',
  },
  // v9 canonical CTA
  saveBtn: {
    backgroundColor: '#D96C88', borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#D96C88', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  saveBtnText: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#FFFCF6', letterSpacing: 0.3 },
  disabled: { opacity: 0.4 },
});
