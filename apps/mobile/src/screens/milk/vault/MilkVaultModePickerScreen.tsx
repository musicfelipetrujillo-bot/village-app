import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useMilkVaultStore } from '@store/milkVault';
import { createVaultSettings, type MilkVaultMode } from '@api/milkVault';
import { homeApi } from '@api/home';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import MilkVaultDisclaimer from '@components/milk/MilkVaultDisclaimer';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'VaultModePicker'>;

const MARKETPLACE_ENABLED = process.env.EXPO_PUBLIC_MILK_VAULT_MARKETPLACE === '1';

export default function MilkVaultModePickerScreen({ navigation }: Props) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setSettings = useMilkVaultStore((s) => s.setSettings);
  const [saving, setSaving] = useState<MilkVaultMode | null>(null);

  const choose = async (mode: MilkVaultMode) => {
    if (!user || saving) return;
    setSaving(mode);
    try {
      const baby = await homeApi.getMyBabyProfile().catch(() => null);
      const settings = await createVaultSettings({ user_id: user.id, baby_id: baby?.id ?? null, mode });
      setSettings(settings);
      navigation.replace('VaultHome');
    } catch (err) {
      console.error('createVaultSettings error:', err);
      Alert.alert(t('milkVault.errorTitle'), t('milkVault.errorBody'));
      setSaving(null);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{t('milkVault.eyebrow')}</Text>
        <Text style={styles.title}>{t('milkVault.pickerTitle')}</Text>
        <Text style={styles.subtitle}>{t('milkVault.pickerSubtitle')}</Text>

        {/* Option 1 — Personal Stash */}
        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.9}
          onPress={() => choose('personal_stash')}
          disabled={!!saving}
        >
          <Text style={styles.optionEmoji}>🍼</Text>
          <Text style={styles.optionTitle}>{t('milkVault.pickerOption1Title')}</Text>
          <Text style={styles.optionBody}>{t('milkVault.pickerOption1Body')}</Text>
          {saving === 'personal_stash' && <ActivityIndicator color={COLORS.v2_cinnamon} style={styles.spinner} />}
        </TouchableOpacity>

        {/* Option 2 — Marketplace */}
        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.9}
          onPress={() => choose('marketplace')}
          disabled={!!saving}
        >
          <Text style={styles.optionEmoji}>🤝</Text>
          <Text style={styles.optionTitle}>{t('milkVault.pickerOption2Title')}</Text>
          <Text style={styles.optionBody}>{t('milkVault.pickerOption2Body')}</Text>
          {!MARKETPLACE_ENABLED && (
            <Text style={styles.comingSoon}>{t('milkVault.marketplaceComingSoon')}</Text>
          )}
          {saving === 'marketplace' && <ActivityIndicator color={COLORS.v2_cinnamon} style={styles.spinner} />}
        </TouchableOpacity>

        <Text style={styles.switchNote}>{t('milkVault.pickerSwitchNote')}</Text>

        <MilkVaultDisclaimer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  eyebrow: {
    fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
    color: COLORS.v2_amber, fontFamily: FONTS.v2_mono, marginBottom: 8,
  },
  title: { fontSize: 28, lineHeight: 34, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body, marginTop: 8, marginBottom: 22 },
  optionCard: {
    backgroundColor: COLORS.v2_card, borderRadius: 20, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(217,108,136,0.16)',
  },
  optionEmoji: { fontSize: 30, marginBottom: 10 },
  optionTitle: { fontSize: 19, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, marginBottom: 6 },
  optionBody: { fontSize: 14, lineHeight: 20, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body },
  comingSoon: {
    marginTop: 12, alignSelf: 'flex-start', fontSize: 11, letterSpacing: 0.6,
    color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_link,
    backgroundColor: 'rgba(217,108,136,0.10)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    overflow: 'hidden',
  },
  spinner: { marginTop: 12, alignSelf: 'flex-start' },
  switchNote: { fontSize: 12.5, lineHeight: 18, color: COLORS.v2_amber, fontFamily: FONTS.v2_body, marginTop: 4, textAlign: 'center' },
});
