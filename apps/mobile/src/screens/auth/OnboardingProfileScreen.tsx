// Post-signup profile setup — postpartum stage, language, zip, insurance.
// Multi-step within a single screen (3 steps). App is postpartum-only
// (decision 2026-04-27 — hospital-discharge GTM), so TTC + trimester chips
// and the due-date input are not surfaced here.
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, PREGNANCY_STAGES } from '@utils/constants';
import {
  YolkCircle, LeafSprig, SparkleMark,
} from '@components/shared/DecorativeMarks';
import { authService } from '@/lib/auth';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useAnalytics } from '@/hooks/useAnalytics';
import { formatZipInput, isPlausibleZip } from '@utils/zip';
import { t as translate, type Lang } from '@/i18n';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import type { PregnancyStage } from 'shared/src/types/v1';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingProfile'>;

// Stage emoji + i18n key per pregnancy_stage. Labels are looked up at render
// time so the full screen reflects the language picked one step back.
const STAGE_META: Record<PregnancyStage, { labelKey: string; emoji: string }> = {
  trying:             { labelKey: 'onboarding.stageTryingFull',     emoji: '🌱' },
  first_trimester:    { labelKey: 'onboarding.stage1stFull',        emoji: '🌿' },
  second_trimester:   { labelKey: 'onboarding.stage2ndFull',        emoji: '🌺' },
  third_trimester:    { labelKey: 'onboarding.stage3rdFull',        emoji: '🌸' },
  postpartum_0_6mo:   { labelKey: 'onboarding.stagePostpartum06',   emoji: '🍃' },
  postpartum_6_12mo:  { labelKey: 'onboarding.stagePostpartum612',  emoji: '🌻' },
  postpartum_1yr_plus:{ labelKey: 'onboarding.stagePostpartum1yr',  emoji: '🌳' },
};

const TOTAL_STEPS = 3;

