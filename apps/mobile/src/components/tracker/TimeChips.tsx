// "When did this happen?" — back-dating at log time.
//
// Defaults to now and RESETS to now after every log, so a stale selection can
// never silently mis-stamp the next entry. ⌄ opens the full TimeField.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { select } from '@utils/haptics';
import { minutesAgoISO } from '@utils/logEntry';
import TimeField from './TimeField';

const C = { paper: COLORS.v2_paper, parchment: COLORS.v2_parchment, cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon };

const OFFSETS = [0, 15, 30, 60] as const;

export default function TimeChips({ valueIso, onChange, lang }: {
  valueIso: string | null;              // null === now
  onChange: (iso: string | null) => void;
  lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  const [expanded, setExpanded] = useState(false);
  const label = (m: number) => (m === 0 ? (es ? 'ahora' : 'now') : `${m}m`);

  // A chip is selected when the value is within 90s of that offset.
  const selectedOffset = (m: number) => {
    if (m === 0) return valueIso === null;
    if (!valueIso) return false;
    return Math.abs(Date.parse(minutesAgoISO(m, Date.now())) - Date.parse(valueIso)) < 90_000;
  };

  return (
    <View style={{ gap: 8, marginTop: 9 }}>
      <View style={s.row}>
        {OFFSETS.map((m) => {
          const on = selectedOffset(m);
          return (
            <TouchableOpacity
              key={m}
              onPress={() => { select(); setExpanded(false); onChange(m === 0 ? null : minutesAgoISO(m, Date.now())); }}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m === 0 ? (es ? 'Ahora' : 'Now') : (es ? `Hace ${m} minutos` : `${m} minutes ago`)}
            >
              <Text style={[s.txt, on && s.txtOn]}>{label(m)}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => { select(); if (!valueIso) onChange(new Date().toISOString()); setExpanded((e) => !e); }}
          style={[s.chip, expanded && s.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={es ? 'Elegir fecha y hora' : 'Pick a date and time'}
        >
          <Text style={[s.txt, expanded && s.txtOn]}>⌄</Text>
        </TouchableOpacity>
      </View>
      {expanded && valueIso && (
        <TimeField label={es ? 'Ocurrió' : 'Happened'} value={valueIso} onChange={onChange} lang={lang} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, backgroundColor: C.parchment, borderRadius: 9, paddingVertical: 7, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  chipOn: { borderColor: C.rose, backgroundColor: C.paper },
  txt: { fontFamily: FONTS.v2_bold, fontSize: 11, color: C.walnut },
  txtOn: { color: C.cocoa },
});
