// V2 M4 — MilkMessageThreadsScreen
// Inbox listing all milk message threads (recipient or donor side).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { listMyMilkThreads, type MilkThreadRow } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { useT, type Lang } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkMessageThreads'>;

type T = ReturnType<typeof useT>;

function timeAgo(iso: string | null, t: T, lang: Lang): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('milkThreads.timeNow');
  if (diff < 3600) return t('milkThreads.timeMin', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('milkThreads.timeHr', { n: Math.floor(diff / 3600) });
  if (diff < 604800) return t('milkThreads.timeDay', { n: Math.floor(diff / 86400) });
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' });
}

export default function MilkMessageThreadsScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const lang = useUserStore((s) => (s.profile?.preferred_language ?? 'en') as Lang);
  const t = useT();
  const [threads, setThreads] = useState<MilkThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await listMyMilkThreads(user.id);
      setThreads(data);
    } catch (e) { console.error(e); }
  }, [user]);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('milkThreads.back')}
        >
          <Text style={styles.back}>{t('milkThreads.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('milkThreads.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.rust} /></View>
      ) : (
        <FlashList
          data={threads}
          keyExtractor={(thread) => thread.thread_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.rust} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('MilkMessageDetail', {
                threadId: item.thread_id,
                donorProfileId: item.donor_profile_id,
                otherDisplayName: item.other_display_name,
              })}
            >
              {item.other_avatar_url ? (
                <Image source={{ uri: item.other_avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {item.other_display_name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
              <View style={styles.middle}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.other_display_name}</Text>
                  {item.is_donor_side && <Text style={styles.donorTag}>{t('milkThreads.donorTag')}</Text>}
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.last_message_body ?? t('milkThreads.noMessages')}
                </Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.time}>{timeAgo(item.last_message_at, t, lang)}</Text>
                {item.unread_count > 0 && (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>{t('milkThreads.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('milkThreads.emptyBody')}
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('DonorSearchList')}
              >
                <Text style={styles.browseBtnText}>{t('milkThreads.browseCta')}</Text>
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#D87530', fontFamily: FONTS.bodyMedium },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF',
  },
  sep: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 76 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: '#D87530', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFF', fontSize: 18, fontFamily: FONTS.bodySemiBold },
  middle: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#2C1810', flexShrink: 1 },
  donorTag: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#FFF',
    backgroundColor: '#6B7C3F', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  preview: { fontSize: 13, color: '#9A8070', marginTop: 4 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 11, color: '#9A8070' },
  unreadDot: {
    minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10,
    backgroundColor: '#D87530', alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#FFF', fontSize: 11, fontFamily: FONTS.bodySemiBold },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  emptyBody: { fontSize: 14, color: '#9A8070', textAlign: 'center', lineHeight: 21 },
  browseBtn: {
    marginTop: 8, backgroundColor: '#D87530', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 28,
  },
  browseBtnText: { fontSize: 15, color: '#FFF', fontFamily: FONTS.bodySemiBold },
});
