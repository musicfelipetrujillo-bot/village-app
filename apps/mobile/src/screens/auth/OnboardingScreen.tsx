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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
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
    backgroundColor: 'rgba(0,0,0,0.12)',
    flex: 1,
    maxWidth: 60,
  },
  dotActive: { backgroundColor: COLORS.rust },

  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: {
    fontFamily: FONTS.header,
    fontSize: 34,
    color: COLORS.textDark,
    lineHeight: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  titleAccent: { fontFamily: FONTS.headerItalic, color: COLORS.rust },
  sub: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 280,
    fontFamily: FONTS.body,
  },

  btn: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: COLORS.rust,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { color: 'white', fontSize: 16, fontFamily: FONTS.bodySemiBold },
  btnSecondary: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryText: { color: COLORS.textLight, fontSize: 14, fontFamily: FONTS.body },

  langRow: { flexDirection: 'row', gap: 12, marginBottom: 32, width: '100%', maxWidth: 280 },
  langOption: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  langSelected: { borderColor: COLORS.rust, backgroundColor: '#FFF0EB' },
  langFlag: { fontSize: 32, marginBottom: 8 },
  langLabel: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.textDark },
  langSub: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.body },
});
