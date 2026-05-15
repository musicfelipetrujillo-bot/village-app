// ManualCategory — context-driven chapter pages (v9 design).
//
// Mom tab → mom × {feel, heal, nourish, rest, tips}
// Baby tab → baby × {feed, sleep, grow, care, tips}
//
// Each category renders as a magazine-style chapter with five
// identity-distinct cards (one screen, five "papers"):
//   (1) Week hero — pink-cream w/ decorative yolks, big Playfair italic
//       week number, cinnamon arrow CTA → routes to weekly guide
//   (2) The Manual — book-spread paper, bold coco book spine on the
//       left edge, Roman numeral chapters, italic "p. N" folio mark
//   (3) Ask Specialist — clinical-chart paper, sage "For your visit"
//       file-folder tab on top-left edge, Q1/Q2/Q3 form labels,
//       sage corner-fold mark top-right, signed-off footer stamp
//   (4) Quick Watches — coco-cream, video thumbnail strip, durations
//   (5) Mom Hacks — sage-cream, vertical bullet list, scattered sage
//       dots, villie bee mascot tucked in the corner
//
// Brand: italics deliberately appear on each card title (one per
// card, not one per screen) to drive the chapter-of-a-book editorial
// feel. Cinnamon usage is restricted to CTAs + italic accent words
// + the Week hero arrow circle.
//
// Videos are short (≤2 min, DB-enforced), Mux-hosted, EN+ES caption-aware.
// Tapping a thumbnail opens ManualVideoScreen for the full-screen player.
// Watched state is persisted server-side (manual_video_progress) and
// surfaced as a "Watched" overlay on the thumbnail.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import {
  listManualVideos,
  formatDuration,
  type ManualVideo,
  type ManualAudience,
} from '@/api/manual';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

type ParamList = {
  ManualCategory: { audience: ManualAudience; category: string; label: string };
};

// ── Chapter masthead — "[prefix] [italic accent]." ─────────────────────
// The italic word is the chapter verb/noun, rendered in cinnamon italic.
// This is the editorial "Time to heal." / "Real-world tips." pattern.
const HERO_TITLE: Record<string, { prefix: string; em: string }> = {
  'mom/feel':    { prefix: 'Time to',    em: 'feel.'    },
  'mom/heal':    { prefix: 'Time to',    em: 'heal.'    },
  'mom/nourish': { prefix: 'Time to',    em: 'nourish.' },
  'mom/rest':    { prefix: 'Time to',    em: 'rest.'    },
  'mom/tips':    { prefix: 'Real-world', em: 'tips.'    },
  'baby/feed':   { prefix: 'How they',   em: 'feed.'    },
  'baby/sleep':  { prefix: 'How they',   em: 'sleep.'   },
  'baby/grow':   { prefix: 'How they',   em: 'grow.'    },
  'baby/care':   { prefix: 'How to',     em: 'care.'    },
  'baby/tips':   { prefix: 'Tiny',       em: 'wins.'    },
};

// ── Sub-lead — short masthead body under the chapter title ─────────────
const SUB_LEAD: Record<string, string> = {
  'mom/feel':    'The hormone hangover, named without the spiral.',
  'mom/heal':    'Lochia, stitches, the slow rebuild — without the panic.',
  'mom/nourish': 'Eat to live through the season, not to optimize.',
  'mom/rest':    'Broken nights, real recovery, rhythms that survive.',
  'mom/tips':    'The small wins moms wish they knew week one.',
  'baby/feed':   'Cluster feeds, latch worries, supply doubts — calmly explained.',
  'baby/sleep':  'What is normal at this week. What is not.',
  'baby/grow':   'The leap, the regression, the breakthrough.',
  'baby/care':   'Gas vs colic. Reflux normal or call. Without panic.',
  'baby/tips':   'The tiny things that change everything.',
};

