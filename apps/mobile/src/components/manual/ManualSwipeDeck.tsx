// ManualSwipeDeck — Instagram-Stories-style swipe deck for a Manual chapter.
//
// Replaces the old "tap to open chapter" band on the Manual home: the user
// swipes horizontally through a short deck of cards (intro → basics → tip →
// shop → closer) instead of navigating into a separate chapter screen. Matches
// the design kit's SwipeChapter template (card N/M + bee, dot pagination, the
// thumbnail strip, a tappable shop link).
//
// PHASE: design-samples-first. The card CONTENT here is illustrative/hardcoded
// so we can nail the look + interaction; real per-chapter content (and real
// shop/affiliate links) get wired in a follow-up.
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { FONTS } from '@utils/constants';

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

type Card =
  | { kind: 'intro'; tag: string; title: string; sub: string }
  | { kind: 'list'; tag: string; title: string; items: string[] }
  | { kind: 'tip'; tag: string; title: string; body: string }
  | { kind: 'shop'; tag: string; title: string; product: string; link: string }
  | { kind: 'closer'; tag: string; title: string; sub: string };

// SAMPLE deck (illustrative). One light touch of chapter context in the intro;
// the rest is placeholder copy to demo the swipe experience.
function buildDeck(chapter: string): Card[] {
  return [
    { kind: 'intro', tag: 'intro', title: `${chapter}.`, sub: 'swipe through →' },
    { kind: 'list', tag: 'the basics', title: "What's normal this week", items: [
      'A short, reassuring point you can read in a glance',
      'Another quick one — clear, not clinical',
      'One more, so it feels handled',
    ] },
    { kind: 'tip', tag: 'try tonight', title: 'One small thing', body:
      'A calm, specific tip you can actually do tonight — one step, no pressure.' },
    { kind: 'shop', tag: 'village picks', title: 'What actually helps', product:
      'A sample product moms swear by', link: 'https://villieapp.com' },
    { kind: 'closer', tag: "you're set", title: "That's the week.", sub: 'more next week ✨' },
  ];
}

const THUMB_LABEL: Record<Card['kind'], string> = {
  intro: 'intro', list: 'basics', tip: 'tonight', shop: 'shop', closer: 'set',
};

export default function ManualSwipeDeck({ chapter, category }: { chapter: string; category: string }) {
  const accent = ACCENT[category] ?? DEFAULT_ACCENT;
  const deck = useMemo(() => buildDeck(chapter), [chapter]);
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w > 0) setIdx(Math.round(e.nativeEvent.contentOffset.x / w));
  };
  const goTo = (i: number) => {
    if (w > 0) scrollRef.current?.scrollTo({ x: i * w, animated: true });
    setIdx(i);
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
                {'sub' in card && !!card.sub && (
                  <Text style={[styles.cardSub, { color: accent.sub }]}>{card.sub}</Text>
                )}

                {card.kind === 'list' && (
                  <View style={styles.list}>
                    {card.items.map((it, j) => (
                      <View key={j} style={styles.listRow}>
                        <View style={[styles.check, { backgroundColor: accent.sub }]}>
                          <Text style={[styles.checkGlyph, { color: accent.bg }]}>✓</Text>
                        </View>
                        <Text style={[styles.listText, { color: accent.fg }]}>{it}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {card.kind === 'tip' && (
                  <Text style={[styles.tipBody, { color: accent.fg }]}>{card.body}</Text>
                )}

                {card.kind === 'shop' && (
                  <View style={styles.shopBlock}>
                    <Text style={[styles.shopProduct, { color: accent.fg }]}>{card.product}</Text>
                    <TouchableOpacity
                      style={[styles.shopBtn, { backgroundColor: accent.fg }]}
                      onPress={() => Linking.openURL(card.link).catch(() => {})}
                      accessibilityRole="link"
                      accessibilityLabel={`Shop ${card.product}`}
                    >
                      <Text style={[styles.shopBtnText, { color: accent.bg }]}>Shop this →</Text>
                    </TouchableOpacity>
                  </View>
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

      {/* The full set — mini thumbnails, tap to jump */}
      <View style={styles.thumbs}>
        {deck.map((card, i) => {
          const on = i === idx;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.thumb, { backgroundColor: accent.bg }, on && { borderColor: '#43260F', borderWidth: 2 }]}
              activeOpacity={0.85}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`Card ${i + 1}: ${THUMB_LABEL[card.kind]}`}
            >
              <Text style={[styles.thumbNum, { color: accent.fg }]}>{i + 1}</Text>
              <Text style={[styles.thumbLabel, { color: accent.fg }]} numberOfLines={1}>{THUMB_LABEL[card.kind]}</Text>
            </TouchableOpacity>
          );
        })}
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
  cardTitle: { fontFamily: FONTS.headerBold, fontSize: 38, lineHeight: 40, letterSpacing: -0.8, marginTop: 16 },
  cardSub: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', fontSize: 26, lineHeight: 28, marginTop: 4 },
  list: { marginTop: 20, gap: 13 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checkGlyph: { fontSize: 13, fontWeight: '800' },
  listText: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 16, lineHeight: 21 },
  tipBody: { fontFamily: FONTS.body, fontSize: 17, lineHeight: 25, marginTop: 18, opacity: 0.95 },
  shopBlock: { marginTop: 20 },
  shopProduct: { fontFamily: FONTS.bodySemiBold, fontSize: 17, lineHeight: 23, marginBottom: 16 },
  shopBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 },
  shopBtnText: { fontFamily: FONTS.bodyBold, fontSize: 15, letterSpacing: 0.2 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(67,38,15,0.22)' },
  dotOn: { width: 22 },

  thumbs: { flexDirection: 'row', gap: 9, marginTop: 18 },
  thumb: {
    flex: 1, aspectRatio: 4 / 5, borderRadius: 13, padding: 9,
    justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(67,38,15,0.08)',
  },
  thumbNum: { fontFamily: FONTS.bodyBold, fontSize: 10, opacity: 0.8 },
  thumbLabel: { fontFamily: FONTS.headerBold, fontSize: 12 },
});
