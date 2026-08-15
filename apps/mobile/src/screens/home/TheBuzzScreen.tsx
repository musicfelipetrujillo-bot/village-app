// TheBuzzScreen — weekly editorial "what the village is talking about"
// surface. Renders the current published issue when no issueId param is
// given, or a specific archived issue when one is (BuzzArchiveScreen links
// here with { issueId }). Every item pairs a trend source with a grounding
// source; the standing disclaimer is the one piece of copy on this screen
// that stays sober rather than V10 Gen Z voice (docs/THE_BUZZ_TRENDING.md §2).
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { theBuzzApi, type TheBuzzIssue, type TheBuzzItem } from '@api/theBuzz';
import { isNoSession } from '@/lib/requireSession';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

type Route = RouteProp<HomeStackParamList, 'TheBuzz'>;

function localized(item: TheBuzzItem, field: 'title' | 'summary' | 'myth_claim' | 'fact' | 'ask_provider', lang: 'en' | 'es'): string {
  const en = (item as any)[`${field}_en`] as string | null;
  const es = (item as any)[`${field}_es`] as string | null;
  return (lang === 'es' ? es : en) ?? en ?? '';
}

export default function TheBuzzScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';

  const [issue, setIssue] = React.useState<TheBuzzIssue | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = route.params?.issueId
          ? await theBuzzApi.getIssueById(route.params.issueId)
          : await theBuzzApi.getCurrentIssue();
        if (!cancelled) setIssue(data);
      } catch (e: any) {
        // `no_session` is an internal signal (the read ran before the auth
        // token was attached), never something to show a mother.
        if (!cancelled) setError(isNoSession(e) ? t('theBuzz.loadError') : (e?.message ?? t('theBuzz.loadError')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is a new
    // closure every render (useT() has no memoization); including it here
    // would refetch on every render, an infinite loop. Only issueId should
    // retrigger the fetch.
  }, [route.params?.issueId]);

  const newsItems = (issue?.items ?? []).filter((i) => i.kind === 'news');
  const mythItem = (issue?.items ?? []).find((i) => i.kind === 'myth_buster');

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={s.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('theBuzz.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#D96C88" /></View>
      ) : error ? (
        <View style={s.center}><Text style={s.errorText}>{error}</Text></View>
      ) : !issue ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🐝</Text>
          <Text style={s.emptyTitle}>{t('theBuzz.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('theBuzz.emptyBody')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.issueTitle}>{issue.title}</Text>

          <View style={s.list}>
            {newsItems.map((item, i) => (
              <BuzzItem key={item.id} item={item} kind="news" num={i + 1} lang={lang} t={t} />
            ))}
            {mythItem ? <BuzzItem item={mythItem} kind="myth" num={newsItems.length + 1} lang={lang} t={t} /> : null}
          </View>

          <Text style={s.disclaimer}>{t('theBuzz.disclaimer')}</Text>
        </ScrollView>
      )}
    </View>
  );
}

// Colour encodes the CATEGORY, not the item: every "trending this week" topic
// shares the rose hue; "myth vs fact" gets its own gold hue. So the colour
// tells you the type at a glance — the number chip + headline keep each card
// distinct within a category.
const TRENDING_HUE = { chip: '#D96C88', tint: '#FCEDEF', edge: 'rgba(217,108,136,0.16)', ink: '#A2455C' };
const MYTH_HUE = { chip: '#BE851F', tint: '#F8EECC', edge: 'rgba(190,133,31,0.28)', ink: '#8A6012' };

