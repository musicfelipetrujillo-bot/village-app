// V1 Phase 4 — Booking: service selector + date/time picker
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { cardLift, cardLiftBorder } from '@utils/cardLift';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import { useExpertsStore } from '@store/experts';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';
import type { SpecialistService } from 'shared/src/types/v1';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'Booking'>;

// Time slots by day of week (0=Sun, 6=Sat)
const SLOT_MAP: Record<number, string[]> = {
  1: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'],
  2: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'],
  3: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'],
  4: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'],
  5: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'],
  6: ['9:00 AM', '10:00 AM', '11:00 AM'],
};

const MONTH_KEYS = [
  'bookingScreen.monthJanuary','bookingScreen.monthFebruary','bookingScreen.monthMarch','bookingScreen.monthApril',
  'bookingScreen.monthMay','bookingScreen.monthJune','bookingScreen.monthJuly','bookingScreen.monthAugust',
  'bookingScreen.monthSeptember','bookingScreen.monthOctober','bookingScreen.monthNovember','bookingScreen.monthDecember',
];
const DAY_KEYS = [
  'bookingScreen.daySu','bookingScreen.dayMo','bookingScreen.dayTu','bookingScreen.dayWe',
  'bookingScreen.dayTh','bookingScreen.dayFr','bookingScreen.daySa',
];

