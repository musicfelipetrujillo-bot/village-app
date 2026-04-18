// Onboarding — 3 slides matching v2 prototype
// Slide 0: Welcome  Slide 1: Language  Slide 2: Location
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '@utils/constants';
import type { AuthStackParamList } from '@/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');
const SLIDES = ['welcome', 'language', 'location'] as const;

export default function OnboardingScreen({ navigation }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedLang, setSelectedLang] = useState<'en' | 'es'>('en');
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

  return (
    <View style={styles.container}>
      {/* Progress dots */}
      <View style={styles.progressRow}>
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
            Your village is{' '}
            <Text style={styles.titleAccent}>waiting</Text>
          </Text>
          <Text style={styles.sub}>
            Breast milk donors · Specialists · Events · Support — all in your Miami
            neighborhood. En español también.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={goNext}>
            <Text style={styles.btnText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnSecondaryText}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        {/* Slide 1 — Language */}
        <View style={styles.slide}>
          <Text style={styles.emoji}>💬</Text>
          <Text style={styles.title}>
            Choose your{' '}
            <Text style={styles.titleAccent}>language</Text>
          </Text>
          <Text style={styles.sub}>
            You can switch anytime.{'\n'}Puedes cambiar cuando quieras.
          </Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langOption, selectedLang === 'en' && styles.langSelected]}
              onPress={() => setSelectedLang('en')}
            >
              <Text style={styles.langFlag}>🇺🇸</Text>
              <Text style={styles.langLabel}>English</Text>
              <Text style={styles.langSub}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, selectedLang === 'es' && styles.langSelected]}
              onPress={() => setSelectedLang('es')}
            >
              <Text style={styles.langFlag}>🇨🇴</Text>
              <Text style={styles.langLabel}>Español</Text>
              <Text style={styles.langSub}>ES</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btn} onPress={goNext}>
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>

        {/* Slide 2 — Location */}
        <View style={styles.slide}>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.title}>
            We found your{' '}
            <Text style={styles.titleAccent}>neighborhood</Text>
          </Text>
          <Text style={styles.sub}>
            Everything in The Village is matched to where you are.
            Breast milk donors, specialists, and events near you.
          </Text>
          <View style={styles.locationCard}>
            <Text style={styles.locationCity}>Miami, FL</Text>
            <Text style={styles.locationState}>Miami-Dade County · Location verified ✓</Text>
            <Text style={styles.locationNearby}>3 donors · 12 specialists · 2 events nearby</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={enterApp}>
            <Text style={styles.btnText}>Enter The Village →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={enterApp}>
            <Text style={styles.btnSecondaryText}>Set radius preference later</Text>
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
    fontFamily: 'serif',
    fontSize: 34,
    color: COLORS.textDark,
    lineHeight: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  titleAccent: { color: COLORS.rust, fontStyle: 'italic' },
  sub: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 280,
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
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryText: { color: COLORS.textLight, fontSize: 14 },

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
  langLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  langSub: { fontSize: 12, color: COLORS.textLight },

  locationCard: {
    backgroundColor: '#e8f0d8',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 280,
    marginBottom: 28,
  },
  locationCity: {
    fontFamily: 'serif',
    fontSize: 24,
    color: COLORS.textDark,
    fontWeight: '700',
    marginBottom: 4,
  },
  locationState: { fontSize: 14, color: COLORS.textMid, marginBottom: 12 },
  locationNearby: { fontSize: 12, color: COLORS.olive, fontWeight: '600' },
});
