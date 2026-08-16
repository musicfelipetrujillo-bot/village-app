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
import { VaultScreen } from '@components/milkVault/VaultUI';
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
        {/* Clean, minimal header — no eyebrow, no loud "snap it" title
            (founder 2026-08-16: keep it consistent + elevated). */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>add a bag</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.body}>
          <View style={styles.frame}>
            {preview ? (
              <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="cover" />
            ) : (
              <View style={styles.frameEmpty}>
                <Text style={styles.frameEmoji}>🍼</Text>
                <Text style={styles.frameText}>point at the label so the ounces and dates are readable</Text>
              </View>
            )}
            {busy && (
              <View style={styles.busyOverlay}>
                <ActivityIndicator color={COLORS.genz_rose} />
                <Text style={styles.busyText}>reading your bag…</Text>
              </View>
            )}
          </View>

          <View style={styles.btns}>
            <TouchableOpacity style={styles.primaryBtn} onPress={takePhoto} disabled={busy} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Take a photo">
              <Text style={styles.primaryBtnText}>take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={uploadPhoto} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Upload a photo">
              <Text style={styles.ghostBtnText}>upload from library</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => nav.replace('MilkVaultAddBag', {})} disabled={busy} accessibilityRole="button" accessibilityLabel="Enter manually">
              <Text style={styles.manualLink}>enter manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  back: { fontSize: 30, color: COLORS.genz_berry, marginTop: -4, width: 30 },
  title: { fontFamily: FONTS.v2_display, fontSize: 18, color: COLORS.genz_chestnut, letterSpacing: -0.3 },

  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 8 },
  // Elevated, clean scan card — soft shadow + hairline border (no loud dashed frame).
  frame: {
    flex: 1, borderRadius: 26, backgroundColor: COLORS.genz_bone, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: 28, marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,108,136,0.22)',
    shadowColor: '#7A4A24', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 22, elevation: 3,
  },
  frameEmpty: { alignItems: 'center', paddingHorizontal: 12 },
  frameEmoji: { fontSize: 46, marginBottom: 14 },
  frameText: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, color: COLORS.genz_softink, textAlign: 'center' },
  previewImg: { ...StyleSheet.absoluteFillObject },
  busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(252,247,239,0.9)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { fontFamily: FONTS.v2_label, fontSize: 14, color: COLORS.genz_chestnut },
  btns: { gap: 11 },
  primaryBtn: { backgroundColor: COLORS.genz_rose, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONTS.v2_link, fontSize: 15, color: COLORS.genz_bone, letterSpacing: 0.2 },
  ghostBtn: {
    backgroundColor: COLORS.genz_bone, borderRadius: 999, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(217,108,136,0.4)',
  },
  ghostBtnText: { fontFamily: FONTS.v2_link, fontSize: 14, color: COLORS.genz_berry },
  manualLink: { fontFamily: FONTS.v2_label, fontSize: 13.5, color: COLORS.genz_softink, textAlign: 'center', paddingVertical: 10, marginTop: 2 },
});
