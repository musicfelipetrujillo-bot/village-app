// Inbox tab — unified messages surface aggregating Milk + Gear threads.
// (Specialist messaging is per-specialist 1:1 — we surface the entry point
// to the specialist directory rather than listing them, until a
// list_my_specialist_threads RPC ships.)
//
// Each thread row carries a type chip (milk | gear) and routes back into
// the per-vertical thread detail screen via the matching tab navigator.
//
// Phase D-2 (2026-05-24) — rebuilt to the v3 brand kit lean editorial
// recipe used by HomeScreenV3 / ManualScrollV3 / VillageHomeScreenV3:
// WarmGlowBackdrop + bees, eyebrow + Plus Jakarta display title with
// salmon italic accent, V3Card-lifted thread rows + chapter-style chip
// instead of the v9 emoji-avatar tile row. The previous bespoke animated
// bee + golden masthead is replaced by the shared atmospheric layer for
// consistency with the rest of the v3 hubs.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { listMyMilkThreads, type MilkThreadRow } from '@api/milk';
import { listMyGearThreads, type GearThreadRow } from '@api/gear';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { V3Card } from '@components/shared/V3Card';

// ─── Tokens ────────────────────────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,
  cream:     COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  card:      COLORS.v2_card,
  butter:    COLORS.v2_butter,
  marigold:  COLORS.v2_marigold,
  caramel:   COLORS.v2_caramel,
  cinnamon:  COLORS.v2_cinnamon,
  blush:     COLORS.v2_blush,
  salmon:    COLORS.v2_salmon,
  sage:      COLORS.v2_sage,
  cocoa:     COLORS.v2_cocoa,
  walnut:    COLORS.v2_walnut,
  amber:     COLORS.v2_amber,
  rule:      'rgba(61,31,14,0.13)',
};

// Chapter-style chip palette per kind — milk reads in soft blush, gear
// in warm caramel. Stays inside the v3 chapter color family so the
// Inbox aesthetic threads back to Manual / Village.
const KIND_CHIP: Record<'milk' | 'gear', { bg: string; fg: string }> = {
  milk: { bg: T.blush, fg: T.cocoa },
  gear: { bg: T.caramel, fg: T.cocoa },
};

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

// ─── Atoms ─────────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 }} />
      <Text style={{
        fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
        textTransform: 'uppercase', fontWeight: '500', color: T.walnut,
      }}>{children}</Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────
export default function InboxHomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
  // metadata. The unified row carries all of them, so forward the full set.
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
    const chip = KIND_CHIP[isMilk ? 'milk' : 'gear'];

    return (
      <View style={styles.rowWrap}>
        {/* deepShadow bumped 2026-05-25 — standard shadow read flat
            against the Inbox warm wash; deep recipe lifts thread rows
            distinctly. Matches MeScreen card bump same session. */}
        <V3Card deepShadow pressable={() => openThread(item)} contentStyle={styles.rowInner}>
          <View style={styles.rowTopLine}>
            <View style={[styles.kindChip, { backgroundColor: chip.bg }]}>
              <Text style={[styles.kindChipText, { color: chip.fg }]}>
                {isMilk ? t('inbox.badgeMilk') : t('inbox.badgeGear')}
              </Text>
            </View>
            <Text style={styles.rowTime}>{relTime(item.row.last_message_at)}</Text>
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.rowPreview} numberOfLines={2}>{preview}</Text>
          {unread > 0 ? (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>{unread > 9 ? '9+' : String(unread)}</Text>
            </View>
          ) : null}
        </V3Card>
      </View>
    );
  }, [openThread, t]);

  // Editorial masthead — eyebrow + bigTitle with salmon italic accent
  // + subtitle + hairline rule. Rendered as the FlatList header so the
  // bee + warm wash sit behind everything and the list scrolls under
  // the masthead naturally.
  const ListHeader = (
    <View style={[styles.masthead, { paddingTop: insets.top + 10 }]}>
      <Eyebrow>{t('inbox.eyebrow')}</Eyebrow>
      <Text style={styles.bigTitle}>
        {t('inbox.title')}<Text style={styles.bigTitleItalic}>.</Text>
      </Text>
      <Text style={styles.subtitle}>{t('inbox.subtitle')}</Text>
      <View style={styles.headerRule} />
    </View>
  );

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.cinnamon} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.kind}:${r.row.thread_id}`}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.cinnamon}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <V3Card deepShadow contentStyle={styles.emptyInner}>
                <Eyebrow>{t('inbox.eyebrow')}</Eyebrow>
                <Text style={styles.emptyTitle}>
                  {t('inbox.emptyTitle')}
                </Text>
                <Text style={styles.emptyBody}>{t('inbox.emptyBody')}</Text>
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => navigation.getParent()?.navigate('Village')}
                  accessibilityRole="button"
                  accessibilityLabel={t('inbox.emptyCta')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyCtaText}>{t('inbox.emptyCta')} →</Text>
                </TouchableOpacity>
              </V3Card>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },

  // Editorial masthead — matches HomeScreenV3 / ManualScrollV3 / Village
  // pattern: 56pt top inset, 22px horizontal, eyebrow → big title → soft
  // body italic subtitle → hairline rule.
  masthead: {
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 18,
  },
  bigTitle: {
    fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 32,
    color: T.cocoa, letterSpacing: -0.9, marginTop: 6,
  },
  bigTitleItalic: {
    fontFamily: FONTS.v3_display_italic, color: T.salmon,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: T.walnut, fontStyle: 'italic', maxWidth: 320,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.rule,
    marginTop: 16,
    width: 48,
  },

  // List
  list: { paddingHorizontal: 22, paddingBottom: 96 },
  rowWrap: { marginBottom: 12 },
  rowInner: {
    paddingHorizontal: 18, paddingVertical: 16,
    position: 'relative',
  },
  rowTopLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  kindChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3,
  },
  kindChipText: {
    fontFamily: FONTS.v2_mono, fontSize: 10,
    letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: '700',
  },
  rowTime: {
    fontFamily: FONTS.v2_mono, fontSize: 11, color: T.amber,
    letterSpacing: 0.4,
  },
  rowTitle: {
    fontFamily: FONTS.v3_display, fontSize: 19, lineHeight: 22,
    color: T.cocoa, letterSpacing: -0.4, marginBottom: 6,
  },
  rowPreview: {
    fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 19,
    color: T.walnut,
  },
  unreadDot: {
    position: 'absolute', top: 14, right: 14,
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: T.cinnamon,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadDotText: {
    fontSize: 11, fontFamily: FONTS.v2_bold, color: T.paper,
  },

  // Empty state — single V3Card with eyebrow + Playfair italic title +
  // body + cinnamon CTA. Stays inside the same lean editorial voice as
  // the rest of the v3 hubs (no emoji crutch).
  emptyWrap: { marginTop: 8 },
  emptyInner: {
    padding: 22, alignItems: 'flex-start',
  },
  emptyTitle: {
    marginTop: 10,
    fontFamily: FONTS.v3_display, fontSize: 24, lineHeight: 28,
    color: T.cocoa, letterSpacing: -0.6,
  },
  emptyBody: {
    marginTop: 10, marginBottom: 18,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: T.walnut,
  },
  emptyCta: {
    backgroundColor: T.cinnamon,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    shadowColor: T.cocoa, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 2,
  },
  emptyCtaText: {
    fontFamily: FONTS.v2_bold, fontSize: 13, color: T.paper,
    letterSpacing: 0.4,
  },
});
