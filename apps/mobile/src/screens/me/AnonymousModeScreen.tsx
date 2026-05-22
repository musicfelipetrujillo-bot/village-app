// AnonymousModeScreen — V3 C3 onboarding for anonymous community participation.
//
// This is the user-facing toggle + explainer for `users.anonymous_mode_default`
// (migration 069). When ON, every community room the user joins gets an
// automatically-generated anonymous alias (e.g. TulipMama_4w) instead of
// their real name + avatar.
//
// Screen lives in MeNavigator. The Connect tab is currently hidden so this
// screen has no surface in production yet — it's foundation work that
// activates when V3 Community ships.
//
// What the user sees:
//   - Title + 2-paragraph explainer
//   - Big toggle for "Use anonymous mode by default"
//   - Below the toggle, a sample alias preview (regeneratable) so they
//     can see what their handle would look like before opting in
//   - "How aliases work" disclosure (no PII tracked, etc.)
//   - Existing aliases list (collapsed by default) showing which alias
//     they've used in which room
//
// What the user does NOT see (intentional):
//   - A "delete my alias history" button — DB rows persist for legal
//     audit trail per Risk & Compliance §3.2. Aliases are pseudonymous,
//     not anonymous, and we can't drop them mid-conversation without
//     breaking message attribution.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useAnalytics } from '@hooks/useAnalytics';
import {
  generateAnonAlias, listMyAnonIdentities, setAnonymousModeDefault,
  type AnonIdentityListRow, type AnonAliasResult,
} from '@/api/community';
import type { MeStackParamList } from '@/navigation/MeNavigator';

type Props = NativeStackScreenProps<MeStackParamList, 'AnonymousMode'>;

