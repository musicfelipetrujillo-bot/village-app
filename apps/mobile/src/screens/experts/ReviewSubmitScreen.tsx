// V1 Phase 3 — Review submit with star selector
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useExpertsStore } from '@store/experts';
import { useAuthStore } from '@store/auth';
import { specialistsApi } from '@api/specialists';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'ReviewSubmit'>;

const RATING_KEYS = [
  '',
  'reviewSubmit.ratingPoor',
  'reviewSubmit.ratingFair',
  'reviewSubmit.ratingGood',
  'reviewSubmit.ratingGreat',
  'reviewSubmit.ratingExcellent',
];

export default function ReviewSubmitScreen({ navigation, route }: Props) {
  const t = useT();
  const { specialistId } = route.params;
  const { selectedSpecialist: spec, loadReviews } = useExpertsStore();
  const user = useAuthStore((s) => s.user);

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayRating = hovered || rating;

  const handleSubmit = async () => {
    if (!user) return;
    if (rating === 0) {
      Alert.alert(t('reviewSubmit.errRatingTitle'), t('reviewSubmit.errRatingBody'));
      return;
    }
    setSubmitting(true);
    try {
      await specialistsApi.addReview({
        specialist_id: specialistId,
        user_id: user.id,
        rating,
        body: body.trim() || undefined,
      });
      await loadReviews(specialistId);
      Alert.alert(t('reviewSubmit.successTitle'), t('reviewSubmit.successBody'), [
        { text: t('reviewSubmit.successDone'), onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert(t('reviewSubmit.errOopsTitle'), e.message ?? t('reviewSubmit.errOopsBody'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('reviewSubmit.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('reviewSubmit.title')}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Provider name */}
          {spec && (
            <View style={styles.providerRow}>
              <View style={styles.avatarSmall}>
                <Text style={{ fontSize: 22 }}>👩‍⚕️</Text>
              </View>
              <View>
                <Text style={styles.providerName}>{spec.full_name}</Text>
                <Text style={styles.providerSub}>{spec.credentials}</Text>
              </View>
            </View>
          )}

          {/* Star selector */}
          <View style={styles.starsSection}>
            <Text style={styles.starsLabel}>{t('reviewSubmit.ratingLabel')}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  onPressIn={() => setHovered(star)}
                  onPressOut={() => setHovered(0)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                >
                  <Text style={[styles.star, star <= displayRating && styles.starFilled]}>
                    {star <= displayRating ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>
              {displayRating > 0 ? t(RATING_KEYS[displayRating]) : t('reviewSubmit.tapToRate')}
            </Text>
          </View>

          {/* Review body */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{t('reviewSubmit.experienceLabel')} <Text style={styles.optional}>{t('reviewSubmit.optional')}</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('reviewSubmit.experiencePlaceholder')}
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={6}
              value={body}
              onChangeText={setBody}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{t('reviewSubmit.charCount', { count: body.length, max: 1000 })}</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || rating === 0) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || rating === 0}
            activeOpacity={0.85}
            accessibilityLabel={t('reviewSubmit.submitCtaA11y')}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting || rating === 0 }}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitText}>{t('reviewSubmit.submitCta')}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            {t('reviewSubmit.disclaimer')}
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    backgroundColor: COLORS.white,
  },
  cancelBtn: { width: 60 },
  cancelText: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodyMedium },
  headerTitle: {
    fontFamily: FONTS.headerItalic,
    fontSize: 17,
    color: COLORS.textDark,
  },

  content: { padding: 20, paddingBottom: 60, gap: 24 },

  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
  },
  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.rustLight + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.textDark },
  providerSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2, fontFamily: FONTS.body },

  starsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  starsLabel: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.bodyMedium, textTransform: 'uppercase', letterSpacing: 0.8 },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 44, color: 'rgba(0,0,0,0.15)' },
  starFilled: { color: COLORS.gold },
  ratingLabel: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.textDark, minHeight: 20 },

  inputSection: { gap: 8 },
  inputLabel: { fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.textDark, letterSpacing: 0.3 },
  optional: { color: COLORS.textLight, fontFamily: FONTS.body },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 22,
    minHeight: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    fontFamily: FONTS.body,
  },
  charCount: { fontSize: 11, color: COLORS.textLight, textAlign: 'right', fontFamily: FONTS.body },

  submitBtn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: 'white', fontSize: 16, fontFamily: FONTS.bodySemiBold },

  disclaimer: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
});
