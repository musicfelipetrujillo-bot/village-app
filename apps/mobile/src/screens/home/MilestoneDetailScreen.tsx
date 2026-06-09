// V4 Phase G1 — MilestoneDetailScreen
// Renders all milestone categories for a given week.
// 2026-04-25: restyled to match mockup aesthetic (Playfair italic week numeral,
// rust hero, refined category cards). Pure visual pass — same data shape.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { homeApi, type Milestone, type MilestoneCategory } from '@api/home';
import { useT } from '@/i18n';

type ParamList = { MilestoneDetail: { week: number } };

const CATEGORY_KEY: Record<MilestoneCategory, string> = {
  motor: 'milestone.categoryMotor',
  social: 'milestone.categorySocial',
  communication: 'milestone.categoryCommunication',
  sleep: 'milestone.categorySleep',
  feeding: 'milestone.categoryFeeding',
  sensory: 'milestone.categorySensory',
  cognitive: 'milestone.categoryCognitive',
};

export default function MilestoneDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'MilestoneDetail'>>();
  const week = route.params?.week ?? 1;
  const t = useT();

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  // One Animated.Value per category card (milestones[1..]) — spring-in staggered.
  const cardAnims = useRef<Animated.Value[]>([]).current;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    homeApi.getMilestonesForWeek(week)
      .then((rows) => {
        if (!cancelled) {
          setMilestones(rows);
          // Build/reset animated values for the category cards (skip hero at index 0).
          const count = Math.max(0, rows.length - 1);
          cardAnims.length = 0;
          for (let i = 0; i < count; i++) cardAnims.push(new Animated.Value(0));
          // Stagger: each card springs in 80ms after the previous one.
          Animated.stagger(80, cardAnims.map((v) =>
            Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 8, tension: 60 }),
          )).start();
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [week]);

  const hero = milestones[0];

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('milestone.back')}>
          <Text style={styles.back}>{t('milestone.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('milestone.headerWeek', { week })}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color="#D96C88" style={{ marginTop: 40 }} />
        ) : milestones.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('milestone.emptyForWeek')}</Text>
          </View>
        ) : (
          <>
            {hero && (
              <View style={styles.hero}>
                <View style={styles.heroTextCol}>
                  <Text style={styles.heroEyebrow}>{t('milestone.headerWeek', { week }).toUpperCase()}</Text>
                  <Text style={styles.heroTitle}>{hero.title}</Text>
                  <Text style={styles.heroBody}>{hero.description}</Text>
                </View>
                <View style={styles.heroPhotoLane}>
                  <Text style={styles.heroEmoji}>{hero.hero_emoji ?? '✨'}</Text>
                </View>
                {(hero.sleep_hours_min != null || hero.feed_interval_hours_min != null) && (
                  <View style={styles.statsRow}>
                    {hero.sleep_hours_min != null && hero.sleep_hours_max != null && (
                      <Stat label={t('milestone.statSleep')} value={t('milestone.statSleepValue', { min: hero.sleep_hours_min, max: hero.sleep_hours_max })} />
                    )}
                    {hero.feed_interval_hours_min != null && hero.feed_interval_hours_max != null && (
                      <Stat label={t('milestone.statFeed')} value={t('milestone.statFeedValue', { min: hero.feed_interval_hours_min, max: hero.feed_interval_hours_max })} />
                    )}
                  </View>
                )}
              </View>
            )}

            {milestones.slice(1).map((m, idx) => {
              const anim = cardAnims[idx] ?? new Animated.Value(1);
              return (
                <Animated.View
                  key={m.id}
                  style={{
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                  }}
                >
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardCategory}>{t(CATEGORY_KEY[m.category])}</Text>
                      {m.hero_emoji && <Text style={styles.cardEmoji}>{m.hero_emoji}</Text>}
                    </View>
                    <Text style={styles.cardTitle}>{m.title}</Text>
                    <Text style={styles.cardBody}>{m.description}</Text>
                  </View>
                </Animated.View>
              );
            })}

            <TouchableOpacity
              style={styles.timelineBtn}
              onPress={() => navigation.navigate('MilestoneTimeline', { week })}
              accessibilityRole="button"
            >
              <Text style={styles.timelineBtnText}>{t('milestone.browseOtherWeeks')}</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              {t('milestone.disclaimer')}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.textLight, fontFamily: FONTS.body },

  // Mockup-aligned hero — rust-on-cream with two-column layout (text + photo lane).
  hero: {
    backgroundColor: COLORS.coco,
    borderRadius: 24, padding: 22, marginBottom: 16,
    flexDirection: 'row', flexWrap: 'wrap',
    shadowColor: COLORS.coco,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 4,
  },
  heroTextCol: { flex: 1, paddingRight: 12 },
  heroPhotoLane: {
    width: 92, alignSelf: 'stretch', borderRadius: 18,
    backgroundColor: 'rgba(255,246,238,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: 'rgba(255,245,236,0.85)', textTransform: 'uppercase', marginBottom: 6,
  },
  heroEmoji: { fontSize: 44 },
  heroTitle: {
    fontFamily: FONTS.headerItalic, fontSize: 26, color: '#FFF6EE',
    marginBottom: 10, lineHeight: 32,
  },
  heroBody: { fontSize: 14, color: '#F8E8DD', lineHeight: 20, fontFamily: FONTS.body },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  stat: {
    backgroundColor: 'rgba(255,246,238,0.18)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center',
  },
  statValue: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#FFF6EE' },
  statLabel: {
    fontSize: 10, color: 'rgba(255,246,238,0.75)', letterSpacing: 0.5,
    textTransform: 'uppercase', marginTop: 3, fontFamily: FONTS.body,
  },

  card: {
    backgroundColor: COLORS.paper, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: '#7A4A24', textTransform: 'uppercase',
  },
  cardEmoji: { fontSize: 18 },
  cardTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 6 },
  cardBody: { fontSize: 14, color: COLORS.barkSoft, lineHeight: 20, marginTop: 4, fontFamily: FONTS.body },

  timelineBtn: { alignSelf: 'center', marginTop: 18, paddingVertical: 10 },
  timelineBtnText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },

  disclaimer: {
    marginTop: 18, fontSize: 12, color: COLORS.textLight, lineHeight: 18, textAlign: 'center',
    fontStyle: 'italic', fontFamily: FONTS.body,
  },
});
