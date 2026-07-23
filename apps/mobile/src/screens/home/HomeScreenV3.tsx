// HomeScreenV3 — v3 "honeycomb hero" Home (Felipe-approved 2026-07-11).
//
// Layout, top → bottom:
//   masthead greeting (date · morning, <name> · villie) over a faded
//     honeycomb field + a drifting villie bee
//   → BABY-WEEK hero ("14 weeks old" + what's changing this week pill)
//   → quick-log circles: Feed · Sleep · Milk (+ a quiet "log a diaper" tap).
//       Feed/Sleep/Diaper open the Playbook tracker (Manual tab); Milk opens
//       the photo scanner (the signature "log milk from a photo" action).
//   → ask-villie bar + light contextual chips (questions, not filled tiles)
//   → "your day" glanceable cards (your week · milk stash · check-in)
//   → your village tiles → discover → your corner → emergency (unchanged)
//
// The daily grind (feed/sleep) + the differentiator (milk-from-a-photo) get
// the fastest real estate; diaper stays available but never shouts (no
// pee/poop/colour interrogation). Reuses the production data hooks so the live
// screen shows real user state.

import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated, ScrollView,
  Dimensions, StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, PLACEHOLDER_BABY_NAME } from '@utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { usePicksStore } from '@store/picks';
import { useT } from '@/i18n';
import { homeApi, type Milestone } from '@api/home';
import { isExpecting } from '@/manual/beforeBaby';
import { theBuzzApi, type TheBuzzArchiveRow } from '@api/theBuzz';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { useFocusEffect } from '@react-navigation/native';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');
const VILLIE_WORDMARK = require('../../../assets/brand/villie-wordmark-trim.png');
const SCREEN_W = Dimensions.get('window').width;

// ─── Tokens (v3 brand kit) ─────────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,      // #FFFCF6
  cream:     COLORS.v2_cream,      // #FCF7EF
  butter:    COLORS.v2_butter,
  marigold:  COLORS.v2_marigold,
  cinnamon:  COLORS.v2_cinnamon,   // #E84B79
  caramel:   COLORS.v2_caramel,    // #E98A6A
  blush:     COLORS.v2_blush,
  salmon:    COLORS.v2_salmon,
  cocoa:     COLORS.v2_cocoa,      // #43260F
  walnut:    COLORS.v2_walnut,     // #7A4A28
  rule:      'rgba(61,31,14,0.13)',
};

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
  diaper:  'M3 7h18v3a9 9 0 01-18 0V7z',
  mic:     'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4M9 21h6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  heart:   'M12 21s-7-4.35-9.5-8.5C1 9 3 5.5 6.5 5.5c2 0 3.6 1.1 5.5 3 1.9-1.9 3.5-3 5.5-3C21 5.5 23 9 21.5 12.5 19 16.65 12 21 12 21z',
  book:    'M5 4h11a1 1 0 011 1v15H7a3 3 0 00-3 3V6a2 2 0 012-2z',
  stethoscope: 'M6 3v6a4 4 0 008 0V3M5 3h2m6 0h2m-3 11v2a5 5 0 0010 0v-1m-1-2a2 2 0 100-4 2 2 0 000 4z',
  bag:     'M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 016 0v2',
  calendar:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  gift:    'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M8.5 7C6.6 7 5.5 4 7 3.2 8.6 2.4 12 7 12 7m0 0s3.4-4.6 5-3.8C18.5 4 17.4 7 15.5 7',
  star:    'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 17l-5.4 2.9 1.2-6.1L3.3 9.4l6.1-.8L12 3z',
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

