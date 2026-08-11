// ManualVerticalStory — the week's teaching as ONE compact accordion, not a
// stack of same-color hero boxes (founder 2026-08-10: "more concise, don't
// scroll a ton; smaller boxes"). Collapsed you see just the titles — the whole
// week fits a glance; tap a line to open its detail inline. Same StoryCard data;
// chapter color lives only as a small accent so contrast stays high and nothing
// is over-bold.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { FONTS, COLORS } from '@utils/constants';
import type { StoryCard } from '@/manual/manualWeekContent';

type Tint = { ink: string; border: string };
const TINT: Record<string, Tint> = {
  sleep:    { ink: '#A9692F', border: 'rgba(90,58,30,0.13)' },
  feed:     { ink: '#9A6E12', border: 'rgba(90,64,18,0.13)' },
  grow:     { ink: '#9E2F4C', border: 'rgba(122,46,71,0.13)' },
  care:     { ink: '#63702F', border: 'rgba(63,69,22,0.13)' },
  hospital: { ink: '#8A5E38', border: 'rgba(74,58,40,0.13)' },
};
const DEFAULT_TINT = TINT.grow;

export default function ManualVerticalStory({ story, category, lang = 'en' }: {
  story: StoryCard[]; category: string; lang?: 'en' | 'es';
}) {
  if (!story || story.length === 0) return null;
  const tint = TINT[category] ?? DEFAULT_TINT;
  return (
    <View style={styles.wrap}>
      <View style={[styles.group, { borderColor: tint.border }]}>
        {story.map((card, i) => (
          <StoryRow key={i} card={card} tint={tint} lang={lang} first={i === 0} defaultOpen={i === 0} />
        ))}
      </View>
    </View>
  );
}

function StoryRow({ card, tint, lang, first, defaultOpen }: {
  card: StoryCard; tint: Tint; lang: 'en' | 'es'; first: boolean; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = (card.title ?? '').replace(/\n/g, ' ');
  return (
    <View>
      {!first ? <View style={[styles.divider, { backgroundColor: tint.border }]} /> : null}
      <TouchableOpacity
        style={styles.head}
        activeOpacity={0.7}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View style={[styles.dot, { backgroundColor: tint.ink }]} />
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.toggle, { color: tint.ink }]}>{open ? '−' : '+'}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.body}>
          {card.say ? <Text style={[styles.say, { color: tint.ink }]}>{card.say}</Text> : null}
          {card.body ? <Text style={styles.bodyText}>{card.body}</Text> : null}
          {card.link ? (
            <TouchableOpacity
              style={styles.link}
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
            <Text style={styles.ftc}>
              {lang === 'es' ? 'Enlace de afiliado — podemos ganar una comisión.' : 'Affiliate link — we may earn a small commission.'}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 14 },
  group: {
    backgroundColor: COLORS.v2_paper, borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 41 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 15 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  title: { flex: 1, fontFamily: FONTS.v3_display, fontSize: 15.5, lineHeight: 20, letterSpacing: -0.2, color: '#43260F' },
  toggle: { fontFamily: FONTS.v2_body, fontSize: 22, lineHeight: 22, marginTop: -2 },
  body: { paddingLeft: 34, paddingRight: 16, paddingBottom: 15, marginTop: -2 },
  say: { fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  bodyText: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, color: '#6B5540', marginTop: 6 },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 12,
    backgroundColor: '#FBF4E6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
  },
  linkGlyph: { fontSize: 12 },
  linkText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, letterSpacing: 0.2 },
  ftc: { fontFamily: FONTS.v2_body, fontSize: 10, color: '#9A8672', marginTop: 8, letterSpacing: 0.2 },
});
