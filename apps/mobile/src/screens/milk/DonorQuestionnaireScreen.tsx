import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMilkStore } from '@store/milk';
import { upsertQuestionnaireResponses, callQuestionnaireCoach, callSafetyScreener } from '@api/milk';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'DonorQuestionnaire'>;

type QuestionType = 'yesno' | 'select';

interface Question {
  key: string;
  text: string;
  textKey: string;
  type: QuestionType;
  options?: string[];
  optionKeys?: string[];
}

const QUESTIONS: Question[] = [
  {
    key: 'breastfeeding_duration',
    text: 'How long have you been breastfeeding or pumping?',
    textKey: 'donorQuestionnaire.qBreastfeedingDuration',
    type: 'select',
    options: ['Less than 1 month', '1–3 months', '3–6 months', '6–12 months', 'Over 12 months'],
    optionKeys: [
      'donorQuestionnaire.qBreastfeedingOpt1',
      'donorQuestionnaire.qBreastfeedingOpt2',
      'donorQuestionnaire.qBreastfeedingOpt3',
      'donorQuestionnaire.qBreastfeedingOpt4',
      'donorQuestionnaire.qBreastfeedingOpt5',
    ],
  },
  {
    key: 'smoking',
    text: 'Do you currently smoke, vape, or use any tobacco or nicotine products?',
    textKey: 'donorQuestionnaire.qSmoking',
    type: 'yesno',
  },
  {
    key: 'alcohol',
    text: 'How often do you consume alcohol?',
    textKey: 'donorQuestionnaire.qAlcohol',
    type: 'select',
    options: ['Never', 'Rarely (special occasions only)', '1–2 drinks per week', 'More than 2 drinks per week'],
    optionKeys: [
      'donorQuestionnaire.qAlcoholOpt1',
      'donorQuestionnaire.qAlcoholOpt2',
      'donorQuestionnaire.qAlcoholOpt3',
      'donorQuestionnaire.qAlcoholOpt4',
    ],
  },
  {
    key: 'prescription_medications',
    text: 'Are you currently taking any prescription medications?',
    textKey: 'donorQuestionnaire.qPrescriptionMeds',
    type: 'yesno',
  },
  {
    key: 'supplements',
    text: 'Do you take any supplements, vitamins, or herbal remedies?',
    textKey: 'donorQuestionnaire.qSupplements',
    type: 'yesno',
  },
  {
    key: 'infectious_illness',
    text: 'Have you had any infectious illness (COVID, flu, mastitis) in the past 30 days?',
    textKey: 'donorQuestionnaire.qInfectiousIllness',
    type: 'yesno',
  },
  {
    key: 'bloodborne_pathogens',
    text: 'Have you ever tested positive for HIV, Hepatitis B, Hepatitis C, or HTLV?',
    textKey: 'donorQuestionnaire.qBloodbornePathogens',
    type: 'yesno',
  },
  {
    key: 'caffeine',
    text: 'How much caffeine do you consume daily?',
    textKey: 'donorQuestionnaire.qCaffeine',
    type: 'select',
    options: ['None', 'Under 200mg (1–2 coffees)', '200–400mg (2–4 coffees)', 'Over 400mg'],
    optionKeys: [
      'donorQuestionnaire.qCaffeineOpt1',
      'donorQuestionnaire.qCaffeineOpt2',
      'donorQuestionnaire.qCaffeineOpt3',
      'donorQuestionnaire.qCaffeineOpt4',
    ],
  },
  {
    key: 'recreational_drugs',
    text: 'Do you use marijuana, CBD, or any recreational substances?',
    textKey: 'donorQuestionnaire.qRecreationalDrugs',
    type: 'yesno',
  },
  {
    key: 'vaccinations',
    text: 'Have you received any vaccines in the past 30 days?',
    textKey: 'donorQuestionnaire.qVaccinations',
    type: 'yesno',
  },
  {
    key: 'storage_practices',
    text: 'How do you store your expressed milk before sharing?',
    textKey: 'donorQuestionnaire.qStoragePractices',
    type: 'select',
    options: [
      'Freeze immediately in sterile bags',
      'Refrigerate then freeze within 24h',
      'Refrigerate (share within 4 days)',
      'Other',
    ],
    optionKeys: [
      'donorQuestionnaire.qStorageOpt1',
      'donorQuestionnaire.qStorageOpt2',
      'donorQuestionnaire.qStorageOpt3',
      'donorQuestionnaire.qStorageOpt4',
    ],
  },
  {
    key: 'bloodwork_consent',
    text: 'Are you willing to share bloodwork results for our Verified Bloodwork badge? This significantly increases recipient trust.',
    textKey: 'donorQuestionnaire.qBloodworkConsent',
    type: 'yesno',
  },
];

