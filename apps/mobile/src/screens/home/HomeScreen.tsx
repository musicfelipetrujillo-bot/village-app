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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Image, ImageSourcePropType,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
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
import { isQuietHoursActive, formatHour12 } from '@utils/quietHours';
import { useT } from '@/i18n';
import CrisisResourcesSheet from '@components/community/CrisisResourcesSheet';
import { useAnalytics } from '@/hooks/useAnalytics';
import {
  YolkCircle, YolkRing, ScribbleMark, DotCluster, LeafSprig, SparkleMark,
} from '@components/shared/DecorativeMarks';

// Versioned key — bump if we ever want a new orientation card to surface to
// users who already dismissed the previous one.
const DISCHARGE_WELCOME_KEY = 'village.dischargeWelcomeDismissed.v1';

// Brand wordmark — same asset shipped on Splash/Login/SignUp. Used as the
// quiet editorial header at the top of Home in place of the prior text-rendered
// wordmark + dot. Sizing is small (~28px tall) so the greeting still anchors
// the first fold per moodboard.
const WORDMARK = require('../../../assets/brand/the-village-wordmark.png');

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.rust} />}
    >
      {/* App-bar: brand wordmark image + bell. Per moodboard v3 — quiet
          editorial header that lets the greeting carry the page. */}
      <View style={styles.appBar}>
        <Image
          source={WORDMARK}
          style={styles.wordmarkImg}
          resizeMode="contain"
          accessibilityLabel={t('home.wordmark')}
        />
        <TouchableOpacity
          style={styles.bellWrap}
          accessibilityRole="button"
          accessibilityLabel={t('home.notificationsA11y')}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          <View style={styles.bellDot} />
        </TouchableOpacity>
      </View>

      <View style={styles.greetingBlock}>
        <Text style={styles.greetingDate}>{formatHeaderDate()}</Text>
        <Text style={styles.greetingName}>
          {greeting} <Text style={styles.greetingNameAccent}>{firstName}.</Text>
        </Text>
        {babyProfile?.baby_name ? (
          <Text style={styles.greetingBabyLine}>
            {t('home.babyAgeLine', {
              name: babyProfile.baby_name,
              age: formatAge(
                babyProfile.date_of_birth,
                (profile?.preferred_language ?? 'en') as 'en' | 'es',
              ),
            })}
          </Text>
        ) : null}
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

      {/* Daily check-in — full card, always visible above the weekly hero.
          Crisis state gets full-bleed treatment (handled inside CheckinBanner);
          pending/answered render as the compact pill row. */}
      {todayCheckin?.crisis_flagged ? (
        <CheckinBanner
          state="crisis"
          previewMood={todayCheckin?.mood_score}
          onPress={() => navigation.navigate('CheckinResponse', { checkinId: todayCheckin.id })}
        />
      ) : (
        <CheckinBanner
          state={todayCheckin ? 'answered' : 'pending'}
          previewMood={todayCheckin?.mood_score}
          onPress={() => {
            if (todayCheckin) {
              navigation.navigate('CheckinResponse', { checkinId: todayCheckin.id });
            } else {
              navigation.navigate('DailyCheckin');
            }
          }}
        />
      )}

      {loading && !babyProfile ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.rust} />
        </View>
      ) : !babyProfile ? (
        <EmptyBabyProfileCard onSetup={() => navigation.navigate('BabyProfileSetup')} />
      ) : (
        <>
          {/* Weekly hero — separate card stacked under the check-in (was
              merged into a twin spread; unmerged so each card has its own
              full width and breathing room). */}
          <HeroWeekCard
            feedCard={cards.find((c) => c.block === 'milestone')}
            fallback={{
              weekNumber: currentMilestone?.week_number ?? babyProfile.current_week_number,
              title: currentMilestone?.title ?? t('home.milestoneFallbackTitle'),
              description: currentMilestone?.description ?? t('home.milestoneFallbackDesc'),
              heroEmoji: currentMilestone?.hero_emoji ?? '✨',
            }}
            onPress={(week) => navigation.navigate('WeeklyJourney', { week })}
          />

          {/* Calm always-here crisis card — early-postpartum window only.
              Sits below the twin so it never crowds the primary daily action,
              but stays above the editorial sections so a fragile user can
              find it without scrolling. */}
          {earlyPostpartum ? (
            <EarlyPostpartumCrisisCard onPress={openCrisisSheet} />
          ) : null}

          {/* Editorial statement hero — "It takes a village." Tap → Manual tab.
              Single biggest visual hook from the moodboard reference. Cream paper
              card w/ Playfair italic statement + serif subtitle + Diner pill CTA. */}
          <TouchableOpacity
            style={styles.statementCard}
            onPress={() => tabParent?.navigate('Manual')}
            activeOpacity={0.94}
            accessibilityRole="button"
            accessibilityLabel={t('home.statementA11y')}
          >
            {/* Hand-drawn moodboard marks — yolk circle behind eyebrow, leaf
                sprig in upper-right, sparkle ✦ in lower-right. Scribble + dot
                cluster removed — once the body grew longer they read as
                clutter rather than texture. */}
            <YolkCircle size={70} top={-12} left={-10} tint={COLORS.yolkLight} opacity={0.55} />
            <LeafSprig size={56} top={6} right={14} tint={COLORS.olive} />
            <Text style={styles.statementEyebrow}>{t('home.statementEyebrow')}</Text>
            <Text style={styles.statementTitle}>
              {t('home.statementTitleA')}{'\n'}
              <Text style={styles.statementTitleItalic}>{t('home.statementTitleB')}</Text>
            </Text>
            <Text style={styles.statementBody}>{t('home.statementBody')}</Text>
            <View style={styles.statementCta}>
              <Text style={styles.statementCtaText}>{t('home.statementCta')} →</Text>
            </View>
            <SparkleMark size={20} bottom={20} right={22} tint={COLORS.dinerDark} />
          </TouchableOpacity>

          {/* EXPLORE — 2x2 photo grid mapping to the four product areas, mirroring
              the moodboard's "Explore" section on Home. Each card jumps to the
              corresponding tab/screen. */}
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionAccentBar} />
            <Text style={styles.sectionEyebrow}>{t('home.exploreEyebrow')}</Text>
          </View>
          <View style={styles.exploreGrid}>
            <ExploreTile
              label={t('home.exploreSpecialistsLabel')}
              sub={t('home.exploreSpecialistsSub')}
              photo={require('../../../assets/photos/specialist.jpg')}
              tint={COLORS.blush}
              onPress={() => tabParent?.navigate('Experts')}
            />
            <ExploreTile
              label={t('home.exploreMilkLabel')}
              sub={t('home.exploreMilkSub')}
              photo={require('../../../assets/photos/milk.jpg')}
              tint={COLORS.yolkLight}
              onPress={() => tabParent?.navigate('Milk')}
            />
            <ExploreTile
              label={t('home.exploreGearLabel')}
              sub={t('home.exploreGearSub')}
              photo={require('../../../assets/photos/gear.jpg')}
              tint={COLORS.lime}
              onPress={() => tabParent?.navigate('Gear')}
            />
            <ExploreTile
              label={t('home.exploreEventsLabel')}
              sub={t('home.exploreEventsSub')}
              photo={require('../../../assets/photos/events.jpg')}
              tint={COLORS.dinerLight}
              onPress={() => navigation.navigate('EventsList')}
            />
          </View>

          {/* BABY snapshot — quiet profile recap (name/age/week/feeding).
              Used to live under a "BABY THIS WEEK" section heading + a
              second BabyThisWeekCard, but that duplicated the twin's
              right-half (week + description + weekly-guide CTA). The twin
              now owns "your week"; the snapshot stays only as a small
              reference tile so the baby profile doesn't visually compete
              with the daily check-in / weekly journey above. */}
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

          {/* HOW CAN WE HELP — 4 quick-launch tiles. Replaces a scrolled-deep
              "What do you need today?" CTA: feeding help, emotional support,
              find moms nearby, ask Village (AI). The most common 3-a.m.
              questions, one tap away. */}
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionAccentBar} />
            <Text style={styles.sectionEyebrow}>{t('home.howCanWeHelp')}</Text>
          </View>
          <View style={styles.helpGrid}>
            <HelpTile n="01" mark="yolkCircle" markTint={COLORS.rust}      label={t('home.helpFeeding')}    tint={COLORS.blush}      onPress={onHelpFeeding} />
            <HelpTile n="02" mark="yolkRing"   markTint={COLORS.rust}      label={t('home.helpEmotional')}  tint={COLORS.yolkLight}  onPress={onHelpEmotional} />
            <HelpTile n="03" mark="leafSprig"  markTint={COLORS.olive}     label={t('home.helpFindMoms')}   tint={COLORS.lime}       onPress={onHelpFindMoms} />
            <HelpTile n="04" mark="sparkle"    markTint={COLORS.brownDeep} label={t('home.helpAskVillage')} tint={COLORS.dinerLight} onPress={onHelpAskVillage} />
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
    </ScrollView>
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
      <TouchableOpacity
        style={styles.welcomeDismiss}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('home.dischargeWelcomeDismissA11y')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.welcomeDismissIcon}>×</Text>
      </TouchableOpacity>
      <Text style={styles.welcomeEyebrow}>{t('home.dischargeWelcomeEyebrow')}</Text>
      <Text style={styles.welcomeTitle}>{t('home.dischargeWelcomeTitle')}</Text>
      <Text style={styles.welcomeBody}>{t('home.dischargeWelcomeBody')}</Text>
      <TouchableOpacity
        style={styles.welcomeCta}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('home.dischargeWelcomeCta')}
      >
        <Text style={styles.welcomeCtaText}>{t('home.dischargeWelcomeCta')}</Text>
      </TouchableOpacity>
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
      <YolkCircle size={48} top={-10} left={-12} tint={COLORS.yolkLight} opacity={0.55} />
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
          <YolkCircle size={56} top={-12} right={-12} tint={COLORS.yolkLight} opacity={0.55} />
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
      {/* Yolk-circle accent behind the right side — moodboard's "Sarah is 3
          weeks today" card mark. Sits behind the arrow pill. */}
      <YolkCircle size={84} top={-18} right={-16} tint={COLORS.yolkLight} opacity={0.7} />
      <ScribbleMark size={28} top={14} right={92} tint={COLORS.brownDeep} />
      <View style={styles.heroTextCol}>
        <Text style={styles.heroEyebrow}>{t('home.heroEyebrow')}</Text>
        <Text style={styles.heroWeekText}>{t('home.heroWeekFmt', { week: weekNumber })}</Text>
        <Text style={styles.heroTagline} numberOfLines={3}>{description}</Text>
        <Text style={styles.heroCta}>{t('home.heroCta')}</Text>
      </View>
      <View style={styles.heroArrowPill}>
        <Text style={styles.heroArrowPillText}>→</Text>
      </View>
    </TouchableOpacity>
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
        <YolkRing size={48} top={6} left={6} tint={COLORS.rust} />
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
      {kind === 'yolkCircle' && <YolkCircle size={44} top={2} left={2} tint={tint} opacity={0.85} />}
      {kind === 'yolkRing'   && <YolkRing   size={42} top={3} left={3} tint={tint} />}
      {kind === 'leafSprig'  && <LeafSprig  size={48} top={0} left={0} tint={tint} />}
      {kind === 'dotCluster' && <DotCluster        top={10} left={8} tint={tint} />}
      {kind === 'sparkle'    && <SparkleMark size={36} top={4} left={6} tint={tint} />}
    </View>
  );
}

