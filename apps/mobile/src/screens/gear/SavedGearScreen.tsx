// V4 Phase G4 — Saved gear listings (buyer-facing wishlist).
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
  type SavedListingRow,
} from '@api/gear';

type TFn = (key: string, params?: Record<string, string | number>) => string;

export default function SavedGearScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { saved, fetchSaved } = useGearStore();
  const [loading, setLoading] = React.useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { await fetchSaved(); } finally { setLoading(false); }
  }, [fetchSaved]);

  useEffect(() => { load(); }, [load]);

  const unsave = async (id: string) => {
    try {
      await gearApi.unsaveListing(id);
      await fetchSaved();
    } catch (err: any) {
      Alert.alert(t('savedGear.errorTitle'), err?.message ?? t('savedGear.errorBody'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('savedGear.backA11y')}>
          <Text style={styles.back}>{t('savedGear.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('savedGear.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlashList
        data={saved}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <Row
            row={item}
            t={t}
            onOpen={() => navigation.navigate('GearListingDetail', { id: item.id })}
            onUnsave={() => unsave(item.id)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={COLORS.rust} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>♡</Text>
              <Text style={styles.emptyTitle}>{t('savedGear.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('savedGear.emptyBody')}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('GearBrowse')}
                accessibilityRole="button"
                accessibilityLabel={t('savedGear.browseA11y')}
              >
                <Text style={styles.emptyBtnText}>{t('savedGear.browse')}</Text>
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

function Row({ row, t, onOpen, onUnsave }: { row: SavedListingRow; t: TFn; onOpen: () => void; onUnsave: () => void }) {
  const isInactive = row.status !== 'active' && row.status !== 'pending';
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('savedGear.rowA11y', { title: row.title, suffix: isInactive ? t('savedGear.rowA11ySuffixInactive') : '' })}
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
        {isInactive && <Text style={styles.inactive}>{row.status === 'sold' ? t('savedGear.inactiveSold') : t('savedGear.inactiveOther')}</Text>}
        <View style={styles.metaRow}>
          <Text style={styles.price}>
            {formatPrice(row.price_cents, row.is_free, row.currency)}
          </Text>
          <Text style={styles.city}>{row.pickup_city}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onUnsave} style={styles.unsaveBtn} accessibilityLabel={t('savedGear.unsaveA11y')}>
        <Text style={styles.unsaveIcon}>♥</Text>
      </TouchableOpacity>
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
  back: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodySemiBold, minWidth: 50 },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyEmoji: { fontSize: 52, color: COLORS.textLight, marginBottom: 8 },
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
    padding: 10, gap: 12, marginBottom: 12, alignItems: 'center',
  },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: COLORS.cream },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbFallbackText: { color: COLORS.textLight, fontSize: 16, fontFamily: FONTS.body },

  body: { flex: 1 },
  cat: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.olive },
  title: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 3 },
  inactive: { fontSize: 11, color: COLORS.rustDark, fontFamily: FONTS.bodySemiBold, marginTop: 3 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark },
  city: { fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },

  unsaveBtn: { paddingHorizontal: 10, paddingVertical: 10 },
  unsaveIcon: { fontSize: 20, color: COLORS.rust },
});
