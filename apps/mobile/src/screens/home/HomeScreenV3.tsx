// HomeScreenV3 — "week anchor" Home (raspberry rebrand, 2026-08-07).
//
// The redesign: kill the busy masthead. The screen opens on ONE bold anchor —
// a raspberry gradient hero holding a 52-week progress RING with the villie roo
// hopping along it to mark the current week, and the baby's age ("16 weeks old")
// big in the center. Tap the ring → the Manual for what's changing this week.
//
// Beneath, a lifted cream sheet (iOS-style depth) carries the doing: gradient
// log buttons (Feed · Sleep · Milk — milk is the signature "log from a photo"),
// a quiet ask-villie bar, then the glanceable day cards, village tiles,
// discover, the buzz, mama's corner, and emergency (all unchanged).
//
// Removed per founder direction: the date, the villie wordmark, and the
// "log a diaper" tap — the anchor is the baby's week, nothing competes with it.

import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Polygon } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, PLACEHOLDER_BABY_NAME } from '@utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { usePicksStore } from '@store/picks';
import { useT } from '@/i18n';
import { isExpecting } from '@/manual/beforeBaby';
import { theBuzzApi, type TheBuzzArchiveRow } from '@api/theBuzz';
import { useFocusEffect } from '@react-navigation/native';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');
const WEEK_SEAL = require('../../../assets/home/week-seal.png');
// The founder's pink film camera, replacing the stroked camera glyph on the
// Milk "snap" tile — it's the signature log-from-a-photo action, so it earns
// a real illustration rather than a generic icon.
const MILK_CAMERA = require('../../../assets/home/milk-camera.png');
const SLEEP_MOON = require('../../../assets/home/sleep-moon.png');
const FEED_BOTTLE = require('../../../assets/home/feed-bottle.png');
const VILLIE_BOXES = require('../../../assets/home/villie-boxes.png');
const BUZZ_BEE = require('../../../assets/home/buzz-bee.png');
const SCREEN_W = Dimensions.get('window').width;

// ─── Tokens (raspberry rebrand) ────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,      // #FFFCF6
  cream:     COLORS.v2_cream,      // #FCF7EF
  butter:    COLORS.v2_butter,
  marigold:  COLORS.v2_marigold,
  cinnamon:  COLORS.v2_cinnamon,   // #E14A32  raspberry
  berry:     COLORS.v2_cinnamon_dk,// #B03A22  deep berry
  gold:      '#DA9A2C',
  goldLt:    '#F2C75E',
  caramel:   COLORS.v2_caramel,    // #E98A6A
  blush:     COLORS.v2_blush,
  cocoa:     COLORS.v2_cocoa,      // #43260F
  walnut:    COLORS.v2_walnut,     // #7A4A24
  rule:      'rgba(61,31,14,0.13)',
};

// Roo mark — two kangaroo ears forming the "v" (one ear folded). The brand icon.
const ROO_LEFT  = 'M100 158 C80 130 60 94 54 60 C50 40 62 30 76 42 C90 66 101 118 108 152 Z';
const ROO_RIGHT = 'M100 158 C114 132 128 102 134 78 C137 64 146 58 151 68 C156 80 151 96 136 96 C129 96 124 90 122 82 C115 100 105 128 94 152 Z';

// ─── Helpers ───────────────────────────────────────────────────────────
function greetingForHour(hour: number, lang: 'en' | 'es'): string {
  if (lang === 'es') {
    if (hour < 5) return 'buenas noches';
    if (hour < 12) return 'buenos días';
    if (hour < 18) return 'buenas tardes';
    return 'buenas noches';
  }
  if (hour < 5) return 'good evening';
  if (hour < 12) return 'good morning';
  if (hour < 18) return 'good afternoon';
  return 'good evening';
}

// ─── Icon paths (24×24, stroke) ────────────────────────────────────────
const ICON = {
  bottle:  'M10 3.5h4M11 3.5v2M13 3.5v2M9.2 7h5.6a1.8 1.8 0 011.8 1.8V19a2 2 0 01-2 2H9.4a2 2 0 01-2-2V8.8A1.8 1.8 0 019.2 7zM7.8 11.5h8.4',
  moon:    'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  camera:  'M4 8h2.5L8 6h8l1.5 2H20a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM12 17.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  mic:     'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4M9 21h6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  heart:   'M12 21s-7-4.35-9.5-8.5C1 9 3 5.5 6.5 5.5c2 0 3.6 1.1 5.5 3 1.9-1.9 3.5-3 5.5-3C21 5.5 23 9 21.5 12.5 19 16.65 12 21 12 21z',
  stethoscope: 'M6 3v6a4 4 0 008 0V3M5 3h2m6 0h2m-3 11v2a5 5 0 0010 0v-1m-1-2a2 2 0 100-4 2 2 0 000 4z',
  bag:     'M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 016 0v2',
  calendar:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  gift:    'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M8.5 7C6.6 7 5.5 4 7 3.2 8.6 2.4 12 7 12 7m0 0s3.4-4.6 5-3.8C18.5 4 17.4 7 15.5 7',
  star:    'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 17l-5.4 2.9 1.2-6.1L3.3 9.4l6.1-.8L12 3z',
  bell:    'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  menu:    'M4 7h16M4 12h16M4 17h16',
  search:  'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.35-4.35',
} as const;

