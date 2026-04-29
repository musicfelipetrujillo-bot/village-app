// Inbox tab — unified messages surface aggregating Milk + Gear threads.
// (Specialist messaging is per-specialist 1:1 — we surface the entry point
// to the specialist directory rather than listing them, until a
// list_my_specialist_threads RPC ships.)
//
// Each thread row carries a type badge (milk | gear) and routes back into
// the per-vertical thread detail screen via the matching tab navigator.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { listMyMilkThreads, type MilkThreadRow } from '@api/milk';
import { listMyGearThreads, type GearThreadRow } from '@api/gear';

type UnifiedRow =
  | { kind: 'milk'; row: MilkThreadRow; sortKey: number }
  | { kind: 'gear'; row: GearThreadRow; sortKey: number };

function rowSortKey(iso?: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

function relTime(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

export default function InboxHomeScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const userId = useUserStore((s) => s.profile?.id);
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [milk, gear] = await Promise.all([
        listMyMilkThreads(userId).catch(() => [] as MilkThreadRow[]),
        listMyGearThreads().catch(() => [] as GearThreadRow[]),
      ]);
      const unified: UnifiedRow[] = [
        ...milk.map<UnifiedRow>((r) => ({
          kind: 'milk', row: r, sortKey: rowSortKey(r.last_message_at),
        })),
        ...gear.map<UnifiedRow>((r) => ({
          kind: 'gear', row: r, sortKey: rowSortKey(r.last_message_at),
        })),
      ].sort((a, b) => b.sortKey - a.sortKey);
      setRows(unified);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // The vertical detail screens require more than threadId — Milk needs the
  // donor profile id + display name, Gear needs the listing/other-side
  // metadata. The unified row carries all of them, so forward the full set;
  // missing params previously caused the detail screens to render blank.
  const openThread = useCallback((item: UnifiedRow) => {
    const tabParent = navigation.getParent();
    if (item.kind === 'milk') {
      tabParent?.navigate('Milk', {
        screen: 'MilkMessageDetail',
        params: {
          threadId: item.row.thread_id,
          donorProfileId: item.row.donor_profile_id,
          otherDisplayName: item.row.other_display_name,
        },
      });
    } else {
      tabParent?.navigate('Gear', {
        screen: 'GearMessageDetail',
        params: {
          threadId: item.row.thread_id,
          listingId: item.row.listing_id,
          listingTitle: item.row.listing_title,
          otherDisplayName: item.row.other_display_name,
          isSellerSide: item.row.is_seller_side,
        },
      });
    }
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: UnifiedRow }) => {
    const isMilk = item.kind === 'milk';
    const title = isMilk
      ? (item.row.other_display_name ?? t('inbox.milkPartner'))
      : (item.row.listing_title ?? t('inbox.gearListing'));
    const preview = item.row.last_message_body ?? t('inbox.noMessages');
    const unread = item.row.unread_count ?? 0;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openThread(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${title} — ${preview}`}
      >
        <View style={[styles.avatar, { backgroundColor: isMilk ? COLORS.yolkLight : COLORS.lime }]}>
          <Text style={styles.avatarEmoji}>{isMilk ? '🤱' : '🛒'}</Text>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.rowTime}>{relTime(item.row.last_message_at)}</Text>
          </View>
          <View style={styles.rowMeta}>
            <Text style={[styles.rowBadge, { backgroundColor: isMilk ? COLORS.blush : COLORS.yolkLight }]}>
              {isMilk ? t('inbox.badgeMilk') : t('inbox.badgeGear')}
            </Text>
            <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
          </View>
        </View>
        {unread > 0 ? (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{unread > 9 ? '9+' : String(unread)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [openThread, t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('inbox.eyebrow')}</Text>
        <Text style={styles.title}>{t('inbox.title')}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.diner} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.kind}:${r.row.thread_id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.diner} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>{t('inbox.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('inbox.emptyBody')}</Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.getParent()?.navigate('Village')}
                accessibilityRole="button"
                accessibilityLabel={t('inbox.emptyCta')}
              >
                <Text style={styles.emptyCtaText}>{t('inbox.emptyCta')} →</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ceramic },
  header: { paddingTop: 64, paddingBottom: 16, paddingHorizontal: 20 },
  eyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.diner,
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8,
  },
  title: {
    fontSize: 36, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    lineHeight: 42,
  },

  list: { paddingHorizontal: 20, paddingBottom: 96 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.paper,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
    marginBottom: 10,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowTopLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginBottom: 4,
  },
  rowTitle: {
    flex: 1, fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep,
  },
  rowTime: {
    fontSize: 11, fontFamily: FONTS.body, color: COLORS.textLight,
    marginLeft: 8,
  },
  rowMeta: { flexDirection: 'row', alignItems: 'center' },
  rowBadge: {
    fontSize: 9, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep,
    letterSpacing: 0.8, textTransform: 'uppercase',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    marginRight: 8,
    overflow: 'hidden',
  },
  rowPreview: {
    flex: 1, fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMid,
  },
  unreadDot: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.diner,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadDotText: {
    fontSize: 11, fontFamily: FONTS.bodyBold, color: COLORS.paper,
  },

  empty: {
    backgroundColor: COLORS.paper,
    borderRadius: 20, padding: 32,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
    alignItems: 'center', marginTop: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    marginBottom: 8, textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 19, textAlign: 'center', marginBottom: 18,
  },
  emptyCta: {
    backgroundColor: COLORS.diner,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999,
  },
  emptyCtaText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.paper,
  },
});
