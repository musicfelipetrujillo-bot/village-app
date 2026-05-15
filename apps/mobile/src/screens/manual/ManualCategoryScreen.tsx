// ManualCategory — context-driven chapter pages (v9 design).
//
// Pixel-faithful port of /private/tmp/manual-recipe-v9-context.html.
// All decorative colors hardcoded from the v9 CSS variables (NOT routed
// through brand-v2 cinnamon tokens) so this screen reads exactly as
// the mockup intends, regardless of any future brand-token shifts.
//
// Mom tab → mom × {feel, heal, nourish, rest, tips}
// Baby tab → baby × {feed, sleep, grow, care, tips}
//
// Five identity-distinct papers per chapter:
//   (1) Week hero — pink-cream w/ decorative yolks, big Playfair italic
//       week number, RUST arrow CTA → routes to weekly guide
//   (2) The Manual — book-spread paper, bold COCO book spine on the
//       left edge, Roman numeral chapters, italic "p. N" folio mark
//   (3) Ask Specialist — clinical-chart paper, SAGE "For your visit"
//       file-folder tab on top-left edge, Q1/Q2/Q3 form labels,
//       sage corner-fold mark top-right, signed-off footer stamp
//   (4) Quick Watches — coco-cream, video thumbnail strip, durations
//   (5) Mom Hacks — sage-cream, vertical bullet list, scattered sage
//       dots, villie bee mascot tucked in the corner
//
// Italics deliberately appear on each card title (one per card, not
// one per screen) — chapter-of-a-book editorial feel.
//
// Videos are short (≤2 min, DB-enforced), Mux-hosted, EN+ES caption-aware.
// Tapping a thumbnail opens ManualVideoScreen for the full-screen player.
// Watched state is persisted server-side (manual_video_progress) and
// surfaced as a "Watched" overlay on the thumbnail.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { FONTS } from '@utils/constants';
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

// ═══════════════════════════════════════════════════════════════════════
// V9 palette — exact CSS variable values from the v9 mockup.
// Use these directly for this screen; do NOT route through COLORS.coco/
// rust since those resolve to brand-v2 cinnamon (#C07840), which is a
// different shade than the v9 mockup's --coco (#AD795B) / --rust
// (#B85C38). The screen is meant to look exactly like the mockup.
// ═══════════════════════════════════════════════════════════════════════
const V9 = {
  paper: '#FDFAF5',
  bgPink: '#FAEDE3',
  bgBook: '#FBF3E0',
  bgChart: '#EDE9DC',
  bgCoco: '#F4E2D1',
  bgSage: '#EBEFD9',

  bark: '#3D1F0D',
  barkSoft: '#5C3F26',

  rust: '#B85C38',
  rustDeep: '#9A4A2B',
  sage: '#8B9A6B',
  sageDeep: '#6B7A4B',
  coco: '#AD795B',
  cocoDeep: '#8E5E40',
  sand: '#EADBA8',
  sandDeep: '#D9C58E',

  pink: '#E8C4B6',
  pinkDeep: '#C99580',
  pinkSoft: '#F2D5C5',
} as const;

