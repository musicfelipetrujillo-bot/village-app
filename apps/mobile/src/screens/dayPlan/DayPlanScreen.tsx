// DayPlanScreen — the "your day" planner. Three states in one screen:
//   1. connect  → read-only calendar permission (value prop + Connect)
//   2. rhythm   → ask the mom her pump cadence (she picks; villie never assumes)
//   3. plan     → the timeline: her calendar woven with villie's baby slots
// Baby rhythm comes from her Playbook week; the plan is a suggestion, editable
// by re-picking the rhythm.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import { BackButton } from '@components/shared/BackButton';
import { useHomeStore } from '@store/home';
import { getCalendarPermission, requestCalendarAccess, getTodayBusyBlocks, syncPlanToCalendar } from '@utils/calendar';
import { babyTrackerApi } from '@api/babyTracker';
import {
  getPumpCadence, setPumpCadence, buildDayPlan, fmtTime,
  PUMP_CADENCE_OPTIONS, type PumpCadence, type DayPlan, type PlanSlot,
} from '@utils/dayPlan';
import { getOverrides, applyOverride, type SlotOverride } from '@utils/dayPlanOverrides';

const ROSE = COLORS.v2_cinnamon, INK = '#43260F', INKSOFT = '#7A5A3A', HONEY = '#B98A1E';
const GRAD: [string, string] = ['#E14A32', '#F2C75E'];

// Cross-vertical "plan something" prompts — hand off to ask-villie, which now
// has free/busy + find_specialists + find_events, so it reconciles the ask with
// her open windows. Each carries its own accent (rose / honey / caramel) so the
// chips read as distinct, premium objects rather than a flat stacked list.
// Display text is deliberately two or three words per row. The section had an
// eyebrow, a title, a sentence of explanation AND a subtitle per chip — four
// layers of copy to say "tap this and villie finds you a slot". The seeds below
// are the long version, and they're the part the assistant actually reads.
type PlanPrompt = {
  emoji: string; label: string; seed: string;
  tile: [string, string]; arrow: string; border: string;
};
const PLAN_PROMPTS: PlanPrompt[] = [
  {
    emoji: '🩺', label: 'a specialist',
    seed: 'Help me find time this week to see a specialist near me that fits my schedule — suggest a day and time I\'m free.',
    tile: ['#FBD9E1', '#F7C0CE'], arrow: '#C24A63', border: '#F4DBDF',
  },
  {
    emoji: '🧘‍♀️', label: 'a class',
    seed: 'Find me a postpartum-friendly class near me that fits into my schedule this week.',
    tile: ['#FCEBBE', '#F6D876'], arrow: '#CE9A16', border: '#F0E3BF',
  },
  {
    emoji: '💪', label: 'a workout',
    seed: 'When this week could I fit a short postpartum-friendly workout near me?',
    tile: ['#FBDCCB', '#F2B79E'], arrow: '#DA7A56', border: '#F1DDCF',
  },
];

