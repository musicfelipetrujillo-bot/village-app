// Notifications inbox — destination of the Home bell. Reads from
// user_notifications_feed (G1 migration 008 + extended in G5/G7) and
// renders newest first. Tapping a row marks it read (optimistic) and
// follows its deeplink when present. Pull-to-refresh re-fetches.
//
// Empty + error states are clinician-handoff-grade per the hospital
// distribution memory — soft, no marketing voice.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { homeApi, type NotificationFeedItem } from '@api/home';
import { YolkCircle, LeafSprig } from '@components/shared/DecorativeMarks';

// Per-type emoji + color tint — keeps the inbox legible at a glance and
// matches the editorial palette used elsewhere on Home.
const TYPE_VISUAL: Record<NotificationFeedItem['type'], { emoji: string; tint: string }> = {
  milestone_alert: { emoji: '🌱', tint: COLORS.lime },
  event_reminder:  { emoji: '📅', tint: COLORS.dinerLight },
  deal_expiry:     { emoji: '🎁', tint: COLORS.yolkLight },
  gear_message:    { emoji: '📦', tint: COLORS.blush },
  daily_checkin:   { emoji: '💬', tint: COLORS.ceramicDeep },
  new_match:       { emoji: '✨', tint: COLORS.yolkLight },
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  return `${weeks}w`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await homeApi.listMyNotifications(50);
      setItems(rows);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load notifications.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handlePress = useCallback((item: NotificationFeedItem) => {
    // Optimistic mark-read so the row visually settles before the server ack.
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      homeApi.markNotificationRead(item.id).catch(() => { /* fail-soft, refresh reconciles */ });
    }
    // Deeplinks: prefer in-app Linking.openURL when the URL has a scheme; the
    // listener in RootNavigator (if linking is configured later) will route it.
    // We don't try to parse internal route paths here — that's a future
    // linking-config job. For now, http(s)/tel/sms hand off to the OS.
    if (item.deeplink) {
      Linking.openURL(item.deeplink).catch(() => { /* fail-soft */ });
    }
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Editorial corner accents — yolk wash behind the back chevron + a
            leaf sprig top-right. Two marks only so the title block reads
            cleanly. Matches the corner-accent pattern on Home / Manual. */}
        <YolkCircle size={52} top={50} left={-12} tint={COLORS.yolkLight} opacity={0.45} />
        <LeafSprig size={44} top={56} right={8} tint={COLORS.olive} />
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>{t('notifications.eyebrow')}</Text>
          <Text style={styles.title}>{t('notifications.title')}</Text>
          {unreadCount > 0 ? (
            <Text style={styles.unreadHint}>
              {unreadCount} {t('notifications.unread')}
            </Text>
          ) : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.diner} />
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>{t('notifications.errorTitle')}</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <TouchableOpacity style={styles.retryPill} onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
            <Text style={styles.retryPillText}>{t('notifications.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>{t('notifications.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('notifications.emptyBody')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.diner} />
          }
          renderItem={({ item }) => {
            const visual = TYPE_VISUAL[item.type] ?? { emoji: '•', tint: COLORS.ceramicDeep };
            return (
              <TouchableOpacity
                style={[styles.row, !item.is_read && styles.rowUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} — ${item.body}`}
                accessibilityState={{ selected: !item.is_read }}
              >
                <View style={[styles.iconBubble, { backgroundColor: visual.tint }]}>
                  <Text style={styles.iconEmoji}>{visual.emoji}</Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTopLine}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.rowAge}>{formatRelative(item.created_at)}</Text>
                  </View>
                  <Text style={styles.rowText} numberOfLines={2}>{item.body}</Text>
                </View>
                {!item.is_read ? <View style={styles.unreadDot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ceramic },

  header: {
    paddingTop: 64, paddingBottom: 18, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.ceramic,
    borderBottomWidth: 1, borderBottomColor: COLORS.ceramicDeep,
    overflow: 'hidden',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 28, color: COLORS.brownDeep, marginTop: -4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  eyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.6,
    color: COLORS.diner, textTransform: 'uppercase', marginBottom: 4,
  },
  title: {
    fontSize: 24, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
  },
  unreadHint: {
    marginTop: 4, fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMid,
    fontStyle: 'italic',
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 36, paddingBottom: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 20, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    marginBottom: 8, textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 21, textAlign: 'center',
  },
  retryPill: {
    marginTop: 18, backgroundColor: COLORS.diner,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999,
  },
  retryPillText: {
    color: COLORS.paper, fontFamily: FONTS.bodySemiBold, fontSize: 14,
  },

  listContent: { paddingVertical: 8, paddingBottom: 60 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.ceramicDeep,
    backgroundColor: COLORS.ceramic,
  },
  // Subtle paper background for unread rows so they stand out without
  // shouting — the unreadDot is the primary affordance.
  rowUnread: { backgroundColor: COLORS.paper },
  iconBubble: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: { fontSize: 18 },
  rowBody: { flex: 1 },
  rowTopLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 3,
  },
  rowTitle: {
    flex: 1, fontSize: 14, fontFamily: FONTS.bodySemiBold,
    color: COLORS.brownDeep,
  },
  rowAge: {
    fontSize: 11, fontFamily: FONTS.body, color: COLORS.textLight,
    marginLeft: 8,
  },
  rowText: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.diner,
    marginLeft: 10, marginTop: 16,
  },
});
