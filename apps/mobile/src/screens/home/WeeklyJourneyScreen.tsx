// V4 Phase B — Weekly Journey screen.
// Mom-focused weekly content lane: maternal insights + village supports +
// interactive checklist. See docs/PHASE_B_WEEKLY_JOURNEY_PROPOSAL.md.
//
// Why this exists alongside MilestoneDetail:
//   • MilestoneDetail = baby-focused — what's happening developmentally for
//     the baby this week (sourced from milestone_library, V4 Phase G1).
//   • WeeklyJourney   = mom-focused — recovery, emotional, sleep,
//     relationships, identity for the postpartum mom (sourced from
//     maternal_insights + village_supports + week_checklists, Phase B).
// HomeScreen's HeroWeekCard now routes to WeeklyJourney; the BabyThisWeek and
// "You / Village" small cards continue to deep-link into MilestoneDetail.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import {
  weeklyJourneyApi,
  parseCtaTarget,
  insightCategoryLabel,
  supportTypeLabel,
  checklistCategoryLabel,
  type WeeklyJourneyPayload,
  type ChecklistItem,
} from '@api/weekly-journey';
import CrisisResourcesSheet from '@components/community/CrisisResourcesSheet';

type ParamList = { WeeklyJourney: { week?: number } };

// village_supports.cta_target uses lowercase tab keys for editability in
// Studio. Map to the actual react-navigation Tab.Screen names registered in
// AppNavigator.
const TAB_KEY_MAP: Record<string, string> = {
  home:      'Home',
  milk:      'Milk',
  experts:   'Experts',
  community: 'Connect',
  gear:      'Gear',
  me:        'Me',
};

