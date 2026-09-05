// VoiceDictationSheet — the listening moment behind Home's mic button.
//
// One job: capture what she says and hand the text back. It does NOT talk to
// Villie itself — the caller takes the transcript and drops it into the
// existing AIHelpChat pipeline, so there is exactly one place where a question
// gets answered and this sheet can never drift from it.
//
// The design brief is the 3am one-handed moment: one big target, a live
// transcript so she can see it heard her (the single most reassuring thing a
// voice UI can show), and no state she can get stuck in — every failure path
// still offers "type instead".
//
// See lib/voiceDictation.ts for why the native module is loaded dynamically
// and why recognition is on-device only.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Linking, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '@utils/constants';
import {
  dictationErrorMessage, dictationLocale, getSpeechModule, ON_DEVICE_ONLY, type VoiceLang,
} from '@/lib/voiceDictation';

const MIC_PATH = 'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4M9 21h6';

type Phase = 'starting' | 'listening' | 'error';

interface Props {
  visible: boolean;
  lang: VoiceLang;
  /** Fired with the trimmed transcript once she stops talking. */
  onTranscript: (text: string) => void;
  /** Dismissed with nothing to send — she cancelled or backed out. */
  onCancel: () => void;
  /** "Type instead" — drop her into the text composer with no transcript. */
  onTypeInstead: () => void;
}

