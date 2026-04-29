// Me tab — profile surface.
//
// Sections (top → bottom):
//   1. Profile header — avatar + name + email + pregnancy-stage pill + Edit CTA
//   2. Baby card — baby name + age (or CTA to set one up)
//   3. My stuff — deep-links into saved/owned surfaces across tabs
//   4. Preferences — language toggle (EN/ES), persisted to users.preferred_language
//   5. Crisis resources — always available, tap to call/text
//   6. Account — sign out
//
// Read state:
//   - useAuthStore for email + signOut
//   - useUserStore for profile (name, stage, preferred_language, avatar_url)
//   - useHomeStore for baby profile
// fetchProfile runs on mount so the tab is populated even after a cold launch.
//
// Cross-tab deep links use `navigation.getParent()?.navigate(TabName, { screen })`
// because each tab hosts its own native stack and the destination screens
// (SavedDonors, MyRsvps, etc.) already exist — we're not forking them.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Linking, Alert, SafeAreaView, Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { supabase } from '@/lib/supabase';
import { formatAge } from '@api/home';
import { clinicalReviewApi } from '@api/clinical-review';
import { eventReviewApi } from '@api/event-review';
import {
  COLORS, FONTS, CRISIS_RESOURCES, SUPPORTED_LANGUAGES,
  DEFAULT_SEARCH_RADIUS_MILES,
} from '@utils/constants';
import type { MeStackParamList } from '@/navigation/MeNavigator';
import { useT } from '@/i18n';

type MeNav = NativeStackNavigationProp<MeStackParamList, 'MeRoot'>;

type CrisisItem = {
  label: string;
  contact: string;
  type: 'call' | 'sms';
  body?: string;
};

const CRISIS_LIST: CrisisItem[] = [
  CRISIS_RESOURCES.emergency,
  CRISIS_RESOURCES.mentalHealth,
  CRISIS_RESOURCES.psi,
  CRISIS_RESOURCES.crisisText,
  CRISIS_RESOURCES.miamiCrisis,
];

// Stage → i18n key. Resolved at render time so the labels flip on language toggle.
const STAGE_KEYS: Record<string, string> = {
  trying: 'me.stageTrying',
  first_trimester: 'me.stageFirst',
  second_trimester: 'me.stageSecond',
  third_trimester: 'me.stageThird',
  postpartum_0_6mo: 'me.stagePostpartum06',
  postpartum_6_12mo: 'me.stagePostpartum612',
  postpartum_1yr_plus: 'me.stagePostpartum1yr',
};

// Language native names — these are intentionally NOT translated. "English"
// always reads "English" and "Español" always reads "Español" so a user who
// can only read one of them can still find theirs.
const LANGUAGE_LABELS: Record<typeof SUPPORTED_LANGUAGES[number], string> = {
  en: 'English',
  es: 'Español',
};

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function formatContact(item: CrisisItem, t: Translator): string {
  if (item.type === 'sms') return t('me.crisisSmsFormat', { body: item.body ?? '', contact: item.contact });
  if (item.contact.length <= 5) return item.contact;
  if (item.contact.length === 11) {
    const c = item.contact;
    return `(${c.slice(1, 4)}) ${c.slice(4, 7)}-${c.slice(7)}`;
  }
  return item.contact;
}

function openCrisis(item: CrisisItem, t: Translator) {
  const url = item.type === 'sms'
    ? `sms:${item.contact}${item.body ? `&body=${encodeURIComponent(item.body)}` : ''}`
    : `tel:${item.contact}`;
  Linking.openURL(url).catch(() => {
    Alert.alert(
      t('crisis.cantConnectTitle'),
      t(item.type === 'sms' ? 'crisis.cantConnectText' : 'crisis.cantConnectCall', { number: item.contact }),
    );
  });
}

// Long-press copies the contact number/code so the user can paste it into
// another phone or hand it to a partner without retyping. Crisis flows assume
// motor + cognitive load is high — every retype is an opportunity to fail.
async function copyCrisis(item: CrisisItem, t: Translator) {
  try {
    await Clipboard.setStringAsync(item.contact);
    Alert.alert(t('me.crisisCopiedTitle'), t('me.crisisCopiedBody', { label: item.label, contact: item.contact }));
  } catch {
    /* non-fatal; tap-to-dial still works */
  }
}

