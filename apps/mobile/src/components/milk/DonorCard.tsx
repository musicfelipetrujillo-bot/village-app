// DonorCard — Concept B "feed row" pattern, adapted for the Milk donor list.
// Same editorial DNA as SpecialistCard: warm cream chrome, uppercase eyebrow,
// italic Playfair name with terra accent on the surname, bullet-dot meta line,
// terra-bordered badge chip on the footer. Mirrors the design artifact's
// /tmp/village-design/.../Villie - Specialist Card Concepts.html
// Concept B layout collapsed for a phone screen.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import type { DonorSearchResult } from '@api/milk';

const BADGE_COLOR: Record<string, string> = {
  none: COLORS.textLight,
  basic: COLORS.coco,
  verified: COLORS.sage,
  verified_bloodwork: COLORS.statusSuccess,
};

const BADGE_LABEL: Record<string, string> = {
  none: 'No badge',
  basic: 'Basic',
  verified: 'Verified',
  verified_bloodwork: 'Bloodwork',
};

interface Props {
  donor: DonorSearchResult;
  saved?: boolean;
  onPress: () => void;
  onSaveToggle?: () => void;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: fullName, last: '' };
  const first = parts.slice(0, -1).join(' ');
  const last = parts[parts.length - 1];
  return { first, last };
}

export function DonorCard({ donor, saved, onPress, onSaveToggle }: Props) {
  const { first, last } = splitName(donor.display_name);
  const badgeColor = BADGE_COLOR[donor.badge_level] ?? BADGE_COLOR.none;
  const badgeLabel = BADGE_LABEL[donor.badge_level] ?? 'No badge';
  const locText =
    [donor.neighborhood ?? donor.city, donor.state].filter(Boolean).join(', ') ||
    'Near you';

  const meta: { text: string; emphasis?: 'rating' }[] = [];
  meta.push({ text: `${donor.distance_miles.toFixed(1)} mi` });
  meta.push({ text: `${donor.supply_oz_available} oz avail.` });
  if (donor.review_count > 0) {
    meta.push({ text: `★ ${Number(donor.rating_avg).toFixed(1)}`, emphasis: 'rating' });
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Eyebrow row — "MILK DONOR" caps label on left, verified ✓ chip on
          the right when the donor passed bloodwork or full verification. */}
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>MILK DONOR</Text>
        {donor.is_verified ? (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedBadgeText}>✓ VERIFIED</Text>
          </View>
        ) : null}
      </View>

      {/* Hero row — avatar + italic Playfair name with terra accent on the
          surname (the design's italic-em pattern). */}
      <View style={styles.heroRow}>
        <View style={styles.avatarWrap}>
          {donor.avatar_url ? (
            <Image source={{ uri: donor.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {donor.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
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
          <Text style={styles.location} numberOfLines={1}>
            {locText}
          </Text>
        </View>
        {onSaveToggle ? (
          <TouchableOpacity
            onPress={onSaveToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.heartHit}
          >
            <Text style={[styles.heart, saved && styles.heartSaved]}>
              {saved ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Meta row — bullet-dot separated. */}
      <View style={styles.metaRow}>
        {meta.map((token, i) => (
          <React.Fragment key={token.text}>
            {i > 0 ? <Text style={styles.metaDot}>·</Text> : null}
            <Text
              style={[
                styles.metaText,
                token.emphasis === 'rating' && styles.metaRating,
              ]}
            >
              {token.text}
            </Text>
          </React.Fragment>
        ))}
      </View>

      {/* Footer row — badge chip on the left (color-coded by trust tier),
          price on the right. Mirrors Concept B's chip + identity column. */}
      <View style={styles.footerRow}>
        <View style={[styles.badgeChip, { borderColor: badgeColor }]}>
          <Text style={[styles.badgeChipText, { color: badgeColor }]}>
            {badgeLabel.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.price}>${donor.price_per_oz.toFixed(2)}/oz</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // v9 card lift recipe — paper + cocoa drop + rust hairline.
  card: {
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#43260F',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    elevation: 3,
  },

  eyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: '#E27A93',                 // Milk signature: rose-pink eyebrow
  },
  verifiedBadge: {
    backgroundColor: '#F2E6DD',
    borderRadius: 50,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.sage,
    letterSpacing: 0.3,
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    backgroundColor: '#F0D9C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.coco,
  },
  nameCol: { flex: 1 },
  nameLine: { fontSize: 22, lineHeight: 28 },
  nameFirst: {
    fontFamily: FONTS.header,
    color: COLORS.bark,
  },
  nameLast: {
    fontFamily: FONTS.headerItalic,
    color: '#D96C88',                 // v9 italic accent = cinnamon (one per card)
  },
  location: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.textLight,
    marginTop: 2,
  },
  heartHit: { paddingLeft: 6, alignSelf: 'flex-start' },
  heart: { fontSize: 22, color: '#C5B8AE' },
  heartSaved: { color: '#D96C88' },   // v9 saved = cinnamon (action state)

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
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
  metaRating: { color: COLORS.sand, fontFamily: FONTS.bodySemiBold },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.sandSoft,
  },
  badgeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeChipText: {
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.6,
  },
  price: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bark,
  },
});
