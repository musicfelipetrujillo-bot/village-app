// V4 Phase G4 — Gear browse feed
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl, Image, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { COLORS, FONTS } from '@utils/constants';
import { getEffectiveCoords } from '@utils/devLocation';
import { useT } from '@/i18n';
import { useGearStore } from '@store/gear';
import {
  conditionLabel,
  formatPrice,
  type GearCard,
  type GearCategory,
} from '@api/gear';
import { GearCardSkeleton } from '@components/shared/SkeletonLoader';
import { BackButton } from '@components/shared/BackButton';
import { HubHeader } from '@components/shared/HubHeader';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { HoneycombBackdrop } from '@components/shared/HoneycombBackdrop';

type TFn = (key: string, params?: Record<string, string | number>) => string;

const CATEGORY_FILTERS: { key: GearCategory | 'all'; i18nKey: string }[] = [
  { key: 'all',               i18nKey: 'gearBrowse.chipAll' },
  { key: 'stroller',          i18nKey: 'gearBrowse.chipStroller' },
  { key: 'carrier_wrap',      i18nKey: 'gearBrowse.chipCarrier' },
  { key: 'high_chair',        i18nKey: 'gearBrowse.chipHighChair' },
  { key: 'bouncer_swing',     i18nKey: 'gearBrowse.chipBouncer' },
  { key: 'toy',               i18nKey: 'gearBrowse.chipToy' },
  { key: 'feeding_gear',      i18nKey: 'gearBrowse.chipFeeding' },
  { key: 'clothing',          i18nKey: 'gearBrowse.chipClothing' },
  { key: 'book',              i18nKey: 'gearBrowse.chipBook' },
  { key: 'activity_center',   i18nKey: 'gearBrowse.chipActivity' },
  { key: 'nursery_furniture', i18nKey: 'gearBrowse.chipNursery' },
];

