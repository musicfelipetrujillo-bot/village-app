// V6 Milk Vault — first-open mode picker.
//
// "What are you using Milk Vault for?" → Personal Stash vs Marketplace.
// Reachable again from Settings to switch modes later.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { VaultScreen, VaultHeader, EthicalBanner } from '@components/milkVault/VaultUI';
import { useMilkVaultStore } from '@store/milkVault';
import { chooseMode, type VaultMode } from '@api/milkVault';
import { success } from '@utils/haptics';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultModePicker'>;

export default function MilkVaultModePickerScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<MilkStackParamList, 'MilkVaultModePicker'>>();
  const isSwitching = route.params?.switching ?? false;
  const setSettings = useMilkVaultStore((s) => s.setSettings);
  const [choice, setChoice] = useState<VaultMode>('personal_stash');
  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    setSaving(true);
    try {
      const settings = await chooseMode(choice);
      setSettings(settings);
      success();
      nav.replace('MilkVaultDashboard');
    } catch (err) {
      console.error('[milkVault] chooseMode', err);
      Alert.alert('Something went wrong', 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader
          eyebrow="Milk Vault"
          title="What are you using Milk Vault for?"
          onBack={isSwitching ? () => nav.goBack() : undefined}
        />

        <View style={styles.body}>
          <ModeCard
            emoji="🧊"
            title="Track my baby's freezer stash"
            body="Log every bag and watch your reserve grow. See how many days you're covered and hit your stash goal."
            selected={choice === 'personal_stash'}
            onPress={() => setChoice('personal_stash')}
          />
          <ModeCard
            emoji="💛"
            title="Track my stash and explore selling or donating extra milk"
            body="Everything in personal tracking, plus a reserve-first way to plan sharing or selling the milk beyond what your baby needs."
            selected={choice === 'marketplace'}
            onPress={() => setChoice('marketplace')}
          />

          <EthicalBanner text="Villie helps you protect your baby's reserve first. Selling or donating extra milk is always optional — you can switch modes anytime." />
        </View>

        <View style={styles.footer}>
          <PrimaryCTA
            label={saving ? 'Setting up…' : 'Continue'}
            onPress={onContinue}
            loading={saving}
          />
        </View>
      </SafeAreaView>
    </VaultScreen>
  );
}

function ModeCard({
  emoji, title, body, selected, onPress,
}: { emoji: string; title: string; body: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <View style={[styles.check, selected && styles.checkActive]}>
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  card: {
    backgroundColor: COLORS.genz_bone, borderRadius: 18, padding: 18,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.16)',
  },
  cardActive: { borderColor: COLORS.genz_rose, backgroundColor: 'rgba(217,108,136,0.05)' },
  cardEmoji: { fontSize: 30, marginBottom: 8 },
  cardTitle: { fontFamily: FONTS.v3_display, fontSize: 19, lineHeight: 24, color: COLORS.genz_chestnut, paddingRight: 28 },
  cardBody: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: COLORS.genz_softink, marginTop: 6 },
  check: {
    position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.genz_clay, alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { borderColor: COLORS.genz_rose, backgroundColor: COLORS.genz_rose },
  checkMark: { color: COLORS.genz_bone, fontSize: 13, fontFamily: FONTS.v2_bold },
  footer: { padding: 16, paddingBottom: 8 },
});
