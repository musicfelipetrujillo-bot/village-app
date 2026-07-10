import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { HoneycombBackdrop, type HoneycombIntensity } from '@components/shared/HoneycombBackdrop';
import { V3Card } from '@components/shared/V3Card';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useMilkStore } from '@store/milk';
import { COLORS, FONTS } from '@utils/constants';
import { cardLift, cardLiftBorder } from '@utils/cardLift';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

// Section honeycomb hero — Milk Connect accent = blush (matches the Home pillar).
const MILK_ACCENT = '#F7C5CB';
// PROTOTYPE: flip between 'subtle' and 'playful' to compare on Chrome before
// the rollout standardizes one across all four sections.
const PREVIEW_INTENSITY: HoneycombIntensity = 'playful';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkHome'>;

const BADGE_LABEL_KEYS: Record<string, string> = {
  none: 'milk.badgeNone',
  basic: 'milk.badgeBasic',
  verified: 'milk.badgeVerified',
  verified_bloodwork: 'milk.badgeVerifiedBloodwork',
};

const BADGE_COLOR: Record<string, string> = {
  none: '#7A4A24',
  basic: COLORS.statusAlert,
  verified: '#E98A6A',
  verified_bloodwork: COLORS.statusSuccess,
};

// Clean SVG icon system (replaces the emoji utility icons + the left accent
// bars) — matches the home page's icon language.
const ICON = {
  heart:   'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
  box:     'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  chat:    'M4 5h16v11H9l-4 4V5z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  search:  'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
} as const;

