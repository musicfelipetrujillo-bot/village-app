// Village tab — formerly Discover. Editorial entry point that fans out into
// the four+ verticals (Specialists, Milk, Events, Perks, Gear). Each tap
// jumps to the matching tab via the bottom-tab navigator parent — the
// vertical tabs are registered but hidden, so existing per-vertical stacks
// keep working untouched.
import React, { useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ImageSourcePropType, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import {
  YolkCircle,
} from '@components/shared/DecorativeMarks';

const _BEE_N = 60;
const _BEE_INPUT = Array.from({ length: _BEE_N + 1 }, (_, i) => i / _BEE_N);
// Village/Inbox use a deeper bob than Manual/Me: 3.5 cycles + 36px amplitude
// so the bee's flight reads as a more obvious zig-zag, not a glide.
const _BEE_SINE_Y = _BEE_INPUT.map(
  t => (1 - t) * (60 - Math.sin(t * Math.PI * 3.5) * 36)
);
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// AsyncStorage key — gates the FIRST focus per app session so the bee
// doesn't auto-replay on every cold launch the same day. Once stored,
// in-session tab refocus still replays the bee.
const BEE_LAST_PLAYED_KEY = 'village.beeLastPlayedDate.v1';

interface VerticalCard {
  key: string;
  number: string;
  title: string;
  description: string;
  cta: string;
  accent: string;     // background tint behind the photo (fallback if image fails to load)
  photo: ImageSourcePropType;
  target: () => void;
}

export default function VillageHomeScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const tabParent = navigation.getParent();

  const beeAnim    = useRef(new Animated.Value(0)).current;
  const beeRandX   = useRef(new Animated.Value(0)).current;
  const beeRandY   = useRef(new Animated.Value(0)).current;
  // First-focus-of-session ref. On the very first focus this session, we
  // gate the play behind a daily AsyncStorage check (so cold-launching the
  // app a second time the same day doesn't re-trigger the entrance). On
  // every subsequent focus (i.e. leaving the tab and coming back), the
  // animation always replays.
  const firstFocusRef = useRef(true);
  const beeBaseX   = useRef(beeAnim.interpolate({ inputRange: [0, 1], outputRange: [-300, 0] })).current;
  const beeBaseY   = useRef(beeAnim.interpolate({ inputRange: _BEE_INPUT, outputRange: _BEE_SINE_Y })).current;
  const beeFade    = useRef(beeAnim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, 1] })).current;
  const beeTranslateX = useRef(Animated.add(beeBaseX, Animated.multiply(beeRandX, beeFade))).current;
  const beeTranslateY = useRef(Animated.add(beeBaseY, Animated.multiply(beeRandY, beeFade))).current;
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const isFirst = firstFocusRef.current;
      firstFocusRef.current = false;
      if (isFirst) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const last = await AsyncStorage.getItem(BEE_LAST_PLAYED_KEY);
          if (last === today) return; // already played today on a prior launch
          await AsyncStorage.setItem(BEE_LAST_PLAYED_KEY, today);
        } catch {
          // storage error → fall through and play
        }
      }
      if (cancelled) return;
      beeRandX.setValue((Math.random() - 0.5) * 24);
      beeRandY.setValue((Math.random() - 0.5) * 16);
      beeAnim.setValue(0);
      Animated.timing(beeAnim, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }).start();
    })();
    return () => { cancelled = true; };
  }, [beeAnim, beeRandX, beeRandY]));

  const cards: VerticalCard[] = [
    {
      key: 'experts',
      number: '01',
      title: t('village.expertsTitle'),
      description: t('village.expertsDesc'),
      cta: t('village.expertsCta'),
      accent: COLORS.pink,
      photo: require('../../../assets/photos/specialist.jpg'),
      target: () => tabParent?.navigate('Experts'),
    },
    {
      key: 'milk',
      number: '02',
      title: t('village.milkTitle'),
      description: t('village.milkDesc'),
      cta: t('village.milkCta'),
      accent: COLORS.sandSoft,
      photo: require('../../../assets/photos/milk.jpg'),
      target: () => tabParent?.navigate('Milk'),
    },
    {
      key: 'gear',
      number: '03',
      title: t('village.gearTitle'),
      description: t('village.gearDesc'),
      cta: t('village.gearCta'),
      accent: COLORS.pink,
      photo: require('../../../assets/photos/gear.jpg'),
      target: () => tabParent?.navigate('Gear'),
    },
    {
      key: 'events',
      number: '04',
      title: t('village.eventsTitle'),
      description: t('village.eventsDesc'),
      cta: t('village.eventsCta'),
      accent: COLORS.sage,
      photo: require('../../../assets/photos/events.jpg'),
      target: () => navigation.navigate('EventsList' as never),
    },
    {
      key: 'perks',
      number: '05',
      title: t('village.perksTitle'),
      description: t('village.perksDesc'),
      cta: t('village.perksCta'),
      accent: COLORS.cocoSoft,
      photo: require('../../../assets/photos/perks.jpg'),
      target: () => navigation.navigate('PerksList' as never),
    },
  ];

  return (
    <View style={styles.container}>
      {/* v9 paper wash — paper-white middle, warm pink at top + bottom.
          Unifies with Home / Manual / Me / Auth / Inbox. */}
      <LinearGradient
        colors={[
          '#FDF1EB', '#FDF8F4', '#FCFCFB',
          '#FCFCFB', '#FCF6EF', '#F9E9DD', '#F5DFD3',
        ]}
        locations={[0, 0.12, 0.30, 0.62, 0.76, 0.90, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Editorial header — soft full-bleed pastel cover card. Keeps
            HomeScreen's typography vibe (bark text + coco accents + hairline
            rule) but layers a pale olive-cream gradient underneath so the
            masthead still reads as Village's identity, just dialled back. */}
        <View style={styles.header}>
          {/* v9 paper-leaning masthead — softer cream→blush than the
              old olive/sand wash. Village's sage identity stays on the
              eyebrowBar (single mark, per product intent). */}
          <LinearGradient
            colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* iOS-26 wet-glass top sheen — matches every other v9 masthead */}
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18 }}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
          {/* Villie bee brand mark */}
          <Animated.Image source={VILLIE_BEE} resizeMode="contain"
            accessible={false}
            style={[styles.headerBee, { transform: [{ translateX: beeTranslateX }, { translateY: beeTranslateY }, { rotate: '12deg' }] }]} />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBar} />
            <Text style={styles.eyebrow}>{t('village.eyebrow')}</Text>
          </View>
          <Text style={styles.title}>{t('village.title')}</Text>
          <Text style={styles.subtitle}>{t('village.subtitle')}</Text>
          <View style={styles.headerRule} />
        </View>

        <View style={styles.cardStack}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.key}
              style={styles.card}
              onPress={card.target}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel={`${card.title} — ${card.description}`}
            >
              {/* Body on the LEFT: italic number + title + desc + CTA. Mirrors
                  the moodboard's Discover layout exactly. */}
              <View style={styles.cardBody}>
                <Text style={styles.cardNumInline}>{card.number}</Text>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{card.description}</Text>
                <Text style={styles.cardCta}>{card.cta} →</Text>
              </View>
              {/* Photo on the RIGHT — Unsplash stock photography behind a
                  tinted accent band. The accent shows briefly before the
                  remote-looking require() resolves; on slow filesystems it
                  reads as the editorial color block from the moodboard. */}
              <View style={[styles.cardPhoto, { backgroundColor: card.accent }]}>
                <Image
                  source={card.photo}
                  style={styles.cardPhotoImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { paddingTop: 0, paddingBottom: 96, paddingHorizontal: 20 },

  // Editorial masthead mirroring HomeScreen's greetingBlock:
  //  - sits on the page gradient (no inner LinearGradient panel)
  //  - paddingHorizontal: 12 (matches greetingBlock)
  //  - bark text on the warm tan/blush page, hairline rule under
  //  - single olive accent on the eyebrow bar to mark "Village"
  // Soft full-bleed cover card — matches InboxHomeScreen.header dimensions
  // exactly so every tab masthead reads the same size. marginHorizontal:-20
  // pulls the card past the ScrollView's 20px content inset so it can
  // bleed to the screen edges like Inbox/Me do natively. paddingBottom is
  // tight so the hairline rule sits right at the card's bottom edge.
  header: {
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 6,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#E98A6A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
    position: 'relative',
  },
  headerBee: {
    // Full-bleed header, so `right` is relative to the screen edge directly.
    position: 'absolute',
    right: 8, top: 64,
    width: 88, height: 80,
    opacity: 0.55,
    transform: [{ rotate: '12deg' }],
  },
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  // Olive accent bar — preserves Village's green identity as a single mark.
  eyebrowBar: {
    width: 22, height: 2,
    backgroundColor: COLORS.sage,
    marginRight: 10,
  },
  eyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold,
    color: '#7A4A24',
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  title: {
    fontSize: 32, fontFamily: FONTS.headerBold, color: COLORS.bark,
    lineHeight: 38, letterSpacing: -0.5, marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, fontFamily: FONTS.body,
    color: COLORS.barkSoft,
    fontStyle: 'italic', lineHeight: 22,
  },
  // Hairline rule under the masthead — matches HomeScreen.greetingRule.
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 14,
    width: 48,
  },

  cardStack: { gap: 14 },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(253, 248, 242, 0.92)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(150, 80, 50, 0.12)',
    shadowColor: '#43260F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
    height: 138,
  },
  cardBody: {
    flex: 1, minWidth: 0,
    paddingHorizontal: 18, paddingVertical: 18,
    justifyContent: 'center',
  },
  cardNumInline: {
    fontSize: 28, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#D96C88', marginBottom: 4, lineHeight: 30, opacity: 0.75,
  },
  cardTitle: {
    fontSize: 20, fontFamily: FONTS.headerBold,
    color: COLORS.bark, marginBottom: 4,
    lineHeight: 24,
  },
  cardDesc: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 18, marginBottom: 8,
  },
  cardCta: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold,
    color: '#D96C88', letterSpacing: 0.4,
  },
  // Photo on the RIGHT — square-ish band w/ accent tint behind the image
  // (acts as both fallback and a soft editorial border tone). flexShrink:0
  // pins the column at exactly 128px even if a long title wraps the body.
  cardPhoto: {
    width: 128,
    flexShrink: 0, flexGrow: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
    position: 'relative',
  },
  // Absolutely positioned so the image cannot push the row taller via its
  // intrinsic dimensions. Combined with `cardPhoto`'s `overflow: hidden` and
  // `cardPhotoImage`'s `resizeMode: cover`, the photo fills the column without
  // contributing to layout flow. This is the standard RN pattern for "image
  // fills container" when the container's height is itself flex-derived.
  cardPhotoImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: undefined,
    height: undefined,
  },
});