function HelpTile({
  mark, markTint, label, tint, n, onPress,
}: { mark: HelpMarkKind; markTint: string; label: string; tint: string; n: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.helpTile, { backgroundColor: tint }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.88}
    >
      <Text style={styles.helpTileNumber}>{n}</Text>
      <HelpTileMark kind={mark} tint={markTint} />
      <Text style={styles.helpTileLabel} numberOfLines={2}>{label}</Text>
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
    <View style={styles.feedBlock}>
      <View style={styles.feedHeaderRow}>
        <Text style={styles.feedHeader}>{t('home.feedEventsHeader')}</Text>
        <TouchableOpacity onPress={onPressSeeAll} accessibilityRole="button">
          <Text style={styles.feedHeaderLink}>{t('home.feedSeeAll')}</Text>
        </TouchableOpacity>
      </View>
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
    <View style={styles.feedBlock}>
      <View style={styles.feedHeaderRow}>
        <Text style={styles.feedHeader}>{t('home.feedPerksHeader')}</Text>
        <TouchableOpacity onPress={onPressSeeAll} accessibilityRole="button">
          <Text style={styles.feedHeaderLink}>{t('home.feedSeeAll')}</Text>
        </TouchableOpacity>
      </View>
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
  return (
    <View style={styles.snapshotCard}>
      <View style={styles.snapshotHeader}>
        <Text style={styles.snapshotTitle}>{name ?? t('home.babyFallbackName')}</Text>
        <TouchableOpacity onPress={onEdit} accessibilityLabel={t('home.snapshotEdit')}>
          <Text style={styles.snapshotEdit}>{t('home.snapshotEdit')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.snapshotRow}>
        <SnapshotStat label={t('home.snapshotAge')} value={age} />
        <SnapshotStat label={t('home.snapshotWeek')} value={String(weekNumber)} />
        <SnapshotStat label={t('home.snapshotFeeding')} value={feedingMethod ?? '—'} />
      </View>
    </View>
  );
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.snapshotStat}>
      <Text style={styles.snapshotStatValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.snapshotStatLabel}>{label}</Text>
    </View>
  );
}

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
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 140 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },

  // Top app-bar — small wordmark with red dot + bell. Editorial header per
  // moodboard v3 (Diner/Yolk/Blush/Lime/Ceramic palette). Quiet so the
  // greeting block carries the page.
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 22,
  },
  wordmarkImg: {
    // Wordmark PNG is 303×63 transparent (≈4.81 ratio after bg-strip).
    // Constrain by height; resizeMode="contain" keeps the heart accent intact.
    width: 144, height: 44,
  },
  bellWrap: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: COLORS.paper,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  bellIcon: { fontSize: 18 },
  bellDot: {
    position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.diner, borderWidth: 1.5, borderColor: COLORS.paper,
  },

  greetingBlock: { marginBottom: 14, paddingHorizontal: 12 },
  greetingDate: {
    fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.6, marginBottom: 10,
  },
  greetingName: {
    fontSize: 36, color: COLORS.brownDeep, marginTop: 0,
    fontFamily: FONTS.headerBold, lineHeight: 42,
  },
  greetingNameAccent: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
  },
  greetingBabyLine: {
    fontSize: 14, color: COLORS.textMid, fontFamily: FONTS.body,
    fontStyle: 'italic', marginTop: 14,
  },
  quietPill: {
    alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(92,107,58,0.12)',
    borderWidth: 1, borderColor: 'rgba(92,107,58,0.30)',
  },
  quietPillText: { fontSize: 12, color: COLORS.olive, fontFamily: FONTS.bodySemiBold },

  checkinCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(92,107,58,0.25)',
  },
  checkinCardCrisis: { borderColor: COLORS.rust, backgroundColor: '#FFF5F0' },

  // Early-postpartum crisis card. Olive accent (calm, "always here") rather
  // than rust — this card is preventive, not reactive. A non-crisis user
  // shouldn't read it as a warning when they open Home.
  ppCrisisCard: {
    backgroundColor: '#F4F1E4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(92,107,58,0.30)',
  },
  ppCrisisEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.5,
    color: COLORS.olive,
    textTransform: 'uppercase',
  },
  ppCrisisTitle: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.brownDeep,
    marginTop: 4,
  },
  ppCrisisBody: {
    fontSize: 13,
    color: COLORS.textMid,
    marginTop: 4,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  ppCrisisCta: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.rustDark,
    marginTop: 10,
  },

  // Discharge welcome — soft cream-on-cream card. Sits above CheckinBanner on
  // first launch for early-postpartum users. Visually quiet (no rust hero) so
  // the page still leads with milestone content; the dismiss × is a small
  // tap target top-right and the "Got it" CTA is a discreet pill at the
  // bottom — both write the same key, so dismiss-on-X feels native.
  welcomeCard: {
    backgroundColor: '#FDFAF5',
    borderRadius: 14,
    padding: 18,
    paddingTop: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(184,92,56,0.20)',
  },
  welcomeDismiss: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeDismissIcon: {
    fontSize: 22,
    lineHeight: 22,
    color: COLORS.textLight,
    fontFamily: FONTS.body,
  },
  welcomeEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.5,
    color: COLORS.rustDark,
    textTransform: 'uppercase',
    paddingRight: 28, // leave space for the × tap target
  },
  welcomeTitle: {
    fontSize: 17,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.brownDeep,
    marginTop: 6,
    paddingRight: 28,
  },
  welcomeBody: {
    fontSize: 13,
    color: COLORS.textMid,
    marginTop: 6,
    lineHeight: 19,
    fontFamily: FONTS.body,
  },
  // Yolk-pill primary CTA (Phase 0 editorial pass) — warm yolkLight pill
  // w/ brownDeep text, matching MilkConnectHomeScreen.primaryBtn so all
  // primary CTAs across the app share one rhythm. Discharge welcome is a
  // smaller pill (12pt label, 8pad) than the standard primary; sizing
  // distinct so it doesn't compete with the hero card or check-in CTA.
  welcomeCta: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.yolkLight,
  },
  welcomeCtaText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.brownDeep,
    letterSpacing: 0.3,
  },

  checkinEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.5, color: COLORS.olive,
    textTransform: 'uppercase',
  },
  checkinEyebrowCrisis: { color: COLORS.rustDark },
  checkinTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 4 },
  checkinBody: { fontSize: 13, color: COLORS.textMid, marginTop: 4, lineHeight: 18, fontFamily: FONTS.body },
  checkinCta: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark, marginTop: 10 },

  // Compact pill variant of CheckinBanner — used for pending/answered states so
  // the daily check-in reads as a calm prompt rather than a hero block. Crisis
  // state still uses the full `checkinCard` block (earned visual weight).
  // Pending/answered check-in card — editorial paper card w/ yolk-circle
  // accent, eyebrow + Playfair italic prompt, mood dot anchor, and a yolk
  // pill CTA. Crisis state still uses the full `checkinCard` block.
  checkinCompact: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.paper, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
    overflow: 'hidden', position: 'relative',
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  checkinCompactDot: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(222,171,68,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  checkinCompactDotText: { fontSize: 20 },
  checkinCompactTextCol: { flex: 1 },
  checkinCompactEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.olive, textTransform: 'uppercase',
    marginBottom: 3,
  },
  checkinCompactTitle: {
    // Playfair Display Bold — same font used on the EXPLORE vertical tile
    // labels (Specialists / Milk / Gear / Events) so the daily check-in
    // title reads as part of the same family.
    fontSize: 14, fontFamily: FONTS.headerBold,
    color: COLORS.brownDeep, lineHeight: 19,
  },
  checkinCompactCtaPill: {
    backgroundColor: 'rgba(222,171,68,0.18)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    marginLeft: 10,
  },
  checkinCompactCtaPillText: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold,
    color: COLORS.brownDeep, letterSpacing: 0.2, opacity: 0.85,
  },

  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 20, alignItems: 'center',
    marginBottom: 12,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: COLORS.textMid, textAlign: 'center', lineHeight: 20, marginBottom: 14, fontFamily: FONTS.body },
  emptyCta: {
    backgroundColor: COLORS.yolkLight, borderRadius: 999,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyCtaText: { color: COLORS.brownDeep, fontSize: 14, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },

  // TODAY · WEEK twin card — single paper card hosting both the daily
  // check-in and the weekly journey side-by-side. Shared eyebrow at top,
  // hairline vertical divider between the two halves so they read as one
  // editorial spread (not two banners). Each half is its own touch target.
  twinCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 18,
    paddingTop: 14, paddingBottom: 14,
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
    overflow: 'hidden',
    shadowColor: '#2C1A0E',
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
    width: 12, height: 2, backgroundColor: COLORS.rust,
    marginRight: 8, borderRadius: 1,
  },
  twinEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.8,
    color: COLORS.textMid, textTransform: 'uppercase',
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
    backgroundColor: COLORS.ceramicDeep,
    opacity: 0.6,
    marginVertical: 4,
  },
  twinMoodDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(92,107,58,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  twinMoodGlyph: { fontSize: 18 },
  twinHalfEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.olive, textTransform: 'uppercase',
    marginBottom: 4,
  },
  // Left-half title — regular weight (was italic Playfair). Italic is
  // reserved for the right-half "Week N" moment so the card has a clear
  // bold/regular/italic balance instead of two italic statements.
  twinHalfTitle: {
    fontSize: 15, fontFamily: FONTS.bodyMedium,
    color: COLORS.brownDeep, lineHeight: 20, marginBottom: 8,
  },
  twinWeekText: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 22, color: COLORS.brownDeep,
    lineHeight: 26, marginBottom: 4, letterSpacing: 0.2,
  },
  twinHalfBody: {
    fontSize: 12, color: COLORS.textMid, lineHeight: 17,
    fontFamily: FONTS.body, marginBottom: 8,
  },
  twinHalfCta: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold,
    color: COLORS.diner, letterSpacing: 0.3,
    marginTop: 'auto',
  },

  // Hero week card — moodboard-aligned cream-on-cream w/ rust accent on the
  // eyebrow, Playfair italic week headline, soft yolk-circle accent on the
  // right. Drops the prior rust block + photo lane.
  heroCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 20, paddingRight: 76,
    marginBottom: 8,
    minHeight: 138,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
    overflow: 'hidden',
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  heroTextCol: { flex: 1 },
  heroEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: COLORS.diner, textTransform: 'uppercase',
  },
  heroWeekText: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 28, color: COLORS.brownDeep,
    marginTop: 6, marginBottom: 6, letterSpacing: 0.2,
    lineHeight: 32,
  },
  heroTagline: {
    fontSize: 14, color: COLORS.textMid, lineHeight: 20,
    fontFamily: FONTS.body,
  },
  heroCta: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.diner,
    marginTop: 10, letterSpacing: 0.3,
  },
  heroArrowPill: {
    position: 'absolute', right: 18, bottom: 18,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.diner,
    alignItems: 'center', justifyContent: 'center',
  },
  heroArrowPillText: { fontSize: 20, color: COLORS.paper, marginTop: -2 },

  // Section eyebrows that label rows in the new layout.
  sectionEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: COLORS.textMid, textTransform: 'uppercase', marginTop: 8, marginBottom: 8,
  },
  sectionEyebrowSmall: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.6,
    color: COLORS.rustDark, textTransform: 'uppercase', marginBottom: 6,
  },

  // Baby-this-week strip card.
  babyCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  babyCardBody: { fontSize: 13, color: COLORS.textMid, lineHeight: 19, fontFamily: FONTS.body },
  babyEmojiBubble: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#FCE9DD',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },

  // Two-up "you / village" cards.
  twoUpRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  imageCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12,
  },
  imageCardPhoto: {
    height: 84, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, overflow: 'hidden',
  },
  imageCardImage: { width: '100%', height: '100%' },
  imageCardLabel: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.brownDeep, textTransform: 'uppercase',
  },
  imageCardSub: { fontSize: 12, color: COLORS.textMid, marginTop: 4, lineHeight: 16, fontFamily: FONTS.body },

  // Editorial statement card — moodboard's "It takes a village. We built the
  // app." hook. Cream paper background, serif italic accent, Diner pill CTA,
  // subtle ✦ mark in the bottom-right corner. Routes to Manual tab.
  statementCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 18,
    padding: 18,
    paddingBottom: 16,
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.ceramicDeep,
    overflow: 'hidden',
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  statementEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.8,
    color: COLORS.diner, textTransform: 'uppercase', marginBottom: 12,
  },
  statementTitle: {
    fontSize: 32, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    lineHeight: 38, marginBottom: 10,
  },
  statementTitleItalic: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.diner,
  },
  statementBody: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 20, marginBottom: 16,
  },
  statementCta: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.yolkLight,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
  },
  statementCtaText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep,
    letterSpacing: 0.3,
  },
  statementMark: {
    position: 'absolute', right: 18, bottom: 18,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.blush,
    alignItems: 'center', justifyContent: 'center',
  },
  statementMarkText: {
    fontSize: 16, color: COLORS.dinerDark,
  },

  // Section heading row — small Diner accent bar + eyebrow.
  sectionHeadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, marginBottom: 12, paddingHorizontal: 12,
  },
  sectionAccentBar: {
    width: 12, height: 2, backgroundColor: COLORS.diner, borderRadius: 1,
  },

  // EXPLORE grid — 2x2 photo cards mirroring the moodboard's Home "Explore"
  // section. Each tile has a tinted photo band + label + subtitle, jumps to the
  // matching vertical (Specialists / Milk / Gear / Events).
  exploreGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10,
  },
  exploreTile: {
    width: '48.5%',
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
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
    fontSize: 15, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    marginBottom: 3,
  },
  exploreTileSub: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 16,
  },

  // Help grid — 4 accent-tinted editorial tiles in a row (Blush/Yolk/Lime/Ceramic).
  // Each tile carries a small numbered eyebrow ("01..04") + emoji + label, so the
  // grid reads like a magazine "what to do next" sidebar rather than a launcher.
  helpGrid: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 14,
  },
  helpTile: {
    flex: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'flex-start', justifyContent: 'space-between',
    minHeight: 116, overflow: 'hidden',
  },
  helpTileNumber: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.brownDeep, opacity: 0.55,
  },
  helpTileMarkWrap: { width: 50, height: 50, marginTop: 4 },
  helpTileLabel: {
    fontSize: 11, color: COLORS.brownDeep, lineHeight: 14, marginTop: 8,
    fontFamily: FONTS.bodySemiBold,
  },

  snapshotCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10,
  },
  snapshotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  snapshotTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },
  snapshotEdit: { fontSize: 13, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  snapshotRow: { flexDirection: 'row', gap: 12 },
  snapshotStat: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 12, padding: 12 },
  snapshotStatValue: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },
  snapshotStatLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 3, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: FONTS.body },

  timelineRow: { alignSelf: 'center', paddingVertical: 10 },
  timelineText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark },

  feedBlock: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10,
  },
  feedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  feedHeader: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },
  feedHeaderLink: { fontSize: 12, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  eventRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  eventRowTitle: { fontSize: 14, color: COLORS.brownDeep, fontFamily: FONTS.bodySemiBold },
  eventRowReason: { fontSize: 12, color: COLORS.textMid, marginTop: 2, lineHeight: 16, fontFamily: FONTS.body },

  tipCard: {
    backgroundColor: '#F4F1E4', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(92,107,58,0.2)',
  },
  tipEyebrow: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.5, color: COLORS.olive },
  tipBody: { fontSize: 14, color: COLORS.brownDeep, lineHeight: 20, marginTop: 6, fontFamily: FONTS.body },
  tipLink: { fontSize: 12, color: COLORS.rustDark, fontFamily: FONTS.bodySemiBold, marginTop: 8 },

  discoverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10,
  },
  discoverEmoji: { fontSize: 28 },
  discoverTitle: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },
  discoverDesc: { fontSize: 12, color: COLORS.textMid, marginTop: 2, fontFamily: FONTS.body },

  eventsCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 10,
  },
  eventsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventsEmoji: { fontSize: 28 },
  eventsTextWrap: { flex: 1 },
  eventsLabel: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },
  eventsPreview: { fontSize: 12, color: COLORS.textMid, marginTop: 2, fontFamily: FONTS.body },
  eventsArrow: { fontSize: 24, color: COLORS.textLight, fontFamily: FONTS.bodySemiBold },
});
