// Global search — the top-left menu's home. "Find or do anything."
//
// v1 is a command-palette + AI fallback (no backend): it matches the query
// against every place you can go in the app, and ALWAYS offers "Ask Villie"
// for the raw query — so any search yields a useful action even when nothing
// structured matches. v2 will fold in Manual content + gear/specialist/perk
// text search. Lives in HomeNavigator, so nav mirrors HomeScreenV3.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FONTS, COLORS } from '@utils/constants';
import { useUserStore } from '@store/user';
import { BackButton } from '@components/shared/BackButton';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';

const ROSE = '#C24A63', ROSE_DEEP = '#9E2F4C', BLUSH = '#E894AC';
const INK = '#43260F', INKSOFT = '#7A5A3A', MUTED = '#A6957F';
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

type Dest = {
  key: string; emoji: string; label: string; sub: string;
  keywords: string[]; run: (nav: any) => void;
};

// Every place in the app you can land, with search aliases. Nav calls mirror
// HomeScreenV3 (Search is a HomeNavigator screen): same-stack via navigate,
// tabs via getParent(), root modals via getParent().getParent().
const DESTINATIONS: Dest[] = [
  { key: 'milk', emoji: '🍼', label: 'Milk Hub', sub: 'donate or find breast milk',
    keywords: ['milk', 'breast', 'donor', 'donate', 'lactation', 'stash', 'vault', 'pump', 'oz'],
    run: (n) => n.getParent()?.navigate('Milk') },
  { key: 'care', emoji: '🩺', label: 'Care', sub: 'find a specialist',
    keywords: ['care', 'specialist', 'doctor', 'ob', 'gyn', 'doula', 'midwife', 'pediatrician', 'sleep coach', 'pelvic', 'therapist', 'ppd', 'expert', 'appointment', 'book'],
    run: (n) => n.getParent()?.navigate('Experts') },
  { key: 'gear', emoji: '🧸', label: 'Baby gear', sub: 'buy & sell secondhand',
    keywords: ['gear', 'stroller', 'carrier', 'crib', 'toy', 'clothes', 'secondhand', 'sell', 'buy', 'marketplace', 'listing'],
    run: (n) => n.getParent()?.navigate('Gear') },
  { key: 'plans', emoji: '📅', label: 'Plans', sub: 'events & the village',
    keywords: ['plans', 'village', 'community', 'rsvp', 'meetup', 'webinar'],
    run: (n) => n.getParent()?.navigate('Village') },
  { key: 'manual', emoji: '📖', label: 'The Manual', sub: "this week's guide",
    keywords: ['manual', 'guide', 'learn', 'read', 'week', 'story', 'milestone', 'tummy time', 'wake windows'],
    run: (n) => n.getParent()?.navigate('Manual', { screen: 'ManualHome' }) },
  { key: 'beforebaby', emoji: '🎒', label: 'Before baby arrives', sub: 'hospital bag + essentials',
    keywords: ['before baby', 'hospital bag', 'pack', 'delivery', 'birth', 'prepare', 'essentials'],
    run: (n) => n.getParent()?.navigate('Manual', { screen: 'BeforeBaby' }) },
  { key: 'insights', emoji: '📈', label: "Baby's patterns", sub: 'feed, sleep & diaper logs',
    keywords: ['insights', 'patterns', 'tracker', 'log', 'feed', 'sleep', 'diaper', 'trends', 'track'],
    run: (n) => n.navigate('Insights') },
  { key: 'dayplan', emoji: '🗓️', label: 'Plan my day', sub: 'naps + pumps around your schedule',
    keywords: ['plan my day', 'calendar', 'schedule', 'nap', 'pump', 'routine'],
    run: (n) => n.navigate('DayPlan') },
  { key: 'daysheet', emoji: '📋', label: 'Day sheet', sub: 'hand off to a caregiver',
    keywords: ['day sheet', 'caregiver', 'nanny', 'grandma', 'babysitter', 'handoff', 'share'],
    run: (n) => n.navigate('DaySheetList') },
  { key: 'mama', emoji: '✦', label: "Mama's corner", sub: 'your space',
    keywords: ["mama's corner", 'mama', 'self care', 'recovery', 'postpartum', 'you'],
    run: (n) => n.navigate('MomHub') },
  { key: 'boxes', emoji: '🎁', label: 'Villie Boxes', sub: 'curated stage bundles',
    keywords: ['boxes', 'bundle', 'box', 'delivery box', 'newborn box', 'mama box', 'shop'],
    run: (n) => n.navigate('BoxesHub') },
  { key: 'picks', emoji: '⭐', label: 'Villie Picks', sub: 'perks & tested products',
    keywords: ['picks', 'perks', 'deals', 'discount', 'products', 'recommended'],
    run: (n) => n.navigate('PerksList') },
  { key: 'buzz', emoji: '🐝', label: 'The Buzz', sub: "this week's trending topics",
    keywords: ['buzz', 'trending', 'news', 'myth', 'topics'],
    run: (n) => n.navigate('TheBuzz') },
  { key: 'events', emoji: '🎟️', label: 'Events', sub: 'meetups & webinars',
    keywords: ['events', 'meetup', 'webinar', 'rsvp', 'class'],
    run: (n) => n.navigate('EventsList') },
  { key: 'checkin', emoji: '💗', label: 'Daily check-in', sub: 'how are you today?',
    keywords: ['check in', 'checkin', 'mood', 'feelings', 'how are you', 'vent'],
    run: (n) => n.navigate('DailyCheckin') },
  { key: 'notifications', emoji: '🔔', label: 'Notifications', sub: 'your inbox',
    keywords: ['notifications', 'inbox', 'alerts', 'bell'],
    run: (n) => n.navigate('Notifications') },
  { key: 'profile', emoji: '👤', label: 'Profile & settings', sub: 'account · preferences',
    keywords: ['profile', 'settings', 'account', 'me', 'preferences', 'edit', 'password', 'email', 'radius', 'sign out', 'logout', 'saved', 'language'],
    run: (n) => n.getParent()?.navigate('Profile') },
  { key: 'emergency', emoji: '🚑', label: 'In an emergency', sub: 'CPR, fever, when to call',
    keywords: ['emergency', 'cpr', 'fever', 'choking', '911', 'urgent', 'dehydration'],
    run: (n) => n.getParent()?.getParent()?.navigate('QuickReference') },
];

