// V4 Phase G1 — MilestoneTimelineScreen
// Horizontal week selector (1..52) with basic preview. Tapping a week navigates
// to MilestoneDetail for that week.
// 2026-04-25: restyled to match mockup aesthetic — Playfair italic week numeral
// in the hero preview, refined typography across the screen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { homeApi, type Milestone } from '@api/home';
import { useT } from '@/i18n';

type ParamList = { MilestoneTimeline: { week?: number } };

const WEEK_BTN_WIDTH = 64;

export default function MilestoneTimelineScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'MilestoneTimeline'>>();
  const initialWeek = Math.min(52, Math.max(1, route.params?.week ?? 1));

  const t = useT();
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const weekListRef = useRef<FlatList<number>>(null);

  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    homeApi.getMilestonesForWeek(selectedWeek)
      .then((rows) => { if (!cancelled) setMilestones(rows); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedWeek]);

  // Center the initial week on mount
  useEffect(() => {
    setTimeout(() => {
      weekListRef.current?.scrollToIndex({
        index: Math.max(0, initialWeek - 3),
        animated: false,
      });
    }, 50);
  }, [initialWeek]);

  const hero = milestones[0];

  const renderWeek = useCallback(({ item: w }: { item: number }) => {
    const active = w === selectedWeek;
    return (
      <TouchableOpacity
        key={w}
        style={[styles.weekBtn, active && styles.weekBtnActive]}
        onPress={() => setSelectedWeek(w)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.weekBtnText, active && styles.weekBtnTextActive]}>{t('milestone.weekChip', { week: w })}</Text>
      </TouchableOpacity>
    );
  }, [selectedWeek, t]);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('milestone.back')}>
          <Text style={styles.back}>{t('milestone.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('milestone.headerTitle')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.weekRail}>
        <FlatList
          ref={weekListRef}
          horizontal
          data={weeks}
          keyExtractor={(w) => String(w)}
          renderItem={renderWeek}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekRailContent}
          getItemLayout={(_, i) => ({ length: WEEK_BTN_WIDTH + 8, offset: (WEEK_BTN_WIDTH + 8) * i, index: i })}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color="#D96C88" style={{ marginTop: 40 }} />
        ) : hero ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroEyebrow}>{t('milestone.weekChip', { week: selectedWeek }).toUpperCase()}</Text>
                <Text style={styles.heroTitle}>{hero.title}</Text>
                <Text style={styles.heroBody} numberOfLines={4}>{hero.description}</Text>
              </View>
              <View style={styles.heroPhotoLane}>
                <Text style={styles.heroEmoji}>{hero.hero_emoji ?? '✨'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('MilestoneDetail', { week: selectedWeek })}
              accessibilityRole="button"
            >
              <Text style={styles.detailBtnText}>{t('milestone.seeFullWeek')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.emptyText}>{t('milestone.emptyTimeline', { week: selectedWeek })}</Text>
        )}
      </ScrollView>
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

  weekRail: {
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingVertical: 10,
  },
  weekRailContent: { paddingHorizontal: 12, gap: 8 },
  weekBtn: {
    width: WEEK_BTN_WIDTH, height: 44, borderRadius: 12,
    backgroundColor: COLORS.cream,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  // v9 active state — action-deep
  weekBtnActive: { backgroundColor: '#D96C88', borderColor: '#D96C88' },
  weekBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  weekBtnTextActive: { color: '#FFFCF6' },

  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  // Mockup-aligned rust hero with two-column text + photo lane.
  hero: {
    backgroundColor: COLORS.coco,
    borderRadius: 24, padding: 22,
    flexDirection: 'row',
    minHeight: 160,
    shadowColor: COLORS.coco,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 4,
  },
  heroTextCol: { flex: 1, paddingRight: 12, justifyContent: 'center' },
  heroPhotoLane: {
    width: 88, alignSelf: 'stretch', borderRadius: 18,
    backgroundColor: 'rgba(255,246,238,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: 'rgba(255,245,236,0.85)', textTransform: 'uppercase', marginBottom: 6,
  },
  heroEmoji: { fontSize: 44 },
  heroTitle: {
    fontFamily: FONTS.headerItalic, fontSize: 24, color: '#FFF6EE',
    marginBottom: 10, lineHeight: 30,
  },
  heroBody: { fontSize: 14, color: '#F8E8DD', lineHeight: 20, fontFamily: FONTS.body },

  detailBtn: { alignSelf: 'center', marginTop: 16, paddingVertical: 10 },
  detailBtnText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },

  emptyText: { textAlign: 'center', color: COLORS.textLight, marginTop: 40, fontFamily: FONTS.body },
});
