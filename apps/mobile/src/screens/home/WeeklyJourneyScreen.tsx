// V4 Phase B — Weekly Journey screen.
// Mom-focused weekly content lane: maternal insights + village supports +
// interactive checklist.
//
// Layout (2026-05-02 redesign — direction "B"):
//   • Slim hero: eyebrow + Playfair italic week numeral + tagline + thin
//     progress bar (week / 52, capped). No more big emoji photo lane —
//     the screen pacing now does the work that the hero used to.
//   • Segmented control with counts under the hero: About you · Village ·
//     To-dos. Telegraphs scope in one glance ("oh, three small things").
//   • About you / Village → horizontal snap carousel, one card per swipe.
//     Each card shows category eyebrow + emoji token + title + 3-line
//     teaser; "Read more" expands the full body inline. Crisis insights
//     keep the rust-tinted footer; supports keep the olive CTA pill.
//   • To-dos → 2-col tile grid. Essential tiles get a rust border + chip.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import {
  YolkCircle,
  ScribbleMark,
} from '@components/shared/DecorativeMarks';

type ParamList = { WeeklyJourney: { week?: number } };

// Maps weekly-journey AI CTA tab tokens → actual Tab.Screen names in
// AppNavigator. Updated 2026-05-25 nav audit:
//   - `community: 'Connect'` REMOVED — Connect tab is hidden and not
//     shipping; AI-generated `community:*` CTAs are silently dropped
//     by the early-return guard below (vs navigating to a non-existent
//     tab and silently failing).
//   - `me: 'Me'` → `me: 'Profile'` — actual tab name in AppNavigator is
//     `Profile` (hosts MeNavigator under the hood).
//   - Added `manual`, `village`, `inbox` for completeness so AI CTAs
//     targeting newer surfaces resolve.
const TAB_KEY_MAP: Record<string, string> = {
  home:    'Home',
  manual:  'Manual',
  village: 'Village',
  inbox:   'Inbox',
  milk:    'Milk',
  experts: 'Experts',
  gear:    'Gear',
  me:      'Profile',
};

type Segment = 'aboutYou' | 'village' | 'todos';

const SCREEN_W = Dimensions.get('window').width;

