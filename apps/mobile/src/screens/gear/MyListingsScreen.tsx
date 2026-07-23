// V4 Phase G4 — My listings (seller-facing listing management).
import React, { useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '@/i18n';
import { useGearStore } from '@store/gear';
import {
  gearApi,
  categoryLabel,
  formatPrice,
  isListingBoosted,
  type MyListingRow,
  type GearStatus,
} from '@api/gear';
import { isGearBoostEnabled } from '@/lib/boost';

type TFn = (key: string, params?: Record<string, string | number>) => string;

const STATUS_COLORS: Record<GearStatus, { bg: string; fg: string; i18nKey: string }> = {
  active:    { bg: 'rgba(92,107,58,0.15)', fg: COLORS.sage,    i18nKey: 'myListings.statusActive' },
  pending:   { bg: 'rgba(196,163,90,0.2)', fg: COLORS.sand,     i18nKey: 'myListings.statusPending' },
  sold:      { bg: 'rgba(0,0,0,0.06)',     fg: COLORS.barkSoft,  i18nKey: 'myListings.statusSold' },
  withdrawn: { bg: 'rgba(0,0,0,0.06)',     fg: COLORS.barkSoft,  i18nKey: 'myListings.statusWithdrawn' },
  removed:   { bg: 'rgba(184,92,56,0.12)', fg: COLORS.cocoDeep, i18nKey: 'myListings.statusRemoved' },
};

export default function MyListingsScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { myListings, fetchMyListings } = useGearStore();
  const [loading, setLoading] = React.useState(false);
  const boostEnabled = isGearBoostEnabled();

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
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(244,197,60,0.26)', 'rgba(244,197,60,0.08)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
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
            boostEnabled={boostEnabled}
            onOpen={() => navigation.navigate('GearListingDetail', { id: item.id })}
            onMarkSold={() => markSold(item.id)}
            onWithdraw={() => withdraw(item.id)}
            onReactivate={() => reactivate(item.id)}
            onBoost={() => navigation.navigate('BoostListing', {
              listingId: item.id, listingTitle: item.title, boostedUntil: item.boosted_until,
            })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#E84B79" style={{ marginTop: 40 }} />
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.coco} />}
      />
    </View>
  );
}

function Row({
  row, t, boostEnabled, onOpen, onMarkSold, onWithdraw, onReactivate, onBoost,
}: {
  row: MyListingRow;
  t: TFn;
  boostEnabled: boolean;
  onOpen: () => void;
  onMarkSold: () => void;
  onWithdraw: () => void;
  onReactivate: () => void;
  onBoost: () => void;
}) {
  const sc = STATUS_COLORS[row.status];
  const statusLabel = t(sc.i18nKey);
  const boosted = isListingBoosted(row.boosted_until);
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.statusPill, { backgroundColor: sc.bg, color: sc.fg }]}>{statusLabel}</Text>
            {boosted && <Text style={styles.boostedPill}>{t('myListings.boostedPill')}</Text>}
          </View>
          <Text style={styles.price}>
            {formatPrice(row.price_cents, row.is_free, row.currency)}
          </Text>
        </View>
        <Text style={styles.stats}>{t('myListings.stats', { views: row.view_count, saves: row.save_count })}</Text>
        <View style={styles.actions}>
          {row.status === 'active' && !boosted && boostEnabled && (
            <TouchableOpacity
              onPress={onBoost}
              style={[styles.actionBtn, styles.boostBtn]}
              accessibilityRole="button"
              accessibilityLabel={t('myListings.actionBoostA11y')}
            >
              <Text style={[styles.actionBtnText, styles.boostBtnText]}>{t('myListings.actionBoost')}</Text>
            </TouchableOpacity>
          )}
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
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  headerLink: { fontSize: 14, color: '#E84B79', fontFamily: FONTS.bodySemiBold },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, textAlign: 'center' },
  emptyBody: {
    fontSize: 14, color: COLORS.barkSoft, textAlign: 'center', lineHeight: 21, marginBottom: 8, fontFamily: FONTS.body,
  },
  emptyBtn: {
    marginTop: 8, backgroundColor: '#E84B79', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { color: '#FFFCF6', fontSize: 15, fontFamily: FONTS.bodySemiBold },

  card: {
    flexDirection: 'row', backgroundColor: COLORS.paper, borderRadius: 14,
    padding: 8, gap: 12, marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 3,
  },
  thumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: COLORS.cream },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbFallbackText: { color: COLORS.textLight, fontSize: 16, fontFamily: FONTS.body },

  body: { flex: 1 },
  cat: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.sage },
  title: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  statusPill: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
    overflow: 'hidden',
  },
  price: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep },
  stats: { fontSize: 11, color: COLORS.textLight, marginTop: 4, fontFamily: FONTS.body },
  boostedPill: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
    backgroundColor: COLORS.v2_marigold, color: COLORS.v2_cocoa,
  },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    backgroundColor: COLORS.cream, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep },
  boostBtn: { backgroundColor: '#E84B79' },
  boostBtnText: { color: '#FFFCF6' },
});
