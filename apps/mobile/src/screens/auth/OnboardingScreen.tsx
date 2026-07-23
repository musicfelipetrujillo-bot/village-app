// Onboarding — 3 slides matching v2 prototype
// Slide 0: Welcome  Slide 1: Language  Slide 2: Location
//
// i18n note: copy is read via `useT()`, which falls back to the pre-auth
// language store (AsyncStorage-backed) until the user signs in. Picking
// Español on slide 1 writes through `usePreAuthLanguage.setLanguage`, which
// updates the store synchronously — slides 0 and 2 re-render in the chosen
// language without leaving the screen.
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import { useT } from '@/i18n';
import { usePreAuthLanguage } from '@store/preAuthLanguage';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');
const SLIDES = ['welcome', 'language', 'location'] as const;

export default function OnboardingScreen({ navigation }: Props) {
  const t = useT();
  const selectedLang = usePreAuthLanguage((s) => s.language);
  const setPreAuthLang = usePreAuthLanguage((s) => s.setLanguage);
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      const next = currentSlide + 1;
      setCurrentSlide(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    } else {
      navigation.navigate('SignUp', { language: selectedLang });
    }
  };

  const enterApp = () => navigation.navigate('SignUp', { language: selectedLang });

  // Fire-and-forget so the UI doesn't await AsyncStorage on tap.
  const pickLang = (lang: 'en' | 'es') => {
    void setPreAuthLang(lang);
  };

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      {/* Progress dots */}
      <View
        style={styles.progressRow}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${currentSlide + 1} of ${SLIDES.length}`}
        accessibilityValue={{ min: 1, max: SLIDES.length, now: currentSlide + 1 }}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i <= currentSlide && styles.dotActive]}
          />
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {/* Slide 0 — Welcome */}
        <View style={styles.slide}>
          <Text style={styles.emoji}>🌿</Text>
          <Text style={styles.title}>
            {t('onboardingSlides.welcomeTitleLine1')}{' '}
            <Text style={styles.titleAccent}>{t('onboardingSlides.welcomeTitleAccent')}</Text>
          </Text>
          <Text style={styles.sub}>
            {t('onboardingSlides.welcomeSub')}
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={t('onboardingSlides.welcomeCtaA11y')}
          >
            <Text style={styles.btnText}>{t('onboardingSlides.welcomeCta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="link"
            accessibilityLabel={t('onboardingSlides.welcomeHaveAccountA11y')}
          >
            <Text style={styles.btnSecondaryText}>{t('onboardingSlides.welcomeHaveAccount')}</Text>
          </TouchableOpacity>
        </View>

        {/* Slide 1 — Language */}
        <View style={styles.slide}>
          <Text style={styles.emoji}>💬</Text>
          <Text style={styles.title}>
            {t('onboardingSlides.languageTitleLine1')}{' '}
            <Text style={styles.titleAccent}>{t('onboardingSlides.languageTitleAccent')}</Text>
          </Text>
          <Text style={styles.sub}>
            {t('onboardingSlides.languageSub')}
          </Text>
          <View style={styles.langRow} accessibilityRole="radiogroup">
            <TouchableOpacity
              style={[styles.langOption, selectedLang === 'en' && styles.langSelected]}
              onPress={() => pickLang('en')}
              accessibilityRole="radio"
              accessibilityLabel="English"
              accessibilityState={{ selected: selectedLang === 'en' }}
            >
              <Text style={styles.langFlag}>🇺🇸</Text>
              <Text style={styles.langLabel}>English</Text>
              <Text style={styles.langSub}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, selectedLang === 'es' && styles.langSelected]}
              onPress={() => pickLang('es')}
              accessibilityRole="radio"
              accessibilityLabel="Español"
              accessibilityState={{ selected: selectedLang === 'es' }}
            >
              <Text style={styles.langFlag}>🇨🇴</Text>
              <Text style={styles.langLabel}>Español</Text>
              <Text style={styles.langSub}>ES</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.btn}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={t('onboardingSlides.languageContinueA11y', { lang: selectedLang === 'en' ? 'English' : 'Español' })}
          >
            <Text style={styles.btnText}>{t('onboardingSlides.languageContinue')}</Text>
          </TouchableOpacity>
        </View>

        {/* Slide 2 — Location */}
        <View style={styles.slide}>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.title}>
            {t('onboardingSlides.locationTitleLine1')}{' '}
            <Text style={styles.titleAccent}>{t('onboardingSlides.locationTitleAccent')}</Text>
          </Text>
          <Text style={styles.sub}>
            {t('onboardingSlides.locationSub')}
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={enterApp}
            accessibilityRole="button"
            accessibilityLabel={t('onboardingSlides.locationCtaA11y')}
          >
            <Text style={styles.btnText}>{t('onboardingSlides.locationCta')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── v3 brand (villie · May 2026 lean editorial) ─────────────────────────
// WarmGlowBackdrop atmospheric layer (paper U-shape + bees). Display swapped
// from Playfair v2_display to v3_display (Plus Jakarta Sans Bold) per v3
// brand kit canon. Italic accent flipped from caramel → salmon to match
// HomeScreenV3 / ManualScrollV3 / VillageHomeScreenV3 / InboxHomeScreen.
// One italic per slide rule preserved.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 20,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(61,31,14,0.14)',
    flex: 1,
    maxWidth: 60,
  },
  dotActive: { backgroundColor: COLORS.v2_cinnamon },

  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  emoji: { fontSize: 72, marginBottom: 24 },
  // v3 display — Plus Jakarta Sans Bold 700 ("more presence, less italic")
  title: {
    fontFamily: FONTS.v3_display,
    fontSize: 34,
    color: COLORS.v2_cocoa,
    lineHeight: 40,
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 12,
  },
  // The one per-slide italic flourish — Plus Jakarta italic + salmon
  titleAccent: { fontFamily: FONTS.v3_display_italic, color: COLORS.v2_salmon },
  sub: {
    fontSize: 15,
    color: COLORS.v2_walnut,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 280,
    fontFamily: FONTS.v2_body,
  },

  // v9 canonical CTA — action-deep (WCAG AA-safe on paper text)
  btn: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#E84B79',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#E84B79',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 3,
  },
  btnText: { color: COLORS.v2_card, fontSize: 15, fontFamily: FONTS.v2_link, letterSpacing: 0.2 },
  // Secondary — text-link style, walnut on hairline border
  btnSecondary: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(61,31,14,0.12)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: { color: COLORS.v2_walnut, fontSize: 14, fontFamily: FONTS.v2_link },

  langRow: { flexDirection: 'row', gap: 12, marginBottom: 32, width: '100%', maxWidth: 280 },
  langOption: {
    flex: 1,
    backgroundColor: COLORS.v2_card,
    borderWidth: 1,
    borderColor: 'rgba(61,31,14,0.12)',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  // Selected — cinnamon border + parchment fill (the warm "you're here" tone)
  langSelected: { borderColor: COLORS.v2_cinnamon, borderWidth: 2, backgroundColor: COLORS.v2_parchment },
  langFlag: { fontSize: 32, marginBottom: 8 },
  langLabel: { fontSize: 14, fontFamily: FONTS.v2_link, color: COLORS.v2_cocoa },
  langSub: { fontSize: 11, color: COLORS.v2_amber, fontFamily: FONTS.v2_mono, letterSpacing: 1.5 },
});
