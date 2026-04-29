// Search-radius preference — one global value that applies to every
// nearby-search surface (specialists, donors, events, gear). See A2.a in
// CLAUDE.md and migration 031.
//
// Writes to `users.search_radius_miles` directly via supabase, then applies
// the change optimistically to the Zustand profile so the rest of the app
// (API fallbacks in `apiResolveRadius`) picks it up on the next render.
//
// Intentionally chip-based (not a slider) because the spec calls for a
// tactile picker and the real distribution of useful values is small —
// 5/10/25/50/75/100 covers the whole product.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useUserStore } from '@store/user';
import { supabase } from '@/lib/supabase';
import {
  COLORS, FONTS,
  RADIUS_CHOICES_MILES,
  DEFAULT_SEARCH_RADIUS_MILES,
} from '@utils/constants';
import { useT } from '@/i18n';
import type { MeStackParamList } from '@/navigation/MeNavigator';

type Props = NativeStackScreenProps<MeStackParamList, 'RadiusPreference'>;

export default function RadiusPreferenceScreen({ navigation }: Props) {
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);

  const current = profile?.search_radius_miles ?? DEFAULT_SEARCH_RADIUS_MILES;
  const [saving, setSaving] = useState(false);

  const choose = useCallback(async (next: number) => {
    if (!profile || saving || next === current) return;
    setSaving(true);
    const prev = profile;
    // Optimistic — revert on error (matches MeScreen/EditProfile pattern).
    setProfile({ ...profile, search_radius_miles: next });
    const { error } = await supabase
      .from('users')
      .update({ search_radius_miles: next })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      setProfile(prev);
      Alert.alert(t('radius.saveErrorTitle'), error.message ?? t('radius.saveErrorBody'));
    }
  }, [profile, setProfile, saving, current, t]);

  const helpText = useMemo(() => t('radius.help'), [t]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('radius.topBack')}
        >
          <Text style={s.topLink}>‹ {t('radius.topBack')}</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>{t('radius.topTitle')}</Text>
        <View style={s.topSpacer}>
          {saving ? <ActivityIndicator color={COLORS.rust} /> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.currentCard}>
          <Text style={s.currentLabel}>{t('radius.currentLabel')}</Text>
          <Text style={s.currentValue}>{t('radius.currentValue', { miles: current })}</Text>
        </View>

        <Text style={s.sectionTitle}>{t('radius.sectionTitle')}</Text>
        <View style={s.chips}>
          {RADIUS_CHOICES_MILES.map((miles) => {
            const active = miles === current;
            return (
              <TouchableOpacity
                key={miles}
                onPress={() => choose(miles)}
                style={[s.chip, active && s.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t('radius.chipA11y', { miles })}
                disabled={saving}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{t('radius.chipLabel', { miles })}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.help}>{helpText}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  topTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  topLink: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.rust,
  },
  topSpacer: { width: 52, alignItems: 'flex-end' },

  content: { padding: 20, paddingBottom: 48, gap: 20 },

  currentCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  currentLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMid,
  },
  currentValue: {
    fontFamily: FONTS.headerBold,
    fontSize: 40,
    color: COLORS.rust,
    marginTop: 6,
  },

  sectionTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.textMid,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: COLORS.cardBg,
  },
  chipActive: {
    borderColor: COLORS.rust,
    backgroundColor: COLORS.rust,
  },
  chipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.textDark,
  },
  chipTextActive: { color: COLORS.white },

  help: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 19,
    marginTop: 4,
  },
});