type MyStuffLink = {
  /** i18n key under `me.*` — resolved at render time so labels flip on toggle. */
  labelKey: string;
  hint?: string;
  icon: string;
  tab: 'Home' | 'Milk' | 'Experts' | 'Gear';
  screen: string;
};

// Deep-links into destinations that already exist in each tab's stack.
// If a tab isn't currently focused, getParent().navigate(tab, { screen })
// mounts its navigator on the right route.
const MY_STUFF: MyStuffLink[] = [
  { labelKey: 'me.myStuffSavedSpecialists', icon: '🩺', tab: 'Experts', screen: 'Favorites' },
  { labelKey: 'me.myStuffMyEvents',         icon: '📅', tab: 'Home',    screen: 'MyRsvps' },
  { labelKey: 'me.myStuffMyPerks',          icon: '🎁', tab: 'Home',    screen: 'MyClaims' },
  { labelKey: 'me.myStuffMilkInbox',        icon: '💬', tab: 'Milk',    screen: 'MilkMessageThreads' },
  { labelKey: 'me.myStuffMilkOrders',       icon: '📦', tab: 'Milk',    screen: 'MilkOrders' },
  { labelKey: 'me.myStuffSavedDonors',      icon: '⭐', tab: 'Milk',    screen: 'SavedDonors' },
  { labelKey: 'me.myStuffMyGear',           icon: '🛒', tab: 'Gear',    screen: 'MyListings' },
  { labelKey: 'me.myStuffSavedGear',        icon: '💾', tab: 'Gear',    screen: 'SavedGear' },
  { labelKey: 'me.myStuffGearInbox',        icon: '💬', tab: 'Gear',    screen: 'GearMessageThreads' },
];

