// Discover — the "everywhere villie can take you" hub (raspberry rebrand,
// 2026-08-08). Reachable from the Home top-bar menu. Redesigned from a flat
// emoji grid into an editorial directory: a raspberry hero, a featured
// ask-villie front-door card (the assistant is the app's entry point), then the
// destinations grouped into meaningful sections — "your village" (the verticals)
// and "this week" (time-bound) — each a wide card with a custom icon + accent.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useUserStore } from '@store/user';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

const T = {
  cream: '#FCF7EF', paper: '#FFFCF6', cocoa: '#43260F', walnut: '#7A4A24',
  rasp: '#D0216A', berry: '#6E1A47', gold: '#DA9A2C', coral: '#E98A6A',
};

const ICON = {
  droplet:     'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  stethoscope: 'M6 3v6a4 4 0 008 0V3M5 3h2m6 0h2m-3 11v2a5 5 0 0010 0v-1m-1-2a2 2 0 100-4 2 2 0 000 4z',
  bag:         'M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 016 0v2',
  calendar:    'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  gift:        'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M8.5 7C6.6 7 5.5 4 7 3.2 8.6 2.4 12 7 12 7m0 0s3.4-4.6 5-3.8C18.5 4 17.4 7 15.5 7',
  mic:         'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4M9 21h6',
  arrow:       'M5 12h14M13 5l7 7-7 7',
} as const;

function Glyph({ d, color, size = 24, sw = 1.9 }: { d: string; color: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 }} />
      <Text style={styles.eyebrow}>{children}</Text>
    </View>
  );
}

type Dest = { key: string; title: string; desc: string; icon: keyof typeof ICON; accent: string; tint: string; go: () => void };

function WideCard({ d }: { d: Dest }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={d.go} accessibilityRole="button" accessibilityLabel={`${d.title}. ${d.desc}`}>
      <View style={[styles.cardIcon, { backgroundColor: d.tint }]}>
        <Glyph d={ICON[d.icon]} color={d.accent} size={24} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>{d.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{d.desc}</Text>
      </View>
      <Glyph d={ICON.arrow} color={d.accent} size={18} sw={2.2} />
    </TouchableOpacity>
  );
}

