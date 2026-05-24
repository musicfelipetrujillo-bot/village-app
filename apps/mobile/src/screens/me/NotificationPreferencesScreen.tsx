// Notification preferences — A2.b.
//
// One toggle per surface defined in docs/source/Village_Onboarding_UX.md
// §Settings. Writes `users.notif_prefs` JSONB directly via supabase with
// optimistic store update + revert-on-error (mirrors MeScreen /
// RadiusPreferenceScreen patterns).
//
// IMPORTANT: the surfaces listed here are the *user-controllable* ones.
// Transactional safety sends — crisis moderator SMS (room-message-scan),
// specialist admin approval (admin-approve-specialist) — bypass this
// column entirely. Do NOT add toggles for those; they are compliance-critical.

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useUserStore, DEFAULT_NOTIF_PREFS, DEFAULT_QUIET_HOURS,
  type NotifPrefKey, type NotifPrefs, type QuietHours,
} from '@store/user';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useAnalytics } from '@hooks/useAnalytics';
import { useT } from '@/i18n';
import type { MeStackParamList } from '@/navigation/MeNavigator';

type Props = NativeStackScreenProps<MeStackParamList, 'NotificationPreferences'>;

interface ToggleRow {
  key: NotifPrefKey;
  titleKey: string;
  descKey: string;
  // Only marketing/promotions needs the FTC opt-in disclaimer.
  noteKey?: string;
}

const ROWS: ToggleRow[] = [
  { key: 'events',      titleKey: 'notifPrefs.rowEventsTitle',      descKey: 'notifPrefs.rowEventsDesc' },
  { key: 'groups',      titleKey: 'notifPrefs.rowGroupsTitle',      descKey: 'notifPrefs.rowGroupsDesc' },
  { key: 'specialists', titleKey: 'notifPrefs.rowSpecialistsTitle', descKey: 'notifPrefs.rowSpecialistsDesc' },
  { key: 'milk_hub',    titleKey: 'notifPrefs.rowMilkHubTitle',     descKey: 'notifPrefs.rowMilkHubDesc' },
  { key: 'articles',    titleKey: 'notifPrefs.rowArticlesTitle',    descKey: 'notifPrefs.rowArticlesDesc' },
  { key: 'ai',          titleKey: 'notifPrefs.rowAiTitle',          descKey: 'notifPrefs.rowAiDesc' },
  {
    key: 'promotions',
    titleKey: 'notifPrefs.rowPromotionsTitle',
    descKey: 'notifPrefs.rowPromotionsDesc',
    noteKey: 'notifPrefs.rowPromotionsNote',
  },
  {
    // Weekly Sunday newsletter — opt-in per CAN-SPAM. Lives at the bottom
    // of the list with a soft note so it doesn't read as a transactional
    // toggle (it's marketing, even if the content is editorial).
    key: 'newsletter',
    titleKey: 'notifPrefs.rowNewsletterTitle',
    descKey: 'notifPrefs.rowNewsletterDesc',
    noteKey: 'notifPrefs.rowNewsletterNote',
  },
];

// Device-local IANA tz. `Intl.DateTimeFormat().resolvedOptions().timeZone` is
// supported in Hermes/RN and returns e.g. "America/New_York". Falls back to
// the stored default when the runtime can't resolve it.
function deviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || DEFAULT_QUIET_HOURS.tz;
  } catch {
    return DEFAULT_QUIET_HOURS.tz;
  }
}

