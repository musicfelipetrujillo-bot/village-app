// V4 Phase G2 — Events list (local meetups + webinars)
// Entry point from HomeScreen "Events near you" card.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { COLORS, FONTS } from '@utils/constants';
import { getEffectiveCoords } from '@utils/devLocation';
import { useEventsStore } from '@store/events';
import { formatDistance, type EventCard, type EventType, type AgeTag } from '@api/events';
import { EventCardSkeleton } from '@components/shared/SkeletonLoader';
import { useT } from '@/i18n';

type TFn = (key: string, params?: Record<string, string | number>) => string;

const TYPE_FILTER_KEYS: { key: EventType | 'all'; labelKey: string }[] = [
  { key: 'all',     labelKey: 'eventsList.filterAll' },
  { key: 'local',   labelKey: 'eventsList.filterLocal' },
  { key: 'webinar', labelKey: 'eventsList.filterWebinars' },
];

const AGE_FILTER_KEYS: { key: AgeTag; labelKey: string }[] = [
  { key: 'pregnancy', labelKey: 'eventsList.agePregnancy' },
  { key: '0-3mo',     labelKey: 'eventsList.age0to3' },
  { key: '3-6mo',     labelKey: 'eventsList.age3to6' },
  { key: '6-12mo',    labelKey: 'eventsList.age6to12' },
  { key: '12mo+',     labelKey: 'eventsList.age12plus' },
];