const SUGGESTIONS = ['sleep', 'lactation', 'gear', 'day sheet', 'boxes', 'emergency'];

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const lang = (useUserStore((s) => s.profile?.preferred_language) ?? 'en') as 'en' | 'es';
  const es = lang === 'es';
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return [];
    const words = query.split(/\s+/);
    return DESTINATIONS.filter((d) => {
      const hay = (d.label + ' ' + d.sub + ' ' + d.keywords.join(' ')).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [query]);

  const askVillie = () => {
    navigation.getParent()?.getParent()?.navigate('AIHelpChat', { seed: q.trim(), autosend: true });
  };

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.40)', 'rgba(247,197,203,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.5, 1]}
        style={styles.pageWash}
      />

      <View style={styles.header}>
        <BackButton color={ROSE} />
        <View style={styles.dot} />
        <Text style={styles.hTitle}>{es ? 'buscar' : 'search'}</Text>
        <View style={styles.beeWrap}><Image source={VILLIE_BEE} style={styles.bee} /></View>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder={es ? 'busca o pregunta lo que sea…' : 'search or ask anything…'}
          placeholderTextColor={MUTED}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => { if (q.trim()) askVillie(); }}
          accessibilityLabel={es ? 'Buscar' : 'Search'}
        />
        {q.length > 0 ? (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={es ? 'Borrar' : 'Clear'}>
            <Text style={styles.clear}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {query ? (
          <>
            {/* Ask Villie — always the first, most-useful result */}
            <TouchableOpacity activeOpacity={0.92} onPress={askVillie} accessibilityRole="button"
              accessibilityLabel={es ? `Pregúntale a Villie: ${q}` : `Ask Villie: ${q}`}>
              <LinearGradient colors={[ROSE, BLUSH]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.askCard}>
                <View style={styles.askBee}><Image source={VILLIE_BEE} style={{ width: 20, height: 20 }} resizeMode="contain" /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.askEyebrow}>{es ? 'PREGÚNTALE A VILLIE' : 'ASK VILLIE'}</Text>
                  <Text style={styles.askText} numberOfLines={2}>&ldquo;{q.trim()}&rdquo;</Text>
                </View>
                <Text style={styles.askArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>

            {results.length > 0 ? (
              <>
                <Text style={styles.groupLabel}>{es ? 'IR A' : 'GO TO'}</Text>
                <View style={styles.group}>
                  {results.map((d, i) => (
                    <View key={d.key}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <TouchableOpacity style={styles.row} activeOpacity={0.7}
                        onPress={() => d.run(navigation)}
                        accessibilityRole="button" accessibilityLabel={d.label}>
                        <View style={styles.rowIcon}><Text style={{ fontSize: 17 }}>{d.emoji}</Text></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowLabel}>{d.label}</Text>
                          <Text style={styles.rowSub} numberOfLines={1}>{d.sub}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.noneNote}>
                {es ? 'Nada por aquí — pero Villie puede ayudarte con eso ☝️' : 'Nothing here — but Villie can help with that ☝️'}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.emptyLead}>{es ? 'Busca una función, o pregúntale a Villie.' : 'Find a feature, or just ask Villie.'}</Text>
            <View style={styles.chipWrap}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={styles.chip} activeOpacity={0.8} onPress={() => setQ(s)} accessibilityRole="button" accessibilityLabel={s}>
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingTop: 58, paddingBottom: 6, paddingHorizontal: 18,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ROSE },
  hTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: INK },
  beeWrap: { marginLeft: 'auto', opacity: 0.65 },
  bee: { width: 38, height: 38, transform: [{ rotate: '-12deg' }] },

  searchBar: {
    marginHorizontal: 18, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.v2_paper, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(194,74,99,0.30)',
  },
  searchGlyph: { fontSize: 20, color: ROSE, marginTop: -1 },
  input: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 15, color: INK, padding: 0 },
  clear: { fontSize: 15, color: MUTED, paddingHorizontal: 2 },

  scroll: { padding: 18, paddingBottom: 60 },

  // Ask Villie card
  askCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
    shadowColor: ROSE_DEEP, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.20, shadowRadius: 16, elevation: 3,
  },
  askBee: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  askEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.6, color: 'rgba(255,253,248,0.9)', fontWeight: '600' },
  askText: { fontFamily: FONTS.v3_display, fontSize: 17, color: '#FFFDF8', letterSpacing: -0.3, marginTop: 3 },
  askArrow: { fontFamily: FONTS.v2_bold, fontSize: 18, color: '#FFFDF8' },

  groupLabel: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#B0637E', marginTop: 22, marginBottom: 10 },
  group: {
    backgroundColor: COLORS.v2_paper, borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(122,74,40,0.12)', marginLeft: 58 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15 },
  rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F6EAF0', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: FONTS.v3_display, fontSize: 16, color: INK, letterSpacing: -0.3 },
  rowSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: INKSOFT, marginTop: 1 },
  chevron: { fontFamily: FONTS.v2_link, fontSize: 20, color: '#C9B7A2' },

  noneNote: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: INKSOFT, lineHeight: 20, marginTop: 20, textAlign: 'center' },

  emptyLead: { fontFamily: FONTS.v3_display, fontSize: 18, color: INK, letterSpacing: -0.3, marginTop: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  chip: {
    backgroundColor: COLORS.v2_paper, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(194,74,99,0.24)',
  },
  chipText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: ROSE },
});
