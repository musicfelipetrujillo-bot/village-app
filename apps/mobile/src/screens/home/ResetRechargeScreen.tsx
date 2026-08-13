// ResetRechargeScreen — "i need a sec" (Mama's Corner → Reset & Recharge)
//
// The one part of villie that is purely for her nervous system. Everything else
// in Mama's Corner is logistics; this is the 3am screen — one-handed, baby on
// her chest, lights off.
//
// Three rules it has to keep (they're what separate this from the mom-tracking
// roadmap the founder killed):
//   1. NOTHING TO SET UP — no profile, no preferences, no first-run questions.
//   2. NOTHING TO MAINTAIN — no streaks, no history, no progress to fall behind.
//   3. ONE TAP TO RELIEF — the thing she came for happens on the first tap.
//
// ⚠️ MOOD IS A DOORWAY, NOT A METRIC. She taps "anxious" to reach the right
// track. That choice is NEVER stored, trended, or reflected back at her — doing
// so would rebuild mood-correlation through a side door. Stateless every time.
//
// ⚠️ THIS IS NOT AN EMERGENCY SURFACE. villie already has two (the "in an
// emergency" Quick Reference hub and the crisis sheet). A calming exercise must
// never wear the word "emergency", or a mother in real crisis taps it and gets a
// breathing circle instead of 988. Hence "i need a sec". The quiet line at the
// bottom is the bridge for anyone who opened the wrong door.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { BackButton } from '@components/shared/BackButton';
import CrisisResourcesSheet from '@components/community/CrisisResourcesSheet';
import { useUserStore } from '@store/user';
import { tap, select } from '@utils/haptics';
import {
  COMFORT_SOUNDS, SLEEP_TIMERS, isComfortAudioReady, playComfortSound, stopComfortSound,
  playingSoundId, type ComfortSound, type ComfortSoundId,
} from '@/lib/comfortAudio';

const ROSE = '#C24A63';
const INK = '#43260F', INKSOFT = '#7A5A3A', MUTED = '#A6957F';

// ── The design idea: this screen is Mama's Corner at DUSK ────────────────────
// Plan-my-day is the warm rose daylight card — logistics, the day ahead. This
// is its counterpart: the same footprint, a different time of day. Reaching for
// dusk instead of a second rose gradient is what lets this have real presence
// without competing with the one warm moment upstairs.
//
// It also fixes the actual complaint: v1 made every element the same shape —
// glyph, text, chevron, flat pale card — so the screen read as a wall of rows
// with no hierarchy. Now there are THREE distinct visual forms: one dusk hero
// (breathing), three tonal sound tiles, and a magazine index (meditations).
const DUSK: [string, string] = ['#3F2C4D', '#6A4463'];
const DUSK_DEEP = '#2E1F3A';
const CREAM = '#FFFDF8';

// Each sound gets its own tone AND its own waveform signature. A row of three
// identical emoji tiles is what made these read as filler; a bar signature is
// legible at a glance, says "sound" without language, and gives each one an
// identity she can learn. Heights are 0-1 of the plot height.
const SOUND_TONE: Record<string, { tint: string; ink: string; grad: [string, string]; wave: number[] }> = {
  // A long soft exhale — tapers away.
  shush:       { tint: '#FBEAEF', ink: '#B4527A', grad: ['#E58BA8', '#C2556F'], wave: [1, .86, .72, .58, .45, .34, .25, .18] },
  // Even and unbroken — that's the whole point of white noise.
  white_noise: { tint: '#E9EEF4', ink: '#5E7392', grad: ['#8AA3C4', '#5E7392'], wave: [.62, .7, .64, .72, .66, .7, .63, .69] },
  // Irregular, like drops landing.
  rain:        { tint: '#E6EDF0', ink: '#4E7382', grad: ['#7FA8B8', '#4E7382'], wave: [.35, .85, .28, .62, .9, .3, .7, .42] },
};

function Waveform({ bars, color, dim = false }: { bars: number[]; color: string; dim?: boolean }) {
  return (
    <View style={styles.wave} pointerEvents="none">
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3.5,
            borderRadius: 2,
            height: Math.max(4, h * 30),
            backgroundColor: color,
            opacity: dim ? 0.32 : 0.9,
          }}
        />
      ))}
    </View>
  );
}

