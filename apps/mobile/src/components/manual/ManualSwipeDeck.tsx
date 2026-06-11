// ManualSwipeDeck — Instagram-Stories-style swipe deck for a Manual chapter.
//
// Sits at the top of the Manual home (where the tap-to-open chapter band was).
// The user swipes through a short, digestible deck for the selected chapter;
// the rest of the chapter's content keeps scrolling below it in one scroll.
//
// Content is REAL per-chapter copy (intro + the chapter's "essentials" + a
// tip), pulled from the existing ManualCategoryScreen constants. Shop links are
// embedded on cards as IG-story-style "link stickers" (a small tappable chip),
// not a full-width button.
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { FONTS } from '@utils/constants';
import { MANUAL_ESSENTIALS, MOM_HACKS, SUB_LEAD } from '@screens/manual/ManualCategoryScreen';
import type { ManualAudience } from '@/api/manual';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// Saturated chapter accents (deeper than the pale band washes) so the cards
// read bold like the design. fg = text color, sub = the handwritten accent.
const ACCENT: Record<string, { bg: string; fg: string; sub: string }> = {
  sleep:   { bg: '#C9824E', fg: '#FFFCF6', sub: '#FBE3C4' },
  feed:    { bg: '#E0A52E', fg: '#43260F', sub: '#7A4A14' },
  grow:    { bg: '#D96C88', fg: '#FFFCF6', sub: '#FBE0E6' },
  care:    { bg: '#7E8B4E', fg: '#FFFCF6', sub: '#EAEFCF' },
  soothe:  { bg: '#C25A78', fg: '#FFFCF6', sub: '#F6D6E2' },
  feel:    { bg: '#D96C88', fg: '#FFFCF6', sub: '#FBE0E6' },
  heal:    { bg: '#C9824E', fg: '#FFFCF6', sub: '#FBE3C4' },
  nourish: { bg: '#E0A52E', fg: '#43260F', sub: '#7A4A14' },
  rest:    { bg: '#7E8B4E', fg: '#FFFCF6', sub: '#EAEFCF' },
  tips:    { bg: '#C25A78', fg: '#FFFCF6', sub: '#F6D6E2' },
};
const DEFAULT_ACCENT = { bg: '#D96C88', fg: '#FFFCF6', sub: '#FBE0E6' };

type ShopLink = { label: string; url: string };
type Card = {
  thumb: string;
  tag: string;
  title: string;
  sub?: string;       // handwritten accent line (intro / closer)
  body?: string;      // paragraph (tip / essential body)
  shop?: ShopLink;    // embedded IG-story-style link sticker
};

// Build a real-copy deck from the chapter's existing content.
function buildDeck(audience: ManualAudience, category: string, chapter: string): Card[] {
  const key = `${audience}/${category}`;
  const essentials = MANUAL_ESSENTIALS[key] ?? [];
  const hacks = MOM_HACKS[key] ?? [];
  const lead = SUB_LEAD[key] ?? 'swipe through →';

  const cards: Card[] = [
    { thumb: 'intro', tag: chapter, title: chapter, sub: lead },
    ...essentials.map((e, i) => ({ thumb: `0${i + 1}`, tag: 'the basics', title: e.title, body: e.body })),
  ];
  if (hacks[0]) cards.push({ thumb: 'tonight', tag: 'try tonight', title: 'One small thing', body: hacks[0] });
  // Shop card — the link sticker is the shoppable affordance (sample destination
  // for now; wires to real perks/products in a follow-up).
  cards.push({
    thumb: 'shop', tag: 'village picks', title: 'What actually helps',
    body: 'Hand-picked by the village — the few things worth it this week.',
    shop: { label: 'Shop the picks', url: 'https://villieapp.com' },
  });
  return cards;
}

export default function ManualSwipeDeck({
  chapter, category, audience = 'baby',
}: { chapter: string; category: string; audience?: ManualAudience }) {
  const accent = ACCENT[category] ?? DEFAULT_ACCENT;
  const deck = useMemo(() => buildDeck(audience, category, chapter), [audience, category, chapter]);
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w > 0) setIdx(Math.round(e.nativeEvent.contentOffset.x / w));
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        >
          {deck.map((card, i) => (
            <View key={i} style={{ width: w }}>
              <View style={[styles.card, { backgroundColor: accent.bg }]}>
                <View style={styles.cardCircle} pointerEvents="none" />
                <View style={styles.cardTop}>
                  <Text style={[styles.cardCount, { color: accent.fg }]}>CARD {i + 1} OF {deck.length}</Text>
                  <Image source={VILLIE_BEE} style={styles.bee} resizeMode="contain" />
                </View>

                <Text style={[styles.cardTitle, { color: accent.fg }]}>{card.title}</Text>
                {!!card.sub && <Text style={[styles.cardSub, { color: accent.sub }]}>{card.sub}</Text>}
                {!!card.body && <Text style={[styles.cardBody, { color: accent.fg }]}>{card.body}</Text>}

                {/* IG-story-style link sticker */}
                {!!card.shop && (
                  <TouchableOpacity
                    style={styles.sticker}
                    activeOpacity={0.85}
                    onPress={() => Linking.openURL(card.shop!.url).catch(() => {})}
                    accessibilityRole="link"
                    accessibilityLabel={card.shop.label}
                  >
                    <View style={[styles.stickerDot, { backgroundColor: accent.bg }]}>
                      <Text style={[styles.stickerGlyph, { color: accent.fg }]}>↗</Text>
                    </View>
                    <Text style={styles.stickerText}>{card.shop.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Dot pagination */}
      <View style={styles.dots}>
        {deck.map((_, i) => (
          <View key={i} style={[styles.dot, i === idx && [styles.dotOn, { backgroundColor: accent.bg }]]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  card: {
    borderRadius: 26, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 26,
    aspectRatio: 4 / 5, overflow: 'hidden',
    shadowColor: '#43260F', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 16 }, shadowRadius: 30, elevation: 6,
  },
  cardCircle: {
    position: 'absolute', bottom: -38, right: -30, width: 150, height: 150,
    borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCount: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.8, opacity: 0.85 },
  bee: { width: 32, height: 32 },
  cardTitle: { fontFamily: FONTS.headerBold, fontSize: 34, lineHeight: 37, letterSpacing: -0.7, marginTop: 16 },
  cardSub: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', fontSize: 26, lineHeight: 28, marginTop: 6 },
  cardBody: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 23, marginTop: 14, opacity: 0.96 },

  // IG-story link sticker
  sticker: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9,
    marginTop: 18, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 13,
    paddingLeft: 6, paddingRight: 14, paddingVertical: 6,
  },
  stickerDot: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stickerGlyph: { fontSize: 14, fontWeight: '800' },
  stickerText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: '#43260F', letterSpacing: 0.2 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(67,38,15,0.22)' },
  dotOn: { width: 22 },
});