// ─── Honeycomb field — a faded flat-top hex lattice generated in JS (no
// <Pattern> dependency), fading to nothing toward the bottom so it sits
// behind the greeting + hero and dissolves before the quick-log row. ──────
function HoneycombField({ height = 380 }: { height?: number }) {
  const s = 26;
  const h = Math.sqrt(3) * s;
  const dx = 1.5 * s;
  const paths: { d: string; o: number }[] = [];
  for (let c = 0; c * dx <= SCREEN_W + s; c++) {
    const cx = c * dx;
    const yOff = c % 2 ? h / 2 : 0;
    for (let r = -1; r * h + yOff <= height + h; r++) {
      const cy = r * h + yOff;
      const o = 0.26 * (1 - (cy - 10) / (height * 0.7));
      if (o <= 0.02) continue;
      const d =
        `M${(cx + s).toFixed(1)},${cy.toFixed(1)} ` +
        `L${(cx + s / 2).toFixed(1)},${(cy - h / 2).toFixed(1)} ` +
        `L${(cx - s / 2).toFixed(1)},${(cy - h / 2).toFixed(1)} ` +
        `L${(cx - s).toFixed(1)},${cy.toFixed(1)} ` +
        `L${(cx - s / 2).toFixed(1)},${(cy + h / 2).toFixed(1)} ` +
        `L${(cx + s / 2).toFixed(1)},${(cy + h / 2).toFixed(1)} Z`;
      paths.push({ d, o: Math.min(0.5, o) });
    }
  }
  return (
    <Svg width={SCREEN_W} height={height} style={styles.honeycomb} pointerEvents="none">
      {paths.map((p, i) => (
        <Path key={i} d={p.d} stroke="#ECDDA8" strokeOpacity={p.o} strokeWidth={1.0} fill="none" />
      ))}
    </Svg>
  );
}

// ─── Masthead greeting (over the honeycomb) ────────────────────────────
function HomeGreeting({ firstName }: { firstName: string }) {
  const insets = useSafeAreaInsets();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const greet = greetingForHour(new Date().getHours(), lang);
  const now = new Date();
  const days = lang === 'es' ? ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const mons = lang === 'es'
    ? ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    : ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const dateLabel = `${days[now.getDay()]} · ${mons[now.getMonth()]} ${now.getDate()}`;
  return (
    <View style={[styles.masthead, { paddingTop: insets.top + 10 }]}>
      <View style={styles.mastTopRow}>
        <View style={styles.mastheadEyebrowRow}>
          <View style={styles.mastheadEyebrowBar} />
          <Text style={styles.mastheadEyebrow}>{dateLabel}</Text>
        </View>
        <Image source={VILLIE_WORDMARK} resizeMode="stretch" accessibilityLabel="villie" style={styles.mastheadLogo} />
      </View>
      <Text style={styles.greetLine} numberOfLines={1}>
        {greet}, <Text style={styles.greetName}>{firstName}</Text>
      </Text>
    </View>
  );
}

