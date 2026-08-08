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
  View, Text, StyleSheet, TouchableOpacity, Image, Animated, ScrollView,
  Dimensions, StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G } from 'react-native-svg';
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
const SCREEN_W = Dimensions.get('window').width;

// ─── Tokens (raspberry rebrand) ────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,      // #FFFCF6
  cream:     COLORS.v2_cream,      // #FCF7EF
  butter:    COLORS.v2_butter,
  marigold:  COLORS.v2_marigold,
  cinnamon:  COLORS.v2_cinnamon,   // #D0216A  raspberry
  berry:     COLORS.v2_cinnamon_dk,// #6E1A47  deep berry
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
} as const;

function Glyph({ d, color = '#43260F', size = 22, sw = 2 }: { d: string; color?: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Shared atoms ──────────────────────────────────────────────────────
function Eyebrow({ children, color = T.walnut, style }: { children: React.ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ width: 16, height: 1.5, backgroundColor: color, marginRight: 8 }} />
      <Text style={{
        fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
        textTransform: 'uppercase', fontWeight: '500', color,
      }}>{children}</Text>
    </View>
  );
}

// ─── The week ring — 52-week track, gold progress arc, roo at the tip ────
const RING = { box: 250, cx: 125, cy: 125, r: 104, sw: 13 };
const RING_C = 2 * Math.PI * RING.r;