// ── Week-hero body line (renders INSIDE the Week N card) ────────────────
const WEEK_BODY: Record<string, string> = {
  'mom/feel':    'The hormone hangover, and learning to name what you feel.',
  'mom/heal':    'Your body does not reset overnight. Here is the real timeline.',
  'mom/nourish': 'Hungry is not a stage. It is a season.',
  'mom/rest':    'Broken sleep changes who you are. Here is what helps.',
  'mom/tips':    'The small wins moms wish they knew week one.',
  'baby/feed':   'Cluster feeds, latch worries, supply doubts. Calmly explained.',
  'baby/sleep':  'What is normal at this week, and what is not.',
  'baby/grow':   'The leap, the regression, the breakthrough.',
  'baby/care':   'Gas vs colic. Reflux normal or call. Without panic.',
  'baby/tips':   'The tiny things that change everything.',
};

// Inline manual bullets per (audience, category) — read at a glance, no tap.
// Each row is a single sentence the user can scan in under 5 seconds.
// Renders as Roman-numeral chapter rows inside the book-spread card.
const MANUAL_BULLETS: Record<string, string[]> = {
  'mom/feel': [
    'Hormones drop hard at days 3–5. Tears without a reason are normal.',
    'Baby blues lift by week 2. Anything past that, talk to your OB.',
    'Name what you feel, even quietly. It loosens its grip.',
  ],
  'mom/heal': [
    'Bleeding (lochia) thins from red to pink to brown over 4–6 weeks.',
    'Stitches dissolve on their own. Rinse, do not wipe.',
    'C-section incision: dry, no soaking baths, watch for spreading redness.',
  ],
  'mom/nourish': [
    'Eat every 3 hours, even when you forget. Set a phone alarm.',
    'Protein at breakfast keeps the afternoon crash away.',
    'Hydrate to the color of pale straw, not water-clear.',
  ],
  'mom/rest': [
    'Sleep when the baby sleeps is real advice, badly worded. Lie down.',
    'A 20-minute nap resets cortisol better than scrolling.',
    'Pass night feeds to a partner when you can. Even once.',
  ],
  'mom/tips':    ['Microwave a wet washcloth for 20s. Heat on sore breasts.', 'Keep a snack on every floor of the house.', 'Velcro robes beat tied ones with one hand.'],
  'baby/feed':   ['8–12 feeds in 24 hours is normal at this age.', 'Cluster feeding in evenings is a growth spurt, not low supply.', 'Wet diapers: at least 6 a day after day 5.'],
  'baby/sleep':  ['Day-night confusion peaks in week 2–3. It passes.', 'Newborns sleep 14–17 hrs in chunks. Not in a row.', 'Always on the back. Firm surface. Nothing in the crib.'],
  'baby/grow':   ['Big leap around week 5. Crying spikes, then settles.', 'Tracking weight, not days. Pediatrician decides "behind."', 'New skill = old sleep regression. Both at once is normal.'],
  'baby/care':   ['Gas: legs curl, eased by burping. Colic: 3+ hrs, 3+ days, 3+ wks.', 'Reflux spit-up is normal. Projectile + weight loss is not.', 'Fever under 3 months: call, do not wait.'],
  'baby/tips':   ['White noise = vacuum cleaner pitch, not ocean.', 'Swaddle until they fight it. Then sleep sack.', 'Pacifier dipped in breastmilk takes faster.'],
};

