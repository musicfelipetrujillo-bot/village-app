// MomHubScreen — "your corner" (V5 Phase 5.1, relaid-out 2026-06-19)
//
// The mom-side surface. Reached from the "your corner" card on HomeScreenV3.
//
// Layout now mirrors the home page's rhythm instead of three identical white
// boxes: a soft blush masthead → a filled coral→rose ADVICE HERO (the anchor,
// same treatment as the home "your corner" card) → two differentiated TINTED
// icon cards (mom hacks · postpartum articles). Differentiated sizes + colored
// surfaces so the page reads as a designed stack, not a list of cards.
//
// Real content + Pro gating still lands in 5.2 / 5.3; every tap is a soft
// coming-soon no-op for now. i18n keys are unchanged (EN/ES preserved).
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { useT } from '@/i18n';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

const T = {
  paper:     COLORS.v2_paper,
  cream:     COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  blush:     COLORS.v2_blush,
  salmon:    COLORS.v2_salmon,
  cinnamon:  COLORS.v2_cinnamon,
  caramel:   COLORS.v2_caramel,
  cocoa:     COLORS.v2_cocoa,
  walnut:    COLORS.v2_walnut,
  amber:     COLORS.v2_amber,
  rule:      'rgba(61,31,14,0.13)',
};

function Eyebrow({ children, color = T.amber }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 16, height: 1.5, backgroundColor: color, marginRight: 8 }} />
      <Text style={{
        fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
        textTransform: 'uppercase', fontWeight: '500', color,
      }}>{children}</Text>
    </View>
  );
}

