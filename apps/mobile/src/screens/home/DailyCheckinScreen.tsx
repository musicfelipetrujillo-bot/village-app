// V4 Phase G7 — Daily check-in prompt screen.
// Mom taps a mood 1–5, optionally adds a sentence, submits. The submit goes
// to upsert_daily_checkin → ai-daily-checkin → returns ai_reply + crisis flag.
// On success we navigate to CheckinResponse to display the AI reply (and crisis
// resources if flagged). If today already has a check-in, we prefill and let
// her revise.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { tap, confirm } from '@utils/haptics';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import MoodFaceIcon, { type MoodScore } from '@components/shared/MoodFaceIcon';
import { homeApi, MOOD_OPTIONS } from '@api/home';
import { useHomeStore } from '@store/home';
import { useT } from '@/i18n';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

type Props = NativeStackScreenProps<HomeStackParamList, 'DailyCheckin'>;

export default function DailyCheckinScreen({ navigation }: Props) {
  const t = useT();
  const setTodayCheckin = useHomeStore((s) => s.setTodayCheckin);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [body, setBody] = useState('');

  // Per-chip scale values for the spring bounce on tap.
  const chipScales = useRef(
    MOOD_OPTIONS.reduce<Record<number, Animated.Value>>((acc, opt) => {
      acc[opt.score] = new Animated.Value(1);
      return acc;
    }, {})
  ).current;

  const bounceChip = (score: number) => {
    const scale = chipScales[score];
    if (!scale) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, friction: 3, tension: 220 }),
      Animated.spring(scale, { toValue: 1.0,  useNativeDriver: true, friction: 6, tension: 120 }),
    ]).start();
  };
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Prefill from today's check-in if one exists.
  const load = useCallback(async () => {
    try {
      const existing = await homeApi.getTodayCheckin();
      if (existing) {
        setMood(existing.mood_score);
        setEnergy(existing.energy_score);
        setBody(existing.user_response ?? '');
      }
    } catch (err) {
      console.error('[checkin] load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const onSubmit = async () => {
    if (mood == null || submitting) return;
    confirm();
    setSubmitting(true);
    try {
      const row = await homeApi.submitCheckin({
        mood_score: mood,
        energy_score: energy,
        user_response: body.trim() ? body.trim() : null,
      });
      setTodayCheckin(row);
      navigation.replace('CheckinResponse', { checkinId: row.id });
    } catch (err) {
      Alert.alert(t('checkin.failedTitle'), err instanceof Error ? err.message : t('checkin.failedBody'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('checkin.backA11y')}
        >
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('checkin.headerTitle')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#C07840" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{t('checkin.heading')}</Text>
          <Text style={styles.sub}>{t('checkin.sub')}</Text>

          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((opt) => {
              const moodLabel = t(opt.labelKey);
              const scale = chipScales[opt.score] ?? new Animated.Value(1);
              return (
                <Animated.View key={opt.score} style={{ flex: 1, transform: [{ scale }] }}>
                  <TouchableOpacity
                    style={[styles.moodChip, mood === opt.score && styles.moodChipActive]}
                    onPress={() => { tap(); bounceChip(opt.score); setMood(opt.score); }}
                    accessibilityRole="button"
                    accessibilityLabel={t('checkin.moodA11y', { label: moodLabel })}
                    accessibilityState={{ selected: mood === opt.score }}
                  >
                    <MoodFaceIcon
                      score={opt.score as MoodScore}
                      size={32}
                      color={mood === opt.score ? '#FDFBF6' : '#3D1F0E'}
                    />
                    <Text style={[styles.moodLabel, mood === opt.score && styles.moodLabelActive]}>
                      {moodLabel}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>{t('checkin.energyLabel')}</Text>
          <View
            style={styles.energyRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('checkin.energyLabel')}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.dot, energy === n && styles.dotActive]}
                onPress={() => { tap(); setEnergy(energy === n ? null : n); }}
                accessibilityRole="radio"
                accessibilityLabel={t('checkin.energyA11y', { n })}
                accessibilityState={{ selected: energy === n }}
              >
                <Text style={[styles.dotText, energy === n && styles.dotTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>{t('checkin.notesLabel')}</Text>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder={t('checkin.notesPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            multiline
            maxLength={1000}
          />
          <Text style={styles.counter}>{body.length}/1000</Text>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>{t('checkin.disclaimer')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.submit, (mood == null || submitting) && styles.submitDisabled]}
            onPress={onSubmit}
            disabled={mood == null || submitting}
            accessibilityRole="button"
            accessibilityLabel={t('checkin.submitA11y')}
          >
            {submitting ? (
              <ActivityIndicator color="#FDFBF6" />
            ) : (
              <Text style={styles.submitText}>{t('checkin.submitText')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  content: { padding: 20, paddingBottom: 80 },
  // Playfair Display Italic — same family as the "Village" wordmark accent.
  heading: { fontSize: 26, fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: COLORS.bark },
  sub: { fontSize: 14, color: COLORS.barkSoft, marginTop: 4, marginBottom: 18 },

  moodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  moodChip: {
    minWidth: 58, alignItems: 'center', flex: 1,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.18)',
  },
  // v9 active state — action-deep (matches CTAs, toggle active, week chip)
  moodChipActive: { backgroundColor: '#C07840', borderColor: '#945A41' },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft, marginTop: 4 },
  moodLabelActive: { color: '#FDFBF6' },

  sectionLabel: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 20, marginBottom: 8 },
  // `flex:1` on each dot + small gap means the row scales to whatever width is
  // available — no horizontal scroll on iPhone SE (320pt) and no awkward
  // emptiness on Pro Max. `aspectRatio:1` keeps them circular as flex stretches
  // them. `maxWidth:56` caps the size on tablets so dots don't become huge.
  energyRow: { flexDirection: 'row', gap: 8 },
  dot: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 56,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.paper,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.18)',
  },
  dotActive: { backgroundColor: COLORS.sage, borderColor: COLORS.sage },
  dotText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  dotTextActive: { color: '#FDFBF6' },

  input: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16,
    fontSize: 15, color: COLORS.bark, minHeight: 110, textAlignVertical: 'top',
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: COLORS.textLight, marginTop: 4 },

  disclaimerBox: {
    marginTop: 18, backgroundColor: 'rgba(184,92,56,0.06)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.15)',
  },
  disclaimerText: { fontSize: 12, color: COLORS.barkSoft, lineHeight: 17 },

  // v9 canonical CTA — action-deep + cocoa shadow + paper text
  submit: {
    marginTop: 22, backgroundColor: '#C07840', borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#FDFBF6', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
