// V2 M3 — MilkMatchScreen
// Recipient sets preferences → calls milk-match-donors → renders ranked donor cards.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { callMatchDonors, DIET_FLAG_KEYS, type DietFlagKey, type DonorMatch } from '@api/milk';
import { DonorCard } from '@components/milk/DonorCard';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { getEffectiveCoords } from '@utils/devLocation';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkMatch'>;

const STAGES = ['pregnant', 'newborn', '0_3mo', '3_6mo', '6_12mo', 'toddler'] as const;
const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

const STAGE_LABEL_KEYS: Record<typeof STAGES[number], string> = {
  pregnant: 'milkMatch.stagePregnant',
  newborn: 'milkMatch.stageNewborn',
  '0_3mo': 'milkMatch.stage0_3mo',
  '3_6mo': 'milkMatch.stage3_6mo',
  '6_12mo': 'milkMatch.stage6_12mo',
  toddler: 'milkMatch.stageToddler',
};

const DIET_LABEL_KEYS: Record<DietFlagKey, string> = {
  dairy_free: 'milkMatch.dietDairyFree',
  organic: 'milkMatch.dietOrganic',
  gluten_free: 'milkMatch.dietGlutenFree',
  vegan: 'milkMatch.dietVegan',
  nut_free: 'milkMatch.dietNutFree',
};

