import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useMilkVaultStore } from '@store/milkVault';
import { addBag } from '@api/milkVault';
import { homeApi } from '@api/home';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'VaultAddBag'>;

// Local (not UTC) YYYY-MM-DD so an evening entry doesn't roll to tomorrow.
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + delta));
}
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Friendly date row: Today / Yesterday quick chips + a plain YYYY-MM-DD field. */
function DateField({
  label, value, onChange, optionalHint, t,
}: {
  label: string; value: string; onChange: (v: string) => void; optionalHint?: string;
  t: ReturnType<typeof useT>;
}) {
  const today = localISO(new Date());
  const yesterday = shiftDays(today, -1);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {optionalHint ? <Text style={styles.hint}>{optionalHint}</Text> : null}
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, value === today && styles.chipActive]}
          onPress={() => onChange(today)}
        >
          <Text style={[styles.chipText, value === today && styles.chipTextActive]}>{t('milkVault.today')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, value === yesterday && styles.chipActive]}
          onPress={() => onChange(yesterday)}
        >
          <Text style={[styles.chipText, value === yesterday && styles.chipTextActive]}>{t('milkVault.yesterday')}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={COLORS.v2_amber}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
    </View>
  );
}

export default function AddMilkBagScreen({ navigation, route }: Props) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const addBagLocal = useMilkVaultStore((s) => s.addBagLocal);
  const prefill = route.params?.prefill;
  const photoUri = route.params?.photoUri;

  const [ounces, setOunces] = useState(prefill?.ounces != null ? String(prefill.ounces) : '');
  const [pumpedAt, setPumpedAt] = useState(prefill?.pumped_at ?? localISO(new Date()));
  const [frozenAt, setFrozenAt] = useState(prefill?.frozen_at ?? '');
  const [notes, setNotes] = useState(prefill?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const isScanConfirm = !!prefill || !!photoUri;

  const save = async () => {
    if (!user || saving) return;
    const oz = parseFloat(ounces);
    if (!oz || oz <= 0) { Alert.alert(t('milkVault.errOuncesTitle'), t('milkVault.errOuncesBody')); return; }
    if (!ISO_RE.test(pumpedAt)) { Alert.alert(t('milkVault.errDateTitle'), t('milkVault.errDateBody')); return; }
    if (frozenAt.trim() && !ISO_RE.test(frozenAt.trim())) {
      Alert.alert(t('milkVault.errDateTitle'), t('milkVault.errDateBody')); return;
    }

    setSaving(true);
    try {
      const baby = await homeApi.getMyBabyProfile().catch(() => null);
      const bag = await addBag({
        user_id: user.id,
        baby_id: baby?.id ?? null,
        ounces: oz,
        pumped_at: pumpedAt,
        frozen_at: frozenAt.trim() || null,   // api defaults blank → pumped_at
        notes: notes.trim() || null,
        photo_url: photoUri ?? null,
        ai_extracted_data: prefill?.ai_extracted_data ?? null,
      });
      addBagLocal(bag);  // dashboard totals update immediately
      navigation.navigate('VaultHome');
    } catch (err) {
      console.error('addBag error:', err);
      Alert.alert(t('milkVault.errorTitle'), t('milkVault.errorBody'));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <V9PageBackdrop />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.back}>← {t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{isScanConfirm ? t('milkVault.confirmTitle') : t('milkVault.addTitle')}</Text>
          {isScanConfirm ? <Text style={styles.subtitle}>{t('milkVault.confirmSubtitle')}</Text> : null}

          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" /> : null}

          {/* Ounces */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('milkVault.ouncesLabel')}</Text>
            <TextInput
              style={styles.input}
              value={ounces}
              onChangeText={setOunces}
              placeholder={t('milkVault.ouncesPlaceholder')}
              placeholderTextColor={COLORS.v2_amber}
              keyboardType="decimal-pad"
            />
          </View>

          <DateField label={t('milkVault.pumpedDateLabel')} value={pumpedAt} onChange={setPumpedAt} t={t} />
          <DateField
            label={t('milkVault.frozenDateLabel')}
            value={frozenAt}
            onChange={setFrozenAt}
            optionalHint={t('milkVault.frozenDateHint')}
            t={t}
          />

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('milkVault.notesLabel')}</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('milkVault.notesPlaceholder')}
              placeholderTextColor={COLORS.v2_amber}
              multiline
            />
          </View>

          <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.v2_card} /> : <Text style={styles.ctaText}>{t('milkVault.saveBag')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  content: { padding: 20, paddingTop: 60, paddingBottom: 48 },
  back: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_link, marginBottom: 14 },
  title: { fontSize: 26, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, lineHeight: 20, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body, marginTop: 6 },
  photo: { width: '100%', height: 180, borderRadius: 16, marginTop: 16, backgroundColor: COLORS.v2_parchment },
  field: { marginTop: 18 },
  label: { fontSize: 13, letterSpacing: 0.4, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_label, marginBottom: 8 },
  hint: { fontSize: 12, color: COLORS.v2_amber, fontFamily: FONTS.v2_body, marginTop: -4, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.v2_card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_body,
    borderWidth: 1, borderColor: 'rgba(122,74,36,0.14)',
  },
  notesInput: { minHeight: 84, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: COLORS.v2_card, borderWidth: 1, borderColor: 'rgba(122,74,36,0.14)',
  },
  chipActive: { backgroundColor: COLORS.v2_cinnamon, borderColor: COLORS.v2_cinnamon },
  chipText: { fontSize: 13, color: COLORS.v2_walnut, fontFamily: FONTS.v2_link },
  chipTextActive: { color: COLORS.v2_card },
  cta: {
    marginTop: 28, backgroundColor: COLORS.v2_cinnamon, borderRadius: 999,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: COLORS.v2_card, fontSize: 16, fontFamily: FONTS.v2_link },
});
