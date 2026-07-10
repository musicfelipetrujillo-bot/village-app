// V5 Playbook — "Today" tracker (Phase 1).
//
// Compact-by-default: a Sleep | Feed | Diaper segmented control — tap a pill to
// log that type. Real, timestamped logging underneath:
//   • Sleep   — start/stop; while a nap runs a LIVE timer + wake-window
//               countdown surfaces as its own card (the "don't oversleep" widget)
//               and schedules a local "wake window reached" notification.
//   • Feed    — breast L/R (timed) or bottle (timed + oz); live timer when running.
//   • Diaper  — one-tap wet / dirty / both.
//   • Jot     — free-form text (keyboard dictation = voice); AI parse is Phase 2.
//   • Today   — a merged timeline of everything logged today.
//
// State flows through useTrackerStore. Fails soft if migration 093 isn't applied.
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Keyboard,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import { useTrackerStore } from '@store/babyTracker';
import { wakeWindowMinutes, scheduleWakeAlarm, cancelWakeAlarm } from '@utils/sleepAlarm';
import type { SleepLog, FeedLog, DiaperLog, NoteLog } from '@api/babyTracker';

const C = {
  paper: COLORS.v2_paper, cream: COLORS.v2_cream, parchment: COLORS.v2_parchment, cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon,
  clay: '#C46A45', clayInk: '#FFF9F2', claySub: '#FBE7CF',
  honey: '#BE851F', honeyBg: '#F7E7BE', honeyInk: '#5A4012',
  olive: '#6F7A43', oliveBg: '#E4E7C8', oliveInk: '#3F4516',
};

const ICON = {
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  stop: 'M7 7h10v10H7z',
  play: 'M8 5l11 7-11 7z',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  bottle: 'M9 2h6M10 2v3l-2 3v11a2 2 0 002 2h4a2 2 0 002-2V8l-2-3V2M8 12h8',
  send: 'M5 12l14-7-7 14-2-5-5-2z',
  note: 'M5 4h14v16l-4-3H5z',
} as const;

