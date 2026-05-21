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

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Linking, Alert, Image, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const _BEE_N = 60;
const _BEE_INPUT = Array.from({ length: _BEE_N + 1 }, (_, i) => i / _BEE_N);
const _BEE_SINE_Y = _BEE_INPUT.map(
  t => (1 - t) * (60 - Math.sin(t * Math.PI * 2.5) * 20)
);
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// AsyncStorage key — gates the FIRST focus per app session so the bee
// doesn't auto-replay on every cold launch the same day. In-session
// tab refocus still replays the bee.
const BEE_LAST_PLAYED_KEY = 'village.beeLastPlayedDate.v1';

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

// Page background gradient — tan-to-blush, consistent with Inbox / Manual.
// v9 page wash — 7-stop U-shape gradient: warm pink at top + bottom,
// paper-white middle. Matches HomeScreen + Manual Home so every tab
// reads as the same paper page.
const PAGE_BG_COLORS = [
  '#FDF1EB', '#FDF8F4', '#FCFCFB',
  '#FCFCFB', '#FCF6EF', '#F9E9DD', '#F5DFD3',
] as const;
const PAGE_BG_LOCATIONS = [0, 0.12, 0.30, 0.62, 0.76, 0.90, 1] as const;

// DEV tools pill — same env gate as RootNavigator. The pill renders
// inside MeScreen (outside the ScrollView) so it stays anchored below
// the Edit button and never shifts on scroll.
const INTERNAL_AGENTS_ENABLED =
  process.env.EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED === '1';

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
  tab: 'Home' | 'Milk' | 'Experts' | 'Gear' | 'Manual';
  screen: string;
};

