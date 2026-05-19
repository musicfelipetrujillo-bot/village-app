// Edit profile — mutable fields only (name, stage, zip, insurance).
// App is postpartum-only (decision 2026-04-27 — hospital-discharge GTM), so
// trimester chips and the due-date field are not surfaced. The `due_date`
// column stays in the DB for legacy rows but isn't edited from this screen.
// Writes straight to `public.users` via supabase; RLS scopes to the owner.
// Mirrors the optimistic pattern from MeScreen's language toggle: push to the
// store first, revert on error so the UI stays honest.
//
// Scope is narrower than OnboardingProfileScreen because:
//   1) OnboardingProfile lives in AuthStack (unreachable while signed in),
//   2) it's a wizard w/ hard "Enter Villie →" finish semantics that don't
//      map to an edit flow, and
//   3) we only need the *mutable* fields here — email + avatar belong to auth
//      and are edited elsewhere (deferred).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, SafeAreaView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useUserStore } from '@store/user';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, PREGNANCY_STAGES } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { formatZipInput, isPlausibleZip } from '@utils/zip';
import { useT } from '@/i18n';
import type { MeStackParamList } from '@/navigation/MeNavigator';
import type { PregnancyStage } from 'shared/src/types/v1';

type Props = NativeStackScreenProps<MeStackParamList, 'EditProfile'>;

// Non-nullable profile shape used by the form below. Mirrors UserProfile but
// drops the nullability that only matters to the initial fetch gate.
type ProfileLoaded = NonNullable<ReturnType<typeof useUserStore.getState>['profile']>;

// Postpartum-only picker. Legacy values (trying + trimesters) still appear in
// the DB enum for users who signed up before the scope change, but aren't
// surfaced as choices.
const STAGE_LABEL_KEYS: Record<typeof PREGNANCY_STAGES[number], string> = {
  postpartum_0_6mo: 'me.stagePostpartum06',
  postpartum_6_12mo: 'me.stagePostpartum612',
  postpartum_1yr_plus: 'me.stagePostpartum1yr',
};

