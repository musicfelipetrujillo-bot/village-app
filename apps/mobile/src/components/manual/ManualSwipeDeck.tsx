// ManualSwipeDeck — Instagram-Stories-style auto-playing deck for a Manual chapter.
//
// Renders the chapter's `story` cards (from manualWeekContent). Cards AUTO-ADVANCE
// like IG stories: each fills a segmented progress bar over STORY_MS, then moves
// to the next. Tap the right side to skip forward faster, the left side to go
// back. Each card carries its OWN palette color (ink/rose/honey/caramel/blush).
// The shop/learn "link sticker" stays tappable (nested touchable wins).
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TouchableOpacity, Animated, Linking, Image,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '@utils/constants';
import type { StoryCard, CardColor } from '@/manual/manualWeekContent';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');
const STORY_MS = 5000; // how long each card plays before auto-advancing

// Brand-palette card schemes (matched to the design kit's Week-1 CB map).
type Scheme = { grad: [string, string]; fg: string; sub: string; track: string };
const SCHEMES: Record<CardColor, Scheme> = {
  ink:     { grad: ['#4A2E18', '#2E1C0F'], fg: '#FCF6EE', sub: '#F2C84B', track: 'rgba(255,255,255,0.4)' },
  rose:    { grad: ['#D44E72', '#B43E60'], fg: '#FFFFFF', sub: '#F2C84B', track: 'rgba(255,255,255,0.4)' },
  honey:   { grad: ['#F2C84B', '#E3B23A'], fg: '#3D2817', sub: '#A23E5E', track: 'rgba(67,38,15,0.22)' },
  caramel: { grad: ['#C8814A', '#A8693A'], fg: '#FCF6EE', sub: '#FCE9CF', track: 'rgba(255,255,255,0.4)' },
  blush:   { grad: ['#F7CDD3', '#EFB3BE'], fg: '#C25A78', sub: '#3D2817', track: 'rgba(67,38,15,0.22)' },
};

// Color rhythm by POSITION (design logic): soft blush bookends to open and
// close, with the middle cards cycling rose → honey → caramel → ink. Holds a
// consistent, pleasant sequence regardless of card count, and never opens or
// ends on the dark ink card.
const MIDDLE: CardColor[] = ['rose', 'honey', 'caramel', 'ink'];
function schemeForIndex(i: number, n: number): Scheme {
  if (i === 0 || i === n - 1) return SCHEMES.blush;
  return SCHEMES[MIDDLE[(i - 1) % MIDDLE.length]];
}

export default function ManualSwipeDeck({ story }: { story: StoryCard[] }) {
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
  const scheme = schemeForIndex(idx, deck.length);

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
        <LinearGradient colors={scheme.grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.card}>
          <View style={styles.cardCircle} pointerEvents="none" />

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
            <Image source={VILLIE_BEE} style={styles.bee} resizeMode="contain" />
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
              onPress={() => Linking.openURL(card.link!.url).catch(() => {})}
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
  // progress bars
  bars: { flexDirection: 'row', gap: 5, marginBottom: 14 },
  barTrack: { flex: 1, height: 3, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCount: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.8, opacity: 0.85 },
  bee: { width: 32, height: 32 },
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
