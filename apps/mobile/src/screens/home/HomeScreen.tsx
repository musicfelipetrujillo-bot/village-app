// V4 Phase G7 — Full HomeScreen (mockup-aligned redesign)
// Renders cards from home_feed_cache (populated by home-feed-curator Edge Fn).
// Falls back to the static layout when the feed is empty or the user has
// no baby profile yet — nothing is AI-required to see Home.
//
// 2026-04-25 redesign: top wordmark + bell, large rust-bg HeroWeekCard with
// Playfair italic week number, baby-this-week card, two-up You/Village row,
// and a 4-icon Help grid. Keeps the existing feed/curator wiring intact —
// the personalized feed cards still render below the help grid so curator
// output is visible without breaking the new aesthetic.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect , useNavigation } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Image, ImageSourcePropType,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '@utils/constants';
import { useAuthStore } from '@store/auth';
import { useHomeStore } from '@store/home';
import { useUserStore } from '@store/user';
import { useEventsStore } from '@store/events';
import { usePerksStore } from '@store/perks';
import {
  formatAge,
  type HomeFeedCard,
  type MilestoneBlockPayload,
  type EventsBlockPayload,
  type PerksBlockPayload,
  type GearTipBlockPayload,
} from '@api/home';
import { weeklyJourneyApi, type ChecklistItem } from '@api/weekly-journey';
import { isQuietHoursActive, formatHour12 } from '@utils/quietHours';
import { useT } from '@/i18n';
import CrisisResourcesSheet from '@components/community/CrisisResourcesSheet';
import { useAnalytics } from '@/hooks/useAnalytics';
import {
  YolkCircle, YolkRing, ScribbleMark, DotCluster, LeafSprig, SparkleMark,
} from '@components/shared/DecorativeMarks';
import WarmGlowBackdrop from '@components/shared/WarmGlowBackdrop';
import CardGlowAccent from '@components/shared/CardGlowAccent';
import EditorialLede from '@components/shared/EditorialLede';
import EditorialSectionHead from '@components/shared/EditorialSectionHead';

// Versioned key — bump if we ever want a new orientation card to surface to
// users who already dismissed the previous one.
const DISCHARGE_WELCOME_KEY = 'village.dischargeWelcomeDismissed.v1';

// Brand wordmark — "villie" logotype with bee mark (1182×827, ≈1.43:1).
const WORDMARK = require('../../../assets/brand/villie-wordmark-sm.png');
// Villie bee — brand mark used as a decorative accent in the masthead.
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// Header banner variant — flip to compare looks.
//   'A' = soft blush watercolor wash (static, editorial pink)
//   'D' = time-of-day wash (blush sunrise → rust afternoon → olive dusk)
//   'off' = no banner, flat cream
const HOME_BANNER_VARIANT: 'A' | 'D' | 'off' = 'off';

// Pre-rendered gradient PNGs (4×512 RGBA, ease-out alpha curve baked in).
// We render a single <Image resizeMode="stretch"> over the header — RN
// bilinear-scales the asset which gives a perfectly smooth gradient with
// zero new native dependencies (no expo-linear-gradient, no react-native-svg).
const BANNER_BLUSH      = require('../../../assets/gradients/banner-blush.png');
const BANNER_YOLK       = require('../../../assets/gradients/banner-yolk.png');
const BANNER_RUST       = require('../../../assets/gradients/banner-rust.png');
const BANNER_RUST_LIGHT = require('../../../assets/gradients/banner-rust-light.png');
const BANNER_OLIVE      = require('../../../assets/gradients/banner-olive.png');

