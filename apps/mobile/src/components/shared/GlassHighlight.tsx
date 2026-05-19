// V9 hero glass sheen — extracted from HomeScreen 2026-05-16 for re-use
// across detail-screen hero cards (SpecialistProfile, DonorProfile,
// GearListingDetail). Two-stop top sheen + 1px hairline cap.
//
// Usage: insert as the FIRST child of a lifted card (or right after deep-bg
// decoratives like yolks). Subsequent children paint over it via DOM order.
// No zIndex — render order is the contract.
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

export function GlassHighlight({
  radius,
  height = 14,
}: {
  radius: number;
  height?: number;
}) {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(255,255,255,0.7)',
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        }}
      />
    </>
  );
}
