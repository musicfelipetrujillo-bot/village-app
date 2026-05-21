// SavedDashboardScreen — unified "everything I've saved" hub at Me → Saved.
//
// Aggregates all four saves types (Manual videos / Specialists / Milk donors
// / Gear listings) into one scannable view. Each section renders up to 3
// preview rows + a "See all →" link that deep-links to the existing
// type-specific list screen.
//
// Why a single screen instead of forking new card components per type: each
// detail-screen already exists, each row card is already tuned to its type.
// The dashboard is purely about discoverability — so we use thin custom
// preview cards here and hand off to the real screens via cross-tab navigation.
//
// Design source: memory/project_unified_saved_hub.md (Option A).
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useAnalytics } from '@hooks/useAnalytics';
import { getSavedDashboard, type SavedDashboard } from '@/api/saved';
import type { MeStackParamList } from '@/navigation/MeNavigator';

type Props = NativeStackScreenProps<MeStackParamList, 'SavedDashboard'>;

function formatDuration(s: number): string {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function formatPrice(cents: number | null, isFree: boolean): string {
  if (isFree) return 'Free';
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(0)}`;
}

export default function SavedDashboardScreen({ navigation }: Props) {
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const { trackEvent } = useAnalytics();

  const [data, setData] = useState<SavedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getSavedDashboard(lang);
      setData(d);
    } catch (e) {
      console.error('saved dashboard load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang]);

  // Refetch on focus so newly saved/unsaved items reflect on return from
  // any detail screen.
  useFocusEffect(useCallback(() => {
    trackEvent('saved_dashboard_opened');
    load();
  }, [load, trackEvent]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Cross-tab navigation helper — Me's parent is the Tab navigator.
  // Same pattern as MeScreen's My-stuff deep links.
  const goToTab = (tab: string, screen: string) => {
    const parent = navigation.getParent();
    if (parent) (parent as any).navigate(tab, { screen });
  };

  const onSeeAll = (section: 'videos' | 'specialists' | 'donors' | 'gear') => {
    trackEvent('saved_section_seeall_tapped', { type: section });
    if (section === 'videos')       goToTab('Manual',  'SavedManual');
    if (section === 'specialists')  goToTab('Experts', 'Favorites');
    if (section === 'donors')       goToTab('Milk',    'SavedDonors');
    if (section === 'gear')         goToTab('Gear',    'SavedGear');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('savedDashboard.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading && (
        <View style={styles.center}><ActivityIndicator color="#C07840" /></View>
      )}

      {!loading && data && data.total === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={styles.emptyTitle}>{t('savedDashboard.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('savedDashboard.emptyBody')}</Text>
        </View>
      )}

      {!loading && data && data.total > 0 && (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C07840" />}
        >
          {/* Videos */}
          {data.videos_count > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('savedDashboard.sectionVideos')}</Text>
                <Text style={styles.sectionCount}>{data.videos_count}</Text>
              </View>
              {data.videos.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.videoRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.title}, ${formatDuration(v.duration_seconds)}`}
                  onPress={() => goToTab('Manual', 'SavedManual')}
                >
                  <View style={styles.videoThumb}>
                    {v.thumbnail_url && (
                      <Image source={{ uri: v.thumbnail_url }} style={styles.videoThumbImg} />
                    )}
                    <View style={styles.videoDur}>
                      <Text style={styles.videoDurText}>{formatDuration(v.duration_seconds)}</Text>
                    </View>
                  </View>
                  <View style={styles.videoMeta}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{v.title}</Text>
                    <Text style={styles.videoEyebrow}>
                      {(v.audience === 'mom' ? t('savedDashboard.audMom') : t('savedDashboard.audBaby'))
                        + '  ·  ' + String(v.category).toUpperCase()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {data.videos_count > data.videos.length && (
                <TouchableOpacity
                  style={styles.seeAll}
                  onPress={() => onSeeAll('videos')}
                  accessibilityRole="button"
                >
                  <Text style={styles.seeAllText}>
                    {t('savedDashboard.seeAll')} ({data.videos_count}) →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Specialists */}
          {data.specialists_count > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('savedDashboard.sectionSpecialists')}</Text>
                <Text style={styles.sectionCount}>{data.specialists_count}</Text>
              </View>
              {data.specialists.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.full_name}, ${s.specialty ?? ''}`}
                  onPress={() => goToTab('Experts', 'Favorites')}
                >
                  <View style={styles.avatar}>
                    {s.photo_url ? (
                      <Image source={{ uri: s.photo_url }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>{s.full_name?.[0] ?? '?'}</Text>
                    )}
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{s.full_name}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {[s.specialty, [s.city, s.state].filter(Boolean).join(', ')].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {data.specialists_count > data.specialists.length && (
                <TouchableOpacity style={styles.seeAll} onPress={() => onSeeAll('specialists')} accessibilityRole="button">
                  <Text style={styles.seeAllText}>{t('savedDashboard.seeAll')} ({data.specialists_count}) →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Donors */}
          {data.donors_count > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('savedDashboard.sectionDonors')}</Text>
                <Text style={styles.sectionCount}>{data.donors_count}</Text>
              </View>
              {data.donors.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={d.display_name}
                  onPress={() => goToTab('Milk', 'SavedDonors')}
                >
                  <View style={styles.avatar}>
                    {d.avatar_url ? (
                      <Image source={{ uri: d.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>{d.display_name?.[0] ?? '?'}</Text>
                    )}
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{d.display_name}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {[d.city, d.state].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {data.donors_count > data.donors.length && (
                <TouchableOpacity style={styles.seeAll} onPress={() => onSeeAll('donors')} accessibilityRole="button">
                  <Text style={styles.seeAllText}>{t('savedDashboard.seeAll')} ({data.donors_count}) →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Gear */}
          {data.gear_count > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('savedDashboard.sectionGear')}</Text>
                <Text style={styles.sectionCount}>{data.gear_count}</Text>
              </View>
              {data.gear.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={g.title}
                  onPress={() => goToTab('Gear', 'SavedGear')}
                >
                  <View style={styles.gearCover}>
                    {g.cover_image_url ? (
                      <Image source={{ uri: g.cover_image_url }} style={styles.gearCoverImg} />
                    ) : null}
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{g.title}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {formatPrice(g.price_cents, g.is_free)}
                      {g.condition ? `  ·  ${g.condition}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {data.gear_count > data.gear.length && (
                <TouchableOpacity style={styles.seeAll} onPress={() => onSeeAll('gear')} accessibilityRole="button">
                  <Text style={styles.seeAllText}>{t('savedDashboard.seeAll')} ({data.gear_count}) →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Footer hint when only 1-2 sections populated */}
          <Text style={styles.footerHint}>{t('savedDashboard.footerHint')}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  back: { fontSize: 14, color: COLORS.coco, fontFamily: FONTS.bodySemiBold, width: 60 },
  headerTitle: { fontSize: 18, color: COLORS.bark, fontFamily: FONTS.headerBold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 52, color: '#C07840', marginBottom: 12 },
  emptyTitle: {
    fontSize: 20, fontFamily: FONTS.headerBold, color: COLORS.bark,
    textAlign: 'center', marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.barkSoft,
    textAlign: 'center', lineHeight: 21,
  },

  list: { padding: 16, paddingBottom: 40 },

  section: {
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#C07840',
    backgroundColor: 'rgba(192,120,64,0.10)',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, minWidth: 26, textAlign: 'center',
  },

  // Video row — distinctive 16:9 thumbnail vs the avatar pattern for the
  // other types
  videoRow: {
    flexDirection: 'row', gap: 12, marginBottom: 10,
  },
  videoThumb: {
    position: 'relative',
    width: 100, height: 60, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  videoThumbImg: { width: '100%', height: '100%' },
  videoDur: {
    position: 'absolute', right: 4, bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  videoDurText: { color: COLORS.paper, fontSize: 10, fontFamily: FONTS.bodySemiBold },
  videoMeta: { flex: 1, justifyContent: 'center' },
  videoTitle: {
    fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, lineHeight: 18,
    marginBottom: 3,
  },
  videoEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#A77349',
    letterSpacing: 1.0,
  },

  // Generic avatar + meta row used for specialists + donors
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    backgroundColor: COLORS.v2_parchment,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 18, fontFamily: FONTS.headerBold, color: COLORS.bark },
  rowMeta: { flex: 1 },
  rowTitle: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 2 },
  rowSub: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.barkSoft },

  // Gear cover sits between video (16:9) and avatar (round) — square with
  // small radius to read as "product"
  gearCover: {
    width: 56, height: 56, borderRadius: 8, overflow: 'hidden',
    backgroundColor: COLORS.v2_parchment,
  },
  gearCoverImg: { width: '100%', height: '100%' },

  seeAll: {
    paddingVertical: 8,
    marginTop: 4,
  },
  seeAllText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#C07840',
  },

  footerHint: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.barkSoft,
    textAlign: 'center', marginTop: 18, paddingHorizontal: 24, lineHeight: 18,
  },
});