function getBannerAsset(variant: 'A' | 'D' | 'off'): ImageSourcePropType | null {
  if (variant === 'off') return null;
  if (variant === 'A') return BANNER_RUST_LIGHT;
  const h = new Date().getHours();
  if (h < 5)  return BANNER_OLIVE; // pre-dawn
  if (h < 12) return BANNER_YOLK;  // morning
  if (h < 18) return BANNER_RUST;  // afternoon
  return BANNER_OLIVE;             // evening
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const profile = useUserStore((s) => s.profile);
  const fetchProfile = useUserStore((s) => s.fetchProfile);
  const {
    babyProfile, currentMilestone, feed, todayCheckin, loading, fetchAll,
  } = useHomeStore();
  const { upcoming, fetchUpcoming } = useEventsStore();
  const { perks, fetchPerks } = usePerksStore();
  const analytics = useAnalytics();
  const [crisisVisible, setCrisisVisible] = useState(false);

  // One-shot discharge welcome card — shown on first launch for early-postpartum
  // users (the hospital-handoff moment). `null` = unhydrated, `true` = dismissed
  // and never to render again on this device, `false` = render. Persisted via
  // AsyncStorage so the card never reappears after the user dismisses it.
  // Key is versioned (`.v1`) so we can re-show a future re-themed orientation
  // card without cross-version collisions.
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DISCHARGE_WELCOME_KEY)
      .then((v) => { if (!cancelled) setWelcomeDismissed(v === '1'); })
      .catch(() => { if (!cancelled) setWelcomeDismissed(true); }); // fail-safe: hide on storage error
    return () => { cancelled = true; };
  }, []);
  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    analytics.trackEvent('home_discharge_welcome_dismissed');
    AsyncStorage.setItem(DISCHARGE_WELCOME_KEY, '1').catch(() => {
      // Best-effort: if storage fails, the card will render again next launch.
      // That's acceptable degradation — the alternative is showing it forever.
    });
  }, [analytics]);

  // Postpartum 0–6 weeks is the highest-risk window for PPD/PPA and the most
  // common audience for the hospital-discharge handoff. Surface a calm
  // always-here crisis card on Home so a tired mom never has to dig.
  // Heuristic:
  //   - stage = postpartum_0_6mo (covers 0–6 months — superset of our window)
  //   - AND either no baby_profile (fresh signup, baby presumed brand new)
  //     OR baby_profile.current_week_number ≤ 6
  // Stage is the canonical signal — if a user mis-set stage, the card stays
  // hidden, but they can always reach the same resources from Me.
  const earlyPostpartum = useMemo(() => {
    if (profile?.pregnancy_stage !== 'postpartum_0_6mo') return false;
    if (!babyProfile) return true;
    const w = babyProfile.current_week_number;
    return typeof w !== 'number' || w <= 6;
  }, [profile?.pregnancy_stage, babyProfile]);

  const openCrisisSheet = useCallback(() => {
    analytics.trackEvent('home_crisis_card_opened');
    setCrisisVisible(true);
  }, [analytics]);

  useEffect(() => {
    if (user) {
      if (!profile) fetchProfile();
      fetchAll();
      fetchUpcoming();
      fetchPerks();
    }
  }, [user, profile, fetchProfile, fetchAll, fetchUpcoming, fetchPerks]);

  // Daily check-in auto-popup — when a user lands on Home and hasn't checked in
  // today, push the DailyCheckin modal in front of them once per session. The
  // modal route owns its own dismiss/submit flow and returns to Home when done.
  // `checkinPromptShownRef` guards against re-firing (e.g. after `fetchAll`
  // updates `todayCheckin` from null → object on submit) and against showing
  // again if the user backs out without submitting on the same session.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [animTrigger, setAnimTrigger] = useState(0);

  // Fire bee fly-in after the screen gains focus — so the animation plays
  // after the check-in modal is dismissed, not hidden behind it.
  useFocusEffect(useCallback(() => {
    setAnimTrigger(n => n + 1);
  }, []));

  // Stable parallax values for inline bee decorations (explore + greeting).
  // Pre-computed in refs so the native driver never loses them across renders.
  const exploreBeeX = useRef(
    scrollY.interpolate({ inputRange: [0, 500], outputRange: [0, 50], extrapolate: 'clamp' })
  ).current;
  const greetingBeeX = useRef(
    scrollY.interpolate({ inputRange: [0, 500], outputRange: [0, 35], extrapolate: 'clamp' })
  ).current;

  const checkinPromptShownRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!babyProfile) return;          // wait for profile load — empty-state path doesn't need the prompt
    if (todayCheckin) return;          // already checked in today
    if (checkinPromptShownRef.current) return;
    checkinPromptShownRef.current = true;
    navigation.navigate('DailyCheckin');
  }, [loading, babyProfile, todayCheckin, navigation]);

  const onRefresh = useCallback(() => {
    fetchAll();
    fetchUpcoming();
    fetchPerks();
  }, [fetchAll, fetchUpcoming, fetchPerks]);

  const firstName = profile?.full_name?.split(' ')[0] ?? t('home.friendFallback');
  const greeting = t(getGreetingKey());

  const cards = useMemo(
    () => [...(feed?.cards ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
    [feed],
  );

  const tabParent = navigation.getParent?.();
  const rootNav = tabParent?.getParent?.();

  const onHelpFeeding = () => tabParent?.navigate('Experts');
  const onHelpEmotional = () => navigation.navigate('DailyCheckin');
  const onHelpFindMoms = () => tabParent?.navigate('Milk');
  const onHelpAskVillage = () => rootNav?.navigate('AIHelpChat');

  return (
    <View style={styles.pageRoot}>
      {/* Warm-glow backdrop — atmospheric mustard + apricot corner blobs over
          cream, mirroring the editorial gradient effect from the design
          artifact. Fixed behind the scroll so it stays anchored to the
          viewport (doesn't scroll away with content). */}
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={animTrigger} />
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.coco} />}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
      {/* Header banner — pre-rendered gradient PNG bilinear-scaled by RN.
          Single <Image> beats N stacked Views for smoothness because the GPU
          interpolates pixels instead of stacking discrete slice rectangles. */}
      {HOME_BANNER_VARIANT !== 'off' ? (
        <Image
          source={getBannerAsset(HOME_BANNER_VARIANT)!}
          resizeMode="stretch"
          style={styles.headerBannerImage}
        />
      ) : null}

      {/* App-bar: brand wordmark only. Notifications surface via the
          Profile tab badge (tab bar) rather than a bell here. */}
      <Image
        source={WORDMARK}
        style={styles.wordmarkImg}
        resizeMode="contain"
        accessibilityLabel="villie"
      />

      <View style={styles.greetingBlock}>
        {/* Two small companion bees — drift right on scroll */}
        <Animated.Image source={VILLIE_BEE} resizeMode="contain" accessible={false}
          style={[styles.greetingBeeSmall1, { transform: [{ translateX: greetingBeeX }, { rotate: '10deg' }] }]} />
        <Animated.Image source={VILLIE_BEE} resizeMode="contain" accessible={false}
          style={[styles.greetingBeeSmall2, { transform: [{ translateX: greetingBeeX }, { rotate: '-18deg' }] }]} />
        <View style={styles.greetingDateRow}>
          <View style={styles.greetingDateBar} />
          <Text style={styles.greetingDate}>{formatHeaderDate()}</Text>
        </View>
        <Text style={styles.greetingName}>
          {greeting} <Text style={styles.greetingNameAccent}>{firstName}.</Text>
        </Text>
        <View style={styles.greetingRule} />
        <QuietHoursPill />
      </View>

      {/* Discharge welcome — one-shot orientation card for the hospital-handoff
          moment. Renders ABOVE the daily check-in so a brand-new postpartum
          mom sees a soft "you're in the right place" beat before being asked
          how she's feeling. Self-dismisses, persists per-device, never returns
          on that device once dismissed. */}
      {earlyPostpartum && welcomeDismissed === false ? (
        <DischargeWelcomeCard onDismiss={dismissWelcome} />
      ) : null}

      {loading && !babyProfile ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.coco} />
        </View>
      ) : !babyProfile ? (
        <EmptyBabyProfileCard onSetup={() => navigation.navigate('BabyProfileSetup')} />
      ) : (
        <>
          {/* BABY snapshot — moved to the very top of the home stack so the
              user lands on their baby's name + week before any editorial or
              check-in prompts. */}
          <BabySnapshotCard
            name={babyProfile.baby_name}
            age={formatAge(
              babyProfile.date_of_birth,
              (profile?.preferred_language ?? 'en') as 'en' | 'es',
            )}
            weekNumber={babyProfile.current_week_number}
            feedingMethod={babyProfile.feeding_method}
            onEdit={() => navigation.navigate('BabyProfileSetup')}
          />

          {/* Combined Weekly + Manual editorial card — gradient top band with
              large italic Playfair week number on the left and Manual mini-tile
              panel on the right, checklist body below, footer CTAs for the
              weekly guide and full manual. */}
          <WeeklyManualCombinedCard
            feedCard={cards.find((c) => c.block === 'milestone')}
            weekNumber={babyProfile.current_week_number}
            fallbackDescription={
              currentMilestone?.description ?? t('home.milestoneFallbackDesc')
            }
            onWeekPress={() =>
              navigation.navigate('WeeklyJourney', { week: babyProfile.current_week_number })
            }
            onManualPress={() => tabParent?.navigate('Manual')}
            onCategoryPress={(audience, category, label) =>
              tabParent?.navigate('Manual', {
                screen: 'ManualCategory',
                params: { audience, category, label },
              })
            }
          />

          {/* Daily check-in — now opens automatically as a popup modal when
              the user lands on Home without a check-in for today (see the
              `checkinPromptShownRef` effect at the top of the screen). The
              inline CheckinBanner was removed; only the crisis-flagged
              follow-up banner remains, since that one matters AFTER a
              checkin has already been submitted and surfaces a hard signal
              the user shouldn't miss. */}
          {todayCheckin?.crisis_flagged ? (
            <CheckinBanner
              state="crisis"
              previewMood={todayCheckin?.mood_score}
              onPress={() => navigation.navigate('CheckinResponse', { checkinId: todayCheckin.id })}
            />
          ) : null}

          {/* Calm always-here crisis card — early-postpartum window only.
              Sits below the check-in so it never crowds the primary daily
              action, but stays above the editorial sections so a fragile user
              can find it without scrolling. */}
          {earlyPostpartum ? (
            <EarlyPostpartumCrisisCard onPress={openCrisisSheet} />
          ) : null}

          {/* HOW CAN WE HELP — 4 warm quick-launch tiles wrapped in a card
              surface so it lifts off the gradient background when scrolled. */}
          <View style={styles.helpCard}>
            {/* Tiny bee bottom-right — brand playfulness, pointerEvents none */}
            <Image
              source={VILLIE_BEE}
              resizeMode="contain"
              accessible={false}
              style={styles.helpCardBee}
            />
          <View style={styles.helpHeading}>
            <View style={[styles.sectionHeadingRow, { paddingHorizontal: 0, marginTop: 0 }]}>
              <View style={styles.sectionAccentBar} />
              <Text style={styles.sectionEyebrow}>{t('home.howCanWeHelp')}</Text>
            </View>
            <Text style={styles.helpHeadingLead}>{t('home.helpSectionLead')}</Text>
            <View style={styles.helpHeadingRule} />
          </View>
          <View style={styles.helpGrid}>
            {/* Brand Kit v5 help-tile palette — each tile gets a distinct
                primary-or-secondary tint so the row reads as 4 different
                "moments". Marks pick the coco/bark/sage that contrasts
                strongest with each tint:
                  • Feeding   — pink (primary)        + coco mark
                  • Emotional — sandSoft (warm calm)  + coco mark
                  • Find moms — sage @ light (calm)   + sage mark
                  • Ask Villie— pinkSoft (quiet)      + bark mark
            */}
            <HelpTile mark="yolkCircle" markTint={COLORS.coco}  label={t('home.helpFeeding')}    sub={t('home.helpFeedingSub')}    tint={COLORS.pink}     onPress={onHelpFeeding} />
            <HelpTile mark="yolkRing"   markTint={COLORS.coco}  label={t('home.helpEmotional')}  sub={t('home.helpEmotionalSub')}  tint={COLORS.sandSoft} onPress={onHelpEmotional} />
            <HelpTile mark="leafSprig"  markTint={COLORS.sage}  label={t('home.helpFindMoms')}   sub={t('home.helpFindMomsSub')}   tint="#D8DFC4"          onPress={onHelpFindMoms} />
            <HelpTile mark="sparkle"    markTint={COLORS.bark}  label={t('home.helpAskVillage')} sub={t('home.helpAskVillageSub')} tint={COLORS.pinkSoft} onPress={onHelpAskVillage} />
          </View>
          </View>

          {/* WANDER VILLIE — card wrapping heading + 2x2 grid, matching helpCard. */}
          <View style={styles.exploreCard}>
            <Animated.Image
              source={VILLIE_BEE}
              resizeMode="contain"
              accessible={false}
              style={[styles.exploreHeadingBee, { transform: [{ translateX: exploreBeeX }, { rotate: '-12deg' }] }]}
            />
            <View style={[styles.sectionHeadingRow, { marginBottom: 4 }]}>
              <View style={styles.sectionAccentBar} />
              <Text style={styles.sectionEyebrow}>{t('home.exploreEyebrow')}</Text>
              <Image source={VILLIE_BEE} resizeMode="contain" accessible={false}
                style={styles.exploreEyebrowBee} />
            </View>
            <Text style={[styles.exploreHeadingLead, { paddingHorizontal: 12 }]}>{t('home.exploreLead')}</Text>
            <View style={[styles.exploreHeadingRule, { marginHorizontal: 12 }]} />
            <View style={styles.exploreGrid}>
              <ExploreTile
                label={t('home.exploreSpecialistsLabel')}
                sub={t('home.exploreSpecialistsSub')}
                photo={require('../../../assets/photos/specialist.jpg')}
                tint={COLORS.pink}
                onPress={() => tabParent?.navigate('Experts')}
              />
              <ExploreTile
                label={t('home.exploreMilkLabel')}
                sub={t('home.exploreMilkSub')}
                photo={require('../../../assets/photos/milk.jpg')}
                tint={COLORS.sandSoft}
                onPress={() => tabParent?.navigate('Milk')}
              />
              <ExploreTile
                label={t('home.exploreGearLabel')}
                sub={t('home.exploreGearSub')}
                photo={require('../../../assets/photos/gear.jpg')}
                tint="#D8DFC4"
                onPress={() => tabParent?.navigate('Gear')}
              />
              <ExploreTile
                label={t('home.exploreEventsLabel')}
                sub={t('home.exploreEventsSub')}
                photo={require('../../../assets/photos/events.jpg')}
                tint={COLORS.cocoSoft}
                onPress={() => navigation.navigate('EventsList')}
              />
            </View>
          </View>

        </>
      )}

      {/* Moodboard parity — Home stops after the EXPLORE 2×2 grid. The previously
          stacked extras (BabyThisWeek, You/Village twoUp, BabySnapshot, timeline,
          HelpGrid, Featured, curator feed cards, teasers) live one tap deeper:
          milestone detail, MilestoneTimeline, DiscoverHome, EventsList, PerksList,
          and the AI help chat modal. Reference: editorial moodboard (greeting →
          hero week → statement → EXPLORE). */}

      {/* Modal stays mounted regardless of stage — only the discovery card
          is gated. Useful if we add a different entry point later. */}
      <CrisisResourcesSheet
        visible={crisisVisible}
        onClose={() => setCrisisVisible(false)}
        lead={t('home.crisisCardSheetLead')}
      />
    </Animated.ScrollView>
    </View>
  );
}

// Early-postpartum crisis card. Calm, supportive — not alarmist. Olive accent
// (matches the "always here" palette in Me's crisis section) instead of the
// rust used by the daily-checkin crisis state, so a non-crisis user doesn't
// read this card as a warning.
function EarlyPostpartumCrisisCard({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <TouchableOpacity
      style={styles.ppCrisisCard}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={t('home.crisisCardA11y')}
    >
      <Text style={styles.ppCrisisEyebrow}>{t('home.crisisCardEyebrow')}</Text>
      <Text style={styles.ppCrisisTitle}>{t('home.crisisCardTitle')}</Text>
      <Text style={styles.ppCrisisBody}>{t('home.crisisCardBody')}</Text>
      <Text style={styles.ppCrisisCta}>{t('home.crisisCardCta')}</Text>
    </TouchableOpacity>
  );
}

