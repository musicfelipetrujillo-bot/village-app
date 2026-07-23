// V4 — Saved events ("Saved plans")
// A ♡ wishlist of events the user bookmarked, separate from RSVP.
// Reached from the EventsList header "Saved" link.
import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useEventsStore } from '@store/events';
import { EventCardSkeleton } from '@components/shared/SkeletonLoader';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { HoneycombBackdrop } from '@components/shared/HoneycombBackdrop';
import { useT } from '@/i18n';
import { EventCardView } from './EventsListScreen';

export default function SavedEventsScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { savedEvents, savedIds, loading, fetchSavedEvents, toggleSave } = useEventsStore();
  const [firstLoad, setFirstLoad] = React.useState(true);

  useEffect(() => {
    (async () => {
      await fetchSavedEvents();
      setFirstLoad(false);
    })();
  }, [fetchSavedEvents]);

  const onRefresh = useCallback(() => {
    fetchSavedEvents();
  }, [fetchSavedEvents]);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.34)', 'rgba(250,208,128,0.14)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('eventsList.backA11y')}>
          <Text style={styles.back}>{t('eventsList.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('savedEvents.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Honeycomb masthead — rose accent, matches the Events list vertical. */}
      <View style={styles.masthead}>
        <HoneycombBackdrop accent="#EFB2C8" intensity="playful" scene="plans" topOffset={44} />
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrowText}>{t('savedEvents.mastheadEyebrow')}</Text>
        </View>
        <Text style={styles.mastTitle}>
          {t('savedEvents.mastheadTitleRoman')}{' '}
          <Text style={styles.mastTitleItalic}>{t('savedEvents.mastheadTitleItalic')}</Text>
        </Text>
        <Text style={styles.mastDeck}>{t('savedEvents.mastheadSub')}</Text>
      </View>

      {firstLoad && loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <EventCardSkeleton />
          <EventCardSkeleton />
        </View>
      ) : (
        <FlashList
          data={savedEvents}
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
              <Text style={styles.emptyEmoji}>♡</Text>
              <Text style={styles.emptyTitle}>{t('savedEvents.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('savedEvents.emptyBody')}</Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('EventsList')}
                accessibilityRole="button"
                accessibilityLabel={t('savedEvents.emptyCta')}
              >
                <Text style={styles.emptyCtaText}>{t('savedEvents.emptyCta')}</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.coco} />}
        />
      )}
    </View>
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

  // Honeycomb masthead (mirrors EventsList "plansMasthead").
  masthead: {
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18,
    position: 'relative', overflow: 'hidden',
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eyebrowBar: { width: 16, height: 1.5, backgroundColor: COLORS.v2_walnut, marginRight: 8 },
  eyebrowText: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500', color: COLORS.v2_walnut,
  },
  mastTitle: {
    marginTop: 6, fontFamily: FONTS.v3_display, fontSize: 34, lineHeight: 38,
    color: COLORS.v2_cocoa, letterSpacing: -0.9,
  },
  mastTitleItalic: {
    fontFamily: FONTS.v3_display_italic, color: '#CB5480', fontStyle: 'italic', // Events signature: berry rose
  },
  mastDeck: {
    marginTop: 10, fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: COLORS.v2_walnut, maxWidth: 320,
  },

  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, color: '#E84B79', marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.v3_display, color: COLORS.bark, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 21, color: COLORS.v2_walnut, textAlign: 'center', marginBottom: 24 },
  emptyCta: { backgroundColor: '#C07840', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  emptyCtaText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.v2_card },
});
