// V4 Phase D1 — built after V1, V2, V3 are live
// See docs/MASTER_PLAN.md § V4 — Screen Architecture > HomeStack
import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@utils/constants';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'serif', fontSize: 24, color: COLORS.textDark }}>The Village</Text>
      <Text style={{ fontSize: 13, color: COLORS.textLight, marginTop: 8 }}>Home — coming in V4</Text>
    </View>
  );
}