interface CoachResponse {
  why_it_matters: string;
  concern: string | null;
}

export default function DonorQuestionnaireScreen({ navigation }: Props) {
  const { donorProfile, setTrustBadge } = useMilkStore();
  const t = useT();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const question = QUESTIONS[currentIndex];
  const totalQ = QUESTIONS.length;
  const progress = currentIndex / totalQ;

  const selectedAnswer = answers[question.key];

  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleAnswer = async (answer: string) => {
    setAnswers((prev) => ({ ...prev, [question.key]: answer }));
    setCoach(null);
    setLoadingCoach(true);

    // Fetch AI coach guidance (non-blocking UX)
    callQuestionnaireCoach(question.key, question.text, answer)
      .then(setCoach)
      .catch(() => {})
      .finally(() => setLoadingCoach(false));
  };

  const handleNext = () => {
    if (currentIndex < totalQ - 1) {
      animateTransition(() => {
        setCurrentIndex((i) => i + 1);
        setCoach(null);
      });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      animateTransition(() => {
        setCurrentIndex((i) => i - 1);
        setCoach(null);
      });
    }
  };

  const handleSubmit = async () => {
    if (!donorProfile) return;
    setSubmitting(true);
    try {
      // Save all responses
      const responses = QUESTIONS.map((q) => ({
        question_key: q.key,
        question_text: q.text,
        answer_value: answers[q.key] ?? '',
      })).filter((r) => r.answer_value);

      await upsertQuestionnaireResponses(donorProfile.id, responses);

      // Mark questionnaire complete + create initial trust badge (service_role via Edge Function)
      await supabase.rpc('recalculate_milk_badge_level', { p_donor_profile_id: donorProfile.id });

      // Run AI safety screener
      const screenerResult = await callSafetyScreener(donorProfile.id);

      if (screenerResult.auto_deactivated) {
        Alert.alert(
          t('donorQuestionnaire.profileReviewTitle'),
          t('donorQuestionnaire.profileReviewBody'),
          [{ text: t('donorQuestionnaire.ok'), onPress: () => navigation.navigate('MilkHome') }]
        );
        return;
      }

      navigation.replace('TrustBadgeBuilder', { donorProfileId: donorProfile.id });
    } catch (err) {
      console.error('Questionnaire submit error:', err);
      Alert.alert(t('donorQuestionnaire.errorTitle'), t('donorQuestionnaire.errorBody'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLastQuestion = currentIndex === totalQ - 1;
  const allAnswered = QUESTIONS.every((q) => answers[q.key]);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('donorQuestionnaire.back')}
        >
          <Text style={styles.backText}>{t('donorQuestionnaire.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.counter}>{t('donorQuestionnaire.counter', { n: currentIndex + 1, total: totalQ })}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Question */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.questionText}>{t(question.textKey)}</Text>

          {/* Answer options */}
          <View style={styles.options}>
            {question.type === 'yesno'
              ? (['Yes', 'No'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionBtn, selectedAnswer === opt && styles.optionSelected]}
                    onPress={() => handleAnswer(opt)}
                  >
                    <Text style={[styles.optionText, selectedAnswer === opt && styles.optionTextSelected]}>
                      {t(opt === 'Yes' ? 'donorQuestionnaire.yes' : 'donorQuestionnaire.no')}
                    </Text>
                  </TouchableOpacity>
                ))
              : question.options?.map((opt, i) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionBtn, selectedAnswer === opt && styles.optionSelected]}
                    onPress={() => handleAnswer(opt)}
                  >
                    <Text style={[styles.optionText, selectedAnswer === opt && styles.optionTextSelected]}>
                      {question.optionKeys ? t(question.optionKeys[i]) : opt}
                    </Text>
                  </TouchableOpacity>
                ))}
          </View>

          {/* AI Coach card */}
          {(loadingCoach || coach) && (
            <View style={styles.coachCard}>
              <Text style={styles.coachLabel}>{t('donorQuestionnaire.coachLabel')}</Text>
              {loadingCoach ? (
                <ActivityIndicator color="#E84B79" size="small" style={{ marginTop: 8 }} />
              ) : coach ? (
                <>
                  <Text style={styles.coachText}>{coach.why_it_matters}</Text>
                  {coach.concern && (
                    <View style={styles.coachConcern}>
                      <Text style={styles.coachConcernText}>{t('donorQuestionnaire.concernPrefix')} {coach.concern}</Text>
                    </View>
                  )}
                </>
              ) : null}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Footer navigation */}
      <View style={styles.footer}>
        {currentIndex > 0 && (
          <TouchableOpacity style={styles.prevBtn} onPress={handlePrev}>
            <Text style={styles.prevBtnText}>{t('donorQuestionnaire.prev')}</Text>
          </TouchableOpacity>
        )}
        {!isLastQuestion ? (
          <TouchableOpacity
            style={[styles.nextBtn, !selectedAnswer && styles.disabled]}
            onPress={handleNext}
            disabled={!selectedAnswer}
          >
            <Text style={styles.nextBtnText}>{t('donorQuestionnaire.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, (!allAnswered || submitting) && styles.disabled]}
            onPress={handleSubmit}
            disabled={!allAnswered || submitting}
          >
            <Text style={styles.nextBtnText}>
              {submitting ? t('donorQuestionnaire.saving') : t('donorQuestionnaire.submit')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  counter: { fontSize: 13, color: '#7A4A24', fontFamily: FONTS.bodySemiBold },
  progressTrack: { height: 4, backgroundColor: '#E0D5C5', marginHorizontal: 20, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: COLORS.coco, borderRadius: 2 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 120 },
  questionText: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: '#43260F', lineHeight: 29, marginBottom: 24 },
  options: { gap: 10 },
  // v9 card lift — rust hairline + soft cocoa drop.
  optionBtn: {
    backgroundColor: COLORS.paper,
    borderRadius: 12, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#43260F', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 6 }, shadowRadius: 20, elevation: 2,
  },
  optionSelected: { borderColor: '#E84B79', backgroundColor: 'rgba(192,120,64,0.06)', shadowOpacity: 0.22 },
  optionText: { fontSize: 15, color: '#7A4A24', fontFamily: FONTS.bodyMedium },
  optionTextSelected: { color: '#43260F', fontFamily: FONTS.bodySemiBold },
  // v9: full hairline border + soft drop (side-stripe was a v9 absolute ban).
  coachCard: {
    marginTop: 24, backgroundColor: COLORS.paper,
    borderRadius: 14, padding: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#43260F', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 8 }, shadowRadius: 22, elevation: 3,
  },
  coachLabel: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', marginBottom: 8, letterSpacing: 0.8 },
  coachText: { fontSize: 14, color: '#43260F', fontFamily: FONTS.bodyMedium, lineHeight: 21, marginBottom: 6 },
  coachWhy: { fontSize: 13, color: '#7A4A24', lineHeight: 20, fontFamily: FONTS.body },
  coachConcern: { marginTop: 10, backgroundColor: '#FFF9E6', borderRadius: 8, padding: 10 },
  coachConcernText: { fontSize: 13, color: '#E98A6A', lineHeight: 19, fontFamily: FONTS.body },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 16,
    backgroundColor: '#F5F0E8',
    borderTopWidth: 1, borderTopColor: '#E8E0D5',
  },
  prevBtn: {
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#7A4A24',
  },
  prevBtnText: { fontSize: 15, color: '#7A4A24', fontFamily: FONTS.bodySemiBold },
  // v9 canonical CTA — cinnamon + action-deep shadow.
  nextBtn: {
    flex: 1, backgroundColor: '#E84B79', borderRadius: 999,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: '#E84B79', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  nextBtnText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#FFFCF6', letterSpacing: 0.3 },
  disabled: { opacity: 0.4 },
});
