// MomHubScreen — V5 Phase 5.1 (2026-05-29)
//
// The mom-side surface. Replaces the now-removed "Mom Manual" track inside
// the Manual tab. Lives on the Home stack; reached from the Mom hero card
// on HomeScreenV3.
//
// 5.1 scope (this file): editorial scaffold with three sections —
//   1. Daily mom advice (today's prompt)
//   2. Mom hacks (curated tips, Pro-gated in 5.3)
//   3. Postpartum articles
//
// Each section renders a coming-soon teaser so the surface is visually
// complete + on-brand. Real content + Pro gating lands in 5.2 (daily
// advice generator) and 5.3 (hand-curated mom-hacks store + paywall).
//
// Brand: blush + salmon palette so this surface reads as "for mom" without
// going saccharine. Single Playfair italic on the title — same rule as
// every other v3 surface (one italic per screen).
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
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

function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Section card — used 3×: Daily advice, Mom hacks, Articles. Each has the
// same shape so the page reads as a coherent stack rather than 3 different
// surfaces. The eyebrow label color shifts per section so the eye has
// something to track.
function SectionCard({
  eyebrow, title, blurb, cta, accent, locked = false, onPress,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  cta: string;
  accent: string;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.sectionCard}>
      <Eyebrow color={accent}>{eyebrow}</Eyebrow>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBlurb}>{blurb}</Text>
      <View style={styles.sectionCtaRow}>
        <Text style={[styles.sectionCta, { color: accent }]}>{cta}</Text>
        {locked ? (
          <View style={[styles.lockPill, { backgroundColor: T.parchment }]}>
            <Text style={[styles.lockPillText, { color: T.cocoa }]}>Pro</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function MomHubScreen() {
  const navigation = useNavigation<any>();
  const t = useT();

  // Until the real surfaces ship in 5.2 / 5.3, every tap opens a soft
  // "coming soon" beat. Centralized so we can rewire each card to its
  // real destination as the phases land.
  const comingSoon = () => {
    // Quietest possible coming-soon affordance — no Alert, just a no-op.
    // The cards already telegraph "preview" via the blurb copy.
  };

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
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
          <Text style={styles.lede}>{t('momHub.lede')}</Text>

          <View style={styles.beeWrap}>
            <Image source={VILLIE_BEE} style={styles.bee} />
          </View>
        </View>

        <SectionCard
          eyebrow={t('momHub.adviceEyebrow')}
          title={t('momHub.adviceTitle')}
          blurb={t('momHub.adviceBlurb')}
          cta={t('momHub.adviceCta')}
          accent={T.cinnamon}
          onPress={comingSoon}
        />
        <SectionCard
          eyebrow={t('momHub.hacksEyebrow')}
          title={t('momHub.hacksTitle')}
          blurb={t('momHub.hacksBlurb')}
          cta={t('momHub.hacksCta')}
          accent={T.salmon}
          locked
          onPress={comingSoon}
        />
        <SectionCard
          eyebrow={t('momHub.articlesEyebrow')}
          title={t('momHub.articlesTitle')}
          blurb={t('momHub.articlesBlurb')}
          cta={t('momHub.articlesCta')}
          accent={T.caramel}
          onPress={comingSoon}
        />

        <Text style={styles.footer}>{t('momHub.footer')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 10, paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 15, color: T.cocoa, fontFamily: FONTS.v2_body, fontWeight: '500' },

  scroll: { padding: 22, paddingBottom: 80 },

  masthead: { marginBottom: 22, position: 'relative' },
  title: {
    marginTop: 12,
    fontFamily: FONTS.v3_display, fontSize: 42, lineHeight: 44,
    color: T.cocoa, letterSpacing: -1.4,
  },
  titleItalic: {
    fontFamily: FONTS.v3_display_italic, color: T.salmon, fontWeight: '600',
  },
  lede: {
    marginTop: 12, fontFamily: FONTS.v2_body, fontSize: 15.5, lineHeight: 22,
    color: T.walnut, maxWidth: 340,
  },

  beeWrap: { position: 'absolute', top: -8, right: -4, opacity: 0.55 },
  bee: { width: 48, height: 48, transform: [{ rotate: '-12deg' }] },

  sectionCard: {
    backgroundColor: T.paper,
    borderRadius: 18,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16,
    marginTop: 14,
    borderWidth: 1, borderColor: T.rule,
    shadowColor: T.cocoa, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 16,
    elevation: 2,
  },
  sectionTitle: {
    marginTop: 8, fontFamily: FONTS.v3_display, fontSize: 20, lineHeight: 24,
    color: T.cocoa, letterSpacing: -0.4,
  },
  sectionBlurb: {
    marginTop: 6, fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 19,
    color: T.walnut,
  },
  sectionCtaRow: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionCta: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '500',
  },
  lockPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(192, 120, 64, 0.35)',
  },
  lockPillText: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: '600',
  },

  footer: {
    marginTop: 28, fontFamily: FONTS.v2_body, fontSize: 12, lineHeight: 18,
    color: T.amber, textAlign: 'center', fontStyle: 'italic',
  },
});
