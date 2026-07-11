// Milk Connect home — the MARKETPLACE half of the Milk Hub.
//
// Cleaned up 2026-07-10 (was "all over the place": masthead + donor card +
// vault card + two-up tiles + two captions). Now mirrors the My Stash
// dashboard: shared header, a my-stash|marketplace toggle, one clear
// "find screened milk" focal, a share path, and a quiet donor strip.

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useMilkStore } from '@store/milk';
import { FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkHome'>;

const C = {
  cream: '#FCF7EF', paper: '#FFFCF6',
  rose: '#E06A88', roseInk: '#C2556F', roseTint: '#FDECEF', blush: '#F7C5CB',
  honey: '#F5C842', honeyCard: '#FBE9BE', honeyInk: '#B98A1E',
  cocoa: '#3D2116', walnut: '#8A6A55', sage: '#7B8A46', muted: '#A6957F',
  track: '#F0E6D6', hair: 'rgba(61,31,14,0.08)',
};

const BADGE_LABEL_KEYS: Record<string, string> = {
  none: 'milk.badgeNone', basic: 'milk.badgeBasic',
  verified: 'milk.badgeVerified', verified_bloodwork: 'milk.badgeVerifiedBloodwork',
};
const BADGE_COLOR: Record<string, string> = {
  none: '#8A6A55', basic: C.honeyInk, verified: '#E98A6A', verified_bloodwork: C.sage,
};

const ICON = {
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
  chat: 'M4 5h16v11H9l-4 4V5z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
} as const;

function Glyph({ d, color, size = 18, sw = 1.8 }: { d: string; color: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function MilkConnectHomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const lang = (useUserStore((s) => s.profile?.preferred_language) ?? 'en') as 'en' | 'es';
  const t = useT();
  const { donorProfile, trustBadge, loading, fetchDonorData } = useMilkStore();

  useEffect(() => {
    if (user?.id) fetchDonorData(user.id);
  }, [user?.id]);

  const onShareMilk = () =>
    donorProfile
      ? navigation.navigate('CreateListing', { donorProfileId: donorProfile.id })
      : navigation.navigate('BecomeDonorIntro');

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.rose} />
      </View>
    );
  }

  const badgeLevel = trustBadge?.badge_level ?? 'none';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>milk hub</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SavedDonors')} accessibilityRole="button" accessibilityLabel={t('milk.saved')}>
            <Glyph d={ICON.heart} color={C.roseInk} size={17} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('MilkMessageThreads')} accessibilityRole="button" accessibilityLabel={t('milk.messagesA11y')}>
            <Glyph d={ICON.chat} color={C.walnut} size={17} />
          </TouchableOpacity>
        </View>
      </View>

      {/* my stash | marketplace toggle (marketplace active) */}
      <View style={styles.toggle}>
        <TouchableOpacity style={styles.toggleSeg} onPress={() => navigation.navigate('MilkVaultDashboard')} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Mi reserva' : 'My stash'}>
          <Text style={styles.toggleText}>{lang === 'es' ? 'mi reserva' : 'my stash'}</Text>
        </TouchableOpacity>
        <View style={[styles.toggleSeg, styles.toggleSegActive]}>
          <Text style={styles.toggleTextActive}>{lang === 'es' ? 'mercado' : 'marketplace'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Find screened milk — the primary marketplace action */}
        <TouchableOpacity style={styles.findCard} activeOpacity={0.92} onPress={() => navigation.navigate('DonorSearchList')} accessibilityRole="button" accessibilityLabel={t('milk.findDonorTitle')}>
          <View style={styles.findIcon}><Glyph d={ICON.search} color={C.roseInk} size={22} /></View>
          <Text style={styles.findTitle}>{t('milk.findDonorTitle')}</Text>
          <Text style={styles.findSub}>{t('milk.findDonorTileSub')}</Text>
          <View style={styles.findFooter}>
            <Text style={styles.findCta}>{t('milk.findTileCta')}</Text>
            <Text style={styles.findArrow}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Donor strip (existing donors) OR share path (everyone else) */}
        {donorProfile ? (
          <View style={styles.donorStrip}>
            <View style={{ flex: 1 }}>
              <Text style={styles.donorLabel}>{lang === 'es' ? 'estás compartiendo' : "you're sharing"}</Text>
              <View style={styles.donorRow}>
                <Text style={styles.donorOz}>{donorProfile.supply_oz_available}<Text style={styles.donorOzUnit}> {t('milk.ozAvailable')}</Text></Text>
                <Text style={[styles.donorBadge, { color: BADGE_COLOR[badgeLevel] }]}>· {t(BADGE_LABEL_KEYS[badgeLevel])}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.donorBtn} onPress={onShareMilk} accessibilityRole="button" accessibilityLabel={t('milk.addListingA11y')}>
              <Text style={styles.donorBtnText}>{t('milk.addListing')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.shareCard} activeOpacity={0.92} onPress={onShareMilk} accessibilityRole="button" accessibilityLabel={t('milk.becomeDonorTitle')}>
            <View style={styles.shareIcon}><Glyph d={ICON.droplet} color={C.honeyInk} size={20} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shareTitle}>{t('milk.becomeDonorTitle')}</Text>
              <Text style={styles.shareSub}>{t('milk.shareTileSub')}</Text>
            </View>
            <Text style={styles.shareArrow}>›</Text>
          </TouchableOpacity>
        )}

        {donorProfile && (
          <TouchableOpacity onPress={() => navigation.navigate('DonorSocialLinks', { donorProfileId: donorProfile.id })} style={styles.manageRow} accessibilityRole="button">
            <Text style={styles.manageText}>
              {donorProfile.social_links && Object.keys(donorProfile.social_links).length > 0 ? t('milk.socialCtaEdit') : t('milk.socialCtaAdd')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Trust + safety — one quiet block */}
        <Text style={styles.trustCaption}>{t('milk.donorTrustCaption')}</Text>
        <Text style={styles.safetyNote}>{t('milk.safetyNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream, paddingTop: 56 },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.honey },
  brand: { fontFamily: FONTS.v2_bold, fontSize: 17, color: C.cocoa },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F2E6DD', alignItems: 'center', justifyContent: 'center' },

  toggle: { flexDirection: 'row', backgroundColor: C.track, borderRadius: 999, padding: 4, marginHorizontal: 18, marginBottom: 16 },
  toggleSeg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleSegActive: { backgroundColor: C.rose },
  toggleText: { fontFamily: FONTS.v2_link, fontSize: 13.5, color: C.walnut },
  toggleTextActive: { fontFamily: FONTS.v2_bold, fontSize: 13.5, color: '#fff' },

  findCard: { backgroundColor: C.blush, borderRadius: 18, padding: 18, marginHorizontal: 18, minHeight: 150, justifyContent: 'space-between' },
  findIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,252,246,0.55)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  findTitle: { fontFamily: FONTS.v2_display_big, fontSize: 24, color: C.cocoa, letterSpacing: -0.4 },
  findSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: '#7A3548', marginTop: 6, lineHeight: 18, maxWidth: '90%' },
  findFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(155,75,96,0.28)' },
  findCta: { fontFamily: FONTS.v2_link, fontSize: 13, color: '#7A3548' },
  findArrow: { fontFamily: FONTS.v2_bold, fontSize: 16, color: '#7A3548' },

  shareCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.honeyCard, borderRadius: 16, padding: 15, marginHorizontal: 18, marginTop: 14 },
  shareIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,252,246,0.6)', alignItems: 'center', justifyContent: 'center' },
  shareTitle: { fontFamily: FONTS.v2_bold, fontSize: 15, color: C.cocoa },
  shareSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut, marginTop: 2 },
  shareArrow: { fontSize: 20, color: C.honeyInk },

  donorStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, padding: 15, marginHorizontal: 18, marginTop: 14 },
  donorLabel: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: 'uppercase', color: C.walnut, fontWeight: '600' },
  donorRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  donorOz: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: C.cocoa },
  donorOzUnit: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut },
  donorBadge: { fontFamily: FONTS.v2_label, fontSize: 12, marginLeft: 6 },
  donorBtn: { backgroundColor: C.rose, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  donorBtnText: { fontFamily: FONTS.v2_bold, fontSize: 13, color: '#fff' },

  manageRow: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  manageText: { fontFamily: FONTS.v2_link, fontSize: 13, color: C.roseInk },

  trustCaption: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: C.walnut, textAlign: 'center', marginHorizontal: 28, marginTop: 22, lineHeight: 18 },
  safetyNote: { fontFamily: FONTS.v2_body, fontSize: 11, color: C.muted, fontStyle: 'italic', textAlign: 'center', marginHorizontal: 28, marginTop: 10, lineHeight: 16 },
});
