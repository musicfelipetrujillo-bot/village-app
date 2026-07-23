// BuzzArchiveScreen — past published "The Buzz" issues, reachable from the
// Manual tab. Tapping a row opens TheBuzzScreen in archive mode ({ issueId }).
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { theBuzzApi, type TheBuzzArchiveRow } from '@api/theBuzz';

export default function BuzzArchiveScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const [rows, setRows] = React.useState<TheBuzzArchiveRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await theBuzzApi.listArchive();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const onRefresh = React.useCallback(() => { setRefreshing(true); load(); }, [load]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={s.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('buzzArchive.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.v2_cinnamon} /></View>
      ) : rows.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🐝</Text>
          <Text style={s.emptyTitle}>{t('buzzArchive.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('buzzArchive.emptyBody')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.v2_cinnamon} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => navigation.navigate('TheBuzz', { issueId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={s.rowDate}>{new Date(item.issue_date).toLocaleDateString()}</Text>
              <Text style={s.rowTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={s.rowIntro} numberOfLines={2}>{item.intro}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.v2_cream,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.13)',
  },
  back: { fontSize: 15, color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_link },
  headerTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: COLORS.v2_cocoa },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  row: {
    backgroundColor: COLORS.v2_card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(217,108,136,0.18)', gap: 4,
  },
  rowDate: { fontFamily: FONTS.v2_mono, fontSize: 10, color: COLORS.v2_cinnamon, letterSpacing: 0.6, textTransform: 'uppercase' },
  rowTitle: { fontFamily: FONTS.v2_bold, fontSize: 15, color: COLORS.v2_cocoa },
  rowIntro: { fontFamily: FONTS.v2_body, fontSize: 13, color: COLORS.v2_walnut, lineHeight: 18 },
});
