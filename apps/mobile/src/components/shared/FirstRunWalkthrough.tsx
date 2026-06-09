// First-run walkthrough — a short, swipeable tour shown once to brand-new
// users the first time they land on Home after signup. Self-contained: it
// reads/writes its own AsyncStorage flag so the host screen only has to render
// <FirstRunWalkthrough /> once. Modeled on the OnboardingScreen carousel
// (paged ScrollView + progress dots) so the visual language matches the
// pre-auth slides the user just came from.
//
// Gating key is versioned (`.v1`) so a future re-themed tour can re-show to
// users who already dismissed this one — mirrors the discharge-welcome card
// pattern in HomeScreen.
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView,
  Image, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import WarmGlowBackdrop from '@components/shared/WarmGlowBackdrop';

const WALKTHROUGH_KEY = 'village.walkthroughSeen.v1';
const { width } = Dimensions.get('window');
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

type Slide = { emoji: string; titleKey: string; bodyKey: string };
const SLIDES: Slide[] = [
  { emoji: '👋', titleKey: 'walkthrough.s1Title', bodyKey: 'walkthrough.s1Body' },
  { emoji: '🗓️', titleKey: 'walkthrough.s2Title', bodyKey: 'walkthrough.s2Body' },
  { emoji: '📖', titleKey: 'walkthrough.s3Title', bodyKey: 'walkthrough.s3Body' },
  { emoji: '🤝', titleKey: 'walkthrough.s4Title', bodyKey: 'walkthrough.s4Body' },
];

export default function FirstRunWalkthrough() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Decide visibility once on mount. Fail-safe: any read error → don't show
  // (better to skip the tour than to trap a returning user behind it).
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(WALKTHROUGH_KEY)
      .then((v) => { if (alive && v === null) setVisible(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    setVisible(false);
    // Fire-and-forget: if the write fails the tour re-shows next launch, which
    // is acceptable degradation (vs. blocking the UI on AsyncStorage).
    AsyncStorage.setItem(WALKTHROUGH_KEY, '1').catch(() => {});
  };

  const goNext = () => {
    if (slide < SLIDES.length - 1) {
      const next = slide + 1;
      setSlide(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    } else {
      dismiss();
    }
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== slide) setSlide(i);
  };

  const isLast = slide === SLIDES.length - 1;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={dismiss}>
      <View style={styles.container}>
        <WarmGlowBackdrop />

        {/* Top row — Skip (hidden on the last slide, where the primary CTA
            already dismisses) */}
        <View style={styles.topRow}>
          <Image source={VILLIE_BEE} resizeMode="contain" accessible={false} style={styles.topBee} />
          {!isLast ? (
            <TouchableOpacity
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel={t('walkthrough.skip')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.skip}>{t('walkthrough.skip')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 44 }} />}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s) => (
            <View key={s.titleKey} style={styles.slide}>
              <Text style={styles.emoji}>{s.emoji}</Text>
              <Text style={styles.title}>{t(s.titleKey)}</Text>
              <Text style={styles.body}>{t(s.bodyKey)}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Progress dots */}
        <View
          style={styles.progressRow}
          accessibilityRole="progressbar"
          accessibilityLabel={t('walkthrough.progress', { step: slide + 1, total: SLIDES.length })}
          accessibilityValue={{ min: 1, max: SLIDES.length, now: slide + 1 }}
        >
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.btn}
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? t('walkthrough.done') : t('walkthrough.next')}
        >
          <Text style={styles.btnText}>{isLast ? t('walkthrough.done') : t('walkthrough.next')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingHorizontal: 24,
  },
  topBee: { width: 32, height: 32, opacity: 0.9 },
  skip: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_link },

  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: {
    fontFamily: FONTS.v3_display,
    fontSize: 30,
    color: COLORS.v2_cocoa,
    lineHeight: 36,
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    color: COLORS.v2_walnut,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
    fontFamily: FONTS.v2_body,
  },

  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(61,31,14,0.14)',
    flex: 1,
    maxWidth: 60,
  },
  dotActive: { backgroundColor: COLORS.v2_cinnamon },

  btn: {
    marginHorizontal: 24,
    marginBottom: 36,
    backgroundColor: '#D96C88',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#D96C88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 3,
  },
  btnText: { color: COLORS.v2_card, fontSize: 15, fontFamily: FONTS.v2_link, letterSpacing: 0.2 },
});
