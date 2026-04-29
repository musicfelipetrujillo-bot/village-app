// ManualCategory — filtered article list for one (audience, category) pair.
// Reads from manual_articles in a follow-up phase; for now renders an empty
// state explaining what will live here so the navigation surface holds.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';

type ParamList = {
  ManualCategory: { audience: 'baby' | 'mom'; category: string; label: string };
};

export default function ManualCategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ManualCategory'>>();
  const t = useT();
  const { audience, label } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>
          {audience === 'baby' ? t('manual.eyebrowBaby') : t('manual.eyebrowMom')}
        </Text>
        <Text style={styles.title}>{label}</Text>

        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>{t('manual.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('manual.emptyBody')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ceramic },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
    backgroundColor: COLORS.ceramic,
  },
  back: { fontSize: 14, color: COLORS.diner, fontFamily: FONTS.bodySemiBold },
  content: { paddingHorizontal: 20, paddingBottom: 60 },

  eyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.diner,
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8,
  },
  title: {
    fontSize: 32, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    lineHeight: 38, marginBottom: 28,
  },

  empty: {
    backgroundColor: COLORS.paper,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    marginBottom: 8, textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 19, textAlign: 'center',
  },
});
