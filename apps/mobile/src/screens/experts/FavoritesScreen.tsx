// V1 Phase 3 — Saved providers grid
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '@/i18n';
import { useAuthStore } from '@store/auth';
import { useExpertsStore } from '@store/experts';
import { specialistsApi } from '@api/specialists';
import { SpecialistCard } from '@components/experts/SpecialistCard';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';
import type { Specialist } from 'shared/src/types/v1';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'Favorites'>;

export default function FavoritesScreen({ navigation }: Props) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const { toggleFavorite, favorites } = useExpertsStore();

  const [saved, setSaved] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await specialistsApi.getFavoriteSpecialists(user.id);
      setSaved(data);
    } catch {
      // fail silently — list just stays empty
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // When a favorite is toggled from this screen, remove the card instantly
  const handleToggleFavorite = async (specialistId: string) => {
    if (!user) return;
    await toggleFavorite(user.id, specialistId);
    setSaved((prev) => prev.filter((s) => s.id !== specialistId));
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(243,183,156,0.38)', 'rgba(243,183,156,0.11)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('expertsFavorites.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('expertsFavorites.title')}</Text>
        <Text style={styles.subtitle}>{t('expertsFavorites.subtitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#E84B79" />
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SpecialistCard
              specialist={item}
              onPress={() => navigation.navigate('SpecialistProfile', { specialistId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🤍</Text>
              <Text style={styles.emptyTitle}>{t('expertsFavorites.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {t('expertsFavorites.emptyText')}
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('ExpertsHome')}
              >
                <Text style={styles.browseBtnText}>{t('expertsFavorites.browse')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodyMedium },
  title: {
    fontFamily: FONTS.headerItalic,
    fontSize: 28,
    color: COLORS.bark,
  },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 2, fontFamily: FONTS.body },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 100, gap: 10 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 24, fontFamily: FONTS.body },
  browseBtn: {
    backgroundColor: '#E84B79',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  browseBtnText: { color: '#FFFCF6', fontSize: 15, fontFamily: FONTS.bodySemiBold },
});
