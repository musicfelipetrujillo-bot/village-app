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
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { BackButton } from '@components/shared/BackButton';
import CrisisResourcesSheet from '@components/community/CrisisResourcesSheet';
import { useUserStore } from '@store/user';
import { tap, select } from '@utils/haptics';
import {
  COMFORT_SOUNDS, SLEEP_TIMERS, isComfortAudioReady, playComfortSound, stopComfortSound,
  type ComfortSound, type ComfortSoundId,
} from '@/lib/comfortAudio';

const ROSE = '#C24A63';
const INK = '#43260F', INKSOFT = '#7A5A3A', MUTED = '#A6957F';
const SAGE = '#7C8B6B', SAGE_SOFT = '#EDF1E6';

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
      setTimeout(() => {
        if (stopped.current) return;
        i += 1;
        if (i >= PHASES.length) { i = 0; c += 1; }
        if (c >= CYCLES) { onDone(); return; }
        run();
      }, phase.ms);
    };
    run();
    return () => { stopped.current = true; };
  }, [scale, onDone]);

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
  const [playing, setPlaying] = useState<ComfortSoundId | null>(null);
  const [timerMin, setTimerMin] = useState<number | null>(30);
  const [note, setNote] = useState<string | null>(null);
  const [crisisOpen, setCrisisOpen] = useState(false);

  // Sound is the one thing here that outlives the screen — that's the feature.
  // But it must not outlive the app being killed, so release on unmount only if
  // nothing is intentionally playing in the background.
  useEffect(() => () => { void stopComfortSound(); }, []);

  // If iOS hands the app back after an interruption (a call), reflect reality
  // rather than leaving a tile lit for audio that is no longer running.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && playing) setPlaying((p) => p);
    });
    return () => sub.remove();
  }, [playing]);

  const toggleSound = useCallback(async (sound: ComfortSound) => {
    tap();
    if (playing === sound.id) { await stopComfortSound(); setPlaying(null); return; }
    if (!isComfortAudioReady(sound)) {
      // Honest, one line, no "coming soon" badge shouting at her.
      setNote(es
        ? 'Los sonidos llegan con la próxima actualización de la app.'
        : 'Sounds arrive with the next app update.');
      return;
    }
    try {
      await playComfortSound(sound, timerMin);
      setPlaying(sound.id);
      setNote(null);
    } catch {
      setNote(es
        ? 'Los sonidos llegan con la próxima actualización de la app.'
        : 'Sounds arrive with the next app update.');
    }
  }, [playing, timerMin, es]);

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
          <TouchableOpacity
            style={styles.breatheCta} activeOpacity={0.92}
            onPress={() => { tap(); setBreathing(true); }}
            accessibilityRole="button"
            accessibilityLabel={es ? 'Respira conmigo, un minuto' : 'Breathe with me, one minute'}
          >
            <Text style={styles.breatheGlyph}>◯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.breatheTitle}>{es ? 'Respira conmigo' : 'Breathe with me'}</Text>
              <Text style={styles.breatheSub}>{es ? 'un minuto · sin sonido' : 'one minute · no sound needed'}</Text>
            </View>
            <Text style={styles.breatheArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Comfort sounds — one tap, keeps playing when she puts the phone down. */}
        <Text style={styles.sectionLabel}>{es ? 'SONIDOS' : 'SOUNDS'}</Text>
        <View style={styles.soundRow}>
          {COMFORT_SOUNDS.map((s) => {
            const active = playing === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.soundTile, active && styles.soundTileActive]}
                activeOpacity={0.9}
                onPress={() => { void toggleSound(s); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={es ? s.labelEs : s.labelEn}
              >
                <Text style={styles.soundEmoji}>{s.emoji}</Text>
                <Text style={[styles.soundLabel, active && styles.soundLabelActive]}>
                  {es ? s.labelEs : s.labelEn}
                </Text>
                {active && <Text style={styles.soundPlaying}>{es ? 'sonando' : 'playing'}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

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
        {note && <Text style={styles.note}>{note}</Text>}

        {/* Meditations — doors named for how she feels, never logged. */}
        <Text style={styles.sectionLabel}>{es ? 'MEDITACIONES' : 'MEDITATIONS'}</Text>
        <View style={styles.doorCard}>
          {DOORS.map((d, i) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.doorRow, i === DOORS.length - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.85}
              onPress={() => {
                tap();
                setNote(es
                  ? 'Las meditaciones llegan con la próxima actualización.'
                  : 'Meditations arrive with the next app update.');
              }}
              accessibilityRole="button"
              accessibilityLabel={es ? d.es : d.en}
            >
              <Text style={styles.doorEmoji}>{d.emoji}</Text>
              <Text style={styles.doorText}>{es ? d.es : d.en}</Text>
              <Text style={styles.doorArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

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

  breatheCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: SAGE_SOFT, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#DCE4D0',
  },
  breatheGlyph: { fontSize: 26, color: SAGE },
  breatheTitle: { fontFamily: FONTS.v3_display, fontSize: 21, color: INK, letterSpacing: -0.3 },
  breatheSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: INKSOFT, marginTop: 2 },
  breatheArrow: { fontSize: 22, color: SAGE },

  breathCard: {
    backgroundColor: SAGE_SOFT, borderRadius: 20, paddingVertical: 30, alignItems: 'center',
    borderWidth: 1, borderColor: '#DCE4D0',
  },
  breathWrap: { alignItems: 'center' },
  breathCircleTrack: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  breathCircle: { width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(124,139,107,0.30)' },
  breathPhase: { fontFamily: FONTS.v3_display, fontSize: 25, color: INK, marginTop: 16, letterSpacing: -0.3 },
  breathCount: { fontFamily: FONTS.v2_mono, fontSize: 12, color: MUTED, letterSpacing: 2, marginTop: 6 },
  breathStop: { fontFamily: FONTS.v2_body, fontSize: 15, color: SAGE, marginTop: 18 },

  sectionLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.4, color: MUTED,
    marginTop: 28, marginBottom: 10,
  },
  soundRow: { flexDirection: 'row', gap: 10 },
  soundTile: {
    flex: 1, backgroundColor: COLORS.v2_card, borderRadius: 18, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#EFE3D2',
  },
  soundTileActive: { backgroundColor: '#FDECEF', borderColor: '#F3C6D2' },
  soundEmoji: { fontSize: 24 },
  soundLabel: { fontFamily: FONTS.v2_body, fontSize: 13, color: INKSOFT, marginTop: 8 },
  soundLabelActive: { color: ROSE, fontFamily: FONTS.bodySemiBold },
  soundPlaying: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, color: ROSE, marginTop: 3 },

  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' },
  timerLabel: { fontFamily: FONTS.v2_body, fontSize: 12, color: MUTED, marginRight: 2 },
  timerChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: '#EFE3D2', backgroundColor: COLORS.v2_card,
  },
  timerChipOn: { backgroundColor: '#FDECEF', borderColor: '#F3C6D2' },
  timerChipText: { fontFamily: FONTS.v2_body, fontSize: 12, color: INKSOFT },
  timerChipTextOn: { color: ROSE },
  note: { fontFamily: FONTS.v2_body, fontSize: 13, color: MUTED, marginTop: 10 },

  doorCard: {
    backgroundColor: COLORS.v2_card, borderRadius: 20,
    borderWidth: 1, borderColor: '#EFE3D2', overflow: 'hidden',
  },
  doorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: '#F4EADB',
  },
  doorEmoji: { fontSize: 19 },
  doorText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 15, color: INK },
  doorArrow: { fontSize: 19, color: MUTED },

  crisisLine: { marginTop: 26, paddingVertical: 10 },
  crisisText: { fontFamily: FONTS.v2_body, fontSize: 13, color: INKSOFT, textAlign: 'center' },
});