// ── Chapter masthead — "[prefix] [italic accent]." ─────────────────────
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export default function ManualCategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ManualCategory'>>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const { audience, category } = route.params;

  const [videos, setVideos] = useState<ManualVideo[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const list = await listManualVideos(audience, category, lang);
          if (!cancelled) setVideos(list);
        } catch (e) {
          console.error('manual-category load', e);
          if (!cancelled) setVideos([]);
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

  const babyProfile = useHomeStore((s) => s.babyProfile);
  const week = Math.max(1, babyProfile?.current_week_number ?? 1);

  const key = `${audience}/${category}`;
  const hero       = HERO_TITLE[key]     ?? { prefix: 'Read about', em: 'this.' };
  const subLead    = SUB_LEAD[key]       ?? '';
  const weekBody   = WEEK_BODY[key]      ?? '';
  const bullets    = MANUAL_BULLETS[key] ?? [];
  const questions  = SPECIALIST_QS[key]  ?? [];
  const hacks      = MOM_HACKS[key]      ?? [];

  // (No card-level onPress for now — wiring real destinations is a follow-up.
  // The HeroKey type stays exported for that future routing layer.)

  return (
    <View style={styles.container}>
      {/* Top nav — Back + small audience tag (MOM / BABY) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
        {/* Liquid-glass pill — VISIBLE body on cream bg. iOS 26 pills
            still read as distinct shapes, not invisible films. Higher
            opacity backdrop + coco hairline border + softer top highlight. */}
        <View style={styles.audienceTagPill}>
          {/* Subtle top-edge specular — visible but not blown out */}
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }}
            style={StyleSheet.absoluteFill as any}
            pointerEvents="none"
          />
          {/* Faint warm wash bottom-half for depth */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(173,121,91,0.10)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill as any}
            pointerEvents="none"
          />
          <Text style={styles.audienceTag}>
            {audience === 'mom' ? 'Mom' : 'Baby'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── Masthead ─── */}
        <View style={styles.masthead}>
          <View style={styles.villieMasthead} pointerEvents="none">
            <Image source={VILLIE_BEE} style={styles.villieMastheadImg} resizeMode="contain" />
          </View>
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: V9.rust }]} />
            <Text style={[styles.eyebrowText, { color: V9.rust }]}>A field guide</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {hero.prefix} <Text style={styles.italicAccent}>{hero.em}</Text>
            </Text>
            <View style={styles.heartDot} />
          </View>
          {!!subLead && <Text style={styles.lead}>{subLead}</Text>}
        </View>

        {/* ─── CARD 1 · Week hero ─── */}
        {/* Plain View (no TouchableOpacity wrapper) — card-level taps would
            block the ScrollView's vertical drag. Inner CTAs become tappable
            when we wire real destinations. */}
        <View style={styles.weekCard} accessibilityLabel={`Week ${week}. ${weekBody}`}>
          <View style={styles.weekTopBar} />
          <View style={styles.weekYolkOuter} pointerEvents="none" />
          <View style={styles.weekYolkInner} pointerEvents="none" />
          <View style={styles.weekScribble} pointerEvents="none">
            <View style={[styles.scribbleLineBark, { width: 20, transform: [{ rotate: '-6deg' }] }]} />
            <View style={[styles.scribbleLineBark, { width: 14, transform: [{ rotate: '2deg' }] }]} />
            <View style={[styles.scribbleLineBark, { width: 16, transform: [{ rotate: '-3deg' }] }]} />
          </View>
          <Text style={styles.weekEyebrow}>You{'’'}re in</Text>
          <Text style={styles.weekNum}>Week {week}</Text>
          <Text style={styles.weekBody}>{weekBody}</Text>
          <View style={styles.weekCta}>
            <Text style={styles.weekCtaText}>See your weekly guide →</Text>
            {/* Glossy cinnamon CTA — confident button first, glass second.
                Soft top highlight + faint bottom-inner shadow for depth.
                No bright inner ring (read as plastic halo at this size). */}
            <View style={styles.weekCtaArrow}>
              <LinearGradient
                colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }}
                style={[StyleSheet.absoluteFill as any, { borderRadius: 18 }]}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
                start={{ x: 0, y: 0.6 }} end={{ x: 0, y: 1 }}
                style={[StyleSheet.absoluteFill as any, { borderRadius: 18 }]}
                pointerEvents="none"
              />
              <Text style={styles.weekCtaArrowGlyph}>→</Text>
            </View>
          </View>
        </View>

        {/* ─── CARD 2 · The Manual (book spread) ─── */}
        <View style={styles.bookCard} accessibilityLabel="The manual. What to actually know.">
          <View style={styles.bookSpine} pointerEvents="none" />
          <View style={styles.bookSpineHighlight} pointerEvents="none" />
          <View style={styles.bookYolkRing} pointerEvents="none" />

          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: V9.rust }]} />
            <Text style={[styles.eyebrowText, { color: V9.rust }]}>The manual</Text>
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
        </View>

        {/* ─── CARD 3 · Ask Specialist (clinical chart) ─── */}
        <View style={styles.chartCardWrap}>
          {/* Liquid-glass file-folder tab: chart paper base + subtle top-edge
              specular highlight for the iOS 26 frosted feel. */}
          <View style={styles.chartTab}>
            <LinearGradient
              colors={['rgba(255,255,255,0.40)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={[StyleSheet.absoluteFill as any, { borderTopLeftRadius: 6, borderTopRightRadius: 6 }]}
              pointerEvents="none"
            />
            <Text style={styles.chartTabText}>For your visit</Text>
          </View>
          <View style={styles.chartCard} accessibilityLabel="Ask your specialist. Bring these three.">
            {/* Hard-cutoff sage corner-fold (50/50, not smooth) */}
            <LinearGradient
              colors={[V9.sageDeep, V9.sageDeep, 'transparent', 'transparent']}
              locations={[0, 0.5, 0.5, 1]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.chartFold}
              pointerEvents="none"
            />

            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowBar, { backgroundColor: V9.sageDeep }]} />
              <Text style={[styles.eyebrowText, { color: V9.sageDeep }]}>Ask your specialist</Text>
            </View>
            <Text style={styles.chartTitle}>
              Bring these <Text style={styles.italicAccent}>three.</Text>
            </Text>

            {questions.map((q, i) => (
              <View key={i} style={[styles.qRow, i < questions.length - 1 && styles.qRowDivider]}>
                {/* Liquid-glass Q-chip: sage base + soft top highlight */}
                <View style={styles.qTag}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={[StyleSheet.absoluteFill as any, { borderRadius: 3 }]}
                    pointerEvents="none"
                  />
                  <Text style={styles.qTagText}>Q{i + 1}</Text>
                </View>
                <Text style={styles.qText}>{q}</Text>
              </View>
            ))}

            <View style={styles.chartFooter}>
              <Text style={styles.chartStamp}>— signed, your week-{week} self</Text>
              <Text style={styles.cardCtaRust}>Save & explore →</Text>
            </View>
          </View>
        </View>

        {/* ─── CARD 4 · Quick Watches ─── */}
        <View style={styles.softCardCoco} accessibilityLabel="Quick watches. Two minutes, exactly.">
          <View style={styles.scribbleAbs} pointerEvents="none">
            <View style={[styles.scribbleLineCoco, { width: 20, transform: [{ rotate: '-6deg' }] }]} />
            <View style={[styles.scribbleLineCoco, { width: 14, transform: [{ rotate: '2deg' }] }]} />
            <View style={[styles.scribbleLineCoco, { width: 16, transform: [{ rotate: '-3deg' }] }]} />
          </View>

          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: V9.rust }]} />
            <Text style={[styles.eyebrowText, { color: V9.rust }]}>Quick watches</Text>
          </View>
          <Text style={styles.cardTitle}>
            Two minutes, <Text style={styles.italicAccent}>exactly.</Text>
          </Text>

          {/* v9 spec: ALWAYS render exactly 3 slots in a row. Real video where
              videos[i] exists; gradient placeholder otherwise. This keeps the
              row layout intact when the DB has 0/1/2 videos (without this, a
              single thumb would stretch to 100% via flex:1). */}
          <View style={styles.vidStrip}>
            {[0, 1, 2].map((i) => {
              const v = videos[i];
              if (v) {
                return (
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
                );
              }
              const gradient =
                i === 0 ? [V9.pinkSoft, V9.pinkDeep] as const
                : i === 1 ? ['#E5D2BA', V9.coco] as const
                : ['#D8DEB7', V9.sage] as const;
              return (
                <LinearGradient
                  key={`sk-${i}`}
                  colors={gradient as unknown as readonly [string, string, ...string[]]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={styles.vidThumb}
                >
                  <Text style={styles.vidPlaceholderGlyph}>▷</Text>
                </LinearGradient>
              );
            })}
          </View>

          <Text style={styles.cardCtaRust}>Watch the row →</Text>
        </View>

        {/* ─── CARD 5 · Mom Hacks ─── */}
        <View style={styles.softCardSage} accessibilityLabel="Mom hacks. Try one tonight.">
          <View style={styles.sageDots} pointerEvents="none">
            <View style={[styles.sageDot, { top: 14, left: 8, width: 6, height: 6 }]} />
            <View style={[styles.sageDot, { top: 4,  left: 28, width: 4, height: 4 }]} />
            <View style={[styles.sageDot, { top: 26, left: 42, width: 7, height: 7 }]} />
            <View style={[styles.sageDot, { top: 38, left: 18, width: 4, height: 4 }]} />
            <View style={[styles.sageDot, { top: 46, left: 36, width: 6, height: 6 }]} />
          </View>
          <View style={styles.villieCardMascot} pointerEvents="none">
            <Image source={VILLIE_BEE} style={styles.villieCardMascotImg} resizeMode="contain" />
          </View>

          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: V9.rust }]} />
            <Text style={[styles.eyebrowText, { color: V9.rust }]}>Mom hacks &amp; tips</Text>
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

          <Text style={styles.cardCtaRust}>More hacks →</Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Shadow recipes — RN can't do CSS multi-shadow + inset, so each card
