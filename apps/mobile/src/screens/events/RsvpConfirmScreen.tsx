// V4 Phase G2 — RSVP confirmation modal with optional calendar handoff
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { eventsApi, formatEventWhen, type EventCard } from '@api/events';
import { useT } from '@/i18n';

type ParamList = { RsvpConfirm: { eventId: string } };

export default function RsvpConfirmScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'RsvpConfirm'>>();
  const { eventId } = route.params;

  const [event, setEvent] = useState<EventCard | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    eventsApi.getById(eventId).then(setEvent).catch(console.error);
  }, [eventId]);

  const addToCalendar = async () => {
    if (!event || adding) return;
    setAdding(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('rsvpConfirm.calendarDeniedTitle'), t('rsvpConfirm.calendarDeniedBody'));
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal =
        calendars.find((c) => c.allowsModifications && c.source?.type === 'local') ??
        calendars.find((c) => c.allowsModifications) ??
        calendars[0];
      if (!defaultCal) {
        Alert.alert(t('rsvpConfirm.noWritableTitle'), t('rsvpConfirm.noWritableBody'));
        return;
      }
      const calEventId = await Calendar.createEventAsync(defaultCal.id, {
        title: event.title,
        startDate: new Date(event.starts_at),
        endDate: new Date(event.ends_at),
        location: event.type === 'local'
          ? `${event.venue_name ?? ''}${event.address ? `, ${event.address}` : ''}`
          : `${event.platform?.toUpperCase() ?? t('rsvpConfirm.platformOnline')}: ${event.stream_url ?? ''}`,
        notes: event.description,
        timeZone: event.timezone,
      });
      await eventsApi.markCalendarAdded(event.id, calEventId);
      setAdded(true);
    } catch (err) {
      Alert.alert(t('rsvpConfirm.couldNotAddTitle'), err instanceof Error ? err.message : t('rsvpConfirm.couldNotAddBody'));
    } finally {
      setAdding(false);
    }
  };

  if (!event) {
    return <View style={styles.container}><ActivityIndicator color={COLORS.rust} style={{ marginTop: 80 }} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>{t('rsvpConfirm.title')}</Text>
        <Text style={styles.subtitle}>{event.title}</Text>
        <Text style={styles.when}>{formatEventWhen(event.starts_at, event.ends_at, event.timezone)}</Text>

        {added ? (
          <View style={styles.addedBanner}>
            <Text style={styles.addedText}>{t('rsvpConfirm.addedBanner')}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.calBtn} onPress={addToCalendar} disabled={adding} accessibilityRole="button">
            <Text style={styles.calBtnText}>{adding ? t('rsvpConfirm.adding') : t('rsvpConfirm.addToCalendar')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('MyRsvps')}
          accessibilityRole="button"
        >
          <Text style={styles.doneBtnText}>{t('rsvpConfirm.seeMyRsvps')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.popToTop()}
          accessibilityRole="button"
        >
          <Text style={styles.closeBtnText}>{t('rsvpConfirm.close')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, justifyContent: 'center' },
  content: { paddingHorizontal: 32, alignItems: 'center' },
  checkmark: {
    fontSize: 54, color: COLORS.rust, fontFamily: FONTS.bodySemiBold,
    backgroundColor: '#FDEEE8', width: 96, height: 96, borderRadius: 48,
    textAlign: 'center', lineHeight: 96, marginBottom: 16,
  },
  title: { fontSize: 28, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 12 },
  subtitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, textAlign: 'center', marginBottom: 6 },
  when: { fontSize: 14, color: COLORS.textMid, textAlign: 'center', marginBottom: 28 },

  calBtn: {
    backgroundColor: COLORS.rust, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
    marginBottom: 10, width: '100%', alignItems: 'center',
  },
  calBtnText: { color: '#FFF', fontSize: 15, fontFamily: FONTS.bodySemiBold },

  addedBanner: {
    backgroundColor: 'rgba(92,107,58,0.1)', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10,
  },
  addedText: { color: COLORS.olive, fontFamily: FONTS.bodySemiBold, fontSize: 13 },

  doneBtn: {
    backgroundColor: '#FFF', borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
    width: '100%', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.rust,
  },
  doneBtnText: { color: COLORS.rust, fontSize: 14, fontFamily: FONTS.bodySemiBold },

  closeBtn: { marginTop: 14, paddingVertical: 8 },
  closeBtnText: { color: COLORS.textLight, fontSize: 13, fontFamily: FONTS.bodySemiBold },
});
