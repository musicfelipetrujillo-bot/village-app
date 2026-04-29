// Village tab — formerly Discover. Editorial entry point that fans out into
// the four+ verticals (Specialists, Milk, Events, Perks, Gear). Each tap
// jumps to the matching tab via the bottom-tab navigator parent — the
// vertical tabs are registered but hidden, so existing per-vertical stacks
// keep working untouched.
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ImageSourcePropType,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import {
  YolkCircle, LeafSprig, ScribbleMark,
} from '@components/shared/DecorativeMarks';

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

  const cards: VerticalCard[] = [
    {
      key: 'experts',
      number: '01',
      title: t('village.expertsTitle'),
      description: t('village.expertsDesc'),
      cta: t('village.expertsCta'),
      accent: COLORS.blush,
      photo: require('../../../assets/photos/specialist.jpg'),
      target: () => tabParent?.navigate('Experts'),
    },
    {
      key: 'milk',
      number: '02',
      title: t('village.milkTitle'),
      description: t('village.milkDesc'),
      cta: t('village.milkCta'),
      accent: COLORS.yolkLight,
      photo: require('../../../assets/photos/milk.jpg'),
      target: () => tabParent?.navigate('Milk'),
    },
    {
      key: 'gear',
      number: '03',
      title: t('village.gearTitle'),
      description: t('village.gearDesc'),
      cta: t('village.gearCta'),
      accent: COLORS.blush,
      photo: require('../../../assets/photos/gear.jpg'),
      target: () => tabParent?.navigate('Gear'),
    },
    {
      key: 'events',
      number: '04',
      title: t('village.eventsTitle'),
      description: t('village.eventsDesc'),
      cta: t('village.eventsCta'),
      accent: COLORS.lime,
      photo: require('../../../assets/photos/events.jpg'),
      target: () => navigation.navigate('EventsList' as never),
    },
    {
      key: 'perks',
      number: '05',
      title: t('village.perksTitle'),
      description: t('village.perksDesc'),
      cta: t('village.perksCta'),
      accent: COLORS.dinerLight,
      photo: require('../../../assets/photos/perks.jpg'),
      target: () => navigation.navigate('PerksList' as never),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {/* Editorial decoration — soft yolk circle behind the eyebrow,
              leaf sprig top-right, scribble + sparkle layered around the
              title. Mirrors the moodboard's hand-drawn marker accents. */}
          <YolkCircle size={56} top={-10} left={-14} tint={COLORS.yolkLight} opacity={0.55} />
          <LeafSprig size={52} top={-6} right={6} tint={COLORS.olive} />
          <ScribbleMark size={30} top={70} right={22} tint={COLORS.brownDeep} />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBar} />
            <Text style={styles.eyebrow}>{t('village.eyebrow')}</Text>
          </View>
          <Text style={styles.title}>{t('village.title')}</Text>
          <Text style={styles.subtitle}>{t('village.subtitle')}</Text>
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
  container: { flex: 1, backgroundColor: COLORS.ceramic },
  content: { paddingTop: 64, paddingBottom: 96, paddingHorizontal: 20 },

  header: { marginBottom: 28 },
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  eyebrowBar: {
    width: 22, height: 2, backgroundColor: COLORS.diner, marginRight: 10,
  },
  eyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.diner,
    letterSpacing: 1.6, textTransform: 'uppercase',
  },
  title: {
    fontSize: 38, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    lineHeight: 44, marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMid,
    fontStyle: 'italic', lineHeight: 20,
  },

  cardStack: { gap: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.paper,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.ceramicDeep,
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    // Pinned height (was minHeight: 138). The previous min-only sizing let the
    // Image's intrinsic stock-photo dimensions (~1500px) leak into row height
    // because cardPhotoImage used `width:100%, height:100%` with no explicit
    // anchor — RN walks up the layout tree, finds no fixed height, and falls
    // back to the image's natural size, exploding the row to ~1500px tall.
    // Locking height removes the ambiguity entirely.
    height: 138,
  },
  // Body sits on the LEFT — Playfair italic number, then bold title, then desc,
  // then small uppercase CTA. Mirrors the moodboard's Discover layout exactly.
  // `minWidth: 0` is the standard flex-row fix that prevents a child with
  // content from forcing the row to overflow (which on RN-iOS can manifest
  // as the photo column eating the whole row width).
  cardBody: {
    flex: 1, minWidth: 0,
    paddingHorizontal: 18, paddingVertical: 18,
    justifyContent: 'center',
  },
  cardNumInline: {
    fontSize: 22, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.diner, marginBottom: 6, lineHeight: 24,
  },
  cardTitle: {
    fontSize: 20, fontFamily: FONTS.headerBold,
    color: COLORS.brownDeep, marginBottom: 5,
    lineHeight: 24,
  },
  cardDesc: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 19, marginBottom: 10,
  },
  cardCta: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold,
    color: COLORS.diner, letterSpacing: 1.2,
    textTransform: 'uppercase',
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
