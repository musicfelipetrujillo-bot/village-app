// Pure-JS date + time control.
//
// Deliberately NOT @react-native-community/datetimepicker: that is a native
// module, and adding one would gate this entire feature behind a native build.
// Follows the ± stepper pattern already shipped in NotificationPreferencesScreen.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { select } from '@utils/haptics';

const C = {
  paper: COLORS.v2_paper, parchment: COLORS.v2_parchment,
  cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon,
};

function dayLabel(d: Date, lang: 'en' | 'es'): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return lang === 'es' ? 'hoy' : 'today';
  if (diff === 1) return lang === 'es' ? 'ayer' : 'yesterday';
  return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' });
}

function timeLabel(d: Date, lang: 'en' | 'es'): string {
  const h = d.getHours(); const mm = String(d.getMinutes()).padStart(2, '0');
  if (lang === 'es') return `${String(h).padStart(2, '0')}:${mm}`;
  const ap = h < 12 ? 'AM' : 'PM'; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${ap}`;
}

export default function TimeField({ label, value, onChange, lang, maxNow = true }: {
  label: string;
  value: string;                       // ISO
  onChange: (iso: string) => void;
  lang: 'en' | 'es';
  maxNow?: boolean;                    // clamp forward stepping to now
}) {
  const d = new Date(value);

  const shift = (deltaMs: number) => {
    select();
    const next = new Date(d.getTime() + deltaMs);
    if (maxNow && next.getTime() > Date.now()) return;
    onChange(next.toISOString());
  };

  const Step = ({ dir, ms, a11y }: { dir: '−' | '+'; ms: number; a11y: string }) => (
    <TouchableOpacity
      onPress={() => shift(dir === '−' ? -ms : ms)}
      style={s.stepBtn}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Text style={s.stepTxt}>{dir}</Text>
    </TouchableOpacity>
  );

  const es = lang === 'es';
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Step dir="−" ms={86400000} a11y={es ? 'Un día antes' : 'One day earlier'} />
        <Text style={s.day}>{dayLabel(d, lang)}</Text>
        <Step dir="+" ms={86400000} a11y={es ? 'Un día después' : 'One day later'} />
      </View>
      <View style={s.row}>
        <Step dir="−" ms={3600000} a11y={es ? 'Una hora antes' : 'One hour earlier'} />
        <Text style={s.time}>{timeLabel(d, lang)}</Text>
        <Step dir="+" ms={3600000} a11y={es ? 'Una hora después' : 'One hour later'} />
      </View>
      <View style={s.row}>
        <Step dir="−" ms={5 * 60000} a11y={es ? 'Cinco minutos antes' : 'Five minutes earlier'} />
        <Text style={s.mins}>{es ? '5 min' : '5 min'}</Text>
        <Step dir="+" ms={5 * 60000} a11y={es ? 'Cinco minutos después' : 'Five minutes later'} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.parchment, borderRadius: 12, padding: 11, gap: 7 },
  label: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: C.walnut },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: FONTS.v2_display_big, fontSize: 16, color: C.cocoa, marginTop: -2 },
  day: { fontFamily: FONTS.v2_bold, fontSize: 14, color: C.cocoa },
  time: { fontFamily: FONTS.v2_display_big, fontSize: 18, color: C.cocoa },
  mins: { fontFamily: FONTS.v2_body, fontSize: 11, color: C.walnut },
});