// Deep-links into destinations that already exist in each tab's stack.
// If a tab isn't currently focused, getParent().navigate(tab, { screen })
// mounts its navigator on the right route.
// Unified Saved dashboard row — handled separately because it's in-tab nav
// (Me → SavedDashboard), not cross-tab. The dashboard itself surfaces all
// four saves types so the individual SavedManual / Favorites / SavedDonors
// / SavedGear rows were removed from MY_STUFF to declutter (each is still
// reachable via the "See all →" link inside the dashboard).
const MY_STUFF: MyStuffLink[] = [
  { labelKey: 'me.myStuffMyEvents',         icon: '📅', tab: 'Home',    screen: 'MyRsvps' },
  { labelKey: 'me.myStuffMyPerks',          icon: '🎁', tab: 'Home',    screen: 'MyClaims' },
  { labelKey: 'me.myStuffMilkInbox',        icon: '💬', tab: 'Milk',    screen: 'MilkMessageThreads' },
  { labelKey: 'me.myStuffMilkOrders',       icon: '📦', tab: 'Milk',    screen: 'MilkOrders' },
  { labelKey: 'me.myStuffMyGear',           icon: '🛒', tab: 'Gear',    screen: 'MyListings' },
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
  const [devOpen, setDevOpen] = useState(false);
  const showClinicalReview = INTERNAL_AGENTS_ENABLED || isReviewer;
  const showEventReview = INTERNAL_AGENTS_ENABLED || isEventReviewer;
  const showDevTools = INTERNAL_AGENTS_ENABLED || showClinicalReview || showEventReview;
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const clearUnreadNotifs = useHomeStore((s) => s.clearUnreadNotifs);

  const beeAnim    = useRef(new Animated.Value(0)).current;
  const beeRandX   = useRef(new Animated.Value(0)).current;
  const beeRandY   = useRef(new Animated.Value(0)).current;
  // First-focus-of-session ref — see VillageHomeScreen for rationale.
  // Daily gate on first focus, replay on every subsequent leave+return.
  const firstFocusRef = useRef(true);
  const beeBaseX = useRef(beeAnim.interpolate({ inputRange: [0, 1], outputRange: [-300, 0] })).current;
  const beeBaseY = useRef(beeAnim.interpolate({ inputRange: _BEE_INPUT, outputRange: _BEE_SINE_Y })).current;
  const beeFade  = useRef(beeAnim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, 1] })).current;
  const beeTranslateX = useRef(Animated.add(beeBaseX, Animated.multiply(beeRandX, beeFade))).current;
  const beeTranslateY = useRef(Animated.add(beeBaseY, Animated.multiply(beeRandY, beeFade))).current;

  useEffect(() => {
    if (!profile) fetchProfile();
  }, [profile, fetchProfile]);

  // Clear the tab badge the moment the user opens Profile.
  useFocusEffect(useCallback(() => {
    clearUnreadNotifs();
    let cancelled = false;
    (async () => {
      const isFirst = firstFocusRef.current;
      firstFocusRef.current = false;
      if (isFirst) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const last = await AsyncStorage.getItem(BEE_LAST_PLAYED_KEY);
          if (last === today) return;
          await AsyncStorage.setItem(BEE_LAST_PLAYED_KEY, today);
        } catch {
          // storage error → fall through and play
        }
      }
      if (cancelled) return;
      beeRandX.setValue((Math.random() - 0.5) * 24);
      beeRandY.setValue((Math.random() - 0.5) * 16);
      beeAnim.setValue(0);
      Animated.timing(beeAnim, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }).start();
    })();
    return () => { cancelled = true; };
  }, [clearUnreadNotifs, beeAnim, beeRandX, beeRandY]));

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
    <View style={s.safe}>
      {/* v9 page wash — paper-white middle, warm pink wash top + bottom.
          Plain View (not SafeAreaView) so the header card can bleed to
          the very top edge of the screen — header.paddingTop: 56
          reserves space for the status bar. */}
      <LinearGradient
        colors={PAGE_BG_COLORS as unknown as readonly [string, string, ...string[]]}
        locations={PAGE_BG_LOCATIONS as unknown as readonly [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={s.container}>
        {/* Profile header — soft full-bleed pastel cover card. Pale
            golden-rose wash keeps the identity dialled back; bark text +
            coco italic name + hairline rule carry HomeScreen's vibe. */}
        <View style={s.header}>
          <LinearGradient
            colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* iOS-26 wet-glass top sheen — matches Home + Manual */}
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18 }}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
          {/* Villie bee brand mark */}
          <Animated.Image source={VILLIE_BEE} resizeMode="contain"
            accessible={false}
            style={[s.headerBee, { transform: [{ translateX: beeTranslateX }, { translateY: beeTranslateY }, { rotate: '12deg' }] }]} />

          {/* Eyebrow: stage label */}
          {stageLabel ? (
            <View style={s.eyebrowRow}>
              <View style={s.eyebrowBar} />
              <Text style={s.eyebrow}>{stageLabel.toUpperCase()}</Text>
            </View>
          ) : null}

          {/* Avatar + name + controls row */}
          <View style={s.headerMainRow}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarTxt}>{initial}</Text>
              </View>
            )}
            <View style={s.headerMeta}>
              <Text style={s.name} numberOfLines={1}>{fullName}</Text>
              {email && email !== '—' ? (
                <Text style={s.email} numberOfLines={1}>{email}</Text>
              ) : null}
            </View>
            <View style={s.headerControls}>
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
          </View>
          <View style={s.headerRule} />
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

        {/* My stuff — cross-tab deep-links + Saved dashboard. Saved dash
            sits at the top because it's the unified hub for all four
            saved-content types (videos / specialists / donors / gear). */}
        <Section title={t('me.myStuff')}>
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate('SavedDashboard')}
            accessibilityRole="button"
            accessibilityLabel={t('me.myStuffOpenA11y', { label: t('me.myStuffSaved') })}
          >
            <Text style={s.rowIcon}>♥</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{t('me.myStuffSaved')}</Text>
            </View>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
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

      {/* DEV tools pill — fixed in the card header area, right edge aligned
          with the edit button. Stays anchored even when scrolling. */}
      {showDevTools ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 150,
            right: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {devOpen ? (
            <>
              {INTERNAL_AGENTS_ENABLED ? (
                <DevPill label="AGT" bg="#1C1008" fg="#E6D8C4"
                  onPress={() => { setDevOpen(false); (navigation.getParent() as any)?.navigate('InternalAgents'); }}
                  a11y="Open internal agents console"
                />
              ) : null}
              {showClinicalReview ? (
                <DevPill label="CLN" bg="#5C6B3A" fg="#FDFBF6"
                  onPress={() => { setDevOpen(false); goClinicalReview(); }}
                  a11y="Open clinical-advisor review dashboard"
                />
              ) : null}
              {showEventReview ? (
                <DevPill label="EVT" bg="#C4A35A" fg="#1C1008"
                  onPress={() => { setDevOpen(false); goEventReview(); }}
                  a11y="Open event-ingest review dashboard"
                />
              ) : null}
            </>
          ) : null}
          <DevPill
            label={devOpen ? '×' : 'DEV'}
            bg="#2C1A0E"
            fg="#FDFBF6"
            onPress={() => setDevOpen((v) => !v)}
            a11y={devOpen ? 'Close dev tools menu' : 'Open dev tools menu'}
          />
        </View>
      ) : null}
    </View>
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
function DevPill({ label, bg, fg, onPress, a11y }: {
  label: string; bg: string; fg: string; onPress: () => void; a11y: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, opacity: 0.85 }}
    >
      <Text style={{ color: fg, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>
    </TouchableOpacity>
  );
}

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

  // Soft full-bleed cover card — matches InboxHomeScreen.header dimensions
  // exactly so every tab masthead reads the same size. paddingBottom is
  // tight so the hairline rule sits right at the card's bottom edge.
  header: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 6,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: 8,
    // v9 paper-leaning shadow — was 0.10/4y/12r/elev2. Now lifts the
    // masthead off the U-shape backdrop like Home's card recipe.
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 18,
    elevation: 5,
    position: 'relative',
  },
  headerBee: {
    // Bee hovers between the name and the Edit pill, leaning towards Edit.
    // Edit lives in `headerControls` at the right edge with 20px header
    // padding; right: 50 sits the bee ~50px from screen right, which is
    // just left of the controls stack — over the meta column past the name.
    position: 'absolute',
    right: 50, top: 64,
    width: 88, height: 80,
    opacity: 0.55,
    transform: [{ rotate: '12deg' }],
  },
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  eyebrowBar: {
    width: 22, height: 2,
    backgroundColor: '#A77349',  // v9 rust-deep — unified across surfaces
    marginRight: 10,
  },
  eyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold,
    color: '#A77349',
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerControls: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.sandSoft,
    borderWidth: 1,
    borderColor: 'rgba(61,31,13,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(61,31,13,0.18)',
    backgroundColor: COLORS.sandSoft,
  },
  avatarTxt: {
    fontFamily: FONTS.headerBold,
    color: COLORS.bark,
    fontSize: 26,
  },
  headerMeta: { flex: 1, marginLeft: 14 },
  // Italic Playfair in coco — mirrors HomeScreen.greetingNameAccent.
  name: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 30,
    color: '#C07840',
  },
  email: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(61,31,13,0.22)',
    backgroundColor: 'transparent',
  },
  editBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.bark,
    letterSpacing: 0.3,
  },
  langPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(61,31,13,0.22)',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  langPillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.bark,
    letterSpacing: 0.4,
  },
  // Hairline rule — matches HomeScreen.greetingRule.
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 14,
    width: 48,
  },

  completion: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.paper,
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
    color: COLORS.bark,
    letterSpacing: 0.2,
  },
  completionCta: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: '#C07840',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(184,92,56,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.coco,
  },
  completionHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.barkSoft,
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
    width: 12, height: 2, backgroundColor: '#A77349', borderRadius: 1,
  },
  sectionEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: '#A77349', textTransform: 'uppercase',
  },
  // Kept for legacy callers. New section headings use sectionEyebrow.
  sectionTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.bark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.barkSoft,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 80, 50, 0.18)',
    // v9 lift — same cocoa drop recipe as Home cards
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
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
    color: COLORS.bark,
  },
  rowLabelDanger: { color: COLORS.cocoDeep },
  rowDetail: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.barkSoft,
    marginTop: 2,
  },
  rowChevron: { fontSize: 18, marginLeft: 12 },

  // Crisis section header callout — visually distinct from the action rows so
  // the eye lands on "you don't need to know what to say" before scanning the
  // line items. Lighter rust tint + full cinnamon hairline (side-stripe was a
  // v9 absolute ban — replaced with a full border in the same accent color).
  crisisCallout: {
    backgroundColor: COLORS.pinkSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(192,120,64,0.45)',
    borderRadius: 10,
    padding: 12,
    margin: 14,
    marginBottom: 4,
  },
  crisisCalloutTitle: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: '#A77349',
    marginBottom: 4,
  },
  crisisCalloutBody: {
    fontSize: 13,
    color: COLORS.barkSoft,
    lineHeight: 18,
  },
  crisisCalloutNumber: {
    fontFamily: FONTS.bodySemiBold,
    color: '#A77349',
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
    color: COLORS.bark,
  },
  babyMeta: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.barkSoft,
    marginTop: 2,
  },

  emptyCard: { paddingHorizontal: 14, paddingVertical: 16 },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
    lineHeight: 18,
  },
  emptyHint: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: '#A77349',
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
    borderColor: 'rgba(150,80,50,0.18)',
    backgroundColor: COLORS.cream,
  },
  langChipActive: {
    backgroundColor: COLORS.coco,
    borderColor: COLORS.coco,
  },
  langChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.bark,
  },
  langChipTextActive: { color: COLORS.paper },

  // Olive-tinted pill matching the CLN launcher in RootNavigator so the two
  // surfaces visually belong to the same internal-tools subsystem.
  reviewBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  reviewBadgeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.paper,
    letterSpacing: 0.3,
  },
  signOutTxt: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: '#A77349',
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
