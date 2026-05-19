// Inbox tab — unified messages surface aggregating Milk + Gear threads.
// (Specialist messaging is per-specialist 1:1 — we surface the entry point
// to the specialist directory rather than listing them, until a
// list_my_specialist_threads RPC ships.)
//
// Each thread row carries a type badge (milk | gear) and routes back into
// the per-vertical thread detail screen via the matching tab navigator.
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { listMyMilkThreads, type MilkThreadRow } from '@api/milk';
import { listMyGearThreads, type GearThreadRow } from '@api/gear';

const _BEE_N = 60;
const _BEE_INPUT = Array.from({ length: _BEE_N + 1 }, (_, i) => i / _BEE_N);
// Village/Inbox use a deeper bob than Manual/Me: 3.5 cycles + 36px amplitude
// so the bee's flight reads as a more obvious zig-zag, not a glide.
const _BEE_SINE_Y = _BEE_INPUT.map(
  t => (1 - t) * (60 - Math.sin(t * Math.PI * 3.5) * 36)
);
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// AsyncStorage key — gates the FIRST focus per app session so the bee
// doesn't auto-replay on every cold launch the same day. In-session
// tab refocus still replays the bee.
const BEE_LAST_PLAYED_KEY = 'village.beeLastPlayedDate.v1';

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

  const beeAnim    = useRef(new Animated.Value(0)).current;
  const beeRandX   = useRef(new Animated.Value(0)).current;
  const beeRandY   = useRef(new Animated.Value(0)).current;
  // First-focus-of-session ref — see VillageHomeScreen / ManualHomeScreen
  // for the rationale. Daily gate on first focus, replay on every
  // subsequent leave+return.
  const firstFocusRef = useRef(true);
  const beeBaseX   = useRef(beeAnim.interpolate({ inputRange: [0, 1], outputRange: [-300, 0] })).current;
  const beeBaseY   = useRef(beeAnim.interpolate({ inputRange: _BEE_INPUT, outputRange: _BEE_SINE_Y })).current;
  const beeFade    = useRef(beeAnim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, 1] })).current;
  const beeTranslateX = useRef(Animated.add(beeBaseX, Animated.multiply(beeRandX, beeFade))).current;
  const beeTranslateY = useRef(Animated.add(beeBaseY, Animated.multiply(beeRandY, beeFade))).current;

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

  useFocusEffect(useCallback(() => {
    load();
    let cancelled = false;
    (async () => {
      const isFirst = firstFocusRef.current;
      firstFocusRef.current = false;
      if (isFirst) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const last = await AsyncStorage.getItem(BEE_LAST_PLAYED_KEY);
          if (last === today) return;
          await AsyncStorage.setItem(BEE_LAST_PLAYED_KEY, today);
        } catch {
          // storage error → fall through and play
        }
      }
      if (cancelled) return;
      beeRandX.setValue((Math.random() - 0.5) * 24);
      beeRandY.setValue((Math.random() - 0.5) * 16);
      beeAnim.setValue(0);
      Animated.timing(beeAnim, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }).start();
    })();
    return () => { cancelled = true; };
  }, [load, beeAnim, beeRandX, beeRandY]));

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
        <View style={[styles.avatar, { backgroundColor: isMilk ? COLORS.sandSoft : COLORS.sage }]}>
          <Text style={styles.avatarEmoji}>{isMilk ? '🤱' : '🛒'}</Text>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.rowTime}>{relTime(item.row.last_message_at)}</Text>
          </View>
          <View style={styles.rowMeta}>
            <Text style={[styles.rowBadge, { backgroundColor: isMilk ? COLORS.pink : COLORS.sandSoft }]}>
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
      {/* v9 paper wash — paper-white middle, warm pink at top + bottom.
          Matches Home / Manual / Me / Auth so every tab reads as the
          same paper page. */}
      <LinearGradient
        colors={[
          '#FDF1EB', '#FDF8F4', '#FCFCFB',
          '#FCFCFB', '#FCF6EF', '#F9E9DD', '#F5DFD3',
        ]}
        locations={[0, 0.12, 0.30, 0.62, 0.76, 0.90, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Editorial header — soft full-bleed pastel cover card. Pale caramel
          wash keeps Inbox's warmth dialled back; bark text + coco italic
          accent + hairline rule carry HomeScreen's editorial vibe. */}
      <View style={styles.header}>
        {/* v9 paper-leaning masthead — softer cream→blush than the
            old golden wash. Matches every other v9 hub. */}
        <LinearGradient
          colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* iOS-26 wet-glass top sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18 }}
          pointerEvents="none"
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: 'rgba(255,255,255,0.7)',
          }}
        />
        <Animated.Image source={VILLIE_BEE} resizeMode="contain"
          accessible={false}
          style={[styles.headerBee, { transform: [{ translateX: beeTranslateX }, { translateY: beeTranslateY }, { rotate: '12deg' }] }]} />
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrow}>{t('inbox.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('inbox.title')}</Text>
        <Text style={styles.subtitle}>{t('inbox.subtitle')}</Text>
        <View style={styles.headerRule} />
      </View>
      {loading ? (
        <ActivityIndicator color="#C07840" style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.kind}:${r.row.thread_id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coco} />}
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
  container: { flex: 1, backgroundColor: COLORS.cream },
  // Soft full-bleed cover card — header already spans full screen width.
  // Curved bottom + low shadow; pale caramel gradient gives identity wash
  // without dominating. paddingBottom is tight so the hairline rule sits
  // right at the card's bottom edge — the rule IS the visual close.
  header: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 6,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#6A3820',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
    position: 'relative',
  },
  headerBee: {
    position: 'absolute',
    right: 8, top: 64,
    width: 88, height: 80,
    opacity: 0.55,
    transform: [{ rotate: '12deg' }],
  },
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  eyebrowBar: {
    width: 22, height: 2,
    backgroundColor: '#A77349',  // v9 rust-deep — unified across hubs
    marginRight: 10,
  },
  eyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold,
    color: '#A77349',
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  title: {
    fontSize: 32, fontFamily: FONTS.headerBold,
    color: COLORS.bark, lineHeight: 38, letterSpacing: -0.5, marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, fontFamily: FONTS.body,
    fontStyle: 'italic', color: COLORS.barkSoft, lineHeight: 20,
  },
  // Hairline rule — matches HomeScreen.greetingRule.
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 14,
    width: 48,
  },

  list: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 96 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.paper,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.sandSoft,
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
    flex: 1, fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
  },
  rowTime: {
    fontSize: 11, fontFamily: FONTS.body, color: COLORS.textLight,
    marginLeft: 8,
  },
  rowMeta: { flexDirection: 'row', alignItems: 'center' },
  rowBadge: {
    fontSize: 9, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    letterSpacing: 0.8, textTransform: 'uppercase',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    marginRight: 8,
    overflow: 'hidden',
  },
  rowPreview: {
    flex: 1, fontSize: 12, fontFamily: FONTS.body, color: COLORS.barkSoft,
  },
  unreadDot: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.coco,
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
    borderWidth: 1, borderColor: COLORS.sandSoft,
    alignItems: 'center', marginTop: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18, fontFamily: FONTS.headerBold, color: COLORS.bark,
    marginBottom: 8, textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 19, textAlign: 'center', marginBottom: 18,
  },
  emptyCta: {
    backgroundColor: '#C07840',
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999,
  },
  emptyCtaText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.paper,
  },
});