function WeekRing({ week, size = 250 }: { week: number; size?: number }) {
  // clamp to a visible sliver at week 1, full ring at 52+
  const frac = Math.max(0.02, Math.min(1, week / 52));
  const dash = `${(frac * RING_C).toFixed(1)} ${RING_C.toFixed(1)}`;
  // roo marker position on the circle (start at 12 o'clock, sweep clockwise)
  const a = (-90 + frac * 360) * (Math.PI / 180);
  const mx = RING.cx + RING.r * Math.cos(a);
  const my = RING.cy + RING.r * Math.sin(a);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${RING.box} ${RING.box}`}>
      {/* track */}
      <Circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth={RING.sw} />
      {/* progress arc */}
      <Circle
        cx={RING.cx} cy={RING.cy} r={RING.r} fill="none"
        stroke={T.goldLt} strokeWidth={RING.sw} strokeLinecap="round"
        strokeDasharray={dash}
        transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
      />
      {/* roo marker disc + ears */}
      <G transform={`translate(${mx.toFixed(1)} ${my.toFixed(1)})`}>
        <Circle r={19} fill="#FFF7EE" stroke={T.berry} strokeWidth={2.5} />
        <G transform="translate(-15 -14) scale(0.15)">
          <Path d={ROO_LEFT} fill={T.cinnamon} />
          <Path d={ROO_RIGHT} fill={T.cinnamon} />
        </G>
      </G>
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
      colors={['#F79AB9', '#D0216A', '#6E1A47']}
      start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onMenu} activeOpacity={0.8} style={styles.topIconBtn} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Menú' : 'Menu'}>
          <Glyph d={ICON.menu} color="#fff" size={22} sw={2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNotifications} activeOpacity={0.8} style={styles.topIconBtn} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Notificaciones' : 'Notifications'}>
          <Glyph d={ICON.bell} color="#fff" size={21} sw={2} />
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
        <WeekRing week={weekNumber} size={252} />
        <View style={styles.ringCenter} pointerEvents="none">
          <Text style={styles.ringBabyName} numberOfLines={1}>{babyName.toLowerCase()}</Text>
          <Text style={styles.ringNumber} numberOfLines={1} allowFontScaling={false}>{weekNumber}</Text>
          <Text style={styles.ringUnit}>{unit}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.heroTapHint}>
        <Text style={styles.heroTapHintText}>{tapHint}</Text>
      </View>
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
        <LinearGradient colors={['#D0216A', '#B0234F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logCircle}>
          <Glyph d={ICON.bottle} color="#fff" size={26} sw={1.8} />
        </LinearGradient>
        <Text style={styles.logLabel}>{L.feed}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logItem} activeOpacity={0.85} onPress={onSleep} accessibilityRole="button" accessibilityLabel={L.sleep}>
        <LinearGradient colors={['#F2C75E', '#DA9A2C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logCircle}>
          <Glyph d={ICON.moon} color="#fff" size={26} sw={1.8} />
        </LinearGradient>
        <Text style={styles.logLabel}>{L.sleep}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logItem} activeOpacity={0.85} onPress={onMilk} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Registra leche desde una foto' : 'Log milk from a photo'}>
        <LinearGradient colors={['#F2C75E', '#D0216A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logCircle}>
          <Glyph d={ICON.camera} color="#fff" size={25} sw={1.8} />
        </LinearGradient>
        <View style={styles.logSnap}><Text style={styles.logSnapText}>{L.snap}</Text></View>
        <Text style={[styles.logLabel, { fontFamily: FONTS.v2_bold }]}>{L.milk}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Quiet ask-villie bar ──────────────────────────────────────────────
function AskVillie({ onAsk }: { onAsk: (seed?: string) => void }) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const chips = lang === 'es'
    ? [
        { label: '¿su sueño va bien?', seed: '¿El sueño de mi bebé va bien?' },
        { label: 'planea leche para un viaje', seed: 'Ayúdame a planear cuánta leche necesito para un viaje' },
      ]
    : [
        { label: 'is sleep on track?', seed: "Is my baby's sleep on track?" },
        { label: 'plan milk for a trip', seed: 'Help me plan how much milk I need for a trip' },
      ];
  return (
    <View style={styles.askWrap}>
      <Text style={styles.askEyebrow}>✦ {lang === 'es' ? 'pregúntale a villie' : 'ask villie'}</Text>
      <View style={styles.askRow}>
        <TouchableOpacity style={styles.askBar} activeOpacity={0.85} onPress={() => onAsk()} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Pregúntale o dile a Villie' : 'Ask or tell Villie anything'}>
          <View style={styles.askBee}><Image source={VILLIE_BEE} style={{ width: 16, height: 16 }} resizeMode="contain" /></View>
          <Text style={styles.askText}>{lang === 'es' ? 'pregúntale o dile lo que sea…' : 'ask or tell villie anything…'}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onAsk()} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Habla con Villie' : 'Talk to Villie'}>
          <LinearGradient colors={['#D0216A', '#F2C75E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.askMic}>
            <Glyph d={ICON.mic} color="#fff" size={19} sw={1.8} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {chips.map((c, i) => (
          <TouchableOpacity key={i} style={styles.chip} activeOpacity={0.85} onPress={() => onAsk(c.seed)} accessibilityRole="button" accessibilityLabel={c.label}>
            <Text style={styles.chipText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── "Your day" glanceable cards (horizontal) ──────────────────────────
function YourDay({ onWeek, onMilk, onCheckin }: { onWeek: () => void; onMilk: () => void; onCheckin: () => void }) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  return (
    <View style={{ marginTop: 26 }}>
      <Eyebrow>{lang === 'es' ? 'tu día' : 'your day'}</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
        <TouchableOpacity activeOpacity={0.9} onPress={onWeek} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Tu semana' : 'Your week'}>
          <LinearGradient colors={['#D0216A', '#F2C75E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dayCard}>
            <Glyph d={ICON.sparkle} color="#7A3548" size={22} sw={1.8} />
            <View>
              <Text style={styles.dayCardTitle}>{lang === 'es' ? 'Tu semana' : 'Your week, so far'}</Text>
              <Text style={[styles.dayCardSub, { color: '#7A3548' }]}>{lang === 'es' ? 'lo que ve Villie →' : "Villie's read →"}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} onPress={onMilk} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Tu reserva de leche' : 'Your milk stash'} style={[styles.dayCard, { backgroundColor: '#FBE9BE' }]}>
          <Glyph d={ICON.droplet} color="#B98A1E" size={22} sw={1.8} />
          <View>
            <Text style={[styles.dayCardTitle, { color: T.cocoa }]}>{lang === 'es' ? 'Tu reserva' : 'Milk stash'}</Text>
            <Text style={[styles.dayCardSub, { color: '#8A6A1E' }]}>{lang === 'es' ? 've tu congelador →' : 'see your freezer →'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} onPress={onCheckin} accessibilityRole="button" accessibilityLabel={lang === 'es' ? '¿Cómo estás?' : 'How are you feeling?'} style={[styles.dayCard, { backgroundColor: '#FDECEF' }]}>
          <Glyph d={ICON.heart} color="#6E1A47" size={22} sw={1.7} />
          <View>
            <Text style={[styles.dayCardTitle, { color: T.cocoa }]}>{lang === 'es' ? '¿Y tú?' : 'And you?'}</Text>
            <Text style={[styles.dayCardSub, { color: '#6E1A47' }]}>{lang === 'es' ? '¿cómo estás? →' : 'how are you? →'}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Your village — round quick-nav tiles ──────────────────────────────
type Tile = { key: string; label: string; bg: string; icon: keyof typeof ICON; dot?: boolean; go: () => void };

function VillageTiles({ tiles, onAll }: { tiles: Tile[]; onAll: () => void }) {
  return (
    <View style={{ marginTop: 28 }}>
      <View style={styles.sectionHead}>
        <Eyebrow>your village</Eyebrow>
        <TouchableOpacity onPress={onAll} accessibilityRole="link">
          <Text style={styles.sectionLink}>All →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tileRow}>
        {tiles.map((t) => (
          <TouchableOpacity key={t.key} onPress={t.go} activeOpacity={0.85} style={styles.tile} accessibilityRole="button" accessibilityLabel={t.label}>
            <View style={[styles.tileChip, { backgroundColor: t.bg }]}>
              <Glyph d={ICON[t.icon]} color={T.cocoa} size={23} sw={1.9} />
              {t.dot ? <View style={styles.tileDot} /> : null}
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Discover — two feature cards (image-cap + caption) ────────────────
function DiscoverCard({ cap, capIcon, imageUrl, eyebrow, eyebrowColor, title, sub, onPress }: {
  cap: readonly [string, string]; capIcon: keyof typeof ICON; imageUrl?: string | null;
  eyebrow: string; eyebrowColor: string; title: string; sub: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.discCard} accessibilityRole="button" accessibilityLabel={title}>
      <LinearGradient colors={cap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.discCap}>
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          : <Glyph d={ICON[capIcon]} color="#fff" size={30} sw={1.9} />}
      </LinearGradient>
      <View style={styles.discBody}>
        <Text style={[styles.discEyebrow, { color: eyebrowColor }]} numberOfLines={1}>{eyebrow}</Text>
        <Text style={styles.discTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.discSub} numberOfLines={1}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DiscoverRow({ showBoxes, picksImage, onBoxes, onPicks }: { showBoxes: boolean; picksImage?: string | null; onBoxes: () => void; onPicks: () => void }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Eyebrow>discover</Eyebrow>
      <View style={styles.discoverRow}>
        {showBoxes && (
          <DiscoverCard
            cap={['#D0216A', '#6E1A47']} capIcon="gift"
            eyebrow="new · curated" eyebrowColor={T.cinnamon}
            title="Villie Boxes" sub="delivery · newborn · mama"
            onPress={onBoxes}
          />
        )}
        <DiscoverCard
          cap={['#DA9A2C', '#EAB52C']} capIcon="star" imageUrl={picksImage}
          eyebrow="villie picks" eyebrowColor="#A9761F"
          title="this week's 5" sub="tested, mom-approved"
          onPress={onPicks}
        />
      </View>
    </View>
  );
}

// ─── Your corner — filled coral→rose mom card ──────────────────────────
function MomCornerCard({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} accessibilityRole="button"
      accessibilityLabel={t('momHub.homeCardA11y')} style={{ marginTop: 26 }}>
      <LinearGradient colors={['#E98A6A', '#D0216A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cornerCard}>
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
          pointerEvents="none"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 16, height: 1.5, backgroundColor: 'rgba(255,255,255,0.85)', marginRight: 8 }} />
          <Text style={styles.cornerEyebrow}>{t('momHub.homeCardEyebrow')}</Text>
        </View>
        <Text style={styles.cornerTitle}>
          <Text style={styles.cornerTitleLead}>{t('momHub.titleLead')} </Text>
          <Text style={styles.cornerTitleEm}>{t('momHub.titleEm')}</Text>
        </Text>
        <Text style={styles.cornerBlurb}>{t('momHub.homeCardBlurb')}</Text>
        <View style={styles.cornerArrowBtn}>
          <Text style={styles.cornerArrow}>→</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Villie Boxes ships behind a flag (default OFF) until launch gates clear.
const VILLIE_BOXES_ENABLED = process.env.EXPO_PUBLIC_VILLIE_BOXES_ENABLED === '1';

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
  // The signature "log milk from a photo" action → Milk Vault bag scanner.
  const scanMilk = () => (navigation.getParent() as any)?.navigate('Milk', { screen: 'MilkVaultScan' });
  const goMilkVault = () => (navigation.getParent() as any)?.navigate('Milk', { screen: 'MilkVaultDashboard' });

  const tiles: Tile[] = [
    { key: 'milk',    label: 'Milk',    bg: '#F7C5CB', icon: 'droplet',     go: () => navigation.getParent()?.navigate('Milk') },
    { key: 'experts', label: 'Care',    bg: '#F3B79C', icon: 'stethoscope', go: () => navigation.getParent()?.navigate('Experts') },
    { key: 'gear',    label: 'Gear',    bg: '#DA9A2C', icon: 'bag',         go: () => navigation.getParent()?.navigate('Gear') },
    { key: 'plans',   label: 'Plans',   bg: '#EFB2C8', icon: 'calendar',    go: () => navigation.getParent()?.navigate('Village') },
    ...(VILLIE_BOXES_ENABLED
      ? [{ key: 'boxes', label: 'Boxes', bg: '#E8C4B6', icon: 'gift', dot: true, go: () => navigation.navigate('BoxesHub' as never) } as Tile]
      : []),
  ];

  const scrollY = useRef(new Animated.Value(0)).current;

  // The Buzz — this week's published trending-topics issue, if any.
  const [buzzIssue, setBuzzIssue] = React.useState<TheBuzzArchiveRow | null>(null);
  useFocusEffect(
    React.useCallback(() => {
      theBuzzApi.getCurrentIssue()
        .then((issue) => setBuzzIssue(issue))
        .catch(() => setBuzzIssue(null));
      return () => {};
    }, []),
  );

  // Collapsed mini-header fades in once the hero has scrolled mostly off.
  const miniOpacity = scrollY.interpolate({ inputRange: [150, 260], outputRange: [0, 1], extrapolate: 'clamp' });
  const weekUnit = heroWeek === 1 ? 'week' : 'weeks';

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
          onMenu={() => navigation.navigate('DiscoverHome' as never)}
          onNotifications={() => navigation.navigate('Notifications' as never)}
        />

        {/* Lifted cream sheet — the doing. Overlaps the hero for iOS depth. */}
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <LogRow
            onFeed={() => navigation.navigate('Insights' as never)}
            onSleep={() => navigation.navigate('Insights' as never)}
            onMilk={scanMilk}
          />

          <AskVillie onAsk={askVillie} />

          <YourDay
            onWeek={() => navigation.navigate('Insights' as never)}
            onMilk={goMilkVault}
            onCheckin={() => navigation.navigate('DailyCheckin' as never)}
          />

          {expecting && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={goBeforeBaby}
              accessibilityRole="button"
              accessibilityLabel="Before baby arrives — hospital bag and home essentials"
              style={{ marginTop: 16 }}
            >
              <LinearGradient colors={['#D0216A', '#F2C75E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gettingReadyCard}>
                <View style={styles.gettingReadyIcon}><Text style={styles.gettingReadyIconText}>✓</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.gettingReadyEyebrow}>GETTING READY</Text>
                  <Text style={styles.gettingReadyTitle}>Before baby arrives</Text>
                  <Text style={styles.gettingReadySub} numberOfLines={1}>hospital bag + home essentials →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <VillageTiles tiles={tiles} onAll={() => navigation.getParent()?.navigate('Village')} />

          <DiscoverRow
            showBoxes={VILLIE_BOXES_ENABLED}
            picksImage={picks[0]?.image_url ?? null}
            onBoxes={() => navigation.navigate('BoxesHub' as never)}
            onPicks={() => navigation.navigate('PerksList' as never)}
          />

          {buzzIssue ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('TheBuzz' as never, { issueId: buzzIssue.id } as never)}
              accessibilityRole="button"
              accessibilityLabel={t('home.buzzCardTitle')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FDECEF', borderRadius: 16, padding: 15, marginTop: 20, borderWidth: 1, borderColor: 'rgba(194,85,111,0.25)' }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,252,246,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 19 }}>🐝</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: FONTS.v3_display, fontSize: 16, color: '#3D2116', letterSpacing: -0.3 }}>{t('home.buzzCardTitle')}</Text>
                <Text style={{ fontFamily: FONTS.v2_body, fontSize: 12, color: '#8A4A5A', marginTop: 2, lineHeight: 16 }} numberOfLines={1}>{t('home.buzzCardSub')}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <MomCornerCard onPress={() => navigation.navigate('MomHub' as never)} />

          <TouchableOpacity
            style={styles.emergencyRow}
            activeOpacity={0.85}
            onPress={() => navigation.getParent()?.getParent()?.navigate('QuickReference' as never)}
            accessibilityRole="button"
            accessibilityLabel="In an emergency — quick reference"
          >
            <View style={styles.emergencyIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#BE3A2E" strokeWidth={1.9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.emergencyTitle}>In an emergency</Text>
              <Text style={styles.emergencySub}>infant CPR, fevers, when to call</Text>
            </View>
            <Text style={styles.emergencyArrow}>→</Text>
          </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: T.cream, overflow: 'hidden' },
  scroll: { paddingTop: 0, paddingBottom: 0 },

  // ── Week-anchor hero ─────────────────────────────────────────────────
  hero: {
    alignItems: 'center', paddingBottom: 46, paddingHorizontal: 22,
  },
  topBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  topIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  topBellDot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F2C75E', borderWidth: 1.5, borderColor: '#C42A6B' },
  heroGreet: { fontFamily: FONTS.v2_body, fontSize: 15, color: 'rgba(255,247,238,0.92)' },
  heroGreetName: { fontFamily: FONTS.v3_display_italic, fontSize: 23, color: '#FFF1DC' },
  ringWrap: { marginTop: 14, width: 252, height: 252, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringBabyName: {
    fontFamily: FONTS.v2_mono, fontSize: 12, letterSpacing: 3, textTransform: 'lowercase',
    color: 'rgba(255,247,238,0.85)', marginBottom: 2,
  },
  ringNumber: {
    fontFamily: FONTS.v3_display, fontSize: 84, lineHeight: 88, color: '#FFFFFF',
    letterSpacing: -2, textAlign: 'center',
  },
  ringUnit: {
    fontFamily: FONTS.bodySemiBold, fontSize: 14, letterSpacing: 0.4,
    color: 'rgba(255,247,238,0.92)', marginTop: -2,
  },
  heroTapHint: {
    marginTop: 20, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  heroTapHintText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#FFF7EE', letterSpacing: 0.2 },

  // ── Lifted cream sheet ───────────────────────────────────────────────
  sheet: {
    marginTop: -26, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 120,
    backgroundColor: '#FFFDFA', borderTopLeftRadius: 30, borderTopRightRadius: 30,
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
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3,
  },
  logSnap: {
    position: 'absolute', top: -3, right: 4,
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3,
  },
  logSnapText: { fontFamily: FONTS.v2_bold, fontSize: 8.5, color: '#6E1A47', letterSpacing: 0.3 },
  logLabel: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: T.cocoa, marginTop: 9 },

  // ── Ask villie ───────────────────────────────────────────────────────
  askWrap: { marginTop: 24 },
  askEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: '#6E1A47', fontWeight: '700', marginBottom: 10 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  askBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FDF0F4', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 14, borderWidth: 1.5, borderColor: 'rgba(208,33,106,0.28)' },
  askBee: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  askText: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 13.5, color: '#8A5A68' },
  askMic: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#D0216A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 11, elevation: 4 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingRight: 22 },
  chip: { borderWidth: 1.2, borderColor: 'rgba(224,106,136,0.28)', backgroundColor: '#FFFDF9', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#6E1A47' },

  // ── Your day ─────────────────────────────────────────────────────────
  dayScroll: { paddingTop: 14, paddingRight: 22, gap: 12 },
  dayCard: {
    width: 150, minHeight: 118, borderRadius: 16, padding: 14, justifyContent: 'space-between',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 2,
  },
  dayCardTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 14.5, color: '#43260F', lineHeight: 18 },
  dayCardSub: { fontFamily: FONTS.v2_body, fontSize: 11, marginTop: 3 },

  // ── Getting ready ────────────────────────────────────────────────────
  gettingReadyCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  gettingReadyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  gettingReadyIconText: { fontFamily: FONTS.bodyBold, fontSize: 18, color: '#4A1F2C' },
  gettingReadyEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.3, color: '#4A1F2C' },
  gettingReadyTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: '#4A1F2C', letterSpacing: -0.3, marginTop: 2 },
  gettingReadySub: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#5c3b2a', marginTop: 1 },

  // ── Emergency ────────────────────────────────────────────────────────
  emergencyRow: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.paper, borderRadius: 16, padding: 13,
    borderWidth: 1, borderColor: 'rgba(190,58,46,0.22)',
  },
  emergencyIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FBE4E0', alignItems: 'center', justifyContent: 'center' },
  emergencyTitle: { fontFamily: FONTS.v3_display, fontSize: 15, color: T.cocoa, letterSpacing: -0.3 },
  emergencySub: { fontFamily: FONTS.v2_body, fontSize: 11, color: T.walnut, marginTop: 1 },
  emergencyArrow: { fontFamily: FONTS.v2_link, fontSize: 16, color: '#BE3A2E' },

  // ── Section heads ────────────────────────────────────────────────────
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
  sectionLink: { fontFamily: FONTS.v2_mono, fontSize: 10, color: T.cinnamon, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: '600' },

  // ── Village tiles ────────────────────────────────────────────────────
  tileRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { alignItems: 'center', width: 60 },
  tileChip: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 2,
  },
  tileDot: { position: 'absolute', top: -2, right: 6, width: 13, height: 13, borderRadius: 7, backgroundColor: T.cinnamon, borderWidth: 2, borderColor: T.cream },
  tileLabel: { fontFamily: FONTS.v2_bold, fontSize: 11.5, color: T.cocoa, marginTop: 8 },

  // ── Discover ─────────────────────────────────────────────────────────
  discoverRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  discCard: {
    flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: T.paper,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 2,
  },
  discCap: { height: 92, alignItems: 'center', justifyContent: 'center' },
  discBody: { padding: 14 },
  discEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: '700' },
  discTitle: { fontFamily: FONTS.v3_display, fontSize: 17, color: T.cocoa, letterSpacing: -0.5, marginTop: 6 },
  discSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 3 },

  // ── Your corner ──────────────────────────────────────────────────────
  cornerCard: {
    borderRadius: 22, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22, overflow: 'hidden',
    shadowColor: T.cinnamon, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 26, elevation: 5,
  },
  cornerEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6, textTransform: 'uppercase', fontWeight: '500', color: 'rgba(255,255,255,0.92)' },
  cornerTitle: { marginTop: 12, fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 32, letterSpacing: -1.0 },
  cornerTitleLead: { color: '#FFFDF8', fontWeight: '700' },
  cornerTitleEm: { fontFamily: FONTS.v3_display_italic, color: '#FFF1DC' },
  cornerBlurb: { marginTop: 8, fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20, color: 'rgba(255,253,248,0.92)', maxWidth: '78%' },
  cornerArrowBtn: { position: 'absolute', right: 20, bottom: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  cornerArrow: { color: '#fff', fontSize: 22, fontFamily: FONTS.v3_display, marginTop: -2 },
});
