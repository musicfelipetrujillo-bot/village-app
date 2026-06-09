// V4 Phase G2 — Event detail (handles both local + webinar via type branching)
// RSVP → RsvpConfirm modal. Third-party disclaimer shown for is_third_party events.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { confirm } from '@utils/haptics';
import { eventsApi, formatEventWhen, formatDistance, timeUntilLabel, type EventCard, type RsvpStatus } from '@api/events';
import { useEventsStore } from '@store/events';
import { useT } from '@/i18n';

type ParamList = { EventDetail: { id: string } };

export default function EventDetailScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'EventDetail'>>();
  const { id } = route.params;

  const fetchMyRsvps = useEventsStore((s) => s.fetchMyRsvps);

  const [event, setEvent] = useState<EventCard | null>(null);
  const [rsvp, setRsvp] = useState<{ status: RsvpStatus; added_to_calendar: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, r] = await Promise.all([
        eventsApi.getById(id),
        eventsApi.getMyRsvpForEvent(id),
      ]);
      setEvent(e);
      setRsvp(r);
    } catch (err) {
      console.error('[eventDetail] load', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRsvp = async () => {
    if (!event || acting) return;
    confirm();
    setActing(true);
    try {
      const res = await eventsApi.rsvp(event.id);
      setRsvp({ status: res.status, added_to_calendar: rsvp?.added_to_calendar ?? false });
      await fetchMyRsvps();
      navigation.navigate('RsvpConfirm', { eventId: event.id });
    } catch (err) {
      Alert.alert(t('eventDetail.rsvpFailedTitle'), err instanceof Error ? err.message : t('eventDetail.rsvpFailedBody'));
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!event || acting) return;
    Alert.alert(t('eventDetail.cancelRsvpTitle'), t('eventDetail.cancelRsvpBody'), [
      { text: t('eventDetail.keepRsvp'), style: 'cancel' },
      {
        text: t('eventDetail.cancelRsvpAction'), style: 'destructive', onPress: async () => {
          setActing(true);
          try {
            await eventsApi.cancelRsvp(event.id);
            setRsvp({ status: 'cancelled', added_to_calendar: false });
            await fetchMyRsvps();
          } catch (err) {
            Alert.alert(t('eventDetail.couldNotCancel'), err instanceof Error ? err.message : t('eventDetail.tryAgain'));
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  const openStreamOrMap = async () => {
    if (!event) return;
    const url =
      event.type === 'webinar'
        ? event.stream_url
        : event.address
          ? `https://maps.apple.com/?q=${encodeURIComponent(`${event.venue_name ?? ''} ${event.address}`)}`
          : null;
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#D96C88" style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>{t('eventDetail.notFound')}</Text>
      </View>
    );
  }

  const isWebinar = event.type === 'webinar';
  const isLive = event.status === 'live';
  const hasRsvp = rsvp && rsvp.status !== 'cancelled';

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.34)', 'rgba(250,208,128,0.14)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('eventDetail.backA11y')}>
          <Text style={styles.back}>{t('eventDetail.back')}</Text>
        </TouchableOpacity>
        <View />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>{isWebinar ? t('eventDetail.badgeWebinar') : t('eventDetail.badgeLocal')}</Text>
          {event.is_partner && <Text style={styles.partner}>{t('eventDetail.partner')}</Text>}
          {isLive && <Text style={styles.live}>{t('eventDetail.live')}</Text>}
        </View>

        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.host}>{t('eventDetail.hostPrefix', { host: event.host_name })}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('eventDetail.sectionWhen')}</Text>
          <Text style={styles.sectionValue}>{formatEventWhen(event.starts_at, event.ends_at, event.timezone)}</Text>
          {isWebinar && <Text style={styles.countdown}>{timeUntilLabel(event.starts_at)}</Text>}
        </View>

        {!isWebinar && event.venue_name && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('eventDetail.sectionWhere')}</Text>
            <Text style={styles.sectionValue}>{event.venue_name}</Text>
            {event.address && <Text style={styles.sectionSubValue}>{event.address}{event.city ? `, ${event.city}` : ''}</Text>}
            {event.distance_km != null && <Text style={styles.distance}>{formatDistance(event.distance_km)}</Text>}
            <TouchableOpacity style={styles.secondaryBtn} onPress={openStreamOrMap} accessibilityRole="button">
              <Text style={styles.secondaryBtnText}>{t('eventDetail.openInMaps')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isWebinar && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('eventDetail.sectionHowToJoin')}</Text>
            <Text style={styles.sectionValue}>{event.platform?.toUpperCase() ?? t('eventDetail.platformOnline')}</Text>
            <TouchableOpacity
              style={[styles.secondaryBtn, !isLive && styles.secondaryBtnDisabled]}
              onPress={openStreamOrMap}
              disabled={!isLive}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>{isLive ? t('eventDetail.joinStream') : t('eventDetail.linkAvailableAtStart')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('eventDetail.sectionAbout')}</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {event.age_tags.length > 0 && (
          <View style={styles.tagsRow}>
            {event.age_tags.map((tag) => (
              <Text key={tag} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        )}

        {event.capacity != null && (
          <Text style={styles.capacity}>
            {t('eventDetail.goingOfCapacity', { going: event.going_count, capacity: event.capacity })}
          </Text>
        )}

        {event.is_third_party && (
          <Text style={styles.disclaimer}>
            {t('eventDetail.thirdPartyDisclaimer')}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {hasRsvp ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={acting} accessibilityRole="button">
            <Text style={styles.cancelBtnText}>
              {acting ? t('eventDetail.ctaActing') : rsvp?.status === 'waitlist' ? t('eventDetail.ctaWaitlistCancel') : t('eventDetail.ctaGoingCancel')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleRsvp} disabled={acting} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{acting ? t('eventDetail.ctaSaving') : t('eventDetail.ctaRsvp')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },
  notFound: { textAlign: 'center', marginTop: 80, color: COLORS.textLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodySemiBold },

  content: { padding: 20, paddingBottom: 120 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  badge: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: '#7A4A24', textTransform: 'uppercase' },
  partner: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.8, color: COLORS.sage,
    backgroundColor: 'rgba(92,107,58,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  live: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.8, color: '#C94F3C',
    backgroundColor: 'rgba(201,79,60,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },

  title: { fontSize: 28, fontFamily: FONTS.headerBold, color: COLORS.bark, marginTop: 6, lineHeight: 34, letterSpacing: -0.4 },
  host: { fontSize: 14, color: COLORS.barkSoft, marginTop: 4 },

  section: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#43260F', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 5,
  },
  sectionLabel: { fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.textLight, textTransform: 'uppercase' },
  sectionValue: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 4 },
  sectionSubValue: { fontSize: 13, color: COLORS.barkSoft, marginTop: 2 },
  distance: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  countdown: { fontSize: 13, color: '#7A4A24', fontFamily: FONTS.bodySemiBold, marginTop: 4 },
  description: { fontSize: 14, color: COLORS.barkSoft, lineHeight: 21, marginTop: 6 },

  secondaryBtn: {
    backgroundColor: COLORS.cream, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginTop: 10,
  },
  secondaryBtnDisabled: { opacity: 0.5 },
  secondaryBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tag: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft,
    backgroundColor: COLORS.paper, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },

  capacity: { fontSize: 12, color: COLORS.textLight, marginTop: 12, textAlign: 'right' },
  disclaimer: {
    fontSize: 12, color: COLORS.textLight, marginTop: 16,
    fontStyle: 'italic', lineHeight: 18,
  },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 28,
    backgroundColor: COLORS.cream, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  // Phase 2b editorial pass — yolk-pill primary CTA matches app-wide
  // pattern. Cancel stays as rust-outline secondary so the pair reads
  // as filled / outline.
  // v9 canonical CTA
  primaryBtn: {
    backgroundColor: '#D96C88', borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: '#D96C88', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  primaryBtnText: { color: '#FFFCF6', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
  cancelBtn: {
    backgroundColor: COLORS.paper, borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.coco,
  },
  cancelBtnText: { color: '#D96C88', fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
