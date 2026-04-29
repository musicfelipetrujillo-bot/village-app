import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useMilkStore } from '@store/milk';
import { createDonorProfile } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import {
  YolkCircle, YolkRing, LeafSprig, SparkleMark,
} from '@components/shared/DecorativeMarks';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

const { width: SCREEN_W } = Dimensions.get('window');

type Props = NativeStackScreenProps<MilkStackParamList, 'BecomeDonorIntro'>;

type StepMarkKind = 'leafSprig' | 'sparkle' | 'yolkCircle' | 'yolkRing';
const STEPS: Array<{ mark: StepMarkKind; markTint: string; titleKey: string; bodyKey: string }> = [
  { mark: 'leafSprig',  markTint: COLORS.olive,     titleKey: 'becomeDonor.step1Title', bodyKey: 'becomeDonor.step1Body' },
  { mark: 'sparkle',    markTint: COLORS.brownDeep, titleKey: 'becomeDonor.step2Title', bodyKey: 'becomeDonor.step2Body' },
  { mark: 'yolkCircle', markTint: COLORS.rust,      titleKey: 'becomeDonor.step3Title', bodyKey: 'becomeDonor.step3Body' },
  { mark: 'yolkRing',   markTint: COLORS.rust,      titleKey: 'becomeDonor.step4Title', bodyKey: 'becomeDonor.step4Body' },
];

function StepMark({ kind, tint }: { kind: StepMarkKind; tint: string }) {
  return (
    <View style={styles.markWrap}>
      {kind === 'leafSprig'  && <LeafSprig  size={84} top={6} left={6} tint={tint} />}
      {kind === 'sparkle'    && <SparkleMark size={72} top={12} left={12} tint={tint} />}
      {kind === 'yolkCircle' && <YolkCircle size={84} top={6} left={6} tint={tint} opacity={0.85} />}
      {kind === 'yolkRing'   && <YolkRing   size={80} top={8} left={8} tint={tint} />}
    </View>
  );
}

export default function BecomeDonorIntroScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { setDonorProfile } = useMilkStore();
  const t = useT();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToStep = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const handleStart = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const profile = await createDonorProfile({
        user_id: user.id,
        display_name: user.user_metadata?.full_name ?? 'Village Donor',
        city: user.user_metadata?.city,
        state: user.user_metadata?.state,
      });
      setDonorProfile(profile);
      navigation.replace('DonorQuestionnaire');
    } catch (err) {
      console.error('createDonorProfile error:', err);
    } finally {
      setCreating(false);
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View style={styles.container}>
      {/* Back */}
      <TouchableOpacity
        style={styles.back}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel={t('becomeDonor.back')}
      >
        <Text style={styles.backText}>{t('becomeDonor.backLabel')}</Text>
      </TouchableOpacity>

      {/* Progress dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <StepMark kind={current.mark} tint={current.markTint} />
        <Text style={styles.title}>{t(current.titleKey)}</Text>
        <Text style={styles.body}>{t(current.bodyKey)}</Text>
      </Animated.View>

      {/* Earnings callout on first step */}
      {step === 0 && (
        <View style={styles.earningsCard}>
          <Text style={styles.earningsNum}>{t('becomeDonor.earningsNum')}</Text>
          <Text style={styles.earningsLabel}>{t('becomeDonor.earningsLabel')}</Text>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.footer}>
        {!isLast ? (
          <TouchableOpacity style={styles.nextBtn} onPress={() => goToStep(step + 1)}>
            <Text style={styles.nextBtnText}>{t('becomeDonor.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, creating && styles.disabled]}
            onPress={handleStart}
            disabled={creating}
          >
            <Text style={styles.nextBtnText}>
              {creating ? t('becomeDonor.settingUp') : t('becomeDonor.letsStart')}
            </Text>
          </TouchableOpacity>
        )}
        {step > 0 && (
          <TouchableOpacity style={styles.prevBtn} onPress={() => goToStep(step - 1)}>
            <Text style={styles.prevBtnText}>{t('becomeDonor.previous')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8', paddingHorizontal: 28 },
  back: { marginTop: 56, marginBottom: 16 },
  backText: { fontSize: 15, color: '#9A8070', fontFamily: FONTS.bodyMedium },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 48 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0D5C5' },
  dotActive: { width: 24, backgroundColor: '#D87530' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  markWrap: { width: 96, height: 96, marginBottom: 28, overflow: 'hidden' },
  title: { fontSize: 26, fontFamily: FONTS.bodySemiBold, color: '#2C1810', textAlign: 'center', marginBottom: 16, lineHeight: 33 },
  body: { fontSize: 16, color: '#6B5C52', textAlign: 'center', lineHeight: 25, fontFamily: FONTS.body },
  earningsCard: {
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#F0D9C8',
  },
  earningsNum: { fontSize: 36, fontFamily: FONTS.bodySemiBold, color: '#D87530', marginBottom: 4 },
  earningsLabel: { fontSize: 13, color: '#9A8070', textAlign: 'center', fontFamily: FONTS.bodyMedium },
  footer: { paddingBottom: 48, gap: 12 },
  nextBtn: { backgroundColor: '#D87530', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#FFF' },
  prevBtn: { alignItems: 'center', paddingVertical: 8 },
  prevBtnText: { fontSize: 15, color: '#9A8070', fontFamily: FONTS.bodyMedium },
  disabled: { opacity: 0.6 },
});