export default function DayPlanScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const baby = useHomeStore((s) => s.babyProfile);
  const babyName = baby?.baby_name ?? 'baby';
  const week = baby?.current_week_number ?? 8;

  const [perm, setPerm] = useState<'loading' | 'granted' | 'denied' | 'undetermined'>('loading');
  const [cadence, setCadence] = useState<PumpCadence | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [building, setBuilding] = useState(false);
  // The calendar is an ENHANCEMENT, not a prerequisite: the plan is her baby's
  // rhythm plus her pumps, and the calendar only adds the meetings to weave
  // around. Declining used to leave her on an "Open Settings" wall with no way
  // through — the whole feature was unreachable for anyone who said no once.
  const [skipCal, setSkipCal] = useState(false);
  const connected = perm === 'granted';

  const rebuild = useCallback(async (c: PumpCadence) => {
    setBuilding(true);
    try {
      const [busy, stats, overrides] = await Promise.all([
        getTodayBusyBlocks(),
        babyTrackerApi.getRecentStats(14).catch(() => null),
        getOverrides().catch(() => ({})),
      ]);
      // Personalize nap length + wake window from the baby's real logged sleep
      // (needs a few sessions to be stable); otherwise fall back to age defaults.
      const rhythm = stats && stats.sleepSessions >= 3
        ? { wakeMin: stats.avgWakeWindowMin, napMin: stats.avgNapMin }
        : undefined;
      setPlan(buildDayPlan({ busy, weekNumber: week, cadence: c, babyName, rhythm, overrides }));
    } catch {
      // Never leave her on a spinner. An empty-calendar plan is still her
      // baby's day, which is most of the value.
      setPlan(buildDayPlan({ busy: [], weekNumber: week, cadence: c, babyName }));
    } finally {
      // In `finally` on purpose: a throw between setBuilding(true) and the end
      // used to strand PlanView on its ActivityIndicator forever.
      setBuilding(false);
    }
  }, [week, babyName]);

  const load = useCallback(async () => {
    try {
      const p = await getCalendarPermission();
      setPerm(p);
      const c = await getPumpCadence();
      setCadence(c);
      if (c && p === 'granted') rebuild(c);
    } catch {
      setPerm('undetermined');
    }
  }, [rebuild]);

  useEffect(() => { load(); }, [load]);

  // She may grant access in Settings and come back. Without this the screen
  // still shows the denied wall until she leaves and re-enters.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && perm !== 'granted') load();
    });
    return () => sub.remove();
  }, [perm, load]);

  const connect = async () => {
    tap();
    const ok = await requestCalendarAccess();
    setPerm(ok ? 'granted' : 'denied');
    if (ok) {
      const c = await getPumpCadence();
      setCadence(c);
      if (c) rebuild(c);
    }
  };

  const skipCalendar = () => {
    tap();
    setSkipCal(true);
    if (cadence) rebuild(cadence);
  };

  const pickCadence = async (c: PumpCadence) => {
    select();
    await setPumpCadence(c);
    setCadence(c);
    rebuild(c);
  };

  // Push villie's own slots into her calendar so the plan survives leaving the
  // app. Re-tapping replaces the day rather than stacking duplicates.
  const [syncing, setSyncing] = useState(false);
  const syncToCalendar = useCallback(async () => {
    if (!plan || syncing) return;
    setSyncing(true);
    try {
      const res = await syncPlanToCalendar(plan.slots);
      if (res.ok) {
        Alert.alert(
          res.replaced > 0 ? 'Calendar updated' : 'Added to your calendar',
          `${res.written} ${res.written === 1 ? 'block' : 'blocks'} in your villie calendar. Hide or delete it any time from your calendar app.`,
        );
      } else if (res.reason === 'nothing_to_sync') {
        Alert.alert('Nothing to add yet', 'Your plan has no villie blocks today.');
      } else if (res.reason === 'permission') {
        Alert.alert('Calendar access needed', 'Turn on calendar access to add your plan.');
      } else {
        Alert.alert("Couldn't add it", 'Your calendar app turned that down. Try again in a moment.');
      }
    } finally {
      setSyncing(false);
    }
  }, [plan, syncing]);

  const openVillie = (seed: string) => {
    tap();
    nav.getParent()?.getParent()?.navigate('AIHelpChat', { seed, autosend: true });
  };

  // Per-block edit on a villie-suggested slot → persist + rebuild.
  const editSlot = useCallback(async (slotId: string, patch: SlotOverride) => {
    select();
    await applyOverride(slotId, patch);
    if (cadence) rebuild(cadence);
  }, [cadence, rebuild]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <BackButton color={ROSE} />
        <View style={s.dot} />
        <Text style={s.hTitle}>your day</Text>
      </View>

      {perm === 'loading' ? (
        <View style={s.center}><ActivityIndicator color={ROSE} /></View>
      ) : !connected && !skipCal ? (
        <ConnectView denied={perm === 'denied'} onConnect={connect} onSkip={skipCalendar} />
      ) : !cadence ? (
        <RhythmView babyName={babyName} onPick={pickCadence} />
      ) : (
        <PlanView onSync={syncToCalendar} syncing={syncing} plan={plan} building={building} babyName={babyName} onChangeRhythm={() => setCadence(null)} onPlan={openVillie} onEdit={editSlot} insetsBottom={insets.bottom} connected={connected} onConnect={connect} />
      )}
    </View>
  );
}