export default function WeeklyJourneyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'WeeklyJourney'>>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const babyProfile = useHomeStore((s) => s.babyProfile);

  // Resolve the target week: explicit param wins, else fall back to the
  // baby's current postpartum week (clamped 1..104), else 1 for cold-launch.
  const week = Math.min(
    104,
    Math.max(1, route.params?.week ?? babyProfile?.current_week_number ?? 1),
  );

  const [payload, setPayload] = useState<WeeklyJourneyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [crisisLead, setCrisisLead] = useState<string | undefined>(undefined);
  // Optimistic state for checklist toggles. Keyed by item id; reflects the
  // intended `completed` value while the server write is in flight, reverted
  // on error.
  const [pendingTicks, setPendingTicks] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const data = await weeklyJourneyApi.getWeeklyJourney(week, lang);
      setPayload(data);
    } catch (e) {
      console.error('weekly-journey load', e);
    }
  }, [week, lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleChecklist = useCallback(async (item: ChecklistItem) => {
    const currentlyCompleted = pendingTicks[item.id] ?? item.completed;
    const next = !currentlyCompleted;
    setPendingTicks((p) => ({ ...p, [item.id]: next }));
    try {
      if (next) {
        await weeklyJourneyApi.markChecklistComplete(item.id);
      } else {
        await weeklyJourneyApi.unmarkChecklistComplete(item.id);
      }
    } catch (e) {
      console.error('checklist toggle', e);
      // Revert on error.
      setPendingTicks((p) => ({ ...p, [item.id]: currentlyCompleted }));
      Alert.alert(t('weeklyJourney.toggleErrorTitle'), t('weeklyJourney.toggleErrorBody'));
    }
  }, [pendingTicks, t]);

  const dispatchCta = useCallback((target: string | null) => {
    const parsed = parseCtaTarget(target);
    if (!parsed) return;
    const tabName = TAB_KEY_MAP[parsed.tab];
    if (!tabName) {
      console.warn('weekly-journey: unknown cta tab', parsed.tab);
      return;
    }
    // Tab navigator lives one level above HomeNavigator. Hop up via
    // getParent() to switch tabs, then drill into the target screen.
    const tabNav = navigation.getParent?.();
    if (!tabNav) return;
    if (!parsed.route) {
      tabNav.navigate(tabName);
      return;
    }
    // Per-tab mapping for the optional third segment. Each entry knows the
    // param key its target screen reads. Add new tabs here as deeplinks land.
    let params: Record<string, unknown> | undefined;
    if (parsed.param) {
      switch (parsed.tab) {
        case 'experts':
          // ExpertsHomeScreen reads `specialty` and pre-selects the chip.
          params = { specialty: parsed.param };
          break;
        default:
          // Unknown tab/route combo with a param — pass through as `param`
          // so target screens can opt into reading it without us guessing.
          params = { param: parsed.param };
      }
    }
    tabNav.navigate(tabName, { screen: parsed.route, params });
  }, [navigation]);

  const openCrisis = useCallback((lead?: string) => {
    setCrisisLead(lead);
    setCrisisOpen(true);
  }, []);

  if (loading && !payload) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.rust} />
      </View>
    );
  }

  const insights = payload?.maternal_insights ?? [];
  const supports = payload?.village_supports ?? [];
  const checklists = payload?.checklists ?? [];
  const isEmpty = insights.length === 0 && supports.length === 0 && checklists.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('weeklyJourney.back')}
        >
          <Text style={styles.headerBack}>{t('weeklyJourney.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('weeklyJourney.headerTitle')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.rust} />}
      >
        {/* Hero — rust-on-cream Playfair italic week numeral, mom-focused tagline. */}
        <View style={styles.hero}>
          <View style={styles.heroTextCol}>
            <Text style={styles.heroEyebrow}>{t('weeklyJourney.heroEyebrow')}</Text>
            <Text style={styles.heroWeekText}>{t('weeklyJourney.heroWeekFmt', { week })}</Text>
            <Text style={styles.heroTagline}>{t('weeklyJourney.heroTagline')}</Text>
          </View>
          <View style={styles.heroPhotoLane}>
            <Text style={styles.heroEmoji}>🌗</Text>
          </View>
        </View>

        {isEmpty && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>{t('weeklyJourney.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('weeklyJourney.emptyBody', { week })}</Text>
          </View>
        )}

        {/* Section 1 — About you this week */}
        {insights.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('weeklyJourney.aboutYouTitle')}</Text>
            {insights.map((mi) => (
              <View key={mi.id} style={styles.insightCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardCategory}>{insightCategoryLabel(mi.category, lang)}</Text>
                  {mi.hero_emoji && <Text style={styles.cardEmoji}>{mi.hero_emoji}</Text>}
                </View>
                <Text style={styles.cardTitle}>{mi.title}</Text>
                <Text style={styles.cardBody}>{mi.body}</Text>
                {mi.requires_crisis_footer && (
                  <TouchableOpacity
                    style={styles.crisisFooter}
                    onPress={() => openCrisis(t('weeklyJourney.crisisLead'))}
                    accessibilityRole="button"
                    accessibilityLabel={t('weeklyJourney.crisisFooterA11y')}
                  >
                    <Text style={styles.crisisFooterText}>
                      {t('weeklyJourney.crisisFooterCta')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {/* Section 2 — Your village */}
        {supports.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('weeklyJourney.yourVillageTitle')}</Text>
            {supports.map((vs) => (
              <View key={vs.id} style={styles.supportCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardCategory}>{supportTypeLabel(vs.support_type, lang)}</Text>
                  {vs.hero_emoji && <Text style={styles.cardEmoji}>{vs.hero_emoji}</Text>}
                </View>
                <Text style={styles.cardTitle}>{vs.title}</Text>
                <Text style={styles.cardBody}>{vs.body}</Text>
                {vs.cta_label && vs.cta_target && (
                  <TouchableOpacity
                    style={styles.supportCta}
                    onPress={() => dispatchCta(vs.cta_target)}
                    accessibilityRole="button"
                    accessibilityLabel={vs.cta_label}
                  >
                    <Text style={styles.supportCtaText}>{vs.cta_label} →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {/* Section 3 — This week's checklist */}
        {checklists.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('weeklyJourney.checklistTitle')}</Text>
            {checklists.map((ci) => {
              const completed = pendingTicks[ci.id] ?? ci.completed;
              return (
                <TouchableOpacity
                  key={ci.id}
                  style={[styles.checklistRow, ci.is_essential && styles.checklistRowEssential]}
                  onPress={() => toggleChecklist(ci)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: completed }}
                  accessibilityLabel={ci.item_text}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, completed && styles.checkboxChecked]}>
                    {completed && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.checklistTextCol}>
                    <Text style={styles.checklistCategory}>
                      {checklistCategoryLabel(ci.category, lang)}
                      {ci.is_essential && <Text style={styles.essentialDot}>{' · '}{t('weeklyJourney.essential')}</Text>}
                    </Text>
                    <Text style={[styles.checklistText, completed && styles.checklistTextDone]}>
                      {ci.item_text}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <Text style={styles.disclaimer}>{t('weeklyJourney.disclaimer')}</Text>

        <TouchableOpacity
          style={styles.crisisLink}
          onPress={() => openCrisis()}
          accessibilityRole="button"
          accessibilityLabel={t('weeklyJourney.crisisLinkA11y')}
        >
          <Text style={styles.crisisLinkText}>{t('weeklyJourney.crisisLink')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <CrisisResourcesSheet
        visible={crisisOpen}
        onClose={() => setCrisisOpen(false)}
        lead={crisisLead}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerBack: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },

  // paddingBottom clears the global Villie FAB (56h + 16 offset above the
  // tab bar = ~72px footprint above the ScrollView's rendered bottom edge).
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },

  // Hero — mirrors MilestoneDetail's rust-on-cream block, but mom-targeted copy.
  hero: {
    backgroundColor: COLORS.rust,
    borderRadius: 24, padding: 22, marginBottom: 18,
    flexDirection: 'row',
    shadowColor: '#D87530',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 4,
  },
  heroTextCol: { flex: 1, paddingRight: 12 },
  heroPhotoLane: {
    width: 92, alignSelf: 'stretch', borderRadius: 18,
    backgroundColor: 'rgba(255,246,238,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji: { fontSize: 44 },
  heroEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2,
    color: 'rgba(255,245,236,0.85)', textTransform: 'uppercase', marginBottom: 6,
  },
  heroWeekText: {
    fontFamily: FONTS.headerItalic, fontSize: 32, color: '#FFF6EE',
    marginBottom: 10, lineHeight: 38,
  },
  heroTagline: { fontSize: 14, color: '#F8E8DD', lineHeight: 20, fontFamily: FONTS.body },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: COLORS.textMid, fontFamily: FONTS.body, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  sectionTitle: {
    fontFamily: FONTS.headerItalic, fontSize: 22,
    color: COLORS.brownDeep, marginTop: 14, marginBottom: 10,
  },

  insightCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 10,
  },
  supportCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: COLORS.olive,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: COLORS.rustDark, textTransform: 'uppercase',
  },
  cardEmoji: { fontSize: 18 },
  cardTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 6 },
  cardBody: { fontSize: 14, color: COLORS.textMid, lineHeight: 21, marginTop: 6, fontFamily: FONTS.body },

  supportCta: {
    marginTop: 12, alignSelf: 'flex-start',
    backgroundColor: COLORS.olive, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  supportCtaText: { fontSize: 13, color: '#FFF', fontFamily: FONTS.bodySemiBold },

  crisisFooter: {
    marginTop: 12,
    backgroundColor: 'rgba(184,92,56,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.2)',
  },
  crisisFooterText: { fontSize: 13, color: COLORS.rustDark, fontFamily: FONTS.bodySemiBold, lineHeight: 18 },

  checklistRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFF', borderRadius: 14,
    padding: 14, marginBottom: 8,
  },
  checklistRowEssential: { borderLeftWidth: 3, borderLeftColor: COLORS.rust },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.textLight,
    marginRight: 12, marginTop: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  checkmark: { color: '#FFF', fontSize: 14, fontFamily: FONTS.bodySemiBold, lineHeight: 16 },
  checklistTextCol: { flex: 1 },
  checklistCategory: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.2,
    color: COLORS.rustDark, textTransform: 'uppercase', marginBottom: 3,
  },
  essentialDot: { color: COLORS.rust },
  checklistText: { fontSize: 14, color: COLORS.brownDeep, lineHeight: 20, fontFamily: FONTS.body },
  checklistTextDone: { color: COLORS.textLight, textDecorationLine: 'line-through' },

  disclaimer: {
    marginTop: 22, fontSize: 12, color: COLORS.textLight, lineHeight: 18, textAlign: 'center',
    fontFamily: FONTS.bodyMedium,
  },
  crisisLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 12 },
  crisisLinkText: { fontSize: 13, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
});
