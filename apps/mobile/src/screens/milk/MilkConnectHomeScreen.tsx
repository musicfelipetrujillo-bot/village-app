import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { V3Card } from '@components/shared/V3Card';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useMilkStore } from '@store/milk';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkHome'>;

const BADGE_LABEL_KEYS: Record<string, string> = {
  none: 'milk.badgeNone',
  basic: 'milk.badgeBasic',
  verified: 'milk.badgeVerified',
  verified_bloodwork: 'milk.badgeVerifiedBloodwork',
};

const BADGE_COLOR: Record<string, string> = {
  none: '#9A8070',
  basic: COLORS.statusAlert,
  verified: '#6B7C3F',
  verified_bloodwork: COLORS.statusSuccess,
};

export default function MilkConnectHomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const { donorProfile, trustBadge, loading, fetchDonorData } = useMilkStore();

  useEffect(() => {
    if (user?.id) fetchDonorData(user.id);
  }, [user?.id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C07840" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <WarmGlowBackdrop hideClusters />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* v3 editorial masthead 2026-05-24 — replaces the prior full-bleed
          KenBurns photo header per Felipe ("remove the pictures, add
          similar formatting like the rest of the app"). Matches the
          VillageHomeV3 / HomeScreenV3 / ManualScrollV3 / InboxHomeScreen
          pattern: utility-row up top (back link left + action icons
          right), then eyebrow + split-headline + deck on the cream
          page wash, hairline rule below to seal the masthead block. */}
      <View style={styles.mastheadWrap}>
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
              onPress={() => navigation.navigate('MilkOrders')}
              accessibilityRole="button"
              accessibilityLabel={t('milk.ordersA11y')}
            >
              <Text style={styles.utilityIcon}>📦</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.utilityIconBtn}
              onPress={() => navigation.navigate('MilkMessageThreads')}
              accessibilityRole="button"
              accessibilityLabel={t('milk.messagesA11y')}
            >
              <Text style={styles.utilityIcon}>💬</Text>
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
              style={styles.dashboardBtn}
              onPress={() => navigation.navigate('DonorDashboard')}
            >
              <Text style={styles.dashboardBtnText}>{t('milk.myDashboard')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dashboardBtn, styles.dashboardBtnSecondary]}
              onPress={() => navigation.navigate('DonorListingManager')}
            >
              <Text style={styles.dashboardBtnText}>{t('milk.manageListings')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* AI Match — soft warm card with a single rust accent dot. Replaces the
          dark/black variant which fought with the cream editorial palette. */}
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => navigation.navigate('MilkMatch')}
        activeOpacity={0.85}
      >
        <View style={styles.matchAccent} />
        <View style={styles.matchTextWrap}>
          <Text style={styles.matchTitle}>{t('milk.matchTitle')}</Text>
          <Text style={styles.matchSub}>{t('milk.matchSub')}</Text>
        </View>
        <Text style={styles.matchArrow}>→</Text>
      </TouchableOpacity>

      {/* Magazine-style section break — full-bleed hairline anchors each
          editorial block so adjacent sections don't visually fuse on cream. */}
      <View style={styles.sectionDivider} />

      {/* Find a donor — centered editorial card, no thumb. The hero banner
          above the title carries the imagery for the whole page. */}
      <V3Card style={styles.section} contentStyle={styles.sectionContent}>
        <View style={styles.sectionTextCenter}>
          <View style={styles.eyebrowChipCenter}>
            <Text style={styles.eyebrowNum}>01</Text>
            <Text style={styles.eyebrowDash}>—</Text>
            <Text style={styles.eyebrow}>{t('milk.findDonorEyebrow')}</Text>
          </View>
          <Text style={styles.sectionTitleCenter}>{t('milk.findDonorTitle')}</Text>
          <Text style={styles.sectionBodyCenter}>{t('milk.findDonorBody')}</Text>
        </View>
        <View style={styles.browseRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: 1 }]}
            onPress={() => navigation.navigate('DonorSearchList')}
            activeOpacity={0.9}
          >
            {/* v9 iOS-26 wet-glass top sheen — softens the cinnamon fill so
                the button reads as a polished pill rather than a flat block. */}
            <GlassHighlight radius={999} height={14} />
            <Text style={styles.primaryBtnText}>{t('milk.browseNearby')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.savedBtn}
            onPress={() => navigation.navigate('SavedDonors')}
          >
            <Text style={styles.savedBtnText}>{t('milk.saved')}</Text>
          </TouchableOpacity>
        </View>
      </V3Card>

      {/* Become a donor — quiet typed numbered list, no rust circles.
          Inline "02 — LABEL" eyebrow matches section 01 (reference-UI
          editorial pattern: italic numeral + em-dash + small caps). */}
      {!donorProfile && <View style={styles.sectionDivider} />}
      {!donorProfile && (
        <V3Card style={styles.becomeDonorCard} contentStyle={styles.sectionContent}>
          <View style={styles.sectionTextCenter}>
            <View style={styles.eyebrowChipCenter}>
              <Text style={styles.eyebrowNum}>02</Text>
              <Text style={styles.eyebrowDash}>—</Text>
              <Text style={styles.eyebrow}>{t('milk.becomeDonorEyebrow')}</Text>
            </View>
            <Text style={styles.sectionTitleCenter}>{t('milk.becomeDonorTitle')}</Text>
            <Text style={styles.sectionBodyCenter}>
              {t('milk.becomeDonorSubPre')}
              <Text style={styles.boldRust}>{t('milk.becomeDonorAmount')}</Text>
              {t('milk.becomeDonorSubPost')}
            </Text>
          </View>
          <View style={styles.stepList}>
            {(['milk.step1', 'milk.step2', 'milk.step3'] as const).map((stepKey, i) => (
              <View key={stepKey} style={styles.stepRow2}>
                <Text style={styles.stepNumInline}>{`0${i + 1}`}</Text>
                <Text style={styles.stepLabel}>{t(stepKey)}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('BecomeDonorIntro')}
          >
            <Text style={styles.primaryBtnText}>{t('milk.getStarted')}</Text>
          </TouchableOpacity>
        </V3Card>
      )}

      {/* Trust & safety note — italic, quiet. */}
      <Text style={styles.safetyNoteText}>{t('milk.safetyNote')}</Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
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
  backToVillageText: { fontSize: 14, color: '#C07840', fontFamily: FONTS.bodySemiBold },
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
    width: 22, height: 2, backgroundColor: '#A77349',  // v9 rust-deep
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
    color: '#C07840',
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
    color: '#A77349',  // v9 rust-deep
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

  // Donor dashboard — slim white card, no shadow stack. Playfair italic name
  // + slim inline badge. One rust filled CTA + one rust outline.
  dashboardCard: {
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: '#F2E9C4',
    overflow: 'hidden',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
  },
  dashboardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dashboardLeft: { flex: 1, paddingRight: 12 },
  dashboardName: {
    fontSize: 22, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark, marginBottom: 4,
  },
  badgeText: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4,
  },
  dashboardStats: { alignItems: 'flex-end' },
  statValue: {
    fontSize: 32, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#C07840', lineHeight: 36,
  },
  statLabel: { fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.bodyMedium, letterSpacing: 0.5 },
  dashboardActions: { flexDirection: 'row', gap: 10 },
  // v9 paired donor-dashboard buttons — both use the parchment + cinnamon
  // hairline recipe so they read as siblings (was filled/outline mismatch
  // where the filled side disappeared into the peach card bg).
  dashboardBtn: {
    flex: 1, backgroundColor: '#EAE0C8', borderRadius: 999,
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#C07840',
  },
  dashboardBtnSecondary: {},  // no-op kept for compatibility w/ inline `[styles.dashboardBtn, styles.dashboardBtnSecondary]` callers
  dashboardBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#3D1F0E', letterSpacing: 0.3, textAlign: 'center' },

  // AI Match — cream-on-cream warm card with a single rust accent line on
  // the left edge instead of a full dark fill. Quieter, more editorial.
  matchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginTop: 10,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: COLORS.paper,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
  },
  matchAccent: {
    width: 4, height: 36, borderRadius: 2,
    backgroundColor: COLORS.coco,
  },
  matchTextWrap: { flex: 1 },
  matchTitle: {
    fontSize: 17, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark,
  },
  matchSub: { fontSize: 13, color: COLORS.barkSoft, marginTop: 2, lineHeight: 18, fontFamily: FONTS.body },
  matchArrow: { fontSize: 20, color: '#A77349', fontFamily: FONTS.bodySemiBold },

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
    color: COLORS.v2_salmon,
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
    color: '#FDFBF6',
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.92,
  },
  heroBannerLead: {
    fontSize: 28, lineHeight: 32,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#FDFBF6',
    marginBottom: 6,
  },
  heroBannerSub: {
    fontSize: 13, lineHeight: 18, fontFamily: FONTS.body,
    color: '#FDFBF6',
    opacity: 0.88,
    maxWidth: 320,
  },

  // Editorial sections — wrapped in a warm cream "bubble" so the whole
  // section (eyebrow chip + title + body + photo + CTAs) reads as one
  // discrete card lifted off the page cream. `paper` (#FDFAF5) is warmer
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
    backgroundColor: '#C07840', borderRadius: 999,
    paddingVertical: 12, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },
  primaryBtnText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#FDFBF6', letterSpacing: 0.3, textAlign: 'center' },
  // Secondary CTA — outline pill in the same yolk-pill rhythm (radius 999)
  // so the two buttons read as a paired set rather than two different shapes.
  savedBtn: {
    backgroundColor: 'transparent', borderRadius: 999,
    paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.coco,
  },
  savedBtnText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#C07840', letterSpacing: 0.3 },

  // Become-a-donor — same editorial structure as find-a-donor; V3Card
  // wraps it so it gets the identical immersive recipe (paper bg +
  // hairline rust border + cocoa shadow + glass sheen + inner glow).
  becomeDonorCard: {
    marginHorizontal: 20,
  },
  boldRust: { color: '#A77349', fontFamily: FONTS.bodySemiBold },
  stepList: { marginBottom: 14, gap: 10 },
  stepRow2: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(44,26,14,0.06)',
  },
  stepNumInline: {
    fontSize: 18, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#C07840', width: 28,
  },
  stepLabel: { flex: 1, fontSize: 14, color: COLORS.bark, fontFamily: FONTS.bodyMedium },

  // Safety note — italic body, quieter than a card. Anchored at the bottom.
  safetyNoteText: {
    fontSize: 12, color: COLORS.textLight, lineHeight: 18,
    textAlign: 'center',
    fontFamily: FONTS.body, fontStyle: 'italic',
    paddingHorizontal: 32, paddingTop: 18, paddingBottom: 6,
  },
});
