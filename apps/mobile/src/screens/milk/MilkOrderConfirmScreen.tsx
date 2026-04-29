// V2 M3 — MilkOrderConfirmScreen
// Animated success after milk purchase. Shows pickup address (revealed via SMS + here).
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getTransactionAddress, getOrCreateThread, type DonorPickupAddress } from '@api/milk';
import { useAuthStore } from '@store/auth';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkOrderConfirm'>;

export default function MilkOrderConfirmScreen({ navigation, route }: Props) {
  const { transactionId, donorProfileId, donorDisplayName, oz, totalCents, fulfillmentMethod } = route.params;
  const user = useAuthStore((s) => s.user);
  const t = useT();

  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [address, setAddress] = useState<DonorPickupAddress | null>(null);
  const [loading, setLoading] = useState(fulfillmentMethod === 'pickup');

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    if (fulfillmentMethod === 'pickup') {
      getTransactionAddress(transactionId)
        .then(setAddress)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [transactionId, fulfillmentMethod]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale }] }]}>
          <Text style={styles.checkMark}>✓</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
          <Text style={styles.title}>{t('milkOrderConfirm.title')}</Text>
          <Text style={styles.subtitle}>
            {t('milkOrderConfirm.subtitle', { name: donorDisplayName })}
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.row}>
              <Text style={styles.key}>{t('milkOrderConfirm.donorLabel')}</Text>
              <Text style={styles.val}>{donorDisplayName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.key}>{t('milkOrderConfirm.qtyLabel')}</Text>
              <Text style={styles.val}>{t('milkOrderConfirm.qtyValue', { oz })}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.key}>{t('milkOrderConfirm.methodLabel')}</Text>
              <Text style={styles.val}>
                {fulfillmentMethod === 'pickup' ? t('milkOrderConfirm.methodPickup') : t('milkOrderConfirm.methodShipping')}
              </Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalKey}>{t('milkOrderConfirm.totalLabel')}</Text>
              <Text style={styles.totalVal}>${(totalCents / 100).toFixed(2)}</Text>
            </View>
          </View>

          {fulfillmentMethod === 'pickup' && (
            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>{t('milkOrderConfirm.pickupCardLabel')}</Text>
              {loading ? (
                <ActivityIndicator color={COLORS.rust} style={{ marginVertical: 12 }} />
              ) : address ? (
                <>
                  {address.donor_address_line && (
                    <Text style={styles.addressLine}>{address.donor_address_line}</Text>
                  )}
                  <Text style={styles.addressLine}>
                    {[address.donor_city, address.donor_state, address.donor_zip].filter(Boolean).join(', ')}
                  </Text>
                  {address.donor_phone && (
                    <Text style={styles.addressPhone}>📞 {address.donor_phone}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.addressFallback}>
                  {t('milkOrderConfirm.pickupFallback')}
                </Text>
              )}
            </View>
          )}

          {fulfillmentMethod === 'shipping' && (
            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>{t('milkOrderConfirm.shippingCardLabel')}</Text>
              <Text style={styles.addressFallback}>
                {t('milkOrderConfirm.shippingNote', { name: donorDisplayName })}
              </Text>
            </View>
          )}

          <View style={styles.smsBanner}>
            <Text style={styles.smsBannerText}>
              {t('milkOrderConfirm.smsBanner')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={async () => {
            if (!user) return;
            try {
              const thread = await getOrCreateThread(donorProfileId, user.id);
              navigation.navigate('MilkMessageDetail', {
                threadId: thread.id,
                donorProfileId,
                otherDisplayName: donorDisplayName,
              });
            } catch (e) {
              console.error(e);
            }
          }}
        >
          <Text style={styles.primaryBtnText}>{t('milkOrderConfirm.messageBtn', { firstName: donorDisplayName.split(' ')[0] })}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.secondaryBtnText}>{t('milkOrderConfirm.backToHome')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  content: { padding: 24, paddingTop: 80, paddingBottom: 200, alignItems: 'center' },

  checkCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#6B7C3F',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  checkMark: { fontSize: 48, color: '#FFF', fontFamily: FONTS.bodySemiBold },

  title: { fontSize: 26, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6B5C52', textAlign: 'center', marginBottom: 28 },

  summaryCard: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  key: { fontSize: 13, color: '#9A8070' },
  val: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: '#2C1810' },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', marginTop: 4, paddingTop: 12 },
  totalKey: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  totalVal: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: '#D87530' },

  addressCard: {
    width: '100%', backgroundColor: '#FFF5F0', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#F0D9C8', marginBottom: 12,
  },
  addressLabel: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#D87530', marginBottom: 8 },
  addressLine: { fontSize: 15, color: '#2C1810', fontFamily: FONTS.bodyMedium, lineHeight: 22 },
  addressPhone: { fontSize: 14, color: '#2C1810', marginTop: 8, fontFamily: FONTS.bodyMedium },
  addressFallback: { fontSize: 13, color: '#6B5C52', lineHeight: 19 },

  smsBanner: {
    width: '100%', backgroundColor: '#FFF', padding: 12, borderRadius: 10,
    alignItems: 'center', marginTop: 6,
  },
  smsBannerText: { fontSize: 12, color: '#9A8070', fontFamily: FONTS.bodyMedium },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#D87530', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontFamily: FONTS.bodySemiBold },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, color: '#9A8070', fontFamily: FONTS.bodyMedium },
});
