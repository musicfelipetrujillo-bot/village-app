// One edit sheet for every log type, driven by entry.kind.
//
// Hard edit, no trail (spec D2): saving overwrites, deleting removes. The guard
// against accidental loss is the destructive confirm, not an audit column.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { tap } from '@utils/haptics';
import { clampOz } from '@utils/logEntry';
import { useTrackerStore } from '@store/babyTracker';
import type { LogEntry, DiaperKind } from '@api/babyTracker';
import TimeField from './TimeField';

const C = {
  paper: COLORS.v2_paper, cream: COLORS.v2_cream, parchment: COLORS.v2_parchment,
  cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon,
};

export default function LogEditSheet({ entry, lang, onClose }: {
  entry: LogEntry | null; lang: 'en' | 'es'; onClose: () => void;
}) {
  const es = lang === 'es';
  const store = useTrackerStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft state, re-seeded whenever a different entry opens.
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [seededId, setSeededId] = useState<string | null>(null);
  if (entry && entry.row.id !== seededId) {
    setSeededId(entry.row.id);
    setDraft(entry.kind === 'sleep' ? { started_at: entry.row.started_at, ended_at: entry.row.ended_at }
      : entry.kind === 'feed' ? { method: entry.row.method, side: entry.row.side, started_at: entry.row.started_at, ended_at: entry.row.ended_at, amount_oz: entry.row.amount_oz }
      : entry.kind === 'diaper' ? { kind: entry.row.kind, occurred_at: entry.row.occurred_at }
      : { raw_text: entry.row.raw_text, occurred_at: entry.row.occurred_at });
    setError(null);
  }

  if (!entry) return null;
  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));

  // Clearing seededId is what makes the ✕ behave like cancel: without it,
  // reopening the same row re-shows the abandoned draft instead of the row's
  // real values, because the reseed guard still matches.
  const close = () => { setSeededId(null); setError(null); onClose(); };

  const onSave = async () => {
    tap(); setBusy(true); setError(null);
    const res = await store.updateEntry(entry, draft);
    setBusy(false);
    if (res.ok) close();
    else setError(res.reason ?? (es ? 'No se pudo guardar.' : "That didn't save."));
  };

  const onDelete = () => {
    Alert.alert(
      es ? '¿Borrar este registro?' : 'Delete this log?',
      es ? 'No se puede deshacer.' : "This can't be undone.",
      [
        { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: es ? 'Borrar' : 'Delete', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const res = await store.deleteEntry(entry);
            setBusy(false);
            if (res.ok) close();
            else setError(res.reason ?? (es ? 'No se pudo borrar.' : "That didn't delete."));
          },
        },
      ],
    );
  };

  const title = entry.kind === 'sleep' ? (es ? 'Siesta' : 'Nap')
    : entry.kind === 'feed' ? (es ? 'Toma' : 'Feed')
    : entry.kind === 'diaper' ? (es ? 'Pañal' : 'Diaper')
    : (es ? 'Nota' : 'Note');

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, on && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
    >
      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel={es ? 'Cerrar' : 'Close'}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            {entry.kind === 'sleep' && (
              <>
                <TimeField label={es ? 'Inició' : 'Started'} value={draft.started_at as string} onChange={(v) => set('started_at', v)} lang={lang} />
                {draft.ended_at
                  ? <TimeField label={es ? 'Terminó' : 'Ended'} value={draft.ended_at as string} onChange={(v) => set('ended_at', v)} lang={lang} />
                  : (
                    <TouchableOpacity onPress={() => set('ended_at', new Date().toISOString())} style={s.ghostBtn} accessibilityRole="button">
                      <Text style={s.ghostTxt}>{es ? 'Aún durmiendo — terminar ahora' : 'Still running — end it now'}</Text>
                    </TouchableOpacity>
                  )}
              </>
            )}

            {entry.kind === 'feed' && (
              <>
                <View style={s.chipRow}>
                  <Chip on={draft.method === 'breast' && draft.side === 'left'} label={es ? 'Izq.' : 'Left'} onPress={() => setDraft((d) => ({ ...d, method: 'breast', side: 'left', amount_oz: null }))} />
                  <Chip on={draft.method === 'breast' && draft.side === 'right'} label={es ? 'Der.' : 'Right'} onPress={() => setDraft((d) => ({ ...d, method: 'breast', side: 'right', amount_oz: null }))} />
                  <Chip on={draft.method === 'bottle'} label={es ? 'Biberón' : 'Bottle'} onPress={() => setDraft((d) => ({ ...d, method: 'bottle', side: null, amount_oz: d.amount_oz ?? 3 }))} />
                </View>
                {draft.method === 'bottle' && (
                  <View style={s.ozRow}>
                    <Text style={s.ozLabel}>{es ? 'ONZAS' : 'OZ'}</Text>
                    <TouchableOpacity onPress={() => set('amount_oz', clampOz((draft.amount_oz as number ?? 0) - 0.5))} style={s.ozBtn} accessibilityRole="button" accessibilityLabel={es ? 'Menos onzas' : 'Fewer ounces'}><Text style={s.ozBtnTxt}>−</Text></TouchableOpacity>
                    <Text style={s.ozVal}>{String(draft.amount_oz ?? 0)}</Text>
                    <TouchableOpacity onPress={() => set('amount_oz', clampOz((draft.amount_oz as number ?? 0) + 0.5))} style={s.ozBtn} accessibilityRole="button" accessibilityLabel={es ? 'Más onzas' : 'More ounces'}><Text style={s.ozBtnTxt}>+</Text></TouchableOpacity>
                  </View>
                )}
                <TimeField label={es ? 'Inició' : 'Started'} value={draft.started_at as string} onChange={(v) => set('started_at', v)} lang={lang} />
                {draft.ended_at
                  ? <TimeField label={es ? 'Terminó' : 'Ended'} value={draft.ended_at as string} onChange={(v) => set('ended_at', v)} lang={lang} />
                  : (
                    <TouchableOpacity onPress={() => set('ended_at', new Date().toISOString())} style={s.ghostBtn} accessibilityRole="button">
                      <Text style={s.ghostTxt}>{es ? 'En curso — terminar ahora' : 'Still running — end it now'}</Text>
                    </TouchableOpacity>
                  )}
              </>
            )}

            {entry.kind === 'diaper' && (
              <>
                <View style={s.chipRow}>
                  {(['wet', 'dirty', 'both'] as DiaperKind[]).map((k) => (
                    <Chip key={k} on={draft.kind === k} label={es ? { wet: 'Pis', dirty: 'Caca', both: 'Ambos' }[k] : { wet: 'Wet', dirty: 'Dirty', both: 'Both' }[k]} onPress={() => set('kind', k)} />
                  ))}
                </View>
                <TimeField label={es ? 'Hora' : 'Time'} value={draft.occurred_at as string} onChange={(v) => set('occurred_at', v)} lang={lang} />
              </>
            )}

            {entry.kind === 'note' && (
              <>
                <TextInput
                  value={draft.raw_text as string}
                  onChangeText={(t) => set('raw_text', t)}
                  style={s.noteInput}
                  multiline
                  accessibilityLabel={es ? 'Texto de la nota' : 'Note text'}
                />
                <TimeField label={es ? 'Hora' : 'Time'} value={draft.occurred_at as string} onChange={(v) => set('occurred_at', v)} lang={lang} />
              </>
            )}

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity onPress={onDelete} disabled={busy} style={s.deleteBtn} accessibilityRole="button" accessibilityLabel={es ? 'Borrar registro' : 'Delete log'}>
              <Text style={s.deleteTxt}>{es ? 'Borrar' : 'Delete'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} disabled={busy} style={[s.saveBtn, busy && { opacity: 0.5 }]} accessibilityRole="button" accessibilityState={{ busy }} accessibilityLabel={es ? 'Guardar cambios' : 'Save changes'}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveTxt}>{es ? 'Guardar' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(61,31,14,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.cream, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30, maxHeight: '85%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: FONTS.headerBold, fontSize: 21, color: C.cocoa },
  close: { fontFamily: FONTS.v2_link, fontSize: 17, color: C.walnut, padding: 4 },
  chipRow: { flexDirection: 'row', gap: 7 },
  chip: { flex: 1, backgroundColor: C.parchment, borderRadius: 11, paddingVertical: 11, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  chipOn: { borderColor: C.rose, backgroundColor: C.paper },
  chipTxt: { fontFamily: FONTS.v2_bold, fontSize: 13, color: C.walnut },
  chipTxtOn: { color: C.cocoa },
  ozRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.parchment, borderRadius: 12, padding: 11 },
  ozLabel: { flex: 1, fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, color: C.walnut },
  ozBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  ozBtnTxt: { fontFamily: FONTS.v2_display_big, fontSize: 16, color: C.cocoa, marginTop: -2 },
  ozVal: { fontFamily: FONTS.v2_display_big, fontSize: 18, color: C.cocoa, minWidth: 34, textAlign: 'center' },
  noteInput: { backgroundColor: C.paper, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(122,74,40,0.2)', padding: 12, minHeight: 76, fontFamily: FONTS.v2_body, fontSize: 14, color: C.cocoa },
  ghostBtn: { backgroundColor: C.parchment, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ghostTxt: { fontFamily: FONTS.v2_link, fontSize: 13, color: C.walnut },
  error: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: C.rose, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  deleteBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 13, backgroundColor: C.parchment },
  deleteTxt: { fontFamily: FONTS.v2_link, fontSize: 14, color: '#A33' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 13, backgroundColor: C.rose, alignItems: 'center' },
  saveTxt: { fontFamily: FONTS.v2_link, fontSize: 14, color: '#fff' },
});