export default function DiscoverHomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const L = lang === 'es';

  const tabParent = navigation.getParent();
  const askVillie = () => tabParent?.getParent()?.navigate('AIHelpChat');

  const village: Dest[] = [
    { key: 'milk', icon: 'droplet', accent: T.rasp, tint: '#FCE1EC',
      title: L ? 'Milk Hub' : 'Milk Hub', desc: L ? 'Tu reserva y leche de otras mamás.' : 'Your stash, plus peer milk.',
      go: () => tabParent?.navigate('Milk') },
    { key: 'care', icon: 'stethoscope', accent: T.coral, tint: '#FBE5DD',
      title: L ? 'Cuidado' : 'Care', desc: L ? 'Doctores, doulas, lactación — y manos extra.' : 'Doctors, doulas, lactation — and extra hands.',
      go: () => tabParent?.navigate('Experts') },
    { key: 'gear', icon: 'bag', accent: T.gold, tint: '#F7ECD2',
      title: L ? 'Artículos' : 'Baby Gear', desc: L ? 'De segunda mano de mamás reales.' : 'Hand-me-downs from real moms.',
      go: () => tabParent?.navigate('Gear') },
  ];

  const thisWeek: Dest[] = [
    { key: 'events', icon: 'calendar', accent: T.berry, tint: '#EBDCE4',
      title: L ? 'Eventos' : 'Events', desc: L ? 'Clases, círculos, café de verdad.' : 'Classes, circles, real coffee.',
      go: () => navigation.navigate('EventsList') },
    { key: 'perks', icon: 'gift', accent: '#C13A72', tint: '#F8DFEA',
      title: L ? 'Beneficios' : 'Perks', desc: L ? 'Ofertas y muestras para tu etapa.' : 'Deals & samples for your stage.',
      go: () => navigation.navigate('PerksList') },
  ];

  return (
    <View style={styles.container}>
      {/* Raspberry hero */}
      <LinearGradient
        colors={['#F6A7C6', '#DE6193', '#A8477A']}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 6 }]}
      >
        <View style={styles.heroTop}>
          <BackButton color="#FFF7EE" />
          <View style={{ width: 44 }} />
        </View>
        <Image source={VILLIE_BEE} resizeMode="contain" style={styles.heroBee} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <View style={styles.heroEyebrowBar} />
          <Text style={styles.heroEyebrow}>{L ? 'explorar' : 'explore'}</Text>
        </View>
        <Text style={styles.heroTitle}>
          {L ? 'Todo tu ' : 'Everywhere your '}
          <Text style={styles.heroTitleEm}>{L ? 'village.' : 'village.'}</Text>
        </Text>
        <Text style={styles.heroSub}>{L ? 'Cada rincón de Villie, en un solo lugar.' : 'Every corner of villie, in one place.'}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Featured — ask villie, the front door */}
        <TouchableOpacity activeOpacity={0.92} onPress={askVillie} accessibilityRole="button" accessibilityLabel={L ? 'Pregúntale a Villie' : 'Ask villie anything'}>
          <LinearGradient colors={['#D0216A', '#DA9A2C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ask}>
            <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]} pointerEvents="none" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.askEyebrow}>✦ {L ? 'pregúntale a villie' : 'ask villie'}</Text>
              <Text style={styles.askTitle}>{L ? 'Pregunta o dile lo que sea.' : 'Ask or tell villie anything.'}</Text>
              <Text style={styles.askSub}>{L ? 'Registra una toma, planea leche, encuentra un doctor.' : 'Log a feed, plan milk, find a doctor — just ask.'}</Text>
            </View>
            <View style={styles.askMic}><Glyph d={ICON.mic} color="#fff" size={22} sw={1.9} /></View>
          </LinearGradient>
        </TouchableOpacity>

        <Eyebrow style={{ marginTop: 26, marginBottom: 12 }}>{L ? 'tu village' : 'your village'}</Eyebrow>
        <View style={{ gap: 12 }}>{village.map((d) => <WideCard key={d.key} d={d} />)}</View>

        <Eyebrow style={{ marginTop: 26, marginBottom: 12 }}>{L ? 'esta semana' : 'this week'}</Eyebrow>
        <View style={{ gap: 12 }}>{thisWeek.map((d) => <WideCard key={d.key} d={d} />)}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },

  hero: {
    paddingHorizontal: 22, paddingBottom: 26, overflow: 'hidden',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBee: { position: 'absolute', top: 58, right: 30, width: 26, height: 26, opacity: 0.9 },
  heroEyebrowBar: { width: 16, height: 1.5, backgroundColor: 'rgba(255,247,238,0.85)', marginRight: 8 },
  heroEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6, textTransform: 'uppercase', color: 'rgba(255,247,238,0.9)', fontWeight: '600' },
  heroTitle: { fontFamily: FONTS.v3_display, fontSize: 34, lineHeight: 38, color: '#FFFDF8', letterSpacing: -1.2, marginTop: 12 },
  heroTitleEm: { fontFamily: FONTS.v3_display_italic, color: '#FFF1DC' },
  heroSub: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: 'rgba(255,247,238,0.9)', marginTop: 8 },

  content: { padding: 20, paddingBottom: 60 },

  // Featured ask card
  ask: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 20, overflow: 'hidden',
    shadowColor: T.rasp, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 24, elevation: 5 },
  askEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,247,238,0.95)', fontWeight: '700' },
  askTitle: { fontFamily: FONTS.v3_display, fontSize: 20, lineHeight: 24, color: '#FFFDF8', letterSpacing: -0.5, marginTop: 8 },
  askSub: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,247,238,0.92)', marginTop: 6 },
  askMic: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },

  eyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6, textTransform: 'uppercase', fontWeight: '600', color: T.walnut },

  // Wide directory card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: T.paper, borderRadius: 18, padding: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 2,
  },
  cardIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: FONTS.v3_display, fontSize: 17, color: T.cocoa, letterSpacing: -0.4 },
  cardDesc: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 17, color: T.walnut, marginTop: 3 },
});
