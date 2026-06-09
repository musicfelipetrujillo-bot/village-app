// SavedManualScreen — the user's bookmarked Manual videos (migration 065).
//
// Reachable from the ManualHome header. Renders rows from list_my_saved_manual
// newest-saved first, with tap → ManualVideoScreen using the bucket info
// returned in each row (audience + category) so we don't need a separate
// per-id RPC. Empty state mirrors the gear/specialist "nothing saved" pattern.
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import {
  listMySavedManual,
  formatDuration,
  type SavedManualVideo,
} from '@/api/manual';

export default function SavedManualScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';

  const [videos, setVideos] = useState<SavedManualVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Refetch every time the screen comes into focus so unsaves from the
  // video screen drop the row immediately on return.
  const load = useCallback(async () => {
    try {
      const rows = await listMySavedManual(lang);
      setVideos(rows);
    } catch (e) {
      console.error('saved manual load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

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
        <Text style={styles.headerTitle}>{t('savedManual.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading && (
        <View style={styles.center}><ActivityIndicator color="#D96C88" /></View>
      )}

      {!loading && videos.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={styles.emptyTitle}>{t('savedManual.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('savedManual.emptyBody')}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ManualHome')}
            style={styles.emptyCta}
            accessibilityRole="button"
            accessibilityLabel={t('savedManual.emptyCta')}
          >
            <Text style={styles.emptyCtaText}>{t('savedManual.emptyCta')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && videos.length > 0 && (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D96C88" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${formatDuration(item.duration_seconds)}`}
              onPress={() =>
                navigation.navigate('ManualVideo', {
                  audience: item.audience,
                  category: item.category,
                  videoId:  item.id,
                })
              }
            >
              <View style={styles.thumbWrap}>
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]} />
                )}
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{formatDuration(item.duration_seconds)}</Text>
                </View>
                {item.is_watched && (
                  <View style={styles.watchedTag}>
                    <Text style={styles.watchedText}>{t('savedManual.watched')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowEyebrow}>
                  {t(item.audience === 'mom' ? 'savedManual.audMom' : 'savedManual.audBaby')}
                  {'  ·  '}
                  {item.category.toUpperCase()}
                </Text>
                <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.rowDesc} numberOfLines={2}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
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
  emptyIcon: { fontSize: 52, color: '#D96C88', marginBottom: 12 },
  emptyTitle: {
    fontSize: 20, fontFamily: FONTS.headerBold, color: COLORS.bark,
    textAlign: 'center', marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.barkSoft,
    textAlign: 'center', lineHeight: 21, marginBottom: 20,
  },
  emptyCta: {
    backgroundColor: '#D96C88', borderRadius: 999,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyCtaText: { color: COLORS.paper, fontSize: 14, fontFamily: FONTS.bodySemiBold },

  list: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row', gap: 12, padding: 12,
    backgroundColor: COLORS.paper,
    borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
  },
  thumbWrap: {
    position: 'relative',
    width: 120, height: 80, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { backgroundColor: COLORS.sandSoft },
  durationBadge: {
    position: 'absolute', right: 6, bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  durationText: { color: COLORS.paper, fontSize: 11, fontFamily: FONTS.bodySemiBold },
  watchedTag: {
    position: 'absolute', left: 6, top: 6,
    backgroundColor: 'rgba(96,110,70,0.92)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  watchedText: { color: COLORS.paper, fontSize: 10, fontFamily: FONTS.bodySemiBold },

  rowMeta: { flex: 1, justifyContent: 'center' },
  rowEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#7A4A24',
    letterSpacing: 1.2, marginBottom: 4,
  },
  rowTitle: {
    fontSize: 15, fontFamily: FONTS.headerBold, color: COLORS.bark,
    lineHeight: 19, marginBottom: 4,
  },
  rowDesc: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.barkSoft, lineHeight: 16 },
});
