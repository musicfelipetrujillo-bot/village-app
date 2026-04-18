// V1 Phase 3 — built with Favorites + Reviews phase
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@utils/constants';

export default function ReviewSubmitScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Review form — coming in Phase 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 14, color: COLORS.textLight },
});