function Glyph({ d, color, size = 22 }: { d: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const GLYPH = {
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  article: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
} as const;

// Differentiated tinted feature card — icon chip + text column. Used for the
// two secondary surfaces (hacks, articles) so they read distinct from the
// gradient hero AND from each other (different tint + accent + icon).
function FeatureCard({
  tint, border, iconBg, iconColor, glyph, eyebrow, title, blurb, cta, accent, locked = false, onPress,
}: {
  tint: string; border: string; iconBg: string; iconColor: string; glyph: keyof typeof GLYPH;
  eyebrow: string; title: string; blurb: string; cta: string; accent: string; locked?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={[styles.featCard, { backgroundColor: tint, borderColor: border }]}>
      <View style={[styles.featIcon, { backgroundColor: iconBg }]}>
        <Glyph d={GLYPH[glyph]} color={iconColor} size={22} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow color={accent}>{eyebrow}</Eyebrow>
        <Text style={styles.featTitle}>{title}</Text>
        <Text style={styles.featBlurb}>{blurb}</Text>
        <View style={styles.featCtaRow}>
          <Text style={[styles.featCta, { color: accent }]}>{cta}</Text>
          {locked ? (
            <View style={styles.lockPill}><Text style={styles.lockPillText}>Pro</Text></View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MomHubScreen() {
  const navigation = useNavigation<any>();
  const t = useT();

  // Until the real surfaces ship (5.2 / 5.3), every tap is a soft no-op —
  // the cards telegraph "preview" via their blurb copy.
  const comingSoon = () => {};

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      {/* Soft blush wash up top — ties the surface to the "mama" palette so it
          reads warm-coral, not honey, the moment it opens. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.40)', 'rgba(247,197,203,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.5, 1]}
        style={styles.pageWash}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button"
          accessibilityLabel={t('common.back')} style={styles.backBtn}>
          <BackArrow color={T.cocoa} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.masthead}>
          <Eyebrow>{t('momHub.eyebrow')}</Eyebrow>
          <Text style={styles.title}>
            {t('momHub.titleLead')} <Text style={styles.titleItalic}>{t('momHub.titleEm')}</Text>
          </Text>
          <View style={styles.beeWrap}>
            <Image source={VILLIE_BEE} style={styles.bee} />
          </View>
        </View>

        {/* Advice hero — the anchor. Filled coral→rose, same family as the home
            "your corner" card, so the two surfaces feel continuous. */}
        <TouchableOpacity activeOpacity={0.93} onPress={comingSoon} style={styles.heroShadow}>
          <LinearGradient colors={['#E98A6A', '#E84B79']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
              pointerEvents="none"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 16, height: 1.5, backgroundColor: 'rgba(255,255,255,0.85)', marginRight: 8 }} />
              <Text style={styles.heroEyebrow}>{t('momHub.adviceEyebrow')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('momHub.adviceTitle')}</Text>
            <Text style={styles.heroBlurb}>{t('momHub.adviceBlurb')}</Text>
            <View style={styles.heroCtaRow}>
              <Text style={styles.heroCta}>{t('momHub.adviceCta')}</Text>
              <View style={styles.heroArrowBtn}><Text style={styles.heroArrow}>→</Text></View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <FeatureCard
          tint="#FBE7EC" border="rgba(217,108,136,0.28)" iconBg="#F7C5CB" iconColor={T.cinnamon}
          glyph="sparkle" accent={T.cinnamon}
          eyebrow={t('momHub.hacksEyebrow')}
          title={t('momHub.hacksTitle')}
          blurb={t('momHub.hacksBlurb')}
          cta={t('momHub.hacksCta')}
          locked
          onPress={comingSoon}
        />
        <FeatureCard
          tint="#FBEADE" border="rgba(233,138,106,0.30)" iconBg="#F3B79C" iconColor={T.caramel}
          glyph="article" accent={T.caramel}
          eyebrow={t('momHub.articlesEyebrow')}
          title={t('momHub.articlesTitle')}
          blurb={t('momHub.articlesBlurb')}
          cta={t('momHub.articlesCta')}
          onPress={comingSoon}
        />

        <Text style={styles.footer}>{t('momHub.footer')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 10, paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 15, color: T.cocoa, fontFamily: FONTS.v2_body, fontWeight: '500' },

  scroll: { padding: 22, paddingBottom: 80 },

  masthead: { marginBottom: 20, position: 'relative' },
  title: {
    marginTop: 12,
    fontFamily: FONTS.v3_display, fontSize: 40, lineHeight: 42,
    color: T.cocoa, letterSpacing: -1.4,
  },
  titleItalic: { fontFamily: FONTS.v3_display_italic, color: T.salmon, fontWeight: '600' },
  lede: {
    marginTop: 12, fontFamily: FONTS.v2_body, fontSize: 15.5, lineHeight: 22,
    color: T.walnut, maxWidth: 340,
  },
  beeWrap: { position: 'absolute', top: -8, right: -4, opacity: 0.55 },
  bee: { width: 48, height: 48, transform: [{ rotate: '-12deg' }] },

  // ── Advice hero (filled gradient) ─────────────────────────────────────
  heroShadow: {
    borderRadius: 22,
    shadowColor: T.cinnamon, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28, shadowRadius: 26, elevation: 5,
  },
  heroCard: { borderRadius: 22, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20, overflow: 'hidden' },
  heroEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500', color: 'rgba(255,255,255,0.92)',
  },
  heroTitle: {
    marginTop: 12, fontFamily: FONTS.v3_display, fontSize: 25, lineHeight: 30,
    color: '#FFFDF8', letterSpacing: -0.6, maxWidth: '88%',
  },
  heroBlurb: {
    marginTop: 8, fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: 'rgba(255,253,248,0.92)', maxWidth: '90%',
  },
  heroCtaRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCta: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '600', color: '#FFFDF8',
  },
  heroArrowBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center',
  },
  heroArrow: { color: '#fff', fontSize: 20, fontFamily: FONTS.v3_display, marginTop: -2 },

  // ── Tinted feature cards ──────────────────────────────────────────────
  featCard: {
    marginTop: 14, borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderWidth: 1,
    shadowColor: T.cocoa, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 2,
  },
  featIcon: {
    width: 48, height: 48, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  featTitle: {
    marginTop: 8, fontFamily: FONTS.v3_display, fontSize: 19, lineHeight: 23,
    color: T.cocoa, letterSpacing: -0.4,
  },
  featBlurb: {
    marginTop: 5, fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 18.5, color: T.walnut,
  },
  featCtaRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  featCta: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '500',
  },
  lockPill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    backgroundColor: T.parchment, borderWidth: 1, borderColor: 'rgba(192,120,64,0.35)',
  },
  lockPillText: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: '600', color: T.cocoa,
  },

  footer: {
    marginTop: 28, fontFamily: FONTS.v2_body, fontSize: 12, lineHeight: 18,
    color: T.amber, textAlign: 'center', fontStyle: 'italic',
  },
});