// ─── Baby-week hero — the personal anchor ("14 weeks old") ──────────────
function BabyWeekHero({ babyName, weekNumber, blurb, onWhatsChanging }: {
  babyName: string; weekNumber: number; blurb: string; onWhatsChanging: () => void;
}) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const unit = weekNumber === 1 ? (lang === 'es' ? 'semana' : 'week') : (lang === 'es' ? 'semanas' : 'weeks');
  const old = lang === 'es' ? '' : 'old';
  return (
    <View style={styles.hero}>
      {/* drifting bee + trail */}
      <View style={styles.heroBee} pointerEvents="none">
        <Svg width={58} height={34} viewBox="0 0 66 40">
          <Path d="M2 34 C 16 30, 20 12, 40 12" fill="none" stroke="#D9B24A" strokeWidth={1.3} strokeDasharray="2.5 3.5" strokeLinecap="round" />
        </Svg>
        <Image source={VILLIE_BEE} resizeMode="contain" style={styles.heroBeeImg} />
      </View>

      <Text style={styles.heroEyebrow}>{(babyName + ' · ' + (lang === 'es' ? 'esta semana' : 'this week')).toUpperCase()}</Text>
      <Text style={styles.heroBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {weekNumber} {unit}{old ? ' ' : ''}<Text style={styles.heroBigEm}>{old}</Text>
      </Text>
      <Text style={styles.heroBlurb} numberOfLines={2}>{blurb}</Text>
      <TouchableOpacity
        style={styles.heroPill}
        activeOpacity={0.85}
        onPress={onWhatsChanging}
        accessibilityRole="button"
        accessibilityLabel={lang === 'es' ? 'Qué está cambiando esta semana' : "What's changing this week"}
      >
        <Text style={styles.heroPillText}>{lang === 'es' ? 'qué está cambiando esta semana' : "what's changing this week"} ›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Quick-log circles: Feed · Sleep · Milk (+ quiet diaper) ────────────
function QuickLog({ onFeed, onSleep, onMilk, onDiaper }: {
  onFeed: () => void; onSleep: () => void; onMilk: () => void; onDiaper: () => void;
}) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const L = lang === 'es'
    ? { feed: 'Comida', sleep: 'Sueño', milk: 'Leche', diaper: '＋ registrar pañal', snap: 'foto' }
    : { feed: 'Feed', sleep: 'Sleep', milk: 'Milk', diaper: '＋ log a diaper', snap: 'snap' };
  return (
    <View style={styles.qlWrap}>
      <View style={styles.qlRow}>
        <TouchableOpacity style={styles.qlItem} activeOpacity={0.85} onPress={onFeed} accessibilityRole="button" accessibilityLabel={L.feed}>
          <View style={[styles.qlCircle, { backgroundColor: '#E84B79' }]}><Glyph d={ICON.bottle} color="#fff" size={26} sw={1.8} /></View>
          <Text style={styles.qlLabel}>{L.feed}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qlItem} activeOpacity={0.85} onPress={onSleep} accessibilityRole="button" accessibilityLabel={L.sleep}>
          <View style={[styles.qlCircle, { backgroundColor: '#FBE9BE' }]}><Glyph d={ICON.moon} color="#B98A1E" size={26} sw={1.8} /></View>
          <Text style={styles.qlLabel}>{L.sleep}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qlItem} activeOpacity={0.85} onPress={onMilk} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Registra leche desde una foto' : 'Log milk from a photo'}>
          <LinearGradient colors={['#F6C94F', '#E84B79']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.qlCircle}>
            <Glyph d={ICON.camera} color="#fff" size={25} sw={1.8} />
          </LinearGradient>
          <View style={styles.qlSnap}><Text style={styles.qlSnapText}>{L.snap}</Text></View>
          <Text style={[styles.qlLabel, { fontFamily: FONTS.v2_bold }]}>{L.milk}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.qlDiaper} activeOpacity={0.7} onPress={onDiaper} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Registrar pañal' : 'Log a diaper'}>
        <Glyph d={ICON.diaper} color="#B7A692" size={14} sw={1.6} />
        <Text style={styles.qlDiaperText}>{L.diaper}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Ask-villie bar + light contextual chips ───────────────────────────
