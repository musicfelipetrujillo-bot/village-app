// Manual — 52-week index ("tap to jump"). Free users can open the current week
// and any past week; future weeks are visible but locked (teased) and prompt a
// Villie Pro upgrade. Pro users get every week.
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { useT } from '@/i18n';
import { useHomeStore } from '@store/home';
import { isProUser } from '@/lib/pro';

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
  const pro = isProUser();
  const listRef = React.useRef<FlatList<number>>(null);

  // Land on the current week.
  React.useEffect(() => {
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: Math.max(0, currentWeek - 2), animated: false });
    }, 60);
    return () => clearTimeout(id);
  }, [currentWeek]);

  const promptPro = () => {
    Alert.alert(
      t('manualWeekIndex.proTitle'),
      t('manualWeekIndex.proBody'),
      [{ text: t('manualWeekIndex.proDismiss'), style: 'cancel' }],
    );
  };

  const openWeek = (week: number, locked: boolean) => {
    if (locked) { promptPro(); return; }
    navigation.navigate('MilestoneDetail', { week });
  };

  const renderItem = ({ item: week }: { item: number }) => {
    const isCurrent = week === currentWeek;
    const locked = !pro && week > currentWeek;
    const monthLabel = t('manualWeekIndex.monthLabel', { month: Math.max(1, Math.ceil(week / 4.345)) });
    return (
      <TouchableOpacity
        style={[styles.row, locked && styles.rowLocked, isCurrent && styles.rowCurrent]}
        onPress={() => openWeek(week, locked)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: false }}
        accessibilityLabel={
          locked
            ? t('manualWeekIndex.rowLockedA11y', { week })
            : t('manualWeekIndex.rowA11y', { week })
        }
      >
        <View style={[styles.weekBadge, isCurrent && styles.weekBadgeCurrent, locked && styles.weekBadgeLocked]}>
          <Text style={[styles.weekBadgeText, isCurrent && styles.weekBadgeTextCurrent]}>{week}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowTitle, locked && styles.rowTitleLocked]}>{t('manualWeekIndex.weekTitle', { week })}</Text>
          <Text style={[styles.rowSub, locked && styles.rowTitleLocked]}>
            {isCurrent ? t('manualWeekIndex.thisWeek') : monthLabel}
          </Text>
        </View>
        <Text style={[styles.rowAffordance, locked && styles.rowAffordanceLocked]}>
          {locked ? '🔒' : '›'}
        </Text>
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

      {!pro && (
        <View style={styles.proBanner}>
          <Text style={styles.proBannerText}>{t('manualWeekIndex.freeBanner', { week: currentWeek })}</Text>
        </View>
      )}

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
  headerTitle: { fontSize: 17, fontFamily: FONTS.v2_bold, color: T.cocoa },

  proBanner: {
    backgroundColor: T.parchment, paddingHorizontal: 18, paddingVertical: 10,
  },
  proBannerText: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: T.walnut },

  row: {
    height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  rowLocked: { opacity: 0.55 },
  rowCurrent: { backgroundColor: 'rgba(244,197,60,0.12)', borderRadius: 12 },

  weekBadge: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: T.parchment,
    alignItems: 'center', justifyContent: 'center',
  },
  weekBadgeCurrent: { backgroundColor: T.honey },
  weekBadgeLocked: { backgroundColor: 'rgba(61,31,14,0.06)' },
  weekBadgeText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.cocoa },
  weekBadgeTextCurrent: { color: T.cocoa },

  rowTitle: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.cocoa },
  rowTitleLocked: { color: T.walnut },
  rowSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut, marginTop: 1 },

  rowAffordance: { fontSize: 17, color: T.rose, fontFamily: FONTS.v2_link },
  rowAffordanceLocked: { fontSize: 14 },
});
