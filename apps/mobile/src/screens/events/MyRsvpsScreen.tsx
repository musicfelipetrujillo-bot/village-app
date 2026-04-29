// V4 Phase G2 — My RSVPs (upcoming / past tabs)
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useEventsStore } from '@store/events';
import type { MyRsvpRow } from '@api/events';
import { useT } from '@/i18n';

type TFn = (key: string, params?: Record<string, string | number>) => string;
type Tab = 'upcoming' | 'past';

export default function MyRsvpsScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { myRsvps, pastRsvps, fetchMyRsvps, fetchPastRsvps } = useEventsStore();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMyRsvps(), fetchPastRsvps()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const data = tab === 'upcoming' ? myRsvps : pastRsvps;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('myRsvps.backA11y')}>
          <Text style={styles.back}>{t('myRsvps.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myRsvps.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.tabsRow}>
        {(['upcoming', 'past'] as Tab[]).map((tk) => (
          <TouchableOpacity
            key={tk}
            style={[styles.tab, tab === tk && styles.tabActive]}
            onPress={() => setTab(tk)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === tk }}
          >
            <Text style={[styles.tabText, tab === tk && styles.tabTextActive]}>
              {tk === 'upcoming' ? t('myRsvps.tabUpcoming') : t('myRsvps.tabPast')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && data.length === 0 ? (
        <ActivityIndicator color={COLORS.rust} style={{ marginTop: 40 }} />
      ) : (
        <FlashList
          data={data}
          keyExtractor={(r) => r.rsvp_id}
          renderItem={({ item }) => (
            <RsvpRow
              row={item}
              onPress={() => navigation.navigate('EventDetail', { id: item.event_id })}
              t={t}
            />
          )}
          ListEmptyComponent={
            tab === 'upcoming' ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📅</Text>
                <Text style={styles.emptyTitle}>{t('myRsvps.emptyUpcomingTitle')}</Text>
                <Text style={styles.emptyBody}>
                  {t('myRsvps.emptyUpcomingBody')}
                </Text>
                <TouchableOpacity
                  style={styles.discoverBtn}
                  onPress={() => navigation.navigate('EventsList')}
                  accessibilityRole="button"
                  accessibilityLabel={t('myRsvps.discoverBtnA11y')}
                >
                  <Text style={styles.discoverBtnText}>{t('myRsvps.discoverBtn')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🗓️</Text>
                <Text style={styles.emptyTitle}>{t('myRsvps.emptyPastTitle')}</Text>
                <Text style={styles.emptyBody}>
                  {t('myRsvps.emptyPastBody')}
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.rust} />}
        />
      )}
    </View>
  );
}

function RsvpRow({ row, onPress, t }: { row: MyRsvpRow; onPress: () => void; t: TFn }) {
  const start = new Date(row.starts_at);
  const whenShort = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isWebinar = row.type === 'webinar';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardBadge}>{isWebinar ? t('myRsvps.badgeWebinar') : t('myRsvps.badgeLocal')}</Text>
        {row.rsvp_status === 'waitlist' && <Text style={styles.waitlist}>{t('myRsvps.waitlist')}</Text>}
        {row.added_to_calendar && <Text style={styles.calIcon}>📅</Text>}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{row.title}</Text>
      <Text style={styles.cardHost}>{t('myRsvps.hostPrefix', { host: row.host_name })}</Text>
      <Text style={styles.cardWhen}>{whenShort} · {timeStr}</Text>
      {!isWebinar && row.venue_name && <Text style={styles.cardMeta}>{row.venue_name}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },

  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.rust },
  tabText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid },
  tabTextActive: { color: COLORS.rust },

  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBadge: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.rustDark, textTransform: 'uppercase' },
  waitlist: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.gold,
    backgroundColor: 'rgba(196,163,90,0.15)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  calIcon: { fontSize: 12, marginLeft: 'auto' },
  cardTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 6 },
  cardHost: { fontSize: 12, color: COLORS.textMid, marginTop: 2 },
  cardWhen: { fontSize: 12, color: COLORS.brownDeep, fontFamily: FONTS.bodySemiBold, marginTop: 6 },
  cardMeta: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, textAlign: 'center' },
  emptyBody: {
    fontSize: 14, color: COLORS.textMid, textAlign: 'center', lineHeight: 21, marginBottom: 8,
  },
  discoverBtn: {
    marginTop: 8, backgroundColor: COLORS.rust, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  discoverBtnText: { color: '#FFF', fontFamily: FONTS.bodySemiBold, fontSize: 15 },
});