function AskVillie({ onAsk, onBoxes, weekNumber, showBoxes }: {
  onAsk: (seed?: string) => void; onBoxes: () => void; weekNumber: number; showBoxes: boolean;
}) {
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
    <LinearGradient colors={['#FDECEF', '#FBE7D6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.askModule}>
      <Text style={styles.askEyebrow}>✦ {lang === 'es' ? 'pregúntale a villie' : 'ask villie'}</Text>
      <View style={styles.askRow}>
        <TouchableOpacity style={styles.askBar} activeOpacity={0.85} onPress={() => onAsk()} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Pregúntale o dile a Villie' : 'Ask or tell Villie anything'}>
          <View style={styles.askBee}><Image source={VILLIE_BEE} style={{ width: 16, height: 16 }} resizeMode="contain" /></View>
          <Text style={styles.askText}>{lang === 'es' ? 'pregúntale o dile lo que sea…' : 'ask or tell villie anything…'}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onAsk()} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Habla con Villie' : 'Talk to Villie'}>
          <LinearGradient colors={['#E84B79', '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.askMic}>
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
        {showBoxes && (
          <TouchableOpacity style={[styles.chip, styles.chipBox]} activeOpacity={0.85} onPress={onBoxes} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Tu caja de esta semana' : 'Your box this week'}>
            <Text style={[styles.chipText, styles.chipBoxText]}>✨ {lang === 'es' ? 'tu caja' : `week-${weekNumber} box`}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─── "Your day" glanceable cards (horizontal) ──────────────────────────
function YourDay({ babyName, onWeek, onMilk, onCheckin }: {
  babyName: string; onWeek: () => void; onMilk: () => void; onCheckin: () => void;
}) {
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  return (
    <View style={{ marginTop: 26 }}>
      <Eyebrow>{lang === 'es' ? 'tu día' : 'your day'}</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
        <TouchableOpacity activeOpacity={0.9} onPress={onWeek} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Tu semana' : 'Your week'}>
          <LinearGradient colors={['#E84B79', '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dayCard}>
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
          <Glyph d={ICON.heart} color="#B0234F" size={22} sw={1.7} />
          <View>
            <Text style={[styles.dayCardTitle, { color: T.cocoa }]}>{lang === 'es' ? '¿Y tú?' : 'And you?'}</Text>
            <Text style={[styles.dayCardSub, { color: '#B0234F' }]}>{lang === 'es' ? '¿cómo estás? →' : 'how are you? →'}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Your village — 5 round quick-nav tiles ────────────────────────────
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
            cap={['#E84B79', '#B0234F']} capIcon="gift"
            eyebrow="new · curated" eyebrowColor={T.cinnamon}
            title="Villie Boxes" sub="delivery · newborn · mama"
            onPress={onBoxes}
          />
        )}
        <DiscoverCard
          cap={['#F4C53C', '#EAB52C']} capIcon="star" imageUrl={picksImage}
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
      <LinearGradient colors={['#E98A6A', '#E84B79']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cornerCard}>
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
  const currentMilestone = useHomeStore((s) => s.currentMilestone);

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
  const askVillie = (seed?: string) => (navigation.getParent()?.getParent() as any)?.navigate('AIHelpChat', seed ? { seed, autosend: true } : {});
  // The signature "log milk from a photo" action → Milk Vault bag scanner.
  const scanMilk = () => (navigation.getParent() as any)?.navigate('Milk', { screen: 'MilkVaultScan' });
  const goMilkVault = () => (navigation.getParent() as any)?.navigate('Milk', { screen: 'MilkVaultDashboard' });

  const tiles: Tile[] = [
    { key: 'milk',    label: 'Milk',    bg: '#F7C5CB', icon: 'droplet',     go: () => navigation.getParent()?.navigate('Milk') },
    { key: 'experts', label: 'Care',    bg: '#F3B79C', icon: 'stethoscope', go: () => navigation.getParent()?.navigate('Experts') },
    { key: 'gear',    label: 'Gear',    bg: '#F4C53C', icon: 'bag',         go: () => navigation.getParent()?.navigate('Gear') },
    { key: 'plans',   label: 'Plans',   bg: '#EFB2C8', icon: 'calendar',    go: () => navigation.getParent()?.navigate('Village') },
    ...(VILLIE_BOXES_ENABLED
      ? [{ key: 'boxes', label: 'Boxes', bg: '#E8C4B6', icon: 'gift', dot: true, go: () => navigation.navigate('BoxesHub' as never) } as Tile]
      : []),
  ];

  const scrollY = useRef(new Animated.Value(0)).current;
  const [triggerAnim, setTriggerAnim] = React.useState(0);

  const [weekMilestones, setWeekMilestones] = React.useState<Milestone[]>([]);
  // The Buzz — this week's published trending-topics issue, if any.
  const [buzzIssue, setBuzzIssue] = React.useState<TheBuzzArchiveRow | null>(null);
  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      if (weekNumber && weekNumber >= 1 && weekNumber <= 52) {
        homeApi.getMilestonesForWeek(weekNumber)
          .then(setWeekMilestones)
          .catch(() => setWeekMilestones([]));
      }
      theBuzzApi.getCurrentIssue()
        .then((issue) => setBuzzIssue(issue))
        .catch(() => setBuzzIssue(null));
      return () => {};
    }, [weekNumber]),
  );

  const heroBlurb =
    weekMilestones[0]?.description ??
    currentMilestone?.description ??
    `Reaching, grabbing, and cooing back at you — tiny but mighty.`;

  // Drag-to-cover: the week hero is PINNED on top with an OPAQUE background (so
  // it can never overlap the sheet), and it FADES as you swipe up while the
  // tools sheet scrolls underneath to fill. `heroH` (measured) sizes the
  // transparent spacer so the sheet's grabber peeks right under "log a diaper".
  const [heroH, setHeroH] = React.useState(340);
  const [heroTappable, setHeroTappable] = React.useState(true);
  const tapRef = useRef(true);
  React.useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const t = value < 40;
      if (t !== tapRef.current) { tapRef.current = t; setHeroTappable(t); }
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);
  const heroFade = scrollY.interpolate({ inputRange: [0, heroH * 0.18, heroH * 0.4], outputRange: [1, 0.25, 0], extrapolate: 'clamp' });
  const miniOpacity = scrollY.interpolate({ inputRange: [heroH * 0.28, heroH * 0.5], outputRange: [0, 1], extrapolate: 'clamp' });
  const weekUnit = heroWeek === 1 ? 'week' : 'weeks';

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={triggerAnim} />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* transparent spacer — reveals the pinned hero above the sheet */}
        <View style={{ height: heroH }} pointerEvents="none" />

        {/* The sheet — rises over the pinned hero as you swipe up. */}
        <View style={styles.toolsPanel}>
          <View style={styles.grabber} />
          <AskVillie onAsk={askVillie} onBoxes={() => navigation.navigate('BoxesHub' as never)} weekNumber={heroWeek} showBoxes={VILLIE_BOXES_ENABLED} />

        <YourDay
          babyName={heroBabyName}
          onWeek={() => navigation.navigate('Insights' as never)}
          onMilk={goMilkVault}
          onCheckin={() => navigation.navigate('DailyCheckin' as never)}
        />

        {expecting && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.getParent()?.navigate('Manual', { screen: 'BeforeBaby' })}
            accessibilityRole="button"
            accessibilityLabel="Before baby arrives — hospital bag and home essentials"
            style={{ marginHorizontal: 20, marginBottom: 14 }}
          >
            <LinearGradient colors={['#E84B79', '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gettingReadyCard}>
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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FDECEF', borderRadius: 16, padding: 15, marginHorizontal: 16, marginTop: 14, borderWidth: 1, borderColor: 'rgba(194,85,111,0.25)' }}
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

        {/* Plan my day — calendar-aware daily plan (naps/feeds/pump woven
            around your meetings). */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('DayPlan' as never)}
          style={styles.planDayCard}
          accessibilityRole="button"
          accessibilityLabel="Plan my day — weave naps, feeds and pumping around your calendar"
        >
          <View style={styles.planDayIcon}><Text style={{ fontSize: 19 }}>🗓️</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.planDayTitle}>Plan my day</Text>
            <Text style={styles.planDaySub} numberOfLines={2}>Nap, feed + pump slots woven around your calendar →</Text>
          </View>
        </TouchableOpacity>

        {/* Day Sheet — caregiver handoff (schedule + tips + QR/PDF). */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('DaySheetList' as never)}
          style={styles.handoffCard}
          accessibilityRole="button"
          accessibilityLabel={`Make a day sheet — hand off ${heroBabyName}'s routine to a sitter or grandparent`}
        >
          <View style={styles.handoffIcon}><Text style={{ fontSize: 20 }}>📋</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.handoffTitle}>Make a day sheet</Text>
            <Text style={styles.handoffSub} numberOfLines={2}>Hand off {heroBabyName}'s routine to a sitter or grandparent →</Text>
          </View>
        </TouchableOpacity>

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

      {/* PINNED hero — opaque, on top, fades as the sheet covers it. Buttons
          stay tappable (box-none) at rest; non-interactive once scrolled. */}
      <Animated.View
        style={[styles.fixedHero, { opacity: heroFade }]}
        pointerEvents={heroTappable ? 'box-none' : 'none'}
        onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}
      >
        <HomeGreeting firstName={firstName} />
        <BabyWeekHero
          babyName={heroBabyName}
          weekNumber={heroWeek}
          blurb={heroBlurb}
          onWhatsChanging={() => goManualView('manual')}
        />
        <QuickLog
          onFeed={() => goManualView('playbook')}
          onSleep={() => goManualView('playbook')}
          onMilk={scanMilk}
          onDiaper={() => goManualView('playbook')}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.miniHeader, { paddingTop: insets.top + 4, opacity: miniOpacity }]}>
        <Text style={styles.miniHeaderText}>{heroBabyName.toLowerCase()} · {heroWeek} {weekUnit} old</Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream, overflow: 'hidden' },
  scroll: { paddingTop: 0, paddingHorizontal: 22, paddingBottom: 0 },

  // Pinned hero layer — opaque so it never overlaps the sheet; fades on scroll.
  fixedHero: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: 56, paddingHorizontal: 22, backgroundColor: T.cream },

  // Lifted tools panel — clean paper surface with a rounded top + soft top
  // shadow that visually separates the utility half from the personal hero.
  toolsPanel: {
    marginTop: 0, marginHorizontal: -22, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 110,
    backgroundColor: '#FFFDFA', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: T.walnut, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.09, shadowRadius: 22, elevation: 8,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#EBDCC2', alignSelf: 'center', marginTop: 6, marginBottom: 8 },
  whatsChanging: { alignSelf: 'center', backgroundColor: '#FDECEF', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, marginBottom: 2 },
  whatsChangingText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#B0234F' },

  // ── Top region (honeycomb + masthead + hero) ─────────────────────────
  topWrap: { position: 'relative' },
  honeycomb: { position: 'absolute', top: 0, left: -22 },

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

  // ── Masthead greeting ────────────────────────────────────────────────
  masthead: {
    marginTop: -56, marginHorizontal: -22,
    paddingBottom: 2, paddingHorizontal: 22,
  },
  mastTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mastheadLogo: { width: 60, height: 25, opacity: 0.9 },
  mastheadEyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  greetLine: { fontFamily: FONTS.v2_body, fontSize: 15, color: '#5A4030', marginTop: 12 },
  greetName: { fontFamily: FONTS.v3_display_italic, fontSize: 21, color: T.cinnamon },
  mastheadEyebrowBar: { width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 },
  mastheadEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2.2,
    textTransform: 'uppercase', color: T.walnut, fontWeight: '500',
  },
  mastheadText: {
    fontFamily: FONTS.v3_display, fontSize: 25, lineHeight: 28,
    color: T.cocoa, letterSpacing: -1.0,
  },
  mastheadName: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon },

  // ── Baby-week hero ───────────────────────────────────────────────────
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 4, paddingHorizontal: 16 },
  heroBee: { position: 'absolute', top: 12, right: 26, flexDirection: 'row', alignItems: 'flex-start' },
  heroBeeImg: { width: 24, height: 24, marginLeft: -6, marginTop: -2 },
  heroEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 2, fontWeight: '600',
    color: T.cinnamon, textAlign: 'center',
  },
  heroBig: {
    fontFamily: FONTS.v3_display, fontSize: 46, lineHeight: 48,
    color: T.cocoa, letterSpacing: -1.2, marginTop: 10, textAlign: 'center',
    paddingHorizontal: 10,
  },
  heroBigEm: { fontFamily: FONTS.v3_display_italic, color: '#E98A6A', paddingRight: 6 },
  heroBlurb: {
    fontFamily: FONTS.v2_body, fontSize: 14.5, lineHeight: 21,
    color: '#5A4030', marginTop: 12, textAlign: 'center', maxWidth: 300,
  },
  heroPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FDECEF', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 9, marginTop: 15,
  },
  heroPillText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#B0234F' },

  // ── Quick-log ────────────────────────────────────────────────────────
  qlWrap: { marginTop: 22 },
  qlRow: { flexDirection: 'row', justifyContent: 'center', gap: 34 },
  qlItem: { alignItems: 'center' },
  qlCircle: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 2,
  },
  qlSnap: {
    position: 'absolute', top: -3, right: 8,
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3,
  },
  qlSnapText: { fontFamily: FONTS.v2_bold, fontSize: 8.5, color: '#B0234F', letterSpacing: 0.3 },
  qlLabel: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: T.cocoa, marginTop: 8 },
  qlDiaper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 14 },
  qlDiaperText: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: '#9A8264' },

  // ── Ask villie ───────────────────────────────────────────────────────
  askModule: { marginTop: 6, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: 'rgba(224,106,136,0.2)' },
  askEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#B0234F', fontWeight: '600', marginBottom: 9 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  askBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, shadowColor: T.walnut, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 },
  askBee: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FDECEF', alignItems: 'center', justifyContent: 'center' },
  askText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13.5, color: '#9A8264' },
  askMic: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#E84B79', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 11, elevation: 4 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingRight: 22 },
  chip: { borderWidth: 1.2, borderColor: 'rgba(224,106,136,0.28)', backgroundColor: '#FFFDF9', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#B0234F' },
  chipBox: { borderColor: 'rgba(224,106,136,0.4)', backgroundColor: '#FBD9E1' },
  chipBoxText: { color: '#B23D5E', fontFamily: FONTS.bodySemiBold },

  // ── Your day ─────────────────────────────────────────────────────────
  dayScroll: { paddingTop: 14, paddingRight: 22, gap: 12 },
  dayCard: {
    width: 150, minHeight: 118, borderRadius: 16, padding: 14, justifyContent: 'space-between',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 2,
  },
  dayCardTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 14.5, color: '#43260F', lineHeight: 18 },
  dayCardSub: { fontFamily: FONTS.v2_body, fontSize: 11, marginTop: 3 },

  // ── Emergency ────────────────────────────────────────────────────────
  gettingReadyCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  gettingReadyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  gettingReadyIconText: { fontFamily: FONTS.bodyBold, fontSize: 18, color: '#4A1F2C' },
  gettingReadyEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.3, color: '#4A1F2C' },
  gettingReadyTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: '#4A1F2C', letterSpacing: -0.3, marginTop: 2 },
  gettingReadySub: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#5c3b2a', marginTop: 1 },
  handoffCard: {
    marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FBEFD0', borderRadius: 16, padding: 15,
    borderWidth: 1, borderColor: 'rgba(224,182,62,0.35)',
  },
  handoffIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,252,246,0.7)', alignItems: 'center', justifyContent: 'center' },
  handoffTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: T.cocoa, letterSpacing: -0.3 },
  handoffSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#8A6A1E', marginTop: 2, lineHeight: 16 },

  planDayCard: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.paper, borderRadius: 16, padding: 15,
    borderWidth: 1, borderColor: 'rgba(217,108,136,0.22)',
  },
  planDayIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FBE1DE', alignItems: 'center', justifyContent: 'center' },
  planDayTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: T.cocoa, letterSpacing: -0.3 },
  planDaySub: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#8A6A55', marginTop: 2, lineHeight: 16 },

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
