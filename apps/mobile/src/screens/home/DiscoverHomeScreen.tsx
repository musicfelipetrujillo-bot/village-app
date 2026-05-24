// V4 Phase G7 — Discover grid.
// A quick-access grid reachable from the home feed's QuickAccess card
// ("Where do you want to go next?"). Taps jump tabs or specific routes.
// Kept intentionally simple — this is a router, not a dashboard.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';

interface Tile {
  key: string;
  title: string;
  description: string;
  icon: string;
  target: () => void;
}

export default function DiscoverHomeScreen() {
  const navigation = useNavigation<any>();
  const t = useT();

  // Tab jumps need `getParent()` — the bottom-tab parent lives above HomeNavigator.
  // AIHelpChat is a root-level modal above the tab navigator, so we walk one more level.
  const tabParent = navigation.getParent();
  const tiles: Tile[] = [
    {
      key: 'milk', title: t('discover.tileMilkTitle'), icon: '🤱',
      description: t('discover.tileMilkDesc'),
      target: () => tabParent?.navigate('Milk'),
    },
    {
      key: 'experts', title: t('discover.tileExpertsTitle'), icon: '🩺',
      description: t('discover.tileExpertsDesc'),
      target: () => tabParent?.navigate('Experts'),
    },
    {
      key: 'gear', title: t('discover.tileGearTitle'), icon: '🛒',
      description: t('discover.tileGearDesc'),
      target: () => tabParent?.navigate('Gear'),
    },
    {
      key: 'events', title: t('discover.tileEventsTitle'), icon: '🎉',
      description: t('discover.tileEventsDesc'),
      target: () => navigation.navigate('EventsList'),
    },
    {
      key: 'perks', title: t('discover.tilePerksTitle'), icon: '🎁',
      description: t('discover.tilePerksDesc'),
      target: () => navigation.navigate('PerksList'),
    },
    {
      key: 'help', title: t('discover.tileHelpTitle'), icon: '💬',
      description: t('discover.tileHelpDesc'),
      target: () => {
        const root = tabParent?.getParent();
        root?.navigate('AIHelpChat');
      },
    },
  ];

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('discover.headerTitle')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('discover.heading')}</Text>
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={styles.tile}
              onPress={tile.target}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={t('discover.tileA11y', { title: tile.title, description: tile.description })}
            >
              <Text style={styles.tileIcon}>{tile.icon}</Text>
              <Text style={styles.tileTitle}>{tile.title}</Text>
              <Text style={styles.tileDesc} numberOfLines={2}>{tile.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FDFBF6',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  content: { padding: 20, paddingBottom: 60 },
  heading: {
    fontSize: 22, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    fontStyle: 'italic', marginBottom: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // v9 discover tile — paper (not pure #FFF) + lift recipe so 6 tiles
  // float as a coherent grid on the U-shape backdrop.
  tile: {
    width: '47%', backgroundColor: COLORS.paper, borderRadius: 16, padding: 16,
    minHeight: 130,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#6B2E0E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 3,
  },
  tileIcon: { fontSize: 32, marginBottom: 8 },
  tileTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  tileDesc: { fontSize: 12, color: COLORS.barkSoft, marginTop: 4, lineHeight: 16 },
});
