// Manual — chapter "full read" page.
//
// Reached from every card CTA on ManualCategoryScreen ("Explore the manual →",
// "More hacks →", "Take to your visit →"). The category screen is the preview
// surface (4 quick cards); this is the expanded read behind them, so the CTAs
// move the user FORWARD into depth instead of bouncing back to ManualHome (the
// page they came from). It carries the same editorial card vocabulary as the
// category screen — book spread, clinical chart, sage hack card, masthead bee —
// so the two surfaces read as one designed family.
//
// Chapter content in the Manual is English-only by design (the bullet / hack /
// question maps in ManualCategoryScreen are not translated), so the feature
// copy below follows the same pattern. It is supportive framing plus
// when-to-call guidance, never a diagnosis (see the signed footer).
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Share,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useHomeStore } from '@store/home';
import {
  CHAPTER_THEME, CHAPTER_THEME_DEFAULT, HERO_TITLE, SUB_LEAD,
  MANUAL_BULLETS, SPECIALIST_QS, MOM_HACKS,
} from '@screens/manual/ManualCategoryScreen';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// Local palette mirror (kept in sync with ManualCategoryScreen's V9 block).
const C = {
  paper: '#FFFCF6',
  bgBook: '#FBF3E0',
  bgChart: '#EDE9DC',
  bgSage: '#F2E6DD',
  bark: '#43260F',
  barkSoft: '#7A4A24',
  coco: '#AD795B',
  sageDeep: '#E98A6A',
};
const cardShadow = {
  shadowColor: C.coco, shadowOpacity: 0.26,
  shadowOffset: { width: 0, height: 8 }, shadowRadius: 22, elevation: 4,
} as const;

// ── Feature heading per chapter: "{h} {italic em}" ──────────────────────────
const FEATURE: Record<string, { h: string; em: string }> = {
  'baby/feed':   { h: 'Feeding, by the', em: 'numbers.' },
  'baby/sleep':  { h: 'The first weeks,', em: 'honestly.' },
  'baby/grow':   { h: 'Growth comes in', em: 'jumps.' },
  'baby/care':   { h: 'Ordinary, until', em: "it's not." },
  'baby/soothe': { h: 'The witching', em: 'hour.' },
  'baby/tips':   { h: 'Small mechanics,', em: 'big nights.' },
  'mom/feel':    { h: 'The hormone', em: 'hangover.' },
  'mom/heal':    { h: 'Healing has an', em: 'arc.' },
  'mom/nourish': { h: 'Eat through the', em: 'season.' },
  'mom/rest':    { h: 'Rest, worded', em: 'properly.' },
  'mom/tips':    { h: 'Set it up to', em: 'win.' },
};