// ── Breathing ───────────────────────────────────────────────────────────────
// 4 in · 4 hold · 6 out. The long exhale is the point — it's what actually pulls
// the nervous system down. Four cycles ≈ 56s, so "one minute" is honest.
const PHASES = [
  { key: 'in',   ms: 4000, en: 'breathe in',  es: 'inhala' },
  { key: 'hold', ms: 4000, en: 'hold',        es: 'sostén' },
  { key: 'out',  ms: 6000, en: 'breathe out', es: 'exhala' },
] as const;
const CYCLES = 4;

function Breathing({ es, onDone }: { es: boolean; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.55)).current;
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const stopped = useRef(false);

  // `onDone` is an inline arrow from the parent, so its identity changes on
  // every parent render. Held in a ref and kept OUT of the effect deps: with it
  // in deps, any parent re-render (tapping a sound tile mid-breath) tore down
  // the timer chain and restarted her from 1/4.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stopped.current = false;
    let i = 0, c = 0;

    const run = () => {
      if (stopped.current) return;
      const phase = PHASES[i];
      setPhaseIdx(i);
      setCycle(c);
      // The circle IS the instruction — it has to be readable with the sound off
      // and the screen dim, so the motion carries the whole cue.
      const to = phase.key === 'in' ? 1 : phase.key === 'out' ? 0.55 : undefined;
      if (to !== undefined) {
        Animated.timing(scale, {
          toValue: to, duration: phase.ms, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }).start();
      }
      timer.current = setTimeout(() => {
        if (stopped.current) return;
        i += 1;
        if (i >= PHASES.length) { i = 0; c += 1; }
        if (c >= CYCLES) { onDoneRef.current(); return; }
        run();
      }, phase.ms);
    };
    run();
    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scale]);

  const phase = PHASES[phaseIdx];
  return (
    <View style={styles.breathWrap}>
      <View style={styles.breathCircleTrack}>
        <Animated.View style={[styles.breathCircle, { transform: [{ scale }] }]} />
      </View>
      <Text style={styles.breathPhase}>{es ? phase.es : phase.en}</Text>
      <Text style={styles.breathCount}>{cycle + 1} / {CYCLES}</Text>
    </View>
  );
}

// ── Meditation doors ────────────────────────────────────────────────────────
// Named for the state she is IN, not for a technique. She should recognise
// herself in one of these in under a second and not have to browse.
const DOORS = [
  { id: 'anxious',  emoji: '🌫️', en: 'calm the anxiety', es: 'calma la ansiedad' },
  { id: 'reset',    emoji: '⏱️', en: 'quick reset',       es: 'reinicio rápido' },
  { id: 'sleep',    emoji: '🌙', en: "can't sleep",       es: 'no puedo dormir' },
  { id: 'grateful', emoji: '🕊️', en: 'gratitude',         es: 'gratitud' },
] as const;

