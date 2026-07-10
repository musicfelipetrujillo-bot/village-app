// V6 Milk Vault — all bags list + rotation.
//
// Oldest-first (use-first-in). Tap a bag to mark it used / expired (both
// modes) or sold / donated (marketplace only), which moves it out of the
// freezer and records a ledger transaction. Delete removes a mistaken entry.

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';
import { VaultScreen, VaultHeader } from '@components/milkVault/VaultUI';
import { useMilkVaultStore } from '@store/milkVault';
import { recordBagOutcome, deleteBag, updateBag, type MilkVaultBag, type VaultTransactionType } from '@api/milkVault';
import { shortDate } from '@utils/milkVaultInsights';
import { IN_FREEZER_STATUSES } from '@utils/milkVaultCalc';
import { success } from '@utils/haptics';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultBags'>;

const STATUS_LABELS: Record<string, string> = {
  stored: 'In freezer', reserved: 'Reserved', available: 'Available',
  sold: 'Sold', donated: 'Donated', used: 'Used', expired: 'Expired',
};

export default function MilkVaultBagsScreen() {
  const nav = useNavigation<Nav>();
  const { bags, settings, fetchAll } = useMilkVaultStore();
  const isMarketplace = settings?.mode === 'marketplace';

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const sorted = useMemo(() => {
    const inFreezer = (s: string) => (IN_FREEZER_STATUSES as readonly string[]).includes(s);
    return [...bags].sort((a, b) => {
      // In-freezer first, then oldest frozen_at first.
      const af = inFreezer(a.status) ? 0 : 1;
      const bf = inFreezer(b.status) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.frozen_at.localeCompare(b.frozen_at);
    });
  }, [bags]);

  const onOutcome = async (bag: MilkVaultBag, type: VaultTransactionType) => {
    try {
      await recordBagOutcome(bag, type, {
        pricePerOz: type === 'sold' ? settings?.price_per_oz ?? null : null,
      });
      await fetchAll();
      success();
    } catch (err) {
      console.error('[milkVault] outcome', err);
      Alert.alert('Could not update', 'Please try again.');
    }
  };

  const onRestore = async (bag: MilkVaultBag) => {
    try { await updateBag(bag.id, { status: 'stored' }); await fetchAll(); }
    catch (err) { console.error('[milkVault] restore', err); }
  };

  const onDelete = async (bag: MilkVaultBag) => {
    try { await deleteBag(bag.id); await fetchAll(); success(); }
    catch (err) { console.error('[milkVault] delete', err); Alert.alert('Could not delete', 'Please try again.'); }
  };

  const openActions = (bag: MilkVaultBag) => {
    const inFreezer = (IN_FREEZER_STATUSES as readonly string[]).includes(bag.status);
    const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (inFreezer) {
      buttons.push({ text: 'Mark used by baby', onPress: () => onOutcome(bag, 'used') });
      if (isMarketplace) {
        buttons.push({ text: 'Mark sold', onPress: () => onOutcome(bag, 'sold') });
        buttons.push({ text: 'Mark donated', onPress: () => onOutcome(bag, 'donated') });
      }
      buttons.push({ text: 'Mark expired', onPress: () => onOutcome(bag, 'expired') });
    } else {
      buttons.push({ text: 'Restore to freezer', onPress: () => onRestore(bag) });
    }
    buttons.push({ text: 'Delete bag', style: 'destructive', onPress: () => onDelete(bag) });
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(`${bag.ounces} oz · frozen ${shortDate(bag.frozen_at)}`, bag.notes || undefined, buttons);
  };

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader eyebrow="Your bags" title="Use oldest first" onBack={() => nav.goBack()} />
        <FlatList
          data={sorted}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🧊</Text>
              <Text style={styles.emptyTitle}>No bags yet</Text>
              <Text style={styles.emptyBody}>Add your first bag to start tracking your freezer stash.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const inFreezer = (IN_FREEZER_STATUSES as readonly string[]).includes(item.status);
            return (
              <TouchableOpacity style={[styles.row, !inFreezer && styles.rowMuted]} onPress={() => openActions(item)} activeOpacity={0.85}>
                {inFreezer && index === 0 && (
                  <View style={styles.nextTag}><Text style={styles.nextTagText}>NEXT</Text></View>
                )}
                <View style={styles.oz}>
                  <Text style={styles.ozText}>{item.ounces}</Text>
                  <Text style={styles.ozUnit}>oz</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.date}>Frozen {shortDate(item.frozen_at)}</Text>
                  <Text style={styles.meta}>Pumped {shortDate(item.pumped_at)} · {STATUS_LABELS[item.status]}</Text>
                  {item.notes ? <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text> : null}
                </View>
                <Text style={styles.dots}>⋯</Text>
              </TouchableOpacity>
            );
          }}
        />
        <View style={styles.footer}>
          <PrimaryCTA label="＋ Add a milk bag" onPress={() => nav.navigate('MilkVaultAddBag', {})} />
        </View>
      </SafeAreaView>
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.genz_bone,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.14)',
  },
  rowMuted: { opacity: 0.55 },
  nextTag: { position: 'absolute', top: -6, left: 10, backgroundColor: COLORS.genz_rose, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  nextTagText: { fontFamily: FONTS.v2_mono, fontSize: 8, letterSpacing: 1, color: COLORS.genz_bone },
  oz: { width: 54, height: 54, borderRadius: 12, backgroundColor: COLORS.genz_blush, alignItems: 'center', justifyContent: 'center' },
  ozText: { fontFamily: FONTS.v2_display_big, fontSize: 20, color: COLORS.genz_chestnut },
  ozUnit: { fontFamily: FONTS.v2_label, fontSize: 10, color: COLORS.genz_softink, marginTop: -2 },
  date: { fontFamily: FONTS.v2_label, fontSize: 15, color: COLORS.genz_chestnut },
  meta: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: COLORS.genz_softink, marginTop: 2 },
  notes: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: COLORS.genz_softink, marginTop: 2, fontStyle: 'italic' },
  dots: { fontSize: 22, color: COLORS.genz_clay, paddingHorizontal: 4 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: FONTS.v3_display, fontSize: 20, color: COLORS.genz_chestnut, marginTop: 12 },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, color: COLORS.genz_softink, textAlign: 'center', marginTop: 6 },
  footer: { padding: 16, paddingBottom: 8 },
});
