// V2 M4 — MilkOrdersScreen
// Recipient's order history. Shows status pill + "Leave Review" CTA where applicable.
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { listMyOrders, listReviewableOrders, type MyOrderRow } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkOrders'>;

const STATUS_COLOR: Record<string, string> = {
  pending:    '#7A4A24',
  paid:       '#E98A6A',
  fulfilled:  COLORS.statusSuccess,
  disputed:   COLORS.statusAlert,
  refunded:   '#7A4A24',
  cancelled:  '#7A4A24',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending:    'milkOrders.statusPending',
  paid:       'milkOrders.statusPaid',
  fulfilled:  'milkOrders.statusFulfilled',
  disputed:   'milkOrders.statusDisputed',
  refunded:   'milkOrders.statusRefunded',
  cancelled:  'milkOrders.statusCancelled',
};

export default function MilkOrdersScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en');
  const t = useT();
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [reviewableIds, setReviewableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [list, reviewable] = await Promise.all([
        listMyOrders(user.id),
        listReviewableOrders(user.id),
      ]);
      setOrders(list);
      setReviewableIds(new Set(reviewable.map((r) => r.transaction_id)));
    } catch (e) { console.error(e); }
  }, [user]);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

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
        colors={['rgba(247,197,203,0.36)', 'rgba(247,197,203,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('milkOrders.back')}
        >
          <Text style={styles.back}>{t('milkOrders.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('milkOrders.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#D96C88" /></View>
      ) : (
        <FlashList
          data={orders}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coco} />}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const canReview = reviewableIds.has(item.id);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  {item.donor_avatar_url ? (
                    <Image source={{ uri: item.donor_avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>
                        {item.donor_display_name?.[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.donorName}>{item.donor_display_name}</Text>
                    <Text style={styles.meta}>
                      {t('milkOrders.metaLine', {
                        oz: item.oz_purchased,
                        method: item.fulfillment_method === 'pickup'
                          ? t('milkOrders.fulfillmentPickup')
                          : t('milkOrders.fulfillmentShipping'),
                      })}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(item.created_at).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[item.status] ?? '#7A4A24' }]}>
                      <Text style={styles.statusText}>
                        {STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}
                      </Text>
                    </View>
                    <Text style={styles.amount}>${(item.total_charged_cents / 100).toFixed(2)}</Text>
                  </View>
                </View>
                {canReview && (
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    onPress={() => navigation.navigate('MilkReviewSubmit', {
                      transactionId: item.id,
                      donorProfileId: item.donor_profile_id,
                      donorDisplayName: item.donor_display_name,
                    })}
                    accessibilityLabel={t('milkOrders.leaveReviewA11y')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reviewBtnText}>{t('milkOrders.leaveReview')}</Text>
                  </TouchableOpacity>
                )}
                {['paid', 'fulfilled', 'disputed'].includes(item.status) && (
                  <TouchableOpacity
                    style={styles.disputeBtn}
                    onPress={() => navigation.navigate('MilkDisputeOpen', {
                      transactionId: item.id,
                      role: 'recipient',
                      donorDisplayName: item.donor_display_name,
                    })}
                    accessibilityLabel={t('milkOrders.reportIssueA11y')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.disputeBtnText}>
                      {item.status === 'disputed' ? t('milkOrders.viewReport') : t('milkOrders.reportIssue')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>{t('milkOrders.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('milkOrders.emptyBody')}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('DonorSearchList')}
                accessibilityRole="button"
                accessibilityLabel={t('milkOrders.emptyCtaA11y')}
              >
                <Text style={styles.emptyBtnText}>{t('milkOrders.emptyCta')}</Text>
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
  back: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodyMedium },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#43260F' },

  card: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 5,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: COLORS.coco, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFCF6', fontSize: 20, fontFamily: FONTS.bodySemiBold },
  donorName: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#43260F' },
  meta: { fontSize: 12, color: '#7A4A24', marginTop: 2 },
  date: { fontSize: 11, color: '#7A4A24', marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { color: '#FFFCF6', fontSize: 10, fontFamily: FONTS.bodySemiBold, textTransform: 'uppercase' },
  amount: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },

  reviewBtn: {
    marginTop: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.pinkSoft, borderWidth: 1.5, borderColor: COLORS.coco,
    alignItems: 'center',
  },
  reviewBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },
  disputeBtn: {
    marginTop: 8, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)', alignItems: 'center',
  },
  disputeBtnText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#7A4A24' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: '#43260F', textAlign: 'center' },
  emptyBody: {
    fontSize: 14, color: '#7A4A24', textAlign: 'center', lineHeight: 21, marginBottom: 8,
  },
  emptyBtn: {
    marginTop: 8, backgroundColor: '#D96C88', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { color: '#FFFCF6', fontSize: 15, fontFamily: FONTS.bodySemiBold },
});
