// DaySheetListScreen — the Day Sheet hub: make a new one, or reopen a saved
// sheet (e.g. "Grandma's weekend") to re-share or update.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { daySheetsApi, type DaySheet } from '@api/daySheets';

export default function DaySheetListScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [sheets, setSheets] = useState<DaySheet[] | null>(null);

  useFocusEffect(useCallback(() => { daySheetsApi.listMine().then(setSheets); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.v2_paper }}>
      <View style={[st.head, { paddingTop: insets.top + 10 }]}>
        <BackButton color={COLORS.v2_cinnamon} />
        <Text style={st.headTitle}>Day sheets</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text style={st.lede}>A ready-to-hand-off routine for whoever's watching baby — built from what you log. Share by link, QR, or PDF.</Text>

        <TouchableOpacity style={st.newBtn} onPress={() => nav.navigate('DaySheetBuilder', {})} accessibilityRole="button" accessibilityLabel="New day sheet">
          <Text style={st.newTxt}>＋  New day sheet</Text>
        </TouchableOpacity>

        {sheets === null ? null : sheets.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={st.emptyTitle}>No day sheets yet</Text>
            <Text style={st.emptyBody}>Make one before a sitter, grandparent, or trip — we'll draft the schedule from your logs.</Text>
          </View>
        ) : (
          sheets.map((s) => (
            <TouchableOpacity key={s.id} style={st.card} onPress={() => nav.navigate('DaySheetShare', { id: s.id })} accessibilityRole="button" accessibilityLabel={s.for_whom ? `Day sheet for ${s.for_whom}` : 'Day sheet'}>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle} numberOfLines={1}>{s.for_whom ? `For ${s.for_whom}` : `${s.baby_name || 'Baby'}'s day`}</Text>
                <Text style={st.cardSub} numberOfLines={1}>
                  {[s.starts_on, s.ends_on].filter(Boolean).join(' – ') || 'no dates'}
                  {s.revoked_at ? '  ·  link off' : s.is_shared ? '  ·  shared' : '  ·  draft'}
                </Text>
              </View>
              <Text style={st.chev}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)' },
  back: { fontFamily: FONTS.v2_link, fontSize: 15, color: COLORS.v2_cinnamon, width: 44 },
  headTitle: { fontFamily: FONTS.v3_display, fontSize: 18, color: COLORS.v2_cocoa },
  lede: { fontFamily: FONTS.v2_body, fontSize: 13.5, color: COLORS.v2_walnut, lineHeight: 19, marginBottom: 16 },
  newBtn: { backgroundColor: COLORS.v2_cocoa, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginBottom: 18 },
  newTxt: { fontFamily: FONTS.v3_display, fontSize: 15, color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFCF6', borderRadius: 14, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)' },
  cardTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.v2_cocoa },
  cardSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.v2_walnut, marginTop: 3 },
  chev: { fontSize: 22, color: '#C9B79F' },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyTitle: { fontFamily: FONTS.v3_display, fontSize: 18, color: COLORS.v2_cocoa },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 13, color: COLORS.v2_walnut, textAlign: 'center', lineHeight: 19, maxWidth: 280 },
});