// Discharge welcome card — one-shot orientation for the hospital-handoff
// moment. Cream backing + soft rust eyebrow + small dismiss target top-right.
// Copy is clinician-handoff-grade (per the hospital-discharge GTM memory):
// names the moment, sets expectations for the first 6 weeks, and points the
// user at the in-app surfaces that will carry them through it.
function DischargeWelcomeCard({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  return (
    <View
      style={styles.welcomeCard}
      accessibilityRole="summary"
      accessibilityLabel={t('home.dischargeWelcomeA11y')}
    >
      {/* Top dash — coco hairline marker, signals "section moment" */}
      <View style={styles.welcomeTopBar} />
      {/* Row 1: eyebrow + dismiss × */}
      <View style={styles.welcomeRowTop}>
        <Text style={styles.welcomeEyebrow}>{t('home.dischargeWelcomeEyebrow')}</Text>
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('home.dischargeWelcomeDismissA11y')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.welcomeDismissIcon}>×</Text>
        </TouchableOpacity>
      </View>
      {/* Row 2: title + Got it pill share the same row */}
      <View style={styles.welcomeRowMid}>
        <Text style={styles.welcomeTitle} numberOfLines={2}>{t('home.dischargeWelcomeTitle')}</Text>
        <TouchableOpacity
          style={styles.welcomeCta}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('home.dischargeWelcomeCta')}
        >
          <Text style={styles.welcomeCtaText}>{t('home.dischargeWelcomeCta')}</Text>
        </TouchableOpacity>
      </View>
      {/* Row 3: short body — context for what villie covers */}
      <Text style={styles.welcomeBody}>{t('home.dischargeWelcomeBody')}</Text>
    </View>
  );
}

