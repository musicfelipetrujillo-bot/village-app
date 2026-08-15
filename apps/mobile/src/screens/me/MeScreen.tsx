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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  isProEnabled, isProUser, restorePro, MANAGE_SUBSCRIPTION_URL, ProUnavailableError,
} from '@/lib/pro';
import {
  COLORS, FONTS, CRISIS_RESOURCES, SUPPORTED_LANGUAGES,
  DEFAULT_SEARCH_RADIUS_MILES,
} from '@utils/constants';
import type { MeStackParamList } from '@/navigation/MeNavigator';
import { useT } from '@/i18n';

// Calm palette — pink-primary. Mirrors the Mama's-corner (MomHubScreen)
// vocabulary: quiet bordered list groups, one warm rose accent, muted ink.
const ROSE = '#C24A63';        // warm accent — name, active chips, primary CTA
const ROSE_DEEP = '#9E2F4C';   // destructive / delete
const INK = '#43260F';         // primary text
const INKSOFT = '#7A5A3A';     // sub-text
const MUTED = '#A6957F';       // faint metadata
const LABEL = '#B06A80';       // muted-rose section labels
const CHEVRON = '#C99AA8';     // dusty-rose chevrons
const ICON_BG = '#F7E7EC';     // blush icon square
const CARD_BG = COLORS.v2_paper;
const GROUP_BORDER = 'rgba(122,74,40,0.14)';
const ROW_DIVIDER = 'rgba(122,74,40,0.12)';

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
  { labelKey: 'me.myStuffMyGear',           icon: '🛒', tab: 'Gear',    screen: 'MyListings' },
  { labelKey: 'me.myStuffGearInbox',        icon: '💬', tab: 'Gear',    screen: 'GearMessageThreads' },
  { labelKey: 'me.myStuffBoxOrders',        icon: '🛍️', tab: 'Home',    screen: 'BoxOrders' },
];

// Villie Boxes is gated OFF until its launch gates clear — hide its "My stuff"
// row unless EXPO_PUBLIC_VILLIE_BOXES_ENABLED=1 (mirrors the Home teaser gate).
const VILLIE_BOXES_ENABLED = process.env.EXPO_PUBLIC_VILLIE_BOXES_ENABLED === '1';
const VISIBLE_MY_STUFF = MY_STUFF.filter(
  (l) => l.screen !== 'BoxOrders' || VILLIE_BOXES_ENABLED,
);

