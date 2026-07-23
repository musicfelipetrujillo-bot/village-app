// DaySheetBuilderScreen — build/edit a caregiver day sheet.
// New sheets auto-draft their schedule from the mom's logged feeds/naps; she
// edits rows (tap the emoji to change type), fills essentials, and adds pro
// tips with an optional "snap a pic." Save → Share.
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useHomeStore } from '@store/home';
import {
  daySheetsApi, draftScheduleFromLogs, deriveKeyTimes, ROW_META,
  type SheetRow, type SheetRowKind, type SheetTip, type SheetEssentials,
} from '@api/daySheets';

const KIND_ORDER: SheetRowKind[] = ['wake', 'bottle', 'nap', 'meal', 'bath', 'bed', 'note'];

type Draft = {
  baby_name: string; for_whom: string; starts_on: string; ends_on: string;
  baby_profile_id: string | null;
  schedule: SheetRow[]; essentials: SheetEssentials; tips: SheetTip[];
};

export default function DaySheetBuilderScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const existingId: string | undefined = route.params?.id;
  const babyProfile = useHomeStore((s) => s.babyProfile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | undefined>(existingId);
  const [uploadingTip, setUploadingTip] = useState<number | null>(null);
  const [d, setD] = useState<Draft>({
    baby_name: '', for_whom: '', starts_on: '', ends_on: '', baby_profile_id: null,
    schedule: [], essentials: {}, tips: [],
  });

  useEffect(() => {
    (async () => {
      if (existingId) {
        const s = await daySheetsApi.get(existingId);
        if (s) setD({
          baby_name: s.baby_name ?? '', for_whom: s.for_whom ?? '',
          starts_on: s.starts_on ?? '', ends_on: s.ends_on ?? '',
          baby_profile_id: s.baby_profile_id, schedule: s.schedule ?? [],
          essentials: s.essentials ?? {}, tips: s.tips ?? [],
        });
      } else {
        const { schedule } = await draftScheduleFromLogs();
        setD((p) => ({ ...p, schedule, baby_name: babyProfile?.baby_name ?? '', baby_profile_id: babyProfile?.id ?? null }));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId]);

  const setRow = (i: number, patch: Partial<SheetRow>) =>
    setD((p) => ({ ...p, schedule: p.schedule.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const cycleKind = (i: number) =>
    setRow(i, { kind: KIND_ORDER[(KIND_ORDER.indexOf(d.schedule[i].kind) + 1) % KIND_ORDER.length] });
  const addRow = () => setD((p) => ({ ...p, schedule: [...p.schedule, { time: '12:00p', kind: 'bottle', text: '' }] }));
  const removeRow = (i: number) => setD((p) => ({ ...p, schedule: p.schedule.filter((_, idx) => idx !== i) }));

  const setEss = (k: keyof SheetEssentials, v: string) => setD((p) => ({ ...p, essentials: { ...p.essentials, [k]: v } }));

  const addTip = () => setD((p) => ({ ...p, tips: [...p.tips, { text: '', photo_url: null }] }));
  const setTip = (i: number, patch: Partial<SheetTip>) =>
    setD((p) => ({ ...p, tips: p.tips.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));
  const removeTip = (i: number) => setD((p) => ({ ...p, tips: p.tips.filter((_, idx) => idx !== i) }));
  const pickTipPhoto = async (i: number) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploadingTip(i);
    const url = await daySheetsApi.uploadTipPhoto(res.assets[0].uri);
    setUploadingTip(null);
    if (url) setTip(i, { photo_url: url });
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      baby_name: d.baby_name || null, for_whom: d.for_whom || null,
      starts_on: d.starts_on || null, ends_on: d.ends_on || null,
      baby_profile_id: d.baby_profile_id, schedule: d.schedule,
      key_times: deriveKeyTimes(d.schedule), essentials: d.essentials,
      tips: d.tips.filter((t) => (t.text || '').trim() || t.photo_url),
    };
    let sheetId = id;
    if (id) await daySheetsApi.update(id, payload);
    else { const created = await daySheetsApi.create(payload); sheetId = created?.id; if (sheetId) setId(sheetId); }
    setSaving(false);
    if (sheetId) nav.navigate('DaySheetShare', { id: sheetId });
  };

  if (loading) return <View style={[s.center, { flex: 1, backgroundColor: COLORS.v2_paper }]}><ActivityIndicator color={COLORS.v2_cinnamon} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.v2_paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.head, { paddingTop: insets.top + 10 }]}>
        <BackButton color={COLORS.v2_cinnamon} />
        <Text style={s.headTitle}>Day sheet</Text>
        <TouchableOpacity onPress={save} disabled={saving} accessibilityRole="button" accessibilityLabel="Save and share">
          {saving ? <ActivityIndicator color={COLORS.v2_cinnamon} /> : <Text style={s.save}>Share →</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* who / when */}
        <View style={s.card}>
          <Text style={s.lbl}>Who's this for?</Text>
          <TextInput style={s.input} value={d.for_whom} onChangeText={(v) => setD((p) => ({ ...p, for_whom: v }))} placeholder="Grandma, the nanny…" placeholderTextColor="#B79C86" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}><Text style={s.lbl}>Baby</Text><TextInput style={s.input} value={d.baby_name} onChangeText={(v) => setD((p) => ({ ...p, baby_name: v }))} placeholder="Baby's name" placeholderTextColor="#B79C86" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}><Text style={s.lbl}>From</Text><TextInput style={s.input} value={d.starts_on} onChangeText={(v) => setD((p) => ({ ...p, starts_on: v }))} placeholder="2026-07-12" placeholderTextColor="#B79C86" /></View>
            <View style={{ flex: 1 }}><Text style={s.lbl}>To</Text><TextInput style={s.input} value={d.ends_on} onChangeText={(v) => setD((p) => ({ ...p, ends_on: v }))} placeholder="2026-07-15" placeholderTextColor="#B79C86" /></View>
          </View>
        </View>

        {/* schedule */}
        <Text style={s.sectionTitle}>The day</Text>
        <Text style={s.hint}>Tap the emoji to change the type. We drafted this from your logs — tweak anything.</Text>
        {d.schedule.map((r, i) => {
          const meta = ROW_META[r.kind];
          return (
            <View key={i} style={[s.row, meta.rowBg ? { backgroundColor: meta.rowBg } : null]}>
              <TouchableOpacity onPress={() => cycleKind(i)} style={[s.kindBtn, { backgroundColor: meta.chip }]} accessibilityRole="button" accessibilityLabel={`Type: ${meta.label}, tap to change`}>
                <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
              </TouchableOpacity>
              <TextInput style={s.timeInput} value={r.time} onChangeText={(v) => setRow(i, { time: v })} placeholder="9:00a" placeholderTextColor="#B79C86" />
              <TextInput style={s.rowText} value={r.text} onChangeText={(v) => setRow(i, { text: v })} placeholder={meta.label} placeholderTextColor="#B79C86" />
              <TouchableOpacity onPress={() => removeRow(i)} style={s.del} accessibilityRole="button" accessibilityLabel="Remove row"><Text style={s.delX}>×</Text></TouchableOpacity>
            </View>
          );
        })}
        <TouchableOpacity onPress={addRow} style={s.addBtn} accessibilityRole="button" accessibilityLabel="Add a row"><Text style={s.addTxt}>＋ add a time</Text></TouchableOpacity>

        {/* essentials */}
        <Text style={s.sectionTitle}>Essentials</Text>
        <View style={s.card}>
          {([['emergency', 'Emergency contact'], ['allergies', 'Allergies'], ['pediatrician', 'Pediatrician'], ['comfort', 'Comfort items'], ['meds', 'Meds / notes']] as [keyof SheetEssentials, string][]).map(([k, label]) => (
            <View key={k} style={{ marginBottom: 10 }}>
              <Text style={s.lbl}>{label}</Text>
              <TextInput style={s.input} value={d.essentials[k] ?? ''} onChangeText={(v) => setEss(k, v)} placeholder={label} placeholderTextColor="#B79C86" />
            </View>
          ))}
        </View>

        {/* pro tips */}
        <Text style={s.sectionTitle}>Pro tips from mom</Text>
        <Text style={s.hint}>The little things only you know — add a photo when a picture says it better.</Text>
        {d.tips.map((t, i) => (
          <View key={i} style={s.tipCard}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => pickTipPhoto(i)} style={s.tipPhoto} accessibilityRole="button" accessibilityLabel="Add a photo">
                {uploadingTip === i ? <ActivityIndicator color={COLORS.v2_cinnamon} />
                  : t.photo_url ? <Image source={{ uri: t.photo_url }} style={s.tipImg} />
                  : <Text style={s.tipPhotoTxt}>📷{'\n'}snap</Text>}
              </TouchableOpacity>
              <TextInput style={[s.input, { flex: 1, minHeight: 66, textAlignVertical: 'top' }]} value={t.text} onChangeText={(v) => setTip(i, { text: v })} placeholder="e.g. Lay the blanket over his eyes while he takes the bottle…" placeholderTextColor="#B79C86" multiline />
            </View>
            <TouchableOpacity onPress={() => removeTip(i)} style={{ alignSelf: 'flex-end', marginTop: 6 }}><Text style={s.removeTip}>remove</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={addTip} style={s.addBtn} accessibilityRole="button" accessibilityLabel="Add a tip"><Text style={s.addTxt}>＋ add a pro tip</Text></TouchableOpacity>

        <TouchableOpacity onPress={save} disabled={saving} style={s.saveBtn} accessibilityRole="button" accessibilityLabel="Save and share">
          <Text style={s.saveBtnTxt}>{saving ? 'Saving…' : 'Save & share →'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)' },
  back: { fontFamily: FONTS.v2_link, fontSize: 15, color: COLORS.v2_cinnamon },
  headTitle: { fontFamily: FONTS.v3_display, fontSize: 18, color: COLORS.v2_cocoa },
  save: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.v2_cinnamon },
  card: { backgroundColor: '#FFFCF6', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)' },
  lbl: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: '#B98A1E', fontWeight: '700', marginBottom: 5 },
  input: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_cocoa, backgroundColor: '#FDF6EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)' },
  sectionTitle: { fontFamily: FONTS.v3_display, fontSize: 19, color: COLORS.v2_cocoa, marginTop: 22, marginBottom: 4 },
  hint: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: COLORS.v2_walnut, marginBottom: 10, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 11, marginBottom: 7, paddingRight: 6, paddingLeft: 8, backgroundColor: '#FFFCF6', borderWidth: 1, borderColor: 'rgba(61,31,14,0.07)' },
  kindBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  timeInput: { width: 58, fontFamily: FONTS.v2_mono, fontSize: 12, fontWeight: '700', color: COLORS.v2_cocoa, paddingVertical: 10 },
  rowText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13.5, color: COLORS.v2_cocoa, paddingVertical: 10, paddingHorizontal: 4 },
  del: { width: 26, height: 44, alignItems: 'center', justifyContent: 'center' },
  delX: { fontSize: 22, color: '#B7A692', marginTop: -2 },
  addBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4, backgroundColor: '#FDECEF', borderRadius: 11 },
  addTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.v2_cinnamon },
  tipCard: { backgroundColor: '#FFFCF6', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)', marginBottom: 8 },
  tipPhoto: { width: 66, height: 66, borderRadius: 10, backgroundColor: '#FDECEF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tipImg: { width: 66, height: 66 },
  tipPhotoTxt: { fontFamily: FONTS.v2_mono, fontSize: 9, color: COLORS.v2_cinnamon, textAlign: 'center', lineHeight: 13 },
  removeTip: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#B7A692' },
  saveBtn: { backgroundColor: COLORS.v2_cocoa, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 26 },
  saveBtnTxt: { fontFamily: FONTS.v3_display, fontSize: 15, color: '#fff' },
});
