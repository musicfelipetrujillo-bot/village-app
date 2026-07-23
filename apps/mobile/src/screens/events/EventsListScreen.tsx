// V4 Phase G2 — Events list (local meetups + webinars)
// Entry point from HomeScreen "Events near you" card.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { COLORS, FONTS } from '@utils/constants';
import { cardLift, cardLiftBorder } from '@utils/cardLift';
import { getEffectiveCoords } from '@utils/devLocation';
import { useEventsStore } from '@store/events';
import { formatDistance, type EventCard, type EventType, type AgeTag } from '@api/events';
import { EventCardSkeleton } from '@components/shared/SkeletonLoader';
import { KenBurnsImage } from '@components/shared/KenBurnsImage';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { HoneycombBackdrop } from '@components/shared/HoneycombBackdrop';
import { HubHeader } from '@components/shared/HubHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { upcoming, loading, fetchUpcoming, savedIds, fetchSavedIds, toggleSave } = useEventsStore();
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

  // Load which events the user has already saved (for the ♡ fill state).
  useEffect(() => {
    fetchSavedIds();
  }, [fetchSavedIds]);

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
      <V9PageBackdrop />
      {/* Ambient warm wash — soft blush→honey so the page isn't flat cream. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.34)', 'rgba(250,208,128,0.14)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      {/* Canonical shared header — matches Milk / Care / Gear exactly. */}
      <View style={{ paddingTop: insets.top + 6 }}>
        <HubHeader
          name="plans"
          dotColor="#EFB2C8"
          onBack={() => navigation.goBack()}
          backAccessibilityLabel={t('eventsList.backA11y')}
          right={
            <View style={styles.headerLinks}>
              <TouchableOpacity onPress={() => navigation.navigate('SavedEvents')} accessibilityLabel={t('eventsList.savedA11y')}>
                <Text style={styles.headerLink}>{t('eventsList.saved')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('MyRsvps')} accessibilityLabel={t('eventsList.mineA11y')}>
                <Text style={styles.headerLink}>{t('eventsList.mine')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
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
        <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
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
              isSaved={savedIds.has(item.id)}
              onToggleSave={() => toggleSave(item.id)}
              t={t}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('eventsList.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('eventsList.emptyBody')}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.coco} />}
        />
      )}
    </View>
  );
}

