// ManualSwipeDeck — Instagram-Stories-style auto-playing deck for a Manual chapter.
//
// Renders the chapter's `story` cards (from manualWeekContent). Cards AUTO-ADVANCE
// like IG stories: each fills a segmented progress bar over STORY_MS, then moves
// to the next. Tap the right side to skip forward faster, the left side to go
// back. Each card carries its OWN palette color (ink/rose/honey/caramel/blush).
// The shop/learn "link sticker" stays tappable (nested touchable wins).
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TouchableOpacity, Animated, Linking,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import type { StoryCard } from '@/manual/manualWeekContent';

const STORY_MS = 5000; // how long each card plays before auto-advancing

// Subtle static honeycomb texture, top-right of the card (echoes the masthead
// comb). Flat-top hex cells, outline only, low opacity — tinted to the card's fg.
function HoneycombCorner({ color }: { color: string }) {
  const r = 16;
  const SQ3 = Math.sqrt(3);
  const COLS = 9;
  const ROWS = 7;
  const maxX = (COLS - 1) * (r * 1.5);
  const maxY = (ROWS - 1) * (r * SQ3);
  const cells: { cx: number; cy: number }[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      cells.push({ cx: col * (r * 1.5), cy: row * (r * SQ3) + (col % 2 ? (r * SQ3) / 2 : 0) });
    }
  }
  const hex = (cx: number, cy: number) => {
    const p: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      p.push(`${(cx + r * 0.9 * Math.cos(a)).toFixed(1)},${(cy + r * 0.9 * Math.sin(a)).toFixed(1)}`);
    }
    return p.join(' ');
  };
  // Fade from the top-right corner (densest) toward the lower-left (dissolves
  // into the card so it never fights the title/body).
  const op = (cx: number, cy: number) => {
    const d = ((maxX - cx) / maxX + cy / maxY) / 2; // 0 at top-right → 1 at lower-left
    return Math.max(0.04, 0.22 * (1 - d));
  };
  return (
    <View style={styles.combCorner} pointerEvents="none">
      <Svg width={210} height={200} viewBox="0 0 210 200">
        {cells.map((c, i) => (
          <Polygon key={i} points={hex(c.cx, c.cy)} fill="none" stroke={color} strokeWidth={1.3} strokeOpacity={op(c.cx, c.cy)} />
        ))}
      </Svg>
    </View>
  );
}

// Each category wears its OWN monochromatic palette (tints → deep shades of the
// chapter's hue) so the deck color matches the selected chip. Index 0 is the
// lightest tint — it opens AND closes the deck (soft bookends); the middle cards
// step through progressively deeper shades of the same hue.
type Scheme = { grad: [string, string]; fg: string; sub: string; track: string };
const PALETTES: Record<string, Scheme[]> = {
  sleep: [ // terracotta / clay
    { grad: ['#F3DFC9', '#ECCFB2'], fg: '#5A3A1E', sub: '#B5763E', track: 'rgba(90,58,30,0.18)' },
    { grad: ['#E0A878', '#D4945F'], fg: '#FFF9F2', sub: '#FBE7CF', track: 'rgba(255,255,255,0.4)' },
    { grad: ['#CE8550', '#BE743E'], fg: '#FFF9F2', sub: '#FBE7CF', track: 'rgba(255,255,255,0.4)' },
    { grad: ['#A85F33', '#8E4E28'], fg: '#FFF9F2', sub: '#F4D9BE', track: 'rgba(255,255,255,0.4)' },
  ],
  feed: [ // amber / honey
    { grad: ['#F7E7BE', '#F2DCA4'], fg: '#5A4012', sub: '#A87A18', track: 'rgba(90,64,18,0.18)' },
    { grad: ['#EFC85C', '#E8B83C'], fg: '#43300A', sub: '#7A560F', track: 'rgba(67,48,10,0.22)' },
    { grad: ['#E0A52E', '#CE9220'], fg: '#43300A', sub: '#FBE9BE', track: 'rgba(67,48,10,0.22)' },
    { grad: ['#C0801A', '#A66C12'], fg: '#FFFBF0', sub: '#F6E2B0', track: 'rgba(255,255,255,0.4)' },
  ],
  grow: [ // rose / pink
    { grad: ['#F9D7DF', '#F3C2CE'], fg: '#7A2E47', sub: '#C25A78', track: 'rgba(122,46,71,0.16)' },
    { grad: ['#EC9DB1', '#E588A0'], fg: '#FFFFFF', sub: '#FCE2E8', track: 'rgba(255,255,255,0.4)' },
    { grad: ['#DE6E8C', '#D45878'], fg: '#FFFFFF', sub: '#FCE2E8', track: 'rgba(255,255,255,0.4)' },
    { grad: ['#C24E72', '#A8405E'], fg: '#FFFFFF', sub: '#F7D2DD', track: 'rgba(255,255,255,0.4)' },
  ],
  care: [ // olive / sage
    { grad: ['#E4E7C8', '#D8DCB4'], fg: '#3F4516', sub: '#6E7A45', track: 'rgba(63,69,22,0.16)' },
    { grad: ['#BFC987', '#AEB970'], fg: '#33400F', sub: '#56612E', track: 'rgba(51,64,15,0.2)' },
    { grad: ['#97A65A', '#849447'], fg: '#FBFCEF', sub: '#EAEFCF', track: 'rgba(255,255,255,0.4)' },
    { grad: ['#74823F', '#616E33'], fg: '#FBFCEF', sub: '#EAEFCF', track: 'rgba(255,255,255,0.4)' },
  ],
  hospital: [ // warm taupe / cinnamon (Week 0)
    { grad: ['#EAE0D0', '#DFD3BF'], fg: '#4A3A28', sub: '#8A6A48', track: 'rgba(74,58,40,0.16)' },
    { grad: ['#CDA982', '#BE966B'], fg: '#FFFBF4', sub: '#F2E0CC', track: 'rgba(255,255,255,0.4)' },
    { grad: ['#B07F52', '#9C6C42'], fg: '#FFFBF4', sub: '#F2E0CC', track: 'rgba(255,255,255,0.4)' },
    { grad: ['#8A5E38', '#734C2C'], fg: '#FFFBF4', sub: '#EAD6BE', track: 'rgba(255,255,255,0.4)' },
  ],
};
const DEFAULT_PALETTE = PALETTES.grow;

