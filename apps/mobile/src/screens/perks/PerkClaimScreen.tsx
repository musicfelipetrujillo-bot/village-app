// V4 Phase G3 — Perk claim (modal)
// Calls claim_perk RPC which records the click + returns redemption payload.
// Branches on redemption_method: show code / open link / open sample form.
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { tap, confirm } from '@utils/haptics';
import { perksApi, disclosureTextFor, type ClaimResult, type PerkDetail } from '@api/perks';
import { usePerksStore } from '@store/perks';
import { useT } from '@/i18n';

export default function PerkClaimScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params as { id: string };
  const { fetchMyClaims } = usePerksStore();

  const [perk, setPerk] = useState<PerkDetail | null>(null);
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [detail, result] = await Promise.all([
          perksApi.getPerk(id),
          perksApi.claimPerk(id),
        ]);
        setPerk(detail);
        setClaim(result);
        // Refresh My Claims so it's in sync when user navigates there.
        fetchMyClaims();
      } catch (e: any) {
        setError(e.message ?? t('perkClaim.errorGeneric'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, fetchMyClaims, t]);

  const copyCode = async () => {
    if (!claim?.discount_code) return;
    tap();
    await Clipboard.setStringAsync(claim.discount_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openClickUrl = async () => {
    confirm();
    if (!claim?.click_url) return;
    const can = await Linking.canOpenURL(claim.click_url);
    if (!can) {
      Alert.alert(t('perkClaim.cannotOpenLinkTitle'), t('perkClaim.cannotOpenLinkBody'));
      return;
    }
    Linking.openURL(claim.click_url);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#D96C88" size="large" />
      </View>
    );
  }

  if (error || !perk || !claim) {
    return (
      <View style={styles.container}>
        <View style={styles.closeBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('perkClaim.closeA11y')}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerBlock}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>{t('perkClaim.errorTitle')}</Text>
          <Text style={styles.errorBody}>{error ?? t('perkClaim.errorBody')}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>{t('perkClaim.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const disclosure = disclosureTextFor(perk.affiliate_network, perk.is_partner);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.closeBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('perkClaim.closeA11y')}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.centerBlock}>
        <Text style={styles.okEmoji}>🎁</Text>
        <Text style={styles.brand}>{perk.brand_name}</Text>
        <Text style={styles.title}>{perk.title}</Text>

        {claim.redemption_method === 'show_code' && claim.discount_code && (
          <>
            <Text style={styles.instruction}>{t('perkClaim.yourCode')}</Text>
            <TouchableOpacity style={styles.codeBox} onPress={copyCode} accessibilityRole="button">
              <Text style={styles.codeText}>{claim.discount_code}</Text>
              <Text style={styles.codeCopy}>{copied ? t('perkClaim.copied') : t('perkClaim.tapToCopy')}</Text>
            </TouchableOpacity>
            {claim.click_url && (
              <TouchableOpacity style={styles.primaryBtn} onPress={openClickUrl}>
                <Text style={styles.primaryBtnText}>{t('perkClaim.openBrandSite')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {claim.redemption_method === 'tap_link' && claim.click_url && (
          <>
            <Text style={styles.instruction}>
              {t('perkClaim.tapLinkInstruction')}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={openClickUrl}>
              <Text style={styles.primaryBtnText}>
                {perk.deal_type === 'partner_offer' ? t('perkClaim.openPartnerOffer') : t('perkClaim.openAffiliateLink')}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {claim.redemption_method === 'request_sample' && claim.click_url && (
          <>
            <Text style={styles.instruction}>
              {t('perkClaim.sampleInstruction')}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={openClickUrl}>
              <Text style={styles.primaryBtnText}>{t('perkClaim.openSampleRequest')}</Text>
            </TouchableOpacity>
          </>
        )}

        {disclosure && <Text style={styles.disclosure}>{disclosure}</Text>}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('MyClaims')}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>{t('perkClaim.seeMyPerks')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  closeBar: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8,
    alignItems: 'flex-end',
  },
  close: { fontSize: 22, color: COLORS.barkSoft, fontFamily: FONTS.bodySemiBold, padding: 4 },

  centerBlock: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20 },
  okEmoji: { fontSize: 56, marginBottom: 12 },
  brand: { fontSize: 14, color: COLORS.barkSoft, fontFamily: FONTS.bodySemiBold },
  title: {
    fontSize: 22, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    marginTop: 6, textAlign: 'center', lineHeight: 28,
  },

  instruction: {
    fontSize: 14, color: COLORS.barkSoft, marginTop: 28, marginBottom: 12,
    textAlign: 'center',
  },

  codeBox: {
    backgroundColor: COLORS.paper, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.coco, borderStyle: 'dashed',
    paddingVertical: 18, paddingHorizontal: 28,
    alignItems: 'center', minWidth: 240,
  },
  codeText: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', letterSpacing: 1.5 },
  codeCopy: { fontSize: 11, color: COLORS.textLight, marginTop: 6, fontFamily: FONTS.bodySemiBold },

  // v9 canonical CTA — rect variant
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#D96C88', borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
    minWidth: 240, alignItems: 'center',
    shadowColor: '#D96C88', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  primaryBtnText: { color: '#FFFCF6', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },

  secondaryBtn: {
    marginTop: 24,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  secondaryBtnText: { color: '#D96C88', fontSize: 14, fontFamily: FONTS.bodySemiBold },

  disclosure: {
    fontSize: 11, color: COLORS.textLight, marginTop: 24,
    textAlign: 'center', lineHeight: 16, paddingHorizontal: 12,
  },

  errorEmoji: { fontSize: 44, marginBottom: 8 },
  errorTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 4 },
  errorBody: { fontSize: 13, color: COLORS.barkSoft, marginTop: 4, textAlign: 'center' },
});
