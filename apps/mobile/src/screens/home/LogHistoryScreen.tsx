// Log history — every day you've logged, newest first, all of it editable.
//
// Pages a week at a time via babyTrackerApi.getRange, groups into LOCAL days
// (dayKeyLocal, not the UTC slice the tracker used to group on), and renders
// the same LogTimeline rows the tracker does so an edit works identically here.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { babyTrackerApi, type TodayLogs, type LogEntry } from '@api/babyTracker';
import { groupByDay, startOfDayLocal } from '@utils/logEntry';
import { FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useUserStore } from '@store/user';
import LogTimeline, { buildTimeline, type TimelineItem } from '@components/tracker/LogTimeline';
import LogEditSheet from '@components/tracker/LogEditSheet';

const C = { cream: '#FCF7EF', paper: '#FFFCF6', cocoa: '#3D2116', walnut: '#8A6A55', roseInk: '#9E2F4C', muted: '#A6957F' };
const PAGE_DAYS = 7;

const EMPTY: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };
const merge = (a: TodayLogs, b: TodayLogs): TodayLogs => ({
  sleep: [...a.sleep, ...b.sleep], feeds: [...a.feeds, ...b.feeds],
  diapers: [...a.diapers, ...b.diapers], notes: [...a.notes, ...b.notes],
});

export default function LogHistoryScreen() {
  const lang = (useUserStore.getState().profile?.preferred_language ?? 'en') as 'en' | 'es';
  const es = lang === 'es';
  const [logs, setLogs] = useState<TodayLogs>(EMPTY);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LogEntry | null>(null);

  const loadPage = useCallback(async (pageIndex: number) => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const to = new Date(end.getTime() - pageIndex * PAGE_DAYS * 86400000);
    const from = new Date(to.getTime() - PAGE_DAYS * 86400000);
    const page = await babyTrackerApi.getRange(from.toISOString(), to.toISOString());
    setLogs((prev) => (pageIndex === 0 ? page : merge(prev, page)));
    setPages(pageIndex + 1);
    setLoading(false);
  }, []);

  useEffect(() => { loadPage(0); }, [loadPage]);

  // Re-pull everything currently loaded, so an edit is reflected on every page.
  const reload = useCallback(async () => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const from = new Date(end.getTime() - pages * PAGE_DAYS * 86400000);
    setLogs(await babyTrackerApi.getRange(from.toISOString(), end.toISOString()));
  }, [pages]);

  const days = groupByDay<TimelineItem>(buildTimeline(logs, es), (i) => i.iso);

  const dayHeading = (key: string) => {
    const date = startOfDayLocal(key);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
    if (diff === 0) return es ? 'hoy' : 'today';
    if (diff === 1) return es ? 'ayer' : 'yesterday';
    return date.toLocaleDateString(es ? 'es-US' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <BackButton color={C.roseInk} />
          <Text style={s.title}>{es ? 'tus registros' : 'your logs'}</Text>
          <View style={{ width: 30 }} />
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.roseInk} /></View>
        ) : days.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyTitle}>{es ? 'Todavía nada' : 'Nothing logged yet'}</Text>
            <Text style={s.emptyBody}>{es ? 'Lo que registres aparecerá aquí, día por día.' : 'What you log shows up here, day by day.'}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 90, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {days.map((day) => (
              <View key={day.dayKey} style={{ marginBottom: 18 }}>
                <Text style={s.dayHead}>{dayHeading(day.dayKey)}</Text>
                <View style={s.dayCard}>
                  <LogTimeline items={day.items} lang={lang} onPressItem={setEditing} />
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => loadPage(pages)} style={s.moreBtn} accessibilityRole="button">
              <Text style={s.moreTxt}>{es ? 'cargar semana anterior' : 'load the week before'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>

      <LogEditSheet entry={editing} lang={lang} onClose={() => { setEditing(null); reload(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  title: { fontFamily: FONTS.headerBold, fontSize: 28, color: C.cocoa, letterSpacing: -0.5 },
  dayHead: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: C.walnut, marginBottom: 7 },
  dayCard: { backgroundColor: C.paper, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.09)' },
  moreBtn: { alignItems: 'center', paddingVertical: 16 },
  moreTxt: { fontFamily: FONTS.v2_link, fontSize: 13, color: C.roseInk },
  emptyTitle: { fontFamily: FONTS.headerBold, fontSize: 19, color: C.cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: C.muted, textAlign: 'center', marginTop: 8 },
});