export default function GearBrowseScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { feed, loading, fetchFeed } = useGearStore();
  const [category, setCategory] = useState<GearCategory | 'all'>('all');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed;
    return feed.filter((g) => [g.title, g.brand, g.category].some((v) => v && String(v).toLowerCase().includes(q)));
  }, [feed, query]);

  useEffect(() => {
    (async () => {
      let deviceCoords: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== 'granted') {
            // No permission — still seed Miami via the helper in dev so
            // the gear feed renders against the launch market.
            if (__DEV__) setCoords(getEffectiveCoords(null));
            return;
          }
        }
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) deviceCoords = pos.coords;
      } catch { /* ignore */ }
      // Dev-mode override: ignore Simulator's Cupertino default in favor of Miami.
      const { lat, lng } = getEffectiveCoords(deviceCoords);
      setCoords({ lat, lng });
    })();
  }, []);

  const load = useCallback(() => {
    fetchFeed({
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      category: category === 'all' ? null : category,
    });
  }, [fetchFeed, coords, category]);

  useEffect(() => { load(); }, [load]);

  // Hero photo lives inside ListHeaderComponent so it scrolls away as
  // the user reads the gear feed. Header links (Inbox/Saved/Mine) and
  // the page title scroll away with it — "scroll back to top" is the
  // standard gesture to return to navigation surfaces. The FAB stays
  // pinned for "List an item" since that's a primary intent.
  const Hero = (
    /* v3 editorial masthead 2026-05-24 — replaces the KenBurns photo
       header per Felipe. See MilkConnectHomeScreen for the pattern. */
    <View style={{ marginHorizontal: -18, paddingTop: insets.top + 6 }}>
      <HubHeader
        name="gear"
        dotColor="#F4C53C"
        onBack={() => navigation.getParent()?.navigate('Village' as never)}
        backAccessibilityLabel={t('common.backToVillage')}
        right={
          <View style={styles.utilityRight}>
            <TouchableOpacity onPress={() => navigation.navigate('GearMessageThreads')} accessibilityLabel={t('gearBrowse.linkInboxA11y')} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Text style={styles.utilityLink}>{t('gearBrowse.linkInbox')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('SavedGear')} accessibilityLabel={t('gearBrowse.linkSavedA11y')} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Text style={styles.utilityLink}>{t('gearBrowse.linkSaved')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('MyListings')} accessibilityLabel={t('gearBrowse.linkMineA11y')} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Text style={styles.utilityLink}>{t('gearBrowse.linkMine')}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop hideClusters />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(244,197,60,0.26)', 'rgba(244,197,60,0.08)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <FlashList
        ListHeaderComponent={
          <>
            {Hero}
            <View style={styles.gearSearchRow}>
              <Text style={styles.gearSearchIcon}>⌕</Text>
              <TextInput
                style={styles.gearSearchInput}
                placeholder="search gear · stroller, carrier, high chair…"
                placeholderTextColor="#A6957F"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
            </View>
            <View style={styles.filterRow}>
              {CATEGORY_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, category === f.key && styles.chipActive]}
                  onPress={() => setCategory(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === f.key }}
                >
                  <Text style={[styles.chipText, category === f.key && styles.chipTextActive]}>
                    {t(f.i18nKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        data={shown}
        keyExtractor={(l) => l.id}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ListingCardView
              listing={item}
              onPress={() => navigation.navigate('GearListingDetail', { id: item.id })}
              t={t}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ marginTop: 6 }}>
              <GearCardSkeleton />
              <GearCardSkeleton />
              <GearCardSkeleton />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('gearBrowse.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('gearBrowse.emptyBody')}</Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 0, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.coco} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateListing')}
        accessibilityRole="button"
        accessibilityLabel={t('gearBrowse.fabA11y')}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>{t('gearBrowse.fab')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ListingCardView({ listing, onPress, t }: { listing: GearCard; onPress: () => void; t: TFn }) {
  // Compact grid card — square thumbnail + tight info block, so the feed reads
  // like a marketplace (more items per screen) instead of editorial hero cards.
  const metaText = [
    conditionLabel(listing.condition),
    listing.brand,
  ].filter(Boolean).join(' · ');
  const locText = listing.distance_km != null
    ? `${listing.distance_km.toFixed(1)} km`
    : (listing.pickup_city ?? '');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={styles.thumbWrap}>
        {listing.cover_image_url ? (
          <Image source={{ uri: listing.cover_image_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Text style={styles.cardImageFallbackText}>{t('gearBrowse.noPhoto')}</Text>
          </View>
        )}
        {listing.is_boosted && (
          <View style={styles.boostBadge} pointerEvents="none">
            <Text style={styles.boostBadgeText}>✦</Text>
          </View>
        )}
        {listing.is_cpsc_checked && (
          <View style={styles.cpscPill} pointerEvents="none">
            <Text style={styles.cpscPillText}>✓ {t('gearBrowse.cpscBadge')}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{listing.title}</Text>
        {metaText ? <Text style={styles.cardMeta} numberOfLines={1}>{metaText}</Text> : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>{formatPrice(listing.price_cents, listing.is_free, listing.currency)}</Text>
          {locText ? <Text style={styles.cardCity} numberOfLines={1}>{locText}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 640 },
  // Editorial header — paddingBottom:0 so the hairline closes the block.
  // No solid bg — sits flush on the page cream so the moodboard's cream-on-
  // cream rhythm carries through.
  header: {
    paddingTop: 56, paddingBottom: 0, paddingHorizontal: 20,
  },
  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  backToVillage: { paddingVertical: 4, paddingRight: 8 },
  backToVillageText: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerLink: { fontSize: 13, color: '#E84B79', fontFamily: FONTS.bodySemiBold },

  // Title block — relative so DecorativeMarks (absolutely positioned)
  // can tuck behind the eyebrow → italic title → sub stack without
  // pushing the layout. paddingTop:4 leaves a hair of space for the
  // marks to peek above the eyebrow.
  titleBlock: { position: 'relative', paddingTop: 4, paddingBottom: 14 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyebrowBar: {
    width: 22, height: 2, backgroundColor: '#7A4A24',  // v9 rust-deep — unified across app
    marginRight: 10, borderRadius: 1,
  },
  eyebrow: {
    fontSize: 11, lineHeight: 22, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold, color: '#7A4A24',
    textTransform: 'uppercase',
    includeFontPadding: false, textAlignVertical: 'center',
  },
  // Page lead — italic Playfair, the one editorial title at the top
  // of this surface (italic is reserved for the page lead per
  // editorial-system.md).
  headerTitle: {
    fontSize: 32, lineHeight: 38,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14, lineHeight: 20, fontFamily: FONTS.body,
    color: COLORS.barkSoft, maxWidth: 320,
  },
  headerHairline: {
    height: 1, backgroundColor: 'rgba(44,26,14,0.08)',
    marginHorizontal: -20, marginTop: 4,
  },

  // Magazine-cover hero — full-bleed photo dominates the top of the
  // screen. Mirrors Milk Hub heroHeader pattern.
  // v3 editorial masthead (replaces KenBurns photo header 2026-05-24).
  // Same recipe as MilkConnectHomeScreen.
  mastheadWrap: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 18,
    marginHorizontal: -12,   // negate FlashList paddingHorizontal:12
    position: 'relative',
    overflow: 'hidden',
  },
  mastheadUtility: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backLink: {
    fontFamily: FONTS.v2_mono, fontSize: 12, color: COLORS.v2_walnut,
    letterSpacing: 0.6,
  },
  utilityRight: { flexDirection: 'row', gap: 14 },
  utilityLink: {
    fontSize: 13, color: COLORS.v2_cinnamon,
    fontFamily: FONTS.v2_bold,
  },
  mastheadEyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  mastheadEyebrowBar: {
    width: 16, height: 1.5, backgroundColor: COLORS.v2_walnut,
    marginRight: 8,
  },
  mastheadEyebrowText: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500',
    color: COLORS.v2_walnut,
  },
  mastheadTitle: {
    marginTop: 6,
    fontFamily: FONTS.v3_display, fontSize: 36, lineHeight: 40,
    color: COLORS.v2_cocoa,
    letterSpacing: -0.9,
  },
  mastheadTitleItalic: {
    fontFamily: FONTS.v3_display_italic,
    color: '#B5811C', // Gear signature: honey-gold
    fontStyle: 'italic',
  },
  mastheadDeck: {
    marginTop: 10,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: COLORS.v2_walnut,
    maxWidth: 340,
  },
  mastheadRule: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    width: 48,
    backgroundColor: 'rgba(61,31,14,0.13)',
  },

  gearSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDF7EC', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.14)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginTop: 14 },
  gearSearchIcon: { fontSize: 18, color: '#B0234F' },
  gearSearchInput: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13.5, color: '#3D2116', paddingVertical: 9 },

  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingTop: 12, paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.18)', backgroundColor: COLORS.paper,
  },
  chipActive: { backgroundColor: COLORS.coco, borderColor: COLORS.coco },
  chipText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  chipTextActive: { color: '#FFFCF6' },

  // v9 card lift recipe — paper bg + cocoa drop + rust hairline.
  // (Moved off tan #F2E9C4 — too saturated, fought the page wash and the
  //  chapter pill palette. Paper is the canonical card surface.)
  // Compact grid cell — wraps each card to add the inter-column gutter.
  cell: { flex: 1, paddingHorizontal: 5, paddingBottom: 10 },
  // NOTE: no overflow:'hidden' here — that would clip the iOS drop shadow.
  // Corner-clipping is done on thumbWrap (top) + the card's own borderRadius
  // (bottom), so the tile keeps clean rounded corners AND casts a real shadow
  // to lift off the cream page.
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(122,74,36,0.22)',
    shadowColor: '#43260F',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  thumbWrap: {
    position: 'relative',
    borderTopLeftRadius: 13, borderTopRightRadius: 13, overflow: 'hidden',
  },
  // Landscape thumb (was square) — shorter cards so ~4 items fit on screen.
  cardImage: { width: '100%', aspectRatio: 1.5, backgroundColor: '#F0E6D8' },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardImageFallbackText: { color: COLORS.textLight, fontSize: 11, fontFamily: FONTS.bodySemiBold },
  boostBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: COLORS.v2_marigold, borderRadius: 6,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  boostBadgeText: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.v2_cocoa },
  cpscPill: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(252,247,239,0.92)', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  cpscPillText: { fontSize: 9, fontFamily: FONTS.bodySemiBold, color: '#9A6B12', letterSpacing: 0.4 },
  cardBody: { paddingVertical: 7, paddingHorizontal: 9 },
  // Clean sans title (was italic Playfair) — less editorial, fits the dense grid.
  cardTitle: {
    fontSize: 12.5, lineHeight: 15.5,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bark,
  },
  cardMeta: { fontSize: 10, color: COLORS.barkSoft, fontFamily: FONTS.body, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: 5, gap: 6,
  },
  cardPrice: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  cardCity: { fontSize: 10, color: COLORS.textLight, fontFamily: FONTS.bodyMedium, flexShrink: 1, textAlign: 'right' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 4 },
  emptyBody: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', fontFamily: FONTS.body },

  fab: {
    position: 'absolute', bottom: 90, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E84B79', borderRadius: 28,             // v9 CTA = cinnamon
    paddingHorizontal: 18, paddingVertical: 13,
    shadowColor: '#E84B79', shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabIcon: { color: '#FFFCF6', fontSize: 20, fontFamily: FONTS.bodySemiBold },
  fabText: { color: '#FFFCF6', fontSize: 14, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
