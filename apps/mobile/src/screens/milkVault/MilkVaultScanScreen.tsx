// V6 Milk Vault — AI bag scanner.
//
// Take or upload a photo of a milk bag → Claude reads ounces / pumped date /
// frozen date / handwritten notes → hand off to the Add Bag screen (as the
// editable confirmation step). Fail-open: any error drops the user into
// manual entry rather than blocking.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS } from '@utils/constants';
import { VaultScreen, VaultHeader } from '@components/milkVault/VaultUI';
import { scanBagPhoto } from '@api/milkVault';
import { tap } from '@utils/haptics';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'MilkVaultScan'>;

function mediaTypeFor(uri: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const u = uri.toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export default function MilkVaultScanScreen() {
  const nav = useNavigation<Nav>();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setPreview(asset.uri);
    if (!asset.base64) {
      Alert.alert('Could not read photo', "Let's add it manually instead.");
      nav.replace('MilkVaultAddBag', { prefill: { photo_url: asset.uri } });
      return;
    }
    setBusy(true);
    try {
      const result = await scanBagPhoto({
        image_base64: asset.base64,
        image_media_type: mediaTypeFor(asset.uri),
      });
      nav.replace('MilkVaultAddBag', {
        prefill: {
          ounces: result.ounces,
          pumped_date: result.pumped_date,
          frozen_date: result.frozen_date,
          notes: result.notes,
          photo_url: asset.uri,
          raw: result as unknown as Record<string, unknown>,
        },
      });
    } catch (err) {
      console.error('[milkVault] scan', err);
      // Fail-open to manual entry with the photo attached.
      nav.replace('MilkVaultAddBag', { prefill: { photo_url: asset.uri } });
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    tap();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to scan a bag, or add it manually.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, allowsEditing: true });
    if (!res.canceled && res.assets[0]) handleAsset(res.assets[0]);
  };

  const uploadPhoto = async () => {
    tap();
    const res = await ImagePicker.launchImageLibraryAsync({
      base64: true, quality: 0.6, allowsEditing: true,
      mediaTypes: ['images'],
    });
    if (!res.canceled && res.assets[0]) handleAsset(res.assets[0]);
  };

  return (
    <VaultScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <VaultHeader eyebrow="Scan a bag" title="Snap it, we'll read it" onBack={() => nav.goBack()} />

        <View style={styles.body}>
          <View style={styles.frame}>
            {preview ? (
              <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="cover" />
            ) : (
              <>
                <Text style={styles.frameEmoji}>🍼</Text>
                <Text style={styles.frameText}>
                  Point at the label so the ounces and dates are readable.
                </Text>
              </>
            )}
            {busy && (
              <View style={styles.busyOverlay}>
                <ActivityIndicator color={COLORS.genz_rose} />
                <Text style={styles.busyText}>Reading your bag…</Text>
              </View>
            )}
          </View>

          <View style={styles.btns}>
            <TouchableOpacity style={styles.primaryBtn} onPress={takePhoto} disabled={busy} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Take a photo">
              <Text style={styles.primaryBtnText}>📷  Take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={uploadPhoto} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Upload a photo">
              <Text style={styles.ghostBtnText}>Upload from library</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => nav.replace('MilkVaultAddBag', {})} disabled={busy} accessibilityRole="button">
              <Text style={styles.manualLink}>Enter manually instead</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            AI reading is a helper — always double-check the values before saving.
          </Text>
        </View>
      </SafeAreaView>
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 16 },
  frame: {
    flex: 1, borderRadius: 22, backgroundColor: COLORS.genz_bone, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(217,108,136,0.3)', borderStyle: 'dashed', overflow: 'hidden',
    padding: 24, marginBottom: 16,
  },
  frameEmoji: { fontSize: 44, marginBottom: 12 },
  frameText: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20, color: COLORS.genz_softink, textAlign: 'center' },
  previewImg: { ...StyleSheet.absoluteFillObject },
  busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(252,247,239,0.86)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { fontFamily: FONTS.v2_label, fontSize: 14, color: COLORS.genz_chestnut },
  btns: { gap: 10 },
  primaryBtn: { backgroundColor: COLORS.genz_rose, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONTS.v2_link, fontSize: 15, color: COLORS.genz_bone },
  ghostBtn: {
    backgroundColor: COLORS.genz_bone, borderRadius: 999, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(217,108,136,0.4)',
  },
  ghostBtnText: { fontFamily: FONTS.v2_link, fontSize: 14, color: COLORS.genz_berry },
  manualLink: { fontFamily: FONTS.v2_label, fontSize: 14, color: COLORS.genz_softink, textAlign: 'center', paddingVertical: 10 },
  disclaimer: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.genz_softink, textAlign: 'center', marginTop: 14 },
});
