// Discover — a practical launcher (2026-08-08). Reached from the Home top-bar
// menu. NOT a second home page: a compact plain header, one bold ask-villie
// button, then a tight grid of tappable destination tiles (icon + label). Big
// tap targets, minimal reading — you open it to go somewhere, fast.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useUserStore } from '@store/user';

const T = {
  cream: '#FCF7EF', paper: '#FFFCF6', cocoa: '#43260F', walnut: '#7A4A24',
  rasp: '#E02F5F', berry: '#8A1F3E', gold: '#DA9A2C', coral: '#E98A6A',
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

type Dest = { key: string; label: string; icon: keyof typeof ICON; accent: string; tint: string; go: () => void };

export default function DiscoverHomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const L = lang === 'es';

  const tabParent = navigation.getParent();
  const askVillie = () => tabParent?.getParent()?.navigate('AIHelpChat');

  const tiles: Dest[] = [
    { key: 'milk',    icon: 'droplet',     accent: T.rasp,    tint: '#FCE1EC', label: L ? 'Leche'      : 'Milk Hub',  go: () => tabParent?.navigate('Milk') },
    { key: 'care',    icon: 'stethoscope', accent: T.coral,   tint: '#FBE5DD', label: L ? 'Cuidado'    : 'Care',      go: () => tabParent?.navigate('Experts') },
    { key: 'gear',    icon: 'bag',         accent: T.gold,    tint: '#F7ECD2', label: L ? 'Artículos'  : 'Baby Gear', go: () => tabParent?.navigate('Gear') },
    { key: 'events',  icon: 'calendar',    accent: T.berry,   tint: '#EBDCE4', label: L ? 'Eventos'    : 'Events',    go: () => navigation.navigate('EventsList') },
    { key: 'perks',   icon: 'gift',        accent: '#C13A72', tint: '#F8DFEA', label: L ? 'Beneficios' : 'Perks',     go: () => navigation.navigate('PerksList') },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BackButton color={T.rasp} />
        <Text style={styles.headerTitle}>{L ? 'Explorar' : 'Explore'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ask villie — one bold tap */}
        <TouchableOpacity activeOpacity={0.9} onPress={askVillie} accessibilityRole="button" accessibilityLabel={L ? 'Pregúntale a Villie' : 'Ask villie anything'}>
          <LinearGradient colors={['#E02F5F', '#DA9A2C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ask}>
            <View style={styles.askMic}><Glyph d={ICON.mic} color="#fff" size={20} sw={1.9} /></View>
            <Text style={styles.askText}>{L ? 'Pregúntale a villie' : 'Ask villie anything'}</Text>
            <Glyph d={ICON.arrow} color="#fff" size={18} sw={2.2} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Destination grid — icon + label, tap to go */}
        <View style={styles.grid}>
          {tiles.map((d) => (
            <TouchableOpacity key={d.key} style={styles.tile} activeOpacity={0.85} onPress={d.go} accessibilityRole="button" accessibilityLabel={d.label}>
              <View style={[styles.tileIcon, { backgroundColor: d.tint }]}>
                <Glyph d={ICON[d.icon]} color={d.accent} size={26} />
              </View>
              <Text style={styles.tileLabel}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, paddingHorizontal: 16, backgroundColor: T.cream,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)',
  },
  headerTitle: { fontFamily: FONTS.v3_display, fontSize: 18, color: T.cocoa, letterSpacing: -0.3 },

  content: { padding: 18, paddingBottom: 50 },

  ask: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16,
    shadowColor: T.rasp, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 4,
  },
  askMic: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  askText: { flex: 1, fontFamily: FONTS.v2_bold, fontSize: 16, color: '#FFFDF8', letterSpacing: 0.1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 18 },
  tile: {
    width: '48%', backgroundColor: T.paper, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 16, marginBottom: 12,
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 2,
  },
  tileIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tileLabel: { fontFamily: FONTS.v3_display, fontSize: 17, color: T.cocoa, letterSpacing: -0.3 },
});
