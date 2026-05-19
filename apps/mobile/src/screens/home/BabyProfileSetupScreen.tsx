// V4 Phase G1 — First-launch baby profile setup (name, DOB, due date, feeding method).
// Invoked from HomeScreen when no baby_profiles row exists for the user.
// Multi-step single screen (4 steps), matches OnboardingProfileScreen pattern.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';

import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { homeApi, type FeedingMethod, type Gender } from '@api/home';
import { useHomeStore } from '@store/home';
import { useT } from '@/i18n';

const TOTAL_STEPS = 4;

// Labels resolved at render time via t() — keys are i18n suffixes under
// `babyProfile.*` so the wizard flips on language toggle.
const FEEDING_OPTIONS: { key: FeedingMethod; labelKey: string; emoji: string }[] = [
  { key: 'breastfed', labelKey: 'babyProfile.feedingBreastfed', emoji: '🤱' },
  { key: 'formula',   labelKey: 'babyProfile.feedingFormula',   emoji: '🍼' },
  { key: 'combo',     labelKey: 'babyProfile.feedingCombo',     emoji: '🤝' },
  { key: 'pumped',    labelKey: 'babyProfile.feedingPumped',    emoji: '🧊' },
];

const GENDER_OPTIONS: { key: Gender; labelKey: string; emoji: string }[] = [
  { key: 'female',    labelKey: 'babyProfile.genderGirl',      emoji: '👧' },
  { key: 'male',      labelKey: 'babyProfile.genderBoy',       emoji: '👦' },
  { key: 'nonbinary', labelKey: 'babyProfile.genderNonbinary', emoji: '🌈' },
  { key: 'unknown',   labelKey: 'babyProfile.genderUnknown',   emoji: '💭' },
];

// Very light date validation — YYYY-MM-DD.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Auto-format date input: digits only, dashes auto-inserted at positions 4 and 7.
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

// DOB must be in the past and within the last 3 years (app targets 0-24mo; 3yr buffer).
function isPlausibleDob(dob: string): boolean {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
  return d <= now && d >= threeYearsAgo;
}

