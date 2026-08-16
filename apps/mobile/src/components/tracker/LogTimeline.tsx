// Merged log timeline — sleep, feeds, diapers, and notes on one time axis.
// Extracted from PlaybookTracker so LogHistoryScreen renders identical rows.
// Rows are touchable: tapping one hands the underlying LogEntry back so the
// caller can open the edit sheet.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '@utils/constants';
import type { TodayLogs, LogEntry, FeedLog } from '@api/babyTracker';

const C = {
  paper: COLORS.v2_paper, cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut,
  rose: COLORS.v2_cinnamon,
  honeyBg: '#F7E7BE', honeyInk: '#5A4012',
  oliveBg: '#E4E7C8', oliveInk: '#3F4516',
};

export const TL_ICON = {
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  bottle: 'M9 2h6M10 2v3l-2 3v11a2 2 0 002 2h4a2 2 0 002-2V8l-2-3V2M8 12h8',
  note: 'M5 4h14v16l-4-3H5z',
} as const;

function Glyph({ d, color, size = 12, sw = 1.7 }: { d: string; color: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function clockLabel(iso: string, lang: 'en' | 'es'): string {
  const d = new Date(iso);
  const h = d.getHours(); const m = d.getMinutes();
  const mm = m < 10 ? `0${m}` : `${m}`;
  if (lang === 'es') return `${h}:${mm}`;
  const ap = h < 12 ? 'a' : 'p'; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mm}${ap}`;
}

export function feedShort(f: FeedLog, es: boolean): string {
  if (f.method === 'bottle') return `${es ? 'biberón' : 'bottle'}${f.amount_oz ? ` ${f.amount_oz}oz` : ''}`;
  return f.side === 'left' ? (es ? 'izq.' : 'left') : (es ? 'der.' : 'right');
}

export interface TimelineItem {
  id: string; iso: string; label: string;
  tint: string; ink: string; icon: string; entry: LogEntry;
}

export function buildTimeline(logs: TodayLogs, es: boolean): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const s of logs.sleep) {
    const mins = s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;
    out.push({
      id: `s${s.id}`, iso: s.started_at, tint: '#F0D7C3', ink: '#9A4E28', icon: TL_ICON.moon,
      label: mins != null ? `${es ? 'Siesta' : 'Nap'} · ${mins} min` : `${es ? 'Siesta — en curso' : 'Nap — in progress'}`,
      entry: { kind: 'sleep', row: s },
    });
  }
  for (const f of logs.feeds) {
    const mins = f.ended_at ? Math.round((new Date(f.ended_at).getTime() - new Date(f.started_at).getTime()) / 60000) : null;
    const label = f.method === 'bottle'
      ? `${es ? 'Biberón' : 'Bottle'}${f.amount_oz ? ` · ${f.amount_oz} oz` : ''}`
      : `${f.side === 'left' ? (es ? 'Pecho izq.' : 'Left breast') : (es ? 'Pecho der.' : 'Right breast')}${mins != null ? ` · ${mins} min` : (es ? ' — en curso' : ' — in progress')}`;
    out.push({ id: `f${f.id}`, iso: f.started_at, tint: C.honeyBg, ink: C.honeyInk, icon: TL_ICON.bottle, label, entry: { kind: 'feed', row: f } });
  }
  for (const d of logs.diapers) {
    out.push({
      id: `d${d.id}`, iso: d.occurred_at, tint: C.oliveBg, ink: C.oliveInk, icon: TL_ICON.droplet,
      label: es
        ? { wet: 'Pañal mojado', dirty: 'Pañal sucio', both: 'Pañal ambos' }[d.kind]
        : { wet: 'Wet diaper', dirty: 'Dirty diaper', both: 'Wet + dirty' }[d.kind],
      entry: { kind: 'diaper', row: d },
    });
  }
  for (const n of logs.notes) {
    out.push({ id: `n${n.id}`, iso: n.occurred_at, tint: '#FBEFD9', ink: C.rose, icon: TL_ICON.note, label: n.raw_text, entry: { kind: 'note', row: n } });
  }
  return out.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
}

export default function LogTimeline({ items, lang, onPressItem }: {
  items: TimelineItem[]; lang: 'en' | 'es'; onPressItem: (entry: LogEntry) => void;
}) {
  const es = lang === 'es';
  return (
    <View>
      {items.map((e, i) => (
        <TouchableOpacity
          key={e.id}
          onPress={() => onPressItem(e.entry)}
          activeOpacity={0.6}
          style={[styles.row, i < items.length - 1 && styles.divider]}
          accessibilityRole="button"
          accessibilityLabel={`${clockLabel(e.iso, lang)} ${e.label}. ${es ? 'Toca para editar' : 'Tap to edit'}`}
        >
          <Text style={styles.time}>{clockLabel(e.iso, lang)}</Text>
          <View style={[styles.icon, { backgroundColor: e.tint }]}><Glyph d={e.icon} color={e.ink} /></View>
          <Text style={styles.label} numberOfLines={1}>{e.label}</Text>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)' },
  time: { fontFamily: FONTS.v2_mono, fontSize: 9.5, color: C.walnut, width: 44 },
  icon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12, color: C.cocoa },
  chev: { fontFamily: FONTS.v2_link, fontSize: 15, color: C.walnut, opacity: 0.5 },
});