export default function MeScreen() {
  const navigation = useNavigation<MeNav>();
  const insets = useSafeAreaInsets();
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
  const [restoringPro, setRestoringPro] = useState(false);
  // Subscribed purely for reactivity: when the RevenueCat webhook flips
  // users.is_pro, the next fetchProfile must re-render this section. The value
  // actually displayed comes from isProUser(), which prefers live StoreKit
  // state over the column (see lib/pro.ts precedence notes).
  useUserStore((s) => s.profile?.is_pro);
  const isPro = isProUser();
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
  // focus. RLS + SECURITY DEFINER guard means non-reviewers get nothing back
  // anyway, but we skip the call entirely to save a round-trip. Failures are
  // swallowed — the row still renders without a badge.
  //
  // Uses `countPending`, NOT `listPending`. This effect fires on every focus,
  // including the one caused by dismissing the Clinical Review modal — and
  // `listPending` pulls all ~508 pending rows (~460 kB of EN + ES body text)
  // only to read `.length`. Fetching and parsing that on the back gesture was
  // half of why closing the dashboard lagged.
  useFocusEffect(
    useCallback(() => {
      if (!isReviewer) {
        setPendingCount(null);
        return;
      }
      let cancelled = false;
      clinicalReviewApi
        .countPending()
        .then((n) => {
          if (!cancelled) setPendingCount(n);
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

  // BabyProfileSetup lives in the Home tab's stack, so we deep-link cross-tab
  // (same pattern as goToTab). This is the reliable "set up / edit your baby"
  // entry point — the AI-native Home (V3) no longer surfaces one.
  const goBabySetup = useCallback(() => {
    (navigation.getParent() as any)?.navigate('Home', { screen: 'BabyProfileSetup' });
  }, [navigation]);

  const goRadiusPref = useCallback(() => {
    navigation.navigate('RadiusPreference');
  }, [navigation]);

  const goNotifPrefs = useCallback(() => {
    navigation.navigate('NotificationPreferences');
  }, [navigation]);

  // The Paywall is a root-level modal, so walk past the tab navigator to the
  // root stack (same pattern as the Manual's locked-video cards).
  const goPaywall = useCallback(() => {
    let root: any = navigation;
    while (root?.getParent?.()) root = root.getParent();
    root?.navigate('Paywall', { source: 'me' });
  }, [navigation]);

  // Cancelling an auto-renewable is Apple's sheet, never ours — we can only
  // hand the user there.
  const goManageSubscription = useCallback(() => {
    Linking.openURL(MANAGE_SUBSCRIPTION_URL).catch(() => {
      // Deep link unavailable (simulator / no App Store) — nothing useful to
      // say beyond the row's own subtitle, so stay quiet.
    });
  }, []);

  // Apple requires a reachable restore path; the paywall has one, but a user
  // who reinstalls arrives here first and never sees a locked video.
  const onRestorePro = useCallback(async () => {
    if (restoringPro) return;
    setRestoringPro(true);
    try {
      const entitled = await restorePro();
      if (entitled) {
        fetchProfile().catch(() => {});
        Alert.alert(t('paywall.restoredTitle'), t('paywall.restoredBody'));
      } else {
        Alert.alert(t('paywall.noRestoreTitle'), t('paywall.noRestoreBody'));
      }
    } catch (e) {
      if (e instanceof ProUnavailableError) {
        Alert.alert(t('paywall.soonTitle'), t('paywall.soonBody'));
      } else {
        Alert.alert(t('paywall.errorTitle'), t('paywall.errorBody'));
      }
    } finally {
      setRestoringPro(false);
    }
  }, [restoringPro, fetchProfile, t]);

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
      {/* Calm page wash — paper-white middle, faint warm blush top + bottom. */}
      <LinearGradient
        colors={PAGE_BG_COLORS as unknown as readonly [string, string, ...string[]]}
        locations={PAGE_BG_LOCATIONS as unknown as readonly [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Profile header — quiet paper block: avatar + name + stage + actions.
            No loud gradient / sheen; the one warm accent is the rose name. */}
        <View style={[s.header, { paddingTop: insets.top + 18 }]}>
          {/* Villie bee brand mark */}
          <Animated.Image source={VILLIE_BEE} resizeMode="contain"
            accessible={false}
            style={[s.headerBee, { transform: [{ translateX: beeTranslateX }, { translateY: beeTranslateY }, { rotate: '12deg' }] }]} />

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
              {stageLabel ? (
                <View style={s.stagePill}>
                  <Text style={s.stagePillText}>{stageLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={s.headerActions}>
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

        {/* Your baby — tap to open BabyProfileSetup (lives in the Home tab's stack). */}
        <GroupLabel>{t('me.yourBaby')}</GroupLabel>
        <Group>
          {babyProfile ? (
            <TouchableOpacity
              style={s.babyRow}
              activeOpacity={0.7}
              onPress={goBabySetup}
              accessibilityRole="button"
              accessibilityLabel={t('me.editBabyCta')}
            >
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
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.emptyCard}
              activeOpacity={0.85}
              onPress={goBabySetup}
              accessibilityRole="button"
              accessibilityLabel={t('me.setUpBabyCta')}
            >
              <Text style={s.emptyText}>
                {t('me.yourBabyEmpty')}
              </Text>
              <View style={s.babySetupBtn}>
                <Text style={s.babySetupBtnTxt}>{t('me.setUpBabyCta')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </Group>

        {/* Your stuff — Saved dashboard + cross-tab deep-links. */}
        <GroupLabel>{t('me.myStuff')}</GroupLabel>
        <Group>
          <MeRow
            icon="♥"
            title={t('me.myStuffSaved')}
            onPress={() => navigation.navigate('SavedDashboard')}
            a11yLabel={t('me.myStuffOpenA11y', { label: t('me.myStuffSaved') })}
          />
          {VISIBLE_MY_STUFF.map((link, idx) => (
            <MeRow
              key={`${link.tab}:${link.screen}`}
              icon={link.icon}
              title={t(link.labelKey)}
              onPress={() => goToTab(link)}
              last={idx === VISIBLE_MY_STUFF.length - 1}
              a11yLabel={t('me.myStuffOpenA11y', { label: t(link.labelKey) })}
            />
          ))}
        </Group>

        {/* Preferences */}
        <GroupLabel>{t('me.preferences')}</GroupLabel>
        <Group>
          <View style={[s.row, s.rowColumn, s.rowDivider]}>
            <View style={s.rowHead}>
              <View style={s.iconSquare}><Text style={s.iconGlyph}>🌐</Text></View>
              <Text style={s.rowTitle}>{t('me.language')}</Text>
            </View>
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
          <MeRow
            icon="📍"
            title={t('me.searchRadius')}
            sub={t('me.searchRadiusDetail', {
              miles: profile?.search_radius_miles ?? DEFAULT_SEARCH_RADIUS_MILES,
            })}
            onPress={goRadiusPref}
            a11yLabel={t('me.searchRadiusA11y')}
          />
          <MeRow
            icon="🔔"
            title={t('me.notifications')}
            sub={t('me.notificationsDetail')}
            onPress={goNotifPrefs}
            last
            a11yLabel={t('me.notificationsA11y')}
          />
        </Group>

        {/* Subscription — only in builds that carry the StoreKit SDK. On an
            OTA-only bundle there is nothing to restore or manage, so the whole
            section stays out rather than dead-ending. */}
        {isProEnabled() ? (
          <>
            <GroupLabel>{t('me.subscription')}</GroupLabel>
            <Group>
              <MeRow
                icon="✦"
                title={t('me.proRow')}
                sub={isPro ? t('me.proActiveDetail') : t('me.proInactiveDetail')}
                onPress={isPro ? goManageSubscription : goPaywall}
                a11yLabel={isPro ? t('me.proManageA11y') : t('me.proOpenA11y')}
                right={isPro ? (
                  <View style={s.proBadge}>
                    <Text style={s.proBadgeText}>{t('me.proActive')}</Text>
                  </View>
                ) : undefined}
              />
              {isPro ? (
                <MeRow
                  icon="⚙️"
                  title={t('me.proManage')}
                  sub={t('me.proManageDetail')}
                  onPress={goManageSubscription}
                  last
                  a11yLabel={t('me.proManageA11y')}
                />
              ) : (
                <MeRow
                  icon="↺"
                  title={restoringPro ? t('paywall.restoring') : t('me.proRestore')}
                  sub={t('me.proRestoreDetail')}
                  onPress={onRestorePro}
                  last
                  a11yLabel={t('me.proRestoreA11y')}
                />
              )}
            </Group>
          </>
        ) : null}

        {/* Account & security */}
        <GroupLabel>{t('me.accountSecurity')}</GroupLabel>
        <Group>
          <MeRow
            icon="✉️"
            title={t('me.changeEmail')}
            sub={email}
            onPress={goChangeEmail}
            a11yLabel={t('me.changeEmailA11y')}
          />
          <MeRow
            icon="🔒"
            title={t('me.changePassword')}
            sub={t('me.changePasswordDetail')}
            onPress={goChangePassword}
            last={!deleteAccountEnabled}
            a11yLabel={t('me.changePasswordA11y')}
          />
          {deleteAccountEnabled ? (
            <MeRow
              icon="🗑️"
              title={t('me.deleteAccount')}
              sub={t('me.deleteAccountDetail')}
              onPress={goDeleteAccount}
              danger
              last
              a11yLabel={t('me.deleteAccountA11y')}
            />
          ) : null}
        </Group>

        {/* Admin tools — dev-build-only entry. The actual authority check
            lives server-side in the admin-specialist-invite edge function
            (ADMIN_USER_IDS allowlist); non-admin taps surface as a friendly
            403 on submit. Suppressed in TestFlight/App Store builds. */}
        {__DEV__ ? (
          <>
            <GroupLabel>Admin</GroupLabel>
            <Group>
              <MeRow
                icon="✉️"
                title="Specialist invites"
                sub="Issue a one-time invite link in-app."
                onPress={() => navigation.navigate('AdminInvite')}
                last
                a11yLabel="Open specialist invite admin tool"
              />
            </Group>
          </>
        ) : null}

        {/* Clinical review — reviewer-only entry point. */}
        {isReviewer ? (
          <>
            <GroupLabel>Clinical review</GroupLabel>
            <Group>
              <MeRow
                icon="🩺"
                title="Review queue"
                sub={pendingCount === null
                  ? 'Approve or reject AI-generated weekly-journey content.'
                  : pendingCount === 0
                  ? 'Queue is clear — nothing waiting.'
                  : `${pendingCount} item${pendingCount === 1 ? '' : 's'} waiting for review.`}
                onPress={goClinicalReview}
                last
                a11yLabel="Open clinical-advisor review queue"
                right={pendingCount && pendingCount > 0 ? (
                  <View style={s.reviewBadge} accessibilityLabel={`${pendingCount} pending`}>
                    <Text style={s.reviewBadgeText}>{pendingCount}</Text>
                  </View>
                ) : undefined}
              />
            </Group>
          </>
        ) : null}

        {/* Event review — ops/curation queue for AI-screened ingest
            candidates. Distinct flag from Clinical review. */}
        {isEventReviewer ? (
          <>
            <GroupLabel>Event review</GroupLabel>
            <Group>
              <MeRow
                icon="📅"
                title="Review queue"
                sub={pendingEventCount === null
                  ? 'Approve or reject AI-screened event candidates.'
                  : pendingEventCount === 0
                  ? 'Queue is clear — nothing waiting.'
                  : `${pendingEventCount} event${pendingEventCount === 1 ? '' : 's'} waiting for review.`}
                onPress={goEventReview}
                last
                a11yLabel="Open event-ingest review queue"
                right={pendingEventCount && pendingEventCount > 0 ? (
                  <View style={s.reviewBadge} accessibilityLabel={`${pendingEventCount} pending`}>
                    <Text style={s.reviewBadgeText}>{pendingEventCount}</Text>
                  </View>
                ) : undefined}
              />
            </Group>
          </>
        ) : null}

        {/* Support — crisis resources, always available. */}
        <GroupLabel>{t('me.crisisTitle')}</GroupLabel>
        <View style={s.crisisCallout} accessibilityRole="alert">
          <Text style={s.crisisCalloutTitle}>{t('me.crisisCalloutTitle')}</Text>
          {/* The "911" digits stay outside the i18n template so the inline
              rose-bold style still wraps just the number. */}
          <Text style={s.crisisCalloutBody}>
            {profile?.preferred_language === 'es'
              ? <>Llama al <Text style={s.crisisCalloutNumber}>911</Text> — o toca cualquier línea de abajo. No necesitas saber qué decir.</>
              : <>Call <Text style={s.crisisCalloutNumber}>911</Text> — or tap any line below. You don&rsquo;t need to know what to say.</>}
          </Text>
        </View>
        <Group>
          <MeRow
            icon="🚑"
            title={profile?.preferred_language === 'es' ? 'En una emergencia' : 'In an emergency'}
            sub={profile?.preferred_language === 'es' ? 'RCP infantil, fiebres, cuándo llamar' : 'infant CPR, fevers, when to call'}
            onPress={() => (navigation.getParent() as any)?.getParent()?.navigate('QuickReference')}
            a11yLabel={profile?.preferred_language === 'es' ? 'En una emergencia — referencia rápida' : 'In an emergency — quick reference'}
          />
          {CRISIS_LIST.map((item, idx) => (
            <MeRow
              key={item.label}
              icon={item.type === 'sms' ? '💬' : '📞'}
              title={item.label}
              sub={formatContact(item, t)}
              onPress={() => openCrisis(item, t)}
              onLongPress={() => copyCrisis(item, t)}
              delayLongPress={400}
              last={idx === CRISIS_LIST.length - 1}
              a11yLabel={`${item.label}: ${formatContact(item, t)}`}
              a11yHint={item.type === 'sms' ? t('crisis.a11yTextHint') : t('crisis.a11yCallHint')}
            />
          ))}
        </Group>

        {/* Sign out */}
        <Group>
          <TouchableOpacity
            style={s.signOutRow}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel={t('me.signOut')}
          >
            <Text style={s.signOutTxt}>{t('me.signOut')}</Text>
          </TouchableOpacity>
        </Group>

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
                <DevPill label="AGT" bg="#43260F" fg="#E6D8C4"
                  onPress={() => { setDevOpen(false); (navigation.getParent() as any)?.navigate('InternalAgents'); }}
                  a11y="Open internal agents console"
                />
              ) : null}
              {showClinicalReview ? (
                <DevPill label="CLN" bg="#E98A6A" fg="#FFFCF6"
                  onPress={() => { setDevOpen(false); goClinicalReview(); }}
                  a11y="Open clinical-advisor review dashboard"
                />
              ) : null}
              {showEventReview ? (
                <DevPill label="EVT" bg="#E98A6A" fg="#43260F"
                  onPress={() => { setDevOpen(false); goEventReview(); }}
                  a11y="Open event-ingest review dashboard"
                />
              ) : null}
            </>
          ) : null}
          <DevPill
            label={devOpen ? '×' : 'DEV'}
            bg="#43260F"
            fg="#FFFCF6"
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

// Short uppercase-mono muted label above each quiet list group — mirrors the
// calm Mama's-corner (MomHubScreen) vocabulary. One per group, not per row.
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.groupLabel}>{children}</Text>;
}

// Quiet bordered list group — paper bg, hairline group border, radius 18.
// Rows sit inside with their own hairline dividers (MomRow pattern).
function Group({ children }: { children: React.ReactNode }) {
  return <View style={s.group}>{children}</View>;
}

// One calm list row: blush icon square + short title + optional ≤5-word sub +
// chevron (or a custom right slot: a badge, etc.). Divider unless `last`.
function MeRow({
  icon, title, sub, onPress, onLongPress, delayLongPress,
  right, danger = false, last = false, a11yLabel, a11yHint,
}: {
  icon: string;
  title: string;
  sub?: string;
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  right?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
  a11yLabel?: string;
  a11yHint?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      activeOpacity={0.7}
      style={[s.row, !last && s.rowDivider]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? title}
      accessibilityHint={a11yHint}
    >
      <View style={s.iconSquare}><Text style={s.iconGlyph}>{icon}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowTitle, danger && s.rowTitleDanger]}>{title}</Text>
        {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right !== undefined ? right : <Text style={s.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  container: { paddingBottom: 48 },

  // Header — quiet paper block. No gradient cover / sheen / hairline rule;
  // the profile identity is dialled back so the page reads calm.
  header: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    marginBottom: 4,
    position: 'relative',
  },
  headerBee: {
    position: 'absolute',
    right: 14, top: 58,
    width: 78, height: 72,
    opacity: 0.5,
    transform: [{ rotate: '12deg' }],
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.sandSoft,
    borderWidth: 1,
    borderColor: 'rgba(61,31,13,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(61,31,13,0.14)',
    backgroundColor: COLORS.sandSoft,
  },
  avatarTxt: {
    fontFamily: FONTS.headerBold,
    color: COLORS.bark,
    fontSize: 24,
  },
  headerMeta: { flex: 1, marginLeft: 14 },
  // The one warm accent on the header — the name in rose.
  name: {
    fontFamily: FONTS.v3_display,
    fontSize: 22,
    lineHeight: 27,
    color: ROSE,
    letterSpacing: -0.4,
  },
  email: {
    fontFamily: FONTS.v2_body,
    fontSize: 12.5,
    color: INKSOFT,
    marginTop: 2,
  },
  stagePill: {
    alignSelf: 'flex-start',
    marginTop: 7,
    backgroundColor: ICON_BG,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  stagePillText: {
    fontFamily: FONTS.v2_mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: LABEL,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  langPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    backgroundColor: CARD_BG,
  },
  langPillText: {
    fontFamily: FONTS.v2_link,
    fontSize: 11,
    color: INK,
    letterSpacing: 0.3,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(194,74,99,0.35)',
    backgroundColor: CARD_BG,
  },
  editBtnText: {
    fontFamily: FONTS.v2_link,
    fontSize: 11,
    color: ROSE,
    letterSpacing: 0.3,
  },

  // Completion meter — calmed to rose, sits under the header.
  completion: {
    marginHorizontal: 22,
    marginTop: 4,
    marginBottom: 18,
    padding: 15,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(194,74,99,0.28)',
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionTitle: {
    fontFamily: FONTS.v2_link,
    fontSize: 13,
    color: INK,
    letterSpacing: 0.2,
  },
  completionCta: {
    fontFamily: FONTS.v2_link,
    fontSize: 12,
    color: ROSE,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(194,74,99,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ROSE,
  },
  completionHint: {
    marginTop: 8,
    fontFamily: FONTS.v2_body,
    fontSize: 12,
    color: INKSOFT,
  },

  // Short muted-rose section label above each group (one per group).
  groupLabel: {
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 9,
    fontFamily: FONTS.v2_mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: LABEL,
  },
  // Quiet bordered list group — paper bg, hairline border, radius 18.
  group: {
    marginHorizontal: 22,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },

  // One calm row.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ROW_DIVIDER,
  },
  rowColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 11 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconSquare: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: ICON_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  iconGlyph: { fontSize: 17 },
  rowTitle: {
    fontFamily: FONTS.v3_display,
    fontSize: 15.5,
    color: INK,
    letterSpacing: -0.2,
  },
  rowTitleDanger: { color: ROSE_DEEP },
  rowSub: {
    fontFamily: FONTS.v2_body,
    fontSize: 11.5,
    color: INKSOFT,
    marginTop: 1,
  },
  chevron: { fontFamily: FONTS.v2_link, fontSize: 20, color: CHEVRON },

  // Support / crisis callout — soft blush card above the crisis group.
  crisisCallout: {
    marginHorizontal: 22,
    marginBottom: 10,
    backgroundColor: COLORS.pinkSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(194,74,99,0.30)',
    borderRadius: 14,
    padding: 13,
  },
  crisisCalloutTitle: {
    fontSize: 13,
    fontFamily: FONTS.v2_link,
    color: ROSE_DEEP,
    marginBottom: 4,
  },
  crisisCalloutBody: {
    fontFamily: FONTS.v2_body,
    fontSize: 13,
    color: INKSOFT,
    lineHeight: 18,
  },
  crisisCalloutNumber: {
    fontFamily: FONTS.v2_bold,
    color: ROSE_DEEP,
  },

  // Baby row / empty state.
  babyRow: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  babyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyAvatarTxt: { fontSize: 20 },
  babyName: {
    fontFamily: FONTS.v3_display,
    fontSize: 15.5,
    color: INK,
    letterSpacing: -0.2,
  },
  babyMeta: {
    fontFamily: FONTS.v2_body,
    fontSize: 11.5,
    color: INKSOFT,
    marginTop: 1,
  },
  babySetupBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: ROSE,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  babySetupBtnTxt: { color: '#FFFCF6', fontSize: 13, fontFamily: FONTS.v2_link },
  emptyCard: { paddingHorizontal: 15, paddingVertical: 15 },
  emptyText: {
    fontFamily: FONTS.v2_body,
    fontSize: 13,
    color: INKSOFT,
    lineHeight: 18,
  },

  // Language chips (inside Preferences).
  langGroup: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 47,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    backgroundColor: COLORS.cream,
  },
  langChipActive: {
    backgroundColor: ROSE,
    borderColor: ROSE,
  },
  langChipText: {
    fontFamily: FONTS.v2_link,
    fontSize: 13,
    color: INK,
  },
  langChipTextActive: { color: '#FFFCF6' },

  // Reviewer count badge (rose, replaces the old olive pill).
  // Subscription status pill — replaces the chevron on the villie pro row.
  proBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: ICON_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ROSE,
    marginRight: 8,
  },
  proBadgeText: {
    fontFamily: FONTS.v2_bold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: ROSE,
  },
  reviewBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: ROSE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  reviewBadgeText: {
    fontFamily: FONTS.v2_bold,
    fontSize: 12,
    color: '#FFFCF6',
    letterSpacing: 0.3,
  },

  // Sign out — sober, centered, its own group.
  signOutRow: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutTxt: {
    fontFamily: FONTS.v2_link,
    fontSize: 14,
    color: ROSE_DEEP,
    textAlign: 'center',
  },
  footer: {
    fontFamily: FONTS.v2_body,
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
    marginTop: 24,
  },
});
