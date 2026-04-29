// V4 Phase G4 — My listings (seller-facing listing management).
import React, { useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useGearStore } from '@store/gear';
import {
  gearApi,
  categoryLabel,
  formatPrice,
  type MyListingRow,
  type GearStatus,
} from '@api/gear';

type TFn = (key: string, params?: Record<string, string | number>) => string;

const STATUS_COLORS: Record<GearStatus, { bg: string; fg: string; i18nKey: string }> = {
  active:    { bg: 'rgba(92,107,58,0.15)', fg: COLORS.olive,    i18nKey: 'myListings.statusActive' },
  pending:   { bg: 'rgba(196,163,90,0.2)', fg: COLORS.gold,     i18nKey: 'myListings.statusPending' },
  sold:      { bg: 'rgba(0,0,0,0.06)',     fg: COLORS.textMid,  i18nKey: 'myListings.statusSold' },
  withdrawn: { bg: 'rgba(0,0,0,0.06)',     fg: COLORS.textMid,  i18nKey: 'myListings.statusWithdrawn' },
  removed:   { bg: 'rgba(184,92,56,0.12)', fg: COLORS.rustDark, i18nKey: 'myListings.statusRemoved' },
};

export default function MyListingsScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { myListings, fetchMyListings } = useGearStore();
  const [loading, setLoading] = React.useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { await fetchMyListings(); } finally { setLoading(false); }
  }, [fetchMyListings]);

  useEffect(() => { load(); }, [load]);

  const markSold = (id: string) => {
    Alert.alert(t('myListings.markSoldTitle'), t('myListings.markSoldBody'), [
      { text: t('myListings.cancel'), style: 'cancel' },
      { text: t('myListings.actionMarkSold'), onPress: async () => {
        try {
          await gearApi.updateStatus(id, 'sold');
          await fetchMyListings();
        } catch (err: any) {
          Alert.alert(t('myListings.errorTitle'), err?.message ?? t('myListings.errorBody'));
        }
      } },
    ]);
  };

  const withdraw = (id: string) => {
    Alert.alert(t('myListings.withdrawTitle'), t('myListings.withdrawBody'), [
      { text: t('myListings.cancel'), style: 'cancel' },
      { text: t('myListings.actionWithdraw'), style: 'destructive', onPress: async () => {
        try {
          await gearApi.updateStatus(id, 'withdrawn');
          await fetchMyListings();
        } catch (err: any) {
          Alert.alert(t('myListings.errorTitle'), err?.message ?? t('myListings.errorBody'));
        }
      } },
    ]);
  };

  const reactivate = async (id: string) => {
    try {
      await gearApi.updateStatus(id, 'active');
      await fetchMyListings();
    } catch (err: any) {
      Alert.alert(t('myListings.errorTitle'), err?.message ?? t('myListings.errorBody'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('myListings.backA11y')}>
          <Text style={styles.back}>{t('myListings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myListings.title')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateListing')} accessibilityLabel={t('myListings.newA11y')}>
          <Text style={styles.headerLink}>{t('myListings.newLink')}</Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={myListings}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <Row
            row={item}
            t={t}
            onOpen={() => navigation.navigate('GearListingDetail', { id: item.id })}
            onMarkSold={() => markSold(item.id)}
            onWithdraw={() => withdraw(item.id)}
            onReactivate={() => reactivate(item.id)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={COLORS.rust} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{t('myListings.emptyEmoji')}</Text>
              <Text style={styles.emptyTitle}>{t('myListings.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('myListings.emptyBody')}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateListing')}
                accessibilityRole="button"
                accessibilityLabel={t('myListings.emptyCtaA11y')}
              >
                <Text style={styles.emptyBtnText}>{t('myListings.emptyCta')}</Text>
              </TouchableOpacity>
            </View>
          )
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.rust} />}
      />
    </View>
  );
}

function Row({
  row, t, onOpen, onMarkSold, onWithdraw, onReactivate,
}: {
  row: MyListingRow;
  t: TFn;
  onOpen: () => void;
  onMarkSold: () => void;
  onWithdraw: () => void;
  onReactivate: () => void;
}) {
  const sc = STATUS_COLORS[row.status];
  const statusLabel = t(sc.i18nKey);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('myListings.rowA11y', { title: row.title, status: statusLabel })}
    >
      {row.cover_image_url ? (
        <Image source={{ uri: row.cover_image_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={styles.thumbFallbackText}>—</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.cat}>{categoryLabel(row.category).toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={2}>{row.title}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.statusPill, { backgroundColor: sc.bg, color: sc.fg }]}>{statusLabel}</Text>
          <Text style={styles.price}>
            {formatPrice(row.price_cents, row.is_free, row.currency)}
          </Text>
        </View>
        <Text style={styles.stats}>{t('myListings.stats', { views: row.view_count, saves: row.save_count })}</Text>
        <View style={styles.actions}>
          {row.status === 'active' && (
            <>
              <TouchableOpacity
                onPress={onMarkSold}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={t('myListings.actionMarkSoldA11y')}
              >
                <Text style={styles.actionBtnText}>{t('myListings.actionMarkSold')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onWithdraw}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={t('myListings.actionWithdrawA11y')}
              >
                <Text style={styles.actionBtnText}>{t('myListings.actionWithdraw')}</Text>
              </TouchableOpacity>
            </>
          )}
          {row.status === 'withdrawn' && (
            <TouchableOpacity
              onPress={onReactivate}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={t('myListings.actionReactivateA11y')}
            >
              <Text style={styles.actionBtnText}>{t('myListings.actionReactivate')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },
  headerLink: { fontSize: 14, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, textAlign: 'center' },
  emptyBody: {
    fontSize: 14, color: COLORS.textMid, textAlign: 'center', lineHeight: 21, marginBottom: 8, fontFamily: FONTS.body,
  },
  emptyBtn: {
    marginTop: 8, backgroundColor: COLORS.rust, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontFamily: FONTS.bodySemiBold },

  card: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14,
    padding: 10, gap: 12, marginBottom: 12,
  },
  thumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: COLORS.cream },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbFallbackText: { color: COLORS.textLight, fontSize: 16, fontFamily: FONTS.body },

  body: { flex: 1 },
  cat: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.olive },
  title: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  statusPill: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
    overflow: 'hidden',
  },
  price: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark },
  stats: { fontSize: 11, color: COLORS.textLight, marginTop: 4, fontFamily: FONTS.body },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    backgroundColor: COLORS.cream, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark },
});