// Specialist questions per (audience, category) — 3 you can read out loud.
// Renders as Q1/Q2/Q3 form-label rows inside the clinical-chart card.
const SPECIALIST_QS: Record<string, string[]> = {
  'mom/feel':    ['Is what I am feeling baby blues or PPD?', 'When should I worry about my mood?', 'Can I be screened today?'],
  'mom/heal':    ['Is my bleeding amount normal for this week?', 'When can I expect stitches to fully heal?', 'What activity is safe right now?'],
  'mom/nourish': ['Should I take a postpartum multivitamin?', 'What if I am breastfeeding and not hungry?', 'Any foods to avoid right now?'],
  'mom/rest':    ['How much sleep is too little before it is dangerous?', 'Can sleep deprivation cause PPD?', 'Is melatonin safe while nursing?'],
  'mom/tips':    ['Any postpartum doulas you recommend?', 'When can I drive again?', 'When can I exercise?'],
  'baby/feed':   ['Is my baby getting enough?', 'How do I know my latch is right?', 'Should I be pumping yet?'],
  'baby/sleep':  ['When should sleep get longer?', 'Is a swaddle still safe?', 'When do I move to a crib?'],
  'baby/grow':   ['Is my baby on track for this week?', 'When is the next leap?', 'How do I know it is a regression?'],
  'baby/care':   ['When is gas actually colic?', 'When should I worry about reflux?', 'What temperature is a real fever?'],
  'baby/tips':   ['Any sleep coach you trust?', 'Best swaddle brand at this age?', 'Pacifier or no pacifier?'],
};

// Mom hacks — 3 short, real, try-tonight items. Vertical bullet list
// inside the Mom Hacks card.
const MOM_HACKS: Record<string, string[]> = {
  'mom/feel':    ['Step outside for 10 minutes of morning light.', 'Tell one person exactly how you feel today.', 'Stop reading mom Instagram for 48 hours.'],
  'mom/heal':    ['Frozen pads ("padsicles") for the first 3 days.', 'Peri bottle, warm water, before and after.', "Don't stand longer than 20 min in week 1."],
  'mom/nourish': ['Pre-portion snacks at the start of the week.', 'Keep a water bottle in every nursing spot.', 'Smoothie packs in the freezer for ugly mornings.'],
  'mom/rest':    ['Phone on do-not-disturb after 8 pm.', 'Blackout the nursery, even for naps.', 'Trade one shift with a partner this week.'],
  'mom/tips':    ['Set 2 alarms — one to eat, one to drink.', 'Hands-free pump while you scroll.', 'Order groceries the day you run out, not the next.'],
  'baby/feed':   ['Track feeds with a sticky note, not an app.', 'One side per feed in the first 4 weeks.', 'Burp at the switch, not just the end.'],
  'baby/sleep':  ['White noise the whole nap, not just for 5 min.', 'Wake-windows over schedules in month 1.', 'Same wind-down song every night.'],
  'baby/grow':   ['Tummy time on your chest counts.', 'Track wet diapers, not ounces.', 'Photograph the same outfit every week.'],
  'baby/care':   ['Bicycle legs for gas. Knees-to-chest for colic.', 'Coconut oil on the cradle cap, gentle comb.', 'Cool wet washcloth for teething drool rash.'],
  'baby/tips':   ['Diaper before feed, not after, to avoid spit-up.', 'Onesies that snap from the side at 3 am.', 'Two diaper stations, not one.'],
};

// Roman numerals for the book-spread chapter rows.
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// Card hero keys. Each card has its own routing target (currently stubs).
type HeroKey = 'week' | 'manual' | 'questions' | 'videos' | 'hacks';

// Per-card paper tint — five distinct "papers" so the screen reads as
// five different chapters of one book.
const BG_WEEK   = '#FAEDE3'; // pink-cream
const BG_BOOK   = '#FBF3E0'; // warm book paper
const BG_CHART  = '#EDE9DC'; // cooler clinical paper
const BG_COCO   = '#F4E2D1'; // coco-cream (videos)
const BG_SAGE   = '#EBEFD9'; // sage-cream (hacks)

