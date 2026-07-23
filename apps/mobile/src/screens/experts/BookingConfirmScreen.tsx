// V1 Phase 4 — Booking confirmation / success state
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { success } from '@utils/haptics';
import { useT } from '@/i18n';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'BookingConfirm'>;

export default function BookingConfirmScreen({ navigation, route }: Props) {
  const t = useT();
  const { specialistName, serviceName, appointmentAt, isTelehealth, telehealth_link, amountCents } = route.params;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const appointmentDate = new Date(appointmentAt);

  useEffect(() => {
    success();
    // Entrance animation: pop in the check mark, then fade in the details
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDone = () => {
    navigation.popToTop();
  };

  const handleTelehealth = () => {
    if (telehealth_link) Linking.openURL(telehealth_link);
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.content}>
        {/* Animated check */}
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.checkEmoji}>✓</Text>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fadeAnim }]}>
          <Text style={styles.headline}>{t('bookingConfirm.headline')}</Text>
          <Text style={styles.sub}>{t('bookingConfirm.sub')}</Text>
        </Animated.View>

        {/* Appointment card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>👩‍⚕️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardProvider}>{specialistName}</Text>
              <Text style={styles.cardService}>{serviceName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('bookingConfirm.rowDate')}</Text>
            <Text style={styles.detailVal}>
              {appointmentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('bookingConfirm.rowTime')}</Text>
            <Text style={styles.detailVal}>
              {appointmentDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('bookingConfirm.rowType')}</Text>
            <Text style={styles.detailVal}>
              {isTelehealth ? t('bookingConfirm.typeTelehealth') : t('bookingConfirm.typeInPerson')}
            </Text>
          </View>

          {amountCents > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('bookingConfirm.rowPaid')}</Text>
              <Text style={[styles.detailVal, { color: COLORS.sage }]}>
                ${Math.round(amountCents / 100)}.00
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Telehealth join button */}
        {isTelehealth && telehealth_link && (
          <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
            <TouchableOpacity style={styles.telehealthBtn} onPress={handleTelehealth}>
              <Text style={styles.telehealthBtnText}>{t('bookingConfirm.joinTelehealth')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Info note */}
        <Animated.Text style={[styles.note, { opacity: fadeAnim }]}>
          {t('bookingConfirm.note')}
        </Animated.Text>
      </View>

      {/* Done button */}
      <View style={styles.ctaBar}>
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>{t('bookingConfirm.done')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 72,
    gap: 20,
  },

  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  checkEmoji: { color: '#FFFCF6', fontSize: 42, fontFamily: FONTS.bodySemiBold, lineHeight: 50 },

  textBlock: { alignItems: 'center', gap: 6 },
  headline: {
    fontFamily: FONTS.headerItalic,
    fontSize: 28,
    color: COLORS.bark,
    textAlign: 'center',
  },
  sub: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', fontFamily: FONTS.body },

  card: {
    backgroundColor: COLORS.paper,
    borderRadius: 18,
    padding: 18,
    width: '100%',
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
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  cardIcon: { fontSize: 32 },
  cardProvider: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  cardService: { fontSize: 13, color: COLORS.textLight, marginTop: 2, fontFamily: FONTS.body },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginBottom: 12 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: { fontSize: 14, color: COLORS.textLight, fontFamily: FONTS.body },
  detailVal: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: COLORS.bark, maxWidth: '55%', textAlign: 'right' },

  telehealthBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.coco,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
  },
  telehealthBtnText: { color: '#E84B79', fontSize: 15, fontFamily: FONTS.bodySemiBold },

  note: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    fontFamily: FONTS.body,
  },

  ctaBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  doneBtn: {
    backgroundColor: '#E84B79',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFFCF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
});