function slotToISOString(date: Date, slot: string): string {
  const [timePart, ampm] = slot.split(' ');
  let [hour, minute] = timePart.split(':').map(Number);
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function formatPrice(service: SpecialistService, t: (k: string, p?: Record<string, string|number>) => string): string {
  if (!service.price_cents) return t('bookingScreen.priceFree');
  const amount = Math.round(service.price_cents / 100);
  if (service.duration_min) return t('bookingScreen.priceWithDuration', { amount, duration: service.duration_min });
  return t('bookingScreen.priceAmount', { amount });
}

export default function BookingScreen({ navigation, route }: Props) {
  const t = useT();
  const { specialistId } = route.params;
  const { selectedSpecialist: spec, selectSpecialist, loading } = useExpertsStore();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedService, setSelectedService] = useState<SpecialistService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isTelehealth, setIsTelehealth] = useState(false);

  useEffect(() => {
    if (!spec || spec.id !== specialistId) selectSpecialist(specialistId);
  }, [specialistId]);

  useEffect(() => {
    if (spec?.services?.length) setSelectedService(spec.services[0]);
  }, [spec]);

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [viewMonth]);

  const timeSlots = selectedDate ? (SLOT_MAP[selectedDate.getDay()] ?? []) : [];

  const canContinue = selectedService && selectedDate && selectedSlot;

  // Double-tap guard. useState batching can let two taps both pass the check
  // before a re-render lands; useRef flips synchronously so the second tap
  // bails out cleanly. Reset on screen focus so backing out from Payment
  // re-arms the CTA.
  const pressedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      pressedRef.current = false;
    }, []),
  );

  const handleContinue = () => {
    if (pressedRef.current) return;
    if (!spec || !selectedService || !selectedDate || !selectedSlot) return;
    pressedRef.current = true;
    const appointmentAt = slotToISOString(selectedDate, selectedSlot);
    const amountCents = selectedService.price_cents ?? 0;

    if (amountCents > 0) {
      navigation.navigate('Payment', {
        specialistId: spec.id,
        serviceName: selectedService.service_name,
        amountCents,
        appointmentAt,
        isTelehealth,
        specialistName: spec.full_name,
        telehealth_link: spec.telehealth_link ?? undefined,
      });
    } else {
      navigation.navigate('BookingConfirm', {
        specialistId: spec.id,
        specialistName: spec.full_name,
        serviceName: selectedService.service_name,
        appointmentAt,
        isTelehealth,
        telehealth_link: spec.telehealth_link ?? undefined,
        amountCents: 0,
      });
    }
  };

  if (loading || !spec) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#D96C88" />
      </View>
    );
  }

  const prevMonth = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  const isDateDisabled = (date: Date) => {
    if (date < today) return true;                      // past
    if (date.getDay() === 0) return true;               // Sunday
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 60);
    return date > maxDate;
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      {/* v9 editorial header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('bookingScreen.back')}</Text>
        </TouchableOpacity>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrow}>{t('bookingScreen.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>
          {t('bookingScreen.titleLead')} <Text style={styles.titleEm}>{t('bookingScreen.titleEm')}</Text>
        </Text>
        <Text style={styles.providerName}>{spec.full_name}</Text>
        <View style={styles.headerRule} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Service selector */}
        {(spec.services ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('bookingScreen.selectService')}</Text>
            <View style={styles.serviceList}>
              {spec.services!.map((svc) => (
                <TouchableOpacity
                  key={svc.id}
                  style={[styles.serviceCard, selectedService?.id === svc.id && styles.serviceCardActive]}
                  onPress={() => setSelectedService(svc)}
                >
                  <Text style={[styles.serviceName, selectedService?.id === svc.id && styles.serviceNameActive]}>
                    {svc.service_name}
                  </Text>
                  <Text style={[styles.servicePrice, selectedService?.id === svc.id && styles.servicePriceActive]}>
                    {formatPrice(svc, t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Telehealth toggle */}
        {spec.telehealth_available && (
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('bookingScreen.telehealthLabel')}</Text>
              <TouchableOpacity
                style={[styles.toggle, isTelehealth && styles.toggleOn]}
                onPress={() => setIsTelehealth(!isTelehealth)}
              >
                <View style={[styles.toggleThumb, isTelehealth && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Calendar */}
        <View style={styles.section}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calTitle}>
              {t(MONTH_KEYS[viewMonth.getMonth()])} {viewMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dayLabels}>
            {DAY_KEYS.map((k) => (
              <Text key={k} style={styles.dayLabel}>{t(k)}</Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {calendarDays.map((date, i) => {
              if (!date) return <View key={`empty-${i}`} style={styles.calCell} />;
              const disabled = isDateDisabled(date);
              const selected = selectedDate?.toDateString() === date.toDateString();
              return (
                <TouchableOpacity
                  key={date.toISOString()}
                  style={[
                    styles.calCell,
                    selected && styles.calCellSelected,
                    disabled && styles.calCellDisabled,
                  ]}
                  onPress={() => {
                    if (!disabled) {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }
                  }}
                  disabled={disabled}
                >
                  <Text style={[
                    styles.calCellText,
                    selected && styles.calCellTextSelected,
                    disabled && styles.calCellTextDisabled,
                  ]}>
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time slots */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {t('bookingScreen.availableTimes', { date: selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) })}
            </Text>
            {timeSlots.length === 0 ? (
              <Text style={styles.noSlots}>{t('bookingScreen.noSlotsSunday')}</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {timeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotBtn, selectedSlot === slot && styles.slotBtnActive]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextActive]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Spacer for sticky button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        {selectedService && (
          <Text style={styles.ctaSummary}>
            {selectedService.service_name}
            {selectedSlot && selectedDate
              ? t('bookingScreen.summarySeparator', { date: selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), slot: selectedSlot })
              : ''}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.ctaBtn, !canContinue && styles.ctaBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          accessibilityLabel={selectedService?.price_cents ? t('bookingScreen.ctaContinueA11y', { amount: Math.round(selectedService.price_cents / 100) }) : t('bookingScreen.ctaConfirmFreeA11y')}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
        >
          <Text style={styles.ctaBtnText}>
            {selectedService?.price_cents
              ? t('bookingScreen.ctaContinue', { amount: Math.round(selectedService.price_cents / 100) })
              : t('bookingScreen.ctaBookFree')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodyMedium },
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
  titleEm: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#D96C88' },
  providerName: { fontSize: 14, color: COLORS.barkSoft, marginTop: 2, fontFamily: FONTS.body },
  headerRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 10, width: 48,
  },

  content: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },

  // Booking form section — paper-lifted v3 surface (was flat per blend audit).
  section: {
    backgroundColor: COLORS.v2_card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...cardLiftBorder,
    ...cardLift,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  serviceList: { gap: 8 },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 80, 50, 0.18)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    // v9 paper lift — cocoa drop matching every other v9 surface
    shadowColor: '#43260F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 3,
  },
  serviceCardActive: { borderColor: COLORS.coco, backgroundColor: '#FEF5F1' },
  serviceName: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: COLORS.bark, flex: 1 },
  serviceNameActive: { color: COLORS.coco },
  servicePrice: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },
  servicePriceActive: { color: COLORS.coco },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 14, color: COLORS.bark, fontFamily: FONTS.bodyMedium },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: COLORS.coco },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.paper,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { padding: 8 },
  calNavText: { fontSize: 22, color: COLORS.bark, fontFamily: FONTS.body },
  calTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  dayLabels: { flexDirection: 'row' },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.textLight,
    paddingVertical: 4,
  },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellSelected: {
    backgroundColor: '#D96C88',
    borderRadius: 999,
  },
  calCellDisabled: {},
  calCellText: { fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.bark },
  calCellTextSelected: { color: '#FFFCF6', fontFamily: FONTS.bodySemiBold },
  calCellTextDisabled: { color: 'rgba(0,0,0,0.2)' },

  noSlots: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingVertical: 8, fontFamily: FONTS.body },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(150,80,50,0.18)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  slotBtnActive: { borderColor: COLORS.coco, backgroundColor: '#FEF5F1' },
  slotText: { fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.bark },
  slotTextActive: { color: COLORS.coco },

  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.paper,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    gap: 8,
  },
  ctaSummary: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.bodyMedium, textAlign: 'center' },
  ctaBtn: {
    backgroundColor: '#D96C88',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnDisabled: { opacity: 0.35 },
  ctaBtnText: { color: '#FFFCF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
});