export default function ManualCategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ManualCategory'>>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const { audience, category } = route.params;

  const [videos, setVideos] = useState<ManualVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload on every focus so a video the user just watched flips its
  // "Watched" badge without manual pull-to-refresh. Cheap RPC, small list.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const list = await listManualVideos(audience, category, lang);
          if (!cancelled) setVideos(list);
        } catch (e) {
          console.error('manual-category load', e);
          if (!cancelled) setVideos([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [audience, category, lang]),
  );

  const onCardPress = (video: ManualVideo) => {
    navigation.navigate('ManualVideo' as never, {
      audience, category, videoId: video.id,
    } as never);
  };

  // Current week — uses baby_profiles.current_week_number, fallback to 1
  // so the eyebrow always reads "Week N". Same hook used by ManualHome.
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const week = Math.max(1, babyProfile?.current_week_number ?? 1);

  const key = `${audience}/${category}`;
  const hero       = HERO_TITLE[key]     ?? { prefix: 'Read about', em: 'this.' };
  const subLead    = SUB_LEAD[key]       ?? '';
  const weekBody   = WEEK_BODY[key]      ?? '';
  const bullets    = MANUAL_BULLETS[key] ?? [];
  const questions  = SPECIALIST_QS[key]  ?? [];
  const hacks      = MOM_HACKS[key]      ?? [];

  // Hero-box CTA tap — currently logs; each will route to its own
  // surface in a follow-up pass.
  const onHeroPress = (k: HeroKey) => {
    console.log('hero-box pressed', { audience, category, k });
  };

  return (
    <View style={styles.container}>
      {/* Top nav — Back + small audience tag (MOM / BABY) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.audienceTag}>
          {audience === 'mom' ? t('manual.eyebrowMom') : t('manual.eyebrowBaby')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── Masthead — eyebrow + chapter title + sub-lead + bee mascot ─── */}
        <View style={styles.masthead}>
          <View style={styles.villieMasthead} pointerEvents="none">
            <Image source={VILLIE_BEE} style={styles.villieMastheadImg} resizeMode="contain" />
          </View>
          <View style={styles.fieldGuideRow}>
            <View style={styles.fieldGuideBar} />
            <Text style={styles.fieldGuideText}>A field guide</Text>
          </View>
          <Text style={styles.title}>
            {hero.prefix} <Text style={styles.italicAccent}>{hero.em}</Text>
            <Text style={styles.heartDotInline}> ·</Text>
          </Text>
          {!!subLead && <Text style={styles.lead}>{subLead}</Text>}
        </View>

        {/* ─── CARD 1 · Week hero ──────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.weekCard, { backgroundColor: BG_WEEK }]}
          activeOpacity={0.92}
          onPress={() => onHeroPress('week')}
          accessibilityRole="button"
          accessibilityLabel={`Week ${week}. ${weekBody}`}
        >
          <View style={styles.weekTopBar} />
          <View style={styles.weekYolkOuter} pointerEvents="none" />
          <View style={styles.weekYolkInner} pointerEvents="none" />
          <View style={styles.weekScribble} pointerEvents="none">
            <View style={[styles.scribbleLine, { width: 20, transform: [{ rotate: '-6deg' }] }]} />
            <View style={[styles.scribbleLine, { width: 14, transform: [{ rotate: '2deg' }] }]} />
            <View style={[styles.scribbleLine, { width: 16, transform: [{ rotate: '-3deg' }] }]} />
          </View>
          <Text style={styles.weekEyebrow}>You{'’'}re in</Text>
          <Text style={styles.weekNum}>Week {week}</Text>
          <Text style={styles.weekBody}>{weekBody}</Text>
          <View style={styles.weekCta}>
            <Text style={styles.weekCtaText}>See your weekly guide →</Text>
            <View style={styles.weekCtaArrow}>
              <Text style={styles.weekCtaArrowGlyph}>→</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ─── CARD 2 · The Manual (book spread) ───────────────────────── */}
        <TouchableOpacity
          style={[styles.bookCard, { backgroundColor: BG_BOOK }]}
          activeOpacity={0.94}
          onPress={() => onHeroPress('manual')}
          accessibilityRole="button"
          accessibilityLabel="The manual. What to actually know."
        >
          <View style={styles.bookSpine} pointerEvents="none" />
          <View style={styles.bookSpineHighlight} pointerEvents="none" />
          <View style={styles.bookYolkRing} pointerEvents="none" />

          <View style={styles.cocoEyebrowRow}>
            <View style={styles.cocoEyebrowBar} />
            <Text style={styles.cocoEyebrowText}>The manual</Text>
          </View>
          <Text style={styles.bookTitle}>
            What to actually <Text style={styles.italicAccent}>know.</Text>
          </Text>

          {bullets.map((b, i) => (
            <View key={i} style={[styles.chapterRow, i > 0 && styles.chapterRowDivider]}>
              <Text style={styles.chapterNum}>{ROMAN[i] ?? String(i + 1)}.</Text>
              <Text style={styles.chapterText}>{b}</Text>
            </View>
          ))}

          <Text style={styles.bookCta}>Explore the manual →</Text>
          <Text style={styles.folio}>p. {week}</Text>
        </TouchableOpacity>

        {/* ─── CARD 3 · Ask Specialist (clinical chart) ────────────────── */}
        <View style={styles.chartCardWrap}>
          <View style={[styles.chartTab, { backgroundColor: BG_CHART }]}>
            <Text style={styles.chartTabText}>For your visit</Text>
          </View>
          <TouchableOpacity
            style={[styles.chartCard, { backgroundColor: BG_CHART }]}
            activeOpacity={0.94}
            onPress={() => onHeroPress('questions')}
            accessibilityRole="button"
            accessibilityLabel="Ask your specialist. Bring these three."
          >
            <LinearGradient
              colors={[COLORS.sageDeep, 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.chartFold}
              pointerEvents="none"
            />

            <View style={styles.sageEyebrowRow}>
              <View style={styles.sageEyebrowBar} />
              <Text style={styles.sageEyebrowText}>Ask your specialist</Text>
            </View>
            <Text style={styles.chartTitle}>
              Bring these <Text style={styles.italicAccent}>three.</Text>
            </Text>

            {questions.map((q, i) => (
              <View key={i} style={[styles.qRow, i < questions.length - 1 && styles.qRowDivider]}>
                <View style={styles.qTag}>
                  <Text style={styles.qTagText}>Q{i + 1}</Text>
                </View>
                <Text style={styles.qText}>{q}</Text>
              </View>
            ))}

            <View style={styles.chartFooter}>
              <Text style={styles.chartStamp}>— signed, your week-{week} self</Text>
              <Text style={styles.cardCta}>Save & explore →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── CARD 4 · Quick Watches ──────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.softCard, { backgroundColor: BG_COCO }]}
          activeOpacity={0.94}
          onPress={() => onHeroPress('videos')}
          accessibilityRole="button"
          accessibilityLabel="Quick watches. Two minutes, exactly."
        >
          <View style={styles.scribbleAbs} pointerEvents="none">
            <View style={[styles.scribbleLine, { width: 20, transform: [{ rotate: '-6deg' }] }]} />
            <View style={[styles.scribbleLine, { width: 14, transform: [{ rotate: '2deg' }] }]} />
            <View style={[styles.scribbleLine, { width: 16, transform: [{ rotate: '-3deg' }] }]} />
          </View>

          <View style={styles.cocoEyebrowRow}>
            <View style={styles.cocoEyebrowBar} />
            <Text style={styles.cocoEyebrowText}>Quick watches</Text>
          </View>
          <Text style={styles.cardTitle}>
            Two minutes, <Text style={styles.italicAccent}>exactly.</Text>
          </Text>

          <View style={styles.vidStrip}>
            {loading || videos.length === 0
              ? [0, 1, 2].map((i) => (
                  <LinearGradient
                    key={`sk-${i}`}
                    colors={
                      i === 0 ? ['#F2D5C5', '#C99580']
                      : i === 1 ? ['#E5D2BA', '#AD795B']
                      : ['#D8DEB7', '#8B9A6B']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.vidThumb}
                  >
                    <Text style={styles.vidPlaceholderGlyph}>▷</Text>
                  </LinearGradient>
                ))
              : videos.slice(0, 3).map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.vidThumb}
                    activeOpacity={0.9}
                    onPress={() => onCardPress(v)}
                    accessibilityRole="button"
                    accessibilityLabel={t('manual.videoCardA11y', {
                      title: v.title,
                      duration: formatDuration(v.duration_seconds),
                    })}
                  >
                    <Image source={{ uri: v.thumbnail_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                    <View style={styles.vidDuration}>
                      <Text style={styles.vidDurationText}>{formatDuration(v.duration_seconds)}</Text>
                    </View>
                    {v.is_watched && (
                      <View style={styles.vidWatched}>
                        <Text style={styles.vidWatchedText}>{t('manual.watched')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
          </View>

          <Text style={styles.cardCta}>Watch the row →</Text>
        </TouchableOpacity>

        {/* ─── CARD 5 · Mom Hacks ──────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.softCard, styles.hacksCard, { backgroundColor: BG_SAGE }]}
          activeOpacity={0.94}
          onPress={() => onHeroPress('hacks')}
          accessibilityRole="button"
          accessibilityLabel="Mom hacks. Try one tonight."
        >
          {/* Sage dot scatter */}
          <View style={styles.sageDots} pointerEvents="none">
            <View style={[styles.sageDot, { top: 14, left: 8, width: 6, height: 6 }]} />
            <View style={[styles.sageDot, { top: 4,  left: 28, width: 4, height: 4 }]} />
            <View style={[styles.sageDot, { top: 26, left: 42, width: 7, height: 7 }]} />
            <View style={[styles.sageDot, { top: 38, left: 18, width: 4, height: 4 }]} />
            <View style={[styles.sageDot, { top: 46, left: 36, width: 6, height: 6 }]} />
          </View>
          {/* Bee mascot bottom-right */}
          <View style={styles.villieCardMascot} pointerEvents="none">
            <Image source={VILLIE_BEE} style={styles.villieCardMascotImg} resizeMode="contain" />
          </View>

          <View style={styles.sageEyebrowRow}>
            <View style={styles.sageEyebrowBar} />
            <Text style={styles.sageEyebrowText}>Mom hacks &amp; tips</Text>
          </View>
          <Text style={styles.cardTitle}>
            Try one <Text style={styles.italicAccent}>tonight.</Text>
          </Text>

          <View style={styles.chipStrip}>
            {hacks.map((h, i) => (
              <View key={i} style={styles.chipRow}>
                <View style={styles.chipBulletSage} />
                <Text style={styles.chipText}>{h}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.cardCta}>More hacks →</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Page chrome ──────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 8, paddingHorizontal: 20,
    backgroundColor: COLORS.cream,
  },
  back: { fontSize: 13, color: COLORS.coco, fontFamily: FONTS.bodySemiBold },
  audienceTag: {
    fontSize: 10, color: COLORS.coco, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.6, textTransform: 'uppercase',
  },
  content: { paddingHorizontal: 20, paddingBottom: 60 },

  // ── Masthead ─────────────────────────────────────────────────────────
  masthead: { position: 'relative', marginTop: 6, marginBottom: 16, paddingRight: 74 },
  villieMasthead: {
    position: 'absolute', top: 4, right: -6,
    width: 74, height: 74, opacity: 0.55,
    transform: [{ rotate: '14deg' }],
    zIndex: 1,
  },
  villieMastheadImg: { width: '100%', height: '100%' },
  fieldGuideRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  fieldGuideBar: { width: 16, height: 1, backgroundColor: COLORS.coco, marginRight: 8 },
  fieldGuideText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.coco,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.headerBold, fontSize: 38, lineHeight: 40,
    letterSpacing: -1.2, color: COLORS.bark, marginTop: 0, marginBottom: 6,
  },
  italicAccent: {
    fontFamily: FONTS.headerItalic, color: COLORS.coco,
    // RN will pick up fontStyle from the family, but force italic just in case
    fontStyle: 'italic',
  },
  heartDotInline: { color: COLORS.coco, fontFamily: FONTS.headerBold },
  lead: {
    fontSize: 13, lineHeight: 19, color: COLORS.barkSoft,
    fontFamily: FONTS.body, marginTop: 6, maxWidth: '94%',
  },

  // ── Shared scribble line (3-line decorative mark) ────────────────────
  scribbleLine: { height: 1.2, backgroundColor: COLORS.bark, opacity: 0.55 },

  // ── CARD 1 · Week hero ───────────────────────────────────────────────
  weekCard: {
    borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 12,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.22)',
  },
  weekTopBar: {
    position: 'absolute', top: 0, left: 18,
    width: 34, height: 2, backgroundColor: COLORS.coco,
    zIndex: 3,
  },
  weekYolkOuter: {
    position: 'absolute', top: -22, right: -22,
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#E8C4B6', opacity: 0.85, zIndex: 0,
  },
  weekYolkInner: {
    position: 'absolute', top: -4, right: -4,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#AD795B', opacity: 0.55, zIndex: 0,
  },
  weekScribble: {
    position: 'absolute', top: 24, right: 80,
    gap: 2, opacity: 0.55, zIndex: 1,
  },
  weekEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep,
    letterSpacing: 1.8, textTransform: 'uppercase',
    paddingTop: 6, zIndex: 2,
  },
  weekNum: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 34, lineHeight: 36, letterSpacing: -1,
    color: COLORS.bark, marginTop: 4, marginBottom: 8, zIndex: 2,
  },
  weekBody: {
    fontSize: 13, lineHeight: 18, color: COLORS.bark,
    fontFamily: FONTS.body, maxWidth: '78%', zIndex: 2,
  },
  weekCta: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', zIndex: 2,
  },
  weekCtaText: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep,
  },
  weekCtaArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.coco,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.coco, shadowOpacity: 0.45,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  weekCtaArrowGlyph: {
    color: COLORS.paper, fontSize: 16, fontFamily: FONTS.bodyBold,
    fontWeight: '700',
  },

  // ── CARD 2 · Book spread ─────────────────────────────────────────────
  bookCard: {
    borderRadius: 16,
    paddingVertical: 14, paddingLeft: 22, paddingRight: 16, paddingBottom: 30,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)',
  },
  bookSpine: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: COLORS.coco, zIndex: 2,
  },
  bookSpineHighlight: {
    position: 'absolute', left: 4, top: 0, bottom: 0,
    width: 2, backgroundColor: 'rgba(173,121,91,0.18)', zIndex: 1,
  },
  bookYolkRing: {
    position: 'absolute', top: -22, right: -22,
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 1.6, borderColor: COLORS.coco,
    opacity: 0.40, zIndex: 0,
  },
  bookTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: COLORS.bark,
    marginTop: 6, marginBottom: 10, zIndex: 2,
  },
  chapterRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 7, zIndex: 2,
  },
  chapterRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(173,121,91,0.30)',
  },
  chapterNum: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 13, color: COLORS.cocoDeep,
    width: 28, paddingTop: 1,
  },
  chapterText: {
    flex: 1, fontSize: 12, lineHeight: 17,
    color: COLORS.bark, fontFamily: FONTS.body,
  },
  bookCta: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold,
    color: COLORS.coco, letterSpacing: 0.4,
    marginTop: 10, zIndex: 2,
  },
  folio: {
    position: 'absolute', bottom: 10, right: 14,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 10, color: COLORS.coco, opacity: 0.55,
    zIndex: 2,
  },

  // ── CARD 3 · Clinical chart ──────────────────────────────────────────
  chartCardWrap: { position: 'relative', marginTop: 14, marginBottom: 10 },
  chartTab: {
    position: 'absolute', top: -14, left: 14,
    paddingHorizontal: 12, paddingVertical: 4,
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(107,122,75,0.30)',
    zIndex: 3,
  },
  chartTabText: {
    fontSize: 9, fontFamily: FONTS.bodySemiBold, color: COLORS.sageDeep,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  chartCard: {
    borderRadius: 14,
    paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(107,122,75,0.30)',
  },
  chartFold: {
    position: 'absolute', top: 0, right: 0,
    width: 36, height: 36,
    opacity: 0.20, borderTopRightRadius: 14,
    zIndex: 1,
  },
  chartTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: COLORS.bark,
    marginTop: 6, marginBottom: 8, zIndex: 2,
  },
  qRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 7, paddingBottom: 7,
    zIndex: 2,
  },
  qRowDivider: {
    borderBottomWidth: 1, borderStyle: 'dashed',
    borderBottomColor: 'rgba(107,122,75,0.40)',
  },
  qTag: {
    backgroundColor: COLORS.sageDeep,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 3, marginRight: 8, marginTop: 1,
  },
  qTagText: {
    fontSize: 9, fontFamily: FONTS.bodyBold, color: COLORS.paper,
    letterSpacing: 1.0,
  },
  qText: {
    flex: 1, fontSize: 12, lineHeight: 17,
    color: COLORS.bark, fontFamily: FONTS.body,
  },
  chartFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10, zIndex: 2,
  },
  chartStamp: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 10, color: COLORS.sageDeep, opacity: 0.80,
  },

  // ── Shared "soft card" used for Quick Watches + Mom Hacks ────────────
  softCard: {
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)',
  },
  cardTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: COLORS.bark,
    marginTop: 6, marginBottom: 6, zIndex: 2,
  },
  cardCta: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold,
    color: COLORS.coco, letterSpacing: 0.4,
    marginTop: 8, zIndex: 2,
  },

  // ── Scribble mark for Quick Watches top-right ────────────────────────
  scribbleAbs: {
    position: 'absolute', top: 16, right: 16,
    gap: 2, opacity: 0.65, zIndex: 1,
  },

  // ── Video strip ──────────────────────────────────────────────────────
  vidStrip: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 8, zIndex: 2 },
  vidThumb: {
    flex: 1, height: 64, borderRadius: 7,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(61,31,13,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  vidPlaceholderGlyph: { fontSize: 22, color: COLORS.paper, opacity: 0.85 },
  vidDuration: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(28,16,8,0.78)',
    paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3,
  },
  vidDurationText: { color: COLORS.paper, fontSize: 9, fontFamily: FONTS.bodySemiBold },
  vidWatched: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: 'rgba(92,107,58,0.92)',
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3,
  },
  vidWatchedText: {
    color: COLORS.paper, fontSize: 8, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },

  // ── Mom Hacks card ───────────────────────────────────────────────────
  hacksCard: {
    paddingRight: 80, minHeight: 162,
    borderColor: 'rgba(107,122,75,0.22)',
  },
  sageDots: {
    position: 'absolute', bottom: -4, right: 36,
    width: 60, height: 60, opacity: 0.40, zIndex: 0,
  },
  sageDot: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: COLORS.sageDeep,
  },
  villieCardMascot: {
    position: 'absolute', bottom: 4, right: 6,
    width: 64, height: 64, zIndex: 1,
    transform: [{ rotate: '-10deg' }],
  },
  villieCardMascotImg: { width: '100%', height: '100%' },
  chipStrip: { gap: 5, marginTop: 2, marginBottom: 8, zIndex: 2 },
  chipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chipBulletSage: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: COLORS.sageDeep, marginTop: 6,
  },
  chipText: {
    flex: 1, fontSize: 12, lineHeight: 17,
    color: COLORS.bark, fontFamily: FONTS.body,
  },

  // ── Shared eyebrow patterns ──────────────────────────────────────────
  cocoEyebrowRow: { flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  cocoEyebrowBar: { width: 16, height: 1, backgroundColor: COLORS.coco, marginRight: 8 },
  cocoEyebrowText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.coco,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  sageEyebrowRow: { flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  sageEyebrowBar: { width: 16, height: 1, backgroundColor: COLORS.sageDeep, marginRight: 8 },
  sageEyebrowText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.sageDeep,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
});
