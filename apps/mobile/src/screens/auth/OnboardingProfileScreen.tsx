// Post-signup profile setup — pregnancy stage, due date, language, zip, insurance
// Multi-step within a single screen (4 steps)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, PREGNANCY_STAGES } from '@utils/constants';
import { authService } from '@/lib/auth';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import type { PregnancyStage } from 'shared/src/types/v1';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingProfile'>;

const STAGE_LABELS: Record<PregnancyStage, { label: string; emoji: string }> = {
  trying:            { label: 'Trying to conceive',   emoji: '🌱' },
  first_trimester:   { label: '1st Trimester (0–13w)', emoji: '🌿' },
  second_trimester:  { label: '2nd Trimester (14–27w)',emoji: '🌺' },
  third_trimester:   { label: '3rd Trimester (28–40w)',emoji: '🌸' },
  postpartum_0_6mo:  { label: 'Postpartum · 0–6 mo',  emoji: '🍃' },
  postpartum_6_12mo: { label: 'Postpartum · 6–12 mo', emoji: '🌻' },
  postpartum_1yr_plus:{ label: 'Postpartum · 1yr+',   emoji: '🌳' },
};

const TOTAL_STEPS = 3;

export default function OnboardingProfileScreen({ navigation, route }: Props) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<PregnancyStage | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [zip, setZip] = useState('');
  const [insurance, setInsurance] = useState('');
  const [loading, setLoading] = useState(false);

  const user = useAuthStore((s) => s.user);
  const setProfile = useUserStore((s) => s.setProfile);

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await authService.updateProfile(user.id, {
        pregnancy_stage: stage ?? undefined,
        due_date: dueDate || undefined,
        preferred_language: route.params?.language ?? 'en',
        insurance_provider: insurance || undefined,
        zip_code: zip || undefined,
      });
      const profile = await authService.getProfile(user.id);
      setProfile(profile);
      // RootNavigator detects session → App tab navigator
    } catch (err: any) {
      Alert.alert('Error saving profile', err.message);
    } finally {
      setLoading(false);
    }
  };

  const canProceed =
    (step === 0 && stage !== null) ||
    (step === 1) || // zip optional
    (step === 2);   // insurance optional

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Step 0 — Pregnancy stage */}
        {step === 0 && (
          <>
            <Text style={styles.emoji}>🌿</Text>
            <Text style={styles.title}>
              Where are you in your{'\n'}
              <Text style={styles.titleAccent}>journey?</Text>
            </Text>
            <Text style={styles.sub}>We'll personalize your experience around your stage.</Text>
            <View style={styles.stageGrid}>
              {PREGNANCY_STAGES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stageCard, stage === s && styles.stageCardActive]}
                  onPress={() => setStage(s)}
                >
                  <Text style={styles.stageEmoji}>{STAGE_LABELS[s].emoji}</Text>
                  <Text style={[styles.stageLabel, stage === s && styles.stageLabelActive]}>
                    {STAGE_LABELS[s].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Step 1 — Location */}
        {step === 1 && (
          <>
            <Text style={styles.emoji}>📍</Text>
            <Text style={styles.title}>
              Your <Text style={styles.titleAccent}>location</Text>
            </Text>
            <Text style={styles.sub}>
              We use your zip code to find nearby donors, specialists, and events.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Zip code</Text>
              <TextInput
                style={styles.input}
                value={zip}
                onChangeText={setZip}
                placeholder="33131"
                placeholderTextColor={COLORS.textLight}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            {(stage === 'first_trimester' ||
              stage === 'second_trimester' ||
              stage === 'third_trimester') && (
              <View style={[styles.inputGroup, { marginTop: 16 }]}>
                <Text style={styles.label}>Due date (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}
          </>
        )}

        {/* Step 2 — Insurance */}
        {step === 2 && (
          <>
            <Text style={styles.emoji}>🏥</Text>
            <Text style={styles.title}>
              Your <Text style={styles.titleAccent}>insurance</Text>
            </Text>
            <Text style={styles.sub}>
              We'll show you specialists who accept your plan. You can skip this.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Insurance provider (optional)</Text>
              <TextInput
                style={styles.input}
                value={insurance}
                onChangeText={setInsurance}
                placeholder="e.g. Blue Cross, Aetna, Medicaid"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="words"
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.btn, (!canProceed || loading) && styles.btnDisabled]}
          onPress={goNext}
          disabled={!canProceed || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>
              {step < TOTAL_STEPS - 1 ? 'Continue' : 'Enter The Village →'}
            </Text>
          )}
        </TouchableOpacity>
        {step > 0 && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 20,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    flex: 1,
    maxWidth: 60,
  },
  dotActive: { backgroundColor: COLORS.rust },

  content: { padding: 28, paddingTop: 24, paddingBottom: 120 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontFamily: 'serif',
    fontSize: 30,
    color: COLORS.textDark,
    lineHeight: 38,
    marginBottom: 8,
  },
  titleAccent: { color: COLORS.rust, fontStyle: 'italic' },
  sub: { fontSize: 14, color: COLORS.textLight, lineHeight: 22, marginBottom: 28 },

  stageGrid: { gap: 10 },
  stageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stageCardActive: { borderColor: COLORS.rust, backgroundColor: '#FFF5F2' },
  stageEmoji: { fontSize: 24 },
  stageLabel: { fontSize: 14, fontWeight: '500', color: COLORS.textDark },
  stageLabelActive: { fontWeight: '700', color: COLORS.rust },

  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMid },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: COLORS.cream,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: 10,
  },
  btn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 4 },
  skipText: { fontSize: 14, color: COLORS.textLight },
});
