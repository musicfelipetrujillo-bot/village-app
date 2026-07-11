// Milk Connect home — the MARKETPLACE half of the Milk Hub.
//
// Supply is what makes a peer-milk marketplace work, so "Share your milk" is
// the loud, colorful hero (context-aware CTA: become → finish profile → list).
// Below: search + live donors near you (get), the donor's screening profile
// (health questionnaire / trust badge / bloodwork), and how-it's-safe.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  cream: '#FCF7EF', paper: '#FDF7EC',
  rose: '#E06A88', roseInk: '#C2556F', roseTint: '#FDECEF', blush: '#F7C5CB',
  honey: '#F5C842', honeyCard: '#FBE9BE', honeyInk: '#B98A1E',
  cocoa: '#43260F', ink: '#3D2116', walnut: '#8A6A55', sage: '#7B8A46', muted: '#A6957F',
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
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  check: 'M20 6L9 17l-5-5',
  checkC: 'M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  cash: 'M2 7h20v10H2zM12 15a3 3 0 100-6 3 3 0 000 6z',
  clipboard: 'M9 4h6v2H9zM7 4H5v16h14V4h-2M9 12l2 2 4-4',
  drop: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  chev: 'M9 6l6 6-6 6',
} as const;

function Glyph({ d, color, size = 18, sw = 1.8 }: { d: string; color: string; size?: number; sw?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

const AVATAR_TINTS = [['#F3B9C8', '#8A3A54'], ['#FBE0A6', '#8A6A1E'], ['#D7E4C4', '#5B6B37']];

function DonorPreview({ donor, index, onPress }: { donor: DonorSearchResult; index: number; onPress: () => void }) {
  const [bg, fg] = AVATAR_TINTS[index % AVATAR_TINTS.length];
  const badge = donor.badge_level ?? 'none';
  const verified = badge === 'verified' || badge === 'verified_bloodwork';
  const free = donor.price_per_oz <= 0;
  const place = donor.neighborhood ?? donor.city ?? 'nearby';
  return (
    <TouchableOpacity style={styles.dCard} activeOpacity={0.9} onPress={onPress} accessibilityRole="button" accessibilityLabel={donor.display_name}>
      {donor.avatar_url
        ? <Image source={{ uri: donor.avatar_url }} style={styles.dAvatar} />
        : <View style={[styles.dAvatar, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontFamily: FONTS.v2_bold, fontSize: 15, color: fg }}>{donor.display_name.charAt(0)}</Text></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.dNameRow}>
          <Text style={styles.dName} numberOfLines={1}>{donor.display_name}</Text>
          {verified ? <Glyph d={ICON.checkC} color={C.sage} size={15} /> : badge === 'basic' ? <View style={styles.dBasic}><Text style={styles.dBasicText}>basic</Text></View> : null}
        </View>
        <Text style={styles.dMeta} numberOfLines={1}>{place} · {donor.distance_miles.toFixed(1)} mi{donor.review_count > 0 ? ` · ★ ${donor.rating_avg.toFixed(1)}` : ''}</Text>
      </View>
      <View style={styles.dPricePill}>
        <Text style={styles.dPrice}>{free ? 'free' : `$${donor.price_per_oz.toFixed(2)}`}</Text>
        <Text style={styles.dPriceSub}>{free ? 'donates' : '/oz'} · {donor.supply_oz_available}oz</Text>
      </View>
    </TouchableOpacity>
  );
}

function ProfileRow({ d, label, status, done, onPress, last }: { d: string; label: string; status: string; done: boolean; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[styles.pRow, !last && styles.pRowBorder]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${status}`}>
      <View style={[styles.pIcon, { backgroundColor: done ? 'rgba(123,138,70,0.14)' : C.roseTint }]}><Glyph d={d} color={done ? C.sage : C.roseInk} size={16} /></View>
      <Text style={styles.pLabel}>{label}</Text>
      <Text style={[styles.pStatus, { color: done ? C.sage : C.roseInk }]}>{status}</Text>
      <Glyph d={ICON.chev} color="#D0BFAC" size={15} />
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

  useEffect(() => { if (user?.id) fetchDonorData(user.id); }, [user?.id]);

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
      } catch { /* empty */ } finally { if (!cancelled) setLoadingDonors(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={C.rose} /></View>;

  const badgeLevel = trustBadge?.badge_level ?? 'none';
  const qDone = !!trustBadge?.questionnaire_complete;
  const bwDone = !!trustBadge?.bloodwork_linked;
  const dietDone = !!(trustBadge?.diet_disclosed || trustBadge?.medications_disclosed);
  const goBadge = () => donorProfile && navigation.navigate('TrustBadgeBuilder', { donorProfileId: donorProfile.id });

  // Context-aware share CTA — the supply driver.
  const shareCta = !donorProfile
    ? { label: lang === 'es' ? 'Hazte donante' : 'Become a donor', go: () => navigation.navigate('BecomeDonorIntro') }
    : !qDone
      ? { label: lang === 'es' ? 'Completa tu perfil' : 'Finish your profile', go: () => navigation.navigate('DonorQuestionnaire') }
      : { label: lang === 'es' ? '＋ Publicar leche' : '＋ Add a listing', go: () => navigation.navigate('CreateListing', { donorProfileId: donorProfile.id }) };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.brandRow}><View style={styles.brandDot} /><Text style={styles.brand}>milk hub</Text></View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SavedDonors')} accessibilityRole="button" accessibilityLabel={t('milk.saved')}><Glyph d={ICON.heart} color={C.roseInk} size={17} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('MilkMessageThreads')} accessibilityRole="button" accessibilityLabel={t('milk.messagesA11y')}><Glyph d={ICON.chat} color={C.walnut} size={17} /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.toggle}>
          <TouchableOpacity style={styles.toggleSeg} onPress={() => navigation.navigate('MilkVaultDashboard')} accessibilityRole="button" accessibilityLabel={lang === 'es' ? 'Mi reserva' : 'My stash'}><Text style={styles.toggleText}>{lang === 'es' ? 'mi reserva' : 'my stash'}</Text></TouchableOpacity>
          <View style={[styles.toggleSeg, styles.toggleSegActive]}><Text style={styles.toggleTextActive}>{lang === 'es' ? 'mercado' : 'marketplace'}</Text></View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {/* SHARE — the loud supply hero */}
          <LinearGradient colors={['#EE94AC', '#F6C94F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shareHero}>
            <View style={styles.shareHeroTop}>
              <View style={styles.shareHeroIcon}><Glyph d={ICON.drop} color={C.cocoa} size={22} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareHeroTitle}>{lang === 'es' ? 'Comparte tu leche' : 'Share your milk'}</Text>
                <Text style={styles.shareHeroSub}>{lang === 'es' ? 'Convierte tu excedente en ayuda — o ingreso. Tú pones el precio, o dónala.' : 'Turn your extra into help — or income. You set the price, or donate.'}</Text>
              </View>
            </View>
            <View style={styles.shareChips}>
              <View style={styles.shareChip}><Text style={styles.shareChipText}>{lang === 'es' ? 'cuestionario de salud' : 'health questionnaire'}</Text></View>
              <View style={styles.shareChip}><Text style={styles.shareChipText}>{lang === 'es' ? 'análisis' : 'bloodwork'}</Text></View>
              <View style={styles.shareChip}><Text style={styles.shareChipText}>{lang === 'es' ? 'insignia' : 'trust badge'}</Text></View>
            </View>
            <TouchableOpacity style={styles.shareHeroCta} onPress={shareCta.go} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={shareCta.label}>
              <Text style={styles.shareHeroCtaText}>{shareCta.label}</Text>
              <Glyph d={ICON.chev} color="#fff" size={16} />
            </TouchableOpacity>
          </LinearGradient>

          {/* GET — search + donors */}
          <TouchableOpacity style={styles.searchBar} activeOpacity={0.85} onPress={() => navigation.navigate('DonorSearchList')} accessibilityRole="button" accessibilityLabel={t('milk.findDonorTitle')}>
            <Glyph d={ICON.search} color={C.roseInk} size={18} />
            <Text style={styles.searchText}>{lang === 'es' ? 'buscar donantes verificadas' : 'search screened donors'}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('DonorMap')} accessibilityRole="button" accessibilityLabel="Map"><Glyph d={ICON.pin} color={C.walnut} size={16} /></TouchableOpacity>
          </TouchableOpacity>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>{lang === 'es' ? 'donantes cerca de ti' : 'donors near you'}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('DonorSearchList')} accessibilityRole="button"><Text style={styles.sectionLink}>{lang === 'es' ? 'ver todas' : 'see all'}</Text></TouchableOpacity>
          </View>
          {loadingDonors ? (
            <View style={styles.donorLoading}><ActivityIndicator color={C.rose} /></View>
          ) : donors.length > 0 ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              {donors.map((d, i) => <DonorPreview key={d.id} donor={d} index={i} onPress={() => navigation.navigate('DonorProfile', { donorProfileId: d.id })} />)}
            </View>
          ) : (
            <TouchableOpacity style={styles.donorEmpty} onPress={() => navigation.navigate('DonorSearchList')} activeOpacity={0.85}><Text style={styles.donorEmptyText}>{lang === 'es' ? 'Aún no hay donantes cerca — amplía tu búsqueda.' : 'No donors nearby yet — widen your search.'}</Text></TouchableOpacity>
          )}

          {/* Donor's own screening profile (substance) */}
          {donorProfile && (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>{lang === 'es' ? 'tu perfil de donante' : 'your donor profile'}</Text>
                <Text style={[styles.badgePill, { color: BADGE_COLOR[badgeLevel] }]}>{t(BADGE_LABEL_KEYS[badgeLevel])}</Text>
              </View>
              <View style={styles.profileCard}>
                <ProfileRow d={ICON.clipboard} label={lang === 'es' ? 'Cuestionario de salud' : 'Health questionnaire'} status={qDone ? (lang === 'es' ? 'Completo' : 'Complete') : (lang === 'es' ? 'Completar' : 'Complete it')} done={qDone} onPress={() => navigation.navigate('DonorQuestionnaire')} />
                <ProfileRow d={ICON.check} label={lang === 'es' ? 'Insignia de confianza' : 'Trust badge'} status={t(BADGE_LABEL_KEYS[badgeLevel])} done={badgeLevel !== 'none'} onPress={goBadge} />
                <ProfileRow d={ICON.drop} label={lang === 'es' ? 'Análisis de sangre' : 'Bloodwork'} status={bwDone ? (lang === 'es' ? 'Vinculado' : 'Linked') : (lang === 'es' ? 'Opcional' : 'Add · optional')} done={bwDone} onPress={goBadge} />
                <ProfileRow d={ICON.clipboard} label={lang === 'es' ? 'Enlaces sociales' : 'Social links'} status={donorProfile.social_links && Object.keys(donorProfile.social_links).length > 0 ? (lang === 'es' ? 'Añadidos' : 'Added') : (lang === 'es' ? 'Añadir' : 'Add')} done={!!(donorProfile.social_links && Object.keys(donorProfile.social_links).length > 0)} onPress={() => navigation.navigate('DonorSocialLinks', { donorProfileId: donorProfile.id })} last />
              </View>
            </>
          )}

          {/* Trust */}
          <View style={styles.trustCard}>
            <Text style={styles.trustEyebrow}>{lang === 'es' ? 'cómo villie lo mantiene seguro' : 'how villie keeps this safe'}</Text>
            <TrustRow d={ICON.shield} text={lang === 'es' ? 'Cada donante completa una evaluación de salud y estilo de vida.' : 'Every donor completes a health + lifestyle screening.'} />
            <TrustRow d={ICON.checkC} text={lang === 'es' ? 'Las insignias verificadas muestran análisis y cuestionario.' : 'Verified badges show bloodwork + questionnaire status.'} />
            <TrustRow d={ICON.cash} text={lang === 'es' ? 'Efectivo o donación, en persona — Villie nunca maneja el dinero.' : 'Cash or donation, arranged in person — Villie never handles money.'} last />
          </View>
          <Text style={styles.safetyNote}>{t('milk.safetyNote')}</Text>
        </ScrollView>
      </SafeAreaView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.honey },
  brand: { fontFamily: FONTS.v2_bold, fontSize: 17, color: C.ink },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F2E6DD', alignItems: 'center', justifyContent: 'center' },

  toggle: { flexDirection: 'row', backgroundColor: C.track, borderRadius: 999, padding: 4, marginHorizontal: 18, marginBottom: 16 },
  toggleSeg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleSegActive: { backgroundColor: C.rose },
  toggleText: { fontFamily: FONTS.v2_link, fontSize: 13.5, color: C.walnut },
  toggleTextActive: { fontFamily: FONTS.v2_bold, fontSize: 13.5, color: '#fff' },

  shareHero: { borderRadius: 20, padding: 18, marginHorizontal: 18, overflow: 'hidden' },
  shareHeroTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  shareHeroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,252,246,0.55)', alignItems: 'center', justifyContent: 'center' },
  shareHeroTitle: { fontFamily: FONTS.v2_display_big, fontSize: 23, color: C.cocoa, letterSpacing: -0.3 },
  shareHeroSub: { fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 18, color: '#6B3A22', marginTop: 4 },
  shareChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  shareChip: { backgroundColor: 'rgba(255,252,246,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  shareChipText: { fontFamily: FONTS.v2_label, fontSize: 10.5, color: '#8A3A54' },
  shareHeroCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.cocoa, borderRadius: 12, paddingVertical: 13, marginTop: 16 },
  shareHeroCtaText: { fontFamily: FONTS.v2_bold, fontSize: 14.5, color: '#fff' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.14)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 18, marginTop: 18 },
  searchText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13.5, color: C.muted },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginTop: 24, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.12)' },
  sectionLabel: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: C.walnut, fontWeight: '500' },
  sectionLink: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: C.roseInk, fontWeight: '600' },
  badgePill: { fontFamily: FONTS.v2_label, fontSize: 12 },

  donorLoading: { paddingVertical: 30, alignItems: 'center' },
  dCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(224,106,136,0.14)', borderRadius: 16, padding: 12, marginHorizontal: 18 },
  dAvatar: { width: 48, height: 48, borderRadius: 24 },
  dNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dName: { fontFamily: FONTS.v2_bold, fontSize: 14.5, color: C.ink, flexShrink: 1 },
  dBasic: { backgroundColor: C.honeyCard, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  dBasicText: { fontFamily: FONTS.v2_mono, fontSize: 8.5, color: C.honeyInk, fontWeight: '600' },
  dMeta: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 0.6, color: C.walnut, marginTop: 3 },
  dPricePill: { alignItems: 'center', backgroundColor: C.roseTint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  dPrice: { fontFamily: FONTS.v2_display_big, fontSize: 17, color: C.roseInk },
  dPriceSub: { fontFamily: FONTS.v2_body, fontSize: 9.5, color: C.walnut, marginTop: 1 },

  donorEmpty: { marginHorizontal: 18, marginTop: 14, backgroundColor: C.paper, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, padding: 18, alignItems: 'center' },
  donorEmptyText: { fontFamily: FONTS.v2_body, fontSize: 13, color: C.walnut, textAlign: 'center' },

  profileCard: { backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 16, marginHorizontal: 18, marginTop: 14, paddingHorizontal: 14 },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  pRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.07)' },
  pIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pLabel: { flex: 1, fontFamily: FONTS.v2_link, fontSize: 13.5, color: C.ink },
  pStatus: { fontFamily: FONTS.v2_label, fontSize: 12 },

  trustCard: { backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 16, padding: 16, marginHorizontal: 18, marginTop: 24 },
  trustEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: C.walnut, fontWeight: '500', marginBottom: 4 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  trustRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.07)' },
  trustText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 17, color: '#5A4030' },

  safetyNote: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.muted, fontStyle: 'italic', textAlign: 'center', marginHorizontal: 28, marginTop: 14, lineHeight: 15 },
});
