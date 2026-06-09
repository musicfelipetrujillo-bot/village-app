// V4 Phase G6 — Gear inbox.
// Lists every thread the user is part of — buyer OR seller side. Mirrors the
// Milk M4 inbox but joins against gear_listings so each row shows the listing
// title + cover image.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '@/i18n';
import { listMyGearThreads, type GearThreadRow } from '@api/gear';
import type { GearStackParamList } from '@/navigation/GearNavigator';

type Props = NativeStackScreenProps<GearStackParamList, 'GearMessageThreads'>;
type TFn = (key: string, params?: Record<string, string | number>) => string;

function timeAgo(iso: string | null, t: TFn): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('gearInbox.timeNow');
  if (diff < 3600) return t('gearInbox.timeMinutes', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('gearInbox.timeHours', { n: Math.floor(diff / 3600) });
  if (diff < 604800) return t('gearInbox.timeDays', { n: Math.floor(diff / 86400) });
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GearMessageThreadsScreen({ navigation }: Props) {
  const t = useT();
  const [threads, setThreads] = useState<GearThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listMyGearThreads();
      setThreads(data);
    } catch (err) {
      console.error('[gearInbox] load', err);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(244,197,60,0.26)', 'rgba(244,197,60,0.08)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>{t('gearInbox.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('gearInbox.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#D96C88" /></View>
      ) : (
        <FlashList
          data={threads}
          keyExtractor={(t) => t.thread_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coco} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('GearMessageDetail', {
                threadId: item.thread_id,
                listingId: item.listing_id,
                listingTitle: item.listing_title,
                otherDisplayName: item.other_display_name,
                isSellerSide: item.is_seller_side,
              })}
              accessibilityRole="button"
            >
              {item.listing_cover_url ? (
                <Image source={{ uri: item.listing_cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Text style={styles.coverFallbackText}>📦</Text>
                </View>
              )}
              <View style={styles.middle}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.other_display_name}</Text>
                  {item.is_seller_side && <Text style={styles.sellerTag}>{t('gearInbox.tagBuyer')}</Text>}
                  {!item.is_seller_side && <Text style={styles.buyerTag}>{t('gearInbox.tagSeller')}</Text>}
                </View>
                <Text style={styles.listingTitle} numberOfLines={1}>
                  {item.listing_title}
                  {item.listing_status !== 'active' && t('gearInbox.previewSeparator', { status: item.listing_status })}
                </Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.last_message_body ?? t('gearInbox.noMessages')}
                </Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.time}>{timeAgo(item.last_message_at, t)}</Text>
                {item.unread_count > 0 && (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>{t('gearInbox.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('gearInbox.emptyBody')}
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('GearBrowse')}
                accessibilityRole="button"
              >
                <Text style={styles.browseBtnText}>{t('gearInbox.browse')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodySemiBold },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.paper,
  },
  sep: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 80 },
  cover: { width: 56, height: 56, borderRadius: 10, backgroundColor: COLORS.cream },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  coverFallbackText: { fontSize: 24 },

  middle: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, flexShrink: 1 },
  sellerTag: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#FFFCF6',
    backgroundColor: COLORS.sage,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  buyerTag: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#FFFCF6',
    backgroundColor: COLORS.coco,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  listingTitle: { fontSize: 12, color: COLORS.textLight, marginTop: 2, fontFamily: FONTS.body },
  preview: { fontSize: 13, color: COLORS.barkSoft, marginTop: 2, fontFamily: FONTS.body },

  rightCol: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.body },
  unreadDot: {
    minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10,
    backgroundColor: COLORS.coco, alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#FFFCF6', fontSize: 11, fontFamily: FONTS.bodySemiBold },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  emptyBody: { fontSize: 14, color: COLORS.barkSoft, textAlign: 'center', lineHeight: 20, fontFamily: FONTS.body },
  browseBtn: {
    marginTop: 8, backgroundColor: '#D96C88', borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 28,
  },
  browseBtnText: { fontSize: 15, color: '#FFFCF6', fontFamily: FONTS.bodySemiBold },
});