export default function BabyProfileSetupScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const fetchAll = useHomeStore((s) => s.fetchAll);

  const [step, setStep] = useState(0);
  const [babyName, setBabyName] = useState('');
  const [dob, setDob] = useState('');
  const [isPremature, setIsPremature] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [feeding, setFeeding] = useState<FeedingMethod | null>(null);
  const [saving, setSaving] = useState(false);

  const dobValid = DATE_RE.test(dob) && isPlausibleDob(dob);
  const dueDateValid = !isPremature || (DATE_RE.test(dueDate) && new Date(dueDate) >= new Date(dob));

  const canProceed =
    (step === 0 && dobValid && dueDateValid) ||
    (step === 1) ||               // gender is optional
    (step === 2 && feeding !== null) ||
    (step === 3);                 // review

  const handleNext = async () => {
    if (!canProceed) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    await save();
  };

  const save = async () => {
    setSaving(true);
    try {
      const correctedOffset = isPremature && DATE_RE.test(dueDate)
        ? Math.floor((new Date(dueDate).getTime() - new Date(dob).getTime()) / 86_400_000)
        : 0;

      await homeApi.upsertBabyProfile({
        baby_name: babyName.trim() || null,
        date_of_birth: dob,
        due_date: DATE_RE.test(dueDate) ? dueDate : null,
        gender,
        is_premature: isPremature,
        corrected_age_offset_days: correctedOffset,
        feeding_method: feeding,
      });
      await fetchAll();
      navigation.goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('babyProfile.saveFailedBody');
      Alert.alert(t('babyProfile.saveFailedTitle'), msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text style={styles.eyebrow}>{t('babyProfile.stepLabel', { n: 1, total: 4 })}</Text>
            <Text style={styles.title}>{t('babyProfile.step1Title')}</Text>
            <Text style={styles.subtitle}>{t('babyProfile.step1Sub')}</Text>

            <Text style={styles.label}>{t('babyProfile.babyNameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={babyName}
              onChangeText={setBabyName}
              placeholder={t('babyProfile.babyNamePlaceholder')}
              placeholderTextColor="#B5A095"
              maxLength={40}
            />

            <Text style={styles.label}>{t('babyProfile.dobLabel')}</Text>
            <TextInput
              style={styles.input}
              value={dob}
              onChangeText={(v) => setDob(formatDateInput(v))}
              placeholder={t('babyProfile.dobPlaceholder')}
              placeholderTextColor="#B5A095"
              keyboardType="number-pad"
              maxLength={10}
              autoCorrect={false}
            />
            {dob.length === 10 && !dobValid && (
              <Text style={styles.errorText}>{t('babyProfile.dobError')}</Text>
            )}

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsPremature((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isPremature }}
            >
              <View style={[styles.checkbox, isPremature && styles.checkboxOn]}>
                {isPremature && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>{t('babyProfile.prematureLabel')}</Text>
            </TouchableOpacity>

            {isPremature && (
              <>
                <Text style={styles.label}>{t('babyProfile.dueDateLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={dueDate}
                  onChangeText={(v) => setDueDate(formatDateInput(v))}
                  placeholder={t('babyProfile.dobPlaceholder')}
                  placeholderTextColor="#B5A095"
                  keyboardType="number-pad"
                  maxLength={10}
                  autoCorrect={false}
                />
                <Text style={styles.helperText}>{t('babyProfile.dueDateHelper')}</Text>
                {dueDate.length === 10 && !dueDateValid && (
                  <Text style={styles.errorText}>{t('babyProfile.dueDateError')}</Text>
                )}
              </>
            )}
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.eyebrow}>{t('babyProfile.stepLabel', { n: 2, total: 4 })}</Text>
            <Text style={styles.title}>{t('babyProfile.step2Title')}</Text>
            <Text style={styles.subtitle}>{t('babyProfile.step2Sub')}</Text>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, gender === opt.key && styles.optionRowActive]}
                onPress={() => setGender(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: gender === opt.key }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={styles.optionLabel}>{t(opt.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.eyebrow}>{t('babyProfile.stepLabel', { n: 3, total: 4 })}</Text>
            <Text style={styles.title}>{t('babyProfile.step3Title')}</Text>
            <Text style={styles.subtitle}>{t('babyProfile.step3Sub')}</Text>
            {FEEDING_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, feeding === opt.key && styles.optionRowActive]}
                onPress={() => setFeeding(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: feeding === opt.key }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={styles.optionLabel}>{t(opt.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.eyebrow}>{t('babyProfile.step4Review')}</Text>
            <Text style={styles.title}>{t('babyProfile.reviewTitle')}</Text>
            <View style={styles.reviewCard}>
              <Row label={t('babyProfile.reviewName')}     value={babyName || '—'} />
              <Row label={t('babyProfile.reviewDob')}      value={dob} />
              {isPremature && <Row label={t('babyProfile.reviewDueDate')} value={dueDate || '—'} />}
              {gender && <Row label={t('babyProfile.reviewGender')}   value={t(GENDER_OPTIONS.find((o) => o.key === gender)!.labelKey)} />}
              {feeding && <Row label={t('babyProfile.reviewFeeding')} value={t(FEEDING_OPTIONS.find((o) => o.key === feeding)!.labelKey)} />}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep((s) => Math.max(0, s - 1))}
            disabled={saving}
          >
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, (!canProceed || saving) && styles.primaryBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed || saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#FDFBF6" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {step === TOTAL_STEPS - 1 ? t('babyProfile.saveProfile') : t('common.continue')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  progressRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.08)' },
  dotActive: { backgroundColor: COLORS.coco },

  content: { paddingHorizontal: 20, paddingBottom: 32 },

  // v9 — eyebrow rust-deep + Playfair Bold roman title
  eyebrow: { fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.8, color: '#A77349', textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: 28, fontFamily: FONTS.headerBold, color: COLORS.bark, marginBottom: 8, lineHeight: 34, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: COLORS.barkSoft, marginBottom: 20, lineHeight: 20 },

  label: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.paper, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.bark,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
  },
  helperText: { fontSize: 12, color: COLORS.textLight, marginTop: 6 },
  errorText: { fontSize: 12, color: '#C94F3C', marginTop: 6, fontFamily: FONTS.bodyMedium },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.coco, marginRight: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.coco },
  checkboxTick: { color: '#FDFBF6', fontSize: 14, fontFamily: FONTS.bodySemiBold },
  checkboxLabel: { fontSize: 14, color: COLORS.bark },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.paper, borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 2, borderColor: 'transparent',
  },
  optionRowActive: { borderColor: COLORS.coco, backgroundColor: '#FFF7F2' },
  optionEmoji: { fontSize: 22 },
  optionLabel: { fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.bark },

  reviewCard: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#6B2E0E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 18, elevation: 5,
  },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  reviewLabel: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },
  reviewValue: { fontSize: 14, color: COLORS.bark, fontFamily: FONTS.bodyMedium },

  footer: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.cream,
  },
  // v9 canonical CTA
  primaryBtn: {
    flex: 1, backgroundColor: '#C07840', borderRadius: 999,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#FDFBF6', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
  backBtn: { paddingHorizontal: 18, justifyContent: 'center' },
  backBtnText: { color: COLORS.barkSoft, fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
