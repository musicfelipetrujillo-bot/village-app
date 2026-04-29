// V2 M5 — MilkShippingLabelScreen
// Donor-side flow to buy a USPS priority label via Shippo for a paid shipping order.
// Pre-fills from_address from donor profile, to_address from transaction's pickup RPC
// (reuses get_transaction_pickup_address which returns donor address cols; for a
// shipping order the recipient supplied their address at purchase time and it is
// read from milk_transactions.recipient_address).
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import {
  buyShippoLabel, getShippingLabel, getMyDonorProfile,
  type MilkShippingLabel, type ShippoAddress, type ShippoParcel,
} from '@api/milk';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@store/auth';
import { useAnalytics } from '@hooks/useAnalytics';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkShippingLabel'>;

const DEFAULT_PARCEL: ShippoParcel = {
  length: '10', width: '8', height: '6',
  distance_unit: 'in',
  weight: '32',       // 32 oz placeholder — donor adjusts
  mass_unit: 'oz',
};

interface RecipientAddress {
  name: string; line: string; city: string; state: string; zip: string;
  phone?: string; email?: string;
}

export default function MilkShippingLabelScreen({ navigation, route }: Props) {
  const { transactionId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { trackEvent } = useAnalytics();
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [existing, setExisting] = useState<MilkShippingLabel | null>(null);

  const [from, setFrom] = useState<ShippoAddress | null>(null);
  const [to, setTo] = useState<ShippoAddress | null>(null);
  const [weightOz, setWeightOz] = useState(DEFAULT_PARCEL.weight);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user) throw new Error(t('milkShippingLabel.notSignedIn'));

        // 1. If a label already exists, short-circuit
        const label = await getShippingLabel(transactionId);
        if (mounted && label) {
          setExisting(label);
          setLoading(false);
          return;
        }

        // 2. Donor (from) address from profile
        const donor = await getMyDonorProfile(user.id);
        if (!donor) throw new Error(t('milkShippingLabel.donorNotFound'));

        // 3. Recipient (to) address from the transaction row
        const { data: tx, error: txErr } = await supabase
          .from('milk_transactions')
          .select('recipient_address_line, recipient_city, recipient_state, recipient_zip, recipient_user_id, oz_purchased')
          .eq('id', transactionId)
          .single();
        if (txErr) throw txErr;
        const txRow = tx as {
          recipient_address_line: string | null;
          recipient_city: string | null;
          recipient_state: string | null;
          recipient_zip: string | null;
          recipient_user_id: string;
          oz_purchased: number;
        } | null;

        if (!mounted) return;

        setFrom({
          name: donor.display_name,
          street1: (donor as unknown as { address_line?: string }).address_line ?? '',
          city: donor.city ?? '',
          state: donor.state ?? '',
          zip: donor.zip_code ?? '',
          country: 'US',
          phone: (donor as unknown as { phone?: string }).phone,
        });
        setTo({
          name: t('milkShippingLabel.recipientFallback'),
          street1: txRow?.recipient_address_line ?? '',
          city: txRow?.recipient_city ?? '',
          state: txRow?.recipient_state ?? '',
          zip: txRow?.recipient_zip ?? '',
          country: 'US',
        });

        // Rough heuristic: ~1 oz of frozen milk ≈ 1.1 oz weight; assume oz_purchased is fluid oz
        const oz = Number(txRow?.oz_purchased ?? 32);
        setWeightOz(String(Math.max(16, Math.round(oz * 1.1))));
      } catch (err) {
        Alert.alert(t('milkShippingLabel.loadFailedTitle'), err instanceof Error ? err.message : t('milkShippingLabel.loadFailedBody'));
        navigation.goBack();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [transactionId, user, navigation, t]);

  const missingFields = () => {
    const check = (a: ShippoAddress | null) =>
      !a || !a.street1 || !a.city || !a.state || !a.zip;
    return check(from) || check(to);
  };

  const handleBuy = async () => {
    if (!from || !to) return;
    if (missingFields()) {
      Alert.alert(t('milkShippingLabel.addressIncompleteTitle'), t('milkShippingLabel.addressIncompleteBody'));
      return;
    }
    setPurchasing(true);
    try {
      const parcel: ShippoParcel = { ...DEFAULT_PARCEL, weight: weightOz };
      const { label, already } = await buyShippoLabel({
        transaction_id: transactionId,
        from_address: from,
        to_address: to,
        parcel,
      });
      trackEvent('milk_shipping_label_purchased', {
        transaction_id: transactionId,
        amount_cents: label.rate_cents ?? undefined,
      });
      setExisting(label);
      if (already) {
        Alert.alert(t('milkShippingLabel.alreadyPurchasedTitle'), t('milkShippingLabel.alreadyPurchasedBody'));
      }
    } catch (err) {
      Alert.alert(t('milkShippingLabel.purchaseFailedTitle'), err instanceof Error ? err.message : t('milkShippingLabel.purchaseFailedBody'));
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.rust} />
      </View>
    );
  }

  if (existing) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('milkShippingLabel.back')}>
            <Text style={styles.backLabel}>{t('milkShippingLabel.backLabel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('milkShippingLabel.readyTitle')}</Text>
          <Text style={styles.sub}>{t('milkShippingLabel.readySub')}</Text>

          <View style={styles.card}>
            <Text style={styles.cardRow}><Text style={styles.cardKey}>{t('milkShippingLabel.carrierLabel')}</Text>{existing.carrier?.toUpperCase() ?? 'USPS'}</Text>
            <Text style={styles.cardRow}><Text style={styles.cardKey}>{t('milkShippingLabel.serviceLabel')}</Text>{existing.service_level ?? t('milkShippingLabel.dash')}</Text>
            <Text style={styles.cardRow}>
              <Text style={styles.cardKey}>{t('milkShippingLabel.rateLabel')}</Text>
              {existing.rate_cents != null ? `$${(existing.rate_cents / 100).toFixed(2)}` : t('milkShippingLabel.dash')}
            </Text>
            <Text style={styles.cardRow}><Text style={styles.cardKey}>{t('milkShippingLabel.trackingLabel')}</Text>{existing.tracking_number ?? t('milkShippingLabel.dash')}</Text>
          </View>

          {existing.label_url && (
            <TouchableOpacity
              style={styles.cta}
              onPress={() => Linking.openURL(existing.label_url!)}
              accessibilityLabel={t('milkShippingLabel.openLabelA11y')}
              accessibilityRole="button"
            >
              <Text style={styles.ctaLabel}>{t('milkShippingLabel.openLabelCta')}</Text>
            </TouchableOpacity>
          )}
          {existing.tracking_url && (
            <TouchableOpacity
              style={[styles.cta, styles.ctaSecondary]}
              onPress={() => Linking.openURL(existing.tracking_url!)}
              accessibilityRole="button"
              accessibilityLabel={t('milkShippingLabel.viewTrackingCta')}
            >
              <Text style={[styles.ctaLabel, styles.ctaLabelSecondary]}>{t('milkShippingLabel.viewTrackingCta')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('milkShippingLabel.back')}>
          <Text style={styles.backLabel}>{t('milkShippingLabel.backLabel')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('milkShippingLabel.title')}</Text>
        <Text style={styles.sub}>
          {t('milkShippingLabel.intro')}
        </Text>

        <Text style={styles.section}>{t('milkShippingLabel.fromSection')}</Text>
        <AddressInput value={from} onChange={setFrom} />

        <Text style={styles.section}>{t('milkShippingLabel.toSection')}</Text>
        <AddressInput value={to} onChange={setTo} />

        <Text style={styles.section}>{t('milkShippingLabel.weightSection')}</Text>
        <TextInput
          value={weightOz}
          onChangeText={setWeightOz}
          keyboardType="numeric"
          style={styles.input}
          accessibilityLabel={t('milkShippingLabel.weightA11y')}
        />

        <View style={styles.noteBox}>
          <Text style={styles.noteBody}>
            {t('milkShippingLabel.disclaimer')}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          disabled={purchasing || missingFields()}
          onPress={handleBuy}
          style={[styles.cta, (purchasing || missingFields()) && styles.ctaDisabled]}
          accessibilityLabel={t('milkShippingLabel.buyA11y')}
          accessibilityRole="button"
          accessibilityState={{ disabled: purchasing || missingFields(), busy: purchasing }}
        >
          {purchasing
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.ctaLabel}>{t('milkShippingLabel.buyCta')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddressInput({
  value, onChange,
}: {
  value: ShippoAddress | null;
  onChange: (a: ShippoAddress) => void;
}) {
  const t = useT();
  const v = value ?? {
    name: '', street1: '', city: '', state: '', zip: '', country: 'US',
  };
  const patch = (part: Partial<ShippoAddress>) => onChange({ ...v, ...part });
  return (
    <View style={styles.addressGroup}>
      <TextInput
        style={styles.input} placeholder={t('milkShippingLabel.addrName')} placeholderTextColor={COLORS.textLight}
        value={v.name} onChangeText={(name) => patch({ name })}
      />
      <TextInput
        style={styles.input} placeholder={t('milkShippingLabel.addrStreet')} placeholderTextColor={COLORS.textLight}
        value={v.street1} onChangeText={(street1) => patch({ street1 })}
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 2, marginRight: 8 }]} placeholder={t('milkShippingLabel.addrCity')} placeholderTextColor={COLORS.textLight}
          value={v.city} onChangeText={(city) => patch({ city })}
        />
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder={t('milkShippingLabel.addrState')} placeholderTextColor={COLORS.textLight}
          value={v.state} onChangeText={(state) => patch({ state: state.toUpperCase().slice(0, 2) })}
          maxLength={2}
        />
        <TextInput
          style={[styles.input, { flex: 1.2 }]} placeholder={t('milkShippingLabel.addrZip')} placeholderTextColor={COLORS.textLight}
          value={v.zip} onChangeText={(zip) => patch({ zip })}
          keyboardType="numeric" maxLength={10}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backLabel: { color: COLORS.rust, fontSize: 15, fontFamily: FONTS.bodyMedium },
  title: { fontSize: 28, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 8 },
  sub: { fontSize: 14, color: COLORS.textMid, lineHeight: 21, marginBottom: 20 },
  section: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 14, marginBottom: 8 },
  addressGroup: { gap: 8 },
  row: { flexDirection: 'row' },
  input: {
    backgroundColor: COLORS.cardBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textDark, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  cardRow: { fontSize: 14, color: COLORS.textDark, marginBottom: 6 },
  cardKey: { color: COLORS.textMid, fontFamily: FONTS.bodyMedium },
  noteBox: {
    marginTop: 20, padding: 14, borderRadius: 10,
    backgroundColor: 'rgba(196,163,90,0.12)', borderWidth: 1, borderColor: 'rgba(196,163,90,0.4)',
  },
  noteBody: { fontSize: 12, color: COLORS.textMid, lineHeight: 18 },
  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', backgroundColor: COLORS.cream,
  },
  cta: {
    backgroundColor: COLORS.rust, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  ctaSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.rust },
  ctaDisabled: { backgroundColor: COLORS.textLight, opacity: 0.7 },
  ctaLabel: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bodySemiBold },
  ctaLabelSecondary: { color: COLORS.rust },
});
