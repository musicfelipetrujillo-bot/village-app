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
        if (!cancelled) setError(e?.message ?? t('theBuzz.loadError'));
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
        <View style={s.center}><ActivityIndicator color="#C24A63" /></View>
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
          {issue.intro ? <Text style={s.issueIntro} numberOfLines={2}>{issue.intro}</Text> : null}

          <View style={s.list}>
            {newsItems.map((item, i) => (
              <BuzzItem key={item.id} item={item} kind="news" num={i + 1} lang={lang} t={t} first={i === 0} />
            ))}
            {mythItem ? <BuzzItem item={mythItem} kind="myth" num={newsItems.length + 1} lang={lang} t={t} first={newsItems.length === 0} /> : null}
          </View>

          <Text style={s.disclaimer}>{t('theBuzz.disclaimer')}</Text>
        </ScrollView>
      )}
    </View>
  );
}

// One editorial topic — a numbered headline you can scan; tap to open the short
// read (fact/summary + optional "ask" + source). Collapsed by default so the
// screen reads as a clean list of headlines, not a wall of text.
function BuzzItem({ item, kind, num, lang, t, first }: {
  item: TheBuzzItem; kind: 'news' | 'myth'; num: number; lang: 'en' | 'es';
  t: (k: string, p?: any) => string; first: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const isMyth = kind === 'myth';
  const headline = isMyth ? localized(item, 'myth_claim', lang) : localized(item, 'title', lang);
  const body = isMyth ? localized(item, 'fact', lang) : localized(item, 'summary', lang);
  const ask = localized(item, 'ask_provider', lang);
  const tag = isMyth ? t('theBuzz.mythEyebrow') : t('theBuzz.trendingEyebrow');
  return (
    <View>
      {!first ? <View style={s.rule} /> : null}
      <TouchableOpacity
        style={s.itemHead}
        activeOpacity={0.7}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={headline}
      >
        <Text style={s.num}>{String(num).padStart(2, '0')}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.itemTag, isMyth && s.itemTagMyth]}>{tag}</Text>
          <Text style={s.itemTitle}>{headline}</Text>
        </View>
        <Text style={[s.itemToggle, open && s.itemToggleOpen]}>›</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.itemBody}>
          <Text style={s.bodyText}>{body}</Text>
          {ask ? <Text style={s.askLine}>{ask}</Text> : null}
          <TouchableOpacity onPress={() => Linking.openURL(item.evidence_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.evidenceLinkA11y', { source: item.evidence_source_name })}>
            <Text style={s.sourceLink}>{t('theBuzz.groundedIn', { source: item.evidence_source_name })} ›</Text>
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
  backChevron: { fontSize: 30, color: '#C24A63', marginTop: -4 },
  headerTitle: { fontFamily: FONTS.headerBold, fontSize: 24, color: COLORS.v2_cocoa, letterSpacing: -0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorText: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, textAlign: 'center', lineHeight: 20, marginTop: 4 },

  scroll: { padding: 22, paddingTop: 20, paddingBottom: 48 },
  issueTitle: { fontFamily: FONTS.v2_display, fontSize: 27, lineHeight: 31, color: COLORS.v2_cocoa, letterSpacing: -0.5 },
  issueIntro: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, lineHeight: 20, marginTop: 7 },

  // Editorial list — numbered headlines, hairline-divided, collapsed by default
  list: { marginTop: 22 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,14,0.11)' },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16 },
  num: { fontFamily: FONTS.v2_display, fontSize: 15, color: '#C6A98E', marginTop: 2, width: 20 },
  itemTag: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.5, color: '#C24A63', textTransform: 'uppercase', marginBottom: 4 },
  itemTagMyth: { color: '#A8466B' },
  itemTitle: { fontFamily: FONTS.v2_display, fontSize: 18, color: COLORS.v2_cocoa, letterSpacing: -0.3, lineHeight: 23 },
  itemToggle: { fontFamily: FONTS.v2_body, fontSize: 22, color: '#C6B29A', lineHeight: 24, marginTop: 4, width: 14, textAlign: 'center' },
  itemToggleOpen: { color: '#9E8B72', transform: [{ rotate: '90deg' }] },
  itemBody: { paddingLeft: 34, paddingRight: 2, paddingBottom: 18, marginTop: -4, gap: 10 },
  bodyText: { fontFamily: FONTS.v2_body, fontSize: 15, color: '#5C462F', lineHeight: 23 },
  askLine: { fontFamily: FONTS.v2_body, fontSize: 13, color: '#8A5A66', lineHeight: 19, fontStyle: 'italic' },
  sourceLink: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: '#C24A63' },
  disclaimer: {
    fontFamily: FONTS.v2_body, fontSize: 11, lineHeight: 16, color: '#A6957F',
    textAlign: 'center', marginTop: 26, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(61,31,14,0.10)',
  },
});
