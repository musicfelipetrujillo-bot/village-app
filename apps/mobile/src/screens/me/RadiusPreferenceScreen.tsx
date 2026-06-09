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
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
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
      <V9PageBackdrop />
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('radius.topBack')}
        >
          <Text style={s.topLink}>← {t('radius.topBack')}</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>{t('radius.topTitle')}</Text>
        <View style={s.topSpacer}>
          {saving ? <ActivityIndicator color="#D96C88" /> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* v9 editorial masthead */}
        <View style={s.eyebrowRow}>
          <View style={s.eyebrowBar} />
          <Text style={s.eyebrow}>{t('radius.headerEyebrow')}</Text>
        </View>
        <Text style={s.headerTitle}>
          {t('radius.headerTitleLead')} <Text style={s.headerTitleEm}>{t('radius.headerTitleEm')}</Text>
        </Text>
        <View style={s.headerRule} />
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
  safe: { flex: 1, backgroundColor: 'transparent' },
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
    color: COLORS.bark,
  },
  topLink: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: '#D96C88',
  },
  topSpacer: { width: 52, alignItems: 'flex-end' },

  content: { padding: 20, paddingBottom: 48, gap: 20 },

  // v9 editorial masthead
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eyebrowBar: { width: 22, height: 2, backgroundColor: '#7A4A24', marginRight: 10, borderRadius: 1 },
  eyebrow: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', letterSpacing: 1.8, textTransform: 'uppercase' },
  headerTitle: {
    fontFamily: FONTS.headerBold, fontSize: 32, color: COLORS.bark,
    lineHeight: 38, letterSpacing: -0.5, marginBottom: 4,
  },
  headerTitleEm: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#D96C88' },
  headerRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 6, marginBottom: 4, width: 48,
  },

  currentCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  currentLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
  },
  currentValue: {
    fontFamily: FONTS.headerBold,
    fontSize: 40,
    color: '#7A4A24',
    marginTop: 6,
  },

  sectionTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.barkSoft,
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
    borderColor: 'rgba(150,80,50,0.18)',
    backgroundColor: COLORS.paper,
  },
  chipActive: {
    borderColor: '#D96C88',                                            // v9 active = cinnamon
    backgroundColor: '#D96C88',
  },
  chipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.bark,
  },
  chipTextActive: { color: COLORS.paper },

  help: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 19,
    marginTop: 4,
  },
});