export default function VoiceDictationSheet({ visible, lang, onTranscript, onCancel, onTypeInstead }: Props) {
  const es = lang === 'es';
  const [phase, setPhase] = useState<Phase>('starting');
  const [transcript, setTranscript] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // The `end` event fires after `result`, so the handler needs the freshest
  // transcript — React state would still be the previous render's value.
  const transcriptRef = useRef('');
  const finishedRef = useRef(false);
  const subsRef = useRef<{ remove: () => void }[]>([]);

  // The callbacks arrive as inline arrows from Home, so their identity changes
  // on every parent render. Held in a ref they stay OUT of the start/stop
  // effect's dependencies — otherwise an unrelated Home re-render (a store
  // update, the Buzz fetch landing) would tear down and restart the recognizer
  // in the middle of her sentence.
  const cbRef = useRef({ onTranscript, onCancel, onTypeInstead });
  cbRef.current = { onTranscript, onCancel, onTypeInstead };

  const pulse = useRef(new Animated.Value(0)).current;   // slow idle breath
  const level = useRef(new Animated.Value(0)).current;   // her actual volume

  const teardown = useCallback(() => {
    subsRef.current.forEach((s) => { try { s.remove(); } catch { /* already gone */ } });
    subsRef.current = [];
    getSpeechModule()
      .then((Speech) => { try { Speech.abort(); } catch { /* nothing running */ } })
      .catch(() => { /* module absent — nothing to stop */ });
  }, []);

  const finish = useCallback((text: string) => {
    if (finishedRef.current) return;
    const clean = text.trim();
    // A "successful" empty result is the same dead end as hearing nothing —
    // treat it that way instead of sending an empty question to Villie.
    if (!clean) { setErrorCode('no-speech'); setPhase('error'); return; }
    finishedRef.current = true;
    teardown();
    cbRef.current.onTranscript(clean);
  }, [teardown]);

  const fail = useCallback((code: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    teardown();
    setErrorCode(code);
    setPhase('error');
  }, [teardown]);

  const begin = useCallback(async () => {
    finishedRef.current = false;
    transcriptRef.current = '';
    setTranscript('');
    setErrorCode(null);
    setPhase('starting');

    let Speech: any;
    try {
      Speech = await getSpeechModule();
    } catch {
      // The caller checks availability before opening us, so this is only
      // reachable in a race. Fail to the honest message rather than hanging.
      fail('unknown');
      return;
    }

    try {
      let perm = await Speech.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await Speech.requestPermissionsAsync();
      if (!perm.granted) { fail('not-allowed'); return; }
    } catch {
      fail('not-allowed');
      return;
    }

    // Listeners go on BEFORE start() so a fast recognizer can't beat us to it.
    try {
      subsRef.current = [
        Speech.addListener('result', (ev: any) => {
          const text = ev?.results?.[0]?.transcript ?? '';
          transcriptRef.current = text;
          setTranscript(text);
          if (ev?.isFinal) finish(text);
        }),
        Speech.addListener('error', (ev: any) => fail(ev?.error ?? 'unknown')),
        // `end` covers the silence auto-stop: iOS delivers the final result
        // first, so by here transcriptRef either has her words or she said
        // nothing at all.
        Speech.addListener('end', () => {
          if (finishedRef.current) return;
          if (transcriptRef.current.trim()) finish(transcriptRef.current);
          else fail('no-speech');
        }),
        Speech.addListener('volumechange', (ev: any) => {
          const raw = typeof ev?.value === 'number' ? ev.value : 0;
          const norm = Math.max(0, Math.min(1, (raw + 2) / 12));
          Animated.timing(level, { toValue: norm, duration: 110, useNativeDriver: true }).start();
        }),
      ];

      Speech.start({
        lang: dictationLocale(lang),
        interimResults: true,      // the live transcript — "it heard me"
        continuous: false,         // auto-stops on her pause; this is dictation, not a call
        maxAlternatives: 1,
        addsPunctuation: true,
        requiresOnDeviceRecognition: ON_DEVICE_ONLY,
      });
      setPhase('listening');
    } catch {
      fail('unknown');
    }
  }, [fail, finish, lang, level]);

  useEffect(() => {
    if (!visible) return;
    begin();
    return () => { finishedRef.current = true; teardown(); };
  }, [visible, begin, teardown]);

  // Idle breath, so a silent mic still looks alive while she works up to talking.
  useEffect(() => {
    if (!visible || phase !== 'listening') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 950, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 950, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, phase, pulse]);

  const done = useCallback(async () => {
    try {
      const Speech = await getSpeechModule();
      Speech.stop();   // asks for the final result; `result`/`end` finish us
    } catch {
      if (transcriptRef.current.trim()) finish(transcriptRef.current);
      else fail('unknown');
    }
  }, [finish, fail]);

  const cancel = useCallback(() => {
    finishedRef.current = true;
    teardown();
    cbRef.current.onCancel();
  }, [teardown]);

  const typeInstead = useCallback(() => {
    finishedRef.current = true;
    teardown();
    cbRef.current.onTypeInstead();
  }, [teardown]);

  const orbScale = Animated.add(
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
    level.interpolate({ inputRange: [0, 1], outputRange: [0, 0.26] }),
  );
  const haloOpacity = level.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] });

  const hint = phase === 'starting'
    ? (es ? 'un momento…' : 'one moment…')
    : (es ? 'te escucho — habla' : "i'm listening — go ahead");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={cancel} accessibilityRole="button" accessibilityLabel={es ? 'Cerrar' : 'Close'}>
        {/* Inner press swallows taps so she can't dismiss by touching the card. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.grabber} />

          {phase === 'error' ? (
            <View style={styles.body}>
              <Text style={styles.errorTitle}>{es ? 'No salió' : "That didn't work"}</Text>
              <Text style={styles.errorBody}>{dictationErrorMessage(errorCode, lang)}</Text>

              <View style={styles.errorActions}>
                {(errorCode === 'not-allowed' || errorCode === 'service-not-allowed') ? (
                  <TouchableOpacity
                    style={styles.primaryBtn} activeOpacity={0.85}
                    onPress={() => { Linking.openSettings().catch(() => {}); }}
                    accessibilityRole="button" accessibilityLabel={es ? 'Abrir Ajustes' : 'Open Settings'}
                  >
                    <Text style={styles.primaryBtnText}>{es ? 'Abrir Ajustes' : 'Open Settings'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.primaryBtn} activeOpacity={0.85} onPress={begin}
                    accessibilityRole="button" accessibilityLabel={es ? 'Intentar de nuevo' : 'Try again'}
                  >
                    <Text style={styles.primaryBtnText}>{es ? 'Intentar de nuevo' : 'Try again'}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.ghostBtn} activeOpacity={0.7} onPress={typeInstead}
                  accessibilityRole="button" accessibilityLabel={es ? 'Escribir en su lugar' : 'Type instead'}
                >
                  <Text style={styles.ghostBtnText}>{es ? 'Escribir en su lugar' : 'Type instead'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.body}>
              <View style={styles.orbWrap}>
                <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: orbScale }] }]} />
                <Animated.View style={{ transform: [{ scale: orbScale }] }}>
                  <LinearGradient
                    colors={['#E14A32', '#EE9A38']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.orb}
                  >
                    <Svg width={34} height={34} viewBox="0 0 24 24">
                      <Path d={MIC_PATH} stroke="#fff" strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </LinearGradient>
                </Animated.View>
              </View>

              <Text style={styles.hint} accessibilityLiveRegion="polite">{hint}</Text>

              <Text
                style={[styles.transcript, !transcript && styles.transcriptEmpty]}
                numberOfLines={4}
                accessibilityLiveRegion="polite"
              >
                {transcript || (es
                  ? '“¿por qué se despierta cada 40 minutos?”'
                  : '“why is she waking every 40 minutes?”')}
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, phase !== 'listening' && styles.primaryBtnDisabled]}
                activeOpacity={0.85}
                onPress={done}
                disabled={phase !== 'listening'}
                accessibilityRole="button"
                accessibilityState={{ disabled: phase !== 'listening' }}
                accessibilityLabel={es ? 'Terminé de hablar, enviar a villie' : "I'm done talking, send to villie"}
              >
                <Text style={styles.primaryBtnText}>{es ? 'Listo' : 'Done'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ghostBtn} activeOpacity={0.7} onPress={cancel}
                accessibilityRole="button" accessibilityLabel={es ? 'Cancelar' : 'Cancel'}
              >
                <Text style={styles.ghostBtnText}>{es ? 'Cancelar' : 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(43,38,15,0.42)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#FBF4E6',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 26, paddingTop: 8, paddingBottom: 40,
    shadowColor: '#7A4A24', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#EBDCC2', alignSelf: 'center', marginBottom: 22 },
  body: { alignItems: 'center' },

  orbWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 116, height: 116, borderRadius: 58, backgroundColor: '#E14A32' },
  orb: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E14A32', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
  },

  hint: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase',
    color: '#A85278', marginTop: 14,
  },
  transcript: {
    fontFamily: FONTS.v2_body, fontSize: 17, lineHeight: 25, color: '#43260F',
    textAlign: 'center', marginTop: 16, minHeight: 75,
  },
  transcriptEmpty: { color: '#B79B76' },

  primaryBtn: {
    marginTop: 20, backgroundColor: '#E14A32', borderRadius: 16,
    paddingHorizontal: 44, paddingVertical: 15, alignSelf: 'stretch', alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: '#FFF3E4', letterSpacing: 0.3 },

  ghostBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 18 },
  ghostBtnText: { fontFamily: FONTS.v2_body, fontSize: 14, color: '#A87A54' },

  errorTitle: { fontFamily: FONTS.v2_display, fontSize: 21, color: '#43260F', marginTop: 8 },
  errorBody: {
    fontFamily: FONTS.v2_body, fontSize: 14.5, lineHeight: 21, color: '#7A4A24',
    textAlign: 'center', marginTop: 10, paddingHorizontal: 6,
  },
  errorActions: { alignSelf: 'stretch', alignItems: 'center', marginTop: 6 },
});
