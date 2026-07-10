// V6 Milk Vault — manual add / scan confirmation.
//
// Extremely simple by design (spec): ounces / pumped date / frozen date /
// notes. No freezer location, no bag label, no tags, no milk type, no storage
// section. Diet/lifestyle tags come from the mom's profile, never here.
//
// Doubles as the AI-scan confirmation screen: when navigated with a `prefill`
// param it shows the extracted values for the user to edit before saving.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { VaultScreen, VaultHeader, ScrollView } from '@components/milkVault/VaultUI';
import { formatDueDateInput, toIsoDate, fromIsoDate } from '@utils/dueDate';
import { addBag } from '@api/milkVault';
import { useMilkVaultStore } from '@store/milkVault';
import { success } from '@utils/haptics';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultAddBag'>;

/** Loose date sanity: valid MM/DD/YYYY that isn't in the future. */
function isPastOrToday(mmddyyyy: string): boolean {
  const iso = toIsoDate(mmddyyyy);
  if (!iso) return false;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d.getTime() <= today.getTime();
}

export default function MilkVaultAddBagScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<MilkStackParamList, 'MilkVaultAddBag'>>();
  const prefill = route.params?.prefill;
  const fromScan = !!prefill;

  const fetchAll = useMilkVaultStore((s) => s.fetchAll);

  const todayMmdd = fromIsoDate(new Date().toISOString().slice(0, 10));

  const [ounces, setOunces] = useState(prefill?.ounces != null ? String(prefill.ounces) : '');
  const [pumped, setPumped] = useState(prefill?.pumped_date ? fromIsoDate(prefill.pumped_date) : todayMmdd);
  const [frozen, setFrozen] = useState(prefill?.frozen_date ? fromIsoDate(prefill.frozen_date) : '');
  const [notes, setNotes] = useState(prefill?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const ozNum = parseFloat(ounces);
  const ozValid = Number.isFinite(ozNum) && ozNum > 0 && ozNum <= 100;
  const pumpedValid = isPastOrToday(pumped);
  const frozenValid = frozen.trim() === '' || isPastOrToday(frozen);
  const canSave = ozValid && pumpedValid && frozenValid;

  const onSave = async () => {
    if (!canSave) {
      Alert.alert('Check your entry', 'Enter the ounces and a valid pumped date.');
      return;
    }
    setSaving(true);
    try {
      const pumpedIso = toIsoDate(pumped)!;
      const frozenIso = frozen.trim() ? toIsoDate(frozen) : null;
      await addBag({
        ounces: Math.round(ozNum * 10) / 10,
        pumped_at: pumpedIso,             // frozen defaults to pumped in the API
        frozen_at: frozenIso,
        notes: notes.trim() || null,
        photo_url: prefill?.photo_url ?? null,
        ai_extracted_data: prefill?.raw ?? null,
      });
      await fetchAll();
      success();
      // Pop back to the dashboard (scan flow pushed Scan → AddBag).
      nav.navigate('MilkVaultDashboard');
    } catch (err) {
      console.error('[milkVault] addBag', err);
      Alert.alert('Could not save', 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader
          eyebrow={fromScan ? 'Scan · Confirm' : 'Add milk'}
          title={fromScan ? 'Does this look right?' : 'Add a milk bag'}
          onBack={() => nav.goBack()}
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={12}
        >
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {fromScan && (
              <View style={styles.scanNote}>
                <Text style={styles.scanNoteText}>
                  We read these from your photo. Tap any field to fix it before saving.
                </Text>
              </View>
            )}

            {/* Ounces */}
            <Field label="Ounces" required error={ounces !== '' && !ozValid ? 'Enter ounces between 0 and 100' : undefined}>
              <View style={styles.ozRow}>
                <TextInput
                  style={[styles.input, styles.ozInput, ounces !== '' && !ozValid && styles.inputError]}
                  value={ounces}
                  onChangeText={(v) => setOunces(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="4"
                  placeholderTextColor={COLORS.genz_clay}
                  accessibilityLabel="Ounces"
                />
                <Text style={styles.ozUnit}>oz</Text>
              </View>
            </Field>

            {/* Pumped date */}
            <Field label="Pumped date" required error={pumped !== '' && !pumpedValid ? 'Use MM/DD/YYYY (not a future date)' : undefined}>
              <TextInput
                style={[styles.input, pumped !== '' && !pumpedValid && styles.inputError]}
                value={pumped}
                onChangeText={(v) => setPumped(formatDueDateInput(v))}
                keyboardType="number-pad"
                placeholder="MM/DD/YYYY"
                placeholderTextColor={COLORS.genz_clay}
                accessibilityLabel="Pumped date"
              />
            </Field>

            {/* Frozen date */}
            <Field
              label="Frozen date"
              hint="Leave blank to use the pumped date"
              error={frozen !== '' && !frozenValid ? 'Use MM/DD/YYYY (not a future date)' : undefined}
            >
              <TextInput
                style={[styles.input, frozen !== '' && !frozenValid && styles.inputError]}
                value={frozen}
                onChangeText={(v) => setFrozen(formatDueDateInput(v))}
                keyboardType="number-pad"
                placeholder={pumped || 'MM/DD/YYYY'}
                placeholderTextColor={COLORS.genz_clay}
                accessibilityLabel="Frozen date"
              />
            </Field>

            {/* Notes */}
            <Field label="Notes" hint="Optional">
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. morning pump, dairy-free day"
                placeholderTextColor={COLORS.genz_clay}
                multiline
                accessibilityLabel="Notes"
              />
            </Field>

            <View style={{ marginTop: 20 }}>
              <PrimaryCTA
                label={saving ? 'Saving…' : 'Save to vault'}
                onPress={onSave}
                loading={saving}
                disabled={!canSave}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </VaultScreen>
  );
}

function Field({
  label, hint, required, error, children,
}: {
  label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}{required ? ' *' : ''}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scanNote: {
    backgroundColor: 'rgba(217,108,136,0.08)', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  scanNoteText: { fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 19, color: COLORS.genz_chestnut },
  field: { marginBottom: 18 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  fieldLabel: { fontFamily: FONTS.v2_label, fontSize: 14, color: COLORS.genz_chestnut },
  fieldHint: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.genz_softink },
  fieldError: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.genz_berry, marginTop: 6 },
  input: {
    backgroundColor: COLORS.genz_bone, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: FONTS.v2_body, fontSize: 16, color: COLORS.genz_chestnut,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.16)',
  },
  inputError: { borderColor: COLORS.genz_berry },
  ozRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ozInput: { flex: 1 },
  ozUnit: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.genz_softink },
  notesInput: { minHeight: 84, textAlignVertical: 'top' },
});
