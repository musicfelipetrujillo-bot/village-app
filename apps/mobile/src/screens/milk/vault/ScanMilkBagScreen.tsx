import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { scanMilkBag } from '@api/milkVault';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'VaultScanBag'>;

async function toBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = typeof reader.result === 'string' ? reader.result : '';
      const comma = r.indexOf(',');
      resolve(comma >= 0 ? r.slice(comma + 1) : r);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function mediaType(uri: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const u = uri.toLowerCase();
  return u.endsWith('.png') ? 'image/png' : u.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
}

export default function ScanMilkBagScreen({ navigation }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const handle = async (uri: string) => {
    setBusy(true);
    try {
      const base64 = await toBase64(uri);
      const extraction = await scanMilkBag({ image_base64: base64, image_media_type: mediaType(uri) });
      // Hand extracted fields (may be empty in stub mode) to the confirmation form.
      navigation.replace('VaultAddBag', {
        photoUri: uri,
        prefill: {
          ounces: extraction.ounces ?? undefined,
          pumped_at: extraction.pumped_at ?? undefined,
          frozen_at: extraction.frozen_at ?? undefined,
          notes: extraction.notes ?? undefined,
          ai_extracted_data: extraction,
        },
      });
    } catch (err) {
      console.error('scanMilkBag error:', err);
      Alert.alert(t('milkVault.scanErrTitle'), t('milkVault.scanErrBody'));
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('milkVault.cameraPermTitle'), t('milkVault.cameraPermBody')); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    handle(result.assets[0].uri);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('milkVault.photosPermTitle'), t('milkVault.photosPermBody')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    handle(result.assets[0].uri);
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.emoji}>📷</Text>
        <Text style={styles.title}>{t('milkVault.scanTitle')}</Text>
        <Text style={styles.subtitle}>{t('milkVault.scanSubtitle')}</Text>

        {busy ? (
          <View style={styles.busyBox}>
            <ActivityIndicator color={COLORS.v2_cinnamon} />
            <Text style={styles.busyText}>{t('milkVault.scanReading')}</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.cta} onPress={takePhoto}>
              <Text style={styles.ctaText}>{t('milkVault.scanTakePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={pickPhoto}>
              <Text style={styles.ctaSecondaryText}>{t('milkVault.scanChoosePhoto')}</Text>
            </TouchableOpacity>
            <Text style={styles.reassure}>{t('milkVault.scanReassure')}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  content: { padding: 20, paddingTop: 60, paddingBottom: 48 },
  back: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_link, marginBottom: 20 },
  emoji: { fontSize: 40, textAlign: 'center', marginTop: 24 },
  title: { fontSize: 26, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_display, textAlign: 'center', marginTop: 12, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  cta: { backgroundColor: COLORS.v2_cinnamon, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: COLORS.v2_card, fontSize: 16, fontFamily: FONTS.v2_link },
  ctaSecondary: {
    marginTop: 12, backgroundColor: COLORS.v2_card, borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(217,108,136,0.30)',
  },
  ctaSecondaryText: { color: COLORS.v2_cinnamon, fontSize: 16, fontFamily: FONTS.v2_link },
  reassure: { fontSize: 12.5, lineHeight: 18, color: COLORS.v2_amber, fontFamily: FONTS.v2_body, textAlign: 'center', marginTop: 18 },
  busyBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  busyText: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body },
});
