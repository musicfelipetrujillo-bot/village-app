// Manual — 52-week index ("tap to jump"). EVERY week is open to EVERY user,
// free or Pro. The written 52-week manual is free forever (Felipe, 2026-07-30,
// matching the villie pro spec) — only VIDEO is a Pro entitlement.
//
// This screen used to lock future weeks behind Pro, which both contradicted the
// spec and contradicted the paywall's own "written manual is free" promise a
// mother would have read moments earlier. Don't re-add a text gate here.
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { useT } from '@/i18n';
import { useHomeStore } from '@store/home';

const T = {
  paper: COLORS.v2_paper, cream: COLORS.v2_cream, cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon, honey: COLORS.v2_marigold,
  parchment: COLORS.v2_parchment, rule: 'rgba(61,31,14,0.13)',
};

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);
const ROW_H = 60;

export default function ManualWeekIndexScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const currentWeek = Math.min(52, Math.max(1, babyProfile?.current_week_number ?? 1));
  const listRef = React.useRef<FlatList<number>>(null);

  // Land on the current week.
  React.useEffect(() => {
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: Math.max(0, currentWeek - 2), animated: false });
    }, 60);
    return () => clearTimeout(id);
  }, [currentWeek]);

  const openWeek = (week: number) => {
    navigation.navigate('MilestoneDetail', { week });
  };

  const renderItem = ({ item: week }: { item: number }) => {
    const isCurrent = week === currentWeek;
    const monthLabel = t('manualWeekIndex.monthLabel', { month: Math.max(1, Math.ceil(week / 4.345)) });
    return (
      <TouchableOpacity
        style={[styles.row, isCurrent && styles.rowCurrent]}
        onPress={() => openWeek(week)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('manualWeekIndex.rowA11y', { week })}
      >
        <View style={[styles.weekBadge, isCurrent && styles.weekBadgeCurrent]}>
          <Text style={[styles.weekBadgeText, isCurrent && styles.weekBadgeTextCurrent]}>{week}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>{t('manualWeekIndex.weekTitle', { week })}</Text>
          <Text style={styles.rowSub}>
            {isCurrent ? t('manualWeekIndex.thisWeek') : monthLabel}
          </Text>
        </View>
        <Text style={styles.rowAffordance}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <BackButton color={T.rose} />
        <Text style={styles.headerTitle}>{t('manualWeekIndex.title')}</Text>
        <View style={{ width: 56 }} />
      </View>

      <FlatList
        ref={listRef}
        data={WEEKS}
        keyExtractor={(w) => String(w)}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: ROW_H, offset: ROW_H * i, index: i })}
        contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16, paddingBottom: 40 }}
        onScrollToIndexFailed={() => {}}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: T.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  back: { fontSize: 15, color: T.rose, fontFamily: FONTS.v2_link },
  // Editorial masthead (not the 17px HubHeader spec — the 52-week index is a
  // destination screen, not a vertical hub): Bricolage display at 28, lowercase.
  headerTitle: { fontSize: 28, fontFamily: FONTS.headerBold, color: T.cocoa, letterSpacing: -0.5 },

  row: {
    height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  rowCurrent: { backgroundColor: 'rgba(244,197,60,0.12)', borderRadius: 12 },

  weekBadge: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: T.parchment,
    alignItems: 'center', justifyContent: 'center',
  },
  weekBadgeCurrent: { backgroundColor: T.honey },
  weekBadgeText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.cocoa },
  weekBadgeTextCurrent: { color: T.cocoa },

  rowTitle: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.cocoa },
  rowSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut, marginTop: 1 },

  rowAffordance: { fontSize: 17, color: T.rose, fontFamily: FONTS.v2_link },
});