export default function OnboardingProfileScreen({ navigation, route }: Props) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<PregnancyStage | null>(null);
  const [zip, setZip] = useState('');
  const [insurance, setInsurance] = useState('');
  const [loading, setLoading] = useState(false);

  const user = useAuthStore((s) => s.user);
  const setProfile = useUserStore((s) => s.setProfile);
  const { trackEvent } = useAnalytics();

  // Render in whichever language the user picked one step back. We can't use
  // useT() here because users.preferred_language isn't persisted yet — handleFinish
  // is what writes it. Bind the pure t() to route.params.language instead.
  const lang: Lang = (route.params?.language ?? 'en') as Lang;
  const t = (key: string, params?: Record<string, string | number>) => translate(key, lang, params);

  // Funnel measurement: log every step impression. Drop-off between
  // step_view counts is what reveals where users abandon onboarding.
  useEffect(() => {
    trackEvent('onboarding_step_view', { step, total_steps: TOTAL_STEPS });
  }, [step, trackEvent]);

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      // Capture forward progress separately from `step_view` so we can
      // distinguish "saw step 1" from "completed step 0 and advanced".
      trackEvent('onboarding_step_advanced', {
        step,
        total_steps: TOTAL_STEPS,
        stage: stage ?? undefined,
      });
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await authService.updateProfile(user.id, {
        pregnancy_stage: stage ?? undefined,
        preferred_language: route.params?.language ?? 'en',
        insurance_provider: insurance || undefined,
        zip_code: zip || undefined,
      });
      const profile = await authService.getProfile(user.id);
      setProfile(profile);
      // Funnel terminator. `has_*` flags let us measure how many users
      // skip optional fields (zip + insurance) — useful for deciding
      // whether to drop those steps entirely.
      trackEvent('onboarding_complete', {
        stage: stage ?? undefined,
        has_zip:       !!zip,
        has_insurance: !!insurance,
      });
      // RootNavigator detects session → App tab navigator
    } catch (err: any) {
      trackEvent('onboarding_failed', {
        step,
        reason: err?.message ? String(err.message).slice(0, 120) : 'unknown',
      });
      Alert.alert(t('onboarding.errorTitle'), err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1 only blocks when the user typed a partial ZIP — empty is still
  // allowed (zip is optional).
  const zipOk = !zip || isPlausibleZip(zip);
  const canProceed =
    (step === 0 && stage !== null) ||
    (step === 1 && zipOk) ||
    (step === 2);   // insurance optional

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View
        style={styles.progressRow}
        accessibilityRole="progressbar"
        accessibilityLabel={t('onboarding.progressA11y', { current: step + 1, total: TOTAL_STEPS })}
        accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step + 1 }}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Step 0 — Pregnancy stage */}
        {step === 0 && (
          <>
            <View style={styles.heroMark}>
              <LeafSprig size={64} top={4} left={4} tint={COLORS.olive} />
            </View>
            <Text style={styles.title}>
              {t('onboarding.stageTitleLine1')}{'\n'}
              <Text style={styles.titleAccent}>{t('onboarding.stageTitleLine2')}</Text>
            </Text>
            <Text style={styles.sub}>{t('onboarding.stageSub')}</Text>
            <View style={styles.stageGrid} accessibilityRole="radiogroup">
              {PREGNANCY_STAGES.map((s) => {
                const label = t(STAGE_META[s].labelKey);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.stageCard, stage === s && styles.stageCardActive]}
                    onPress={() => setStage(s)}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: stage === s }}
                  >
                    <Text style={styles.stageEmoji}>{STAGE_META[s].emoji}</Text>
                    <Text style={[styles.stageLabel, stage === s && styles.stageLabelActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Step 1 — Location */}
        {step === 1 && (
          <>
            <View style={styles.heroMark}>
              <YolkCircle size={64} top={4} left={4} tint={COLORS.rust} opacity={0.85} />
            </View>
            <Text style={styles.title}>
              {t('onboarding.locationTitleLine1')} <Text style={styles.titleAccent}>{t('onboarding.locationTitleLine2')}</Text>
            </Text>
            <Text style={styles.sub}>{t('onboarding.locationSub')}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('onboarding.zipLabel')}</Text>
              <TextInput
                style={[styles.input, !zipOk && styles.inputError]}
                value={zip}
                onChangeText={(v) => setZip(formatZipInput(v))}
                placeholder={t('onboarding.zipPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                keyboardType="number-pad"
                maxLength={10}
                accessibilityLabel={t('onboarding.zipA11yLabel')}
                accessibilityHint={t('onboarding.zipA11yHint')}
              />
              {!zipOk ? <Text style={styles.errText}>{t('onboarding.zipHint')}</Text> : null}
            </View>
          </>
        )}

        {/* Step 2 — Insurance */}
        {step === 2 && (
          <>
            <View style={styles.heroMark}>
              <SparkleMark size={56} top={8} left={8} tint={COLORS.brownDeep} />
            </View>
            <Text style={styles.title}>
              {t('onboarding.insuranceTitleLine1')} <Text style={styles.titleAccent}>{t('onboarding.insuranceTitleLine2')}</Text>
            </Text>
            <Text style={styles.sub}>{t('onboarding.insuranceSub')}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('onboarding.insuranceLabel')}</Text>
              <TextInput
                style={styles.input}
                value={insurance}
                onChangeText={setInsurance}
                placeholder={t('onboarding.insurancePlaceholder')}
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="words"
                accessibilityLabel={t('onboarding.insuranceA11yLabel')}
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
          accessibilityRole="button"
          accessibilityLabel={
            loading
              ? t('onboarding.savingProfile')
              : step < TOTAL_STEPS - 1
              ? t('onboarding.continueA11y')
              : t('onboarding.finishA11y')
          }
          accessibilityState={{ disabled: !canProceed || loading, busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>
              {step < TOTAL_STEPS - 1 ? t('common.continue') : t('onboarding.enterVillage')}
            </Text>
          )}
        </TouchableOpacity>
        {step > 0 && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skipA11y')}
          >
            <Text style={styles.skipText}>{t('onboarding.skipForNow')}</Text>
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
  heroMark: { width: 72, height: 72, marginBottom: 16, overflow: 'hidden' },
  title: {
    fontFamily: FONTS.header,
    fontSize: 30,
    color: COLORS.textDark,
    lineHeight: 38,
    marginBottom: 8,
  },
  titleAccent: { fontFamily: FONTS.headerItalic, color: COLORS.rust },
  sub: { fontSize: 14, color: COLORS.textLight, lineHeight: 22, marginBottom: 28, fontFamily: FONTS.body },

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
  stageLabel: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: COLORS.textDark },
  stageLabelActive: { fontFamily: FONTS.bodySemiBold, color: COLORS.rust },

  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.textMid },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    fontFamily: FONTS.body,
  },
  inputError: { borderColor: COLORS.rust },
  errText: { fontSize: 12, color: COLORS.rust, marginTop: 6, fontFamily: FONTS.body },

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
    backgroundColor: COLORS.yolkLight,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: COLORS.brownDeep, fontSize: 16, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
  skipBtn: { alignItems: 'center', paddingVertical: 4 },
  skipText: { fontSize: 14, color: COLORS.textLight, fontFamily: FONTS.body },
});
