// V4 Phase G4 — Gear browse feed
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { COLORS, FONTS } from '@utils/constants';
import { getEffectiveCoords } from '@utils/devLocation';
import { useT } from '@/i18n';
import { useGearStore } from '@store/gear';
import {
  categoryLabel,
  conditionLabel,
  formatPrice,
  type GearCard,
  type GearCategory,
} from '@api/gear';
import { GearCardSkeleton } from '@components/shared/SkeletonLoader';
import { KenBurnsImage } from '@components/shared/KenBurnsImage';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';

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
  const navigation = useNavigation<any>();
  const { feed, loading, fetchFeed } = useGearStore();
  const [category, setCategory] = useState<GearCategory | 'all'>('all');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

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
    <View style={styles.heroHeader} accessibilityElementsHidden importantForAccessibility="no">
      <KenBurnsImage
        source={require('../../../assets/photos/gear.jpg')}
        style={styles.heroHeaderImage}
      />
      <View style={styles.heroHeaderScrimTop} />
      <View style={styles.heroHeaderScrimMid} />
      <View style={styles.heroHeaderScrimBottom} />
      <View style={styles.heroHeaderHaze} />

      <View style={styles.heroActionBar}>
        <TouchableOpacity
          onPress={() => navigation.getParent()?.navigate('Village' as never)}
          accessibilityRole="button"
          accessibilityLabel={t('common.backToVillage')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.heroBackText}>{t('common.backToVillage')}</Text>
        </TouchableOpacity>
        <View style={styles.heroActionsRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('GearMessageThreads')}
            accessibilityLabel={t('gearBrowse.linkInboxA11y')}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text style={styles.heroLink}>{t('gearBrowse.linkInbox')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('SavedGear')}
            accessibilityLabel={t('gearBrowse.linkSavedA11y')}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text style={styles.heroLink}>{t('gearBrowse.linkSaved')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('MyListings')}
            accessibilityLabel={t('gearBrowse.linkMineA11y')}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text style={styles.heroLink}>{t('gearBrowse.linkMine')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <View style={styles.heroEyebrowRow}>
          <View style={styles.heroEyebrowBar} />
          <Text style={styles.heroEyebrowText}>{t('gearBrowse.eyebrow')}</Text>
        </View>
        <Text style={styles.heroTitle}>{t('gearBrowse.homeTitle')}</Text>
        <Text style={styles.heroSub}>{t('gearBrowse.homeSub')}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop hideClusters />
      <FlashList
        ListHeaderComponent={
          <>
            {Hero}
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
        data={feed}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <ListingCardView
            listing={item}
            onPress={() => navigation.navigate('GearListingDetail', { id: item.id })}
            t={t}
          />
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 140 }}
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
  // Concept B feed-row pattern — eyebrow + italic Playfair title + bullet-dot
  // meta + footer chips. Product photo replaces the left-illustration column.
  const meta: string[] = [conditionLabel(listing.condition)];
  if (listing.brand) meta.push(listing.brand);
  const locText = [
    listing.pickup_city,
    listing.distance_km != null ? `${listing.distance_km.toFixed(1)} km` : null,
  ].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      {listing.cover_image_url ? (
        <Image source={{ uri: listing.cover_image_url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImageFallback]}>
          <Text style={styles.cardImageFallbackText}>{t('gearBrowse.noPhoto')}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        {/* v9 paper-leaning card wash — replaces the stale golden→blush. */}
        <LinearGradient
          colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Eyebrow row — category + CPSC chip on the right */}
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardCategory}>{categoryLabel(listing.category).toUpperCase()}</Text>
          {listing.is_cpsc_checked && (
            <View style={styles.cpscChip}>
              <Text style={styles.cpscChipText}>{t('gearBrowse.cpscBadge').toUpperCase()}</Text>
            </View>
          )}
        </View>
        {/* Italic Playfair title — the editorial hero. */}
        <Text style={styles.cardTitle} numberOfLines={2}>{listing.title}</Text>
        {/* Meta row — bullet-dot separated. */}
        <View style={styles.metaRow}>
          {meta.map((token, i) => (
            <React.Fragment key={`${token}-${i}`}>
              {i > 0 ? <Text style={styles.metaDot}>·</Text> : null}
              <Text style={styles.metaText}>{token}</Text>
            </React.Fragment>
          ))}
        </View>
        {/* Footer row — price + city, hairline divider. */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>{formatPrice(listing.price_cents, listing.is_free, listing.currency)}</Text>
          {locText ? <Text style={styles.cardCity}>{locText}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
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
  headerLink: { fontSize: 13, color: '#C07840', fontFamily: FONTS.bodySemiBold },

  // Title block — relative so DecorativeMarks (absolutely positioned)
  // can tuck behind the eyebrow → italic title → sub stack without
  // pushing the layout. paddingTop:4 leaves a hair of space for the
  // marks to peek above the eyebrow.
  titleBlock: { position: 'relative', paddingTop: 4, paddingBottom: 14 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyebrowBar: {
    width: 22, height: 2, backgroundColor: '#A77349',  // v9 rust-deep — unified across app
    marginRight: 10, borderRadius: 1,
  },
  eyebrow: {
    fontSize: 11, lineHeight: 22, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold, color: '#A77349',
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
  heroHeader: {
    height: 340,
    position: 'relative',
    backgroundColor: COLORS.bark,
    overflow: 'hidden',
    // Negate FlashList contentContainerStyle's paddingHorizontal:16 so
    // the hero photo bleeds edge-to-edge.
    marginHorizontal: -16,
  },
  heroHeaderImage: { width: '100%', height: '100%' },
  // Single light scrim — minimal darkening so action-bar text stays legible
  // against any photo. Cream haze removed so the photo color reads true.
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
  heroHeaderHaze: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  heroActionBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBackText: {
    fontSize: 14,
    color: '#FDFBF6',
    fontFamily: FONTS.bodySemiBold,
  },
  heroActionsRight: { flexDirection: 'row', gap: 14 },
  heroLink: {
    fontSize: 13, color: '#FDFBF6',
    fontFamily: FONTS.bodySemiBold,
    opacity: 0.92,
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
    color: '#FDFBF6',
    textTransform: 'uppercase',
    opacity: 0.92,
  },
  heroTitle: {
    fontSize: 36, lineHeight: 42,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#FDFBF6',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14, lineHeight: 20,
    fontFamily: FONTS.body,
    color: '#FDFBF6',
    opacity: 0.9,
    maxWidth: 340,
  },

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
  chipTextActive: { color: '#FDFBF6' },

  // v9 card lift recipe — paper bg + cocoa drop + rust hairline.
  // (Moved off tan #F2E9C4 — too saturated, fought the page wash and the
  //  chapter pill palette. Paper is the canonical card surface.)
  card: {
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#6B2E0E',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    elevation: 3,
  },
  cardImage: { width: '100%', aspectRatio: 16 / 10, backgroundColor: COLORS.cream },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardImageFallbackText: { color: COLORS.textLight, fontSize: 12, fontFamily: FONTS.bodySemiBold },
  cardBody: { paddingVertical: 14, paddingHorizontal: 16, overflow: 'hidden' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardCategory: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.6, color: '#A77349' },  // v9 eyebrow = amber
  cpscChip: {
    borderWidth: 1, borderColor: COLORS.sage, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  cpscChipText: {
    fontSize: 9, fontFamily: FONTS.bodySemiBold, color: COLORS.sage, letterSpacing: 0.6,
  },
  // Italic Playfair title — the editorial hero.
  cardTitle: {
    fontSize: 20, lineHeight: 26,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6,
  },
  metaText: { fontSize: 12, color: COLORS.barkSoft, fontFamily: FONTS.body },
  metaDot: { fontSize: 12, color: COLORS.textLight },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.sandSoft,
  },
  cardPrice: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  cardCity: { fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 4 },
  emptyBody: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', fontFamily: FONTS.body },

  fab: {
    position: 'absolute', bottom: 90, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#C07840', borderRadius: 28,             // v9 CTA = cinnamon
    paddingHorizontal: 18, paddingVertical: 13,
    shadowColor: '#945A41', shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabIcon: { color: '#FDFBF6', fontSize: 20, fontFamily: FONTS.bodySemiBold },
  fabText: { color: '#FDFBF6', fontSize: 14, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
