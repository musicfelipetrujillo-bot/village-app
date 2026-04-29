import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useT } from '@/i18n';
import { FONTS } from '@utils/constants';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'OnboardingComplete'>;

export default function OnboardingCompleteScreen({ navigation }: Props) {
  const t = useT();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.circleEmoji}>🤱</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Text style={styles.title}>{t('donorOnboardingComplete.title')}</Text>
        <Text style={styles.subtitle}>
          {t('donorOnboardingComplete.subtitle')}
        </Text>

        <View style={styles.summaryCard}>
          {[
            { emoji: '📋', labelKey: 'donorOnboardingComplete.rowQuestionnaire', statusKey: 'donorOnboardingComplete.statusComplete' },
            { emoji: '🏅', labelKey: 'donorOnboardingComplete.rowTrustBadge', statusKey: 'donorOnboardingComplete.statusEarned' },
            { emoji: '🥛', labelKey: 'donorOnboardingComplete.rowListing', statusKey: 'donorOnboardingComplete.statusActive' },
            { emoji: '💳', labelKey: 'donorOnboardingComplete.rowStripe', statusKey: 'donorOnboardingComplete.statusConnected' },
          ].map((item) => (
            <View key={item.labelKey} style={styles.summaryRow}>
              <Text style={styles.summaryEmoji}>{item.emoji}</Text>
              <Text style={styles.summaryLabel}>{t(item.labelKey)}</Text>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>{t('donorOnboardingComplete.statusPrefix')} {t(item.statusKey)}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.replace('MilkHome')}
        >
          <Text style={styles.doneBtnText}>{t('donorOnboardingComplete.doneCta')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#F5F0E8',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  circle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#D87530', alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#D87530', shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  circleEmoji: { fontSize: 52 },
  title: { fontSize: 30, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B5C52', textAlign: 'center', lineHeight: 23, marginBottom: 28, fontFamily: FONTS.body },
  summaryCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    width: '100%', gap: 14, marginBottom: 32,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryEmoji: { fontSize: 20, width: 28 },
  summaryLabel: { flex: 1, fontSize: 14, color: '#2C1810', fontFamily: FONTS.bodyMedium },
  summaryBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  summaryBadgeText: { fontSize: 12, color: '#2E7D32', fontFamily: FONTS.bodySemiBold },
  doneBtn: { backgroundColor: '#D87530', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  doneBtnText: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#FFF' },
});