export default function WeeklyJourneyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'WeeklyJourney'>>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const babyProfile = useHomeStore((s) => s.babyProfile);

  const week = Math.min(
    104,
    Math.max(1, route.params?.week ?? babyProfile?.current_week_number ?? 1),
  );

  const [payload, setPayload] = useState<WeeklyJourneyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [crisisLead, setCrisisLead] = useState<string | undefined>(undefined);
  const [pendingTicks, setPendingTicks] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [segment, setSegment] = useState<Segment>('aboutYou');

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
      if (next) await weeklyJourneyApi.markChecklistComplete(item.id);
      else await weeklyJourneyApi.unmarkChecklistComplete(item.id);
    } catch (e) {
      console.error('checklist toggle', e);
      setPendingTicks((p) => ({ ...p, [item.id]: currentlyCompleted }));
      Alert.alert(t('weeklyJourney.toggleErrorTitle'), t('weeklyJourney.toggleErrorBody'));
    }
  }, [pendingTicks, t]);

  const dispatchCta = useCallback((target: string | null) => {
    const parsed = parseCtaTarget(target);
    if (!parsed) return;
    const tabName = TAB_KEY_MAP[parsed.tab];
    if (!tabName) return;
    const tabNav = navigation.getParent?.();
    if (!tabNav) return;
    if (!parsed.route) {
      tabNav.navigate(tabName);
      return;
    }
    let params: Record<string, unknown> | undefined;
    if (parsed.param) {
      switch (parsed.tab) {
        case 'experts':
          params = { specialty: parsed.param };
          break;
        default:
          params = { param: parsed.param };
      }
    }
    tabNav.navigate(tabName, { screen: parsed.route, params });
  }, [navigation]);

  const openCrisis = useCallback((lead?: string) => {
    setCrisisLead(lead);
    setCrisisOpen(true);
  }, []);

  const insights = useMemo(() => payload?.maternal_insights ?? [], [payload]);
  const supports = useMemo(() => payload?.village_supports   ?? [], [payload]);
  const checklists = useMemo(() => payload?.checklists       ?? [], [payload]);
  const isEmpty = insights.length === 0 && supports.length === 0 && checklists.length === 0;
  const completedCount = checklists.reduce((n, ci) => n + ((pendingTicks[ci.id] ?? ci.completed) ? 1 : 0), 0);

  // Progress fraction for the hairline bar — first 52 weeks are the heavy
  // content window for postpartum, so use that as the denominator and cap
  // at 1.0 for weeks 53–104 (still meaningful, just maxed out visually).
  const progressFrac = Math.min(1, week / 52);

  if (loading && !payload) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#E84B79" />
      </View>
    );
  }

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coco} />}
      >
        {/* Editorial hero card. Paper-tinted card with marks contained inside
            so the screen leads with a real "magazine cover" beat instead of
            floating text on cream. Yolk highlight sits behind the Playfair
            week numeral; leaf sprig anchors the top-right; a hairline rule
            separates the week numeral from the tagline (editorial divider
            pattern). All marks pointer-events:none so taps fall through. */}
        <View style={styles.heroOuter}>
          <View style={styles.heroCard}>
            {/* v9 paper-leaning hero wash — cream→blush, softer than the
                old golden→blush so the week hero sits on the page. */}
            <LinearGradient
              colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <YolkCircle size={120} top={26} left={-26} opacity={0.55} />

            <Text style={styles.heroEyebrow}>{t('weeklyJourney.heroEyebrow')}</Text>
            <Text style={styles.heroWeekText}>{t('weeklyJourney.heroWeekFmt', { week })}</Text>

            <View style={styles.heroDivider} />

            <Text style={styles.heroTagline}>{t('weeklyJourney.heroTagline')}</Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressFrac * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {t('weeklyJourney.progressLabel', { week, total: 52 })}
            </Text>
          </View>
        </View>

        {isEmpty && (
          <View style={styles.empty}>
            <YolkCircle size={120} top={20} left={SCREEN_W / 2 - 60} opacity={0.45} />
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>{t('weeklyJourney.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('weeklyJourney.emptyBody', { week })}</Text>
          </View>
        )}

        {!isEmpty && (
          <>
            {/* Segmented control */}
            <View style={styles.segmentRow}>
              <SegmentPill
                label={t('weeklyJourney.segAboutYou')}
                count={insights.length}
                active={segment === 'aboutYou'}
                onPress={() => setSegment('aboutYou')}
              />
              <SegmentPill
                label={t('weeklyJourney.segVillage')}
                count={supports.length}
                active={segment === 'village'}
                onPress={() => setSegment('village')}
              />
              <SegmentPill
                label={t('weeklyJourney.segTodos')}
                count={checklists.length}
                badge={checklists.length > 0 ? `${completedCount}/${checklists.length}` : undefined}
                active={segment === 'todos'}
                onPress={() => setSegment('todos')}
              />
            </View>

            {/* About you stack */}
            {segment === 'aboutYou' && insights.length > 0 && (
              <View style={styles.stack}>
                {insights.map((mi) => {
                  const isOpen = !!expanded[mi.id];
                  const longBody = (mi.body?.length ?? 0) > 120;
                  return (
                    <View key={mi.id} style={styles.stackCard}>
                      <Text style={styles.cardCategory}>{insightCategoryLabel(mi.category, lang)}</Text>
                      <Text style={styles.stackCardTitle}>{mi.title}</Text>
                      <Text
                        style={styles.stackCardBody}
                        numberOfLines={isOpen ? undefined : 3}
                      >
                        {mi.body}
                      </Text>
                      {longBody && (
                        <TouchableOpacity
                          onPress={() => setExpanded((p) => ({ ...p, [mi.id]: !isOpen }))}
                          accessibilityRole="button"
                          accessibilityLabel={isOpen ? t('weeklyJourney.readLess') : t('weeklyJourney.readMore')}
                        >
                          <Text style={styles.readMoreText}>
                            {isOpen ? t('weeklyJourney.readLess') : t('weeklyJourney.readMore')}
                          </Text>
                        </TouchableOpacity>
                      )}
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
                  );
                })}
              </View>
            )}

            {/* Village stack */}
            {segment === 'village' && supports.length > 0 && (
              <View style={styles.stack}>
                {supports.map((vs) => {
                  const isOpen = !!expanded[vs.id];
                  const longBody = (vs.body?.length ?? 0) > 120;
                  return (
                    <View key={vs.id} style={[styles.stackCard, styles.supportCard]}>
                      <Text style={styles.cardCategory}>{supportTypeLabel(vs.support_type, lang)}</Text>
                      <Text style={styles.stackCardTitle}>{vs.title}</Text>
                      <Text
                        style={styles.stackCardBody}
                        numberOfLines={isOpen ? undefined : 3}
                      >
                        {vs.body}
                      </Text>
                      {longBody && (
                        <TouchableOpacity
                          onPress={() => setExpanded((p) => ({ ...p, [vs.id]: !isOpen }))}
                          accessibilityRole="button"
                          accessibilityLabel={isOpen ? t('weeklyJourney.readLess') : t('weeklyJourney.readMore')}
                        >
                          <Text style={styles.readMoreText}>
                            {isOpen ? t('weeklyJourney.readLess') : t('weeklyJourney.readMore')}
                          </Text>
                        </TouchableOpacity>
                      )}
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
                  );
                })}
              </View>
            )}

            {/* To-dos grid */}
            {segment === 'todos' && checklists.length > 0 && (
              <View style={styles.todosGrid}>
                {checklists.map((ci) => {
                  const completed = pendingTicks[ci.id] ?? ci.completed;
                  return (
                    <TouchableOpacity
                      key={ci.id}
                      style={[
                        styles.todoTile,
                        ci.is_essential && styles.todoTileEssential,
                        completed && styles.todoTileDone,
                      ]}
                      onPress={() => toggleChecklist(ci)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: completed }}
                      accessibilityLabel={ci.item_text}
                      activeOpacity={0.75}
                    >
                      {/* Scribble accent on essential tiles only — completed
                          tiles drop the mark to read as "settled". */}
                      {ci.is_essential && !completed && (
                        <ScribbleMark size={22} bottom={10} right={10} tint={COLORS.coco} />
                      )}
                      <View style={styles.todoTileTopRow}>
                        <Text style={styles.todoCategory}>
                          {checklistCategoryLabel(ci.category, lang)}
                        </Text>
                        <View style={[styles.checkbox, completed && styles.checkboxChecked]}>
                          {completed && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                      </View>
                      {ci.is_essential && (
                        <Text style={styles.essentialPill}>{t('weeklyJourney.essential')}</Text>
                      )}
                      <Text style={[styles.todoText, completed && styles.todoTextDone]} numberOfLines={4}>
                        {ci.item_text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Empty-state for an empty segment when other segments have data */}
            {segment === 'aboutYou' && insights.length === 0 && (
              <SegmentEmpty t={t} which="aboutYou" />
            )}
            {segment === 'village' && supports.length === 0 && (
              <SegmentEmpty t={t} which="village" />
            )}
            {segment === 'todos' && checklists.length === 0 && (
              <SegmentEmpty t={t} which="todos" />
            )}
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

function SegmentPill({
  label, count, badge, active, onPress,
}: {
  label: string; count: number; badge?: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentPill, active && styles.segmentPillActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} (${badge ?? count})`}
      activeOpacity={0.8}
    >
      <Text style={[styles.segmentPillText, active && styles.segmentPillTextActive]}>
        {label}
      </Text>
      <View style={[styles.segmentCountChip, active && styles.segmentCountChipActive]}>
        <Text style={[styles.segmentCountText, active && styles.segmentCountTextActive]}>
          {badge ?? count}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SegmentEmpty({
  t, which,
}: {
  t: (k: string, p?: Record<string, any>) => string;
  which: 'aboutYou' | 'village' | 'todos';
}) {
  const key =
    which === 'aboutYou' ? 'weeklyJourney.segEmptyAboutYou' :
    which === 'village'  ? 'weeklyJourney.segEmptyVillage'  :
                           'weeklyJourney.segEmptyTodos';
  return (
    <View style={styles.segEmpty}>
      <Text style={styles.segEmptyText}>{t(key)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerBack: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  // paddingBottom clears the global Villie FAB.
  content: { paddingTop: 16, paddingBottom: 100 },

  // Editorial hero card — sits inside an outer padded container so the
  // marks anchor to the card, not the screen edge.
  heroOuter: { paddingHorizontal: 16, marginBottom: 16 },
  heroCard: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: '#F2E9C4',
    borderRadius: 10,
    paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  heroDivider: {
    height: 1, backgroundColor: COLORS.sandSoft,
    marginTop: 4, marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 2.4,
    color: '#7A4A24', textTransform: 'uppercase', marginBottom: 6,
  },
  heroWeekText: {
    fontFamily: FONTS.headerItalic, fontSize: 44, color: COLORS.bark,
    lineHeight: 50, marginBottom: 10,
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontSize: 15, color: COLORS.barkSoft, lineHeight: 22, fontFamily: FONTS.body,
    marginBottom: 16,
  },
  progressTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: COLORS.sandSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: COLORS.coco, borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.bodyMedium,
    marginTop: 6, letterSpacing: 0.4,
  },

  empty: { position: 'relative', alignItems: 'center', paddingVertical: 56, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: COLORS.barkSoft, fontFamily: FONTS.body, textAlign: 'center', lineHeight: 20 },

  // Segmented control — Manual-style single track with paper-active pill.
  // Compact: smaller padding, smaller text, smaller count chip, all 3
  // share one ceramicDeep track so it reads as a single component.
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.sandSoft,
    borderRadius: 999,
    padding: 3,
    marginHorizontal: 20, marginBottom: 16,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5,
    paddingVertical: 7, paddingHorizontal: 6,
    borderRadius: 999,
  },
  segmentPillActive: {
    backgroundColor: COLORS.paper,
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
  },
  segmentPillText: {
    fontSize: 11.5, fontFamily: FONTS.bodySemiBold,
    color: COLORS.barkSoft, letterSpacing: 0.2,
  },
  segmentPillTextActive: { color: COLORS.bark },
  segmentCountChip: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    minWidth: 18, alignItems: 'center',
  },
  segmentCountChipActive: { backgroundColor: COLORS.cream },
  segmentCountText: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  segmentCountTextActive: { color: COLORS.bark },

  // Vertical stack + cards
  stack: { paddingHorizontal: 20, gap: 10 },
  stackCard: {
    position: 'relative',
    overflow: 'hidden', // clip decorative marks that hang past corners
    backgroundColor: COLORS.paper, borderRadius: 10,
    padding: 18,
    shadowColor: '#43260F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  // v9: ex side-stripe → full sage hairline so the support-row card still
  // reads as "this is the calming/recovery beat" against neighboring cards.
  supportCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(96,110,70,0.45)' },
  stackCardTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  emojiToken: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: 'rgba(216,117,48,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  emojiTokenOlive: { backgroundColor: 'rgba(142,152,66,0.12)' },
  emojiTokenText: { fontSize: 22 },
  cardCategory: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.6,
    color: '#7A4A24', textTransform: 'uppercase', marginBottom: 10,
  },
  stackCardTitle: {
    fontSize: 19, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    lineHeight: 25, marginBottom: 8,
  },
  stackCardBody: {
    fontSize: 14, color: COLORS.barkSoft, lineHeight: 21,
    fontFamily: FONTS.body,
  },
  readMoreText: {
    fontSize: 13, color: '#7A4A24', fontFamily: FONTS.bodySemiBold,
    marginTop: 10,
  },

  supportCta: {
    marginTop: 12, alignSelf: 'flex-start',
    backgroundColor: COLORS.sage, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  supportCtaText: { fontSize: 13, color: '#FFFCF6', fontFamily: FONTS.bodySemiBold },

  crisisFooter: {
    marginTop: 12,
    backgroundColor: 'rgba(216,117,48,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: 'rgba(216,117,48,0.22)',
  },
  crisisFooterText: { fontSize: 13, color: '#E84B79', fontFamily: FONTS.bodySemiBold, lineHeight: 18 },

  // To-dos grid
  todosGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 8,
  },
  todoTile: {
    position: 'relative', overflow: 'hidden',
    width: (SCREEN_W - 16 * 2 - 8) / 2,
    minHeight: 130,
    backgroundColor: COLORS.paper, borderRadius: 10,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',  // v9 rust hairline
  },
  todoTileEssential: {
    borderColor: '#E84B79', borderWidth: 1.5,                                    // active essential = cinnamon
  },
  todoTileDone: {
    backgroundColor: COLORS.cream,
  },
  todoTileTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 8,
  },
  todoCategory: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.2,
    color: '#7A4A24', textTransform: 'uppercase', flex: 1, marginRight: 6,
  },
  essentialPill: {
    alignSelf: 'flex-start',
    fontSize: 9, fontFamily: FONTS.bodySemiBold, letterSpacing: 1,
    color: '#7A4A24', textTransform: 'uppercase',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(216,117,48,0.10)',
    marginBottom: 6,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.textLight,
    alignItems: 'center', justifyContent: 'center',
  },
  // v9 active state — action-deep
  checkboxChecked: { backgroundColor: '#E84B79', borderColor: '#E84B79' },
  checkmark: { color: '#FFFCF6', fontSize: 14, fontFamily: FONTS.bodySemiBold, lineHeight: 16 },
  todoText: {
    fontSize: 13, color: COLORS.bark, lineHeight: 19, fontFamily: FONTS.body,
  },
  todoTextDone: { color: COLORS.textLight, textDecorationLine: 'line-through' },

  // Per-segment empty state (rare — full empty handled at top)
  segEmpty: {
    paddingVertical: 32, paddingHorizontal: 28,
    alignItems: 'center',
  },
  segEmptyText: {
    fontSize: 13, color: COLORS.barkSoft, lineHeight: 19, textAlign: 'center',
    fontFamily: FONTS.body,
  },

  disclaimer: {
    marginTop: 22, paddingHorizontal: 24,
    fontSize: 12, color: COLORS.textLight, lineHeight: 18, textAlign: 'center',
    fontFamily: FONTS.bodyMedium,
  },
  crisisLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 12 },
  crisisLinkText: { fontSize: 13, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
});