function Glyph({ d, color, size = 18, sw = 1.9, fill }: { d: string; color: string; size?: number; sw?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill={fill ?? 'none'} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function clockLabel(iso: string, lang: 'en' | 'es'): string {
  const d = new Date(iso);
  const h = d.getHours(); const m = d.getMinutes();
  const mm = m < 10 ? `0${m}` : `${m}`;
  if (lang === 'es') return `${h}:${mm}`;
  const ap = h < 12 ? 'a' : 'p'; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mm}${ap}`;
}
function elapsedLabel(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  const mm = m < 10 ? `0${m}` : `${m}`; const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

type Pane = 'sleep' | 'feed' | 'diaper' | null;

export default function PlaybookTracker({ babyProfileId, babyName, week, lang }: {
  babyProfileId: string | null; babyName: string; week: number; lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  const store = useTrackerStore();
  const { activeSleep, activeFeed, today } = store;

  useEffect(() => { if (babyProfileId) store.refresh(babyProfileId); }, [babyProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeSleep && !activeFeed) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [activeSleep, activeFeed]);
  const nowMs = Date.now();

  const [open, setOpen] = useState<Pane>(null);
  const [ozDraft, setOzDraft] = useState(3);
  const [note, setNote] = useState('');

  const wakeMin = wakeWindowMinutes(week);

  const onStartSleep = async () => { select(); setOpen(null); await store.startSleep(); await scheduleWakeAlarm(wakeMin * 60, babyName); };
  const onStopSleep = async () => { tap(); await cancelWakeAlarm(); await store.stopSleep(); };
  const onStartFeed = (method: 'breast' | 'bottle', side: 'left' | 'right' | null) => { select(); setOzDraft(3); setOpen(null); store.startFeed(method, side); };
  const onStopFeed = () => { tap(); store.stopFeed(activeFeed?.method === 'bottle' ? ozDraft : null); };
  const onDiaper = (kind: 'wet' | 'dirty' | 'both') => { tap(); store.logDiaper(kind); };
  const onSaveNote = () => { if (!note.trim()) return; tap(); store.logNote(note); setNote(''); Keyboard.dismiss(); };

  const togglePane = (p: Exclude<Pane, null>) => { select(); setOpen((o) => (o === p ? null : p)); };

  const sleepElapsed = activeSleep ? Math.floor((nowMs - new Date(activeSleep.started_at).getTime()) / 1000) : 0;
  const wakeRemaining = wakeMin * 60 - sleepElapsed;
  const feedElapsed = activeFeed ? Math.floor((nowMs - new Date(activeFeed.started_at).getTime()) / 1000) : 0;

  const lastFeed = today.feeds.find((f) => f.ended_at) ?? null;
  const lastFeedAgoMin = lastFeed ? Math.round((nowMs - new Date(lastFeed.ended_at!).getTime()) / 60000) : null;
  const diaperCount = today.diapers.length;
  const timeline = buildTimeline(today, es);

  const PILLS: { k: Exclude<Pane, null>; icon: string; label: string; active: boolean }[] = [
    { k: 'sleep', icon: ICON.moon, label: es ? 'Sueño' : 'Sleep', active: !!activeSleep },
    { k: 'feed', icon: ICON.bottle, label: es ? 'Toma' : 'Feed', active: !!activeFeed },
    { k: 'diaper', icon: ICON.droplet, label: es ? 'Pañal' : 'Diaper', active: false },
  ];

  return (
    <View style={{ marginTop: 14 }}>
      {/* Live sleep timer — the "don't oversleep" widget, only while napping. */}
      {activeSleep && (
        <View style={styles.sleepActive}>
          <View style={styles.rowBetween}>
            <Text style={styles.sleepEyebrow}>{es ? 'SUEÑO · EN CURSO' : 'SLEEP · IN PROGRESS'}</Text>
            <Text style={[styles.sleepEyebrow, { letterSpacing: 0 }]}>{es ? 'siesta' : 'nap'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <View style={styles.sleepRing}><Glyph d={ICON.moon} color={C.clayInk} size={22} sw={1.7} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sleepTimer}>{elapsedLabel(sleepElapsed)}</Text>
              <Text style={styles.sleepMeta}>
                {es ? 'inició' : 'started'} {clockLabel(activeSleep.started_at, lang)} ·{' '}
                {wakeRemaining > 0
                  ? <>{es ? 'ventana en' : 'wake window in'} <Text style={{ fontFamily: FONTS.v2_bold, color: C.clayInk }}>{Math.ceil(wakeRemaining / 60)}m</Text></>
                  : <Text style={{ fontFamily: FONTS.v2_bold, color: C.clayInk }}>{es ? 'ventana alcanzada' : 'wake window reached'}</Text>}
              </Text>
            </View>
            <TouchableOpacity onPress={onStopSleep} activeOpacity={0.9} style={styles.sleepStopBtn}>
              <Glyph d={ICON.stop} color="#9A4E28" size={14} fill="#9A4E28" sw={0} />
              <Text style={styles.sleepStopText}>{es ? 'parar' : 'stop'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Live feed timer — only while a feed runs. */}
      {activeFeed && (
        <View style={styles.feedActiveCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.feedActiveLabel}>
              {activeFeed.method === 'bottle' ? (es ? 'Biberón' : 'Bottle') : activeFeed.side === 'left' ? (es ? 'Pecho izq.' : 'Left breast') : (es ? 'Pecho der.' : 'Right breast')}
              {'  '}<Text style={styles.feedActiveTimer}>{elapsedLabel(feedElapsed)}</Text>
            </Text>
            <TouchableOpacity onPress={onStopFeed} activeOpacity={0.9} style={styles.feedStopBtn}>
              <Glyph d={ICON.stop} color="#fff" size={12} fill="#fff" sw={0} />
              <Text style={styles.feedStopText}>{es ? 'parar' : 'stop'}</Text>
            </TouchableOpacity>
          </View>
          {activeFeed.method === 'bottle' && (
            <View style={styles.ozRow}>
              <Text style={styles.ozLabel}>{es ? 'onzas' : 'oz'}</Text>
              <TouchableOpacity onPress={() => setOzDraft((o) => Math.max(0.5, Math.round((o - 0.5) * 2) / 2))} style={styles.ozBtn}><Text style={styles.ozBtnText}>−</Text></TouchableOpacity>
              <Text style={styles.ozValue}>{ozDraft}</Text>
              <TouchableOpacity onPress={() => setOzDraft((o) => Math.min(12, Math.round((o + 0.5) * 2) / 2))} style={styles.ozBtn}><Text style={styles.ozBtnText}>+</Text></TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Compact pill control — Sleep | Feed | Diaper. Tap to log. */}
      <View style={styles.logCard}>
        <Text style={styles.logEyebrow}>{es ? 'REGISTRAR' : 'LOG'}</Text>
        <View style={styles.pillRow}>
          {PILLS.map((p) => {
            const on = open === p.k;
            return (
              <TouchableOpacity key={p.k} onPress={() => togglePane(p.k)} activeOpacity={0.85} style={[styles.pill, on && styles.pillOn]}>
                <Glyph d={p.icon} color={on ? C.cocoa : C.walnut} size={15} sw={1.8} />
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{p.label}</Text>
                {p.active && <View style={styles.pillDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {open === 'sleep' && (
          <View style={styles.panel}>
            {activeSleep ? (
              <Text style={styles.panelHint}>{es ? 'siesta en curso — temporizador arriba ↑' : 'nap running — timer above ↑'}</Text>
            ) : (
              <TouchableOpacity onPress={onStartSleep} activeOpacity={0.9} style={styles.startBtn}>
                <Glyph d={ICON.play} color={C.clayInk} size={14} fill={C.clayInk} sw={0} />
                <Text style={styles.startBtnText}>{es ? 'iniciar sueño' : 'start sleep'}</Text>
                <Text style={styles.startBtnSub}>{es ? `ventana ~${wakeMin}m` : `~${wakeMin}m window`}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {open === 'feed' && (
          <View style={styles.panel}>
            {activeFeed ? (
              <Text style={styles.panelHint}>{es ? 'toma en curso — temporizador arriba ↑' : 'feed running — timer above ↑'}</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  <TouchableOpacity onPress={() => onStartFeed('breast', 'left')} style={styles.feedSideBtn}><Text style={styles.feedSideText}>L</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => onStartFeed('breast', 'right')} style={styles.feedSideBtn}><Text style={styles.feedSideText}>R</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => onStartFeed('bottle', null)} style={styles.feedBottleBtn}>
                    <Glyph d={ICON.bottle} color={C.honeyInk} size={15} sw={1.7} />
                    <Text style={styles.feedBottleText}>{es ? 'biberón' : 'bottle'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.feedTip}>
                  {lastFeed && lastFeedAgoMin != null
                    ? `${es ? 'última' : 'last'}: ${feedShort(lastFeed, es)} · ${lastFeedAgoMin < 60 ? `${lastFeedAgoMin}m` : `${Math.round(lastFeedAgoMin / 60)}h`}${es ? '' : ' ago'}`
                    : (es ? 'toca un lado para iniciar el cronómetro' : 'tap a side to start the timer')}
                </Text>
              </>
            )}
          </View>
        )}

        {open === 'diaper' && (
          <View style={styles.panel}>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {(['wet', 'dirty', 'both'] as const).map((k) => (
                <TouchableOpacity key={k} onPress={() => onDiaper(k)} style={styles.diaperBtn}>
                  <Text style={styles.diaperText}>{es ? { wet: 'pis', dirty: 'caca', both: 'ambos' }[k] : k}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.feedTip}>{diaperCount} {es ? 'hoy' : 'today'}</Text>
          </View>
        )}
      </View>

      {/* Jot — text / dictation */}
      <View style={styles.jotCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={es ? 'apúntalo o díctalo…' : 'jot it down or dictate…'}
            placeholderTextColor="#A98C6F"
            style={styles.jotInput}
            multiline
          />
          <TouchableOpacity onPress={onSaveNote} style={[styles.jotSend, !note.trim() && { opacity: 0.4 }]} disabled={!note.trim()}>
            <Glyph d={ICON.send} color="#fff" size={16} sw={1.8} />
          </TouchableOpacity>
        </View>
        <Text style={styles.jotHint}>{es ? 'usa el micrófono del teclado para hablar' : 'use the keyboard mic to talk — villie sorts it soon'}</Text>
      </View>

      {/* Today timeline */}
      {timeline.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.todayEyebrow}>{es ? 'HOY' : 'TODAY'}</Text>
          <View style={{ marginTop: 6 }}>
            {timeline.slice(0, 8).map((e, i) => (
              <View key={e.id} style={[styles.tlRow, i < Math.min(timeline.length, 8) - 1 && styles.tlDivider]}>
                <Text style={styles.tlTime}>{clockLabel(e.iso, lang)}</Text>
                <View style={[styles.tlIcon, { backgroundColor: e.tint }]}><Glyph d={e.icon} color={e.ink} size={12} sw={1.7} /></View>
                <Text style={styles.tlLabel} numberOfLines={1}>{e.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Timeline builder ────────────────────────────────────────────────────────
type Entry = { id: string; iso: string; label: string; tint: string; ink: string; icon: string };

function feedShort(f: FeedLog, es: boolean): string {
  if (f.method === 'bottle') return `${es ? 'biberón' : 'bottle'}${f.amount_oz ? ` ${f.amount_oz}oz` : ''}`;
  return f.side === 'left' ? (es ? 'izq.' : 'left') : (es ? 'der.' : 'right');
}

function buildTimeline(today: { sleep: SleepLog[]; feeds: FeedLog[]; diapers: DiaperLog[]; notes: NoteLog[] }, es: boolean): Entry[] {
  const out: Entry[] = [];
  for (const s of today.sleep) {
    const mins = s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;
    out.push({
      id: `s${s.id}`, iso: s.started_at, tint: '#F0D7C3', ink: '#9A4E28', icon: ICON.moon,
      label: mins != null ? `${es ? 'Siesta' : 'Nap'} · ${mins} min` : `${es ? 'Siesta — en curso' : 'Nap — in progress'}`,
    });
  }
  for (const f of today.feeds) {
    const mins = f.ended_at ? Math.round((new Date(f.ended_at).getTime() - new Date(f.started_at).getTime()) / 60000) : null;
    const base = f.method === 'bottle'
      ? `${es ? 'Biberón' : 'Bottle'}${f.amount_oz ? ` · ${f.amount_oz} oz` : ''}`
      : `${f.side === 'left' ? (es ? 'Pecho izq.' : 'Left breast') : (es ? 'Pecho der.' : 'Right breast')}${mins != null ? ` · ${mins} min` : (es ? ' — en curso' : ' — in progress')}`;
    out.push({ id: `f${f.id}`, iso: f.started_at, tint: C.honeyBg, ink: C.honeyInk, icon: ICON.bottle, label: base });
  }
  for (const d of today.diapers) {
    out.push({
      id: `d${d.id}`, iso: d.occurred_at, tint: C.oliveBg, ink: C.oliveInk, icon: ICON.droplet,
      label: es ? { wet: 'Pañal mojado', dirty: 'Pañal sucio', both: 'Pañal ambos' }[d.kind] : { wet: 'Wet diaper', dirty: 'Dirty diaper', both: 'Wet + dirty' }[d.kind],
    });
  }
  for (const n of today.notes) {
    out.push({ id: `n${n.id}`, iso: n.occurred_at, tint: '#FBEFD9', ink: C.rose, icon: ICON.note, label: n.raw_text });
  }
  return out.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Live sleep widget
  sleepActive: { backgroundColor: C.clay, borderRadius: 18, padding: 14, overflow: 'hidden', marginBottom: 11 },
  sleepEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 2, color: C.claySub, fontWeight: '700' },
  sleepRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'rgba(255,249,242,0.35)', alignItems: 'center', justifyContent: 'center' },
  sleepTimer: { fontFamily: FONTS.v3_display, fontSize: 26, color: C.clayInk, letterSpacing: -1, lineHeight: 28 },
  sleepMeta: { fontFamily: FONTS.v2_body, fontSize: 10, color: C.claySub, marginTop: 2 },
  sleepStopBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.clayInk, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sleepStopText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#9A4E28' },

  // Live feed widget
  feedActiveCard: { backgroundColor: C.honeyBg, borderRadius: 16, padding: 13, marginBottom: 11 },
  feedActiveLabel: { fontFamily: FONTS.v2_bold, fontSize: 14, color: C.cocoa },
  feedActiveTimer: { fontFamily: FONTS.v3_display, fontSize: 16, color: C.honey },
  feedStopBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.honey, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  feedStopText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#fff' },
  ozRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11 },
  ozLabel: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, color: C.honey, textTransform: 'uppercase' },
  ozBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  ozBtnText: { fontFamily: FONTS.v3_display, fontSize: 17, color: C.honeyInk, marginTop: -2 },
  ozValue: { fontFamily: FONTS.v3_display, fontSize: 19, color: C.cocoa, minWidth: 32, textAlign: 'center' },

  // Compact pill control
  logCard: { backgroundColor: C.paper, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(122,74,40,0.16)' },
  logEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 2, color: C.walnut, marginBottom: 8 },
  pillRow: { flexDirection: 'row', backgroundColor: C.parchment, borderRadius: 12, padding: 3, gap: 2 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  pillOn: {
    backgroundColor: C.paper,
    shadowColor: C.cocoa, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2,
  },
  pillText: { fontFamily: FONTS.v2_bold, fontSize: 13, color: C.walnut },
  pillTextOn: { color: C.cocoa },
  pillDot: { position: 'absolute', top: 6, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: C.rose },

  panel: { marginTop: 12 },
  panelHint: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut, textAlign: 'center', paddingVertical: 6 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.clay, borderRadius: 12, paddingVertical: 13 },
  startBtnText: { fontFamily: FONTS.v3_display, fontSize: 15, color: C.clayInk },
  startBtnSub: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.claySub },

  // Feed buttons
  feedSideBtn: { flex: 1, backgroundColor: C.honeyBg, borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  feedSideText: { fontFamily: FONTS.v3_display, fontSize: 15, color: C.honeyInk },
  feedBottleBtn: { flex: 1.6, backgroundColor: C.paper, borderWidth: 1.5, borderColor: '#E8B83C', borderRadius: 11, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  feedBottleText: { fontFamily: FONTS.v3_display, fontSize: 13, color: '#7A560F' },
  feedTip: { fontFamily: FONTS.v2_body, fontSize: 10, color: C.walnut, marginTop: 8, textAlign: 'center' },

  // Diaper buttons
  diaperBtn: { flex: 1, backgroundColor: C.oliveBg, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  diaperText: { fontFamily: FONTS.v2_bold, fontSize: 12.5, color: C.oliveInk, textTransform: 'capitalize' },

  // Jot
  jotCard: { backgroundColor: '#FBEFD9', borderRadius: 16, padding: 12, marginTop: 11, borderWidth: 1, borderColor: 'rgba(212,150,60,0.3)' },
  jotInput: {
    flex: 1, minHeight: 38, maxHeight: 90, backgroundColor: C.paper, borderRadius: 11,
    borderWidth: 1, borderColor: 'rgba(122,74,40,0.2)', paddingHorizontal: 11, paddingTop: 9, paddingBottom: 9,
    fontFamily: FONTS.v2_body, fontSize: 13, color: C.cocoa,
  },
  jotSend: { width: 40, height: 40, borderRadius: 11, backgroundColor: C.rose, alignItems: 'center', justifyContent: 'center' },
  jotHint: { fontFamily: FONTS.v2_body, fontSize: 9, color: C.honey, marginTop: 7, textAlign: 'center' },

  // Today timeline
  todayEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.8, color: C.walnut },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  tlDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)' },
  tlTime: { fontFamily: FONTS.v2_mono, fontSize: 9.5, color: C.walnut, width: 44 },
  tlIcon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  tlLabel: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12, color: C.cocoa },
});