// CheckinBanner — two visual modes:
//   • pending / answered → compact single-row pill so daily check-in doesn't
//     dominate the page on first scroll. The eyebrow + title + arrow read as a
//     calm prompt, not a hero block. Tap → DailyCheckin / CheckinResponse.
//   • crisis → full-bodied card (earned visual weight, never collapsed).
function CheckinBanner({
  state, previewMood, onPress,
}: { state: 'pending' | 'answered' | 'crisis'; previewMood?: number; onPress: () => void }) {
  const t = useT();

  if (state === 'crisis') {
    return (
      <TouchableOpacity
        style={[styles.checkinCard, styles.checkinCardCrisis]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('home.checkinCrisisTitle')}
        activeOpacity={0.9}
      >
        <Text style={[styles.checkinEyebrow, styles.checkinEyebrowCrisis]}>
          {t('home.checkinCrisisEyebrow')}
        </Text>
        <Text style={styles.checkinTitle}>{t('home.checkinCrisisTitle')}</Text>
        <Text style={styles.checkinBody}>{t('home.checkinCrisisBody')}</Text>
        <Text style={styles.checkinCta}>{t('home.checkinAnsweredOpen')}</Text>
      </TouchableOpacity>
    );
  }

  // Pending / answered → compact pill. Single line on a small phone, wraps to
  // two on a larger one. Mood emoji preview replaces body copy when answered.
  const isPending = state === 'pending';
  const title = isPending ? t('home.checkinPrompt') : t('home.checkinAnsweredTitle');
  const cta = isPending ? t('home.checkinStart') : t('home.checkinAnsweredOpen');
  const moodGlyph = !isPending && typeof previewMood === 'number'
    ? ['😞', '😕', '🙂', '😊', '🤩'][Math.max(0, Math.min(4, previewMood - 1))]
    : '☑';

  const eyebrow = t('home.checkinPendingEyebrow');

  return (
    <TouchableOpacity
      style={styles.checkinCompact}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${cta}`}
      activeOpacity={0.9}
    >
      {/* Soft yolk-circle accent in the upper-left corner — moodboard
          editorial mark. Sits behind the mood dot. */}
      <YolkCircle size={48} top={-10} left={-12} tint={COLORS.sandSoft} opacity={0.55} />
      <View style={styles.checkinCompactDot}>
        <Text style={styles.checkinCompactDotText}>{moodGlyph}</Text>
      </View>
      <View style={styles.checkinCompactTextCol}>
        <Text style={styles.checkinCompactEyebrow}>{eyebrow}</Text>
        <Text style={styles.checkinCompactTitle} numberOfLines={1}>{title}</Text>
      </View>
      <View style={styles.checkinCompactCtaPill}>
        <Text style={styles.checkinCompactCtaPillText}>{cta}</Text>
      </View>
    </TouchableOpacity>
  );
}

// TODAY · WEEK twin card — the most important Home block. Combines today's
// daily check-in (left half) with this week's journey (right half) into one
// editorial spread. Each half is independently tappable; a thin hairline
// divider lets them read as one magazine page rather than two stacked cards.
// Crisis state is handled at the parent (renders as full-bleed alert above).
function TodayWeekTwinCard({
  checkinState, previewMood, onCheckinPress,
  feedCard, fallback, onWeekPress,
}: {
  checkinState: 'pending' | 'answered' | 'crisis';
  previewMood?: number;
  onCheckinPress: () => void;
  feedCard: HomeFeedCard | undefined;
  fallback: { weekNumber: number; title: string; description: string; heroEmoji: string };
  onWeekPress: (week: number) => void;
}) {
  const t = useT();
  const p = feedCard?.payload as unknown as MilestoneBlockPayload | undefined;
  const weekNumber = p?.week_number ?? fallback.weekNumber;
  const description = p?.long_copy ?? p?.description ?? fallback.description;

  const isPending = checkinState === 'pending';
  const checkinTitle = isPending ? t('home.checkinPrompt') : t('home.checkinAnsweredTitle');
  const checkinCta = isPending ? t('home.checkinStart') : t('home.checkinAnsweredOpen');
  const moodGlyph = !isPending && typeof previewMood === 'number'
    ? ['😞', '😕', '🙂', '😊', '🤩'][Math.max(0, Math.min(4, previewMood - 1))]
    : '☑';

  return (
    <View style={styles.twinCard}>
      {/* Shared header dropped — the two half-eyebrows ("HOW YOU FEEL" /
          "YOUR WEEK") + the divider already unify the card; a "TODAY · WEEK
          N" banner above repeated the week number rendered huge on the
          right half. Cleaner without it. */}
      <View style={styles.twinRow}>
        {/* LEFT — daily check-in (calm, olive-tinted) */}
        <TouchableOpacity
          style={styles.twinHalfLeft}
          onPress={onCheckinPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${checkinTitle} — ${checkinCta}`}
        >
          <View style={styles.twinMoodDot}>
            <Text style={styles.twinMoodGlyph}>{moodGlyph}</Text>
          </View>
          <Text style={styles.twinHalfEyebrow}>{t('home.twinTodayEyebrow')}</Text>
          <Text style={styles.twinHalfTitle} numberOfLines={2}>{checkinTitle}</Text>
          <Text style={styles.twinHalfCta}>{checkinCta}</Text>
        </TouchableOpacity>

        {/* Vertical hairline — the visual unifier. Thin, low-opacity,
            ceramicDeep so it disappears into the paper. */}
        <View style={styles.twinDivider} />

        {/* RIGHT — weekly journey (Playfair italic week number, soft yolk
            circle accent in upper-right corner). */}
        <TouchableOpacity
          style={styles.twinHalfRight}
          onPress={() => onWeekPress(weekNumber)}
          activeOpacity={0.94}
          accessibilityRole="button"
          accessibilityLabel={t('home.heroWeekFmt', { week: weekNumber })}
        >
          <YolkCircle size={56} top={-12} right={-12} tint={COLORS.sandSoft} opacity={0.55} />
          <Text style={styles.twinHalfEyebrow}>{t('home.twinWeekEyebrow')}</Text>
          <Text style={styles.twinWeekText}>{t('home.heroWeekFmt', { week: weekNumber })}</Text>
          <Text style={styles.twinHalfBody} numberOfLines={2}>{description}</Text>
          <Text style={styles.twinHalfCta}>{t('home.heroCta')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Hero week card — moodboard-aligned. Cream paper background w/ rust eyebrow,
// Playfair italic headline, muted body, soft yolk-circle accent + arrow pill on
// right. Replaces the prior rust-on-rust block which read too loud against the
// rest of the editorial palette.
const YOU_THIS_WEEK_PHOTO = require('../../../assets/photos/perks.jpg');
const VILLAGE_TODAY_PHOTO = require('../../../assets/photos/specialist.jpg');

function HeroWeekCard({
  feedCard, fallback, onPress,
}: {
  feedCard: HomeFeedCard | undefined;
  fallback: { weekNumber: number; title: string; description: string; heroEmoji: string };
  onPress: (week: number) => void;
}) {
  const t = useT();
  const p = feedCard?.payload as unknown as MilestoneBlockPayload | undefined;
  const weekNumber = p?.week_number ?? fallback.weekNumber;
  const description = p?.long_copy ?? p?.description ?? fallback.description;

  return (
    <TouchableOpacity
      style={styles.heroCard}
      onPress={() => onPress(weekNumber)}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={t('home.heroWeekFmt', { week: weekNumber })}
    >
      {/* Warm rust-light gradient tint — same asset as the page banner, at
          50% opacity behind the card content. Carries the page's warm tone
          into the focal hero card without competing with the text. */}
      <Image
        source={BANNER_RUST_LIGHT}
        resizeMode="stretch"
        style={styles.heroCardGradient}
      />
      {/* Inside-card editorial blobs — mustard top-right + apricot bottom-left,
          mirroring the `.cardA .portrait .blob1/.blob2` pattern from the
          Specialist Card Concepts artifact. Reuses the page-level glow PNGs
          at lower opacity so the visual idiom matches. */}
      <CardGlowAccent size={240} topRightOpacity={0.55} bottomLeftOpacity={0.30} />
      {/* Yolk-circle accent behind the right side — moodboard's "Sarah is 3
          weeks today" card mark. Sits behind the arrow pill. */}
      <YolkCircle size={84} top={-18} right={-16} tint={COLORS.sandSoft} opacity={0.7} />
      <ScribbleMark size={28} top={14} right={92} tint={COLORS.bark} />
      <View style={styles.heroTextCol}>
        <Text style={styles.heroEyebrow}>{t('home.heroEyebrow')}</Text>
        <Text style={styles.heroWeekText}>{t('home.heroWeekFmt', { week: weekNumber })}</Text>
        <Text style={styles.heroTagline} numberOfLines={3}>{description}</Text>
        {/* CTA pill — sits on its own row at the bottom of the card, right-
            aligned. Folds the prior bottom-right arrow circle and the
            standalone link text into a single rust pill so the headline
            stays a clean italic moment without a heavy button next to it. */}
        <View style={styles.heroCtaPill}>
          <Text style={styles.heroCtaPillText} numberOfLines={1}>{t('home.heroCta')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Combined Weekly Guide + Manual card. Two sections share a single paper
// surface: the top half is a shortened weekly preview (italic week numeral,
// milestone tagline, up to 3 essential to-dos with inline toggle, "See your
// Editorial hybrid card: gradient top band (left = Playfair italic week number +
// milestone tagline, right = Manual mini-tiles), warm body with checklist preview,
// footer row with two CTAs. To-do checkboxes stop propagation so a tick doesn't
// fire nav into WeeklyJourney. Checklist data is fetched lazily via the existing
// weekly-journey RPC (soft-fail — the card still renders without to-dos).
function WeeklyManualCombinedCard({
  feedCard, weekNumber, fallbackDescription, onWeekPress, onManualPress, onCategoryPress,
}: {
  feedCard: HomeFeedCard | undefined;
  weekNumber: number;
  fallbackDescription: string;
  onWeekPress: () => void;
  onManualPress: () => void;
  onCategoryPress: (audience: 'mom' | 'baby', category: string, label: string) => void;
}) {
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const p = feedCard?.payload as unknown as MilestoneBlockPayload | undefined;
  // Teaser: first sentence only — stops at the first period so it reads as a
  // punchy topic list rather than a full explanation. Full text lives in WeeklyJourney.
  const rawDesc = p?.description ?? fallbackDescription;
  const teaser = rawDesc.match(/^[^.]+\./)?.[0] ?? rawDesc;

  // Weekly checklist data load + toggle removed when the hero card lost
  // its inline checklist. Full list still lives on WeeklyJourneyScreen.

  return (
    <View style={styles.combinedCard}>
      {/* Solid top band — one calm brand color so the focal point is the
          week number, not a gradient. Matches the Restrained color strategy. */}
      <View style={styles.combinedCardTop}>
        {/* Bees — faint decorative accent in the gap between left and divider */}
        <View pointerEvents="none" style={[styles.bee, { top: 6, right: 148, opacity: 0.09 }]}>
          <Text style={{ fontSize: 20, transform: [{ rotate: '14deg' }] }}>🐝</Text>
        </View>
        <View pointerEvents="none" style={[styles.bee, { bottom: 8, right: 108, opacity: 0.07 }]}>
          <Text style={{ fontSize: 13, transform: [{ rotate: '-22deg' }] }}>🐝</Text>
        </View>

        {/* Left: eyebrow + large italic Playfair week number + milestone tagline */}
        <View style={styles.combinedCardLeft}>
          <Text style={styles.combinedEyebrow}>{t('home.heroEyebrow')}</Text>
          <View style={styles.combinedNumRow}>
            <Text style={styles.combinedWeekNum}>{weekNumber}</Text>
            <Text style={styles.combinedWkLabel}>WK</Text>
          </View>
          <TouchableOpacity onPress={onWeekPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Read full milestone">
            <Text style={styles.combinedTagline} numberOfLines={2}>{teaser}</Text>
            <Text style={styles.combinedTaglineMore}>Read more →</Text>
          </TouchableOpacity>
        </View>

        {/* Vertical hairline divider */}
        <View style={styles.combinedDivider} />

        {/* Right: Manual mini-tile panel — mirrors the updated Manual tab.
            Surfaces 5 high-frequency postpartum categories pulled from both
            audiences (mom + baby) so a discharge-week user reaches both
            sides of the manual without leaving the hero card. Order is the
            same order they appear on the Manual home grid: mom Feel /
            mom Heal / baby Feed / baby Sleep / mom Tips. */}
        <View style={styles.combinedCardRight}>
          <View>
            <Text style={styles.combinedManualEyebrow}>MANUAL</Text>
            <View style={styles.combinedTiles}>
              <TouchableOpacity
                style={[styles.combinedTile, { backgroundColor: COLORS.pinkDeep }]}
                onPress={() => onCategoryPress('mom', 'feel', 'Feel')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Feel — mom emotions guide"
              >
                <Text style={[styles.combinedTileLabel, { color: COLORS.paper }]}>Feel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.combinedTile, { backgroundColor: COLORS.sageDeep ?? COLORS.sage }]}
                onPress={() => onCategoryPress('mom', 'heal', 'Heal')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Heal — mom recovery guide"
              >
                <Text style={[styles.combinedTileLabel, { color: COLORS.paper }]}>Heal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.combinedTile, { backgroundColor: COLORS.sand }]}
                onPress={() => onCategoryPress('baby', 'feed', 'Feed')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Feed — baby feeding guide"
              >
                <Text style={[styles.combinedTileLabel, { color: COLORS.paper }]}>Feed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.combinedTile, { backgroundColor: COLORS.coco }]}
                onPress={() => onCategoryPress('baby', 'sleep', 'Sleep')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Sleep — baby sleep guide"
              >
                <Text style={[styles.combinedTileLabel, { color: COLORS.paper }]}>Sleep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.combinedTile, { backgroundColor: COLORS.rust }]}
                onPress={() => onCategoryPress('mom', 'tips', 'Tips')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Tips — mom hacks"
              >
                <Text style={[styles.combinedTileLabel, { color: COLORS.paper }]}>Tips</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Footer — two quiet links: jump to this week's guide, or to the full
          manual. The week-N checklist that previously sat above has been
          removed to keep the hero card focused on this-week-and-categories. */}
      <View style={styles.combinedCardBody}>
        <View style={styles.combinedFooterRow}>
          <TouchableOpacity
            onPress={onWeekPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('home.heroCta')}
          >
            <Text style={styles.combinedFooterLinkText} numberOfLines={1}>{t('home.heroCta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onManualPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('home.statementA11y')}
          >
            <Text style={styles.combinedFooterLinkText} numberOfLines={1}>Full guide →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Compact card showing this week's "what's happening with baby" copy alongside
// the size-comparison emoji (corn / banana / etc — comes from milestone seed).
function BabyThisWeekCard({
  feedCard, fallback, onPress,
}: {
  feedCard: HomeFeedCard | undefined;
  fallback: { description: string; heroEmoji: string };
  onPress: () => void;
}) {
  const t = useT();
  const p = feedCard?.payload as unknown as MilestoneBlockPayload | undefined;
  const description = p?.description ?? fallback.description;

  return (
    <TouchableOpacity style={styles.babyCard} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionEyebrowSmall}>{t('home.babyThisWeekLabel')}</Text>
        <Text style={styles.babyCardBody} numberOfLines={3}>{description}</Text>
      </View>
      {/* Editorial mark in the place of a content emoji — keeps the card
          chrome consistent across all 52 weeks regardless of what hero_emoji
          the curated milestone payload happens to ship. The week's actual
          content lives in the title + body text. */}
      <View style={styles.babyEmojiBubble}>
        <YolkRing size={48} top={6} left={6} tint={COLORS.coco} />
      </View>
    </TouchableOpacity>
  );
}

// "You this week" + "Your village today" image-style cards that sit side-by-side
// in the mockup. Until real photography ships these render a soft tint band with
// an emoji placeholder so the layout reads correctly.
function ImageInfoCard({
  label, sub, photo, tint, onPress,
}: { label: string; sub: string; photo: ImageSourcePropType; tint: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.imageCard} onPress={onPress} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.imageCardPhoto, { backgroundColor: tint }]}>
        <Image
          source={photo}
          style={styles.imageCardImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>
      <Text style={styles.imageCardLabel}>{label}</Text>
      <Text style={styles.imageCardSub} numberOfLines={2}>{sub}</Text>
    </TouchableOpacity>
  );
}

// EXPLORE tile — 2x2 grid card mirroring the moodboard's Home "Explore" section.
// Tinted photo band on top; the tint shows through briefly while the bundled
// require() resolves and acts as a soft editorial border tone behind the photo.
function ExploreTile({
  label, sub, photo, tint, onPress,
}: {
  label: string; sub: string;
  photo: ImageSourcePropType; tint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.exploreTile}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${label} — ${sub}`}
    >
      <View style={[styles.exploreTilePhoto, { backgroundColor: tint }]}>
        <Image
          source={photo}
          style={styles.exploreTileImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>
      <Text style={styles.exploreTileLabel}>{label}</Text>
      <Text style={styles.exploreTileSub} numberOfLines={2}>{sub}</Text>
    </TouchableOpacity>
  );
}

type HelpMarkKind = 'yolkCircle' | 'yolkRing' | 'leafSprig' | 'dotCluster' | 'sparkle';

function HelpTileMark({ kind, tint }: { kind: HelpMarkKind; tint: string }) {
  return (
    <View style={styles.helpTileMarkWrap}>
      {kind === 'yolkCircle' && <YolkCircle size={30} top={2} left={2} tint={tint} opacity={0.85} />}
      {kind === 'yolkRing'   && <YolkRing   size={28} top={3} left={3} tint={tint} />}
      {kind === 'leafSprig'  && <LeafSprig  size={34} top={0} left={0} tint={tint} />}
      {kind === 'dotCluster' && <DotCluster        top={6} left={4} tint={tint} />}
      {kind === 'sparkle'    && <SparkleMark size={24} top={3} left={4} tint={tint} />}
    </View>
  );
}

function HelpTile({
  mark, markTint, label, sub, tint, onPress,
}: { mark: HelpMarkKind; markTint: string; label: string; sub: string; tint: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.helpTile, { backgroundColor: tint }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      activeOpacity={0.88}
    >
      <HelpTileMark kind={mark} tint={markTint} />
      <View style={styles.helpTileTextWrap}>
        <Text style={styles.helpTileLabel} numberOfLines={2}>{label}</Text>
        <Text style={styles.helpTileSub} numberOfLines={2}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EventsFeedCard({
  payload, allEvents, onPressEvent, onPressSeeAll,
}: {
  payload: EventsBlockPayload;
  allEvents: { id: string; title: string; city: string | null; starts_at: string }[];
  onPressEvent: (id: string) => void;
  onPressSeeAll: () => void;
}) {
  const t = useT();
  const { event_ids, reasons } = payload;
  const lookup = new Map(allEvents.map((e) => [e.id, e]));
  const rows = event_ids.map((id) => lookup.get(id)).filter(Boolean) as typeof allEvents;
  if (rows.length === 0) return null;
  return (
    <View>
      <EditorialSectionHead
        numeral="I."
        eyebrow={t('home.feedEventsHeader').toUpperCase()}
        rightLabel={t('home.feedSeeAll')}
        onRightPress={onPressSeeAll}
      />
      <View style={styles.feedBlock}>
      {rows.map((e) => (
        <TouchableOpacity
          key={e.id}
          style={styles.eventRow}
          onPress={() => onPressEvent(e.id)}
          accessibilityRole="button"
          accessibilityLabel={e.title}
        >
          <Text style={styles.eventRowTitle} numberOfLines={1}>{e.title}</Text>
          <Text style={styles.eventRowReason} numberOfLines={1}>
            {reasons[e.id] ?? e.city ?? ''}
          </Text>
        </TouchableOpacity>
      ))}
      </View>
    </View>
  );
}

function PerksFeedCard({
  payload, perkLookup, onPressDeal, onPressSeeAll,
}: {
  payload: PerksBlockPayload;
  perkLookup: Record<string, string>;
  onPressDeal: (id: string) => void;
  onPressSeeAll: () => void;
}) {
  const t = useT();
  const items = payload.items.filter((i) => perkLookup[i.deal_id]);
  if (items.length === 0) return null;
  return (
    <View>
      <EditorialSectionHead
        numeral="II."
        eyebrow={t('home.feedPerksHeader').toUpperCase()}
        rightLabel={t('home.feedSeeAll')}
        onRightPress={onPressSeeAll}
      />
      <View style={styles.feedBlock}>
      {items.map((it) => (
        <TouchableOpacity
          key={it.deal_id}
          style={styles.eventRow}
          onPress={() => onPressDeal(it.deal_id)}
          accessibilityRole="button"
          accessibilityLabel={perkLookup[it.deal_id]}
        >
          <Text style={styles.eventRowTitle} numberOfLines={1}>{perkLookup[it.deal_id]}</Text>
          <Text style={styles.eventRowReason} numberOfLines={2}>{it.reason}</Text>
        </TouchableOpacity>
      ))}
      </View>
    </View>
  );
}

function GearTipCard({ payload, onPress }: { payload: GearTipBlockPayload; onPress: () => void }) {
  const t = useT();
  if (!payload.tip) return null;
  return (
    <TouchableOpacity style={styles.tipCard} onPress={onPress} accessibilityRole="button">
      <Text style={styles.tipEyebrow}>{t('home.gearTipEyebrow')}</Text>
      <Text style={styles.tipBody}>{payload.tip}</Text>
      {payload.category_hint && (
        <Text style={styles.tipLink}>{t('home.gearTipBrowse', { category: payload.category_hint.replace('_', ' ') })}</Text>
      )}
    </TouchableOpacity>
  );
}

function PerksTeaserCard({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <TouchableOpacity style={styles.eventsCard} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={styles.eventsRow}>
        <Text style={styles.eventsEmoji}>🎁</Text>
        <View style={styles.eventsTextWrap}>
          <Text style={styles.eventsLabel}>{t('home.perksTeaserLabel')}</Text>
          <Text style={styles.eventsPreview} numberOfLines={1}>
            {t('home.perksTeaserPreview')}
          </Text>
        </View>
        <Text style={styles.eventsArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function EventsTeaserCard({
  count, preview, onPress,
}: { count: number; preview: string | null; onPress: () => void }) {
  const t = useT();
  return (
    <TouchableOpacity style={styles.eventsCard} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={styles.eventsRow}>
        <Text style={styles.eventsEmoji}>🎉</Text>
        <View style={styles.eventsTextWrap}>
          <Text style={styles.eventsLabel}>{t('home.eventsTeaserLabel')}</Text>
          <Text style={styles.eventsPreview} numberOfLines={1}>
            {count > 0 ? (preview ?? t('home.eventsTeaserCount', { count })) : t('home.eventsTeaserPreviewEmpty')}
          </Text>
        </View>
        <Text style={styles.eventsArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyBabyProfileCard({ onSetup }: { onSetup: () => void }) {
  const t = useT();
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyEmoji}>🌱</Text>
      <Text style={styles.emptyTitle}>{t('home.emptyBabyTitle')}</Text>
      <Text style={styles.emptyBody}>
        {t('home.emptyBabyBody')}
      </Text>
      <TouchableOpacity style={styles.emptyCta} onPress={onSetup} accessibilityRole="button">
        <Text style={styles.emptyCtaText}>{t('home.emptyBabyCta')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BabySnapshotCard({
  name, age, weekNumber, feedingMethod, onEdit,
}: {
  name: string | null;
  age: string;
  weekNumber: number;
  feedingMethod: string | null;
  onEdit: () => void;
}) {
  const t = useT();
  const displayName = name ?? t('home.babyFallbackName');

  // Compact bullet-dot meta — age · feeding (week is already in the intro
  // sentence). Keeps the editorial DNA without growing the card height.
  const metaTokens: string[] = [age];
  if (feedingMethod) metaTokens.push(feedingMethod);

  // First initial of the baby's name — used as a placeholder portrait
  // until a real photo asset exists for upload. Reads as a monogram
  // sticker, same editorial register as the rest of the card.
  const initial = (displayName ?? '').trim().charAt(0).toUpperCase() || '·';

  return (
    <View style={styles.snapshotCard}>
      {/* Warm rose-gold band — rich blush gradient, light enough to sit
          comfortably at the top of the screen, dimensional enough to feel
          premium. Dark bark text over the warm tone. */}
      <View style={styles.snapshotBand}>
        {/* Rose-gold gradient — top-left lighter, bottom-right richer */}
        <LinearGradient
          colors={['#E8C4B6', '#EADBA8', '#F2E9C4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Villie bee — brand mark accent in the right corner of the band */}
        <Image source={VILLIE_BEE} resizeMode="contain"
          accessible={false} style={styles.snapshotBandPlant} />
        {/* Edit — small, top-right corner */}
        <TouchableOpacity
          style={styles.snapshotBandEditWrap}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('home.snapshotEdit')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.snapshotEdit}>{t('home.snapshotEdit')}</Text>
        </TouchableOpacity>
        {/* Name — editorial statement, left column, vertically centered */}
        <View style={styles.snapshotBandContent} pointerEvents="none">
          <Text style={styles.snapshotBandEyebrow}>{t('home.snapshotEyebrow')}</Text>
          <Text style={styles.snapshotName} numberOfLines={1}>{displayName}</Text>
        </View>
      </View>

      {/* Stat row — Week · Age · Feeding */}
      <View style={styles.snapshotStatRow}>
        <View style={styles.snapshotStatCell}>
          <Text style={styles.snapshotStatValue}>{weekNumber}</Text>
          <Text style={styles.snapshotStatLabel}>{t('home.snapshotWeek')}</Text>
        </View>
        <View style={[styles.snapshotStatCell, styles.snapshotStatCellBorder]}>
          <Text style={styles.snapshotStatValue} numberOfLines={1} adjustsFontSizeToFit>{age}</Text>
          <Text style={styles.snapshotStatLabel}>{t('home.snapshotAge')}</Text>
        </View>
        {feedingMethod ? (
          <View style={[styles.snapshotStatCell, styles.snapshotStatCellBorder]}>
            <Text style={styles.snapshotStatValue} numberOfLines={1} adjustsFontSizeToFit>{feedingMethod}</Text>
            <Text style={styles.snapshotStatLabel}>{t('home.snapshotFeeding')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Stacked capsules — abstract growth visualization, Concept C from the
// Village App Figma design exploration. Capsules stack upward from the
// bottom of the card's blush band, each representing ~8 weeks. The
// bottom capsule is always rust (the "foundation" layer); each new
// layer shifts through the brand palette and rotates slightly in
// alternating directions — a noshi / paper-fold aesthetic that is
// editorial and fashion-adjacent without any plant metaphor.
//
// Caps rendered 0–7 (max at W52+). Each layer:
//   - Width  decreases 3px per layer (44 → 23)
//   - Height constant 10px, borderRadius 5
//   - Rotation alternates: [-6, +4, -9, +7, -5, +8, -4]°
//   - Color cycles through brand palette from rust → blush
//   - Opacity fades slightly toward the top
function BabyGrowthPlant({ weekNumber, containerStyle }: { weekNumber: number; containerStyle?: any }) {
  const w = Math.max(0, weekNumber);
  const capsuleCount = Math.min(7, w > 0 ? Math.ceil(w / 8) : 0);

  // Brand-palette cycle — bottom (index 0) is always the boldest rust.
  // Each subsequent layer steps warmer/softer through the palette.
  const CAP_COLORS = [
    COLORS.coco,
    COLORS.cocoSoft,
    COLORS.coco,
    COLORS.sandSoft,
    COLORS.sage,
    COLORS.pink,
    COLORS.sandSoft,
  ];
  const CAP_OPACITIES = [0.95, 0.88, 0.82, 0.76, 0.70, 0.62, 0.55];
  // Alternating tilts — irregular so it reads as hand-placed, not mechanical.
  const CAP_ROTATIONS = [-6, 4, -9, 7, -5, 8, -4];

  const CAP_H = 10;
  const CAP_W_BASE = 44; // widest at the bottom
  const CAP_W_STEP = 3;  // narrows 3px per layer
  const STACK_GAP = 13;  // vertical center-to-center spacing
  const BASE_Y = 80;     // y-center of the bottom capsule in the 96px container
  const CX = 48;         // horizontal center of the 96×96 container

  return (
    <View pointerEvents="none" style={[plantStyles.wrap, containerStyle]}>
      {/* Capsules — rendered bottom-to-top so each higher layer sits visually
          on top of (overlaps) the one below it, like stacked sheets. */}
      {Array.from({ length: capsuleCount }).map((_, i) => {
        const capW = CAP_W_BASE - i * CAP_W_STEP;
        const cy = BASE_Y - i * STACK_GAP;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: CX - capW / 2,
              top: cy - CAP_H / 2,
              width: capW,
              height: CAP_H,
              borderRadius: CAP_H / 2,
              backgroundColor: CAP_COLORS[i],
              opacity: CAP_OPACITIES[i],
              transform: [{ rotate: `${CAP_ROTATIONS[i]}deg` }],
            }}
          />
        );
      })}
      {/* Ghost outline stack — 7 quiet cream-border capsules show the
          full potential even when few weeks have passed. Gives the
          composition structure and communicates "growth to come." */}
      {capsuleCount < 7 && Array.from({ length: 7 - capsuleCount }).map((_, i) => {
        const layerIdx = capsuleCount + i;
        const capW = CAP_W_BASE - layerIdx * CAP_W_STEP;
        const cy = BASE_Y - layerIdx * STACK_GAP;
        return (
          <View
            key={`ghost-${layerIdx}`}
            style={{
              position: 'absolute',
              left: CX - capW / 2,
              top: cy - CAP_H / 2,
              width: capW,
              height: CAP_H,
              borderRadius: CAP_H / 2,
              borderWidth: 1,
              borderColor: COLORS.sandSoft,
              backgroundColor: 'transparent',
              opacity: 0.30,
              transform: [{ rotate: `${CAP_ROTATIONS[layerIdx]}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}

const plantStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    bottom: 0,
    width: 96,
    height: 96,
  },
});