function Glyph({ d, color, size = 18, sw = 1.9 }: { d: string; color: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function MilkConnectHomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const { donorProfile, trustBadge, loading, fetchDonorData } = useMilkStore();

  useEffect(() => {
    if (user?.id) fetchDonorData(user.id);
  }, [user?.id]);

  // Shared route for the listing CTA — established donors jump straight to a
  // new listing; everyone else enters the screened donor onboarding first.
  const onShareMilk = () =>
    donorProfile
      ? navigation.navigate('CreateListing', { donorProfileId: donorProfile.id })
      : navigation.navigate('BecomeDonorIntro');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#D96C88" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <WarmGlowBackdrop hideClusters />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.36)', 'rgba(247,197,203,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* v3 editorial masthead 2026-05-24 — replaces the prior full-bleed
          KenBurns photo header per Felipe ("remove the pictures, add
          similar formatting like the rest of the app"). Matches the
          VillageHomeV3 / HomeScreenV3 / ManualScrollV3 / InboxHomeScreen
          pattern: utility-row up top (back link left + action icons
          right), then eyebrow + split-headline + deck on the cream
          page wash, hairline rule below to seal the masthead block. */}
      <View style={styles.mastheadWrap}>
        <HoneycombBackdrop accent={MILK_ACCENT} intensity={PREVIEW_INTENSITY} scene="milk" />
        <View style={styles.mastheadUtility}>
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate('Village' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('common.backToVillage')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backLink}>← {t('common.backToVillage')}</Text>
          </TouchableOpacity>
          <View style={styles.utilityRight}>
            <TouchableOpacity
              style={styles.utilityIconBtn}
              onPress={() => navigation.navigate('SavedDonors')}
              accessibilityRole="button"
              accessibilityLabel={t('milk.saved')}
            >
              <Glyph d={ICON.heart} color={COLORS.v2_cinnamon} size={17} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.utilityIconBtn}
              onPress={() => navigation.navigate('MilkOrders')}
              accessibilityRole="button"
              accessibilityLabel={t('milk.ordersA11y')}
            >
              <Glyph d={ICON.box} color={COLORS.v2_walnut} size={17} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.utilityIconBtn}
              onPress={() => navigation.navigate('MilkMessageThreads')}
              accessibilityRole="button"
              accessibilityLabel={t('milk.messagesA11y')}
            >
              <Glyph d={ICON.chat} color={COLORS.v2_walnut} size={17} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.mastheadEyebrowRow}>
          <View style={styles.mastheadEyebrowBar} />
          <Text style={styles.mastheadEyebrowText}>{t('milk.eyebrow')}</Text>
        </View>
        <Text style={styles.mastheadTitle}>
          {t('milk.homeTitleRoman')}{' '}
          <Text style={styles.mastheadTitleItalic}>{t('milk.homeTitleItalic')}</Text>
        </Text>
        <Text style={styles.mastheadDeck}>{t('milk.homeSub')}</Text>
        <View style={styles.mastheadRule} />
      </View>

      {/* Donor dashboard — quieter, editorial. Playfair italic name + stat,
          single-line slim badge, two minimal actions. */}
      {donorProfile && (
        <View style={styles.dashboardCard}>
          {/* v9 paper-leaning dashboard wash — softer cream→blush so the
              card sits on the page rather than competing with it. */}
          <LinearGradient
            colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.dashboardRow}>
            <View style={styles.dashboardLeft}>
              <Text style={styles.dashboardName}>{donorProfile.display_name}</Text>
              <Text
                style={[
                  styles.badgeText,
                  { color: BADGE_COLOR[trustBadge?.badge_level ?? 'none'] },
                ]}
              >
                · {t(BADGE_LABEL_KEYS[trustBadge?.badge_level ?? 'none'])}
              </Text>
            </View>
            <View style={styles.dashboardStats}>
              <Text style={styles.statValue}>{donorProfile.supply_oz_available}</Text>
              <Text style={styles.statLabel}>{t('milk.ozAvailable')}</Text>
            </View>
          </View>
          <View style={styles.dashboardActions}>
            <TouchableOpacity
              style={[styles.dashboardBtn, styles.dashboardBtnPrimary]}
              onPress={onShareMilk}
              accessibilityRole="button"
              accessibilityLabel={t('milk.addListingA11y')}
            >
              <Text style={[styles.dashboardBtnText, styles.dashboardBtnTextPrimary]}>{t('milk.addListing')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dashboardBtn, styles.dashboardBtnSecondary]}
              onPress={() => navigation.navigate('DonorListingManager')}
            >
              <Text style={styles.dashboardBtnText}>{t('milk.manageListings')}</Text>
            </TouchableOpacity>
          </View>
          {/* Social links — self-attested credibility (Risk & Compliance:
              donor-provided, not verified). Opens the editor. */}
          <TouchableOpacity
            style={styles.socialCta}
            onPress={() => navigation.navigate('DonorSocialLinks', { donorProfileId: donorProfile.id })}
            accessibilityRole="button"
            accessibilityLabel={t('milk.socialCtaA11y')}
          >
            <Text style={styles.socialCtaText}>
              {donorProfile.social_links && Object.keys(donorProfile.social_links).length > 0
                ? t('milk.socialCtaEdit')
                : t('milk.socialCtaAdd')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Two-up hero — find milk / share milk as a balanced, COLORED pair.
          Replaces the cream-on-cream "01/02" cards (which read flat) with the
          Village-hub tile palette (blush recipients · peach donors) so the page
          carries warmth + the two paths get equal weight side by side. The
          whole tile is the tap target; "Saved" moved to the masthead heart. */}
      <View style={styles.heroRow}>
        <TouchableOpacity
          style={[styles.heroTile, { backgroundColor: '#F7C5CB' }]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('DonorSearchList')}
          accessibilityRole="button"
          accessibilityLabel={t('milk.findDonorTitle')}
        >
          <LinearGradient
            colors={['rgba(253,251,246,0.34)', 'rgba(253,251,246,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]}
            pointerEvents="none"
          />
          <View>
            <View style={styles.heroTileIcon}>
              <Glyph d={ICON.search} color={COLORS.v2_cocoa} size={19} />
            </View>
            <Text style={styles.heroTileRole}>{t('milk.findRole')}</Text>
            <Text style={styles.heroTileTitle}>{t('milk.findDonorTitle')}</Text>
            <Text style={styles.heroTileSub}>{t('milk.findDonorTileSub')}</Text>
          </View>
          <View style={styles.heroTileFooter}>
            <Text style={styles.heroTileCta}>{t('milk.findTileCta')}</Text>
            <Text style={styles.heroTileArrow}>→</Text>
          </View>
        </TouchableOpacity>

        {/* "Share your milk" is hidden for existing donors — for them it just
            duplicates the dashboard's "Add a listing" above. Non-donors see it
            as the clearly-distinct (honey, "have extra?") become-a-donor path. */}
        {!donorProfile && (
        <TouchableOpacity
          style={[styles.heroTile, { backgroundColor: '#F0CD82' }]}
          activeOpacity={0.9}
          onPress={onShareMilk}
          accessibilityRole="button"
          accessibilityLabel={t('milk.becomeDonorTitle')}
        >
          <LinearGradient
            colors={['rgba(253,251,246,0.34)', 'rgba(253,251,246,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]}
            pointerEvents="none"
          />
          <View>
            <View style={styles.heroTileIcon}>
              <Glyph d={ICON.droplet} color={COLORS.v2_cocoa} size={19} />
            </View>
            <Text style={styles.heroTileRole}>{t('milk.shareRole')}</Text>
            <Text style={styles.heroTileTitle}>{t('milk.becomeDonorTitle')}</Text>
            <Text style={styles.heroTileSub}>{t('milk.shareTileSub')}</Text>
          </View>
          <View style={styles.heroTileFooter}>
            <Text style={styles.heroTileCta}>{t('milk.shareTileCta')}</Text>
            <Text style={styles.heroTileArrow}>→</Text>
          </View>
        </TouchableOpacity>
        )}
      </View>

      {/* AI Match — demoted BELOW the two equal hero tiles per Felipe so it
          reads as the lighter, secondary "not sure?" path rather than a peer of
          the two primary actions. The "or" divider sets it apart as the
          alternative entry. */}
      <View style={styles.matchDivider}>
        <View style={styles.matchDividerLine} />
        <Text style={styles.matchDividerText}>or</Text>
        <View style={styles.matchDividerLine} />
      </View>
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => navigation.navigate('MilkMatch')}
        activeOpacity={0.85}
      >
        <View style={styles.matchIcon}>
          <Glyph d={ICON.sparkle} color={COLORS.v2_cinnamon} size={18} />
        </View>
        <View style={styles.matchTextWrap}>
          <Text style={styles.matchTitle}>{t('milk.matchTitle')}</Text>
          <Text style={styles.matchSub}>{t('milk.matchSub')}</Text>
        </View>
        <Text style={styles.matchArrow}>→</Text>
      </TouchableOpacity>

      {/* Trust signal that used to live in the Find-a-donor card body. */}
      <Text style={styles.trustCaption}>{t('milk.donorTrustCaption')}</Text>

      {/* Trust & safety note — italic, quiet. */}
      <Text style={styles.safetyNoteText}>{t('milk.safetyNote')}</Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 640 },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0E8' },

  header: {
    // Editorial header — cream-on-cream like every other vertical
    // (Experts, Gear, Events, Perks). Top action bar separated from
    // the title block so the eyebrow → title → subtitle stack reads
    // as a magazine page rather than app chrome.
    backgroundColor: COLORS.cream,
    paddingTop: 56,
    paddingBottom: 0,
    paddingHorizontal: 20,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backToVillage: { paddingVertical: 4, paddingRight: 8 },
  backToVillageText: { fontSize: 14, color: '#D96C88', fontFamily: FONTS.bodySemiBold },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.paper,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: { fontSize: 18 },

  // Title block — relative so the YolkCircle / LeafSprig can absolute-position
  // around the eyebrow + title without escaping the header column.
  titleBlock: {
    position: 'relative',
    paddingTop: 4,
    paddingBottom: 14,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  // Section eyebrow row — sits naturally on the section's paper bubble
  // (no inner chip). The bubble itself gives the eyebrow its visual
  // backing; an extra chip-inside-bubble was visual double-duty.
  eyebrowChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginBottom: 8,
  },
  eyebrowBar: {
    width: 22, height: 2, backgroundColor: '#7A4A24',  // v9 rust-deep
    marginRight: 10, borderRadius: 1,
  },
  // Reference-UI inline numbering: italic Playfair numeral + em-dash +
  // small-caps label. The whole row sits inside an `eyebrowChip` (above)
  // which gives it its cream-tone thumbnail bg.
  // includeFontPadding:false + matching lineHeight keep the numeral on the
  // optical line of the dash + small caps when flex alignItems:'center'.
  eyebrowNum: {
    fontSize: 20, lineHeight: 22,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#D96C88',
    marginRight: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  eyebrowDash: {
    fontSize: 14, lineHeight: 22,
    fontFamily: FONTS.body,
    color: COLORS.barkSoft,
    marginRight: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  eyebrow: {
    fontSize: 11, lineHeight: 22, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: '#7A4A24',  // v9 rust-deep
    textTransform: 'uppercase',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  headerTitle: {
    fontSize: 38, lineHeight: 44,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14, lineHeight: 20,
    color: COLORS.barkSoft, fontFamily: FONTS.body,
    maxWidth: 320,
  },
  headerHairline: {
    height: 1,
    backgroundColor: 'rgba(44,26,14,0.08)',
    marginHorizontal: -20,
  },

  // Donor dashboard — lifted v3 card (was blending into the WarmGlow
  // gradient with stale #F2E9C4 golden bg + no shadow per blend audit).
  // Now paper bg + canonical cardLift recipe so it sits well above the
  // page wash, matching DailyCheckinStrip on Home.
  dashboardCard: {
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: COLORS.v2_card,
    overflow: 'hidden',
    borderRadius: 18,
    padding: 16,
    ...cardLiftBorder,
    ...cardLift,
  },
  dashboardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dashboardLeft: { flex: 1, paddingRight: 12 },
  dashboardName: {
    fontSize: 22, fontFamily: FONTS.v3_display,
    color: COLORS.v2_cocoa, marginBottom: 4, letterSpacing: -0.5,
  },
  badgeText: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4,
  },
  dashboardStats: { alignItems: 'flex-end' },
  statValue: {
    fontSize: 32, fontFamily: FONTS.v3_display,
    color: '#D96C88', lineHeight: 36, letterSpacing: -1,
  },
  statLabel: { fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.bodyMedium, letterSpacing: 0.5 },
  dashboardActions: { flexDirection: 'row', gap: 10 },
  // v9 paired donor-dashboard buttons — both use the parchment + cinnamon
  // hairline recipe so they read as siblings (was filled/outline mismatch
  // where the filled side disappeared into the peach card bg).
  dashboardBtn: {
    flex: 1, backgroundColor: '#F2E6DD', borderRadius: 999,
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#D96C88',
  },
  dashboardBtnSecondary: {},  // no-op kept for compatibility w/ inline `[styles.dashboardBtn, styles.dashboardBtnSecondary]` callers
  // Primary donor action — filled cinnamon "＋ Add a listing" (the working
  // create entry; the old paired buttons both pointed at placeholder screens).
  dashboardBtnPrimary: { backgroundColor: '#D96C88', borderColor: '#D96C88' },
  dashboardBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#43260F', letterSpacing: 0.3, textAlign: 'center' },
  dashboardBtnTextPrimary: { color: '#FFFCF6' },
  socialCta: { marginTop: 10, alignSelf: 'flex-start' },
  socialCtaText: { fontSize: 12.5, fontFamily: FONTS.v2_link, color: COLORS.v2_cinnamon, letterSpacing: 0.2 },

  // AI Match — cream-on-cream warm card with a single rust accent line on
  // the left edge instead of a full dark fill. Quieter, more editorial.
  // "or" divider — sets the secondary match path apart from the two primaries.
  matchDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 16, marginBottom: 12,
  },
  matchDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,14,0.16)' },
  matchDividerText: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', color: COLORS.v2_walnut,
  },
  // Secondary, demoted: slimmer padding + smaller icon/title than the hero
  // tiles so it reads as the lighter "not sure?" option, not a third primary.
  matchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginHorizontal: 20,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: '#FBEFD9',  // soft honey — warms the AI feature row
    borderWidth: 1, borderColor: 'rgba(212,150,60,0.28)',
  },
  matchAccent: {
    width: 4, height: 36, borderRadius: 2,
    backgroundColor: '#D96C88',  // cinnamon action accent
  },
  matchIcon: {
    width: 32, height: 32, borderRadius: 11,
    backgroundColor: '#FFFDF8',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(212,150,60,0.30)',
  },
  matchTextWrap: { flex: 1 },
  matchTitle: {
    fontSize: 14.5, fontFamily: FONTS.v3_display,
    color: COLORS.v2_cocoa, letterSpacing: -0.3,
  },
  matchSub: { fontSize: 13, color: COLORS.barkSoft, marginTop: 2, lineHeight: 18, fontFamily: FONTS.body },
  matchArrow: { fontSize: 20, color: '#7A4A24', fontFamily: FONTS.bodySemiBold },

  // Spacer between editorial bubbles — replaces the hairline divider now
  // that each section is its own paper-bg card. Pure spacing so adjacent
  // bubbles breathe without an extra rule line competing with the rounded
  // edges.
  sectionDivider: {
    height: 14,
  },

  // v3 editorial masthead (replaces the prior KenBurns photo header
  // 2026-05-24). Cocoa-on-cream tokens matching VillageHomeV3.
  mastheadWrap: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  mastheadUtility: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backLink: {
    fontFamily: FONTS.v2_mono, fontSize: 12, color: COLORS.v2_walnut,
    letterSpacing: 0.6,
  },
  utilityRight: { flexDirection: 'row', gap: 8 },
  utilityIconBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.v2_parchment,
    alignItems: 'center', justifyContent: 'center',
  },
  utilityIcon: { fontSize: 16 },
  mastheadEyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  mastheadEyebrowBar: {
    width: 16, height: 1.5, backgroundColor: COLORS.v2_walnut,
    marginRight: 8,
  },
  mastheadEyebrowText: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500',
    color: COLORS.v2_walnut,
  },
  mastheadTitle: {
    marginTop: 6,
    fontFamily: FONTS.v3_display, fontSize: 36, lineHeight: 40,
    color: COLORS.v2_cocoa,
    letterSpacing: -0.9,
  },
  mastheadTitleItalic: {
    fontFamily: FONTS.v3_display_italic,
    color: '#E27A93', // Milk signature: soft rose-pink
    fontStyle: 'italic',
  },
  mastheadDeck: {
    marginTop: 10,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: COLORS.v2_walnut,
    maxWidth: 340,
  },
  mastheadRule: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    width: 48,
    backgroundColor: 'rgba(61,31,14,0.13)',
  },
  heroBannerImage: {
    width: '100%', height: '100%',
  },
  // Warm scrim — soft brownDeep at low opacity so the cream copy
  // overlay reads on bright photo crops without flattening the image.
  heroBannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,26,14,0.28)',
  },
  // Overlay copy column — bottom-left anchor (editorial cover convention)
  // with generous padding so the copy doesn't crowd the image edges.
  heroBannerOverlay: {
    position: 'absolute', left: 20, right: 20, bottom: 18,
  },
  heroBannerEyebrow: {
    fontSize: 11, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFCF6',
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.92,
  },
  heroBannerLead: {
    fontSize: 28, lineHeight: 32,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#FFFCF6',
    marginBottom: 6,
  },
  heroBannerSub: {
    fontSize: 13, lineHeight: 18, fontFamily: FONTS.body,
    color: '#FFFCF6',
    opacity: 0.88,
    maxWidth: 320,
  },

  // Editorial sections — wrapped in a warm cream "bubble" so the whole
  // section (eyebrow chip + title + body + photo + CTAs) reads as one
  // discrete card lifted off the page cream. `paper` (#FFFCF6) is warmer
  // than grey — keeps the cream-on-cream rhythm without flattening to a
  // utilitarian neutral. Generous padding + 18px radius matches the hero-
  // card scale in editorial-system.md.
  // `position: relative` so abstract decorative marks anchor inside the
  // bubble.
  // Outer V3Card style — margins only. V3Card provides the paper bg,
  // hairline rust border, cocoa floating shadow, top inner glow, and
  // iOS-26 wet-glass sheen so we no longer hand-roll the recipe here.
  section: {
    marginHorizontal: 20,
  },
  // Inner content padding (passed to V3Card via `contentStyle`).
  sectionContent: {
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
    position: 'relative',
  },

  // Bold serif (Playfair 700) — non-italic. Per editorial-system.md, section
  // titles are bold-serif so the eyebrow → title → body stack reads as a
  // declarative magazine subhead, not a soft pull quote. Page-level titles
  // (headerTitle above) stay italic — italic is reserved for the page lead.
  sectionTitle: {
    fontSize: 24, lineHeight: 30,
    fontFamily: FONTS.headerBold,
    color: COLORS.bark, marginBottom: 6,
  },
  sectionBody: {
    fontSize: 14, color: COLORS.barkSoft, lineHeight: 20,
    marginBottom: 12, fontFamily: FONTS.body, maxWidth: 360,
  },
  // Discover-spread row: text column flexes, thumbnail anchors right.
  // alignItems:'flex-start' so a tall text block doesn't stretch the
  // thumb vertically — it stays a fixed 84pt square against the top.
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  sectionText: { flex: 1 },
  // Centered variants — used when a section has no thumb. Eyebrow chip
  // also re-aligned center so the whole "01 — FOR RECIPIENTS" row sits
  // mid-column. alignItems on the wrapper centers the chip; textAlign
  // centers the title + body.
  sectionTextCenter: { alignItems: 'center' },
  eyebrowChipCenter: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center', marginBottom: 8,
  },
  sectionTitleCenter: {
    fontSize: 24, lineHeight: 30,
    fontFamily: FONTS.headerBold,
    color: COLORS.bark, marginBottom: 6,
    textAlign: 'center',
  },
  sectionBodyCenter: {
    fontSize: 14, color: COLORS.barkSoft, lineHeight: 20,
    marginBottom: 12, fontFamily: FONTS.body,
    textAlign: 'center', maxWidth: 360,
  },
  // Photo thumbnail — moodboard's Discover spread anchors each section
  // row with an editorial crop. Cream backgroundColor is the loading
  // fallback so the layout doesn't pop when the remote image resolves.
  // overflow:hidden so the image respects the rounded corners.
  sectionThumb: {
    width: 84, height: 84, borderRadius: 14,
    backgroundColor: '#EFE6D8',
    overflow: 'hidden',
  },
  sectionThumbImage: {
    width: '100%', height: '100%',
  },
  browseRow: { flexDirection: 'row', gap: 10 },
  // Primary CTA — yolk pill, matching the moodboard's "Continue Week N"
  // pattern from the manual + home hero. brownDeep text on yolk reads as
  // warm and intentional rather than the rust-on-cream button look that
  // was competing with the rust accent typography.
  // v9 canonical CTA — cinnamon fill, action-deep tonal shadow, glass sheen
  // overlay (added via JSX child for iOS-26 wet-glass polish). overflow:hidden
  // so the sheen clips to the pill shape. Shadow dialed from 0.24 → 0.18 so
  // the cinnamon block reads as a polished pill, not a flat orange shout.
  primaryBtn: {
    backgroundColor: '#D96C88', borderRadius: 999,
    paddingVertical: 12, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#D96C88', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },
  primaryBtnText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#FFFCF6', letterSpacing: 0.3, textAlign: 'center' },
  // Secondary CTA — outline pill in the same yolk-pill rhythm (radius 999)
  // so the two buttons read as a paired set rather than two different shapes.
  savedBtn: {
    backgroundColor: 'transparent', borderRadius: 999,
    paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.coco,
  },
  savedBtnText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#D96C88', letterSpacing: 0.3 },

  // Become-a-donor — same editorial structure as find-a-donor; V3Card
  // wraps it so it gets the identical immersive recipe (paper bg +
  // hairline rust border + cocoa shadow + glass sheen + inner glow).
  becomeDonorCard: {
    marginHorizontal: 20,
  },
  boldRust: { color: '#7A4A24', fontFamily: FONTS.bodySemiBold },
  stepList: { marginBottom: 14, gap: 10 },
  stepRow2: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(44,26,14,0.06)',
  },
  stepNumInline: {
    fontSize: 18, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#D96C88', width: 28,
  },
  stepLabel: { flex: 1, fontSize: 14, color: COLORS.bark, fontFamily: FONTS.bodyMedium },

  // Safety note — italic body, quieter than a card. Anchored at the bottom.
  safetyNoteText: {
    fontSize: 12, color: COLORS.textLight, lineHeight: 18,
    textAlign: 'center',
    fontFamily: FONTS.body, fontStyle: 'italic',
    paddingHorizontal: 32, paddingTop: 18, paddingBottom: 6,
  },

  // ── Two-up hero tiles — colored find/share paths ───────────────────────
  // Equal-weight 1×2 tile row (blush recipients · peach donors), the Village-
  // hub recipe: tinted fill + paper top-sheen (added inline) + warm shadow.
  heroRow: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 20, marginTop: 14,
  },
  heroTile: {
    flex: 1, minHeight: 172,
    borderRadius: 18, padding: 16, paddingBottom: 13,
    overflow: 'hidden', justifyContent: 'space-between',
    shadowColor: '#7A4A24', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20, shadowRadius: 26, elevation: 3,
  },
  heroTileIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,253,248,0.78)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 9,
  },
  // Role eyebrow — the at-a-glance "which one is this for" cue (need milk? /
  // have extra?) so the two tiles never read as the same thing.
  heroTileRole: {
    fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.3,
    textTransform: 'uppercase', color: 'rgba(67,38,15,0.55)', marginBottom: 3,
  },
  heroTileTitle: {
    fontFamily: FONTS.v3_display, fontSize: 20, lineHeight: 23,
    letterSpacing: -0.6, color: '#43260F',
  },
  heroTileSub: {
    fontFamily: FONTS.body, fontSize: 12, lineHeight: 16,
    color: '#43260F', opacity: 0.78, marginTop: 7,
  },
  heroTileFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(61,31,14,0.20)',
  },
  heroTileCta: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#43260F',
  },
  heroTileArrow: { fontSize: 16, color: '#43260F', fontFamily: FONTS.bodySemiBold },
  trustCaption: {
    fontFamily: FONTS.body, fontSize: 11.5, lineHeight: 16,
    color: COLORS.textLight, textAlign: 'center',
    marginHorizontal: 28, marginTop: 12,
  },
});
