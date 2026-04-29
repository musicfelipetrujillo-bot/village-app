import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { getSavedDonors, unsaveDonor } from '@api/milk';
import type { DonorSearchResult } from '@api/milk';
import { DonorCard } from '@components/milk/DonorCard';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'SavedDonors'>;

export default function SavedDonorsScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [donors, setDonors] = useState<DonorSearchResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSavedDonors(user.id)
      .then((data) => {
        setDonors(data);
        setSavedIds(new Set(data.map((d) => d.id)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleUnsave = async (donorId: string) => {
    if (!user) return;
    setSavedIds((prev) => { const next = new Set(prev); next.delete(donorId); return next; });
    setDonors((prev) => prev.filter((d) => d.id !== donorId));
    await unsaveDonor(user.id, donorId).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('savedDonors.back')}
        >
          <Text style={styles.backText}>{t('savedDonors.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('savedDonors.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.rust} />
        </View>
      ) : (
        <FlashList
          data={donors}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DonorCard
              donor={item}
              saved={savedIds.has(item.id)}
              onPress={() => navigation.navigate('DonorProfile', { donorProfileId: item.id })}
              onSaveToggle={() => handleUnsave(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>♡</Text>
              <Text style={styles.emptyTitle}>{t('savedDonors.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('savedDonors.emptyBody')}
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('DonorSearchList')}
              >
                <Text style={styles.browseBtnText}>{t('savedDonors.browseCta')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
  },
  backText: { fontSize: 15, color: '#9A8070', fontFamily: FONTS.bodyMedium },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  list: { paddingTop: 8, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 52, color: '#C5B8AE' },
  emptyTitle: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  emptyBody: { fontSize: 14, color: '#9A8070', textAlign: 'center', lineHeight: 21, fontFamily: FONTS.body },
  browseBtn: {
    marginTop: 8, backgroundColor: '#D87530', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 28,
  },
  browseBtnText: { fontSize: 15, color: '#FFF', fontFamily: FONTS.bodySemiBold },
});
