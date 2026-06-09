// V4 Gear — Boost listing (paid promotion) offer screen.
//
// Reached only when EXPO_PUBLIC_GEAR_BOOST_ENABLED='1' (gated at every entry
// point). Boost is an Apple In-App Purchase (digital service) — see
// src/lib/boost.ts + docs/V4_GEAR_BOOST_RUNBOOK.md. Until the StoreKit SDK
// ships in Build 14, the CTA surfaces a "launching soon" state.
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useGearStore } from '@store/gear';
import { boostRemainingLabel, isListingBoosted } from '@api/gear';
import {
  GEAR_BOOST, purchaseGearBoost, BoostUnavailableError, BoostCancelledError,
} from '@/lib/boost';

const T = {
  paper:     COLORS.v2_paper,      // #FFFCF6
  cream:     COLORS.v2_cream,      // #FCF7EF
  parchment: COLORS.v2_parchment,
  cocoa:     COLORS.v2_cocoa,      // #43260F
  walnut:    COLORS.v2_walnut,
  rose:      COLORS.v2_cinnamon,   // #D96C88 — action
  honey:     COLORS.v2_marigold,   // #F4C53C — single accent
  blush:     COLORS.v2_blush,
  rule:      'rgba(61,31,14,0.13)',
};

export default function BoostListingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { listingId, listingTitle, boostedUntil } = (route.params ?? {}) as {
    listingId: string; listingTitle?: string; boostedUntil?: string | null;
  };
  const fetchMyListings = useGearStore((s) => s.fetchMyListings);
  const [busy, setBusy] = React.useState(false);

  const alreadyBoosted = isListingBoosted(boostedUntil);
  const remaining = boostRemainingLabel(boostedUntil);

  const onBoost = async () => {
    setBusy(true);
    try {
      const res = await purchaseGearBoost(listingId);
      if (res.ok) {
        try { await fetchMyListings?.(); } catch {}
        Alert.alert(
          alreadyBoosted ? 'Boost extended' : 'You’re boosted',
          alreadyBoosted
            ? 'Your listing keeps its top spot in Baby Gear.'
            : 'Your listing is now at the top of Baby Gear browse.',
          [{ text: 'Done', onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert('Hmm', res.error ?? 'Could not activate the boost. Please try again.');
      }
    } catch (e) {
      if (e instanceof BoostCancelledError) {
        // user backed out — no-op
      } else if (e instanceof BoostUnavailableError) {
        Alert.alert('Launching soon', 'Boost arrives with our next app update. Hang tight.');
      } else {
        Alert.alert('Something went wrong', (e as Error)?.message ?? 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 60 }} />
        <Text style={styles.headerTitle}>Boost</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ width: 60, alignItems: 'flex-end' }}
        >
          <Text style={styles.close}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>✦  BABY GEAR</Text>
        <Text style={styles.title}>
          Get seen <Text style={styles.titleAccent}>first.</Text>
        </Text>
        <Text style={styles.sub}>
          {alreadyBoosted
            ? `“${listingTitle ?? 'Your listing'}” is boosted${remaining ? ` — ${remaining}.` : '.'}`
            : `Put “${listingTitle ?? 'your listing'}” at the top of Baby Gear browse for ${GEAR_BOOST.durationDays} days, with a Boosted badge so parents nearby spot it first.`}
        </Text>

        {/* Mini preview — what a boosted card looks like at the top of browse. */}
        <View style={styles.previewWrap}>
          <Text style={styles.previewLabel}>TOP OF BROWSE</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewThumb} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.boostBadge}>
                <Text style={styles.boostBadgeText}>✦ Boosted</Text>
              </View>
              <Text style={styles.previewTitle} numberOfLines={1}>{listingTitle ?? 'Your listing'}</Text>
              <Text style={styles.previewMeta}>Seen before everything else</Text>
            </View>
          </View>
          <View style={[styles.previewCard, styles.previewCardMuted]}>
            <View style={[styles.previewThumb, { opacity: 0.5 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewTitle, { opacity: 0.5 }]} numberOfLines={1}>Other listings</Text>
              <Text style={[styles.previewMeta, { opacity: 0.5 }]}>Sorted by distance</Text>
            </View>
          </View>
        </View>

        {/* What you get */}
        <View style={styles.benefits}>
          {[
            ['⬆️', 'Top placement', `First in browse for ${GEAR_BOOST.durationDays} days`],
            ['✦', 'Boosted badge', 'Parents see it’s featured at a glance'],
            ['🔁', 'Stacks', 'Boost again any time to keep the spot'],
          ].map(([emoji, head, body]) => (
            <View key={head} style={styles.benefitRow}>
              <Text style={styles.benefitEmoji}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitHead}>{head}</Text>
                <Text style={styles.benefitBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Compliance fine print — boost is placement only; the sale stays cash/P2P. */}
        <Text style={styles.fine}>
          One-time charge through the App Store. Boost promotes placement only — it doesn’t change the in-person, cash or peer-to-peer handoff, and it isn’t an endorsement of the item. Non-refundable once your listing goes live at the top.
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, busy && { opacity: 0.6 }]}
          onPress={onBoost}
          disabled={busy}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={alreadyBoosted ? 'Extend boost' : `Boost listing for ${GEAR_BOOST.priceLabel}`}
          accessibilityState={{ busy }}
        >
          {busy
            ? <ActivityIndicator color="#FFFCF6" />
            : (
              <Text style={styles.ctaText}>
                {alreadyBoosted ? `Extend · ${GEAR_BOOST.priceLabel}` : `Boost for ${GEAR_BOOST.priceLabel}`}
              </Text>
            )}
        </TouchableOpacity>
        <Text style={styles.footerNote}>{GEAR_BOOST.durationDays} days · cancel anytime, it just won’t renew</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: T.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  headerTitle: { fontSize: 17, fontFamily: FONTS.v2_bold, color: T.cocoa },
  close: { fontSize: 15, color: T.rose, fontFamily: FONTS.v2_link },

  eyebrow: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.4, color: T.walnut, marginBottom: 10 },
  title: { fontFamily: FONTS.v2_display, fontSize: 30, color: T.cocoa, lineHeight: 34 },
  titleAccent: { fontFamily: FONTS.v2_display_italic, color: T.rose },
  sub: { fontFamily: FONTS.v2_body, fontSize: 14.5, lineHeight: 21, color: T.walnut, marginTop: 10 },

  previewWrap: {
    marginTop: 20, backgroundColor: T.paper, borderRadius: 16, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  previewLabel: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.8, color: T.walnut, marginBottom: 10 },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.cream,
    borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: T.rose,
  },
  previewCardMuted: { marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule },
  previewThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: T.blush },
  boostBadge: {
    alignSelf: 'flex-start', backgroundColor: T.honey, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4,
  },
  boostBadgeText: { fontFamily: FONTS.v2_bold, fontSize: 10, color: T.cocoa, letterSpacing: 0.3 },
  previewTitle: { fontFamily: FONTS.v2_bold, fontSize: 13.5, color: T.cocoa },
  previewMeta: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 1 },

  benefits: { marginTop: 20, gap: 14 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  benefitEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  benefitHead: { fontFamily: FONTS.v2_bold, fontSize: 14, color: T.cocoa },
  benefitBody: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: T.walnut, marginTop: 1, lineHeight: 17 },

  fine: { fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 17, color: T.walnut, marginTop: 22, opacity: 0.9 },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30,
    backgroundColor: T.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  cta: {
    backgroundColor: T.rose, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { fontFamily: FONTS.v2_bold, fontSize: 16, color: '#FFFCF6' },
  footerNote: { fontFamily: FONTS.v2_body, fontSize: 11, color: T.walnut, textAlign: 'center', marginTop: 8 },
});
