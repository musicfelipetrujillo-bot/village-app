// ManualSwipeDeck — Instagram-Stories-style auto-playing deck for a Manual chapter.
//
// Sits at the top of the Manual home (where the tap-to-open chapter band was).
// Cards AUTO-ADVANCE like IG stories: each fills a segmented progress bar over
// STORY_MS, then moves to the next. Tap the right side to skip forward faster,
// the left side to go back. The shop "link sticker" stays tappable (nested
// touchable wins over the tap-to-advance zone).
//
// Content is REAL per-chapter copy (intro + the chapter's "essentials" + a tip),
// pulled from the existing ManualCategoryScreen constants. The parent re-keys
// this component per chapter, so it remounts fresh (card 0) on chip change.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TouchableOpacity, Animated, Linking, Image,
  type GestureResponderEvent,
} from 'react-native';
import { FONTS } from '@utils/constants';
import { MANUAL_ESSENTIALS, MOM_HACKS, SUB_LEAD } from '@screens/manual/ManualCategoryScreen';
import type { ManualAudience } from '@/api/manual';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');
const STORY_MS = 5000; // how long each card plays before auto-advancing

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
    { tag: chapter, title: chapter, sub: lead },
    ...essentials.map((e) => ({ tag: 'the basics', title: e.title, body: e.body })),
  ];
  if (hacks[0]) cards.push({ tag: 'try tonight', title: 'One small thing', body: hacks[0] });
  cards.push({
    tag: 'village picks', title: 'What actually helps',
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
  const [idx, setIdx] = useState(0);
  const [cardW, setCardW] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  // Auto-advance: animate the active segment, then move to the next card.
  // Stops on the last card. Re-runs whenever idx changes (incl. via tap).
  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STORY_MS, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) setIdx((i) => (i < deck.length - 1 ? i + 1 : i));
    });
    return () => anim.stop();
  }, [idx, deck.length, progress]);

  const card = deck[idx] ?? deck[0];

  // Tap right 70% → next (faster); tap left 30% → previous.
  const onTapCard = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    if (cardW > 0 && x < cardW * 0.3) setIdx((i) => Math.max(0, i - 1));
    else setIdx((i) => Math.min(deck.length - 1, i + 1));
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onTapCard}
        onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel={`Card ${idx + 1} of ${deck.length}. Tap right to advance, left to go back.`}
      >
        <View style={[styles.card, { backgroundColor: accent.bg }]}>
          <View style={styles.cardCircle} pointerEvents="none" />

          {/* IG-story segmented progress bars */}
          <View style={styles.bars}>
            {deck.map((_, i) => (
              <View key={i} style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: accent.fg,
                      width:
                        i < idx
                          ? '100%'
                          : i === idx
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          <View style={styles.cardTop}>
            <Text style={[styles.cardCount, { color: accent.fg }]}>CARD {idx + 1} OF {deck.length}</Text>
            <Image source={VILLIE_BEE} style={styles.bee} resizeMode="contain" />
          </View>

          <Text style={[styles.cardTitle, { color: accent.fg }]} numberOfLines={3}>{card.title}</Text>
          {!!card.sub && <Text style={[styles.cardSub, { color: accent.sub }]} numberOfLines={2}>{card.sub}</Text>}
          {!!card.body && <Text style={[styles.cardBody, { color: accent.fg }]} numberOfLines={6}>{card.body}</Text>}

          {/* IG-story-style link sticker — nested touchable wins over tap-to-advance */}
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
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  card: {
    borderRadius: 26, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 26,
    aspectRatio: 4 / 5, overflow: 'hidden',
    shadowColor: '#43260F', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 16 }, shadowRadius: 30, elevation: 6,
  },
  cardCircle: {
    position: 'absolute', bottom: -38, right: -30, width: 150, height: 150,
    borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  // progress bars
  bars: { flexDirection: 'row', gap: 5, marginBottom: 14 },
  barTrack: { flex: 1, height: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },

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
});
