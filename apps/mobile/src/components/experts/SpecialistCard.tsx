// SpecialistCard — Concept B "feed row" pattern, adapted for the Experts tab.
// Editorial DNA from /tmp/village-design/the-village/project/Villie -
// Specialist Card Concepts.html: warm cream chrome, uppercase eyebrow, italic
// Playfair hero with terra accent on the key word, bullet-dot meta line,
// terra-bordered credential chips. Mobile collapses the desktop 3-column
// layout (illustration | content | identity) into a stacked feed row that
// keeps the pattern readable on a phone screen.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import type { Specialist, SpecialtyType } from 'shared/src/types/v1';

const SPECIALTY_CONFIG: Record<
  SpecialtyType,
  { emoji: string; bg: string; label: string; eyebrow: string }
> = {
  lactation_consultant: { emoji: '🤱', bg: COLORS.pinkSoft,  label: 'Lactation Consultant', eyebrow: 'FEEDING' },
  doula:                { emoji: '🤝', bg: COLORS.sageSoft,  label: 'Postpartum Doula',     eyebrow: 'MOM SUPPORT' },
  sleep_coach:          { emoji: '😴', bg: COLORS.sandSoft,  label: 'Sleep Coach',          eyebrow: 'SLEEP' },
  pelvic_floor_pt:      { emoji: '🏃‍♀️', bg: COLORS.sandSoft,  label: 'Pelvic Floor PT',     eyebrow: 'RECOVERY' },
  perinatal_dietitian:  { emoji: '🥗', bg: COLORS.pinkSoft,  label: 'Perinatal Dietitian',  eyebrow: 'NUTRITION' },
  ppd_therapist:        { emoji: '🧠', bg: COLORS.sandSoft,  label: 'PPD Therapist',        eyebrow: 'MOM SUPPORT' },
  ob_gyn:               { emoji: '👩‍⚕️', bg: COLORS.pinkSoft,  label: 'OB/GYN',              eyebrow: 'COMFORT & HEALTH' },
  midwife:              { emoji: '🌿', bg: COLORS.sageSoft,  label: 'Midwife',              eyebrow: 'COMFORT & HEALTH' },
  pediatrician:         { emoji: '👶', bg: COLORS.sageSoft,  label: 'Pediatrician',         eyebrow: 'COMFORT & HEALTH' },
};

interface Props {
  specialist: Specialist;
  onPress: () => void;
}

/** Split first/last so the surname can carry the italic terra accent — same
 *  treatment as the design artifact's italic-em on the key word of each row. */
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: fullName, last: '' };
  const first = parts.slice(0, -1).join(' ');
  const last = parts[parts.length - 1];
  return { first, last };
}

/** Pull credential chips out of the free-text `credentials` field. The DB
 *  stores it as a single string ("MD, FAAP" or "IBCLC · RN"); we split on
 *  the common separators and render each token as its own chip. Cap at 3 so
 *  the right column doesn't blow out on long suffix lists. */
function splitCredentials(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,·\/]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function SpecialistCard({ specialist, onPress }: Props) {
  const config = SPECIALTY_CONFIG[specialist.specialty];
  const { first, last } = splitName(specialist.full_name);
  const credChips = splitCredentials(specialist.credentials);
  const distText =
    specialist.distance_miles != null
      ? `${specialist.distance_miles.toFixed(1)} mi`
      : specialist.city ?? null;
  const accepting = specialist.accepting_patients;
  const meta: string[] = [];
  if (distText) meta.push(distText);
  meta.push(accepting ? 'Accepting patients' : 'Waitlist only');
  if (specialist.telehealth_available) meta.push('Virtual');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Eyebrow row — uppercase category + NPI verified badge on the right.
          Mirrors the "FEEDING / MOM SUPPORT / COMFORT & HEALTH" caps row at
          the top of every Concept B card. */}
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{config.eyebrow}</Text>
        {specialist.npi_verified ? (
          <View style={styles.npiBadge}>
            <Text style={styles.npiBadgeText}>✓ NPI</Text>
          </View>
        ) : null}
      </View>

      {/* Hero row — illustration block + italic Playfair name with terra
          accent on the surname (the design's italic-em pattern). */}
      <View style={styles.heroRow}>
        <View style={[styles.illoTile, { backgroundColor: config.bg }]}>
          <Text style={styles.illoEmoji}>{config.emoji}</Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.nameLine}>
            <Text style={styles.nameFirst}>{first}</Text>
            {last ? (
              <>
                {' '}
                <Text style={styles.nameLast}>{last}</Text>
              </>
            ) : null}
          </Text>
          <Text style={styles.role}>{config.label}</Text>
        </View>
      </View>

      {/* Meta row — bullet-dot separated, exactly like the design's
          "2 min · 1M+ searches · P1 priority" line. */}
      <View style={styles.metaRow}>
        {meta.map((token, i) => (
          <React.Fragment key={token}>
            {i > 0 ? <Text style={styles.metaDot}>·</Text> : null}
            <Text
              style={[
                styles.metaText,
                token === 'Waitlist only' && styles.metaUrgent,
              ]}
            >
              {token}
            </Text>
          </React.Fragment>
        ))}
      </View>

      {/* Footer row — credential chips on the left (terra-bordered pills,
          uppercase) + price + Book pill on the right. Mirrors the
          credential-chip + name-and-role identity column from Concept B. */}
      <View style={styles.footerRow}>
        <View style={styles.chipsRow}>
          {credChips.map((c) => (
            <View key={c} style={styles.credChip}>
              <Text style={styles.credChipText}>{c.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        <View style={styles.ctaCol}>
          {specialist.services?.[0]?.price_cents ? (
            <Text style={styles.price}>
              ${Math.round(specialist.services[0].price_cents / 100)}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.bookBtn} onPress={onPress}>
            <Text style={styles.bookBtnText}>Book →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Cream chrome with thin border + soft rounded corners — same recipe as
  // the design artifact's `var(--warm) #FAF5ED` card. We map to ceramic
  // (canonical token) so a future re-theme cascades automatically.
  card: {
    backgroundColor: COLORS.paper,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(173, 121, 91, 0.12)', // coco @ 12%
    shadowColor: COLORS.bark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },

  eyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.barkSoft,
  },
  npiBadge: {
    backgroundColor: COLORS.sageSoft,
    borderRadius: 50,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  npiBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.sage,
    letterSpacing: 0.3,
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 6,
  },
  illoTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  illoEmoji: { fontSize: 22 },
  nameCol: { flex: 1 },
  // Italic Playfair line — first name in body weight, surname in italic
  // terra accent (the design's italic-em pattern).
  nameLine: { fontSize: 18, lineHeight: 22 },
  nameFirst: {
    fontFamily: FONTS.header,
    color: COLORS.bark,
  },
  nameLast: {
    fontFamily: FONTS.headerItalic,
    color: COLORS.coco,
  },
  role: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.textLight,
    marginTop: 2,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.barkSoft,
  },
  metaDot: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  metaUrgent: { color: COLORS.coco, fontFamily: FONTS.bodySemiBold },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.sandSoft,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  // Terra-bordered credential pill — matches the Concept B chip styling
  // (1px terra border, no fill, small uppercase letterspacing).
  credChip: {
    borderWidth: 1,
    borderColor: COLORS.coco,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  credChipText: {
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.coco,
    letterSpacing: 0.6,
  },

  ctaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  price: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bark,
  },
  // v9 canonical CTA — cinnamon (kit canon).
  bookBtn: {
    backgroundColor: '#C07840',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  bookBtnText: {
    color: COLORS.paper,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.3,
  },
});