// ── The expanded read, one paragraph per chapter (EN-only, matching the rest
//    of the Manual's chapter content). Supportive + "when to call", never
//    prescriptive. No em dashes (house style). ──────────────────────────────
const DEEPER: Record<string, string> = {
  'baby/feed':
    "In the early weeks, feeding is frequent by design. Eight to twelve feeds in twenty-four hours is normal, and evening cluster feeding is your baby topping off, not a sign your supply is low. The most reliable proof things are working is the diaper count, at least six wet a day after day five, plus the steady weight gain your pediatrician tracks. A latch should feel like tugging, not pinching. If feeds are consistently painful, that is worth a lactation visit, not something to push through.",
  'baby/sleep':
    "Newborn sleep runs on hunger, not the clock. For the first weeks a baby wakes every two to three hours around the clock, and that is exactly what their growing stomach needs. The long stretches arrive on their own as they get bigger, usually somewhere around three to four months. What you can control is the setup: every sleep on the back, on a firm flat surface, with nothing else in the crib. Day-night confusion is real and temporary, and bright mornings with calm, dim evenings help their clock find its rhythm.",
  'baby/grow':
    "Growth comes in jumps, not a straight line. Around week five many babies hit a fussy peak that settles within a week or two, and new skills often arrive paired with a temporary sleep regression. Both at once is normal. Track progress by weight and skills over weeks rather than by the day, and remember tummy time, even on your chest, builds the muscles behind rolling and crawling. Your pediatrician, not a chart online, is the one who decides whether a baby is actually behind.",
  'baby/care':
    "Most newborn fussiness has an ordinary cause. Gas tends to ease with burping and bicycle legs, and reflux spit-up is common and usually harmless when your baby is gaining weight and comfortable. The lines that matter are the ones that mean call now: any fever in a baby under three months, projectile vomiting with weight loss, or trouble breathing. Colic, by definition, is crying three or more hours a day, three or more days a week, for three or more weeks, and it does pass. When in doubt, calling is always the right move.",
  'baby/soothe':
    "Most evening crying is your baby's nervous system letting off the day, not anything you did wrong. It tends to peak around weeks four to six and settle by three to four months. The fastest calm-down usually stacks the 5 S's in order: a snug swaddle, holding them on their side or stomach against you, loud white noise, gentle motion, and something to suck. What rarely works is switching tactics every thirty seconds, so give each step a minute. Colic, by definition, is crying three or more hours a day, three or more days a week, for three or more weeks, and it is a phase, not a verdict. When crying comes with a fever, poor feeding, or just feels wrong to you, that is worth a call.",
  'baby/tips':
    "The small mechanics make the hard hours easier. White noise that runs the whole nap, not just the first five minutes, holds sleep through transitions. A swaddle works until your baby starts to fight it, then it is time for a sleep sack. Side-snap onesies save you at 3 a.m., and a diaper before the feed rather than after cuts down on spit-up. None of these are rules, just the things that tend to work.",
  'mom/feel':
    "The days-three-to-five hormone drop is steep, and tears without a clear reason are part of it. Baby blues should lift by about two weeks. If low mood, anxiety, or numbness lingers past that, or ever turns to thoughts of harming yourself or the baby, that is not weakness and not something to wait out. It is common and treatable, and your OB or a perinatal therapist can help quickly. Naming what you feel, even quietly to one person, genuinely loosens its grip.",
  'mom/heal':
    "Recovery has a predictable arc. Bleeding (lochia) thins from red to pink to brown over four to six weeks. Stitches dissolve on their own, so rinse with a warm peri bottle rather than wiping, and a C-section incision should stay dry and gradually fade. The signs to call about are spreading redness, a foul smell, soaking a pad in an hour, or a fever. The standing and lifting limits in the first weeks are not fragility, they protect the healing underneath.",
  'mom/nourish':
    "Eating in the newborn fog takes a system, because you will forget. Aim for something every few hours, lean on protein at breakfast to blunt the afternoon crash, and keep water within reach of every spot you feed in. Pale straw is the hydration target, not water-clear. If you are breastfeeding and never hungry, that itself is worth mentioning to your provider. Pre-portioned snacks and freezer smoothie packs carry you through the ugliest mornings.",
  'mom/rest':
    "“Sleep when the baby sleeps” is real advice worded badly. It means lie down, not finish chores. A single twenty-minute nap resets your stress hormones better than the same time spent scrolling, and trading even one night feed with a partner protects a longer stretch for you. Severe, ongoing sleep loss is not just exhausting, it can feed anxiety and depression, so if rest never seems to come, that is a reason to ask for help, not to tough it out.",
  'mom/tips':
    "Set the environment up so recovery does not depend on memory or willpower. Two alarms, one to eat and one to drink, beat good intentions. A snack stash on every floor, a hands-free pump, and groceries ordered the day you run low keep the basics from slipping. Velcro robes and anything you can manage one-handed are worth more than they look in the first weeks.",
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export default function ManualChapterReadScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const audience: 'mom' | 'baby' = route.params?.audience ?? 'baby';
  const category: string = route.params?.category ?? 'sleep';
  const key = `${audience}/${category}`;
  const week = useHomeStore((s) => s.babyProfile?.current_week_number) ?? 1;

  const hero = HERO_TITLE[key] ?? { prefix: 'Read about', em: 'this.' };
  const feature = FEATURE[key] ?? { h: 'The fuller', em: 'picture.' };
  const subLead = SUB_LEAD[key] ?? '';
  const deeper = DEEPER[key] ?? '';
  const bullets = MANUAL_BULLETS[key] ?? [];
  const questions = SPECIALIST_QS[key] ?? [];
  const hacks = MOM_HACKS[key] ?? [];
  const theme = CHAPTER_THEME[key] ?? CHAPTER_THEME_DEFAULT;

  // Editorial lead-in: first few words of the read set in a heavier weight.
  const words = deeper.split(' ');
  const leadIn = words.slice(0, 4).join(' ') + ' ';
  const restBody = words.slice(4).join(' ');

  const shareQuestions = () => {
    if (!questions.length) return;
    const msg =
      `Questions for my visit (${hero.prefix} ${hero.em.replace(/\.$/, '')}):\n` +
      questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    Share.share({ message: msg }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header — back + audience tag */}
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back to the chapter" />
          <View style={styles.audiencePill}>
            <Text style={styles.audienceText}>{audience === 'mom' ? 'Mom' : 'Baby'}</Text>
          </View>
        </View>

        {/* Masthead */}
        <View style={styles.masthead}>
          <Image source={VILLIE_BEE} style={styles.mastheadBee} resizeMode="contain" />
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: theme.accentDeep }]} />
            <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>The full read</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {hero.prefix} <Text style={[styles.titleEm, { color: theme.accentDeep }]}>{hero.em}</Text>
            </Text>
            <View style={[styles.heartDot, { backgroundColor: theme.accent }]} />
          </View>
          {!!subLead && <Text style={styles.lead}>{subLead}</Text>}
        </View>

        {/* ── Feature read — book spread ── */}
        {!!deeper && (
          <View style={styles.bookCard}>
            <View style={[styles.bookSpine, { backgroundColor: theme.accentDeep }]} pointerEvents="none" />
            <View style={styles.bookSpineHighlight} pointerEvents="none" />
            <View style={[styles.bookYolkRing, { borderColor: theme.accent }]} pointerEvents="none" />
            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowBar, { backgroundColor: theme.accentDeep }]} />
              <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>The read</Text>
            </View>
            <Text style={styles.bookTitle}>
              {feature.h} <Text style={[styles.titleEm, { color: theme.accentDeep, fontSize: 31 }]}>{feature.em}</Text>
            </Text>
            <Text style={styles.bookBody}>
              <Text style={styles.bookLeadIn}>{leadIn}</Text>{restBody}
            </Text>
            <Text style={[styles.folio, { color: theme.accentDeep }]}>p. {week}</Text>
          </View>
        )}

        {/* ── The essentials ── */}
        {bullets.length > 0 && (
          <View style={styles.essCard}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowBar, { backgroundColor: theme.accentDeep }]} />
              <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>The essentials</Text>
            </View>
            <Text style={styles.cardTitle}>
              Three things to <Text style={[styles.titleEm, { color: theme.accentDeep, fontSize: 31 }]}>know.</Text>
            </Text>
            {bullets.map((b, i) => (
              <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Text style={[styles.rowNum, { color: theme.accentDeep }]}>{ROMAN[i] ?? String(i + 1)}.</Text>
                <Text style={styles.rowText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── For your visit — clinical chart ── */}
        {questions.length > 0 && (
          <View style={styles.chartWrap}>
            <View style={styles.chartTab}>
              <Text style={styles.chartTabText}>For your visit</Text>
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>
                Bring these <Text style={[styles.titleEm, { color: C.sageDeep, fontSize: 31 }]}>three.</Text>
              </Text>
              {questions.map((q, i) => (
                <View key={i} style={[styles.qRow, i < questions.length - 1 && styles.qRowDivider]}>
                  <View style={styles.qTag}><Text style={styles.qTagText}>Q{i + 1}</Text></View>
                  <Text style={styles.rowText}>{q}</Text>
                </View>
              ))}
              <View style={styles.chartFooter}>
                <Text style={styles.chartStamp}>— signed, your week-{week} self</Text>
                <TouchableOpacity
                  onPress={shareQuestions}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Share these questions with your provider"
                >
                  <Text style={[styles.cardCta, { color: C.sageDeep }]}>Share these →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Try this — sage hack card with bee ── */}
        {hacks.length > 0 && (
          <View style={styles.sageCard}>
            <Image source={VILLIE_BEE} style={styles.sageBee} resizeMode="contain" />
            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowBar, { backgroundColor: theme.accentDeep }]} />
              <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>Try this</Text>
            </View>
            <Text style={styles.cardTitle}>
              Try one <Text style={[styles.titleEm, { color: theme.accentDeep, fontSize: 31 }]}>tonight.</Text>
            </Text>
            {hacks.map((h, i) => (
              <View key={i} style={[styles.hackRow, i > 0 && styles.rowDivider]}>
                <View style={[styles.hackDot, { backgroundColor: theme.accentDeep }]} />
                <Text style={styles.rowText}>{h}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.disclaimer}>
          This is guidance, not a diagnosis. When something feels off, call your provider.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  // maxWidth caps the reading column so body lines stay legible (and the
  // title-to-body hierarchy reads correctly) on wide screens; on a phone the
  // content is already narrower than 680 so this is a no-op there.
  scroll: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 56, maxWidth: 680, width: '100%', alignSelf: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 14, color: C.coco, fontFamily: FONTS.bodySemiBold },
  audiencePill: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(253,250,245,0.80)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(173,121,91,0.32)',
    shadowColor: C.coco, shadowOpacity: 0.18, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6, elevation: 2,
  },
  audienceText: {
    fontSize: 10.5, color: C.coco, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.6, textTransform: 'uppercase',
  },

  // Masthead
  masthead: { position: 'relative', marginTop: 22, marginBottom: 22, paddingRight: 74 },
  mastheadBee: {
    position: 'absolute', top: 2, right: -6, width: 70, height: 70,
    opacity: 0.55, transform: [{ rotate: '14deg' }],
  },
  // Editorial kicker chip — a small tinted pill with an accent dot + label,
  // so each section reads as an intentional header rather than plain text.
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingLeft: 8, paddingRight: 11, paddingVertical: 5,
    borderRadius: 8, backgroundColor: 'rgba(67,38,15,0.055)',
    marginBottom: 4, zIndex: 2,
  },
  eyebrowBar: { width: 6, height: 6, borderRadius: 3, marginRight: 7 },
  eyebrowText: {
    fontSize: 10.5, fontFamily: FONTS.bodyBold,
    letterSpacing: 1.7, textTransform: 'uppercase',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 8 },
  title: {
    fontFamily: FONTS.headerBold, fontSize: 38, lineHeight: 40,
    letterSpacing: -1.1, color: C.bark,
  },
  titleEm: { fontFamily: FONTS.headerItalic, fontStyle: 'italic' },
  heartDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 5, marginBottom: 8 },
  lead: { fontSize: 13.5, lineHeight: 20, color: C.barkSoft, fontFamily: FONTS.body, marginTop: 8, maxWidth: '92%' },

  // Feature book card
  bookCard: {
    backgroundColor: C.bgBook, borderRadius: 18,
    paddingTop: 16, paddingLeft: 24, paddingRight: 18, paddingBottom: 30,
    marginBottom: 16, position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)', ...cardShadow,
  },
  bookSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, zIndex: 2 },
  bookSpineHighlight: { position: 'absolute', left: 4, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(173,121,91,0.22)', zIndex: 1 },
  bookYolkRing: { position: 'absolute', top: -24, right: -24, width: 78, height: 78, borderRadius: 39, borderWidth: 1.6, opacity: 0.38, zIndex: 0 },
  bookTitle: { fontFamily: FONTS.headerBold, fontSize: 28, lineHeight: 33, letterSpacing: -0.6, color: C.bark, marginTop: 10, marginBottom: 13, zIndex: 2 },
  bookBody: { fontSize: 15.5, lineHeight: 25, color: C.bark, fontFamily: FONTS.body, zIndex: 2 },
  bookLeadIn: { fontFamily: FONTS.bodySemiBold, color: C.bark },
  folio: { position: 'absolute', bottom: 9, right: 16, fontFamily: FONTS.headerItalic, fontStyle: 'italic', fontSize: 12, opacity: 0.7, zIndex: 2 },

  // Essentials card
  essCard: {
    backgroundColor: C.paper, borderRadius: 18, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.16)', ...cardShadow, shadowOpacity: 0.16,
  },
  cardTitle: { fontFamily: FONTS.headerBold, fontSize: 28, lineHeight: 33, letterSpacing: -0.6, color: C.bark, marginTop: 10, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(173,121,91,0.16)' },
  rowNum: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', fontSize: 16, width: 26, marginTop: 1 },
  rowText: { flex: 1, fontSize: 14.5, lineHeight: 21, color: C.barkSoft, fontFamily: FONTS.body },

  // Clinical chart card
  chartWrap: { position: 'relative', marginTop: 6, marginBottom: 16 },
  chartTab: {
    position: 'absolute', top: -14, left: 16, paddingHorizontal: 12, paddingTop: 3, paddingBottom: 4,
    borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(233,138,106,0.32)', backgroundColor: C.bgChart, zIndex: 3,
  },
  chartTabText: { fontSize: 9, fontFamily: FONTS.bodyBold, color: C.sageDeep, letterSpacing: 1.8, textTransform: 'uppercase' },
  chartCard: {
    backgroundColor: C.bgChart, borderRadius: 16, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 14,
    borderWidth: 1, borderColor: 'rgba(233,138,106,0.30)', ...cardShadow, shadowColor: C.sageDeep, shadowOpacity: 0.18,
  },
  qRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8, paddingBottom: 7 },
  qRowDivider: { borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: 'rgba(233,138,106,0.30)' },
  qTag: { backgroundColor: C.sageDeep, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginRight: 10, marginTop: 1 },
  qTagText: { fontSize: 9, fontFamily: FONTS.bodyBold, color: C.paper, letterSpacing: 0.8 },
  chartFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  chartStamp: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', fontSize: 13, color: C.sageDeep, opacity: 0.8 },
  cardCta: { fontSize: 12.5, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.4 },

  // Sage hack card
  sageCard: {
    backgroundColor: C.bgSage, borderRadius: 18, paddingTop: 16, paddingBottom: 16, paddingLeft: 18, paddingRight: 76,
    marginBottom: 16, position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(233,138,106,0.20)', ...cardShadow, shadowColor: C.sageDeep, shadowOpacity: 0.16,
  },
  sageBee: { position: 'absolute', bottom: 12, right: 14, width: 56, height: 56, opacity: 0.5, transform: [{ rotate: '-8deg' }] },
  hackRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 },
  hackDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, marginRight: 14, marginLeft: 4 },

  disclaimer: { fontSize: 12.5, lineHeight: 19, color: C.coco, fontFamily: FONTS.body, marginTop: 4, textAlign: 'center', opacity: 0.85 },
});