function QuietHoursPill() {
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const qh = profile?.notif_prefs?.quiet_hours;
  if (!qh || !isQuietHoursActive(qh)) return null;
  return (
    <View style={styles.quietPill}>
      <Text style={styles.quietPillText}>
        🌙 {t('home.quietHoursLabel')} · {t('home.quietHoursUntil', { time: formatHour12(qh.end_hour) })}
      </Text>
    </View>
  );
}

function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'home.greetingNight';
  if (h < 12) return 'home.greetingMorning';
  if (h < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

// Editorial date eyebrow per moodboard v3: "TUESDAY · APRIL 28, 2026".
// Locale-agnostic — we render the device-locale weekday + month to keep
// the bilingual surface honest without hand-rolled translation tables.
function formatHeaderDate(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const month   = now.toLocaleDateString(undefined, { month: 'long' });
  const day     = now.getDate();
  const year    = now.getFullYear();
  return `${weekday} · ${month} ${day}, ${year}`.toUpperCase();
}

const styles = StyleSheet.create({
  // Brand Kit v5 cream #F5EFE6 — slightly warmer than the prior ceramic so
  // the page reads as warm paper rather than yellow-tinted off-white.
  pageRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  // ScrollView itself is transparent so WarmGlowBackdrop shows through.
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },

  // Header banner image — full-bleed positioning. Single <Image> with
  // resizeMode:'stretch' bilinear-scales a 4×512 PNG to fill the band, so
  // the gradient renders pixel-smooth with no slice seams.
  headerBannerImage: {
    position: 'absolute',
    left: -20, right: -20, top: -64,
    height: 540,
    width: undefined, // let left/right anchor it; absolute Images need width or stretch
  },

  // Top app-bar — small wordmark with red dot + bell. Editorial header per
  // moodboard v3 (Diner/Yolk/Blush/Lime/Ceramic palette). Quiet so the
  // greeting block carries the page.
  // Top app-bar — small wordmark with red dot + bell. Editorial header per
  // moodboard v3 (Diner/Yolk/Blush/Lime/Ceramic palette). Quiet so the
  // greeting block carries the page.
  wordmarkImg: {
    // villie logotype — 1182×827 (1.43:1). Rendered smaller than the old
    // stacked mark; marginLeft trims the transparent left canvas padding.
    width: 140, height: 98,
    marginLeft: -10,
    alignSelf: 'flex-start',
    marginBottom: -16,
    backgroundColor: 'transparent',
  },

  greetingBlock: {
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingTop: 4,
    position: 'relative', // anchors the DotCluster + YolkCircle decoration
  },
  // Brand dot-cluster image (1028×704 ≈ 1.46:1) — editorial accent in
  // the upper-right of the greeting block. Bumped from 72×50 → 110×75
  // so the cluster reads as a legitimate brand mark in the masthead
  // rather than a decoration afterthought; aspect ratio preserved.
  greetingDotCluster: {
    position: 'absolute',
    top: -20, right: 4,
    width: 52, height: 47,
    opacity: 0.90,
  },
  greetingBeeSmall1: {
    position: 'absolute',
    top: -38, right: 50,
    width: 20, height: 18,
    opacity: 0.55,
  },
  greetingBeeSmall2: {
    position: 'absolute',
    top: -10, right: 52,
    width: 15, height: 13,
    opacity: 0.40,
  },
  greetingDateRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  // Brand Kit v5 — coco bar (warm caramel #AD795B) anchoring the date
  // eyebrow. Reads as a deliberate editorial mark, not a generic accent.
  greetingDateBar: {
    width: 22, height: 2, backgroundColor: COLORS.coco, marginRight: 10,
  },
  greetingDate: {
    fontSize: 10, color: COLORS.cocoDeep, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  greetingName: {
    fontSize: 32, color: COLORS.bark, marginTop: 0,
    fontFamily: FONTS.headerBold, lineHeight: 38, letterSpacing: -0.5,
  },
  // Italic accent on the first name — coco caramel against bark deep
  // brown gives the masthead a single warm pivot point per Brand Kit.
  greetingNameAccent: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.coco,
  },
  // Editorial rule — slightly wider and a touch warmer than pure black
  // (uses bark @ 18%) so it ties the masthead block together as one
  // composition before the rest of the page begins.
  greetingRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 12, marginBottom: 2,
    width: 48,
  },
  greetingBabyLine: {
    fontSize: 14, color: COLORS.barkSoft, fontFamily: FONTS.body,
    fontStyle: 'italic', marginTop: 12,
  },
  greetingVillageBeat: {
    fontSize: 13, color: COLORS.barkSoft, fontFamily: FONTS.body,
    marginTop: 6, lineHeight: 19,
  },
  quietPill: {
    alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(139,154,107,0.12)',
    borderWidth: 1, borderColor: 'rgba(139,154,107,0.30)',
  },
  quietPillText: { fontSize: 12, color: COLORS.sage, fontFamily: FONTS.bodySemiBold },

  checkinCard: {
    backgroundColor: COLORS.paper, borderRadius: 10, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(139,154,107,0.25)',
    shadowColor: '#3D1F0D', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  checkinCardCrisis: { borderColor: COLORS.coco, backgroundColor: '#F8E8E8' },

  // Early-postpartum crisis card. Sage accent on a soft pink-warmed
  // surface (Brand Kit v5) — this card is preventive, not reactive, so
  // a non-crisis user shouldn't read it as a warning when they open Home.
  // The pink-warmed bg signals "tender / mom-and-baby" instead of "danger".
  ppCrisisCard: {
    backgroundColor: '#FAE9E3',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,154,107,0.30)',
  },
  ppCrisisEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.5,
    color: COLORS.sage,
    textTransform: 'uppercase',
  },
  ppCrisisTitle: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bark,
    marginTop: 4,
  },
  ppCrisisBody: {
    fontSize: 13,
    color: COLORS.barkSoft,
    marginTop: 4,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  ppCrisisCta: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.cocoDeep,
    marginTop: 10,
  },

  // Discharge welcome — soft pink-warmed paper card on the new Brand Kit.
  // Sits above CheckinBanner on first launch for early-postpartum users.
  // Hairline coco border + 14r corners match the editorial card system.
  // Compact welcome card (v9 mockup-aligned, ~70px tall instead of ~120px).
  // 3-row layout: eyebrow + ×, title + Got it pill, body. Same content,
  // half the vertical weight — better for the daily-mom-glance pattern.
  welcomeCard: {
    backgroundColor: '#FCE9E4',
    borderRadius: 12,
    paddingTop: 5,
    paddingBottom: 9,
    paddingLeft: 14,
    paddingRight: 10,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(184,92,56,0.22)',
    position: 'relative',
    shadowColor: COLORS.coco,
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  welcomeTopBar: {
    position: 'absolute',
    top: 0,
    left: 14,
    width: 20,
    height: 2,
    backgroundColor: '#B07355', // muted clay action color
  },
  welcomeRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -1,
  },
  welcomeDismissIcon: {
    fontSize: 13,
    lineHeight: 13,
    color: COLORS.textLight,
    opacity: 0.55,
    paddingHorizontal: 2,
    fontFamily: FONTS.body,
  },
  welcomeEyebrow: {
    fontSize: 8.5,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.9,
    color: '#945A41',
    textTransform: 'uppercase',
    paddingTop: 0,
  },
  welcomeRowMid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  welcomeTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 17,
    fontFamily: FONTS.headerBold,
    color: COLORS.bark,
    letterSpacing: -0.3,
  },
  welcomeBody: {
    fontSize: 10.5,
    color: COLORS.barkSoft,
    lineHeight: 14,
    fontFamily: FONTS.body,
    maxWidth: '96%',
  },
  // Muted clay pill (less saturated than rust). Subtle top specular added
  // inline via gradient is omitted — RN backgroundColor + a strong shadow
  // already reads as a glossy pill at this size.
  welcomeCta: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#B07355',
    shadowColor: '#945A41',
    shadowOpacity: 0.40,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  welcomeCtaText: {
    fontSize: 9.5,
    fontFamily: FONTS.bodyBold,
    color: COLORS.paper,
    letterSpacing: 0.4,
    fontWeight: '700',
  },

  checkinEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.5, color: COLORS.sage,
    textTransform: 'uppercase',
  },
  checkinEyebrowCrisis: { color: COLORS.cocoDeep },
  checkinTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 4 },
  checkinBody: { fontSize: 13, color: COLORS.barkSoft, marginTop: 4, lineHeight: 18, fontFamily: FONTS.body },
  checkinCta: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep, marginTop: 10 },

  // Compact pill variant of CheckinBanner — used for pending/answered states so
  // the daily check-in reads as a calm prompt rather than a hero block. Crisis
  // state still uses the full `checkinCard` block (earned visual weight).
  // Pending/answered check-in card — editorial paper card w/ yolk-circle
  // accent, eyebrow + Playfair italic prompt, mood dot anchor, and a yolk
  // pill CTA. Crisis state still uses the full `checkinCard` block.
  checkinCompact: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.paper, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    overflow: 'hidden', position: 'relative',
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  checkinCompactDot: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(212,184,150,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  checkinCompactDotText: { fontSize: 20 },
  checkinCompactTextCol: { flex: 1 },
  checkinCompactEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.sage, textTransform: 'uppercase',
    marginBottom: 3,
  },
  checkinCompactTitle: {
    // Playfair Display Bold — same font used on the EXPLORE vertical tile
    // labels (Specialists / Milk / Gear / Events) so the daily check-in
    // title reads as part of the same family.
    fontSize: 14, fontFamily: FONTS.headerBold,
    color: COLORS.bark, lineHeight: 19,
  },
  checkinCompactCtaPill: {
    backgroundColor: 'rgba(212,184,150,0.18)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    marginLeft: 10,
  },
  checkinCompactCtaPillText: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold,
    color: COLORS.bark, letterSpacing: 0.2, opacity: 0.85,
  },

  emptyCard: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 20, alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    shadowColor: '#3D1F0D', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: COLORS.barkSoft, textAlign: 'center', lineHeight: 20, marginBottom: 14, fontFamily: FONTS.body },
  emptyCta: {
    backgroundColor: COLORS.coco, borderRadius: 999,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyCtaText: { color: COLORS.cream, fontSize: 14, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },

  // TODAY · WEEK twin card — single paper card hosting both the daily
  // check-in and the weekly journey side-by-side. Shared eyebrow at top,
  // hairline vertical divider between the two halves so they read as one
  // editorial spread (not two banners). Each half is its own touch target.
  twinCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    paddingTop: 14, paddingBottom: 14,
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    overflow: 'hidden',
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  twinHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10,
  },
  twinAccentBar: {
    width: 12, height: 2, backgroundColor: COLORS.coco,
    marginRight: 8, borderRadius: 1,
  },
  twinEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.8,
    color: COLORS.barkSoft, textTransform: 'uppercase',
  },
  twinRow: {
    flexDirection: 'row', alignItems: 'stretch',
  },
  twinHalfLeft: {
    flex: 1,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6,
    minHeight: 144,
  },
  twinHalfRight: {
    flex: 1,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6,
    minHeight: 144,
    overflow: 'hidden',
    position: 'relative',
  },
  twinDivider: {
    width: 1,
    backgroundColor: COLORS.sandSoft,
    opacity: 0.6,
    marginVertical: 4,
  },
  twinMoodDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(139,154,107,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  twinMoodGlyph: { fontSize: 18 },
  twinHalfEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.sage, textTransform: 'uppercase',
    marginBottom: 4,
  },
  // Left-half title — regular weight (was italic Playfair). Italic is
  // reserved for the right-half "Week N" moment so the card has a clear
  // bold/regular/italic balance instead of two italic statements.
  twinHalfTitle: {
    fontSize: 15, fontFamily: FONTS.bodyMedium,
    color: COLORS.bark, lineHeight: 20, marginBottom: 8,
  },
  twinWeekText: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 22, color: COLORS.bark,
    lineHeight: 26, marginBottom: 4, letterSpacing: 0.2,
  },
  twinHalfBody: {
    fontSize: 12, color: COLORS.barkSoft, lineHeight: 17,
    fontFamily: FONTS.body, marginBottom: 8,
  },
  twinHalfCta: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold,
    color: COLORS.coco, letterSpacing: 0.3,
    marginTop: 'auto',
  },

  // Hero week card — moodboard-aligned cream-on-cream w/ rust accent on the
  // eyebrow, Playfair italic week headline, soft yolk-circle accent on the
  // right. Drops the prior rust block + photo lane.
  heroCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    paddingVertical: 16, paddingHorizontal: 20,
    marginBottom: 8,
    minHeight: 138,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    overflow: 'hidden',
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  // Warm tint behind hero card — same gradient asset as the page banner,
  // 50% opacity so the rust tone reads but doesn't fight the text.
  heroCardGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  heroTextCol: { flex: 1 },
  heroEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: COLORS.coco, textTransform: 'uppercase',
  },
  heroWeekText: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 28, color: COLORS.bark,
    letterSpacing: 0.2,
    lineHeight: 32,
    marginTop: 6, marginBottom: 6,
  },
  heroTagline: {
    fontSize: 14, color: COLORS.barkSoft, lineHeight: 20,
    fontFamily: FONTS.body,
  },
  // Coco-pill CTA — "See your weekly guide →". Right-aligned at the bottom
  // of the card so the italic "Week N" headline gets a clean line of its
  // own without a heavy button competing next to it. Cream label on coco
  // is the canonical Brand Kit v5 primary-CTA combination.
  heroCtaPill: {
    alignSelf: 'flex-end',
    marginTop: 12,
    backgroundColor: COLORS.coco,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroCtaPillText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.cream,
    letterSpacing: 0.3,
  },

  // Section eyebrows that label rows in the new layout.
  sectionEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: COLORS.barkSoft, textTransform: 'uppercase', marginTop: 8, marginBottom: 8,
  },
  sectionEyebrowSmall: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.6,
    color: COLORS.cocoDeep, textTransform: 'uppercase', marginBottom: 6,
  },

  // Baby-this-week strip card. Brand Kit v5 — hairline coco border for
  // the warm-paper edge and a 14r corner to match the snapshot card.
  babyCard: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.14)',
    shadowColor: '#3D1F0D', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  babyCardBody: { fontSize: 13, color: COLORS.barkSoft, lineHeight: 19, fontFamily: FONTS.body },
  babyEmojiBubble: {
    // Soft mauve-tinted bubble — sits inside Brand Kit pinks instead of
    // the prior peach (#FCE9DD), so the bubble reads as part of the new
    // palette family.
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#F4DDDF',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },

  // Two-up "you / village" cards.
  twoUpRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  imageCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 10, padding: 12,
  },
  imageCardPhoto: {
    height: 84, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, overflow: 'hidden',
  },
  imageCardImage: { width: '100%', height: '100%' },
  imageCardLabel: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.bark, textTransform: 'uppercase',
  },
  imageCardSub: { fontSize: 12, color: COLORS.barkSoft, marginTop: 4, lineHeight: 16, fontFamily: FONTS.body },

  // Editorial statement card — moodboard's "It takes a village. We built the
  // app." hook. Cream paper background, serif italic accent, Diner pill CTA,
  // subtle ✦ mark in the bottom-right corner. Routes to Manual tab.
  statementCard: {
    // Lighter ivory than the surrounding paper — the field guide should feel
    // like a fresh page lifted out of the cream feed, not blend into it.
    backgroundColor: '#FFFDF7',
    borderRadius: 10,
    padding: 18,
    paddingLeft: 22, // clears the book-spine binding + page hairlines on the left
    paddingRight: 26, // breathing room so body text doesn't crowd the right-side page-edge stack
    paddingBottom: 16,
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cream, // softer than ceramicDeep for the lighter tone
    overflow: 'hidden',
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  statementEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.8,
    color: COLORS.coco, textTransform: 'uppercase', marginBottom: 12,
  },
  statementTitle: {
    fontSize: 32, fontFamily: FONTS.headerBold, color: COLORS.bark,
    lineHeight: 38, marginBottom: 10,
  },
  statementTitleItalic: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.coco,
  },
  statementBody: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 20, marginBottom: 16,
  },
  statementCta: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.sandSoft,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
  },
  statementCtaText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    letterSpacing: 0.3,
  },
  statementMark: {
    position: 'absolute', right: 18, bottom: 18,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  statementMarkText: {
    fontSize: 16, color: COLORS.cocoDeep,
  },

  // Combined Weekly + Manual card — editorial redesign (Brand Kit v5).
  // Outer shell: rounded-20 card with 3D stacked shadow depth.
  combinedCard: {
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,184,150,0.45)',
    overflow: 'hidden',
    shadowColor: COLORS.coco,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  // Solid top band — single warm sand color carrying the card identity.
  combinedCardTop: {
    flexDirection: 'row',
    backgroundColor: COLORS.sandSoft,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  // Left panel: takes remaining space after the fixed-width right panel.
  combinedCardLeft: {
    flex: 1,
  },
  combinedEyebrow: {
    fontSize: 9, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.8,
    color: COLORS.cocoDeep, textTransform: 'uppercase', marginBottom: 2,
  },
  // Number row: big italic Playfair numeral + small WK label, pulled tight to eyebrow.
  combinedNumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 0,
  },
  // Big numeral — DM Sans bold (was Playfair italic). Swap requested
  // so the number reads precise/clinical and the unit label carries the
  // editorial italic instead.
  combinedWeekNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 68,
    lineHeight: 68,
    color: COLORS.bark,
    letterSpacing: -2.5,
    marginTop: 2,
  },
  // Unit label — Playfair italic accent on the soft word.
  combinedWkLabel: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 16,
    color: COLORS.coco,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  // Milestone tagline below the number — Playfair italic, space above for separation.
  combinedTagline: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.bark,
    marginTop: 6,
  },
  combinedTaglineMore: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: COLORS.coco,
    marginTop: 4,
  },
  // Faint decorative bee — positioned absolutely within the top band.
  bee: {
    position: 'absolute',
  },
  // Vertical hairline divider between left and right panels.
  combinedDivider: {
    width: 1,
    backgroundColor: 'rgba(173,121,91,0.18)',
    marginHorizontal: 12,
    marginVertical: 2,
    alignSelf: 'stretch',
  },
  // Right panel: fixed width, space-between stacks tiles above the "Open →" CTA.
  combinedCardRight: {
    width: 108,
    flexShrink: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  combinedManualEyebrow: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLORS.cocoDeep,
    marginBottom: 4,
  },
  combinedTiles: {
    gap: 3,
  },
  // Mini-tile: mirrors the Manual tab tile structure (paper bg + coco border + art strip + Playfair label).
  combinedTile: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.bark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20,
    shadowRadius: 5,
    elevation: 4,
  },
  combinedTileLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.bark,
    paddingHorizontal: 7,
    paddingVertical: 4,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  combinedManualCta: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.2,
    color: COLORS.coco,
  },
  // Body section: ivory-warm background below the gradient band.
  combinedCardBody: {
    backgroundColor: '#FBF6F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  // Inline preview to-do list — 3 rows max, circular checkboxes.
  combinedTodoList: {
    gap: 7,
    marginBottom: 11,
  },
  combinedTodoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  combinedCheckbox: {
    width: 18, height: 18, borderRadius: 999,
    borderWidth: 1.5, borderColor: 'rgba(173,121,91,0.40)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  combinedCheckboxOn: {
    backgroundColor: COLORS.coco,
    borderColor: COLORS.coco,
  },
  combinedCheckmark: {
    color: COLORS.cream,
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
  },
  combinedTodoText: {
    flex: 1,
    fontSize: 12, color: COLORS.barkSoft, lineHeight: 16,
    fontFamily: FONTS.body,
  },
  combinedTodoTextDone: {
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  // Footer: weekly guide left, full manual right, separated by full-width flex.
  combinedFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,184,150,0.30)',
  },
  combinedFooterLinkText: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.coco,
    flexShrink: 0,
  },

  // Section heading row — small Diner accent bar + eyebrow.
  sectionHeadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 2, marginBottom: 12, paddingHorizontal: 12,
  },
  sectionAccentBar: {
    width: 12, height: 2, backgroundColor: COLORS.coco, borderRadius: 1,
  },

  // EXPLORE grid — 2x2 photo cards mirroring the moodboard's Home "Explore"
  // section. Each tile has a tinted photo band + label + subtitle, jumps to the
  // matching vertical (Specialists / Milk / Gear / Events).
  exploreHeading: {
    paddingHorizontal: 12, marginTop: 8, marginBottom: 12,
    position: 'relative', overflow: 'visible',
  },
  exploreHeadingBee: {
    position: 'absolute',
    top: -6, right: 8,
    width: 30, height: 27,
    opacity: 0.55,
  },
  exploreEyebrowBee: {
    width: 46, height: 42,
    opacity: 0.88,
    marginLeft: -6,
    transform: [{ rotate: '-14deg' }],
  },
  exploreHeadingLead: {
    fontSize: 17, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark, marginTop: 2, lineHeight: 22,
  },
  exploreHeadingRule: {
    height: 1, backgroundColor: 'rgba(107,62,42,0.25)',
    marginTop: 2, alignSelf: 'stretch',
  },
  exploreGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginTop: 12, paddingHorizontal: 12, paddingBottom: 12,
  },
  exploreTile: {
    width: '48.5%',
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  exploreTilePhoto: {
    width: '100%', height: 78, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    overflow: 'hidden',
  },
  exploreTileImage: {
    width: '100%', height: '100%',
  },
  exploreTileLabel: {
    fontSize: 15, fontFamily: FONTS.headerBold, color: COLORS.bark,
    marginBottom: 3,
  },
  exploreTileSub: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 16,
  },

  // Help section — section header is editorial: eyebrow + Playfair italic
  // "what do you need right now?" + thin hairline rule. Tiles are warm
  // first-person beats with a label + italic sub so the row reads like a
  // friend asking, not a launcher.
  helpCard: {
    backgroundColor: 'rgba(253,250,245,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  exploreCard: {
    backgroundColor: 'rgba(253,250,245,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.10)',
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  helpCardBee: {
    position: 'absolute',
    bottom: 10, right: 12,
    width: 28, height: 25,
    opacity: 0.30,
    transform: [{ rotate: '10deg' }],
  },
  helpHeading: {
    paddingHorizontal: 0, marginTop: 0, marginBottom: 12,
  },
  helpHeadingLead: {
    fontSize: 22, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark, marginTop: 4, lineHeight: 28,
  },
  helpHeadingRule: {
    height: 1, backgroundColor: 'rgba(107,62,42,0.25)',
    marginTop: 10, alignSelf: 'stretch',
  },
  helpGrid: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 0,
  },
  helpTile: {
    flex: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'flex-start', justifyContent: 'flex-start',
    minHeight: 124, overflow: 'hidden',
  },
  helpTileMarkWrap: { width: 36, height: 36, marginBottom: 8 },
  helpTileTextWrap: { flex: 1, justifyContent: 'flex-end', alignSelf: 'stretch' },
  helpTileLabel: {
    fontSize: 13, color: COLORS.bark, lineHeight: 16,
    fontFamily: FONTS.bodySemiBold,
  },
  helpTileSub: {
    fontSize: 11, color: COLORS.barkSoft, lineHeight: 14, marginTop: 4,
    fontFamily: FONTS.body, fontStyle: 'italic',
  },

  // Editorial baby card — two-column: garden frame + monogram avatar on
  // the LEFT, text block on the RIGHT. Card is borderless; the column
  // split itself separates editorial text from the garden frame.
  // Brand Kit v5: hairline coco border @ 12% so the white card doesn't
  // Luxury editorial card — dark walnut band over cream body.
  // Thin warm-copper hairline + deep shadow give it material weight.
  snapshotCard: {
    backgroundColor: '#FEFCFA',
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'column',
    overflow: 'hidden',
    borderWidth: 0.75,
    borderColor: 'rgba(150, 85, 50, 0.22)',
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 5,
  },
  // Warm rose-gold band — light, rich, premium without being heavy.
  snapshotBand: {
    height: 82,
    backgroundColor: '#F0C8BE',
    position: 'relative',
    overflow: 'hidden',
  },
  // Large monogram — barely-there watermark, like luxury letterhead.
  snapshotMonogram: {
    position: 'absolute',
    right: 12,
    bottom: -20,
    fontSize: 130,
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    color: '#5C2A1A',
    opacity: 0.07,
    lineHeight: 130,
  },
  // Villie bee brand mark — bottom-right of the gradient band.
  snapshotBandPlant: {
    position: 'absolute',
    right: 10, bottom: 4,
    width: 66, height: 60,
    opacity: 0.60,
    transform: [{ rotate: '12deg' }],
  },
  // Left content block — vertically centered, clears the capsule column.
  snapshotBandContent: {
    position: 'absolute',
    top: 0, bottom: 0, left: 14,
    right: 120,
    justifyContent: 'center',
    gap: 3,
  },
  // Eyebrow — deep bark, spaced, whisper-quiet above the name.
  snapshotBandEyebrow: {
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 25, 10, 0.55)',
  },
  // Edit — dark bark, unobtrusive in the warm band.
  snapshotBandEditWrap: {
    position: 'absolute',
    top: 12,
    right: 16,
  },
  snapshotHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  snapshotEdit: { fontSize: 12, color: 'rgba(60, 25, 10, 0.55)', fontFamily: FONTS.bodySemiBold },
  // Name — deep brownDeep Playfair italic on the warm blush band.
  snapshotName: {
    fontSize: 22, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark, lineHeight: 26,
    flexShrink: 1,
  },
  snapshotIntroLine: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 20, marginTop: 4,
  },
  snapshotMetaLine: {
    fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.body,
    marginTop: 6, letterSpacing: 0.3,
  },
  // Terra-italic accent on the week count. Mirrors the design artifact's
  // `<em>` accent pattern (rust Playfair italic on the key word).
  snapshotAgeAccent: {
    color: COLORS.coco,
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
  },
  snapshotMetaText: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.barkSoft,
  },
  // Stat row — cream body, warmer separators to echo the dark band above.
  snapshotStatRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 50, 20, 0.12)',
    backgroundColor: '#FEFCFA',
  },
  snapshotStatCell: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  snapshotStatCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(100, 50, 20, 0.12)',
  },
  // Stat value — DM Sans bold (was Playfair italic). Number reads
  // direct/clinical; the uppercase label below carries the soft accent.
  snapshotStatValue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.bark,
    lineHeight: 15,
  },
  snapshotStatLabel: {
    fontSize: 8,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.barkSoft,
    opacity: 0.85,
  },
  timelineRow: { alignSelf: 'center', paddingVertical: 10 },
  timelineText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep },

  feedBlock: {
    // Brand Kit v5 — paper surface so editorial section cards feel like
    // one lifted layer above the cream page.
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(173,121,91,0.12)',
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  feedHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  feedHeader: {
    fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
  },
  feedHeaderLink: {
    fontSize: 12, color: COLORS.coco, fontFamily: FONTS.bodySemiBold,
  },
  eventRow: {
    paddingVertical: 10, borderTopWidth: 1,
    borderTopColor: 'rgba(61,31,13,0.06)',
  },
  eventRowTitle: {
    fontSize: 14, color: COLORS.bark, fontFamily: FONTS.bodySemiBold,
  },
  eventRowReason: {
    fontSize: 12, color: COLORS.barkSoft, marginTop: 2, lineHeight: 17,
    fontFamily: FONTS.body,
  },

  tipCard: {
    // Brand Kit v5 — sand surface (warm neutral support colour) with a
    // sage accent border so the tip reads as a calm informational beat,
    // not a CTA card. Shadow depth matches the rest of the page's card stack.
    backgroundColor: COLORS.sandSoft,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,154,107,0.25)',
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  tipEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.5,
    color: COLORS.sage, textTransform: 'uppercase',
  },
  tipBody: {
    fontSize: 14, color: COLORS.bark, lineHeight: 20, marginTop: 6,
    fontFamily: FONTS.body,
  },
  tipLink: {
    fontSize: 12, color: COLORS.cocoDeep, fontFamily: FONTS.bodySemiBold,
    marginTop: 8,
  },

  discoverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.14)',
    shadowColor: '#3D1F0D', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  discoverEmoji: { fontSize: 28 },
  discoverTitle: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  discoverDesc: { fontSize: 12, color: COLORS.barkSoft, marginTop: 2, fontFamily: FONTS.body },

  eventsCard: {
    // Brand Kit v5 — lifted paper surface with a hairline coco border,
    // matching the editorial card system. Shadow depth matches snapshot card.
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(173,121,91,0.16)',
    shadowColor: '#3D1F0D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  eventsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventsEmoji: { fontSize: 28 },
  eventsTextWrap: { flex: 1 },
  eventsLabel: {
    fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
  },
  eventsPreview: {
    fontSize: 12, color: COLORS.barkSoft, marginTop: 2, lineHeight: 17,
    fontFamily: FONTS.body,
  },
  eventsArrow: {
    fontSize: 20, color: COLORS.coco, fontFamily: FONTS.bodySemiBold,
    opacity: 0.7,
  },
});