export function EventCardView({ event, onPress, isSaved, onToggleSave, t }: {
  event: EventCard;
  onPress: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  t: TFn;
}) {
  const start = new Date(event.starts_at);
  const whenShort = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isWebinar = event.type === 'webinar';

  // Concept B feed-row pattern — eyebrow + italic Playfair title + bullet-dot
  // meta + footer chips. Mirrors SpecialistCard / DonorCard / PerkCardView.
  const meta: string[] = [`${whenShort} · ${timeStr}`];
  if (isWebinar) {
    meta.push(event.platform?.toUpperCase() ?? t('eventsList.platformOnline'));
  } else if (event.venue_name) {
    meta.push(event.venue_name);
  }
  if (!isWebinar && event.distance_km != null) {
    meta.push(formatDistance(event.distance_km));
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      {/* Eyebrow row — type badge + partner pill */}
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.cardBadge, isWebinar ? styles.cardBadgeWebinar : styles.cardBadgeLocal]}>
          {isWebinar ? t('eventsList.badgeWebinar') : t('eventsList.badgeLocal')}
        </Text>
        {event.is_partner && <Text style={styles.cardPartner}>{t('eventsList.partner')}</Text>}
      </View>
      {/* Italic Playfair title — the editorial hero. */}
      <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
      <Text style={styles.cardHost}>{t('eventsList.hostPrefix', { host: event.host_name })}</Text>
      {/* Meta row — bullet-dot separated. */}
      <View style={styles.metaRow}>
        {meta.map((token, i) => (
          <React.Fragment key={`${token}-${i}`}>
            {i > 0 ? <Text style={styles.metaDot}>·</Text> : null}
            <Text style={styles.metaText}>{token}</Text>
          </React.Fragment>
        ))}
      </View>
      {/* Footer row — capacity chip + arrow CTA */}
      <View style={styles.cardFooter}>
        {event.capacity != null ? (
          <View style={styles.capacityChip}>
            <Text style={styles.capacityChipText}>
              {event.going_count}/{event.capacity}
            </Text>
          </View>
        ) : event.going_count > 0 ? (
          <View style={styles.capacityChip}>
            <Text style={styles.capacityChipText}>{t('eventDetail.goingCount', { count: event.going_count })}</Text>
          </View>
        ) : <View />}
        <View style={styles.footerRight}>
          {onToggleSave && (
            <TouchableOpacity
              onPress={onToggleSave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? t('eventsList.unsaveA11y') : t('eventsList.saveA11y')}
              accessibilityState={{ selected: !!isSaved }}
            >
              <Text style={[styles.heart, isSaved && styles.heartOn]}>{isSaved ? '♥' : '♡'}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.arrow}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerLink: { fontSize: 14, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heart: { fontSize: 20, color: '#C9A9B0', lineHeight: 22 },
  heartOn: { color: '#E84B79' },

  // Magazine-cover hero — full-bleed photo dominates the top of the page.
  // Matches Specialists / Milk / Gear hero pattern so the four verticals
  // share a consistent editorial entry beat.
  heroHeader: {
    height: 340,
    position: 'relative',
    backgroundColor: COLORS.bark,
    overflow: 'hidden',
  },
  heroHeaderImage: { width: '100%', height: '100%' },
  heroHeaderScrimTop: {
    position: 'absolute', left: 0, right: 0, top: 0, height: '40%',
    backgroundColor: 'transparent',
  },
  heroHeaderScrimMid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,26,14,0.20)',
  },
  heroHeaderScrimBottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
    backgroundColor: 'transparent',
  },
  heroCopy: {
    position: 'absolute',
    left: 22, right: 22, bottom: 28,
  },
  heroEyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  heroEyebrowBar: {
    width: 22, height: 2, backgroundColor: COLORS.cream,
    marginRight: 10, borderRadius: 1, opacity: 0.85,
  },
  heroEyebrowText: {
    fontSize: 11, lineHeight: 16, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFCF6',
    textTransform: 'uppercase',
    opacity: 0.92,
  },
  heroTitle: {
    fontSize: 36, lineHeight: 42,
    fontFamily: FONTS.v3_display,
    color: '#FFFCF6',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  heroTitleItalic: {
    fontFamily: FONTS.v3_display_italic,
    color: COLORS.v2_salmon,
    fontStyle: 'italic',
  },
  heroSub: {
    fontSize: 14, lineHeight: 20,
    fontFamily: FONTS.body,
    color: '#FFFCF6',
    opacity: 0.92,
    maxWidth: 320,
  },

  // Honeycomb masthead (dark-on-cream, matches the other three sections).
  plansMasthead: {
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18,
    position: 'relative', overflow: 'hidden',
  },
  plansEyebrowBar: {
    width: 16, height: 1.5, backgroundColor: COLORS.v2_walnut, marginRight: 8,
  },
  plansEyebrowText: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500', color: COLORS.v2_walnut,
  },
  plansTitle: {
    marginTop: 6, fontFamily: FONTS.v3_display, fontSize: 34, lineHeight: 38,
    color: COLORS.v2_cocoa, letterSpacing: -0.9,
  },
  plansTitleItalic: {
    fontFamily: FONTS.v3_display_italic, color: '#CB5480', fontStyle: 'italic', // Events signature: berry rose
  },
  plansDeck: {
    marginTop: 10, fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: COLORS.v2_walnut, maxWidth: 320,
  },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 18, paddingTop: 12,
    backgroundColor: 'transparent',
  },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: COLORS.v2_parchment,
  },
  typeChipActive: { backgroundColor: COLORS.coco, borderColor: COLORS.coco },
  typeChipText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  typeChipTextActive: { color: '#FFFCF6' },

  ageRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  ageChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(247,197,203,0.30)',
  },
  ageChipActive: { backgroundColor: COLORS.cocoSoft },
  ageChipText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  ageChipTextActive: { color: '#FFFCF6' },

  // Event card — paper-lifted v3 surface (was flat per blend audit). Matches
  // DailyCheckinStrip on Home + V3Card across the app.
  card: {
    backgroundColor: COLORS.v2_card,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...cardLiftBorder,
    ...cardLift,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardBadge: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4, textTransform: 'uppercase',
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden',
  },
  cardBadgeLocal: { backgroundColor: 'rgba(203,84,128,0.12)', color: '#CB5480' },
  cardBadgeWebinar: { backgroundColor: 'rgba(181,129,28,0.16)', color: '#9A6B12' },
  cardPartner: {
    fontSize: 9, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6, color: COLORS.sage,
    backgroundColor: 'rgba(92,107,58,0.1)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
  },
  // Italic Playfair title — the editorial hero.
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    color: COLORS.bark,
    marginTop: 2,
  },
  cardHost: { fontSize: 13, color: COLORS.barkSoft, marginTop: 4, fontFamily: FONTS.body },
  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8,
  },
  metaText: { fontSize: 12, color: COLORS.barkSoft, fontFamily: FONTS.body },
  metaDot: { fontSize: 12, color: COLORS.textLight },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.sandSoft,
  },
  capacityChip: {
    backgroundColor: 'rgba(233,138,106,0.16)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 4,
  },
  capacityChipText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6, color: '#B5703E',
  },
  arrow: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 4 },
  emptyBody: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', fontFamily: FONTS.body },
});