// Outer gate — waits for the user profile to hydrate before mounting the
// form. This fixes two bugs we hit in the field:
//   (1) if the user navigated to Edit before `fetchProfile` had completed, the
//       form's useState initializers ran with `undefined` and the fields
//       stayed empty even after the profile later hydrated (useState only
//       reads initial values once).
//   (2) if MeScreen's fire-and-forget fetchProfile failed or returned null,
//       we'd spin forever. We now re-attempt on mount with a timeout + retry.
export default function EditProfileScreen({ navigation }: Props) {
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const fetchProfile = useUserStore((s) => s.fetchProfile);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    profile ? 'ready' : 'loading',
  );
  const attemptedRef = useRef(false);

  const loadProfile = useCallback(async () => {
    setStatus('loading');
    attemptedRef.current = true;
    try {
      await fetchProfile();
    } catch {
      /* fetchProfile swallows errors internally — fall through */
    }
    // Re-read the store after fetch completes.
    const hydrated = useUserStore.getState().profile;
    setStatus(hydrated ? 'ready' : 'error');
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setStatus('ready');
      return;
    }
    if (!attemptedRef.current) loadProfile();
  }, [profile, loadProfile]);

  if (status === 'loading') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerMsg}>
          <ActivityIndicator color="#C07840" />
          <Text style={s.emptyText}>{t('editProfile.loadingProfile')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('editProfile.topCancel')}
          >
            <Text style={s.topLink}>{t('editProfile.topCancel')}</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>{t('editProfile.topTitle')}</Text>
          <View style={{ width: 52 }} />
        </View>
        <View style={s.centerMsg}>
          <Text style={s.errorTitle}>{t('editProfile.errorTitle')}</Text>
          <Text style={s.errorBody}>{t('editProfile.errorBody')}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={loadProfile}
            accessibilityRole="button"
          >
            <Text style={s.retryBtnText}>{t('editProfile.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <EditProfileForm navigation={navigation} profile={profile} />;
}

function EditProfileForm({
  navigation,
  profile,
}: {
  navigation: Props['navigation'];
  profile: ProfileLoaded;
}) {
  const t = useT();
  const setProfile = useUserStore((s) => s.setProfile);

  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [stage, setStage] = useState<PregnancyStage | null>(
    (profile.pregnancy_stage as PregnancyStage | null) ?? null,
  );
  const [zip, setZip] = useState(profile.zip_code ?? '');
  const [insurance, setInsurance] = useState(profile.insurance_provider ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Avatar upload — picker → Supabase Storage `avatars/{userId}/{ts}.{ext}` →
  // optimistic users.avatar_url update with revert on either upload or DB
  // error. Migration 034 created the bucket + RLS policy so the path
  // `${user.id}/...` is the only writable folder for this user.
  const handlePickAvatar = async () => {
    if (avatarUploading || saving) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('editProfile.photosPermTitle'), t('editProfile.photosPermBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    const prev = profile.avatar_url;
    try {
      const ext = (asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg').replace(/\?.*$/, '');
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext) ? ext : 'jpg';
      const key = `${profile.id}/${Date.now()}.${safeExt}`;
      const res = await fetch(asset.uri);
      const buf = await res.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(key, buf, {
          contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(key);
      const nextUrl = pub.publicUrl;
      // Optimistic in-store update so MeScreen's avatar refreshes immediately
      // when we navigate back. Reverts on DB error.
      setProfile({ ...profile, avatar_url: nextUrl });
      const { error: dbErr } = await supabase
        .from('users')
        .update({ avatar_url: nextUrl })
        .eq('id', profile.id);
      if (dbErr) {
        setProfile({ ...profile, avatar_url: prev });
        throw new Error(dbErr.message);
      }
    } catch (err: any) {
      Alert.alert(t('editProfile.avatarErrorTitle'), err?.message ?? t('editProfile.avatarErrorBody'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const dirty = useMemo(() => (
    fullName.trim() !== (profile.full_name ?? '').trim() ||
    stage !== (profile.pregnancy_stage ?? null) ||
    (zip || null) !== (profile.zip_code ?? null) ||
    (insurance || null) !== (profile.insurance_provider ?? null)
  ), [profile, fullName, stage, zip, insurance]);

  const zipOk = !zip || isPlausibleZip(zip);

  const handleSave = async () => {
    if (!dirty || saving) return;
    if (!fullName.trim()) {
      Alert.alert(t('editProfile.nameRequiredTitle'), t('editProfile.nameRequiredBody'));
      return;
    }
    if (!zipOk) {
      Alert.alert(t('editProfile.checkZipTitle'), t('editProfile.checkZipBody'));
      return;
    }
    setSaving(true);
    const prev = profile;
    const next = {
      ...profile,
      full_name: fullName.trim(),
      pregnancy_stage: stage,
      zip_code: zip || null,
      insurance_provider: insurance || null,
    };
    // Optimistic — revert on error.
    setProfile(next);
    const { error } = await supabase
      .from('users')
      .update({
        full_name: next.full_name,
        pregnancy_stage: next.pregnancy_stage,
        zip_code: next.zip_code,
        insurance_provider: next.insurance_provider,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      setProfile(prev);
      Alert.alert(t('editProfile.saveErrorTitle'), error.message ?? t('editProfile.saveErrorBody'));
      return;
    }
    navigation.goBack();
  };

  const handleCancel = () => {
    if (!dirty) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      t('editProfile.discardTitle'),
      t('editProfile.discardBody'),
      [
        { text: t('editProfile.discardKeep'), style: 'cancel' },
        { text: t('editProfile.discardDiscard'), style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <V9PageBackdrop />
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel={t('editProfile.topCancel')}
        >
          <Text style={s.topLink}>{t('editProfile.topCancel')}</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>{t('editProfile.topTitle')}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!dirty || saving}
          accessibilityRole="button"
          accessibilityLabel={t('editProfile.topSave')}
          accessibilityState={{ disabled: !dirty || saving }}
        >
          {saving ? (
            <ActivityIndicator color="#C07840" />
          ) : (
            <Text style={[s.topLink, s.topLinkPrimary, (!dirty) && s.topLinkDisabled]}>{t('editProfile.topSave')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.avatarBlock}>
          <TouchableOpacity
            onPress={handlePickAvatar}
            style={s.avatarTouch}
            accessibilityRole="button"
            accessibilityLabel={profile.avatar_url ? t('editProfile.avatarChangeA11y') : t('editProfile.avatarAddA11y')}
            accessibilityState={{ busy: avatarUploading, disabled: avatarUploading }}
            disabled={avatarUploading}
          >
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
            ) : (
              <View style={[s.avatarImg, s.avatarFallback]}>
                <Text style={s.avatarFallbackText}>
                  {(fullName.trim()[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            {avatarUploading ? (
              <View style={s.avatarOverlay}>
                <ActivityIndicator color="#FDFBF6" />
              </View>
            ) : (
              <View style={s.avatarBadge}>
                <Text style={s.avatarBadgeText}>✎</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={s.avatarHint}>
            {profile.avatar_url ? t('editProfile.avatarHintChange') : t('editProfile.avatarHintAdd')}
          </Text>
        </View>

        <Field label={t('editProfile.nameLabel')}>
          <TextInput
            style={s.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('editProfile.namePlaceholder')}
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="words"
            maxLength={80}
          />
        </Field>

        <Field label={t('editProfile.stageLabel')}>
          <View style={s.stageGrid}>
            {PREGNANCY_STAGES.map((code) => {
              const active = stage === code;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => setStage(code)}
                  style={[s.stageChip, active && s.stageChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.stageChipText, active && s.stageChipTextActive]}>
                    {t(STAGE_LABEL_KEYS[code])}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label={t('editProfile.zipLabel')}>
          <TextInput
            style={[s.input, !zipOk && s.inputError]}
            value={zip}
            onChangeText={(txt) => setZip(formatZipInput(txt))}
            placeholder="33131"
            placeholderTextColor={COLORS.textLight}
            keyboardType="number-pad"
            maxLength={10}
          />
          {!zipOk ? <Text style={s.errText}>{t('editProfile.zipError')}</Text> : null}
        </Field>

        <Field label={t('editProfile.insuranceLabel')}>
          <TextInput
            style={s.input}
            value={insurance}
            onChangeText={setInsurance}
            placeholder={t('editProfile.insurancePlaceholder')}
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="words"
          />
        </Field>

        <Text style={s.helper}>{t('editProfile.helper')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  centerMsg: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

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
    color: COLORS.barkSoft,
  },
  topLinkPrimary: { color: COLORS.coco },
  topLinkDisabled: { opacity: 0.4 },

  content: { padding: 20, paddingBottom: 48, gap: 20 },
  field: { gap: 8 },
  fieldLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.barkSoft,
  },
  input: {
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.bark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,80,50,0.18)',
  },
  inputError: { borderWidth: 1.5, borderColor: '#B22A2A' },           // form error = red (matches Auth screens)
  errText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#A77349',
    marginTop: 6,
  },

  stageGrid: { gap: 8 },
  stageChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(150,80,50,0.18)',
    backgroundColor: COLORS.paper,
  },
  stageChipActive: {
    borderColor: '#C07840',                                            // v9 active = cinnamon
    backgroundColor: 'rgba(192,120,64,0.08)',
  },
  stageChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.bark,
  },
  stageChipTextActive: { color: '#3D1F0E' },                           // cocoa ink on cinnamon-tint pill

  helper: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 8,
    lineHeight: 18,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
  },

  errorTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.bark,
    marginBottom: 6,
  },
  errorBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  // v9 canonical CTA — cinnamon + action-deep shadow.
  retryBtn: {
    backgroundColor: '#C07840',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  retryBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.paper,
  },

  avatarBlock: { alignItems: 'center', gap: 8, marginBottom: 8 },
  avatarTouch: { position: 'relative' },
  avatarImg: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.cream },
  avatarFallback: {
    backgroundColor: COLORS.coco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: FONTS.headerBold,
    fontSize: 36,
    color: '#FDFBF6',
  },
  avatarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Edit-pencil affordance — cinnamon = action.
  avatarBadge: {
    position: 'absolute', right: 0, bottom: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#C07840',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.cream,
  },
  avatarBadgeText: { color: '#FDFBF6', fontSize: 14, fontFamily: FONTS.bodySemiBold },
  avatarHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textLight,
  },
});
