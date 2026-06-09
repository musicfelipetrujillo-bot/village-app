import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useT } from '@/i18n';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { success } from '@utils/haptics';
import { useMilkStore } from '@store/milk';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'OnboardingComplete'>;

export default function OnboardingCompleteScreen({ navigation }: Props) {
  const t = useT();
  const donorProfileId = useMilkStore((s) => s.donorProfile?.id) ?? null;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    success();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
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

        {/* Optional credibility step — surface social links right after setup. */}
        {donorProfileId && (
          <TouchableOpacity
            style={styles.socialLink}
            onPress={() => navigation.navigate('DonorSocialLinks', { donorProfileId })}
            accessibilityRole="button"
            accessibilityLabel={t('donorOnboardingComplete.addSocialsCta')}
          >
            <Text style={styles.socialLinkText}>{t('donorOnboardingComplete.addSocialsCta')}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  circle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: COLORS.coco, alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    shadowColor: COLORS.coco, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  circleEmoji: { fontSize: 52 },
  // v9 — Playfair Bold roman title
  title: { fontSize: 30, fontFamily: FONTS.headerBold, color: '#43260F', marginBottom: 12, textAlign: 'center', letterSpacing: -0.5, lineHeight: 36 },
  subtitle: { fontSize: 15, color: '#7A4A24', textAlign: 'center', lineHeight: 23, marginBottom: 28, fontFamily: FONTS.body },
  summaryCard: {
    backgroundColor: COLORS.paper, borderRadius: 16, padding: 20,
    width: '100%', gap: 14, marginBottom: 32,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryEmoji: { fontSize: 20, width: 28 },
  summaryLabel: { flex: 1, fontSize: 14, color: '#43260F', fontFamily: FONTS.bodyMedium },
  summaryBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  summaryBadgeText: { fontSize: 12, color: COLORS.statusSuccess, fontFamily: FONTS.bodySemiBold },
  // v9 canonical CTA — rect variant
  doneBtn: {
    backgroundColor: '#D96C88', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40,
    shadowColor: '#D96C88', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  doneBtnText: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#FFFCF6' },
  socialLink: { marginTop: 16, paddingVertical: 8 },
  socialLinkText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#D96C88' },
});
