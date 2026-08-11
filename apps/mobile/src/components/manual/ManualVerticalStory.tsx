// ManualVerticalStory — the week's story content as a calm vertical scroll,
// replacing the horizontal ManualSwipeDeck (founder 2026-08-10: "drop the swipe
// cards, less is more"). Same StoryCard data; instead of full-gradient cards you
// swipe one at a time, each card is a light chapter-tinted block you read down
// the page. Chapter colors still live here (per the brand kit), just softened to
// a light tint + readable ink so the screen feels digestible, not loud.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { FONTS } from '@utils/constants';
import type { StoryCard } from '@/manual/manualWeekContent';

type Tint = { bg: string; ink: string; sub: string; border: string };
const TINT: Record<string, Tint> = {
  sleep:    { bg: '#F6E7D6', ink: '#5A3A1E', sub: '#A9692F', border: 'rgba(90,58,30,0.14)' },
  feed:     { bg: '#F9EDCF', ink: '#5A4012', sub: '#9A6E12', border: 'rgba(90,64,18,0.14)' },
  grow:     { bg: '#FBE3E9', ink: '#7A2E47', sub: '#9E2F4C', border: 'rgba(122,46,71,0.14)' },
  care:     { bg: '#ECEFD6', ink: '#3F4516', sub: '#63702F', border: 'rgba(63,69,22,0.14)' },
  hospital: { bg: '#F0E7D8', ink: '#4A3A28', sub: '#8A6A48', border: 'rgba(74,58,40,0.14)' },
};
const DEFAULT_TINT = TINT.grow;

export default function ManualVerticalStory({ story, category, lang = 'en' }: {
  story: StoryCard[]; category: string; lang?: 'en' | 'es';
}) {
  if (!story || story.length === 0) return null;
  const tint = TINT[category] ?? DEFAULT_TINT;

  return (
    <View style={styles.wrap}>
      {story.map((card, i) => (
        <View key={i} style={[styles.card, { backgroundColor: tint.bg, borderColor: tint.border }]}>
          {card.eyebrow ? (
            <Text style={[styles.eyebrow, { color: tint.sub }]}>{card.eyebrow.toUpperCase()}</Text>
          ) : null}
          <Text style={[styles.title, { color: tint.ink }]}>{card.title}</Text>
          {card.say ? <Text style={[styles.say, { color: tint.sub }]}>{card.say}</Text> : null}
          {card.body ? <Text style={[styles.body, { color: tint.ink }]}>{card.body}</Text> : null}

          {card.link ? (
            <TouchableOpacity
              style={[styles.link, { borderColor: tint.border }]}
              activeOpacity={0.8}
              onPress={() => Linking.openURL(card.link!.url).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={card.link.label}
            >
              <Text style={styles.linkGlyph}>{card.link.kind === 'shop' ? '🛍' : '↗'}</Text>
              <Text style={[styles.linkText, { color: tint.ink }]} numberOfLines={1}>{card.link.label}</Text>
            </TouchableOpacity>
          ) : null}

          {card.link?.kind === 'shop' ? (
            <Text style={[styles.ftc, { color: tint.sub }]}>
              {lang === 'es' ? 'Enlace de afiliado — podemos ganar una comisión.' : 'Affiliate link — we may earn a small commission.'}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 14, gap: 12 },
  card: { borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  eyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.6, fontWeight: '500', marginBottom: 6, opacity: 0.9 },
  title: { fontFamily: FONTS.v3_display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  say: { fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 18, fontStyle: 'italic', marginTop: 6 },
  body: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, marginTop: 10 },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    marginTop: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth,
  },
  linkGlyph: { fontSize: 13 },
  linkText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, letterSpacing: 0.2 },
  ftc: { fontFamily: FONTS.v2_body, fontSize: 10, marginTop: 8, letterSpacing: 0.2, opacity: 0.9 },
});
