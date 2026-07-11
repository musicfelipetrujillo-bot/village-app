// Milk Connect home — the MARKETPLACE half of the Milk Hub.
//
// Premium reorder (2026-07-10): one story top→bottom — search · live donors
// near you · share · how-it's-safe. Content-forward: real donor preview cards
// instead of a "Find a donor" button. Mirrors the My Stash header + toggle.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useMilkStore } from '@store/milk';
import { searchDonorsNear, type DonorSearchResult } from '@api/milk';
import { getEffectiveCoords } from '@utils/devLocation';
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
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  check: 'M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  cash: 'M2 7h20v10H2zM12 15a3 3 0 100-6 3 3 0 000 6z',
} as const;

function Glyph({ d, color, size = 18, sw = 1.8 }: { d: string; color: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const AVATAR_TINTS = [['#F3B9C8', '#8A3A54'], ['#FBE0A6', '#8A6A1E'], ['#D7E4C4', '#5B6B37']];

function DonorPreview({ donor, index, onPress }: { donor: DonorSearchResult; index: number; onPress: () => void }) {
  const [bg, fg] = AVATAR_TINTS[index % AVATAR_TINTS.length];
  const badge = donor.badge_level ?? 'none';
  const verified = badge === 'verified' || badge === 'verified_bloodwork';
  const free = donor.price_per_oz <= 0;
  const place = donor.neighborhood ?? donor.city ?? 'nearby';
  return (
    <TouchableOpacity style={styles.dCard} activeOpacity={0.88} onPress={onPress} accessibilityRole="button" accessibilityLabel={donor.display_name}>
      {donor.avatar_url
        ? <Image source={{ uri: donor.avatar_url }} style={styles.dAvatar} />
        : <View style={[styles.dAvatar, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontFamily: FONTS.v2_bold, fontSize: 15, color: fg }}>{donor.display_name.charAt(0)}</Text></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.dNameRow}>
          <Text style={styles.dName} numberOfLines={1}>{donor.display_name}</Text>
          {verified
            ? <Glyph d={ICON.check} color={C.sage} size={15} />
            : badge === 'basic' ? <View style={styles.dBasic}><Text style={styles.dBasicText}>basic</Text></View> : null}
        </View>
        <Text style={styles.dMeta} numberOfLines={1}>
          {place} · {donor.distance_miles.toFixed(1)} mi{donor.review_count > 0 ? ` · ★ ${donor.rating_avg.toFixed(1)} (${donor.review_count})` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.dPrice}>{free ? 'free' : `$${donor.price_per_oz.toFixed(2)}`}</Text>
        <Text style={styles.dPriceSub}>{free ? 'donates' : '/oz'} · {donor.supply_oz_available} oz</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MilkConnectHomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const lang = (useUserStore((s) => s.profile?.preferred_language) ?? 'en') as 'en' | 'es';
  const t = useT();
  const { donorProfile, trustBadge, loading, fetchDonorData } = useMilkStore();

  const [donors, setDonors] = useState<DonorSearchResult[]>([]);
  const [loadingDonors, setLoadingDonors] = useState(true);

  useEffect(() => {
    if (user?.id) fetchDonorData(user.id);
  }, [user?.id]);

  // Live "donors near you" preview — best-effort location (no prompt); falls
  // back to the launch-market coords so the marketplace is never empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let coords: { latitude: number; longitude: number } | null = null;
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({}));
          if (pos) coords = pos.coords;
        }
        const { lat, lng } = getEffectiveCoords(coords);
        const results = await searchDonorsNear(lat, lng, { radius_miles: 25 });
        if (!cancelled) setDonors(results.slice(0, 3));
      } catch {
        /* leave empty — the section shows a browse fallback */
      } finally {
        if (!cancelled) setLoadingDonors(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

      <ScrollView contentContainerStyle={{ paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        {/* Search + location */}
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.85} onPress={() => navigation.navigate('DonorSearchList')} accessibilityRole="button" accessibilityLabel={t('milk.findDonorTitle')}>
          <Glyph d={ICON.search} color={C.roseInk} size={18} />
          <Text style={styles.searchText}>{lang === 'es' ? 'buscar donantes verificadas' : 'search screened donors'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DonorMap')} accessibilityRole="button" accessibilityLabel="Map">
            <Glyph d={ICON.pin} color={C.walnut} size={16} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Donors near you */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>{lang === 'es' ? 'donantes cerca de ti' : 'donors near you'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DonorSearchList')} accessibilityRole="button">
            <Text style={styles.sectionLink}>{lang === 'es' ? 'ver todas' : 'see all'}</Text>
          </TouchableOpacity>
        </View>

        {loadingDonors ? (
          <View style={styles.donorLoading}><ActivityIndicator color={C.rose} /></View>
        ) : donors.length > 0 ? (
          <View style={{ gap: 10, marginTop: 14 }}>
            {donors.map((d, i) => (
              <DonorPreview key={d.id} donor={d} index={i} onPress={() => navigation.navigate('DonorProfile', { donorProfileId: d.id })} />
            ))}
          </View>
        ) : (
          <TouchableOpacity style={styles.donorEmpty} onPress={() => navigation.navigate('DonorSearchList')} activeOpacity={0.85}>
            <Text style={styles.donorEmptyText}>{lang === 'es' ? 'Aún no hay donantes cerca — amplía tu búsqueda.' : 'No donors nearby yet — widen your search.'}</Text>
          </TouchableOpacity>
        )}

        {/* GIVE side — the second marketplace path, as a real section */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>{lang === 'es' ? 'comparte tu leche' : 'share your milk'}</Text>
          {donorProfile && (
            <TouchableOpacity onPress={() => navigation.navigate('DonorSocialLinks', { donorProfileId: donorProfile.id })} accessibilityRole="button">
              <Text style={styles.sectionLink}>
                {donorProfile.social_links && Object.keys(donorProfile.social_links).length > 0 ? t('milk.socialCtaEdit') : t('milk.socialCtaAdd')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
          <View style={styles.becomeCard}>
            <View style={styles.becomeHead}>
              <View style={styles.shareIcon}><Glyph d={ICON.droplet} color={C.honeyInk} size={20} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.becomeTitle}>{t('milk.becomeDonorTitle')}</Text>
                <Text style={styles.becomeSub}>{lang === 'es' ? 'Comparte o vende tu leche extra con mamás verificadas cerca — tú pones el precio, o dónala.' : 'Share or sell your extra milk with screened moms nearby — you set the price, or donate.'}</Text>
              </View>
            </View>
            <View style={styles.stepsRow}>
              <Step n="1" label={lang === 'es' ? 'evaluación' : 'get screened'} />
              <View style={styles.stepDash} />
              <Step n="2" label={lang === 'es' ? 'publica' : 'list your milk'} />
              <View style={styles.stepDash} />
              <Step n="3" label={lang === 'es' ? 'conecta' : 'connect · hand off'} />
            </View>
            <TouchableOpacity style={styles.becomeCta} onPress={onShareMilk} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={t('milk.becomeDonorTitle')}>
              <Text style={styles.becomeCtaText}>{lang === 'es' ? 'Empezar' : 'Get started'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* How Villie keeps this safe */}
        <View style={styles.trustCard}>
          <Text style={styles.trustEyebrow}>{lang === 'es' ? 'cómo villie lo mantiene seguro' : 'how villie keeps this safe'}</Text>
          <TrustRow d={ICON.shield} text={lang === 'es' ? 'Cada donante completa una evaluación de salud y estilo de vida.' : 'Every donor completes a health + lifestyle screening.'} />
          <TrustRow d={ICON.check} text={lang === 'es' ? 'Las insignias verificadas muestran análisis y cuestionario.' : 'Verified badges show bloodwork + questionnaire status.'} />
          <TrustRow d={ICON.cash} text={lang === 'es' ? 'Efectivo o donación, en persona — Villie nunca maneja el dinero.' : 'Cash or donation, arranged in person — Villie never handles money.'} last />
        </View>
        <Text style={styles.safetyNote}>{t('milk.safetyNote')}</Text>
      </ScrollView>
    </View>
  );
}

function TrustRow({ d, text, last }: { d: string; text: string; last?: boolean }) {
  return (
    <View style={[styles.trustRow, !last && styles.trustRowBorder]}>
      <Glyph d={d} color={C.sage} size={18} />
      <Text style={styles.trustText}>{text}</Text>
    </View>
  );
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepLabel} numberOfLines={2}>{label}</Text>
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

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.14)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 18 },
  searchText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13.5, color: C.muted },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginTop: 22, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.12)' },
  sectionLabel: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: C.walnut, fontWeight: '500' },
  sectionLink: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: C.roseInk, fontWeight: '600' },

  donorLoading: { paddingVertical: 32, alignItems: 'center' },
  dCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 14, padding: 13, marginHorizontal: 18 },
  dAvatar: { width: 46, height: 46, borderRadius: 23 },
  dNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dName: { fontFamily: FONTS.v2_bold, fontSize: 14.5, color: C.cocoa, flexShrink: 1 },
  dBasic: { backgroundColor: C.honeyCard, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  dBasicText: { fontFamily: FONTS.v2_mono, fontSize: 8.5, color: C.honeyInk, fontWeight: '600' },
  dMeta: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 0.6, color: C.walnut, marginTop: 3 },
  dPrice: { fontFamily: FONTS.v2_display_big, fontSize: 17, color: C.cocoa },
  dPriceSub: { fontFamily: FONTS.v2_body, fontSize: 10, color: C.walnut, marginTop: 1 },

  donorEmpty: { marginHorizontal: 18, marginTop: 14, backgroundColor: C.paper, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, padding: 18, alignItems: 'center' },
  donorEmptyText: { fontFamily: FONTS.v2_body, fontSize: 13, color: C.walnut, textAlign: 'center' },

  shareCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.honeyCard, borderRadius: 16, padding: 15, marginHorizontal: 18, marginTop: 18 },
  shareIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,252,246,0.6)', alignItems: 'center', justifyContent: 'center' },
  shareTitle: { fontFamily: FONTS.v2_bold, fontSize: 15, color: C.cocoa },
  shareSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut, marginTop: 2 },
  shareArrow: { fontSize: 20, color: C.honeyInk },

  becomeCard: { backgroundColor: C.honeyCard, borderRadius: 16, padding: 16, marginHorizontal: 18, marginTop: 14 },
  becomeHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  becomeTitle: { fontFamily: FONTS.v2_bold, fontSize: 16, color: C.cocoa },
  becomeSub: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: '#5A4030', marginTop: 4 },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 2 },
  step: { alignItems: 'center', width: 82 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,252,246,0.7)', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: FONTS.v2_bold, fontSize: 13, color: C.honeyInk },
  stepLabel: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: '#5A4030', textAlign: 'center', marginTop: 6, lineHeight: 13 },
  stepDash: { flex: 1, height: 1, backgroundColor: 'rgba(185,138,30,0.35)', marginTop: 13 },
  becomeCta: { backgroundColor: C.rose, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  becomeCtaText: { fontFamily: FONTS.v2_bold, fontSize: 14.5, color: '#fff' },

  donorStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, padding: 15, marginHorizontal: 18, marginTop: 18 },
  donorLabel: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: 'uppercase', color: C.walnut, fontWeight: '600' },
  donorRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  donorOz: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: C.cocoa },
  donorOzUnit: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.walnut },
  donorBadge: { fontFamily: FONTS.v2_label, fontSize: 12, marginLeft: 6 },
  donorBtn: { backgroundColor: C.rose, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  donorBtnText: { fontFamily: FONTS.v2_bold, fontSize: 13, color: '#fff' },

  manageRow: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  manageText: { fontFamily: FONTS.v2_link, fontSize: 13, color: C.roseInk },

  trustCard: { backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 16, padding: 16, marginHorizontal: 18, marginTop: 22 },
  trustEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: C.walnut, fontWeight: '500', marginBottom: 4 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  trustRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.07)' },
  trustText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 17, color: '#5A4030' },

  safetyNote: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.muted, fontStyle: 'italic', textAlign: 'center', marginHorizontal: 28, marginTop: 14, lineHeight: 15 },
});
