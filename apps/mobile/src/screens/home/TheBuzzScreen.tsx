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
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={s.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('theBuzz.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.v2_cinnamon} /></View>
      ) : error ? (
        <View style={s.center}><Text style={s.errorText}>{error}</Text></View>
      ) : !issue ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🐝</Text>
          <Text style={s.emptyTitle}>{t('theBuzz.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('theBuzz.emptyBody')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.disclaimer}>{t('theBuzz.disclaimer')}</Text>

          <Text style={s.issueTitle}>{issue.title}</Text>
          <Text style={s.issueIntro}>{issue.intro}</Text>

          {newsItems.map((item) => (
            <BuzzNewsCard key={item.id} item={item} lang={lang} t={t} />
          ))}

          {mythItem ? <BuzzMythCard item={mythItem} lang={lang} t={t} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

function BuzzNewsCard({ item, lang, t }: { item: TheBuzzItem; lang: 'en' | 'es'; t: (k: string, p?: any) => string }) {
  return (
    <View style={s.card}>
      <Text style={s.cardEyebrow}>{t('theBuzz.trendingEyebrow')}</Text>
      <Text style={s.cardTitle}>{localized(item, 'title', lang)}</Text>
      <Text style={s.cardBody}>{localized(item, 'summary', lang)}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(item.evidence_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.evidenceLinkA11y', { source: item.evidence_source_name })}>
        <Text style={s.sourceLink}>{t('theBuzz.groundedIn', { source: item.evidence_source_name })}</Text>
      </TouchableOpacity>
      <Text style={s.askProvider}>{localized(item, 'ask_provider', lang)}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(item.trend_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.trendLinkA11y', { source: item.trend_source_name })}>
        <Text style={s.trendSource}>{t('theBuzz.viaSource', { source: item.trend_source_name })}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BuzzMythCard({ item, lang, t }: { item: TheBuzzItem; lang: 'en' | 'es'; t: (k: string, p?: any) => string }) {
  return (
    <View style={[s.card, s.mythCard]}>
      <Text style={s.cardEyebrow}>{t('theBuzz.mythEyebrow')}</Text>
      <Text style={s.mythClaim}>{localized(item, 'myth_claim', lang)}</Text>
      <Text style={s.factLabel}>{t('theBuzz.factLabel')}</Text>
      <Text style={s.cardBody}>{localized(item, 'fact', lang)}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(item.evidence_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.evidenceLinkA11y', { source: item.evidence_source_name })}>
        <Text style={s.sourceLink}>{t('theBuzz.groundedIn', { source: item.evidence_source_name })}</Text>
      </TouchableOpacity>
      <Text style={s.askProvider}>{localized(item, 'ask_provider', lang)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.v2_cream,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.13)',
  },
  back: { fontSize: 15, color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_link },
  headerTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: COLORS.v2_cocoa },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorText: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, textAlign: 'center', lineHeight: 20, marginTop: 4 },

  scroll: { padding: 20, paddingBottom: 48, gap: 14 },
  disclaimer: {
    fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: COLORS.v2_walnut,
    backgroundColor: COLORS.v2_parchment, padding: 12, borderRadius: 12,
  },
  issueTitle: { fontFamily: FONTS.v2_display, fontSize: 22, color: COLORS.v2_cocoa, marginTop: 4 },
  issueIntro: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, lineHeight: 20 },

  card: {
    backgroundColor: COLORS.v2_card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(217,108,136,0.18)', gap: 8,
  },
  mythCard: { backgroundColor: '#FDECEF', borderColor: 'rgba(194,85,111,0.25)' },
  cardEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.2, color: COLORS.v2_cinnamon, textTransform: 'uppercase' },
  cardTitle: { fontFamily: FONTS.v2_display, fontSize: 17, color: COLORS.v2_cocoa },
  cardBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, lineHeight: 20 },
  mythClaim: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, lineHeight: 20, fontStyle: 'italic' },
  factLabel: { fontFamily: FONTS.v2_bold, fontSize: 11, letterSpacing: 0.6, color: COLORS.v2_cocoa, textTransform: 'uppercase' },
  sourceLink: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: COLORS.v2_cinnamon },
  askProvider: { fontFamily: FONTS.v2_body, fontSize: 13, color: COLORS.v2_cocoa, backgroundColor: COLORS.v2_parchment, padding: 10, borderRadius: 10 },
  trendSource: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: COLORS.v2_walnut },
});