function Glyph({ d, color = '#43260F', size = 22, sw = 2 }: { d: string; color?: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Honeycomb texture over the raspberry hero — a faded white flat-top hex
// lattice generated in JS, densest at the top and dissolving downward so it
// reads as brand texture behind the ring, not a busy grid. ─────────────────
function HeroHoneycomb({ height = 520 }: { height?: number }) {
  const s = 30;
  const h = Math.sqrt(3) * s;
  const dx = 1.5 * s;
  const paths: { d: string; o: number }[] = [];
  for (let c = 0; c * dx <= SCREEN_W + s; c++) {
    const cx = c * dx;
    const yOff = c % 2 ? h / 2 : 0;
    for (let r = -1; r * h + yOff <= height + h; r++) {
      const cy = r * h + yOff;
      const o = 0.17 * (1 - (cy - 10) / (height * 0.82));
      if (o <= 0.015) continue;
      const d =
        `M${(cx + s).toFixed(1)},${cy.toFixed(1)} ` +
        `L${(cx + s / 2).toFixed(1)},${(cy - h / 2).toFixed(1)} ` +
        `L${(cx - s / 2).toFixed(1)},${(cy - h / 2).toFixed(1)} ` +
        `L${(cx - s).toFixed(1)},${cy.toFixed(1)} ` +
        `L${(cx - s / 2).toFixed(1)},${(cy + h / 2).toFixed(1)} ` +
        `L${(cx + s / 2).toFixed(1)},${(cy + h / 2).toFixed(1)} Z`;
      paths.push({ d, o: Math.min(0.22, o) });
    }
  }
  return (
    <Svg width={SCREEN_W} height={height} style={styles.heroHoneycomb} pointerEvents="none">
      {paths.map((p, i) => (
        <Path key={i} d={p.d} stroke="#C24A63" strokeOpacity={p.o * 0.6} strokeWidth={1} fill="none" />
      ))}
    </Svg>
  );
}

// ─── The week "sun" — a 52-ray sunburst seal. Each ray is one week; lit
// (scarlet) rays are the weeks lived, the rest a faint scarlet. A cream center
// disc holds the number. Warm, retro, and the progress IS the ornament. ──────
const RING = { box: 250, cx: 125, cy: 125 };

function WeekRing({ week, size = 250 }: { week: number; size?: number }) {
  const wk = Math.max(1, Math.min(52, Math.round(week)));
  const rin = 92, rout = 118, aw = 0.032, disc = 86;
  const rays = [];
  for (let i = 0; i < 52; i++) {
    const a = (-90 + i * (360 / 52)) * (Math.PI / 180);
    const b1x = RING.cx + rin * Math.cos(a - aw), b1y = RING.cy + rin * Math.sin(a - aw);
    const b2x = RING.cx + rin * Math.cos(a + aw), b2y = RING.cy + rin * Math.sin(a + aw);
    const tx = RING.cx + rout * Math.cos(a), ty = RING.cy + rout * Math.sin(a);
    const on = i < wk;
    rays.push(
      <Polygon key={i}
        points={`${b1x.toFixed(1)},${b1y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`}
        fill={on ? '#C24A63' : 'rgba(194,74,99,0.20)'} />,
    );
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${RING.box} ${RING.box}`}>
      {rays}
      <Circle cx={RING.cx} cy={RING.cy} r={disc} fill="#FFF3E4" stroke={T.cinnamon} strokeWidth={2.5} />
    </Svg>
  );
}

// ─── Week-anchor hero — bold raspberry gradient + ring + tap→Manual ──────
function WeekRingHero({ firstName, babyName, weekNumber, expecting, onOpenManual, onBeforeBaby, onMenu, onNotifications, hasNotifications }: {
  firstName: string; babyName: string; weekNumber: number; expecting: boolean;
  onOpenManual: () => void; onBeforeBaby: () => void;
  onMenu: () => void; onNotifications: () => void; hasNotifications?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const greet = greetingForHour(new Date().getHours(), lang);
  const unit = weekNumber === 1
    ? (lang === 'es' ? 'semana' : 'week old')
    : (lang === 'es' ? 'semanas' : 'weeks old');
  const tapHint = expecting
    ? (lang === 'es' ? 'prepárate para su llegada →' : "get ready for baby →")
    : (lang === 'es' ? 'toca para el manual de esta semana →' : "tap for this week's manual →");
  return (
    <LinearGradient
      colors={['#FDE2E6', '#F6C9D0', '#EFB8C4']}
      start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 8 }]}
    >
      <HeroHoneycomb />
      <View style={styles.heroBee} pointerEvents="none">
        <Svg width={52} height={28} viewBox="0 0 66 40">
          <Path d="M2 34 C 16 30, 20 12, 40 12" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.3} strokeDasharray="2.5 3.5" strokeLinecap="round" />
        </Svg>
        <Image source={VILLIE_BEE} resizeMode="contain" style={styles.heroBeeImg} />
      </View>

      <View style={styles.topBar}>
        <TouchableOpacity onPress={onMenu} activeOpacity={0.8} style={styles.topIconBtn} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Buscar' : 'Search'}>
          <Glyph d={ICON.search} color="#C24A63" size={21} sw={2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNotifications} activeOpacity={0.8} style={styles.topIconBtn} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Notificaciones' : 'Notifications'}>
          <Glyph d={ICON.bell} color="#C24A63" size={21} sw={2} />
          {hasNotifications ? <View style={styles.topBellDot} /> : null}
        </TouchableOpacity>
      </View>

      <Text style={styles.heroGreet} numberOfLines={1}>
        {greet}, <Text style={styles.heroGreetName}>{firstName}</Text>
      </Text>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={expecting ? onBeforeBaby : onOpenManual}
        accessibilityRole="button"
        accessibilityLabel={
          expecting
            ? (lang === 'es' ? 'Prepárate para la llegada del bebé' : 'Get ready for baby')
            : (lang === 'es' ? `${babyName} tiene ${weekNumber} semanas. Ver el manual de esta semana` : `${babyName} is ${weekNumber} ${unit}. Open this week's manual`)
        }
        style={styles.ringWrap}
      >
        <Image source={WEEK_SEAL} style={styles.weekSeal} resizeMode="contain" />
        <View style={styles.ringCenter} pointerEvents="none">
          <View style={styles.ringNumWrap}>
            <Text style={styles.ringWeekLabel} numberOfLines={1}>{(lang === 'es' ? 'semana' : 'week')}</Text>
            <Text style={styles.ringNumber} numberOfLines={1} allowFontScaling={false}>{weekNumber}</Text>
            <Text style={styles.ringBabyName} numberOfLines={1}>{babyName.toLowerCase()}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.heroTapHint}
        activeOpacity={0.85}
        onPress={expecting ? onBeforeBaby : onOpenManual}
        accessibilityRole="button"
        accessibilityLabel={expecting
          ? (lang === 'es' ? 'Prepárate para la llegada del bebé' : 'Get ready for baby')
          : (lang === 'es' ? "Abre el manual de esta semana" : "Open this week's manual")}
      >
        <Text style={styles.heroTapHintText}>{tapHint}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ─── Log row — Feed · Sleep · Milk (milk = log-from-a-photo) ─────────────
function LogRow({ onFeed, onSleep, onMilk }: { onFeed: () => void; onSleep: () => void; onMilk: () => void }) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const L = lang === 'es'
    ? { feed: 'Comida', sleep: 'Sueño', milk: 'Leche', snap: 'foto' }
    : { feed: 'Feed', sleep: 'Sleep', milk: 'Milk', snap: 'snap' };
  return (
    <View style={styles.logRow}>
      <TouchableOpacity style={styles.logItem} activeOpacity={0.85} onPress={onFeed} accessibilityRole="button" accessibilityLabel={L.feed}>
        <View style={[styles.logCircle, { backgroundColor: '#E8B98A' }]}>
          <Image source={FEED_BOTTLE} style={styles.feedBottleIcon} resizeMode="contain" />
        </View>
        <Text style={styles.logLabel}>{L.feed}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logItem} activeOpacity={0.85} onPress={onSleep} accessibilityRole="button" accessibilityLabel={L.sleep}>
        <View style={[styles.logCircle, { backgroundColor: '#F6C9D0' }]}>
          <Image source={SLEEP_MOON} style={styles.sleepMoonIcon} resizeMode="contain" />
        </View>
        <Text style={styles.logLabel}>{L.sleep}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logItem} activeOpacity={0.85} onPress={onMilk} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Registra leche desde una foto' : 'Log milk from a photo'}>
        <View style={[styles.logCircle, { backgroundColor: '#EFD79A' }]}>
          <Image source={MILK_CAMERA} style={styles.milkCamIcon} resizeMode="contain" />
        </View>
        <View style={styles.logSnap}><Text style={styles.logSnapText}>{L.snap}</Text></View>
        <Text style={[styles.logLabel, { fontFamily: FONTS.v2_bold }]}>{L.milk}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Quiet ask-villie bar ──────────────────────────────────────────────
function AskVillie({ onAsk, onTalk, weekNumber, babyName }: { onAsk: (seed?: string) => void; onTalk: () => void; weekNumber: number; babyName: string }) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const hour = new Date().getHours();
  const name = babyName.toLowerCase();
  const evening = hour >= 17 || hour < 5;
  // Contextual suggestions that shift with the baby's week + the time of day.
  const prompts = lang === 'es'
    ? [`¿qué es normal a las ${weekNumber} semanas?`, evening ? 'planear mañana' : `¿qué debe comer ${name} hoy?`, '¿por qué se despierta de noche?']
    : [`what's normal at ${weekNumber} weeks?`, evening ? 'plan tomorrow' : `what should ${name} eat today?`, 'why the night wakings?'];
  return (
    <View style={styles.askWrap}>
      <View style={styles.askRow}>
        <TouchableOpacity style={styles.askBarWrap} activeOpacity={0.9} onPress={() => onAsk()} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Pregúntale o dile a Villie' : 'Ask or tell Villie anything'}>
          <LinearGradient colors={['#E14A32', '#EE9A38']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.askBar}>
            <View style={styles.askBee}><Image source={VILLIE_BEE} style={{ width: 16, height: 16 }} resizeMode="contain" /></View>
            <Text style={styles.askText}>{lang === 'es' ? 'pregúntale o dile lo que sea…' : 'ask or tell villie anything…'}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={onTalk} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Habla con Villie' : 'Talk to Villie'} accessibilityHint={lang === 'es' ? 'Abre el chat con el teclado listo para dictar' : 'Opens the chat with the keyboard ready to dictate'}>
          <View style={styles.askMic}>
            <Glyph d={ICON.mic} color="#E14A32" size={19} sw={1.8} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.askPrompts}>
        {prompts.map((p, i) => (
          <TouchableOpacity key={i} activeOpacity={0.65} onPress={() => onAsk(p)} style={styles.askChip} accessibilityRole="button" accessibilityLabel={p}>
            <Text style={styles.askChipText} numberOfLines={1}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Discover — two feature cards (Villie Boxes + Villie Picks) ─────────
function DiscoverCard({ cap, capIcon, imageUrl, imageSource, eyebrow, title, sub, onPress }: {
  cap: readonly [string, string]; capIcon?: keyof typeof ICON; imageUrl?: string | null; imageSource?: number;
  eyebrow: string; title: string; sub: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.discCard} accessibilityRole="button" accessibilityLabel={title}>
      <LinearGradient colors={cap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.discCap}>
        {imageSource
          ? <Image source={imageSource} style={styles.discCapImg} resizeMode="contain" />
          : imageUrl
          ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          : capIcon
          ? <Glyph d={ICON[capIcon]} color="#fff" size={30} sw={1.9} />
          : null}
      </LinearGradient>
      <View style={styles.discBody}>
        <Text style={styles.discEyebrow} numberOfLines={1}>{eyebrow}</Text>
        <Text style={styles.discTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.discSub} numberOfLines={1}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DiscoverRow({ showBoxes, picksImage, onBoxes, onPicks }: { showBoxes: boolean; picksImage?: string | null; onBoxes: () => void; onPicks: () => void }) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  return (
    <View style={styles.discoverRow}>
      {showBoxes && (
          <DiscoverCard
            cap={['#FBE6EC', '#F5D2DC']} imageSource={VILLIE_BOXES}
            eyebrow={lang === 'es' ? 'nuevo · curado' : 'new · curated'}
            title="Villie Boxes" sub={lang === 'es' ? 'entrega · recién nacido' : 'delivery · newborn · mama'}
            onPress={onBoxes}
          />
        )}
        <DiscoverCard
          cap={['#E894AC', '#C24A63']} capIcon="star" imageUrl={picksImage}
          eyebrow={lang === 'es' ? 'villie recomienda' : 'villie picks'}
          title={lang === 'es' ? 'los 5 de la semana' : "this week's 5"}
          sub={lang === 'es' ? 'probado por mamás' : 'tested, mom-approved'}
          onPress={onPicks}
        />
    </View>
  );
}

// ─── Quiet type-led navigation list ────────────────────────────────────
type NavItem = { key: string; tint: string; icon: React.ReactNode; label: string; sub?: string; danger?: boolean; onPress: () => void };

function NavGroup({ items }: { items: NavItem[] }) {
  return (
    <View style={styles.navGroup}>
      {items.map((it, i) => (
        <View key={it.key}>
          {i > 0 ? <View style={styles.navDivider} /> : null}
          <TouchableOpacity style={styles.navRow} activeOpacity={0.7} onPress={it.onPress}
            accessibilityRole="button" accessibilityLabel={it.label}>
            <View style={[styles.navIcon, { backgroundColor: it.tint }]}>{it.icon}</View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.navLabel, it.danger ? { color: '#BE3A2E' } : null]}>{it.label}</Text>
              {it.sub ? <Text style={styles.navSub} numberOfLines={1}>{it.sub}</Text> : null}
            </View>
            <Text style={[styles.navChevron, it.danger ? { color: '#BE3A2E' } : null]}>›</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// The Buzz on Home — a vibrant honey card that stands out from the cream nav
// rows (founder 2026-08-12: "the buzz hero blends in, make it pop").
function BuzzCard({ t, lang, onPress }: { t: (k: string, p?: any) => string; lang: 'en' | 'es'; onPress: () => void }) {
  const sub = t('home.buzzCardSub').replace(/[\s→›»]+$/, '');
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} accessibilityRole="button" accessibilityLabel={t('home.buzzCardTitle')}>
      <LinearGradient colors={['#F4C64A', '#E89020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buzzCard}>
        <View style={styles.buzzBee}><Image source={BUZZ_BEE} style={styles.buzzBeeImg} resizeMode="cover" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.buzzEyebrow}>{lang === 'es' ? 'el buzz' : 'the buzz'}</Text>
          <Text style={styles.buzzTitle} numberOfLines={2}>{sub}</Text>
        </View>
        <Text style={styles.buzzChevron}>›</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Founder asked for Villie Boxes back on Home (2026-08-09). Hub/detail/cart
// are built + navigable; only the Stripe checkout step is still pending.
const VILLIE_BOXES_ENABLED = true;

// ─── Screen ────────────────────────────────────────────────────────────
export default function HomeScreenV3() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const babyProfile = useHomeStore((s) => s.babyProfile);

  const picks = usePicksStore((s) => s.picks);
  const fetchPicks = usePicksStore((s) => s.fetchPicks);
  React.useEffect(() => { fetchPicks(); }, [fetchPicks]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Alana';
  const babyName = babyProfile?.baby_name ?? null;
  const weekNumber = babyProfile?.current_week_number ?? null;

  const heroBabyName = babyName ?? PLACEHOLDER_BABY_NAME;
  const heroWeek = weekNumber ?? 1;
  const expecting = isExpecting(profile?.due_date, profile?.pregnancy_stage);

  // Navigation --------------------------------------------------------------
  const goManualView = (view: 'manual' | 'playbook') =>
    navigation.getParent()?.navigate('Manual', { screen: 'ManualHome', params: { view } });
  const goBeforeBaby = () => navigation.getParent()?.navigate('Manual', { screen: 'BeforeBaby' });
  const askVillie = (seed?: string) => (navigation.getParent()?.getParent() as any)?.navigate('AIHelpChat', seed ? { seed, autosend: true } : {});
  // The mic. It cannot record: there is no NSMicrophoneUsageDescription in the
  // Info.plist (removed before Build 12 to dodge an App Store permission-
  // mismatch rejection) and `expo-audio` is a guarded dynamic import that no
  // shipped build is known to contain — so an in-app recorder needs a NEW
  // NATIVE BUILD plus a transcription backend, neither of which an OTA can
  // deliver. Until then it opens the chat with the keyboard already up, which
  // puts iOS's own dictation key one tap away. That is the same "talk to it,
  // villie sorts it" route the tracker's jot field already tells mothers to use.
  // Previously this button called askVillie() — byte-identical to tapping the
  // text bar beside it — so it looked broken because it WAS inert.
  const talkToVillie = () => (navigation.getParent()?.getParent() as any)?.navigate('AIHelpChat', { focusComposer: true });
  // The signature "log milk from a photo" action → Milk Vault bag scanner.
  const scanMilk = () => (navigation.getParent() as any)?.navigate('Milk', { screen: 'MilkVaultScan' });

  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

  const scrollY = useRef(new Animated.Value(0)).current;

  // The Buzz — this week's published trending-topics issue, if any.
  //
  // The row is absent unless we positively know there is an issue, so a failed
  // lookup must NOT write null: that turns "we couldn't ask" into "there is no
  // Buzz this week" and the entry point silently disappears. `getCurrentIssue`
  // now throws instead of returning null when the session isn't ready (see
  // lib/requireSession.ts), so swallowing the error here keeps the last known
  // good value and the next focus retries.
  const [buzzIssue, setBuzzIssue] = React.useState<TheBuzzArchiveRow | null>(null);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      theBuzzApi.getCurrentIssue()
        .then((issue) => { if (!cancelled) setBuzzIssue(issue); })
        .catch(() => { /* transient — keep what we had rather than blanking the row */ });
      return () => { cancelled = true; };
    }, []),
  );

  // Collapsed mini-header fades in once the hero has scrolled mostly off.
  const miniOpacity = scrollY.interpolate({ inputRange: [150, 260], outputRange: [0, 1], extrapolate: 'clamp' });
  const weekUnit = heroWeek === 1 ? 'week' : 'weeks';

  // Nav grouped by meaning: Village = the verticals, Discover = editorial +
  // commerce, Emergency stands alone. Muted icons on soft pastel; warmth
  // lives in the hero + Discover cards, scarlet stays an accent.
  const villageItems: NavItem[] = [
    { key: 'milk',  tint: '#FBE0E5', icon: <Glyph d={ICON.droplet} color="#8A5040" size={19} sw={1.9} />, label: 'Milk Hub', onPress: () => navigation.getParent()?.navigate('Milk') },
    { key: 'care',  tint: '#FBEAD6', icon: <Glyph d={ICON.stethoscope} color="#8A5040" size={19} sw={1.9} />, label: lang === 'es' ? 'Cuidado' : 'Care', onPress: () => navigation.getParent()?.navigate('Experts') },
    { key: 'gear',  tint: '#F6EBC4', icon: <Glyph d={ICON.bag} color="#8A5040" size={19} sw={1.9} />, label: lang === 'es' ? 'Artículos de bebé' : 'Baby gear', onPress: () => navigation.getParent()?.navigate('Gear') },
    { key: 'plans', tint: '#F7DED2', icon: <Glyph d={ICON.calendar} color="#8A5040" size={19} sw={1.9} />, label: lang === 'es' ? 'Planes' : 'Plans', onPress: () => navigation.getParent()?.navigate('Village') },
  ];
  const emergencyItems: NavItem[] = [
    { key: 'emergency', tint: '#FBE4E0', danger: true,
      icon: <Svg width={19} height={19} viewBox="0 0 24 24"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#BE3A2E" strokeWidth={1.9} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>,
      label: lang === 'es' ? 'En una emergencia' : 'In an emergency',
      sub: lang === 'es' ? 'CPR infantil, fiebre, cuándo llamar' : 'infant CPR, fevers, when to call',
      onPress: () => navigation.getParent()?.getParent()?.navigate('QuickReference' as never) },
  ];

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* Bold anchor — raspberry gradient hero with the roo week-ring. */}
        <WeekRingHero
          firstName={firstName}
          babyName={heroBabyName}
          weekNumber={heroWeek}
          expecting={expecting}
          onOpenManual={() => goManualView('manual')}
          onBeforeBaby={goBeforeBaby}
          onMenu={() => navigation.navigate('Search' as never)}
          onNotifications={() => navigation.navigate('Notifications' as never)}
        />

        {/* Lifted cream sheet — the doing. Overlaps the hero for iOS depth. */}
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <LogRow
            onFeed={() => navigation.navigate('Insights' as never, { pane: 'feed' } as never)}
            onSleep={() => navigation.navigate('Insights' as never, { pane: 'sleep' } as never)}
            onMilk={scanMilk}
          />

          {/* Insights lives with the daily log — reading of what you track. */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Insights' as never)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={lang === 'es' ? 'Ver los patrones del bebé' : "See baby's patterns"}
            style={styles.patternsLink}
          >
            <Text style={styles.patternsLinkText}>{lang === 'es' ? 'ver patrones del bebé  ›' : "baby's patterns  ›"}</Text>
          </TouchableOpacity>

          <AskVillie onAsk={askVillie} onTalk={talkToVillie} weekNumber={heroWeek} babyName={heroBabyName} />

          {expecting && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={goBeforeBaby}
              accessibilityRole="button"
              accessibilityLabel="Before baby arrives — hospital bag and home essentials"
              style={{ marginTop: 16 }}
            >
              <LinearGradient colors={['#E14A32', '#EE9A38']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gettingReadyCard}>
                <View style={styles.gettingReadyIcon}><Text style={styles.gettingReadyIconText}>✓</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.gettingReadyEyebrow}>GETTING READY</Text>
                  <Text style={styles.gettingReadyTitle}>Before baby arrives</Text>
                  <Text style={styles.gettingReadySub} numberOfLines={1}>hospital bag + home essentials →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Mama's corner — mom's own space, operational, stands alone */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('MomHub' as never)}
            accessibilityRole="button"
            accessibilityLabel={lang === 'es' ? 'Rincón de mamá' : "Mama's corner"}
            style={styles.mamaCard}
          >
            <View style={styles.mamaIcon}><Glyph d={ICON.sparkle} color="#B24A78" size={20} sw={1.8} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.mamaTitle}>{lang === 'es' ? 'Rincón de mamá' : "Mama's corner"}</Text>
              <Text style={styles.mamaSub}>{lang === 'es' ? 'tu espacio para respirar' : 'your space to regroup'}</Text>
            </View>
            <Text style={styles.mamaChevron}>›</Text>
          </TouchableOpacity>

          {/* Village — the verticals */}
          <View style={{ marginTop: 24 }}>
            <Text style={styles.discHead}>{lang === 'es' ? 'Tu aldea' : 'Village'}</Text>
            <NavGroup items={villageItems} />
          </View>

          {/* Discover — Villie Boxes, Villie Picks, The Buzz */}
          <View style={{ marginTop: 26 }}>
            <Text style={styles.discHead}>{lang === 'es' ? 'Descubre' : 'Discover'}</Text>
            <DiscoverRow
              showBoxes={VILLIE_BOXES_ENABLED}
              picksImage={(picks.find((p) => p.category !== 'book') ?? picks[0])?.image_url ?? null}
              onBoxes={() => navigation.navigate('BoxesHub' as never)}
              onPicks={() => navigation.navigate('PerksList' as never)}
            />
            {buzzIssue ? (
              <View style={{ marginTop: 12 }}>
                <BuzzCard t={t} lang={lang} onPress={() => navigation.navigate('TheBuzz' as never, { issueId: buzzIssue.id } as never)} />
              </View>
            ) : null}
          </View>

          {/* Emergency — stands alone */}
          <View style={{ marginTop: 22 }}>
            <NavGroup items={emergencyItems} />
          </View>
        </View>
      </Animated.ScrollView>

      {/* Collapsed mini-header (fades in on scroll) */}
      <Animated.View pointerEvents="none" style={[styles.miniHeader, { paddingTop: insets.top + 4, opacity: miniOpacity }]}>
        <Text style={styles.miniHeaderText}>{heroBabyName.toLowerCase()} · {heroWeek} {weekUnit} old</Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF4E6', overflow: 'hidden' },
  scroll: { paddingTop: 0, paddingBottom: 0 },

  // ── Week-anchor hero ─────────────────────────────────────────────────
  hero: {
    alignItems: 'center', paddingBottom: 46, paddingHorizontal: 22, overflow: 'hidden',
  },
  heroHoneycomb: { position: 'absolute', top: 0, left: -22 },
  heroBee: { position: 'absolute', top: 104, right: 40, flexDirection: 'row', alignItems: 'flex-start' },
  heroBeeImg: { width: 24, height: 24, marginLeft: -6, marginTop: -2 },
  topBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  topIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(194,74,99,0.12)', alignItems: 'center', justifyContent: 'center' },
  topBellDot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: '#C24A63', borderWidth: 1.5, borderColor: '#FBF4E6' },
  heroGreet: { fontFamily: FONTS.v2_body, fontSize: 15, color: '#A85A63' },
  heroGreetName: { fontFamily: FONTS.v3_display_italic, fontSize: 23, color: '#C24A63' },
  ringWrap: { marginTop: 16, width: 214, height: 214, alignItems: 'center', justifyContent: 'center' },
  weekSeal: { width: 214, height: 214 },
  ringCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // The NUMBER is the centered anchor: this wrap sizes to the number alone, so
  // ringCenter centers IT on the wax face. The eyebrow + name are absolutely
  // positioned above/below and can't pull the number off-centre.
  ringNumWrap: { alignItems: 'center', justifyContent: 'center' },
  // Her baby's name, not a label. At 12px mono against a 76px week number it
  // read as chrome — the eye went straight past it to the digits (founder,
  // 2026-08-12). Sized up to sit as the ring's subject: Playfair display so it
  // reads as a NAME, deeper raspberry for contrast on the cream disc, and the
  // wide mono tracking dropped since it fought legibility at this size. Still
  // well under the 76px number, so the week stays the anchor.
  // The week number lives INSIDE the wax seal (founder-supplied blank seal,
  // 2026-08-15). Dark cocoa read too harsh on the orange, so the type is soft
  // cream — like light catching the wax. Whole emblem is ONE font (Playfair /
  // v3_display) to respect the app's 3-font ceiling. Eyebrow + name are
  // absolutely positioned around the number so the number stays optically centred.
  ringWeekLabel: {
    position: 'absolute', bottom: '100%', left: -140, right: -140, textAlign: 'center',
    fontFamily: FONTS.v3_display, fontSize: 13, lineHeight: 15, letterSpacing: 2,
    textTransform: 'uppercase', color: 'rgba(253,244,224,0.78)', marginBottom: 2,
    textShadowColor: 'rgba(58,24,10,0.40)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  // Cream type + a soft dark drop shadow so it lifts off the orange wax and
  // reads without going harsh (founder pick, 2026-08-15).
  ringNumber: {
    fontFamily: FONTS.v3_display, fontSize: 76, lineHeight: 80, color: '#FBF4E4',
    letterSpacing: -1.5, textAlign: 'center',
    textShadowColor: 'rgba(58,24,10,0.55)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 5,
  },
  ringBabyName: {
    position: 'absolute', top: '100%', left: -140, right: -140, textAlign: 'center',
    fontFamily: FONTS.v3_display, fontSize: 19, lineHeight: 22, letterSpacing: -0.3,
    textTransform: 'lowercase', color: '#F2E4C8', marginTop: 2,
    textShadowColor: 'rgba(58,24,10,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3,
  },
  // Quiet, flat pill so it doesn't compete with the wax seal — the vibrant
  // gradient moved to the Ask Villie bar for contrast (founder, 2026-08-15).
  heroTapHint: {
    marginTop: 18, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  heroTapHintText: { fontFamily: FONTS.bodyBold, fontSize: 11.5, color: '#A8385A', letterSpacing: 0.6, textTransform: 'uppercase' },

  // ── Lifted cream sheet ───────────────────────────────────────────────
  sheet: {
    marginTop: -26, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 120,
    backgroundColor: '#FBF4E6', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    shadowColor: T.walnut, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 8,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#EBDCC2', alignSelf: 'center', marginTop: 6, marginBottom: 18 },

  // Collapsed mini header (fades in on scroll)
  miniHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10,
    backgroundColor: 'rgba(252,247,239,0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)',
  },
  miniHeaderText: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.6,
    textTransform: 'uppercase', color: T.cocoa, fontWeight: '600',
  },

  // ── Log row ──────────────────────────────────────────────────────────
  logRow: { flexDirection: 'row', justifyContent: 'center', gap: 34 },
  logItem: { alignItems: 'center' },
  logCircle: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2,
  },
  logSnap: {
    position: 'absolute', top: -3, right: 4,
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3,
  },
  logSnapText: { fontFamily: FONTS.v2_bold, fontSize: 8.5, color: '#B03A22', letterSpacing: 0.3 },
  milkCamIcon: { width: 44, height: 44 },
  sleepMoonIcon: { width: 46, height: 46 },
  feedBottleIcon: { width: 44, height: 56 },
  logLabel: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: T.cocoa, marginTop: 9 },

  // ── Ask villie ───────────────────────────────────────────────────────
  askWrap: { marginTop: 22 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  // The Ask Villie bar carries the vibrant gradient now (moved off the seal
  // pill). Shadow on the wrapper; the gradient clips to its own borderRadius.
  askBarWrap: { flex: 1, borderRadius: 14, shadowColor: '#E14A32', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.24, shadowRadius: 9, elevation: 3 },
  askBar: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  askBee: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  askText: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 13.5, color: '#FFF3E4' },
  askMic: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', shadowColor: '#B03A22', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  // Understated contextual suggestions under the ask bar — soft chips, and the
  // added height nudges Mama's corner + the rest down so the hero peeks less.
  askPrompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingHorizontal: 2 },
  askChip: { backgroundColor: 'rgba(194,74,99,0.07)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  askChipText: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: '#A85278' },

  // ── Discover (Villie Boxes + Picks) ──────────────────────────────────
  discHead: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6, textTransform: 'uppercase', fontWeight: '500', color: '#B0637E', marginBottom: 12 },
  discoverRow: { flexDirection: 'row', gap: 12 },
  discCard: {
    flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: T.paper,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 2,
  },
  discCap: { height: 92, alignItems: 'center', justifyContent: 'center' },
  discCapImg: { width: 86, height: 82 },
  discBody: { padding: 14 },
  discEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: '700', color: '#C24A63' },
  discTitle: { fontFamily: FONTS.v3_display, fontSize: 17, color: T.cocoa, letterSpacing: -0.5, marginTop: 6 },
  discSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 3 },

  // ── Baby's patterns link (Insights) ──────────────────────────────────
  patternsLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 4, paddingHorizontal: 8 },
  patternsLinkText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#C24A63', letterSpacing: 0.2 },

  // ── Mama's corner (standalone operational card) ──────────────────────
  mamaCard: {
    marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: '#F6E1EC', borderRadius: 18, paddingVertical: 15, paddingHorizontal: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(178,74,120,0.18)',
  },
  mamaIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  mamaTitle: { fontFamily: FONTS.v3_display, fontSize: 16.5, color: '#7A2A4E', letterSpacing: -0.3 },
  mamaSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#9A5578', marginTop: 2 },
  mamaChevron: { fontFamily: FONTS.v2_link, fontSize: 22, color: '#C98BA8', marginTop: -2 },

  // ── Quiet nav list ───────────────────────────────────────────────────
  navGroup: {
    backgroundColor: T.paper, borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15 },
  navDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(122,74,40,0.12)', marginLeft: 58 },
  navIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontFamily: FONTS.v3_display, fontSize: 16, color: T.cocoa, letterSpacing: -0.3 },
  navSub: { fontFamily: FONTS.v2_body, fontSize: 11, color: T.walnut, marginTop: 1 },
  navChevron: { fontFamily: FONTS.v2_link, fontSize: 20, color: '#C9B79F', marginTop: -1 },

  // The Buzz — vibrant honey card that stands out from the cream nav rows
  buzzCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15 },
  buzzBee: { width: 50, height: 50, borderRadius: 15, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.32)' },
  buzzBeeImg: { width: '100%', height: '100%' },
  buzzEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: '#7A3B0E' },
  buzzTitle: { fontFamily: FONTS.v3_display, fontSize: 17, lineHeight: 21, color: '#4A2408', letterSpacing: -0.2, marginTop: 3 },
  buzzChevron: { fontFamily: FONTS.v2_body, fontSize: 24, color: '#5A2A08' },

  // ── Getting ready ────────────────────────────────────────────────────
  gettingReadyCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  gettingReadyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  gettingReadyIconText: { fontFamily: FONTS.bodyBold, fontSize: 18, color: '#4A1F2C' },
  gettingReadyEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.3, color: '#4A1F2C' },
  gettingReadyTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: '#4A1F2C', letterSpacing: -0.3, marginTop: 2 },
  gettingReadySub: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#5c3b2a', marginTop: 1 },

});
