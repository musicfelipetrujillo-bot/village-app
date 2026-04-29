import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { FONTS } from '@utils/constants';
import type { DonorSearchResult } from '@api/milk';

const BADGE_COLOR = {
  none: '#9A8070',
  basic: '#D87530',
  verified: '#6B7C3F',
  verified_bloodwork: '#2E7D32',
};

const BADGE_LABEL = {
  none: 'No badge',
  basic: 'Basic',
  verified: 'Verified ✓',
  verified_bloodwork: 'Bloodwork ✓✓',
};

interface Props {
  donor: DonorSearchResult;
  saved?: boolean;
  onPress: () => void;
  onSaveToggle?: () => void;
}

export function DonorCard({ donor, saved, onPress, onSaveToggle }: Props) {
  const badgeColor = BADGE_COLOR[donor.badge_level] ?? BADGE_COLOR.none;
  const badgeLabel = BADGE_LABEL[donor.badge_level] ?? 'No badge';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.row}>
        {/* Avatar */}
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
          {donor.is_verified && (
            <View style={styles.verifiedDot}>
              <Text style={styles.verifiedTick}>✓</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{donor.display_name}</Text>
            {onSaveToggle && (
              <TouchableOpacity
                onPress={onSaveToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.heart, saved && styles.heartSaved]}>
                  {saved ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.badgePill, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
            <Text style={styles.distance}>{donor.distance_miles.toFixed(1)} mi</Text>
          </View>

          <View style={styles.statsRow}>
            <Text style={styles.price}>${donor.price_per_oz.toFixed(2)}/oz</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.supply}>{donor.supply_oz_available} oz avail.</Text>
            {donor.review_count > 0 && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.rating}>★ {Number(donor.rating_avg).toFixed(1)}</Text>
              </>
            )}
          </View>

          <Text style={styles.location} numberOfLines={1}>
            {donor.neighborhood ?? donor.city ?? 'Near you'}
            {donor.state ? `, ${donor.state}` : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: '#F0D9C8', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: '#D87530' },
  verifiedDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#6B7C3F', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFF',
  },
  verifiedTick: { fontSize: 9, color: '#FFF', fontFamily: FONTS.bodySemiBold },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#2C1810', flex: 1, marginRight: 8 },
  heart: { fontSize: 22, color: '#C5B8AE' },
  heartSaved: { color: '#D87530' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#FFF' },
  distance: { fontSize: 12, color: '#9A8070', fontFamily: FONTS.bodyMedium },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  price: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#D87530' },
  dot: { color: '#C5B8AE', fontSize: 12 },
  supply: { fontSize: 13, color: '#6B5C52' },
  rating: { fontSize: 13, color: '#C4A35A', fontFamily: FONTS.bodySemiBold },
  location: { fontSize: 12, color: '#9A8070' },
});