export default function ResetRechargeScreen() {
  const navigation = useNavigation<any>();
  const lang = useUserStore((s) => (s.profile?.preferred_language ?? 'en')) as 'en' | 'es';
  const es = lang === 'es';

  const [breathing, setBreathing] = useState(false);
  // Seeded from the audio module rather than from null: sound deliberately
  // outlives this screen, so on re-entry the tile has to show what is actually
  // coming out of the speaker.
  const [playing, setPlaying] = useState<ComfortSoundId | null>(() => playingSoundId());
  const [timerMin, setTimerMin] = useState<number | null>(30);
  const [crisisOpen, setCrisisOpen] = useState(false);

  // Sounds are NATIVE-gated (expo-audio + UIBackgroundModes land on the next
  // EAS build); meditations have no recordings yet. Both used to look fully
  // live and answer a tap with a one-line note rendered ABOVE the meditations
  // list — off-screen from where she tapped — so the rows read as dead. They
  // now carry a `soon` mark and say so before she taps, which is the only
  // honest version of this at 3am.
  const soundsReady = COMFORT_SOUNDS.some(isComfortAudioReady);
  const MEDITATIONS_READY = false;

  // No stop-on-unmount: sound continuing when she puts the phone down IS the
  // feature. Reconcile the tile with reality when iOS hands the app back — a
  // phone call can end playback without telling us.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setPlaying(playingSoundId());
    });
    return () => sub.remove();
  }, []);

  const toggleSound = useCallback(async (sound: ComfortSound) => {
    if (!isComfortAudioReady(sound)) { select(); return; }
    tap();
    if (playing === sound.id) { await stopComfortSound(); setPlaying(null); return; }
    try {
      await playComfortSound(sound, timerMin);
      setPlaying(sound.id);
    } catch {
      // Whatever the module ended up doing is the truth, not our optimism.
      setPlaying(playingSoundId());
    }
  }, [playing, timerMin]);

  return (
    <View style={styles.screen}>
      <WarmGlowBackdrop />
      <View style={styles.header}>
        <BackButton color={ROSE} />
        <View style={styles.dot} />
        <Text style={styles.hTitle}>{es ? 'un momento' : 'i need a sec'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          {es ? 'Nada que configurar. Empieza donde estás.' : 'Nothing to set up. Start where you are.'}
        </Text>

        {/* The first tap has to be the relief itself — not a menu. */}
        {breathing ? (
          <View style={styles.breathCard}>
            <Breathing es={es} onDone={() => { setBreathing(false); select(); }} />
            <TouchableOpacity onPress={() => { tap(); setBreathing(false); }} accessibilityRole="button">
              <Text style={styles.breathStop}>{es ? 'listo' : 'done'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* The hero. This is the reason she opened the screen, so it gets the
             weight — a dusk field with the breathing rings already visible, so
             the card previews the thing it does instead of describing it. */
          <TouchableOpacity
            style={styles.heroShadow} activeOpacity={0.93}
            onPress={() => { tap(); setBreathing(true); }}
            accessibilityRole="button"
            accessibilityLabel={es ? 'Respira conmigo, un minuto' : 'Breathe with me, one minute'}
          >
            <LinearGradient colors={DUSK} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              {/* Static preview of the breathing circle — concentric rings, so
                  the card reads as "a moment" rather than another list row. */}
              <View style={styles.heroRings} pointerEvents="none">
                <View style={[styles.ring, styles.ring1]} />
                <View style={[styles.ring, styles.ring2]} />
                <View style={[styles.ring, styles.ring3]} />
              </View>
              <Text style={styles.heroEyebrow}>{es ? 'UN MINUTO' : 'ONE MINUTE'}</Text>
              <Text style={styles.heroTitle}>{es ? 'Respira\nconmigo' : 'Breathe\nwith me'}</Text>
              <Text style={styles.heroSub}>
                {es ? '4 dentro · 4 sostén · 6 fuera' : '4 in · 4 hold · 6 out'}
              </Text>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{es ? 'empezar ›' : 'start ›'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Comfort sounds — one tap, keeps playing when she puts the phone down. */}
        <Text style={styles.sectionLabel}>{es ? 'SONIDOS' : 'SOUNDS'}</Text>
        <View style={styles.soundRow}>
          {COMFORT_SOUNDS.map((s) => {
            const active = playing === s.id;
            const ready = isComfortAudioReady(s);
            const tone = SOUND_TONE[s.id] ?? SOUND_TONE.shush;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.soundTile, { backgroundColor: tone.tint, borderColor: active ? 'transparent' : `${tone.ink}22` },
                  !ready && styles.notReady,
                  active && { shadowColor: tone.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 }]}
                activeOpacity={ready ? 0.9 : 1}
                onPress={() => { void toggleSound(s); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !ready }}
                accessibilityLabel={`${es ? s.labelEs : s.labelEn}${ready ? '' : es ? ', pronto' : ', coming soon'}`}
              >
                {/* Playing = the tile fills with its own colour. The state
                    change is the whole tile, not a small badge, so she can see
                    what's on from across a dim room. */}
                {active && (
                  <LinearGradient
                    colors={tone.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Waveform bars={tone.wave} color={active ? CREAM : tone.ink} dim={!active} />
                <Text style={[styles.soundLabel, { color: active ? CREAM : tone.ink }]}>
                  {es ? s.labelEs : s.labelEn}
                </Text>
                <Text style={[styles.soundState, { color: active ? 'rgba(255,253,248,0.85)' : `${tone.ink}88` }]}>
                  {!ready ? (es ? 'pronto' : 'soon')
                    : active ? (es ? 'sonando' : 'playing') : (es ? 'tocar' : 'tap')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* The sleep timer only means something once there is audio to stop —
            it used to sit here as a live-looking control over nothing. */}
        {soundsReady ? (
          <View style={styles.timerRow}>
            <Text style={styles.timerLabel}>{es ? 'apagar en' : 'stop after'}</Text>
            {SLEEP_TIMERS.map((m) => (
              <TouchableOpacity
                key={String(m)}
                style={[styles.timerChip, timerMin === m && styles.timerChipOn]}
                onPress={() => { select(); setTimerMin(m); }}
                accessibilityRole="button"
                accessibilityState={{ selected: timerMin === m }}
              >
                <Text style={[styles.timerChipText, timerMin === m && styles.timerChipTextOn]}>
                  {m == null ? (es ? 'sin límite' : 'no limit') : `${m}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.note}>
            {es
              ? 'Los sonidos llegan con la próxima actualización de la app.'
              : 'Sounds arrive with the next app update.'}
          </Text>
        )}

        {/* Meditations — doors named for how she feels, never logged. */}
        <Text style={styles.sectionLabel}>{es ? 'MEDITACIONES' : 'MEDITATIONS'}</Text>
        {/* A numbered index, not a fourth card of chevron rows. Same magazine
            form Mama's Corner uses for "for you" — it gives the screen a third
            distinct shape and lets the mood names carry at display size. */}
        <View style={styles.index}>
          {DOORS.map((d, i) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.indexRow, i === 0 && { borderTopWidth: 0 }, !MEDITATIONS_READY && styles.notReady]}
              activeOpacity={MEDITATIONS_READY ? 0.7 : 1}
              onPress={() => { select(); }}
              accessibilityRole="button"
              accessibilityState={{ disabled: !MEDITATIONS_READY }}
              accessibilityLabel={`${es ? d.es : d.en}${MEDITATIONS_READY ? '' : es ? ', pronto' : ', coming soon'}`}
            >
              <Text style={styles.indexNum}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.indexText}>{es ? d.es : d.en}</Text>
              {!MEDITATIONS_READY && (
                <View style={styles.soonPill}>
                  <Text style={styles.soonPillText}>{es ? 'pronto' : 'soon'}</Text>
                </View>
              )}
              <Text style={styles.indexGlyph}>{d.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!MEDITATIONS_READY && (
          <Text style={styles.note}>
            {es
              ? 'Las meditaciones llegan con la próxima actualización.'
              : 'Meditations arrive with the next app update.'}
          </Text>
        )}

        {/* The bridge. Quiet on purpose — it must be findable without being
            alarming, because most people reading it are just tired. */}
        <TouchableOpacity
          style={styles.crisisLine}
          onPress={() => { tap(); setCrisisOpen(true); }}
          accessibilityRole="button"
        >
          <Text style={styles.crisisText}>
            {es
              ? 'Si necesitas hablar con alguien ahora — estamos aquí ›'
              : 'If you need to talk to someone right now — we’re here ›'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <CrisisResourcesSheet
        visible={crisisOpen}
        onClose={() => setCrisisOpen(false)}
        lead={es
          ? 'No tienes que estar en crisis para usar esto. Son gratis, confidenciales y para mamás.'
          : "You don't have to be in crisis to use these. They're free, confidential, and for new moms."}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.v2_paper },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 58, paddingBottom: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ROSE, marginLeft: 10, marginRight: 8 },
  hTitle: { fontFamily: FONTS.v3_display, fontSize: 22, color: INK, letterSpacing: -0.4 },
  scroll: { paddingHorizontal: 18, paddingBottom: 120 },
  intro: { fontFamily: FONTS.v2_body, fontSize: 15, color: INKSOFT, marginTop: 6, marginBottom: 18 },

  // ── Hero: breathe with me ────────────────────────────────────────────────
  heroShadow: {
    borderRadius: 24,
    shadowColor: DUSK_DEEP, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28, shadowRadius: 22, elevation: 5,
  },
  hero: {
    borderRadius: 24, paddingHorizontal: 20, paddingVertical: 22,
    minHeight: 186, overflow: 'hidden', justifyContent: 'flex-end',
  },
  // Concentric rings, bled off the top-right corner. They preview the breathing
  // circle so the card shows the thing it does instead of naming it.
  heroRings: { position: 'absolute', top: -54, right: -46, width: 210, height: 210, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999, borderColor: 'rgba(255,253,248,0.30)' },
  ring1: { width: 210, height: 210, borderWidth: 1 },
  ring2: { width: 150, height: 150, borderWidth: 1.5 },
  ring3: { width: 92, height: 92, borderWidth: 2, backgroundColor: 'rgba(255,253,248,0.10)' },
  heroEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2.4, color: 'rgba(255,253,248,0.72)' },
  heroTitle: { fontFamily: FONTS.v3_display, fontSize: 32, lineHeight: 35, color: CREAM, letterSpacing: -0.8, marginTop: 6 },
  heroSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: 'rgba(255,253,248,0.82)', marginTop: 7 },
  heroPill: {
    marginTop: 15, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8,
  },
  heroPillText: { fontFamily: FONTS.v2_bold, fontSize: 12.5, color: CREAM, letterSpacing: 0.3 },

  // Breathing, running — same dusk field so starting it feels like the card
  // opening rather than a jump to a different screen.
  breathCard: {
    backgroundColor: DUSK_DEEP, borderRadius: 24, paddingVertical: 32, alignItems: 'center',
    overflow: 'hidden',
  },
  breathWrap: { alignItems: 'center' },
  breathCircleTrack: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  breathCircle: { width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(240,184,196,0.34)' },
  breathPhase: { fontFamily: FONTS.v3_display, fontSize: 26, color: CREAM, marginTop: 18, letterSpacing: -0.3 },
  breathCount: { fontFamily: FONTS.v2_mono, fontSize: 11, color: 'rgba(255,253,248,0.60)', letterSpacing: 2.4, marginTop: 6 },
  breathStop: { fontFamily: FONTS.v2_body, fontSize: 15, color: 'rgba(255,253,248,0.78)', marginTop: 20 },

  sectionLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.4, color: MUTED,
    marginTop: 30, marginBottom: 11,
  },

  // ── Sounds: three tonal tiles, each with its own waveform ────────────────
  soundRow: { flexDirection: 'row', gap: 10 },
  soundTile: {
    flex: 1, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 8,
    alignItems: 'center', borderWidth: 1, overflow: 'hidden', minHeight: 122,
    justifyContent: 'center',
  },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 32 },
  soundLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 13, marginTop: 12, textAlign: 'center' },
  soundState: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, marginTop: 3 },

  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, flexWrap: 'wrap' },
  timerLabel: { fontFamily: FONTS.v2_body, fontSize: 12, color: MUTED, marginRight: 2 },
  timerChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: '#EFE3D2', backgroundColor: COLORS.v2_card,
  },
  timerChipOn: { backgroundColor: '#FDECEF', borderColor: '#F3C6D2' },
  timerChipText: { fontFamily: FONTS.v2_body, fontSize: 12, color: INKSOFT },
  timerChipTextOn: { color: ROSE },
  note: { fontFamily: FONTS.v2_body, fontSize: 13, color: MUTED, marginTop: 10 },

  // Not-yet-built controls: legible, clearly not live, never disabled-grey —
  // this screen is read in the dark and grey-on-cream disappears.
  notReady: { opacity: 0.55 },
  soonPill: {
    backgroundColor: COLORS.v2_parchment, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(192,120,64,0.3)',
  },
  soonPillText: {
    fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.2,
    textTransform: 'uppercase', color: INKSOFT, fontWeight: '600',
  },

  // ── Meditations: magazine index, no card ────────────────────────────────
  index: { marginTop: 2 },
  indexRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(122,74,40,0.18)',
  },
  indexNum: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.6, color: '#C9B7A2', width: 20 },
  indexText: { flex: 1, fontFamily: FONTS.v3_display, fontSize: 19, color: INK, letterSpacing: -0.4 },
  indexGlyph: { fontSize: 17, opacity: 0.75 },

  crisisLine: { marginTop: 26, paddingVertical: 10 },
  crisisText: { fontFamily: FONTS.v2_body, fontSize: 13, color: INKSOFT, textAlign: 'center' },
});