export default function MeScreen() {
  const navigation = useNavigation<MeNav>();
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useUserStore((s) => s.profile);
  const fetchProfile = useUserStore((s) => s.fetchProfile);
  const setProfile = useUserStore((s) => s.setProfile);
  // Reviewer flag drives the optional "Clinical review" row below. Subscribe so
  // a DB flip (UPDATE users SET is_clinical_reviewer = TRUE) flows through on
  // next fetchProfile without a re-login.
  const isReviewer = useUserStore((s) => s.profile?.is_clinical_reviewer === true);
  const isEventReviewer = useUserStore((s) => s.profile?.is_event_reviewer === true);
  // Pending-count badges for the two reviewer rows. Refetched on focus so
  // each badge drops to zero immediately after a reviewer comes back from
  // approving the last item. Null = not loaded yet (don't render "0").
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingEventCount, setPendingEventCount] = useState<number | null>(null);
  const babyProfile = useHomeStore((s) => s.babyProfile);

  useEffect(() => {
    if (!profile) fetchProfile();
  }, [profile, fetchProfile]);

  // Reviewer-only: fetch the pending-review queue length whenever Me regains
  // focus. RLS + SECURITY DEFINER guard means non-reviewers get an empty list
  // anyway, but we skip the call entirely to save a round-trip. Failures are
  // swallowed — the row still renders without a badge.
  useFocusEffect(
    useCallback(() => {
      if (!isReviewer) {
        setPendingCount(null);
        return;
      }
      let cancelled = false;
      clinicalReviewApi
        .listPending()
        .then((rows) => {
          if (!cancelled) setPendingCount(rows.length);
        })
        .catch(() => {
          if (!cancelled) setPendingCount(null);
        });
      return () => {
        cancelled = true;
      };
    }, [isReviewer]),
  );

  // Same pattern for the event-ingest reviewer queue. Independent role +
  // independent badge — a user could hold one flag, the other, or both.
  useFocusEffect(
    useCallback(() => {
      if (!isEventReviewer) {
        setPendingEventCount(null);
        return;
      }
      let cancelled = false;
      eventReviewApi
        .listPending()
        .then((rows) => {
          if (!cancelled) setPendingEventCount(rows.length);
        })
        .catch(() => {
          if (!cancelled) setPendingEventCount(null);
        });
      return () => {
        cancelled = true;
      };
    }, [isEventReviewer]),
  );

  const goToTab = useCallback((link: MyStuffLink) => {
    // getParent() returns the tab navigator that hosts MeNavigator.
    // We cast to `any` because the bottom-tab ParamList isn't exported in a
    // form that lets us pass nested-screen navigation params through — this
    // is React Navigation's documented cross-tab deep-link pattern.
    const parent = navigation.getParent() as any;
    parent?.navigate(link.tab, { screen: link.screen });
  }, [navigation]);

  const goEditProfile = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  const goRadiusPref = useCallback(() => {
    navigation.navigate('RadiusPreference');
  }, [navigation]);

  const goNotifPrefs = useCallback(() => {
    navigation.navigate('NotificationPreferences');
  }, [navigation]);

  const goChangePassword = useCallback(() => {
    navigation.navigate('ChangePassword');
  }, [navigation]);

  const goChangeEmail = useCallback(() => {
    navigation.navigate('ChangeEmail');
  }, [navigation]);

  const goDeleteAccount = useCallback(() => {
    navigation.navigate('DeleteAccount');
  }, [navigation]);

  // Account deletion lives behind a feature flag — UI ships now, gets exposed
  // once retention/cascade attorney review lands. The screen renders fine
  // when navigated directly (so QA builds can drive it) — only the discovery
  // row is gated.
  const deleteAccountEnabled = process.env.EXPO_PUBLIC_DELETE_ACCOUNT_ENABLED === '1';

  // ClinicalReview is a Stack.Screen on the ROOT navigator (not MeNavigator),
  // so we hop up one level to reach it. Server-side `is_clinical_reviewer()`
  // re-checks via SECURITY DEFINER, so a non-reviewer who forces this nav
  // still can't approve/reject anything — the screen just renders empty.
  const goClinicalReview = useCallback(() => {
    const parent = navigation.getParent() as any;
    parent?.navigate('ClinicalReview');
  }, [navigation]);

  // Same hop-to-root pattern as goClinicalReview — EventReview is a modal
  // mounted on RootNavigator, not MeNavigator. Server `is_event_reviewer()`
  // re-checks every RPC, so forced nav by a non-reviewer renders empty.
  const goEventReview = useCallback(() => {
    const parent = navigation.getParent() as any;
    parent?.navigate('EventReview');
  }, [navigation]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      t('me.signOutConfirmTitle'),
      t('me.signOutConfirmBody'),
      [
        { text: t('me.signOutCancel'), style: 'cancel' },
        {
          text: t('me.signOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (err) {
              Alert.alert(
                t('me.signOutFailedTitle'),
                err instanceof Error ? err.message : t('me.signOutFailedBody'),
              );
            }
          },
        },
      ],
    );
  }, [signOut, t]);

  const handleLanguageChange = useCallback(async (next: 'en' | 'es') => {
    if (!profile || profile.preferred_language === next) return;
    // Optimistic update; revert on error so UI stays honest.
    const prev = profile.preferred_language;
    setProfile({ ...profile, preferred_language: next });
    const { error } = await supabase
      .from('users')
      .update({ preferred_language: next })
      .eq('id', profile.id);
    if (error) {
      setProfile({ ...profile, preferred_language: prev });
      Alert.alert(t('me.saveErrorTitle'), t('me.saveErrorBody'));
    }
  }, [profile, setProfile, t]);

  const email = user?.email ?? '—';
  const fullName = profile?.full_name?.trim() || email.split('@')[0] || 'Your account';
  const initial = (profile?.full_name?.[0] ?? email?.[0] ?? '?').toUpperCase();
  const stageLabel = profile?.pregnancy_stage && STAGE_KEYS[profile.pregnancy_stage]
    ? t(STAGE_KEYS[profile.pregnancy_stage])
    : null;
  const lang = profile?.preferred_language ?? 'en';

  // Profile completion meter — five mutable EditProfile fields (the screen
  // already lets the user fill them all; due_date only counts when the stage
  // requires it). Avatar isn't editable in v1 so we don't penalize a missing
  // one. Returns 0..100 + the labels still missing, suppressed entirely when
  // the profile hasn't loaded so we don't render a misleading "0%" on cold
  // launch.
  const completion = computeCompletion(profile);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        {/* Profile header */}
        <View style={s.header}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{initial}</Text>
            </View>
          )}
          <View style={s.headerMeta}>
            <Text style={s.name} numberOfLines={1}>{fullName}</Text>
            <Text style={s.email} numberOfLines={1}>{email}</Text>
            {stageLabel ? (
              <View style={s.stagePill}>
                <Text style={s.stagePillText}>{stageLabel}</Text>
              </View>
            ) : null}
          </View>
          {profile ? (
            <TouchableOpacity
              onPress={() => handleLanguageChange(lang === 'en' ? 'es' : 'en')}
              style={s.langPill}
              accessibilityRole="button"
              accessibilityLabel={lang === 'en' ? t('me.langSwitchToEs') : t('me.langSwitchToEn')}
              accessibilityHint={lang === 'en' ? t('me.langPillHintEn') : t('me.langPillHintEs')}
            >
              <Text style={s.langPillText}>🌐 {lang === 'en' ? 'EN' : 'ES'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={goEditProfile}
            style={s.editBtn}
            accessibilityRole="button"
            accessibilityLabel={t('me.editA11y')}
          >
            <Text style={s.editBtnText}>{t('me.edit')}</Text>
          </TouchableOpacity>
        </View>

        {/* Profile completion — hidden at 100% and on cold launch (null) */}
        {completion && completion.percent < 100 ? (() => {
          const missingLabels = completion.missing.map((k) => t(`me.${k}`));
          const missingJoinedComma = missingLabels.join(', ');
          const missingJoinedDot = missingLabels.join(' · ');
          return (
            <TouchableOpacity
              style={s.completion}
              onPress={goEditProfile}
              accessibilityRole="button"
              accessibilityLabel={t('me.completionA11y', {
                percent: completion.percent,
                missing: missingJoinedComma,
              })}
            >
              <View style={s.completionHeader}>
                <Text style={s.completionTitle}>{t('me.completionTitle', { percent: completion.percent })}</Text>
                <Text style={s.completionCta}>{t('me.completionCta')}</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${completion.percent}%` }]} />
              </View>
              <Text style={s.completionHint} numberOfLines={2}>
                {t('me.completionHint', { missing: missingJoinedDot })}
              </Text>
            </TouchableOpacity>
          );
        })() : null}

        {/* Baby card */}
        <Section title={t('me.yourBaby')}>
          {babyProfile ? (
            <View style={s.babyRow}>
              <View style={s.babyAvatar}>
                <Text style={s.babyAvatarTxt}>👶</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.babyName}>
                  {babyProfile.baby_name?.trim() || t('me.babyFallbackName')}
                </Text>
                <Text style={s.babyMeta}>
                  {t('me.babyMeta', {
                    age: formatAge(babyProfile.date_of_birth, lang),
                    week: babyProfile.current_week_number,
                  })}
                </Text>
              </View>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>
                {t('me.yourBabyEmpty')}
              </Text>
              <Text style={s.emptyHint}>
                {t('me.yourBabyEmptyHint')}
              </Text>
            </View>
          )}
        </Section>

        {/* My stuff — cross-tab deep-links */}
        <Section title={t('me.myStuff')}>
          {MY_STUFF.map((link, idx) => {
            const label = t(link.labelKey);
            return (
              <TouchableOpacity
                key={`${link.tab}:${link.screen}`}
                style={[s.row, idx === MY_STUFF.length - 1 && s.rowLast]}
                onPress={() => goToTab(link)}
                accessibilityRole="button"
                accessibilityLabel={t('me.myStuffOpenA11y', { label })}
              >
                <Text style={s.rowIcon}>{link.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{label}</Text>
                </View>
                <Text style={s.rowChevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </Section>

        {/* Preferences */}
        <Section title={t('me.preferences')}>
          <View style={[s.row, s.rowColumn]}>
            <Text style={s.rowLabel}>{t('me.language')}</Text>
            <View style={s.langGroup}>
              {SUPPORTED_LANGUAGES.map((code) => {
                const active = lang === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[s.langChip, active && s.langChipActive]}
                    onPress={() => handleLanguageChange(code)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t('me.langChipA11y', { lang: LANGUAGE_LABELS[code] })}
                  >
                    <Text style={[s.langChipText, active && s.langChipTextActive]}>
                      {LANGUAGE_LABELS[code]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <TouchableOpacity
            style={s.row}
            onPress={goRadiusPref}
            accessibilityRole="button"
            accessibilityLabel={t('me.searchRadiusA11y')}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{t('me.searchRadius')}</Text>
              <Text style={s.rowDetail}>
                {t('me.searchRadiusDetail', {
                  miles: profile?.search_radius_miles ?? DEFAULT_SEARCH_RADIUS_MILES,
                })}
              </Text>
            </View>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.row, s.rowLast]}
            onPress={goNotifPrefs}
            accessibilityRole="button"
            accessibilityLabel={t('me.notificationsA11y')}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{t('me.notifications')}</Text>
              <Text style={s.rowDetail}>
                {t('me.notificationsDetail')}
              </Text>
            </View>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
        </Section>

        {/* Account & security */}
        <Section title={t('me.accountSecurity')}>
          <TouchableOpacity
            style={s.row}
            onPress={goChangeEmail}
            accessibilityRole="button"
            accessibilityLabel={t('me.changeEmailA11y')}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{t('me.changeEmail')}</Text>
              <Text style={s.rowDetail} numberOfLines={1}>{email}</Text>
            </View>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.row, !deleteAccountEnabled && s.rowLast]}
            onPress={goChangePassword}
            accessibilityRole="button"
            accessibilityLabel={t('me.changePasswordA11y')}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{t('me.changePassword')}</Text>
              <Text style={s.rowDetail}>{t('me.changePasswordDetail')}</Text>
            </View>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
          {deleteAccountEnabled ? (
            <TouchableOpacity
              style={[s.row, s.rowLast]}
              onPress={goDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel={t('me.deleteAccountA11y')}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, s.rowLabelDanger]}>{t('me.deleteAccount')}</Text>
                <Text style={s.rowDetail}>{t('me.deleteAccountDetail')}</Text>
              </View>
              <Text style={s.rowChevron}>›</Text>
            </TouchableOpacity>
          ) : null}
        </Section>

        {/* Clinical review — reviewer-only entry point. Hidden for everyone
            else; the launcher pill in RootNavigator covers the same surface
            but lives in a corner, so this row is the discoverable path. */}
        {isReviewer ? (
          <Section title="Clinical review">
            <TouchableOpacity
              style={[s.row, s.rowLast]}
              onPress={goClinicalReview}
              accessibilityRole="button"
              accessibilityLabel="Open clinical-advisor review queue"
            >
              <Text style={s.rowIcon}>🩺</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Review queue</Text>
                <Text style={s.rowDetail}>
                  {pendingCount === null
                    ? 'Approve or reject AI-generated weekly-journey content.'
                    : pendingCount === 0
                    ? 'Queue is clear — nothing waiting.'
                    : `${pendingCount} item${pendingCount === 1 ? '' : 's'} waiting for review.`}
                </Text>
              </View>
              {pendingCount && pendingCount > 0 ? (
                <View
                  style={s.reviewBadge}
                  accessibilityLabel={`${pendingCount} pending`}
                >
                  <Text style={s.reviewBadgeText}>{pendingCount}</Text>
                </View>
              ) : null}
              <Text style={s.rowChevron}>›</Text>
            </TouchableOpacity>
          </Section>
        ) : null}

        {/* Event review — ops/curation queue for AI-screened ingest
            candidates. Distinct flag from Clinical review (medical content);
            a user can hold either, both, or neither. */}
        {isEventReviewer ? (
          <Section title="Event review">
            <TouchableOpacity
              style={[s.row, s.rowLast]}
              onPress={goEventReview}
              accessibilityRole="button"
              accessibilityLabel="Open event-ingest review queue"
            >
              <Text style={s.rowIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Review queue</Text>
                <Text style={s.rowDetail}>
                  {pendingEventCount === null
                    ? 'Approve or reject AI-screened event candidates.'
                    : pendingEventCount === 0
                    ? 'Queue is clear — nothing waiting.'
                    : `${pendingEventCount} event${pendingEventCount === 1 ? '' : 's'} waiting for review.`}
                </Text>
              </View>
              {pendingEventCount && pendingEventCount > 0 ? (
                <View
                  style={s.reviewBadge}
                  accessibilityLabel={`${pendingEventCount} pending`}
                >
                  <Text style={s.reviewBadgeText}>{pendingEventCount}</Text>
                </View>
              ) : null}
              <Text style={s.rowChevron}>›</Text>
            </TouchableOpacity>
          </Section>
        ) : null}

        {/* Crisis resources */}
        <Section title={t('me.crisisTitle')} subtitle={t('me.crisisSubtitle')}>
          <View style={s.crisisCallout} accessibilityRole="alert">
            <Text style={s.crisisCalloutTitle}>{t('me.crisisCalloutTitle')}</Text>
            {/* The "911" digits stay outside the i18n template so the inline
                rust-bold style still wraps just the number. The translated
                body wraps it with a token; we render around it. */}
            <Text style={s.crisisCalloutBody}>
              {profile?.preferred_language === 'es'
                ? <>Llama al <Text style={s.crisisCalloutNumber}>911</Text> — o toca cualquier línea de abajo. No necesitas saber qué decir.</>
                : <>Call <Text style={s.crisisCalloutNumber}>911</Text> — or tap any line below. You don&rsquo;t need to know what to say.</>}
            </Text>
          </View>
          {CRISIS_LIST.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={s.row}
              onPress={() => openCrisis(item, t)}
              onLongPress={() => copyCrisis(item, t)}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${formatContact(item, t)}`}
              accessibilityHint={
                item.type === 'sms' ? t('crisis.a11yTextHint') : t('crisis.a11yCallHint')
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowDetail}>{formatContact(item, t)}</Text>
              </View>
              <Text style={s.rowChevron}>{item.type === 'sms' ? '💬' : '📞'}</Text>
            </TouchableOpacity>
          ))}
        </Section>

        {/* Sign out */}
        <Section title={t('me.account')}>
          <TouchableOpacity
            style={[s.row, s.rowDestructive]}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel={t('me.signOut')}
          >
            <Text style={s.signOutTxt}>{t('me.signOut')}</Text>
          </TouchableOpacity>
        </Section>

        <Text style={s.footer}>{t('me.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface CompletionResult {
  percent: number;
  missing: string[];
}

// Postpartum-only audience (decision 2026-04-27): four required slots, all
// stage-independent. due_date used to be a 5th slot for trimester users, but
// that branch went away when TTC + trimester chips were dropped from the
// picker — every postpartum user can now reach 100% without it.
function computeCompletion(
  profile: ReturnType<typeof useUserStore.getState>['profile'],
): CompletionResult | null {
  if (!profile) return null;

  // `key` is the i18n suffix under `me.*` (e.g., 'fieldName' → key `me.fieldName`).
  // Caller resolves with t() at render time so completions flip on language toggle.
  type Field = { key: string; filled: boolean };
  const fields: Field[] = [
    { key: 'fieldName',      filled: !!profile.full_name?.trim() },
    { key: 'fieldStage',     filled: !!profile.pregnancy_stage },
    { key: 'fieldZip',       filled: !!profile.zip_code?.trim() },
    { key: 'fieldInsurance', filled: !!profile.insurance_provider?.trim() },
  ];
  const total = fields.length;
  const filled = fields.filter((f) => f.filled).length;
  const percent = Math.round((filled / total) * 100);
  const missing = fields.filter((f) => !f.filled).map((f) => f.key);
  return { percent, missing };
}

function Section({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  // Editorial section heading — small rust accent bar + uppercase
  // letter-spaced eyebrow, mirroring HomeScreen's sectionEyebrow +
  // sectionAccentBar so Me reads as part of the same magazine spread
  // rather than a settings sheet.
  return (
    <View style={s.section}>
      <View style={s.sectionHeadingRow}>
        <View style={s.sectionAccentBar} />
        <Text style={s.sectionEyebrow}>{title}</Text>
      </View>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={s.card}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  container: { paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.rust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.rustLight,
  },
  avatarTxt: {
    fontFamily: FONTS.headerBold,
    color: COLORS.white,
    fontSize: 26,
  },
  headerMeta: { flex: 1, marginLeft: 14 },
  // Profile name — Playfair italic per the editorial header pattern
  // (eyebrow + Playfair italic title is the canonical magazine
  // signature). 24pt sits between the section eyebrow and the hero
  // titles on Home/Milk so the page lead is felt without dominating.
  name: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 30,
    color: COLORS.brownDeep,
  },
  email: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMid,
    marginTop: 2,
  },
  stagePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(184,92,56,0.12)',
  },
  stagePillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.rustDark,
    letterSpacing: 0.3,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.rust,
    backgroundColor: 'transparent',
    marginLeft: 8,
  },
  editBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.rust,
    letterSpacing: 0.3,
  },
  // Language toggle in the header — single-tap flips EN↔ES so a discharge-day
  // Spanish-speaking user doesn't have to scroll into Preferences to find it.
  // The full segmented control in Preferences stays for clarity / a11y.
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.rust,
    backgroundColor: 'rgba(184,92,56,0.08)',
    marginLeft: 6,
  },
  langPillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.rustDark,
    letterSpacing: 0.4,
  },

  completion: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(184,92,56,0.25)',
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.brownDeep,
    letterSpacing: 0.2,
  },
  completionCta: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.rust,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(184,92,56,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.rust,
  },
  completionHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textMid,
  },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  // Editorial section heading — small rust accent bar + uppercase
  // letter-spaced eyebrow, mirroring HomeScreen's sectionAccentBar +
  // sectionEyebrow pattern so Me reads as part of the same spread.
  sectionHeadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10,
  },
  sectionAccentBar: {
    width: 12, height: 2, backgroundColor: COLORS.rust, borderRadius: 1,
  },
  sectionEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: COLORS.textMid, textTransform: 'uppercase',
  },
  // Kept for legacy callers. New section headings use sectionEyebrow.
  sectionTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMid,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  rowColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 10 },
  rowLast: { borderBottomWidth: 0 },
  rowDestructive: { borderBottomWidth: 0, justifyContent: 'center' },
  rowIcon: { fontSize: 18, marginRight: 12, width: 24, textAlign: 'center' },
  rowLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.textDark,
  },
  rowLabelDanger: { color: COLORS.rustDark },
  rowDetail: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMid,
    marginTop: 2,
  },
  rowChevron: { fontSize: 18, marginLeft: 12 },

  // Crisis section header callout — visually distinct from the action rows so
  // the eye lands on "you don't need to know what to say" before scanning the
  // line items. Lighter rust tint + left border for the same visual language as
  // CrisisResourcesSheet's per-card accent.
  crisisCallout: {
    backgroundColor: '#FFF5F0',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.rust,
    borderRadius: 10,
    padding: 12,
    margin: 14,
    marginBottom: 4,
  },
  crisisCalloutTitle: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.rustDark,
    marginBottom: 4,
  },
  crisisCalloutBody: {
    fontSize: 13,
    color: COLORS.textMid,
    lineHeight: 18,
  },
  crisisCalloutNumber: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.rustDark,
  },

  babyRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  babyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(92,107,58,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  babyAvatarTxt: { fontSize: 22 },
  babyName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.textDark,
  },
  babyMeta: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMid,
    marginTop: 2,
  },

  emptyCard: { paddingHorizontal: 14, paddingVertical: 16 },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMid,
    lineHeight: 18,
  },
  emptyHint: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.rustDark,
    marginTop: 6,
  },

  langGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: COLORS.cream,
  },
  langChipActive: {
    backgroundColor: COLORS.rust,
    borderColor: COLORS.rust,
  },
  langChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  langChipTextActive: { color: COLORS.white },

  // Olive-tinted pill matching the CLN launcher in RootNavigator so the two
  // surfaces visually belong to the same internal-tools subsystem.
  reviewBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: COLORS.olive,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  reviewBadgeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  signOutTxt: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.rustDark,
    textAlign: 'center',
  },
  footer: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 24,
  },
});
