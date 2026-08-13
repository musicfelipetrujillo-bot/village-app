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
  View, Text, StyleSheet, TouchableOpacity, TextInput, Keyboard, ActivityIndicator, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import { isRunaway } from '@utils/logEntry';
import { useTrackerStore } from '@store/babyTracker';
import { wakeWindowMinutes, scheduleWakeAlarm, cancelWakeAlarm } from '@utils/sleepAlarm';
import { babyTrackerApi } from '@api/babyTracker';
import type { RecentStats, LogEntry } from '@api/babyTracker';
import LogTimeline, { buildTimeline, clockLabel, feedShort } from '@components/tracker/LogTimeline';
import LogEditSheet from '@components/tracker/LogEditSheet';
import TimeChips from '@components/tracker/TimeChips';

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

function elapsedLabel(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  const mm = m < 10 ? `0${m}` : `${m}`; const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}
// Minutes → compact "1h 20m" / "45m" for the insights chips.
function hm(min: number): string {
  const h = Math.floor(min / 60); const m = Math.round(min % 60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
// "1 feed · 1 diaper" summary of what the AI jot-parse extracted.
function loggedLabel(counts: { sleep: number; feed: number; diaper: number }, es: boolean): string {
  const parts: string[] = [];
  if (counts.feed) parts.push(es ? `${counts.feed} toma${counts.feed > 1 ? 's' : ''}` : `${counts.feed} feed${counts.feed > 1 ? 's' : ''}`);
  if (counts.sleep) parts.push(es ? `${counts.sleep} sueño${counts.sleep > 1 ? 's' : ''}` : `${counts.sleep} sleep`);
  if (counts.diaper) parts.push(es ? `${counts.diaper} pañal${counts.diaper > 1 ? 'es' : ''}` : `${counts.diaper} diaper${counts.diaper > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

type Pane = 'sleep' | 'feed' | 'diaper' | null;

export default function PlaybookTracker({ babyProfileId, babyName, week, lang, initialPane, onNeedBaby, onSeeAll }: {
  babyProfileId: string | null; babyName: string; week: number; lang: 'en' | 'es';
  initialPane?: Pane; onNeedBaby?: () => void; onSeeAll?: () => void;
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

  const [open, setOpen] = useState<Pane>(initialPane ?? null);
  const [ozDraft, setOzDraft] = useState(3);
  const [note, setNote] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [logAt, setLogAt] = useState<string | null>(null);   // null === now
  const resetTime = () => setLogAt(null);
  const [rescueDismissed, setRescueDismissed] = useState(false);

  const wakeMin = wakeWindowMinutes(week);

  // No baby profile yet → every log is a silent no-op in the store. Instead of
  // dead buttons, send the user to set up their baby first.
  // Keep the pane OPEN on start so the L/R (or sleep) control the user just
  // tapped visibly becomes the live "running" row in place — no collapse, no
  // "did anything happen?" (founder 2026-08-10).
  const onStartSleep = async () => {
    if (!babyProfileId) return onNeedBaby?.();
    select();
    await store.startSleep(logAt ?? undefined);
    resetTime();
    await scheduleWakeAlarm(wakeMin * 60, babyName);
  };
  const onStopSleep = async () => { tap(); await cancelWakeAlarm(); await store.stopSleep(); };
  const onStartFeed = (method: 'breast' | 'bottle', side: 'left' | 'right' | null) => {
    if (!babyProfileId) return onNeedBaby?.();
    select(); setOzDraft(3);
    store.startFeed(method, side, logAt ?? undefined);
    resetTime();
  };
  const onStopFeed = () => { tap(); store.stopFeed(activeFeed?.method === 'bottle' ? ozDraft : null); };
  const onDiaper = (kind: 'wet' | 'dirty' | 'both') => {
    if (!babyProfileId) return onNeedBaby?.();
    tap();
    store.logDiaper(kind, logAt ?? undefined);
    resetTime();
  };
  // Finished bottle — no timer. This wires the previously-unreachable logBottle path.
  const onLogFinishedBottle = () => {
    if (!babyProfileId) return onNeedBaby?.();
    tap();
    store.logBottle(ozDraft, logAt ?? undefined);
    resetTime();
  };
  const onSaveNote = async () => {
    if (!note.trim() || parsing) return;
    tap();
    const text = note.trim();
    setNote(''); Keyboard.dismiss(); setParseMsg(null); setParsing(true);
    const res = await store.parseNote(text);
    setParsing(false);
    const n = res ? res.counts.sleep + res.counts.feed + res.counts.diaper : 0;
    setParseMsg(n > 0 ? `${es ? 'villie registró' : 'villie logged'}: ${loggedLabel(res!.counts, es)}` : (es ? 'guardado' : 'saved'));
  };

  const onDiscardSleep = () => {
    Alert.alert(
      es ? '¿Descartar esta siesta?' : 'Discard this nap?',
      es ? 'Se borrará por completo.' : "It'll be deleted entirely.",
      [
        { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: es ? 'Descartar' : 'Discard', style: 'destructive',
          onPress: async () => {
            if (!activeSleep) return;
            await cancelWakeAlarm();
            await store.deleteEntry({ kind: 'sleep', row: activeSleep });
          },
        },
      ],
    );
  };

  const onDiscardFeed = () => {
    Alert.alert(
      es ? '¿Descartar esta toma?' : 'Discard this feed?',
      es ? 'Se borrará por completo.' : "It'll be deleted entirely.",
      [
        { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: es ? 'Descartar' : 'Discard', style: 'destructive',
          onPress: async () => {
            if (!activeFeed) return;
            await store.deleteEntry({ kind: 'feed', row: activeFeed });
          },
        },
      ],
    );
  };

  const togglePane = (p: Exclude<Pane, null>) => { select(); setOpen((o) => (o === p ? null : p)); };

  const sleepElapsed = activeSleep ? Math.floor((nowMs - new Date(activeSleep.started_at).getTime()) / 1000) : 0;
  const wakeRemaining = wakeMin * 60 - sleepElapsed;
  const feedElapsed = activeFeed ? Math.floor((nowMs - new Date(activeFeed.started_at).getTime()) / 1000) : 0;
  // Deliberately generous ceilings (isRunaway) — a real overnight sleep can
  // legitimately run 8h+, so only escalate to the three-way rescue prompt
  // once a session is unambiguously a forgotten timer.
  const sleepRunaway = !!activeSleep && !rescueDismissed && isRunaway('sleep', activeSleep.started_at, nowMs);
  const feedRunaway = !!activeFeed && !rescueDismissed && isRunaway('feed', activeFeed.started_at, nowMs);

  const lastFeed = today.feeds.find((f) => f.ended_at) ?? null;
  const lastFeedAgoMin = lastFeed ? Math.round((nowMs - new Date(lastFeed.ended_at!).getTime()) / 60000) : null;
  const diaperCount = today.diapers.length;
  const timeline = buildTimeline(today, es);

  // Phase 3 — pull recent stats and curate a "what your logs say" card. Refetches
  // whenever today's counts change (a new log shifts the recent averages too).
  const [stats, setStats] = useState<RecentStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    babyTrackerApi.getRecentStats(3).then((s) => { if (!cancelled) setStats(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [today.sleep.length, today.feeds.length, today.diapers.length, activeSleep, activeFeed]);

  const hasInsights = !!stats && (stats.sleepSessions >= 2 || stats.feeds >= 3 || (stats.diapersPerDay ?? 0) > 0);
  // Gentle takeaway: compare the logged wake window to the age-typical one.
  const takeaway: string | null = (() => {
    if (!stats || stats.avgWakeWindowMin == null) return null;
    const d = stats.avgWakeWindowMin - wakeMin;
    if (Math.abs(d) <= 10) return es ? `Justo en el ritmo típico de la semana ${week} (~${wakeMin}m de vigilia).` : `Right on track for week ${week} (~${wakeMin}m awake windows).`;
    if (d > 10) return es ? `Las ventanas de vigilia duran más que el ~${wakeMin}m típico de esta semana — puedes estirar un poco entre siestas.` : `Awake windows are running longer than the ~${wakeMin}m typical this week — you can stretch a bit between naps.`;
    return es ? `Ventanas más cortas que el ~${wakeMin}m típico — atenta a las señales de sueño temprano.` : `Awake windows are shorter than the ~${wakeMin}m typical — watch for sleepy cues early.`;
  })();

  const PILLS: { k: Exclude<Pane, null>; icon: string; label: string; active: boolean; bg: string; bgOn: string; ink: string }[] = [
    { k: 'feed', icon: ICON.bottle, label: es ? 'Toma' : 'Feed', active: !!activeFeed, bg: '#F7E7BE', bgOn: '#EFD497', ink: '#5A4012' },
    { k: 'sleep', icon: ICON.moon, label: es ? 'Sueño' : 'Sleep', active: !!activeSleep, bg: '#F3DFC9', bgOn: '#E7C6A2', ink: '#8A4E28' },
    { k: 'diaper', icon: ICON.droplet, label: es ? 'Pañal' : 'Diaper', active: false, bg: '#E4E7C8', bgOn: '#D2D8AB', ink: '#3F4516' },
  ];

  return (
    <View style={{ marginTop: 14, paddingHorizontal: 16 }}>
      {/* Live sleep timer — the "don't oversleep" widget, only while napping.
          Hidden while the Sleep pane is open (the pane shows the live row). */}
      {activeSleep && open !== 'sleep' && (
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
            {!sleepRunaway && (
              <>
                <TouchableOpacity onPress={() => { select(); setEditing({ kind: 'sleep', row: activeSleep }); }} style={styles.endedAtBtn} accessibilityRole="button" accessibilityLabel={es ? 'Corregir la hora de fin' : 'Correct the end time'}>
                  <Text style={styles.endedAtTxt}>{es ? 'terminó a las…' : 'ended at…'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onStopSleep} activeOpacity={0.9} style={styles.sleepStopBtn}>
                  <Glyph d={ICON.stop} color="#9A4E28" size={14} fill="#9A4E28" sw={0} />
                  <Text style={styles.sleepStopText}>{es ? 'parar' : 'stop'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          {sleepRunaway ? (
            <View style={{ gap: 9, marginTop: 10 }}>
              <Text style={styles.rescueAsk}>
                {es ? '¿Sigue durmiendo, o el cronómetro quedó corriendo?' : 'Still asleep, or did the timer keep running?'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                <TouchableOpacity onPress={() => { select(); setRescueDismissed(true); }} style={styles.rescueBtn} accessibilityRole="button">
                  <Text style={styles.rescueBtnTxt}>{es ? 'sigue durmiendo' : 'still asleep'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { select(); setEditing({ kind: 'sleep', row: activeSleep! }); }} style={styles.rescueBtn} accessibilityRole="button">
                  <Text style={styles.rescueBtnTxt}>{es ? 'terminó a las…' : 'ended at…'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDiscardSleep} style={[styles.rescueBtn, styles.rescueDanger]} accessibilityRole="button">
                  <Text style={[styles.rescueBtnTxt, { color: '#fff' }]}>{es ? 'descartar' : 'discard'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Live feed timer — only while a feed runs. Hidden while the Feed pane is
          open (the pane shows the live row in place of L/R). */}
      {activeFeed && open !== 'feed' && (
        <View style={styles.feedActiveCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.feedActiveLabel}>
              {activeFeed.method === 'bottle' ? (es ? 'Biberón' : 'Bottle') : activeFeed.side === 'left' ? (es ? 'Pecho izq.' : 'Left breast') : (es ? 'Pecho der.' : 'Right breast')}
              {'  '}<Text style={styles.feedActiveTimer}>{elapsedLabel(feedElapsed)}</Text>
            </Text>
            {!feedRunaway && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity onPress={() => { select(); setEditing({ kind: 'feed', row: activeFeed }); }} style={styles.endedAtBtn} accessibilityRole="button" accessibilityLabel={es ? 'Corregir la hora de fin' : 'Correct the end time'}>
                  <Text style={styles.endedAtTxt}>{es ? 'terminó a las…' : 'ended at…'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onStopFeed} activeOpacity={0.9} style={styles.feedStopBtn}>
                  <Glyph d={ICON.stop} color="#fff" size={12} fill="#fff" sw={0} />
                  <Text style={styles.feedStopText}>{es ? 'parar' : 'stop'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {feedRunaway ? (
            <View style={{ gap: 9, marginTop: 10 }}>
              <Text style={styles.rescueAsk}>
                {es ? '¿Sigue comiendo, o el cronómetro quedó corriendo?' : 'Still feeding, or did the timer keep running?'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                <TouchableOpacity onPress={() => { select(); setRescueDismissed(true); }} style={styles.rescueBtn} accessibilityRole="button">
                  <Text style={styles.rescueBtnTxt}>{es ? 'sigue comiendo' : 'still feeding'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { select(); setEditing({ kind: 'feed', row: activeFeed! }); }} style={styles.rescueBtn} accessibilityRole="button">
                  <Text style={styles.rescueBtnTxt}>{es ? 'terminó a las…' : 'ended at…'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDiscardFeed} style={[styles.rescueBtn, styles.rescueDanger]} accessibilityRole="button">
                  <Text style={[styles.rescueBtnTxt, { color: '#fff' }]}>{es ? 'descartar' : 'discard'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
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

      {/* LOG — the hero: three big, colored actions. Tap one to open its
          quick control below. */}
      <View style={styles.bigPillRow}>
        {PILLS.map((p) => {
          const on = open === p.k;
          return (
            <TouchableOpacity
              key={p.k}
              onPress={() => togglePane(p.k)}
              activeOpacity={0.85}
              style={[styles.bigPill, { backgroundColor: on ? p.bgOn : p.bg }, on && { borderColor: p.ink }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
              accessibilityLabel={p.label}
            >
              <Glyph d={p.icon} color={p.ink} size={23} sw={1.8} />
              <Text style={[styles.bigPillText, { color: p.ink }]}>{p.label}</Text>
              {p.active ? <View style={[styles.bigPillDot, { backgroundColor: p.ink }]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {open ? (
        <View style={styles.panelCard}>

        {open === 'sleep' && (
          <View style={styles.panel}>
            {activeSleep ? (
              <View style={styles.runRow}>
                <View style={[styles.runDot, { backgroundColor: C.clayInk }]} />
                <Text style={styles.runLabel}>{es ? 'Siesta en curso' : 'Nap running'}</Text>
                <Text style={styles.runTimer}>{elapsedLabel(sleepElapsed)}</Text>
                <TouchableOpacity onPress={onStopSleep} activeOpacity={0.9} style={styles.sleepStopBtn}>
                  <Glyph d={ICON.stop} color="#9A4E28" size={13} fill="#9A4E28" sw={0} />
                  <Text style={styles.sleepStopText}>{es ? 'parar' : 'stop'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity onPress={onStartSleep} activeOpacity={0.9} style={styles.startBtn}>
                  <Glyph d={ICON.play} color={C.clayInk} size={14} fill={C.clayInk} sw={0} />
                  <Text style={styles.startBtnText}>{es ? 'iniciar sueño' : 'start sleep'}</Text>
                  <Text style={styles.startBtnSub}>{es ? `ventana ~${wakeMin}m` : `~${wakeMin}m window`}</Text>
                </TouchableOpacity>
                <TimeChips valueIso={logAt} onChange={setLogAt} lang={lang} />
              </>
            )}
          </View>
        )}

        {open === 'feed' && (
          <View style={styles.panel}>
            {activeFeed ? (
              <>
                <View style={styles.runRow}>
                  <View style={[styles.runDot, { backgroundColor: '#C24A63' }]} />
                  <Text style={styles.runLabel}>
                    {activeFeed.method === 'bottle' ? (es ? 'Biberón' : 'Bottle') : activeFeed.side === 'left' ? (es ? 'Pecho izq.' : 'Left breast') : (es ? 'Pecho der.' : 'Right breast')}
                  </Text>
                  <Text style={styles.runTimer}>{elapsedLabel(feedElapsed)}</Text>
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
              </>
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
                <TouchableOpacity onPress={onLogFinishedBottle} style={styles.startBtn} accessibilityRole="button" accessibilityLabel={es ? 'Registrar biberón terminado' : 'Log a finished bottle'}>
                  <Text style={styles.startBtnText}>{es ? `biberón terminado · ${ozDraft} oz` : `finished bottle · ${ozDraft} oz`}</Text>
                </TouchableOpacity>
                <TimeChips valueIso={logAt} onChange={setLogAt} lang={lang} />
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
            <TimeChips valueIso={logAt} onChange={setLogAt} lang={lang} />
          </View>
        )}
        </View>
      ) : null}

      {/* Jot — text / dictation */}
      <View style={styles.jotCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            value={note}
            onChangeText={(t) => { setNote(t); if (parseMsg) setParseMsg(null); }}
            placeholder={es ? 'apúntalo o díctalo…' : 'jot it down or dictate…'}
            placeholderTextColor="#A98C6F"
            style={styles.jotInput}
            multiline
            editable={!parsing}
          />
          <TouchableOpacity
            onPress={onSaveNote}
            style={[styles.jotSend, (!note.trim() || parsing) && { opacity: 0.4 }]}
            disabled={!note.trim() || parsing}
            accessibilityRole="button"
            accessibilityLabel={parsing ? (es ? 'Ordenando' : 'Sorting') : (es ? 'Guardar nota' : 'Save note')}
          >
            {parsing ? <ActivityIndicator size="small" color="#fff" /> : <Glyph d={ICON.send} color="#fff" size={16} sw={1.8} />}
          </TouchableOpacity>
        </View>
        <Text style={[styles.jotHint, !!parseMsg && !parsing && { color: C.olive, fontFamily: FONTS.v2_bold }]}>
          {parsing
            ? (es ? 'villie está ordenando…' : 'villie is sorting it…')
            : parseMsg
              ? parseMsg
              : (es ? 'usa el micrófono del teclado — villie lo ordena' : 'use the keyboard mic to talk — villie sorts it')}
        </Text>
      </View>

      {/* Today timeline */}
      {timeline.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.todayEyebrow}>{es ? 'HOY' : 'TODAY'}</Text>
            <TouchableOpacity
              onPress={() => onSeeAll?.()}
              accessibilityRole="button"
              accessibilityLabel={es ? 'Ver todos los registros' : 'See all logs'}
            >
              <Text style={styles.seeAll}>{es ? 'ver todo ›' : 'see all ›'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 6 }}>
            <LogTimeline items={timeline.slice(0, 8)} lang={lang} onPressItem={setEditing} />
          </View>
        </View>
      )}

      {/* "What your logs say" read-back removed from the Log zone (2026-08-10):
          it duplicated the Insights section below and cluttered the logger.
          Insights now lives only in the screen's "Insights" zone. */}

      <LogEditSheet entry={editing} lang={lang} onClose={() => setEditing(null)} />
    </View>
  );
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

  // Runaway-timer rescue prompt (Task 9) — shared by the sleep + feed live
  // cards. Only ever rendered on the dark C.clay / C.honeyBg live-card
  // backgrounds, never standalone.
  rescueAsk: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.claySub, lineHeight: 17 },
  rescueBtn: { flex: 1, backgroundColor: 'rgba(255,249,242,0.2)', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  rescueDanger: { backgroundColor: '#9A4E28' },
  rescueBtnTxt: { fontFamily: FONTS.v2_bold, fontSize: 11, color: C.clayInk },
  endedAtBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  endedAtTxt: { fontFamily: FONTS.v2_link, fontSize: 11.5, color: C.claySub },

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

  // LOG hero — three big colored actions + the quick-control card they open.
  bigPillRow: { flexDirection: 'row', gap: 9 },
  bigPill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 16, gap: 6, borderWidth: 2, borderColor: 'transparent' },
  bigPillText: { fontFamily: FONTS.v2_bold, fontSize: 13.5 },
  bigPillDot: { position: 'absolute', top: 9, right: 11, width: 8, height: 8, borderRadius: 4 },
  panelCard: { marginTop: 10, backgroundColor: C.paper, borderRadius: 14, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)' },

  panel: { marginTop: 0 },
  panelHint: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut, textAlign: 'center', paddingVertical: 6 },
  // Inline "running" row — the L/R (or sleep) control turns into this in place.
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 2 },
  runDot: { width: 8, height: 8, borderRadius: 4 },
  runLabel: { flex: 1, fontFamily: FONTS.v2_bold, fontSize: 13.5, color: C.cocoa },
  runTimer: { fontFamily: FONTS.v2_bold, fontSize: 15, color: C.cocoa, letterSpacing: 0.3 },
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
  seeAll: { fontFamily: FONTS.v2_link, fontSize: 11.5, color: C.rose },

  // Phase 3 — insights card
  insightCard: { backgroundColor: C.oliveBg, borderRadius: 16, padding: 13, marginTop: 16, borderWidth: 1, borderColor: 'rgba(111,122,67,0.28)' },
  insightEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.8, color: C.oliveInk, fontWeight: '700' },
  insightChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  insightChip: { flexGrow: 1, minWidth: 68, backgroundColor: C.paper, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, alignItems: 'center' },
  insightVal: { fontFamily: FONTS.v3_display, fontSize: 16, color: C.cocoa, letterSpacing: -0.4 },
  insightKey: { fontFamily: FONTS.v2_mono, fontSize: 8, letterSpacing: 0.8, color: C.olive, marginTop: 2 },
  insightTakeaway: { fontFamily: FONTS.v2_body, fontSize: 12, lineHeight: 17, color: C.cocoa, marginTop: 11 },
  insightDisc: { fontFamily: FONTS.v2_body, fontSize: 9, color: C.oliveInk, marginTop: 8, opacity: 0.8 },
});