function formatHour(hour: number): string {
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:00 ${ampm}`;
}

type SavingKey = NotifPrefKey | 'quiet_hours';

export default function NotificationPreferencesScreen({ navigation }: Props) {
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);
  const { trackEvent } = useAnalytics();
  const [saving, setSaving] = useState<SavingKey | null>(null);

  const prefs: NotifPrefs = profile?.notif_prefs ?? DEFAULT_NOTIF_PREFS;
  const qh: QuietHours = prefs.quiet_hours ?? DEFAULT_QUIET_HOURS;

  const toggle = useCallback(async (key: NotifPrefKey, next: boolean) => {
    if (!profile || saving) return;
    setSaving(key);
    const prev = profile;
    const nextPrefs: NotifPrefs = { ...prefs, [key]: next };
    // Optimistic write — revert on error.
    setProfile({ ...profile, notif_prefs: nextPrefs });
    const { error } = await supabase
      .from('users')
      .update({ notif_prefs: nextPrefs })
      .eq('id', profile.id);
    setSaving(null);
    if (error) {
      setProfile(prev);
      Alert.alert(t('notifPrefs.saveErrorTitle'), error.message ?? t('notifPrefs.saveErrorBody'));
      return;
    }
    trackEvent('notification_pref_changed', { pref_key: key, enabled: next });
  }, [profile, setProfile, prefs, saving, trackEvent]);

  // Generic writer for quiet_hours mutations. Picks up the device tz on the
  // first enable so we don't silently apply a stale America/New_York default
  // to someone in another timezone.
  const writeQuietHours = useCallback(async (next: QuietHours) => {
    if (!profile || saving) return;
    setSaving('quiet_hours');
    const prev = profile;
    const nextPrefs: NotifPrefs = { ...prefs, quiet_hours: next };
    setProfile({ ...profile, notif_prefs: nextPrefs });
    const { error } = await supabase
      .from('users')
      .update({ notif_prefs: nextPrefs })
      .eq('id', profile.id);
    setSaving(null);
    if (error) {
      setProfile(prev);
      Alert.alert(t('notifPrefs.saveErrorTitle'), error.message ?? t('notifPrefs.saveErrorBody'));
      return;
    }
    trackEvent('quiet_hours_changed', {
      enabled: next.enabled,
      start_hour: next.start_hour,
      end_hour: next.end_hour,
    });
  }, [profile, setProfile, prefs, saving, trackEvent]);

  const toggleQuietHours = useCallback((enabled: boolean) => {
    // Adopt device tz on the first enable so the window is interpreted
    // correctly out of the box.
    writeQuietHours({ ...qh, enabled, tz: enabled ? deviceTimezone() : qh.tz });
  }, [qh, writeQuietHours]);

  const bumpHour = useCallback((field: 'start_hour' | 'end_hour', delta: 1 | -1) => {
    const next = ((qh[field] + delta) + 24) % 24;
    writeQuietHours({ ...qh, [field]: next });
  }, [qh, writeQuietHours]);

  return (
    <SafeAreaView style={s.safe}>
      <V9PageBackdrop />
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('notifPrefs.topBack')}
        >
          <Text style={s.topLink}>← {t('notifPrefs.topBack')}</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>{t('notifPrefs.topTitle')}</Text>
        <View style={s.topSpacer}>
          {saving ? <ActivityIndicator color="#C07840" /> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* v9 editorial masthead — replaces the bald `topTitle` as the
            screen's first beat. topBar still carries Back + saving spinner. */}
        <View style={s.eyebrowRow}>
          <View style={s.eyebrowBar} />
          <Text style={s.eyebrow}>{t('notifPrefs.headerEyebrow')}</Text>
        </View>
        <Text style={s.headerTitle}>
          {t('notifPrefs.headerTitleLead')} <Text style={s.headerTitleEm}>{t('notifPrefs.headerTitleEm')}</Text>
        </Text>
        <View style={s.headerRule} />
        <Text style={s.lead}>{t('notifPrefs.lead')}</Text>

        <View style={s.list}>
          {ROWS.map((row) => {
            const value = !!prefs[row.key];
            const isSavingRow = saving === row.key;
            const title = t(row.titleKey);
            return (
              <View key={row.key} style={s.row}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{title}</Text>
                  <Text style={s.rowDesc}>{t(row.descKey)}</Text>
                  {row.noteKey ? <Text style={s.rowNote}>{t(row.noteKey)}</Text> : null}
                </View>
                <Switch
                  value={value}
                  onValueChange={(v) => toggle(row.key, v)}
                  disabled={isSavingRow}
                  trackColor={{ false: 'rgba(0,0,0,0.12)', true: COLORS.coco }}
                  thumbColor={COLORS.paper}
                  accessibilityLabel={t('notifPrefs.rowA11y', { title })}
                />
              </View>
            );
          })}
        </View>

        <Text style={s.sectionLabel}>{t('notifPrefs.quietHoursLabel')}</Text>
        <View style={s.list}>
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>{t('notifPrefs.quietHoursTitle')}</Text>
              <Text style={s.rowDesc}>{t('notifPrefs.quietHoursDesc')}</Text>
            </View>
            <Switch
              value={qh.enabled}
              onValueChange={toggleQuietHours}
              disabled={saving === 'quiet_hours'}
              trackColor={{ false: 'rgba(0,0,0,0.12)', true: COLORS.coco }}
              thumbColor={COLORS.paper}
              accessibilityLabel={t('notifPrefs.quietEnableA11y')}
            />
          </View>

          {qh.enabled ? (
            <>
              <View style={s.stepperRow}>
                <Text style={s.stepperLabel}>{t('notifPrefs.startsAt')}</Text>
                <View style={s.stepperControls}>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => bumpHour('start_hour', -1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('notifPrefs.earlierStartA11y')}
                  >
                    <Text style={s.stepBtnText}>–</Text>
                  </TouchableOpacity>
                  <Text style={s.stepperValue}>{formatHour(qh.start_hour)}</Text>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => bumpHour('start_hour', 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('notifPrefs.laterStartA11y')}
                  >
                    <Text style={s.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.stepperRow}>
                <Text style={s.stepperLabel}>{t('notifPrefs.endsAt')}</Text>
                <View style={s.stepperControls}>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => bumpHour('end_hour', -1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('notifPrefs.earlierEndA11y')}
                  >
                    <Text style={s.stepBtnText}>–</Text>
                  </TouchableOpacity>
                  <Text style={s.stepperValue}>{formatHour(qh.end_hour)}</Text>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => bumpHour('end_hour', 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('notifPrefs.laterEndA11y')}
                  >
                    <Text style={s.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.tzRow}>
                <Text style={s.tzLabel}>{t('notifPrefs.timezone')}</Text>
                <Text style={s.tzValue}>{qh.tz}</Text>
              </View>
            </>
          ) : null}
        </View>

        <Text style={s.footer}>{t('notifPrefs.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  topTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.bark,
  },
  topLink: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: '#C07840',
  },
  topSpacer: { width: 52, alignItems: 'flex-end' },

  content: { padding: 20, paddingBottom: 48, gap: 16 },

  // v9 editorial masthead
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eyebrowBar: { width: 22, height: 2, backgroundColor: '#A77349', marginRight: 10, borderRadius: 1 },
  eyebrow: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#A77349', letterSpacing: 1.8, textTransform: 'uppercase' },
  headerTitle: {
    fontFamily: FONTS.headerBold, fontSize: 32, color: COLORS.bark,
    lineHeight: 38, letterSpacing: -0.5, marginBottom: 4,
  },
  headerTitleEm: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#C07840' },
  headerRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 6, marginBottom: 4, width: 48,
  },

  lead: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.barkSoft,
    lineHeight: 20,
  },

  list: {
    backgroundColor: COLORS.paper,
    borderRadius: 16,
    overflow: 'hidden',
    // v9 paper lift — wraps all the Switch rows so the prefs panel
    // reads as a single floating card like MeScreen sections.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.bark,
    marginBottom: 2,
  },
  rowDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
    lineHeight: 18,
  },
  rowNote: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16,
    marginTop: 4,
    fontStyle: 'italic',
  },

  footer: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 17,
    marginTop: 4,
  },

  sectionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.barkSoft,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: -4,
    paddingHorizontal: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  stepperLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.bark,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.coco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: '#C07840',
    lineHeight: 20,
  },
  stepperValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.bark,
    minWidth: 80,
    textAlign: 'center',
  },
  tzRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tzLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
  },
  tzValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.bark,
  },
});
