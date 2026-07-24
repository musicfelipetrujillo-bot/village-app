// DeepDiveVideoCard — the villie+ specialist deep-dive video, per Manual
// category. The paywall-as-trailer: a frosted still (not a grey box), the
// credential leading, the named payoff, and Preview + Unlock CTAs.
//
//   • free user  → locked state: frosted still + lock + "villie+" pill,
//                  [Unlock with villie+] (deep rose) + [Preview] (~15s tease)
//   • villie+    → playable state: still + play button, tap → full video
//
// Pure presentational — the parent wires onOpen('play'|'preview') + onUnlock.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Ellipse } from 'react-native-svg';
import { FONTS } from '@utils/constants';
import { tap } from '@utils/haptics';
import type { DeepDive } from '@/manual/manualDeepDives';

const ROSE = '#E84B79';
const BERRY = '#B0234F';
const HONEY = '#F5C842';
const INK = '#43260F';
const INKSOFT = '#7A5A3A';
const CREAM = '#FFFCF6';
const SOFT = '#F7A9BE';
const LINE = 'rgba(67,38,15,0.08)';

type Lang = 'en' | 'es';

const T = {
  overline: { en: 'Specialist deep-dive', es: 'Especialista a fondo' },
  unlock: { en: 'Unlock with villie+', es: 'Desbloquéalo con villie+' },
  preview: { en: 'Preview', es: 'Vista previa' },
  watch: { en: 'Watch', es: 'Ver' },
} as const;

const TITLES = new Set(['dr', 'dr.', 'nurse', 'mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.']);
function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w && !TITLES.has(w.toLowerCase()));
  const picks = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '');
  return picks.join('') || name.slice(0, 1).toUpperCase();
}

function PlayIcon({ color = BERRY, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5v14l11-7z" fill={color} />
    </Svg>
  );
}
function LockIcon({ color = BERRY, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="11" width="14" height="10" rx="2.4" fill={color} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

// A faint silhouette behind the frost — "there's a specialist + a baby here".
function FrostFigure() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 90" style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice">
      <Circle cx={42} cy={38} r={15} fill={CREAM} opacity={0.5} />
      <Rect x={30} y={52} width={24} height={30} rx={11} fill={CREAM} opacity={0.5} />
      <Ellipse cx={80} cy={66} rx={16} ry={10} fill={CREAM} opacity={0.5} />
    </Svg>
  );
}

export default function DeepDiveVideoCard({
  data,
  lang = 'en',
  isPro,
  onOpen,
  onUnlock,
}: {
  data: DeepDive;
  lang?: Lang;
  isPro: boolean;
  onOpen: (mode: 'play' | 'preview') => void;
  onUnlock: () => void;
}) {
  const initials = initialsOf(data.expert);

  return (
    <View style={s.wrap}>
      {/* Still */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => { tap(); isPro ? onOpen('play') : onUnlock(); }}
        accessibilityRole="button"
        accessibilityLabel={
          isPro
            ? `${T.watch[lang]}: ${data.title}, ${data.expert}`
            : `${T.unlock[lang]}: ${data.title}, ${data.expert}`
        }
      >
        <View style={s.still}>
          <LinearGradient
            colors={[ROSE, BERRY]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <FrostFigure />
          {!isPro && <View style={s.frost} />}
          {!isPro && (
            <View style={s.plusPill}>
              <Text style={s.plusPillT}>✦ villie+</Text>
            </View>
          )}
          <View style={s.circleBtn}>
            {isPro ? <PlayIcon color={BERRY} size={22} /> : <LockIcon color={BERRY} size={22} />}
          </View>
          <View style={s.durChip}>
            <Text style={s.durChipT}>{data.duration}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Body */}
      <View style={s.body}>
        <Text style={s.overline}>{T.overline[lang].toUpperCase()}</Text>
        <View style={s.cred}>
          <View style={s.av}><Text style={s.avT}>{initials}</Text></View>
          <View style={s.credText}>
            <Text style={s.credName} numberOfLines={1}>{data.expert}</Text>
            <Text style={s.credRole} numberOfLines={1}>{data.role}</Text>
          </View>
        </View>
        <Text style={s.title}>{data.title}</Text>
        <Text style={s.value}>{data.value}</Text>

        {isPro ? (
          <TouchableOpacity
            style={s.watchRow}
            activeOpacity={0.85}
            onPress={() => { tap(); onOpen('play'); }}
            accessibilityRole="button"
            accessibilityLabel={`${T.watch[lang]}: ${data.title}`}
          >
            <PlayIcon color={ROSE} size={16} />
            <Text style={s.watchT}>{T.watch[lang]} · {data.duration}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.cta}>
            <TouchableOpacity
              style={s.btnUnlock}
              activeOpacity={0.9}
              onPress={() => { tap(); onUnlock(); }}
              accessibilityRole="button"
              accessibilityLabel={T.unlock[lang]}
            >
              <Text style={s.btnUnlockT}>{T.unlock[lang]}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnPreview}
              activeOpacity={0.85}
              onPress={() => { tap(); onOpen('preview'); }}
              accessibilityRole="button"
              accessibilityLabel={`${T.preview[lang]}: ${data.title}`}
            >
              <PlayIcon color={ROSE} size={13} />
              <Text style={s.btnPreviewT}>{T.preview[lang]}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: LINE,
  },
  still: {
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frost: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,15,22,0.30)' },
  plusPill: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: HONEY, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  plusPillT: { fontFamily: FONTS.v2_bold, fontSize: 10, letterSpacing: 0.6, color: INK },
  circleBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,252,246,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  durChip: {
    position: 'absolute', bottom: 11, right: 11,
    backgroundColor: 'rgba(28,15,22,0.6)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  durChipT: { fontFamily: FONTS.v2_bold, fontSize: 10.5, color: CREAM },
  body: { padding: 15 },
  overline: { fontFamily: FONTS.v2_bold, fontSize: 10, letterSpacing: 1.6, color: ROSE, marginBottom: 9 },
  cred: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  av: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  avT: { fontFamily: FONTS.v2_bold, fontSize: 13, color: BERRY },
  credText: { flex: 1 },
  credName: { fontFamily: FONTS.v2_bold, fontSize: 13, color: INK },
  credRole: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: INKSOFT, marginTop: 1 },
  title: { fontFamily: FONTS.v3_display, fontSize: 19, color: INK, letterSpacing: -0.2 },
  value: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: INKSOFT, lineHeight: 20, marginTop: 5 },
  cta: { flexDirection: 'row', gap: 9, marginTop: 14 },
  btnUnlock: {
    flex: 1, backgroundColor: BERRY, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  btnUnlockT: { fontFamily: FONTS.v2_bold, fontSize: 14, color: CREAM },
  btnPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CREAM, borderRadius: 12, borderWidth: 1, borderColor: SOFT,
    paddingVertical: 12, paddingHorizontal: 15,
  },
  btnPreviewT: { fontFamily: FONTS.v2_bold, fontSize: 13, color: ROSE },
  watchRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  watchT: { fontFamily: FONTS.v2_bold, fontSize: 14, color: ROSE },
});