export default function AnonymousModeScreen({ navigation }: Props) {
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);
  const { trackEvent } = useAnalytics();

  // Local toggle state — optimistic flip with revert on RPC failure.
  const [enabled, setEnabled] = useState<boolean>(profile?.anonymous_mode_default ?? false);
  const [saving, setSaving] = useState(false);

  // Preview state — a non-persisted candidate alias the user can
  // regenerate to get a feel for what aliases look like.
  const [preview, setPreview] = useState<AnonAliasResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  // List of aliases the user has used in past rooms.
  const [identities, setIdentities] = useState<AnonIdentityListRow[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadIdentities = useCallback(async () => {
    try {
      const rows = await listMyAnonIdentities();
      setIdentities(rows);
    } catch (e) {
      console.warn('list anon identities', e);
    } finally {
      setIdentitiesLoading(false);
      setRefreshing(false);
    }
  }, []);

  // First-load: identities + one preview alias so the screen has visual
  // content immediately. The preview is throw-away — generating it
  // doesn't touch the DB.
  useEffect(() => {
    loadIdentities();
    (async () => {
      setPreviewBusy(true);
      try {
        const p = await generateAnonAlias({ preview: true });
        setPreview(p);
      } catch (e) {
        console.warn('alias preview', e);
      } finally {
        setPreviewBusy(false);
      }
    })();
  }, [loadIdentities]);

  const onToggle = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    setEnabled(next); // optimistic
    try {
      await setAnonymousModeDefault(next);
      // Mirror to the local profile store so other screens see it.
      if (profile) setProfile({ ...profile, anonymous_mode_default: next });
      trackEvent('anonymous_mode_toggled', { enabled: next });
    } catch (e: any) {
      setEnabled(!next); // revert
      console.warn('toggle anon mode', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const onRegeneratePreview = async () => {
    if (previewBusy) return;
    setPreviewBusy(true);
    try {
      const p = await generateAnonAlias({ preview: true });
      setPreview(p);
      trackEvent('anonymous_alias_regenerated', { context: 'preview' });
    } catch (e) {
      console.warn('regenerate preview', e);
    } finally {
      setPreviewBusy(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadIdentities();
  }, [loadIdentities]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('anonMode.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C07840" />}
      >
        <Text style={styles.lead}>{t('anonMode.lead')}</Text>

        {/* Toggle */}
        <View style={styles.toggleCard}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>{t('anonMode.toggleTitle')}</Text>
            <Text style={styles.toggleDesc}>{t('anonMode.toggleDesc')}</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            disabled={saving}
            trackColor={{ false: '#D1C5AC', true: '#C07840' }}
            thumbColor={enabled ? '#FDFBF6' : '#FDFBF6'}
            accessibilityLabel={t('anonMode.toggleTitle')}
            accessibilityState={{ checked: enabled }}
          />
        </View>

        {/* Preview alias */}
        <Text style={styles.sectionLabel}>{t('anonMode.previewLabel')}</Text>
        <View style={styles.previewCard}>
          {previewBusy && !preview ? (
            <ActivityIndicator color="#C07840" />
          ) : preview ? (
            <>
              <Text style={styles.previewAlias}>{preview.alias}</Text>
              <Text style={styles.previewHint}>{t('anonMode.previewHint')}</Text>
            </>
          ) : (
            <Text style={styles.previewHint}>{t('anonMode.previewError')}</Text>
          )}
          <TouchableOpacity
            onPress={onRegeneratePreview}
            disabled={previewBusy}
            style={styles.regenerateBtn}
            accessibilityRole="button"
            accessibilityLabel={t('anonMode.regenerateA11y')}
          >
            <Text style={styles.regenerateText}>
              {previewBusy ? '…' : t('anonMode.regenerate')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* How it works */}
        <Text style={styles.sectionLabel}>{t('anonMode.howItWorksLabel')}</Text>
        <View style={styles.howCard}>
          <Text style={styles.howItem}>· {t('anonMode.how1')}</Text>
          <Text style={styles.howItem}>· {t('anonMode.how2')}</Text>
          <Text style={styles.howItem}>· {t('anonMode.how3')}</Text>
          <Text style={styles.howItem}>· {t('anonMode.how4')}</Text>
        </View>

        {/* Your aliases (collapsed cards) */}
        {identitiesLoading ? (
          <View style={styles.centerSmall}><ActivityIndicator color="#C07840" /></View>
        ) : identities.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('anonMode.yoursLabel')}</Text>
            {identities.map((id) => (
              <View key={`${id.room_id}-${id.anon_alias}`} style={styles.identityRow}>
                <Text style={styles.identityAlias}>{id.anon_alias}</Text>
                <Text style={styles.identityRoom}>{id.room_name}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.footerHint}>{t('anonMode.footerHint')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  back: { fontSize: 14, color: COLORS.coco, fontFamily: FONTS.bodySemiBold, width: 60 },
  headerTitle: { fontSize: 18, color: COLORS.bark, fontFamily: FONTS.headerBold },

  scroll: { padding: 20, paddingBottom: 60 },

  lead: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 21, marginBottom: 24,
  },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 18, marginBottom: 24,
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  toggleTitle: {
    fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 18,
  },

  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: '#A77349',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },

  previewCard: {
    padding: 18, marginBottom: 24,
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  previewAlias: {
    fontSize: 24, fontFamily: FONTS.headerBold, color: '#C07840',
    marginBottom: 4,
  },
  previewHint: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.barkSoft,
    textAlign: 'center', marginBottom: 12,
  },
  previewError: {
    fontSize: 12, fontFamily: FONTS.body, color: '#B3261E', textAlign: 'center',
  },
  regenerateBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5, borderColor: '#C07840',
  },
  regenerateText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#C07840' },

  howCard: {
    padding: 18, marginBottom: 24,
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  howItem: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.bark,
    lineHeight: 20, marginBottom: 6,
  },

  centerSmall: { paddingVertical: 24, alignItems: 'center' },

  identityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  identityAlias: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#C07840' },
  identityRoom: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.barkSoft },

  footerHint: {
    fontSize: 11, fontFamily: FONTS.body, color: COLORS.barkSoft,
    textAlign: 'center', marginTop: 24, lineHeight: 17,
  },
});
