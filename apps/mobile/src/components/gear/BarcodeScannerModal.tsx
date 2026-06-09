// V4 Phase G5 — Barcode scanner overlay.
//
// Full-screen modal with a live camera preview that scans UPC-A / UPC-E /
// EAN-8 / EAN-13 barcodes. Fires `onScan(upc)` once — the parent is responsible
// for dismissing the modal and handling the result.
//
// Expo Camera v17 exposes CameraView with `onBarcodeScanned`. We debounce so a
// single scan doesn't fire twice.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, FONTS } from '@utils/constants';

interface Props {
  visible: boolean;
  onScan: (upc: string) => void;
  onClose: () => void;
}

const ACCEPT_TYPES = ['upc_a', 'upc_e', 'ean13', 'ean8'] as const;

export default function BarcodeScannerModal({ visible, onScan, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const firedRef = useRef(false);

  // Reset when reopened.
  useEffect(() => {
    if (visible) { setScanned(false); firedRef.current = false; }
  }, [visible]);

  // Ask for permission on open.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleScan = useCallback((result: { data: string; type: string }) => {
    if (firedRef.current) return;
    const cleaned = (result.data ?? '').replace(/\D/g, '');
    if (cleaned.length < 8) return;
    firedRef.current = true;
    setScanned(true);
    onScan(cleaned);
  }, [onScan]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {!permission ? (
          <View style={styles.center}><ActivityIndicator color="#FFFCF6" /></View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permTxt}>
              We need camera access to scan barcodes. You can still list manually.
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnTxt}>Grant access</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...ACCEPT_TYPES] }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />
        )}

        {/* Reticle */}
        <View style={styles.reticle} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View style={styles.hintBar} pointerEvents="none">
          <Text style={styles.hint}>Line up the barcode inside the box</Text>
        </View>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} accessibilityRole="button">
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const RETICLE_SIZE = 240;
const CORNER = 28;
const BORDER = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  topBar: {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16,
  },
  cancelBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14,
  },
  cancelTxt: { color: '#FFFCF6', fontSize: 14, fontFamily: FONTS.bodySemiBold },

  reticle: {
    position: 'absolute',
    top: '50%', left: '50%',
    width: RETICLE_SIZE, height: RETICLE_SIZE,
    marginTop: -RETICLE_SIZE / 2, marginLeft: -RETICLE_SIZE / 2,
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#FFF' },
  cornerTL: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  cornerTR: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },

  hintBar: {
    position: 'absolute',
    bottom: 140, left: 0, right: 0, alignItems: 'center',
  },
  hint: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#FFFCF6', fontSize: 13, fontFamily: FONTS.bodySemiBold,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
  },

  permTxt: { color: '#FFFCF6', fontSize: 14, textAlign: 'center', marginBottom: 18, lineHeight: 20, fontFamily: FONTS.body },
  permBtn: { backgroundColor: '#D96C88', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  permBtnTxt: { color: '#FFFCF6', fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