// A vibrant topic card — collapsed shows a coloured number chip + headline you
// can scan; tap opens the short read (fact/summary + optional "ask" + source).
function BuzzItem({ item, kind, num, lang, t }: {
  item: TheBuzzItem; kind: 'news' | 'myth'; num: number; lang: 'en' | 'es';
  t: (k: string, p?: any) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const isMyth = kind === 'myth';
  const hue = isMyth ? MYTH_HUE : TRENDING_HUE;
  const headline = isMyth ? localized(item, 'myth_claim', lang) : localized(item, 'title', lang);
  const body = isMyth ? localized(item, 'fact', lang) : localized(item, 'summary', lang);
  const ask = localized(item, 'ask_provider', lang);
  const tag = isMyth ? t('theBuzz.mythEyebrow') : t('theBuzz.trendingEyebrow');
  return (
    <View style={[s.card, { backgroundColor: hue.tint, borderColor: hue.edge }]}>
      <TouchableOpacity
        style={s.itemHead}
        activeOpacity={0.8}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={headline}
      >
        <View style={[s.numChip, { backgroundColor: hue.chip }]}><Text style={s.numChipT}>{String(num).padStart(2, '0')}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {isMyth ? <Text style={[s.itemTag, { color: hue.ink }]}>{tag}</Text> : null}
          <Text style={s.itemTitle}>{headline}</Text>
        </View>
        <Text style={[s.itemToggle, { color: hue.chip }, open && s.itemToggleOpen]}>›</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.itemBody}>
          <Text style={s.bodyText}>{body}</Text>
          {ask ? <Text style={s.askLine}>{ask}</Text> : null}
          <TouchableOpacity onPress={() => Linking.openURL(item.evidence_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.evidenceLinkA11y', { source: item.evidence_source_name })}>
            <Text style={[s.sourceLink, { color: hue.ink }]}>{t('theBuzz.groundedIn', { source: item.evidence_source_name })} ›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.v2_cream,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.10)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontSize: 30, color: '#D96C88', marginTop: -4 },
  headerTitle: { fontFamily: FONTS.headerBold, fontSize: 24, color: COLORS.v2_cocoa, letterSpacing: -0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorText: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, textAlign: 'center', lineHeight: 20, marginTop: 4 },

  scroll: { padding: 22, paddingTop: 20, paddingBottom: 48 },
  issueTitle: { fontFamily: FONTS.v2_display, fontSize: 22, lineHeight: 27, color: COLORS.v2_cocoa, letterSpacing: -0.3 },
  issueIntro: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: COLORS.v2_walnut, lineHeight: 20, marginTop: 7 },

  // Vibrant colour-cycled cards — each topic pops in its own hue, none blend
  list: { marginTop: 22, gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingVertical: 15, paddingHorizontal: 15 },
  numChip: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  // Only ONE bold per header — the headline. The numeral and the eyebrow are
  // wayfinding, not voice, so they sit a weight below it; three bolds in a row
  // made every card read as shouting and nothing scanned.
  numChipT: { fontFamily: FONTS.v2_mono_light, fontSize: 13, color: '#FFF9F2', letterSpacing: 0.3 },
  itemTag: { fontFamily: FONTS.v2_mono_light, fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 4 },
  // Article headlines sit in the LIGHT display weight (Bricolage 400), not the
  // 700 bold — a wall of bold headlines was the "too much bold" complaint. The
  // colour chip + size carry the hierarchy now; the headline just reads calmly.
  itemTitle: { fontFamily: FONTS.v2_display_regular, fontSize: 16.5, color: COLORS.v2_cocoa, letterSpacing: -0.1, lineHeight: 23 },
  itemToggle: { fontFamily: FONTS.v2_body, fontSize: 22, lineHeight: 24, marginTop: 3, width: 14, textAlign: 'center' },
  itemToggleOpen: { transform: [{ rotate: '90deg' }] },
  itemBody: { paddingLeft: 60, paddingRight: 15, paddingBottom: 16, marginTop: -4, gap: 10 },
  bodyText: { fontFamily: FONTS.v2_body, fontSize: 14.5, color: '#4A3420', lineHeight: 22 },
  askLine: { fontFamily: FONTS.v2_body, fontSize: 13, color: '#6B4A38', lineHeight: 19, fontStyle: 'italic' },
  sourceLink: { fontFamily: FONTS.v2_link, fontSize: 12.5 },
  disclaimer: {
    fontFamily: FONTS.v2_body, fontSize: 11, lineHeight: 16, color: '#A6957F',
    textAlign: 'center', marginTop: 26, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(61,31,14,0.10)',
  },
});
