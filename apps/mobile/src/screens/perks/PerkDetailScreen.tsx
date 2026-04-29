// V4 Phase G3 — Perk detail (full description, FTC disclosure, CTA → PerkClaim)
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import {
  perksApi,
  categoryLabel,
  ctaLabelFor,
  disclosureTextFor,
  type PerkDetail,
} from '@api/perks';
import { useT } from '@/i18n';

type TFn = (key: string, params?: Record<string, string | number>) => string;

export default function PerkDetailScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params as { id: string };

  const [perk, setPerk] = useState<PerkDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const row = await perksApi.getPerk(id);
        setPerk(row);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.rust} />
      </View>
    );
  }

  if (!perk) {
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} t={t} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('perkDetail.notAvailableTitle')}</Text>
          <Text style={styles.emptyBody}>{t('perkDetail.notAvailableBody')}</Text>
        </View>
      </View>
    );
  }

  const disclosure = disclosureTextFor(perk.affiliate_network, perk.is_partner);

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} t={t} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.heroBlock}>
          <View style={styles.badgeRow}>
            <Text style={styles.categoryBadge}>{categoryLabel(perk.category).toUpperCase()}</Text>
            {perk.is_partner && <Text style={styles.partnerBadge}>{t('perkDetail.partnerBadge')}</Text>}
          </View>
          <Text style={styles.brandName}>{perk.brand_name}</Text>
          <Text style={styles.title}>{perk.title}</Text>
          {perk.discount_label && <Text style={styles.offerBanner}>{perk.discount_label}</Text>}
        </View>

        <View style={styles.body}>
          <Text style={styles.shortDesc}>{perk.short_description}</Text>
          <Text style={styles.longDesc}>{perk.long_description}</Text>

          {disclosure && (
            <View style={styles.disclosureBlock}>
              <Text style={styles.disclosureLabel}>{t('perkDetail.ftcDisclosureLabel')}</Text>
              <Text style={styles.disclosureBody}>{disclosure}</Text>
            </View>
          )}

          <View style={styles.metaBlock}>
            {perk.ends_at && (
              <MetaRow label={t('perkDetail.metaEnds')} value={new Date(perk.ends_at).toLocaleDateString()} />
            )}
            {perk.eligibility_countries?.length > 0 && (
              <MetaRow label={t('perkDetail.metaRegions')} value={perk.eligibility_countries.join(', ')} />
            )}
            {perk.eligibility_age_tags?.length > 0 && (
              <MetaRow label={t('perkDetail.metaStage')} value={perk.eligibility_age_tags.join(' · ')} />
            )}
          </View>

          {perk.terms_url && (
            <TouchableOpacity
              onPress={() => Linking.openURL(perk.terms_url!)}
              accessibilityRole="link"
            >
              <Text style={styles.termsLink}>{t('perkDetail.termsLink')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('PerkClaim', { id: perk.id })}
          accessibilityRole="button"
          accessibilityLabel={ctaLabelFor(perk)}
        >
          <Text style={styles.ctaText}>{ctaLabelFor(perk)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Header({ onBack, t }: { onBack: () => void; t: TFn }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} accessibilityLabel={t('perkDetail.backA11y')}>
        <Text style={styles.back}>{t('perkDetail.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('perkDetail.title')}</Text>
      <View style={{ width: 50 }} />
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
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

  heroBlock: { padding: 20, backgroundColor: '#FFF' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryBadge: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.2, color: COLORS.olive },
  partnerBadge: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.8, color: COLORS.gold,
    backgroundColor: 'rgba(196,163,90,0.15)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  brandName: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid, marginTop: 10 },
  title: { fontSize: 24, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 4, lineHeight: 30 },
  offerBanner: {
    marginTop: 14, alignSelf: 'flex-start',
    fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#FFF',
    backgroundColor: COLORS.rust, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },

  body: { padding: 20 },
  shortDesc: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, lineHeight: 22 },
  longDesc: { fontSize: 14, color: COLORS.textMid, lineHeight: 22, marginTop: 10 },

  disclosureBlock: {
    marginTop: 20, padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(196,163,90,0.08)',
    borderWidth: 1, borderColor: 'rgba(196,163,90,0.3)',
  },
  disclosureLabel: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.gold, marginBottom: 4 },
  disclosureBody: { fontSize: 12, color: COLORS.textMid, lineHeight: 17 },

  metaBlock: { marginTop: 20, backgroundColor: '#FFF', borderRadius: 12, padding: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  metaLabel: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 13, color: COLORS.brownDeep, fontFamily: FONTS.bodyMedium, flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  termsLink: { fontSize: 13, color: COLORS.rust, fontFamily: FONTS.bodySemiBold, marginTop: 16 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 28,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  cta: {
    backgroundColor: COLORS.yolkLight, borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
  },
  ctaText: { color: COLORS.brownDeep, fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },

  emptyWrap: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 4 },
  emptyBody: { fontSize: 13, color: COLORS.textLight },
});