function schemeForIndex(category: string, i: number, n: number): Scheme {
  const pal = PALETTES[category] ?? DEFAULT_PALETTE;
  if (i === 0 || i === n - 1) return pal[0];
  return pal[1 + ((i - 1) % (pal.length - 1))];
}

export default function ManualSwipeDeck({ story, category }: { story: StoryCard[]; category: string }) {
  const deck = story.length ? story : [];
  const [idx, setIdx] = useState(0);
  const [cardW, setCardW] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  // Auto-advance: animate the active segment, then move to the next card.
  // Stops on the last card. Re-runs whenever idx changes (incl. via tap).
  useEffect(() => {
    if (!deck.length) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STORY_MS, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) setIdx((i) => (i < deck.length - 1 ? i + 1 : i));
    });
    return () => anim.stop();
  }, [idx, deck.length, progress]);

  if (!deck.length) return null;
  const card = deck[idx] ?? deck[0];
  const scheme = schemeForIndex(category, idx, deck.length);

  // Tap right 70% → next (faster); tap left 30% → previous.
  const onTapCard = (e: GestureResponderEvent) => {
    select();
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
        <LinearGradient colors={scheme.grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.card}>
          <View style={styles.cardCircle} pointerEvents="none" />
          <HoneycombCorner color={scheme.fg} />

          {/* IG-story segmented progress bars */}
          <View style={styles.bars}>
            {deck.map((_, i) => (
              <View key={i} style={[styles.barTrack, { backgroundColor: scheme.track }]}>
                <Animated.View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: scheme.fg,
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
            <Text style={[styles.cardCount, { color: scheme.fg }]}>CARD {idx + 1} OF {deck.length}</Text>
          </View>

          {!!card.eyebrow && <Text style={[styles.eyebrow, { color: scheme.sub }]}>{card.eyebrow.toUpperCase()}</Text>}
          <Text style={[styles.cardTitle, { color: scheme.fg }]} numberOfLines={3}>{card.title}</Text>
          {!!card.say && <Text style={[styles.cardSay, { color: scheme.sub }]} numberOfLines={2}>{card.say}</Text>}
          <Text style={[styles.cardBody, { color: scheme.fg }]} numberOfLines={5}>{card.body}</Text>

          {/* IG-story-style link sticker — nested touchable wins over tap-to-advance */}
          {!!card.link && (
            <TouchableOpacity
              style={styles.sticker}
              activeOpacity={0.85}
              onPress={() => { tap(); Linking.openURL(card.link!.url).catch(() => {}); }}
              accessibilityRole="link"
              accessibilityLabel={card.link.label}
            >
              <View style={[styles.stickerDot, { backgroundColor: scheme.grad[0] }]}>
                <Text style={[styles.stickerGlyph, { color: scheme.fg }]}>{card.link.kind === 'shop' ? '🛍' : '↗'}</Text>
              </View>
              <Text style={styles.stickerText}>{card.link.label}</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
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
  combCorner: { position: 'absolute', top: -26, right: -18 },
  // progress bars
  bars: { flexDirection: 'row', gap: 5, marginBottom: 14 },
  barTrack: { flex: 1, height: 3, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCount: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.8, opacity: 0.85 },
  eyebrow: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.6, marginTop: 16, opacity: 0.9 },
  cardTitle: { fontFamily: FONTS.headerBold, fontSize: 36, lineHeight: 38, letterSpacing: -0.7, marginTop: 6 },
  cardSay: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', fontSize: 25, lineHeight: 27, marginTop: 6 },
  cardBody: { fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 22, marginTop: 'auto', paddingTop: 14, opacity: 0.96 },

  // IG-story link sticker
  sticker: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9,
    marginTop: 14, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 13,
    paddingLeft: 6, paddingRight: 14, paddingVertical: 6,
  },
  stickerDot: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stickerGlyph: { fontSize: 13 },
  stickerText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: '#43260F', letterSpacing: 0.2 },
});
