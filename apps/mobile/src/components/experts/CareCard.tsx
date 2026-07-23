// CareCard — compact provider row for the two-tier Care directory (matches the
// approved care_directory mockup): avatar · name + trust badge · role/meta ·
// price. Used for both clinical (NPI-verified) and help (background-checked)
// tiers. Distinct from the editorial SpecialistCard used on the legacy screen.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { FONTS } from '@utils/constants';
import type { Specialist } from 'shared/src/types/v1';

const ROLE_LABEL: Record<string, string> = {
  ob_gyn: 'OB/GYN', midwife: 'Midwife', doula: 'Doula',
  lactation_consultant: 'Lactation consultant', pediatrician: 'Pediatrician',
  sleep_coach: 'Sleep coach', pelvic_floor_pt: 'Pelvic floor PT',
  perinatal_dietitian: 'Dietitian', ppd_therapist: 'PPD therapist',
  night_nurse: 'Night nurse', postpartum_doula: 'Postpartum doula',
  nanny: 'Nanny', mothers_helper: "Mother's helper", babysitter: 'Babysitter',
};
const AV = [['#F3B9C8', '#8A3A54'], ['#FBE0A6', '#8A6A1E'], ['#D7E4C4', '#5B6B37'], ['#C9DCE4', '#4E6A7C']];

export function CareCard({ specialist, index, onPress }: { specialist: Specialist; index: number; onPress: () => void }) {
  const isHelp = specialist.provider_kind === 'help';
  const [bg, fg] = AV[index % AV.length];
  const role = ROLE_LABEL[specialist.specialty] ?? specialist.credentials;
  const place = specialist.city ?? null;
  const dist = specialist.distance_miles != null ? `${specialist.distance_miles.toFixed(1)} mi` : null;
  const meta = [place, dist, specialist.review_count > 0 ? `★ ${specialist.rating_avg.toFixed(1)}` : null].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress} accessibilityRole="button" accessibilityLabel={specialist.full_name}>
      {specialist.photo_url ? (
        <Image source={{ uri: specialist.photo_url }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontFamily: FONTS.v2_bold, fontSize: 16, color: fg }}>{specialist.full_name.charAt(0)}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{specialist.full_name}</Text>
          {isHelp
            ? (specialist.background_checked ? <View style={styles.checkedBadge}><Text style={styles.checkedText}>🛡 checked</Text></View> : null)
            : (specialist.npi_verified ? <Text style={styles.npiTick}>✓</Text> : null)}
        </View>
        <Text style={styles.role} numberOfLines={1}>{role}</Text>
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <View style={styles.right}>
        {isHelp && specialist.hourly_rate_cents ? (
          <><Text style={styles.price}>${Math.round(specialist.hourly_rate_cents / 100)}</Text><Text style={styles.priceUnit}>/hr</Text></>
        ) : (
          <Text style={styles.chev}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FDF7EC', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.1)', borderRadius: 16, padding: 13 },
  avatar: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontFamily: FONTS.v2_bold, fontSize: 15, color: '#3D2116', flexShrink: 1 },
  npiTick: { fontSize: 13, color: '#7B8A46', fontFamily: FONTS.v2_bold },
  checkedBadge: { backgroundColor: '#FDECEF', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  checkedText: { fontFamily: FONTS.v2_mono, fontSize: 8.5, color: '#B0234F', fontWeight: '600' },
  role: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: '#8A6A55', marginTop: 2 },
  meta: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 0.6, color: '#A6957F', marginTop: 3, textTransform: 'uppercase' },
  right: { flexDirection: 'row', alignItems: 'baseline' },
  price: { fontFamily: FONTS.v2_display_big, fontSize: 17, color: '#3D2116' },
  priceUnit: { fontFamily: FONTS.v2_body, fontSize: 11, color: '#8A6A55' },
  chev: { fontSize: 20, color: '#C9B79F' },
});
