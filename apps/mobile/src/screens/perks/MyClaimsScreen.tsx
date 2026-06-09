// V4 Phase G3 — My claimed perks (history)
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { usePerksStore } from '@store/perks';
import { claimStatusLabel, type MyClaimRow } from '@api/perks';
import { useT } from '@/i18n';

type TFn = (key: string, params?: Record<string, string | number>) => string;

export default function MyClaimsScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { myClaims, fetchMyClaims } = usePerksStore();
  const [loading, setLoading] = React.useState(true);

  const load = async () => {
    setLoading(true);
    try { await fetchMyClaims(); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(233,138,106,0.40)', 'rgba(233,138,106,0.12)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('myClaims.backA11y')}>
          <Text style={styles.back}>{t('myClaims.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myClaims.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading && myClaims.length === 0 ? (
        <ActivityIndicator color="#D96C88" style={{ marginTop: 40 }} />
      ) : (
        <FlashList
          data={myClaims}
          keyExtractor={(c) => c.claim_id}
          renderItem={({ item }) => (
            <ClaimRow
              row={item}
              onPress={() => navigation.navigate('PerkDetail', { id: item.deal_id })}
              t={t}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎁</Text>
              <Text style={styles.emptyTitle}>{t('myClaims.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('myClaims.emptyBody')}
              </Text>
              <TouchableOpacity
                style={styles.discoverBtn}
                onPress={() => navigation.navigate('PerksList')}
                accessibilityRole="button"
                accessibilityLabel={t('myClaims.browseBtnA11y')}
              >
                <Text style={styles.discoverBtnText}>{t('myClaims.browseBtn')}</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.coco} />}
        />
      )}
    </View>
  );
}

function ClaimRow({ row, onPress, t }: { row: MyClaimRow; onPress: () => void; t: TFn }) {
  const when = new Date(row.claimed_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const isConverted = row.status === 'confirmed';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardBrand}>{row.brand_name}</Text>
        <Text style={[styles.statusPill, isConverted && styles.statusPillConfirmed]}>
          {claimStatusLabel(row.status)}
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{row.title}</Text>
      <Text style={styles.cardWhen}>{t('myClaims.claimedPrefix', { when })}</Text>

      {row.revealed_code && (
        <View style={styles.codeInline}>
          <Text style={styles.codeInlineLabel}>{t('myClaims.codeLabel')}</Text>
          <Text style={styles.codeInlineValue}>{row.revealed_code}</Text>
        </View>
      )}

      {row.click_url && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); Linking.openURL(row.click_url!); }}
          accessibilityRole="link"
        >
          <Text style={styles.reopen}>{t('myClaims.reopenLink')}</Text>
        </TouchableOpacity>
      )}
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
  back: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  card: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 5,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  statusPill: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.8,
    backgroundColor: 'rgba(0,0,0,0.06)', color: COLORS.barkSoft,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  statusPillConfirmed: { backgroundColor: 'rgba(92,107,58,0.15)', color: COLORS.sage },
  cardTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 6 },
  cardWhen: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },

  codeInline: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, padding: 8, backgroundColor: COLORS.cream, borderRadius: 8,
  },
  codeInlineLabel: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6 },
  codeInlineValue: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', letterSpacing: 1 },

  reopen: { fontSize: 12, color: '#7A4A24', fontFamily: FONTS.bodySemiBold, marginTop: 10 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, textAlign: 'center' },
  emptyBody: {
    fontSize: 14, color: COLORS.barkSoft, textAlign: 'center', lineHeight: 21, marginBottom: 8,
  },
  discoverBtn: {
    marginTop: 8, backgroundColor: '#D96C88', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  discoverBtnText: { color: '#FFFCF6', fontFamily: FONTS.bodySemiBold, fontSize: 15 },
});