export default function EventsListScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { upcoming, loading, fetchUpcoming } = useEventsStore();
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');
  const [ageFilter, setAgeFilter] = useState<AgeTag | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // One-shot location request — non-blocking, events still load without it.
  // In dev (Simulator) we skip the GPS read entirely and seed Miami so
  // distance-sorted events match the launch market.
  useEffect(() => {
    (async () => {
      let deviceCoords: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== 'granted') {
            // No permission — still seed Miami via the helper in dev.
            const fallback = getEffectiveCoords(null);
            if (__DEV__) setCoords(fallback);
            return;
          }
        }
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) deviceCoords = pos.coords;
      } catch {
        /* location denied or unavailable — helper falls through */
      }
      const { lat, lng } = getEffectiveCoords(deviceCoords);
      setCoords({ lat, lng });
    })();
  }, []);

  // Re-fetch when filters or coords change
  useEffect(() => {
    fetchUpcoming({
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      type: typeFilter === 'all' ? null : typeFilter,
      ageTags: ageFilter ? [ageFilter] : null,
    });
  }, [typeFilter, ageFilter, coords, fetchUpcoming]);

  const onRefresh = useCallback(() => {
    fetchUpcoming({
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      type: typeFilter === 'all' ? null : typeFilter,
      ageTags: ageFilter ? [ageFilter] : null,
    });
  }, [typeFilter, ageFilter, coords, fetchUpcoming]);

  const data = useMemo(() => upcoming, [upcoming]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('eventsList.backA11y')}>
          <Text style={styles.back}>{t('eventsList.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('eventsList.title')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MyRsvps')} accessibilityLabel={t('eventsList.mineA11y')}>
          <Text style={styles.headerLink}>{t('eventsList.mine')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.masthead}>
        <View style={styles.mastheadEyebrowRow}>
          <View style={styles.mastheadAccentBar} />
          <Text style={styles.mastheadEyebrow}>{t('eventsList.mastheadEyebrow')}</Text>
        </View>
        <Text style={styles.mastheadTitle}>{t('eventsList.mastheadTitle')}</Text>
        <Text style={styles.mastheadSub}>{t('eventsList.mastheadSub')}</Text>
      </View>

      <View style={styles.filterRow}>
        {TYPE_FILTER_KEYS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.typeChip, typeFilter === f.key && styles.typeChipActive]}
            onPress={() => setTypeFilter(f.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: typeFilter === f.key }}
          >
            <Text style={[styles.typeChipText, typeFilter === f.key && styles.typeChipTextActive]}>
              {t(f.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.ageRow}>
        {AGE_FILTER_KEYS.map((f) => {
          const active = ageFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.ageChip, active && styles.ageChipActive]}
              onPress={() => setAgeFilter(active ? null : f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.ageChipText, active && styles.ageChipTextActive]}>{t(f.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && data.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <EventCardSkeleton />
          <EventCardSkeleton />
        </View>
      ) : (
        <FlashList
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => (
            <EventCardView
              event={item}
              onPress={() => navigation.navigate('EventDetail', { id: item.id })}
              t={t}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('eventsList.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('eventsList.emptyBody')}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.rust} />}
        />
      )}
    </View>
  );
}

function EventCardView({ event, onPress, t }: { event: EventCard; onPress: () => void; t: TFn }) {
  const start = new Date(event.starts_at);
  const whenShort = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isWebinar = event.type === 'webinar';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardBadge}>{isWebinar ? t('eventsList.badgeWebinar') : t('eventsList.badgeLocal')}</Text>
        {event.is_partner && <Text style={styles.cardPartner}>{t('eventsList.partner')}</Text>}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
      <Text style={styles.cardHost}>{t('eventsList.hostPrefix', { host: event.host_name })}</Text>
      <Text style={styles.cardWhen}>{whenShort} · {timeStr}</Text>
      <View style={styles.cardFooter}>
        {isWebinar ? (
          <Text style={styles.cardMeta}>{event.platform?.toUpperCase() ?? t('eventsList.platformOnline')}</Text>
        ) : (
          <Text style={styles.cardMeta}>
            {event.venue_name}{event.distance_km != null ? ` · ${formatDistance(event.distance_km)}` : ''}
          </Text>
        )}
        {event.capacity != null && (
          <Text style={styles.cardCapacity}>{event.going_count}/{event.capacity}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },
  headerLink: { fontSize: 14, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },

  // Editorial masthead — bridges the small functional header bar and the
  // chip filter rows. Same accent-bar + uppercase eyebrow + Playfair italic
  // signature used on Home / Me so the page reads as part of the magazine
  // spread rather than a list view.
  masthead: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
  },
  mastheadEyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
  },
  mastheadAccentBar: {
    width: 12, height: 2, backgroundColor: COLORS.rust,
    marginRight: 8, borderRadius: 1,
  },
  mastheadEyebrow: {
    fontSize: 11, lineHeight: 16, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.textMid, textTransform: 'uppercase',
  },
  mastheadTitle: {
    fontSize: 28, lineHeight: 34,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.brownDeep, marginBottom: 4,
  },
  mastheadSub: {
    fontSize: 13, lineHeight: 19, color: COLORS.textMid,
    fontFamily: FONTS.body, maxWidth: 340,
  },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: '#FFF',
  },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#FFF',
  },
  typeChipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  typeChipText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid },
  typeChipTextActive: { color: '#FFF' },

  ageRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  ageChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: COLORS.cream,
  },
  ageChipActive: { backgroundColor: COLORS.rustLight },
  ageChipText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid },
  ageChipTextActive: { color: '#FFF' },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBadge: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.rustDark, textTransform: 'uppercase' },
  cardPartner: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.8, color: COLORS.olive,
    backgroundColor: 'rgba(92,107,58,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  cardTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 8 },
  cardHost: { fontSize: 13, color: COLORS.textMid, marginTop: 2, fontFamily: FONTS.body },
  cardWhen: { fontSize: 13, color: COLORS.brownDeep, fontFamily: FONTS.bodySemiBold, marginTop: 8 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6,
  },
  cardMeta: { fontSize: 12, color: COLORS.textLight, flex: 1, fontFamily: FONTS.body },
  cardCapacity: { fontSize: 12, color: COLORS.textMid, fontFamily: FONTS.bodySemiBold },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 4 },
  emptyBody: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', fontFamily: FONTS.body },
});
