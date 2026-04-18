// Matches v2 prototype specialist card exactly
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '@utils/constants';
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
        <Text style={styles.name}>{specialist.full_name}</Text>
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
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 26 },

  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.textDark, marginBottom: 2 },
  role: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  lang: { fontSize: 11, color: COLORS.olive, fontWeight: '600', marginBottom: 2 },
  avail: { fontSize: 11, color: COLORS.olive, fontWeight: '600' },
  urgent: { color: COLORS.rust },

  right: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  price: { fontSize: 13, fontWeight: '700', color: COLORS.rust },
  bookBtn: {
    backgroundColor: COLORS.rust,
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  bookBtnText: { color: 'white', fontSize: 11, fontWeight: '700' },
});