// gets the "lifted off the page" shadow from v9 approximated via
// elevation + shadowColor + shadowOffset.
// ═══════════════════════════════════════════════════════════════════════
const cardShadow = {
  shadowColor: V9.coco,
  shadowOpacity: 0.28,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 18,
  elevation: 4,
};
const weekCardShadow = {
  shadowColor: V9.coco,
  shadowOpacity: 0.30,
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 22,
  elevation: 5,
};
const sageCardShadow = {
  shadowColor: V9.sageDeep,
  shadowOpacity: 0.30,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 18,
  elevation: 4,
};
const arrowShadow = {
  shadowColor: V9.rust,
  shadowOpacity: 0.45,
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 10,
  elevation: 4,
};

const styles = StyleSheet.create({
  // ── Page chrome ──────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: V9.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 8, paddingHorizontal: 20,
    backgroundColor: V9.paper,
  },
  back: { fontSize: 13, color: V9.coco, fontFamily: FONTS.bodySemiBold },

  // ── Liquid-glass audience tag pill (iOS 26 styling) ─────────────────
  // Visible-body recipe: high-opacity warm-tinted backdrop + soft top
  // highlight + bottom warm wash + coco hairline border. Reads as a
  // distinct glass lozenge against cream paper, not invisible film.
  audienceTagPill: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(253, 250, 245, 0.80)', // visible parchment glass
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(173, 121, 91, 0.32)', // visible coco hairline (was invisible white)
    shadowColor: V9.coco,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  audienceTag: {
    fontSize: 10.5, color: V9.coco, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.6, textTransform: 'uppercase',
    // ensure text sits above the gradient layers
    zIndex: 2,
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

  // Shared eyebrow row (label + 16x1 hairline bar)
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  eyebrowBar: { width: 16, height: 1, marginRight: 8 },
  eyebrowText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    flexWrap: 'wrap', marginTop: 8, marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.headerBold, fontSize: 40, lineHeight: 40,
    letterSpacing: -1.2, color: V9.bark,
  },
  italicAccent: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: V9.rust,
  },
  heartDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: V9.rust,
    marginLeft: 5, marginBottom: 8,
  },
  lead: {
    fontSize: 13, lineHeight: 19, color: V9.barkSoft,
    fontFamily: FONTS.body, marginTop: 6, maxWidth: '92%',
  },

  // ── Shared scribbles ─────────────────────────────────────────────────
  scribbleLineBark: { height: 1.1, backgroundColor: V9.bark, opacity: 0.55 },
  scribbleLineCoco: { height: 1.1, backgroundColor: V9.cocoDeep, opacity: 0.65 },

  // ── CARD 1 · Week hero ───────────────────────────────────────────────
  weekCard: {
    backgroundColor: V9.bgPink,
    borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 12,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.22)',
    ...weekCardShadow,
  },
  weekTopBar: {
    position: 'absolute', top: 0, left: 18,
    width: 34, height: 2, backgroundColor: V9.rust,
    zIndex: 3,
  },
  weekYolkOuter: {
    position: 'absolute', top: -22, right: -22,
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: V9.pink, opacity: 0.85, zIndex: 0,
  },
  weekYolkInner: {
    position: 'absolute', top: -4, right: -4,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: V9.coco, opacity: 0.55, zIndex: 0,
  },
  weekScribble: {
    position: 'absolute', top: 24, right: 80,
    gap: 2, opacity: 0.55, zIndex: 1,
  },
  weekEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: V9.rustDeep,
    letterSpacing: 1.8, textTransform: 'uppercase',
    paddingTop: 6, zIndex: 2,
  },
  weekNum: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 36, lineHeight: 36, letterSpacing: -1,
    color: V9.bark, marginTop: 4, marginBottom: 8, zIndex: 2,
  },
  weekBody: {
    fontSize: 13, lineHeight: 18, color: V9.bark,
    fontFamily: FONTS.body, maxWidth: '78%', zIndex: 2,
  },
  weekCta: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', zIndex: 2,
  },
  weekCtaText: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: V9.rustDeep,
  },
  weekCtaArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: V9.rust,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', // clip glass overlays to circle
    ...arrowShadow,
  },
  weekCtaArrowGlyph: {
    color: V9.paper,
    fontSize: 18,
    lineHeight: 18, // clamp to fontSize so the Text box is glyph-tight
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false, // Android: kill the extra font padding
    marginTop: -1, // optical fudge — arrow glyph sits slightly low in most fonts
    textAlignVertical: 'center', // Android: vertical center inside the Text box
  },

  // ── CARD 2 · Book spread ─────────────────────────────────────────────
  bookCard: {
    backgroundColor: V9.bgBook,
    borderRadius: 16,
    paddingTop: 14, paddingLeft: 22, paddingRight: 16, paddingBottom: 28,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)',
    ...cardShadow,
  },
  bookSpine: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: V9.coco, zIndex: 2,
  },
  bookSpineHighlight: {
    position: 'absolute', left: 4, top: 0, bottom: 0,
    width: 2, backgroundColor: 'rgba(173,121,91,0.25)', zIndex: 1,
  },
  bookYolkRing: {
    position: 'absolute', top: -22, right: -22,
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 1.6, borderColor: V9.coco,
    opacity: 0.40, zIndex: 0,
  },
  bookTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: V9.bark,
    marginTop: 6, marginBottom: 10, zIndex: 2,
  },
  chapterRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 6, zIndex: 2,
  },
  chapterRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(173,121,91,0.18)',
  },
  chapterNum: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 13, color: V9.cocoDeep,
    width: 28, paddingTop: 1,
  },
  chapterText: {
    flex: 1, fontSize: 11.5, lineHeight: 16,
    color: V9.bark, fontFamily: FONTS.body,
  },
  bookCta: {
    fontSize: 11.5, fontFamily: FONTS.bodySemiBold,
    color: V9.rust, letterSpacing: 0.5,
    marginTop: 10, zIndex: 2,
  },
  folio: {
    position: 'absolute', bottom: 8, right: 14,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 10, color: V9.coco, opacity: 0.55,
    zIndex: 2,
  },

  // ── CARD 3 · Clinical chart ──────────────────────────────────────────
  chartCardWrap: { position: 'relative', marginTop: 14, marginBottom: 10 },
  chartTab: {
    position: 'absolute', top: -14, left: 14,
    paddingHorizontal: 12, paddingTop: 3, paddingBottom: 4,
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(107,122,75,0.28)',
    backgroundColor: V9.bgChart,
    overflow: 'hidden', // clip glass highlight gradient
    zIndex: 3,
  },
  chartTabText: {
    fontSize: 9, fontFamily: FONTS.bodyBold, color: V9.sageDeep,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  chartCard: {
    backgroundColor: V9.bgChart,
    borderRadius: 14,
    paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(107,122,75,0.28)',
    ...cardShadow,
    shadowColor: V9.sageDeep,
  },
  chartFold: {
    position: 'absolute', top: 0, right: 0,
    width: 32, height: 32,
    opacity: 0.20, borderTopRightRadius: 14,
    zIndex: 1,
  },
  chartTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: V9.bark,
    marginTop: 6, marginBottom: 8, zIndex: 2,
  },
  qRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingTop: 7, paddingBottom: 6,
    zIndex: 2,
  },
  qRowDivider: {
    borderBottomWidth: 1, borderStyle: 'dashed',
    borderBottomColor: 'rgba(107,122,75,0.30)',
  },
  qTag: {
    backgroundColor: V9.sageDeep,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 3, marginRight: 8, marginTop: 1,
    overflow: 'hidden', // clip glass highlight gradient
  },
  qTagText: {
    fontSize: 9, fontFamily: FONTS.bodyBold, color: V9.paper,
    letterSpacing: 0.8,
  },
  qText: {
    flex: 1, fontSize: 11.5, lineHeight: 16,
    color: V9.bark, fontFamily: FONTS.body,
  },
  chartFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10, zIndex: 2,
  },
  chartStamp: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 10, color: V9.sageDeep, opacity: 0.75,
  },

  // ── Shared "soft cards" used for Quick Watches + Mom Hacks ───────────
  softCardCoco: {
    backgroundColor: V9.bgCoco,
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)',
    ...cardShadow,
  },
  softCardSage: {
    backgroundColor: V9.bgSage,
    borderRadius: 16,
    paddingTop: 14, paddingBottom: 14, paddingLeft: 16, paddingRight: 80,
    minHeight: 162,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(107,122,75,0.22)',
    ...sageCardShadow,
  },
  cardTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: V9.bark,
    marginTop: 6, marginBottom: 6, zIndex: 2,
  },
  cardCtaRust: {
    fontSize: 11.5, fontFamily: FONTS.bodySemiBold,
    color: V9.rust, letterSpacing: 0.5,
    marginTop: 8, zIndex: 2,
  },

  // Scribble for Quick Watches top-right (coco-deep, not bark)
  scribbleAbs: {
    position: 'absolute', top: 16, right: 16,
    gap: 2, zIndex: 1,
  },

  // ── Video strip ──────────────────────────────────────────────────────
  vidStrip: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 8, zIndex: 2 },
  vidThumb: {
    flex: 1, height: 64, borderRadius: 7,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(61,31,13,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  vidPlaceholderGlyph: { fontSize: 22, color: V9.paper, opacity: 0.85 },
  vidDuration: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(28,16,8,0.78)',
    paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3,
  },
  vidDurationText: { color: V9.paper, fontSize: 8.5, fontFamily: FONTS.bodySemiBold },
  vidWatched: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: 'rgba(92,107,58,0.92)',
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3,
  },
  vidWatchedText: {
    color: V9.paper, fontSize: 8, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },

  // ── Mom Hacks ────────────────────────────────────────────────────────
  sageDots: {
    position: 'absolute', bottom: -4, right: 36,
    width: 60, height: 60, opacity: 0.40, zIndex: 0,
  },
  sageDot: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: V9.sageDeep,
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
    backgroundColor: V9.sageDeep, marginTop: 6,
  },
  chipText: {
    flex: 1, fontSize: 11.5, lineHeight: 16,
    color: V9.bark, fontFamily: FONTS.body,
  },
});
