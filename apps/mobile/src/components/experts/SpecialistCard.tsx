// Matches v2 prototype specialist card exactly
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import type { Specialist, SpecialtyType } from 'shared/src/types/v1';

const SPECIALTY_CONFIG: Record<SpecialtyType, { emoji: string; bg: string; label: string }> = {
  lactation_consultant: { emoji: '🤱', bg: '#FDEEE8', label: 'Lactation Consultant' },
  doula:                { emoji: '🤝', bg: '#EEF2E6', label: 'Postpartum Doula' },
  sleep_coach:          { emoji: '😴', bg: '#F7F0E0', label: 'Sleep Coach' },
  pelvic_floor_pt:      { emoji: '🏃‍♀️', bg: '#EEF0FF', label: 'Pelvic Floor PT' },
  perinatal_dietitian:  { emoji: '🥗', bg: '#FDEEE8', label: 'Perinatal Dietitian' },
  ppd_therapist:        { emoji: '🧠', bg: '#F7F0E0', label: 'PPD Therapist' },
  ob_gyn:               { emoji: '👩‍⚕️', bg: '#FDEEE8', label: 'OB/GYN' },
  midwife:              { emoji: '🌿', bg: '#EEF2E6', label: 'Midwife' },
  pediatrician:         { emoji: '👶', bg: '#EEF0FF', label: 'Pediatrician' },
};

interface Props {
  specialist: Specialist;
  onPress: () => void;
}

export function SpecialistCard({ specialist, onPress }: Props) {
  const config = SPECIALTY_CONFIG[specialist.specialty];
  const langLabel = specialist.languages?.map((l) => l.toUpperCase()).join(' · ');
  const distText = specialist.distance_miles != null
    ? `${specialist.distance_miles.toFixed(1)} mi away`
    : specialist.city ?? '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Icon */}
      <View style={[styles.icon, { backgroundColor: config.bg }]}>
        <Text style={styles.iconEmoji}>{config.emoji}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{specialist.full_name}</Text>
          {specialist.npi_verified && (
            <View style={styles.npiBadge}>
              <Text style={styles.npiBadgeText}>✓ NPI</Text>
            </View>
          )}
        </View>
        <Text style={styles.role}>{config.label} · {distText}</Text>
        {langLabel ? <Text style={styles.lang}>🌐 {langLabel}</Text> : null}
        <Text style={[styles.avail, !specialist.accepting_patients && styles.urgent]}>
          {specialist.accepting_patients ? 'Accepting patients' : 'Waitlist only'}
          {specialist.telehealth_available ? ' · Virtual available' : ''}
        </Text>
      </View>

      {/* Price + Book */}
      <View style={styles.right}>
        {specialist.services?.[0]?.price_cents ? (
          <Text style={styles.price}>
            ${Math.round(specialist.services[0].price_cents / 100)}/session
          </Text>
        ) : null}
        <TouchableOpacity style={styles.bookBtn} onPress={onPress}>
          <Text style={styles.bookBtnText}>Book</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // More vertical breathing room — was 16/2-margin rows, now 18/6 so each
  // line in the info column has space to read instead of stacking tight.
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 28 },

  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  name: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.textDark },
  npiBadge: {
    backgroundColor: '#EEF2E6',
    borderRadius: 50,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  npiBadgeText: { fontSize: 9, fontFamily: FONTS.bodySemiBold, color: COLORS.olive, letterSpacing: 0.3 },
  role: { fontSize: 12, color: COLORS.textLight, marginBottom: 6, fontFamily: FONTS.body, lineHeight: 16 },
  lang: { fontSize: 11, color: COLORS.olive, fontFamily: FONTS.bodyMedium, marginBottom: 6, lineHeight: 15 },
  avail: { fontSize: 11, color: COLORS.olive, fontFamily: FONTS.bodyMedium, lineHeight: 15 },
  urgent: { color: COLORS.rust },

  right: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  price: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.rust },
  bookBtn: {
    backgroundColor: COLORS.yolkLight,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bookBtnText: { color: COLORS.brownDeep, fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
