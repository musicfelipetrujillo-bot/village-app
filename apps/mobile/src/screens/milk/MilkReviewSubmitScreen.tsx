// V2 M4 — MilkReviewSubmitScreen
// 5-star selector + body input. Trigger update_donor_rating fires on insert.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { submitMilkReview } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkReviewSubmit'>;

export default function MilkReviewSubmitScreen({ navigation, route }: Props) {
  const { transactionId, donorProfileId, donorDisplayName } = route.params;
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating < 1) {
      Alert.alert(t('milkReview.tapStarTitle'), t('milkReview.tapStarBody'));
      return;
    }
    setSubmitting(true);
    try {
      await submitMilkReview({
        transaction_id: transactionId,
        donor_profile_id: donorProfileId,
        reviewer_user_id: user.id,
        rating,
        body: body.trim() || undefined,
      });
      Alert.alert(t('milkReview.thanksTitle'), t('milkReview.thanksBody'), [
        { text: t('milkReview.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = e.message?.includes('duplicate')
        ? t('milkReview.duplicateMsg')
        : (e.message ?? t('milkReview.submitFailedBody'));
      Alert.alert(t('milkReview.submitFailedTitle'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('milkReview.back')}
        >
          <Text style={styles.back}>{t('milkReview.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('milkReview.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.donorName}>{donorDisplayName}</Text>
        <Text style={styles.prompt}>{t('milkReview.prompt')}</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setRating(n)} style={styles.starBtn}>
              <Text style={[styles.star, n <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.ratingLabel}>
          {rating === 0 ? t('milkReview.ratingTap') :
           rating === 5 ? t('milkReview.rating5') :
           rating === 4 ? t('milkReview.rating4') :
           rating === 3 ? t('milkReview.rating3') :
           rating === 2 ? t('milkReview.rating2') : t('milkReview.ratingPoor')}
        </Text>

        <TextInput
          style={styles.bodyInput}
          placeholder={t('milkReview.bodyPlaceholder')}
          placeholderTextColor="#B5A095"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={500}
        />
        <Text style={styles.counter}>{t('milkReview.counter', { n: body.length })}</Text>

        <TouchableOpacity
          style={[styles.submitBtn, (rating < 1 || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating < 1 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FDFBF6" />
          ) : (
            <Text style={styles.submitBtnText}>{t('milkReview.submitBtn')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodyMedium },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },

  content: { padding: 24, alignItems: 'center' },
  donorName: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginTop: 12 },
  prompt: { fontSize: 14, color: '#6B5C52', marginTop: 8, marginBottom: 28 },

  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  starBtn: { padding: 4 },
  star: { fontSize: 44, color: '#E5DDD2' },
  starActive: { color: '#C4A35A' },

  ratingLabel: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#A77349', marginBottom: 28 },

  // v9 input card lift — rust hairline + soft cocoa drop, so the review
  // surface reads as a confirmed writing space rather than a flat field.
  bodyInput: {
    width: '100%', minHeight: 120,
    backgroundColor: COLORS.paper, borderRadius: 12, padding: 16,
    fontSize: 15, color: '#2C1810', textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#6B2E0E', shadowOpacity: 0.14, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 2,
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: '#9A8070', marginTop: 6 },

  // v9 canonical CTA — rect variant
  submitBtn: {
    width: '100%', backgroundColor: '#C07840', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#FDFBF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
});