export default function MilkMatchScreen({ navigation }: Props) {
  const t = useT();
  const [needOz, setNeedOz] = useState(32);
  const [maxPrice, setMaxPrice] = useState(2.5);
  const [stage, setStage] = useState<typeof STAGES[number]>('newborn');
  const [diet, setDiet] = useState<DietFlagKey[]>([]);
  const [fulfillment, setFulfillment] = useState<'pickup' | 'shipping'>('pickup');
  const [radius, setRadius] = useState<number>(25);

  const [matches, setMatches] = useState<DonorMatch[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleDiet = (key: DietFlagKey) => {
    setDiet((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleFindMatches = async () => {
    setLoading(true);
    try {
      let deviceCoords: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          deviceCoords = loc.coords;
        }
      } catch {
        // permission/location failure — Miami fallback applied below
      }
      // Dev-mode override: ignore Simulator's Cupertino default in favor of Miami.
      const { lat, lng } = getEffectiveCoords(deviceCoords);

      const { matches: ranked } = await callMatchDonors({
        lat, lng,
        need_oz: needOz,
        max_price_per_oz: maxPrice,
        diet_flags: diet,
        fulfillment,
        pregnancy_stage: stage,
        radius_miles: radius,
      });

      setMatches(ranked);
      if (ranked.length === 0) {
        Alert.alert(t('milkMatch.noMatchesTitle'), t('milkMatch.noMatchesBody'));
      }
    } catch (e: any) {
      Alert.alert(t('milkMatch.matchFailedTitle'), e.message ?? t('milkMatch.matchFailedBody'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('milkMatch.back')}
        >
          <Text style={styles.back}>{t('milkMatch.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('milkMatch.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {!matches && (
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>{t('milkMatch.introEmoji')}</Text>
            <Text style={styles.introTitle}>{t('milkMatch.introTitle')}</Text>
            <Text style={styles.introBody}>
              {t('milkMatch.introBody')}
            </Text>
          </View>
        )}

        {/* Need oz */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('milkMatch.weeklyNeed')}</Text>
          <View style={styles.pillRow}>
            {[16, 32, 64, 128].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.pill, needOz === v && styles.pillActive]}
                onPress={() => setNeedOz(v)}
              >
                <Text style={[styles.pillText, needOz === v && styles.pillTextActive]}>{t('milkMatch.needOzPill', { oz: v })}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Budget */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('milkMatch.maxPrice')}</Text>
          <View style={styles.pillRow}>
            {[1.5, 2, 2.5, 3].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.pill, maxPrice === v && styles.pillActive]}
                onPress={() => setMaxPrice(v)}
              >
                <Text style={[styles.pillText, maxPrice === v && styles.pillTextActive]}>${v.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stage */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('milkMatch.babyStage')}</Text>
          <View style={styles.pillRow}>
            {STAGES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.pill, stage === s && styles.pillActive]}
                onPress={() => setStage(s)}
              >
                <Text style={[styles.pillText, stage === s && styles.pillTextActive]}>{t(STAGE_LABEL_KEYS[s])}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Diet */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('milkMatch.diet')}</Text>
          <View style={styles.pillRow}>
            {DIET_FLAG_KEYS.map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.pill, diet.includes(k) && styles.pillActive]}
                onPress={() => toggleDiet(k)}
              >
                <Text style={[styles.pillText, diet.includes(k) && styles.pillTextActive]}>
                  {t(DIET_LABEL_KEYS[k])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Fulfillment */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('milkMatch.fulfillment')}</Text>
          <View style={styles.pillRow}>
            {(['pickup', 'shipping'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.pill, fulfillment === f && styles.pillActive]}
                onPress={() => setFulfillment(f)}
              >
                <Text style={[styles.pillText, fulfillment === f && styles.pillTextActive]}>
                  {f === 'pickup' ? t('milkMatch.fulfillmentPickup') : t('milkMatch.fulfillmentShipping')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Radius */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('milkMatch.radius')}</Text>
          <View style={styles.pillRow}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.pill, radius === r && styles.pillActive]}
                onPress={() => setRadius(r)}
              >
                <Text style={[styles.pillText, radius === r && styles.pillTextActive]}>{t('milkMatch.radiusPill', { r })}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Matches */}
        {matches && matches.length > 0 && (
          <View style={styles.matchSection}>
            <Text style={styles.matchHeader}>
              {t(matches.length === 1 ? 'milkMatch.topMatchesOne' : 'milkMatch.topMatchesOther', { count: matches.length })}
            </Text>
            {matches.map((m) => (
              <View key={m.donor_profile_id} style={styles.matchWrap}>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchBadgeRank}>{t('milkMatch.matchRank', { rank: m.rank })}</Text>
                  <Text style={styles.matchBadgeScore}>{t('milkMatch.matchFitPct', { score: m.fit_score })}</Text>
                </View>
                <DonorCard
                  donor={m.donor}
                  saved={false}
                  onPress={() => navigation.navigate('DonorProfile', { donorProfileId: m.donor_profile_id })}
                  onSaveToggle={() => {}}
                />
                <Text style={styles.matchReason}>"{m.reason}"</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.findBtn, loading && styles.findBtnDisabled]}
          onPress={handleFindMatches}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FDFBF6" />
          ) : (
            <Text style={styles.findBtnText}>{matches ? t('milkMatch.ctaRerun') : t('milkMatch.ctaFind')}</Text>
          )}
        </TouchableOpacity>
      </View>
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
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodyMedium },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },

  intro: { padding: 24, alignItems: 'center' },
  introEmoji: { fontSize: 44, marginBottom: 8 },
  introTitle: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 6 },
  introBody: { fontSize: 14, color: '#6B5C52', textAlign: 'center', lineHeight: 21, fontFamily: FONTS.body },

  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#6B2E0E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 5,
  },
  label: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#F5F0E8', borderWidth: 1.5, borderColor: 'transparent',
  },
  pillActive: { backgroundColor: COLORS.pinkSoft, borderColor: COLORS.coco },
  pillText: { fontSize: 12, fontFamily: FONTS.bodyMedium, color: '#6B5C52', textTransform: 'capitalize' },
  pillTextActive: { color: COLORS.coco },

  matchSection: { marginTop: 16, marginHorizontal: 0 },
  matchHeader: {
    fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810',
    marginHorizontal: 16, marginBottom: 12,
  },
  matchWrap: { position: 'relative', marginBottom: 8 },
  matchBadge: {
    position: 'absolute', top: 14, right: 22, zIndex: 2,
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: COLORS.coco, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  matchBadgeRank: { color: '#FDFBF6', fontSize: 11, fontFamily: FONTS.bodySemiBold },
  matchBadgeScore: { color: '#FDFBF6', fontSize: 10, fontFamily: FONTS.bodyMedium },
  matchReason: {
    fontSize: 13, color: '#6B5C52', fontFamily: FONTS.headerItalic,
    marginHorizontal: 24, marginTop: -4, marginBottom: 14,
    lineHeight: 19,
  },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  findBtn: {
    backgroundColor: '#C07840', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  findBtnDisabled: { opacity: 0.5 },
  findBtnText: { color: '#FDFBF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
});