function ConnectView({ denied, onConnect, onSkip }: { denied: boolean; onConnect: () => void; onSkip: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.connectWrap}>
      <View style={s.connectIcon}><Text style={{ fontSize: 34 }}>🗓️</Text></View>
      <Text style={s.connectTitle}>plan your day around <Text style={s.italic}>real life</Text></Text>
      <Text style={s.connectSub}>connect your calendar and villie weaves naps, feeds, and pumping around your meetings.</Text>
      <Text style={s.connectProviders}>works with the Google, Outlook, and Apple calendars synced to your phone.</Text>
      <View style={s.privacyCard}>
        <View style={s.privacyRow}><Text style={s.privacyIcon}>🔒</Text><Text style={s.privacyText}><Text style={s.bold}>read-only.</Text> villie sees when you're busy — never what your meetings are about.</Text></View>
        <View style={s.privacyRow}><Text style={[s.privacyIcon, { color: HONEY }]}>✦</Text><Text style={s.privacyText}>nothing leaves your phone except free/busy times.</Text></View>
      </View>
      {denied ? (
        <>
          <TouchableOpacity style={s.cta} onPress={() => Linking.openSettings()} accessibilityRole="button">
            <Text style={s.ctaText}>Open Settings</Text>
          </TouchableOpacity>
          <Text style={s.deniedNote}>calendar access is off. turn it on in {Platform.OS === 'ios' ? 'Settings → villie → Calendars' : 'Settings → Apps → villie'}.</Text>
        </>
      ) : (
        <TouchableOpacity style={s.cta} onPress={onConnect} accessibilityRole="button" accessibilityLabel="Connect calendar">
          <Text style={s.ctaText}>Connect calendar</Text>
        </TouchableOpacity>
      )}

      {/* The way through for anyone who doesn't want to hand over a calendar —
          she still gets the naps, feeds, and pumps. */}
      <TouchableOpacity style={s.skip} onPress={onSkip} accessibilityRole="button" accessibilityLabel="Plan without my calendar">
        <Text style={s.skipText}>plan without my calendar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function RhythmView({ babyName, onPick }: { babyName: string; onPick: (c: PumpCadence) => void }) {
  return (
    <ScrollView contentContainerStyle={s.rhythmWrap}>
      <Text style={s.rhythmTitle}>how often are you <Text style={s.italic}>pumping?</Text></Text>
      <Text style={s.rhythmSub}>villie plans around what you pick — not a guess.</Text>
      {PUMP_CADENCE_OPTIONS.map((o) => (
        <TouchableOpacity key={o.key} style={s.opt} activeOpacity={0.85} onPress={() => onPick(o.key)} accessibilityRole="button">
          <Text style={s.optText}>{o.label}</Text>
          <Text style={s.optArrow}>›</Text>
        </TouchableOpacity>
      ))}
      <Text style={s.rhythmFoot}>{babyName}'s nap rhythm comes from your Playbook — no setup needed. villie suggests; you can change this anytime.</Text>
    </ScrollView>
  );
}

const KIND_STYLE: Record<PlanSlot['kind'], { bg: string; border: string; mark?: string; markColor?: string }> = {
  calendar: { bg: '#EFE7DA', border: '#E4D8C4' },
  nap: { bg: '#FDECEF', border: '#F3C6D2', mark: '✦ VILLIE', markColor: '#9E2F4C' },
  feed: { bg: '#FDECEF', border: '#F3C6D2', mark: '✦ VILLIE', markColor: '#9E2F4C' },
  pump: { bg: '#FBF0D5', border: '#EFD9A0', mark: '✦ VILLIE', markColor: HONEY },
};

function PlanView({ plan, building, babyName, onChangeRhythm, onPlan, onEdit, insetsBottom, onSync, syncing, connected, onConnect }: {
  plan: DayPlan | null; building: boolean; babyName: string; onChangeRhythm: () => void; onPlan: (seed: string) => void; onEdit: (slotId: string, patch: SlotOverride) => void; insetsBottom: number; onSync: () => void; syncing: boolean; connected: boolean; onConnect: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  if (building || !plan) return <View style={s.center}><ActivityIndicator color={ROSE} /></View>;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insetsBottom + 28 }} showsVerticalScrollIndicator={false}>
      {plan.allDay.map((a) => (
        <View key={a.id} style={s.allDay}>
          <Text style={s.allDayMark}>ALL DAY</Text>
          <Text style={s.allDayTitle} numberOfLines={1}>{a.title}</Text>
        </View>
      ))}
      {plan.nudges.map((n) => (
        <LinearGradient key={n.id} colors={['#FDECEF', '#FBE7D6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.nudge}>
          <View style={s.nudgeDot}><Text style={s.nudgeSpark}>✦</Text></View>
          <Text style={s.nudgeText}>{n.text}</Text>
        </LinearGradient>
      ))}

      <View style={s.timeline}>
        {plan.slots.map((slot) => {
          const k = KIND_STYLE[slot.kind];
          const editable = slot.source === 'villie';
          const isEditing = editingId === slot.id;
          return (
            <View key={slot.id}>
              <View style={s.tr}>
                <Text style={s.tm}>{fmtTime(slot.start)}</Text>
                <TouchableOpacity
                  activeOpacity={editable ? 0.7 : 1}
                  disabled={!editable}
                  onPress={() => setEditingId(isEditing ? null : slot.id)}
                  style={[s.blk, { backgroundColor: k.bg, borderColor: k.border }]}
                  accessibilityRole={editable ? 'button' : undefined}
                  accessibilityLabel={editable ? `Adjust ${slot.title}` : undefined}
                >
                  {!!k.mark && <Text style={[s.vmark, { color: k.markColor }]}>{k.mark}</Text>}
                  <Text style={s.ttl}>{slot.title}</Text>
                  {!!slot.note && <Text style={s.mt}>{slot.note}</Text>}
                  {editable && <Text style={s.editHint}>{isEditing ? 'tap to close' : 'tap to adjust'}</Text>}
                </TouchableOpacity>
              </View>
              {isEditing && (
                <View style={s.editRow}>
                  <TouchableOpacity style={s.editBtn} onPress={() => { setEditingId(null); onEdit(slot.id, { shiftMin: -15 }); }} accessibilityRole="button" accessibilityLabel="15 minutes earlier"><Text style={s.editBtnText}>−15 min</Text></TouchableOpacity>
                  <TouchableOpacity style={s.editBtn} onPress={() => { setEditingId(null); onEdit(slot.id, { shiftMin: 15 }); }} accessibilityRole="button" accessibilityLabel="15 minutes later"><Text style={s.editBtnText}>+15 min</Text></TouchableOpacity>
                  <TouchableOpacity style={[s.editBtn, s.editDismiss]} onPress={() => { setEditingId(null); onEdit(slot.id, { dismissed: true }); }} accessibilityRole="button" accessibilityLabel="Dismiss for today"><Text style={[s.editBtnText, s.editDismissText]}>dismiss</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {!plan.slots.length && <Text style={s.emptyNote}>No calendar events today — here's {babyName}'s rhythm. Add events and villie will weave around them.</Text>}
      </View>

      {connected ? (
        <View style={s.legend}>
          <View style={s.legendItem}><View style={[s.legendSw, { backgroundColor: '#EFE7DA', borderColor: '#E4D8C4' }]} /><Text style={s.legendText}>your calendar</Text></View>
          <View style={s.legendItem}><View style={[s.legendSw, { backgroundColor: '#FDECEF', borderColor: '#F3C6D2' }]} /><Text style={s.legendText}>villie suggests</Text></View>
        </View>
      ) : (
        <TouchableOpacity style={s.connectNudge} onPress={onConnect} accessibilityRole="button" accessibilityLabel="Connect calendar">
          <Text style={s.connectNudgeText}>this is {babyName}'s rhythm only — connect your calendar to weave it around your day ›</Text>
        </TouchableOpacity>
      )}

      <View style={s.planSection}>
        <LinearGradient
          colors={['#FFF7E4', '#FFFCF6', '#FDF0F3']}
          start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.planAccentBar} />

        <View style={s.planHead}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.planBee}>
            <Text style={s.planBeeEmoji}>🐝</Text>
          </LinearGradient>
          <Text style={s.planSectionTitle}>villie finds the time</Text>
        </View>

        {PLAN_PROMPTS.map((p) => (
          <TouchableOpacity key={p.label} style={[s.planChip, { borderColor: p.border, shadowColor: p.arrow }]} activeOpacity={0.85} onPress={() => onPlan(p.seed)} accessibilityRole="button" accessibilityLabel={`Find time for ${p.label}`}>
            <LinearGradient colors={p.tile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.planChipTile}>
              <Text style={s.planChipEmoji}>{p.emoji}</Text>
            </LinearGradient>
            <Text style={s.planChipText}>{p.label}</Text>
            <View style={[s.planChipArrow, { backgroundColor: p.arrow, shadowColor: p.arrow }]}>
              <Text style={s.planChipArrowGlyph}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={s.syncCal}
        onPress={onSync}
        disabled={syncing}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ busy: syncing }}
        accessibilityLabel={syncing ? 'Adding plan to calendar' : 'Add this plan to my calendar'}
      >
        {syncing
          ? <ActivityIndicator color={ROSE} size="small" />
          : <Text style={s.syncCalText}>add this plan to my calendar</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.changeRhythm} onPress={onChangeRhythm} accessibilityRole="button">
        <Text style={s.changeRhythmText}>change my pumping rhythm</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.v2_cream },
  syncCal: {
    marginHorizontal: 18, marginTop: 18, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1, borderColor: '#F0D7DD',
    backgroundColor: '#FEFAF6', alignItems: 'center', justifyContent: 'center',
    minHeight: 48,
  },
  syncCalText: { fontFamily: FONTS.v2_body, fontSize: 14, color: ROSE, letterSpacing: 0.1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.genz_honey },
  hTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  italic: { fontFamily: FONTS.v2_display_italic, fontStyle: 'italic', color: ROSE },
  bold: { fontFamily: FONTS.bodyBold },

  // connect
  connectWrap: { paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  connectIcon: { width: 74, height: 74, borderRadius: 22, marginBottom: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBE1DE' },
  connectTitle: { fontFamily: FONTS.v2_display, fontSize: 26, lineHeight: 30, color: INK, textAlign: 'center' },
  connectSub: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: INKSOFT, textAlign: 'center', lineHeight: 20, marginTop: 10 },
  connectProviders: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: '#A0895F', textAlign: 'center', lineHeight: 16, marginTop: 8 },
  privacyCard: { backgroundColor: COLORS.v2_paper, borderWidth: 1, borderColor: '#EFE4D2', borderRadius: 16, padding: 14, marginTop: 20, width: '100%' },
  privacyRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 9 },
  privacyIcon: { fontSize: 14, color: '#3B7D52' },
  privacyText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12.5, color: '#5c3b2a', lineHeight: 18 },
  cta: { backgroundColor: ROSE, borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%', marginTop: 22 },
  ctaText: { fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#fff' },
  deniedNote: { fontFamily: FONTS.v2_body, fontSize: 12, color: INKSOFT, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  skip: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'center' },
  skipText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: ROSE },
  connectNudge: {
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: '#F0D7DD', backgroundColor: '#FEFAF6',
  },
  connectNudgeText: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: INKSOFT, lineHeight: 18 },

  // rhythm
  rhythmWrap: { paddingHorizontal: 20, paddingTop: 14 },
  rhythmTitle: { fontFamily: FONTS.v2_display, fontSize: 24, color: INK },
  rhythmSub: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: INKSOFT, marginTop: 5, marginBottom: 16 },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#EAD8BE', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 9 },
  optText: { fontFamily: FONTS.bodySemiBold, fontSize: 14.5, color: INK },
  optArrow: { fontFamily: FONTS.v2_bold, fontSize: 18, color: '#C9B7A2' },
  rhythmFoot: { fontFamily: FONTS.v2_body, fontSize: 12, color: INKSOFT, lineHeight: 18, marginTop: 10 },

  // plan
  allDay: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, backgroundColor: '#EFE7DA', borderWidth: 1, borderColor: '#E4D8C4', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 13 },
  allDayMark: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1, color: '#8A6A55' },
  allDayTitle: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: 13, color: INK },
  nudge: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 13 },
  nudgeDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.55)' },
  nudgeSpark: { fontSize: 16, color: ROSE },
  nudgeText: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 13, color: INK, lineHeight: 18 },
  timeline: { paddingHorizontal: 16, paddingTop: 10 },
  tr: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  tm: { width: 52, textAlign: 'right', fontFamily: FONTS.v2_mono, fontSize: 10.5, color: INKSOFT, paddingTop: 12 },
  blk: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 12, marginVertical: 3 },
  vmark: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1, marginBottom: 2 },
  ttl: { fontFamily: FONTS.bodyBold, fontSize: 13.5, color: INK },
  mt: { fontFamily: FONTS.v2_body, fontSize: 11, color: INKSOFT, marginTop: 1 },
  editHint: { fontFamily: FONTS.v2_mono, fontSize: 8.5, color: '#B39B72', marginTop: 4, letterSpacing: 0.5 },
  editRow: { flexDirection: 'row', gap: 8, marginLeft: 63, marginTop: 1, marginBottom: 6 },
  editBtn: { backgroundColor: '#FFFDFA', borderWidth: 1, borderColor: '#EAD8BE', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  editBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: INK },
  editDismiss: { borderColor: '#E9C7C0' },
  editDismissText: { color: '#9E2F4C' },
  emptyNote: { fontFamily: FONTS.v2_body, fontSize: 13, color: INKSOFT, lineHeight: 19, paddingVertical: 20 },
  legend: { flexDirection: 'row', gap: 18, justifyContent: 'center', paddingVertical: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSw: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendText: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: INKSOFT },
  planSection: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 22, padding: 15, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0DDBE', backgroundColor: '#FFFCF6',
    shadowColor: HONEY, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  planAccentBar: { position: 'absolute', top: 0, left: 22, right: 22, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  planBee: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: ROSE, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  planBeeEmoji: { fontSize: 17 },
  planSectionTitle: { flex: 1, fontFamily: FONTS.v2_display, fontSize: 19, color: INK },
  planChip: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFDF9',
    borderWidth: 1, borderRadius: 15, paddingVertical: 10, paddingHorizontal: 11, marginBottom: 8,
    shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  planChipTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planChipEmoji: { fontSize: 18 },
  // flex:1 moved onto the label itself — it used to sit on the wrapper View
  // that held the label + its subtitle, and without it the arrow slides left.
  planChipText: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: 14, color: INK },
  planChipArrow: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  planChipArrowGlyph: { fontFamily: FONTS.v2_bold, fontSize: 14, color: '#fff', marginTop: -1 },
  changeRhythm: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  changeRhythmText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: ROSE, textDecorationLine: 'underline' },
});
