import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMilkVaultStore } from '@store/milkVault';
import { updateVaultSettings, type MilkVaultMode } from '@api/milkVault';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import MilkVaultDisclaimer from '@components/milk/MilkVaultDisclaimer';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'VaultSettings'>;

const MARKETPLACE_ENABLED = process.env.EXPO_PUBLIC_MILK_VAULT_MARKETPLACE === '1';

export default function MilkVaultSettingsScreen({ navigation }: Props) {
  const t = useT();
  const { settings, setSettings } = useMilkVaultStore();

  const [mode, setMode] = useState<MilkVaultMode>(settings?.mode ?? 'personal_stash');
  const [intake, setIntake] = useState(settings ? String(settings.average_daily_intake_oz) : '24');
  const [goalDays, setGoalDays] = useState(settings ? String(settings.stash_goal_days) : '30');
  const [reserveDays, setReserveDays] = useState(settings ? String(settings.desired_reserve_days) : '30');
  const [saving, setSaving] = useState(false);

  if (!settings) {
    return <View style={styles.container}><V9PageBackdrop /></View>;
  }

  const save = async () => {
    if (saving) return;
    const intakeN = parseFloat(intake);
    const goalN = parseInt(goalDays, 10);
    const reserveN = parseInt(reserveDays, 10);
    if (!intakeN || intakeN <= 0) { Alert.alert(t('milkVault.errIntakeTitle'), t('milkVault.errIntakeBody')); return; }
    if (!goalN || goalN <= 0 || !reserveN || reserveN <= 0) {
      Alert.alert(t('milkVault.errDaysTitle'), t('milkVault.errDaysBody')); return;
    }
    setSaving(true);
    try {
      const updated = await updateVaultSettings(settings.id, {
        mode,
        average_daily_intake_oz: intakeN,
        stash_goal_days: goalN,
        desired_reserve_days: reserveN,
      });
      setSettings(updated);
      navigation.goBack();
    } catch (err) {
      console.error('updateVaultSettings error:', err);
      Alert.alert(t('milkVault.errorTitle'), t('milkVault.errorBody'));
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('milkVault.settingsTitle')}</Text>

        {/* Mode */}
        <Text style={styles.label}>{t('milkVault.modeLabel')}</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'personal_stash' && styles.segmentActive]}
            onPress={() => setMode('personal_stash')}
          >
            <Text style={[styles.segmentText, mode === 'personal_stash' && styles.segmentTextActive]}>
              {t('milkVault.modePersonal')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'marketplace' && styles.segmentActive]}
            onPress={() => setMode('marketplace')}
          >
            <Text style={[styles.segmentText, mode === 'marketplace' && styles.segmentTextActive]}>
              {t('milkVault.modeMarketplace')}
            </Text>
          </TouchableOpacity>
        </View>
        {mode === 'marketplace' && !MARKETPLACE_ENABLED && (
          <Text style={styles.mktNote}>{t('milkVault.marketplaceComingSoonBanner')}</Text>
        )}

        {/* Average daily intake */}
        <Text style={styles.label}>{t('milkVault.intakeLabel')}</Text>
        <Text style={styles.hint}>{t('milkVault.intakeHint')}</Text>
        <TextInput style={styles.input} value={intake} onChangeText={setIntake} keyboardType="decimal-pad" placeholderTextColor={COLORS.v2_amber} />

        {/* Stash goal days */}
        <Text style={styles.label}>{t('milkVault.goalDaysLabel')}</Text>
        <TextInput style={styles.input} value={goalDays} onChangeText={setGoalDays} keyboardType="number-pad" placeholderTextColor={COLORS.v2_amber} />

        {/* Desired reserve days */}
        <Text style={styles.label}>{t('milkVault.reserveDaysLabel')}</Text>
        <Text style={styles.hint}>{t('milkVault.reserveDaysHint')}</Text>
        <TextInput style={styles.input} value={reserveDays} onChangeText={setReserveDays} keyboardType="number-pad" placeholderTextColor={COLORS.v2_amber} />

        <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.v2_card} /> : <Text style={styles.ctaText}>{t('milkVault.saveSettings')}</Text>}
        </TouchableOpacity>

        <MilkVaultDisclaimer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  content: { padding: 20, paddingTop: 60, paddingBottom: 48 },
  back: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_link, marginBottom: 14 },
  title: { fontSize: 26, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, letterSpacing: -0.4, marginBottom: 8 },
  label: { fontSize: 13, letterSpacing: 0.4, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_label, marginTop: 20, marginBottom: 8 },
  hint: { fontSize: 12, color: COLORS.v2_amber, fontFamily: FONTS.v2_body, marginTop: -4, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.v2_card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_body,
    borderWidth: 1, borderColor: 'rgba(122,74,36,0.14)',
  },
  segment: { flexDirection: 'row', backgroundColor: COLORS.v2_parchment, borderRadius: 999, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  segmentActive: { backgroundColor: COLORS.v2_cinnamon },
  segmentText: { fontSize: 13.5, color: COLORS.v2_walnut, fontFamily: FONTS.v2_link },
  segmentTextActive: { color: COLORS.v2_card },
  mktNote: { fontSize: 12.5, lineHeight: 18, color: COLORS.v2_cinnamon_dk, fontFamily: FONTS.v2_body, marginTop: 8 },
  cta: { marginTop: 28, backgroundColor: COLORS.v2_cinnamon, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: COLORS.v2_card, fontSize: 16, fontFamily: FONTS.v2_link },
});
