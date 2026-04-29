// V4 Phase G4 — Gear listing detail (no messaging/payments yet — those are G6/G8)
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, Linking,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import {
  gearApi,
  categoryLabel,
  conditionLabel,
  formatPrice,
  getOrCreateGearThread,
  ackGearSafeMeeting,
  hasAcceptedGearLegal,
  recordGearLegalAcceptance,
  logGearEvent,
  type GearListingDetail,
} from '@api/gear';
import CPSCBadge from '@components/gear/CPSCBadge';
import SafeMeetingGuideModal from '@components/gear/SafeMeetingGuideModal';
import GearLegalDisclosureModal from '@components/gear/GearLegalDisclosureModal';
import ReportListingModal from '@components/gear/ReportListingModal';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';

type ParamList = { GearListingDetail: { id: string } };
type TFn = (key: string, params?: Record<string, string | number>) => string;

const { width: SCREEN_W } = Dimensions.get('window');

export default function GearListingDetailScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'GearListingDetail'>>();
  const { id } = route.params;

  const [listing, setListing] = useState<GearListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // G6 message flow state
  const authUser = useAuthStore((s) => s.user);
  const profile  = useUserStore((s) => s.profile);
  const [legalVisible, setLegalVisible] = useState(false);
  const [safeVisible, setSafeVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [pendingThread, setPendingThread] = useState<null | {
    threadId: string; listingId: string; sellerUserId: string;
  }>(null);
  const [openingThread, setOpeningThread] = useState(false);
  const [acking, setAcking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gearApi.getListing(id);
      setListing(data);
      if (data) {
        logGearEvent('gear_listing_viewed', {
          listing_id: id,
          category: data.category,
          cpsc_recall_status: data.cpsc_recall_status ?? null,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[gearDetail] load', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleSave = async () => {
    if (!listing || saving) return;
    setSaving(true);
    try {
      if (listing.is_saved) {
        await gearApi.unsaveListing(listing.id);
        setListing({ ...listing, is_saved: false, save_count: Math.max(0, listing.save_count - 1) });
        logGearEvent('gear_listing_unsaved', { listing_id: listing.id }).catch(() => {});
      } else {
        await gearApi.saveListing(listing.id);
        setListing({ ...listing, is_saved: true, save_count: listing.save_count + 1 });
        logGearEvent('gear_listing_saved', { listing_id: listing.id }).catch(() => {});
      }
    } catch (err) {
      Alert.alert(t('gearDetail.errSave'), err instanceof Error ? err.message : t('gearDetail.errTryAgain'));
    } finally {
      setSaving(false);
    }
  };

  const openInMaps = () => {
    if (!listing?.pickup_city) return;
    const q = encodeURIComponent(listing.pickup_city);
    Linking.openURL(`https://maps.apple.com/?q=${q}`).catch(() => {});
  };

  // ── G6 message flow ──────────────────────────────────────────────────────
  const isOwnListing = !!(listing && authUser && listing.seller_id === authUser.id);

  /**
   * Entry point for "Message seller": gates behind
   *   1. Gear Marketplace Addendum acceptance (once per user per version)
   *   2. Safe Meeting Guide ack (once per thread)
   * and only THEN navigates to the chat.
   */
  const onTapMessageSeller = async () => {
    if (!listing || !authUser || !profile) {
      Alert.alert(t('gearDetail.errSignInTitle'), t('gearDetail.errSignInBody'));
      return;
    }
    if (isOwnListing) {
      Alert.alert(t('gearDetail.errOwnTitle'), t('gearDetail.errOwnBody'));
      return;
    }
    if (listing.status !== 'active' && listing.status !== 'pending' && listing.status !== 'sold') {
      Alert.alert(t('gearDetail.errUnavailableTitle'), t('gearDetail.errUnavailableBody'));
      return;
    }

    try {
      setOpeningThread(true);
      const accepted = await hasAcceptedGearLegal(profile.id, 'gear_marketplace_addendum_v1');
      if (!accepted) {
        setLegalVisible(true);
        return;
      }
      await startOrResumeThread();
    } catch (err) {
      Alert.alert(t('gearDetail.errOpenThread'), err instanceof Error ? err.message : t('gearDetail.errTryAgain'));
    } finally {
      setOpeningThread(false);
    }
  };

  /** Called after Gear Legal Addendum accepted (or already on file). */
  const startOrResumeThread = async () => {
    if (!listing) return;
    const thread = await getOrCreateGearThread(listing.id);
    setPendingThread({
      threadId: thread.thread_id,
      listingId: thread.listing_id,
      sellerUserId: thread.seller_user_id,
    });
    if (!thread.safe_meeting_ack_at) {
      logGearEvent('gear_safe_meeting_shown', { thread_id: thread.thread_id }).catch(() => {});
      setSafeVisible(true);
    } else {
      goToChat(thread.thread_id);
    }
  };

  const onLegalAccepted = async () => {
    setLegalVisible(false);
    try {
      await startOrResumeThread();
    } catch (err) {
      Alert.alert(t('gearDetail.errOpenThread'), err instanceof Error ? err.message : t('gearDetail.errTryAgain'));
    }
  };

  const onSafeMeetingAccepted = async () => {
    if (!pendingThread || !profile) return;
    setAcking(true);
    try {
      await ackGearSafeMeeting(pendingThread.threadId);
      await recordGearLegalAcceptance(profile.id, 'gear_safe_meeting_v1', {
        thread_id: pendingThread.threadId,
        listing_id: pendingThread.listingId,
      });
      logGearEvent('gear_safe_meeting_accepted', { thread_id: pendingThread.threadId }).catch(() => {});
      setSafeVisible(false);
      goToChat(pendingThread.threadId);
    } catch (err) {
      Alert.alert(t('gearDetail.errContinue'), err instanceof Error ? err.message : t('gearDetail.errTryAgain'));
    } finally {
      setAcking(false);
    }
  };

  const goToChat = (threadId: string) => {
    if (!listing) return;
    navigation.navigate('GearMessageDetail', {
      threadId,
      listingId: listing.id,
      listingTitle: listing.title,
      otherDisplayName: listing.seller_name ?? t('gearDetail.sellerLabel'),
      isSellerSide: false,
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.rust} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('gearDetail.backA11y')}>
            <Text style={styles.back}>{t('gearDetail.back')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>{t('gearDetail.notFound')}</Text>
      </View>
    );
  }

  const images = listing.images.length > 0
    ? listing.images
    : [{ id: 'placeholder', url: '', sort: 0 }];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('gearDetail.backA11y')}>
          <Text style={styles.back}>{t('gearDetail.back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleSave}
          disabled={saving}
          accessibilityLabel={listing.is_saved ? t('gearDetail.saveA11ySaved') : t('gearDetail.saveA11yUnsaved')}
          accessibilityState={{ selected: listing.is_saved }}
        >
          <Text style={styles.saveIcon}>{listing.is_saved ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
        >
          {images.map((img) => (
            img.url ? (
              <Image key={img.id} source={{ uri: img.url }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View key={img.id} style={[styles.heroImage, styles.heroImageFallback]}>
                <Text style={styles.heroImageFallbackText}>{t('gearDetail.noPhoto')}</Text>
              </View>
            )
          ))}
        </ScrollView>

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <Text style={styles.categoryBadge}>{categoryLabel(listing.category).toUpperCase()}</Text>
            {listing.cpsc_recall_status === 'clear' && <CPSCBadge size="sm" />}
            {listing.status !== 'active' && (
              <Text style={styles.statusBadge}>{listing.status.toUpperCase()}</Text>
            )}
          </View>

          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>
            {formatPrice(listing.price_cents, listing.is_free, listing.currency)}
          </Text>

          <View style={styles.metaGrid}>
            <MetaRow label={t('gearDetail.metaCondition')} value={conditionLabel(listing.condition)} />
            {listing.brand && <MetaRow label={t('gearDetail.metaBrand')} value={listing.brand} />}
            {listing.model && <MetaRow label={t('gearDetail.metaModel')} value={listing.model} />}
            {listing.year_manufactured != null && (
              <MetaRow label={t('gearDetail.metaYear')} value={String(listing.year_manufactured)} />
            )}
            {listing.subcategory && <MetaRow label={t('gearDetail.metaType')} value={listing.subcategory} />}
            <MetaRow label={t('gearDetail.metaPickup')} value={listing.pickup_city} />
          </View>

          {listing.age_tags.length > 0 && (
            <View style={styles.tagsRow}>
              {listing.age_tags.map((tag) => (
                <Text key={tag} style={styles.tag}>{tag}</Text>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('gearDetail.sectionDescription')}</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>

          <View style={styles.sellerBlock}>
            {listing.seller_avatar_url ? (
              <Image source={{ uri: listing.seller_avatar_url }} style={styles.sellerAvatar} />
            ) : (
              <View style={[styles.sellerAvatar, styles.sellerAvatarFallback]}>
                <Text style={styles.sellerAvatarInitial}>
                  {listing.seller_name?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerLabel}>{t('gearDetail.sellerLabel')}</Text>
              <Text style={styles.sellerName}>{listing.seller_name ?? t('gearDetail.sellerFallback')}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.mapsBtn} onPress={openInMaps} accessibilityRole="button">
            <Text style={styles.mapsBtnText}>{t('gearDetail.openInMaps')}</Text>
          </TouchableOpacity>

          <View style={styles.safetyBlock}>
            <Text style={styles.safetyTitle}>{t('gearDetail.safetyTitle')}</Text>
            <Text style={styles.safetyBody}>
              {t('gearDetail.safetyBody')}
            </Text>
          </View>

          <Text style={styles.stats}>
            {t('gearDetail.stats', { views: listing.view_count, saves: listing.save_count })}
          </Text>

          {!isOwnListing && (
            <TouchableOpacity
              style={styles.reportLink}
              onPress={() => setReportVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('gearDetail.reportA11y')}
            >
              <Text style={styles.reportLinkText}>{t('gearDetail.reportLink')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.messageBtn, (isOwnListing || openingThread) && styles.messageBtnDisabled]}
          onPress={onTapMessageSeller}
          disabled={isOwnListing || openingThread}
          accessibilityRole="button"
        >
          {openingThread ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.messageBtnText}>
              {isOwnListing ? t('gearDetail.messageOwn') : t('gearDetail.messageSeller')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* G6 gates */}
      <GearLegalDisclosureModal
        visible={legalVisible}
        onClose={() => setLegalVisible(false)}
        onAccepted={onLegalAccepted}
        transactionContext={{ listing_id: listing.id }}
      />
      <SafeMeetingGuideModal
        visible={safeVisible}
        onClose={() => { setSafeVisible(false); setPendingThread(null); }}
        onAccepted={onSafeMeetingAccepted}
        submitting={acking}
      />
      <ReportListingModal
        visible={reportVisible}
        listingId={listing.id}
        listingTitle={listing.title}
        onClose={() => setReportVisible(false)}
        onSubmitted={() => setReportVisible(false)}
      />
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
  notFound: { textAlign: 'center', marginTop: 80, color: COLORS.textLight, fontFamily: FONTS.body },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  saveIcon: { fontSize: 24, color: COLORS.rust },

  content: { paddingBottom: 120 },
  carousel: { height: SCREEN_W * 0.75 },
  heroImage: { width: SCREEN_W, height: SCREEN_W * 0.75, backgroundColor: COLORS.cream },
  heroImageFallback: { alignItems: 'center', justifyContent: 'center' },
  heroImageFallbackText: { color: COLORS.textLight, fontSize: 14, fontFamily: FONTS.bodySemiBold },

  body: { padding: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  categoryBadge: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1, color: COLORS.olive },
  statusBadge: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid,
    backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },

  title: { fontSize: 24, fontFamily: FONTS.headerItalic, color: COLORS.brownDeep, marginTop: 4, lineHeight: 30 },
  price: { fontSize: 26, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark, marginTop: 8 },

  metaGrid: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginTop: 16,
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaLabel: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },
  metaValue: { fontSize: 13, color: COLORS.brownDeep, fontFamily: FONTS.bodySemiBold },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tag: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid,
    backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },

  section: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1,
    color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 8,
  },
  description: { fontSize: 14, color: COLORS.textMid, lineHeight: 21, fontFamily: FONTS.body },

  sellerBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginTop: 16,
  },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.cream },
  sellerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  sellerAvatarInitial: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.rust },
  sellerLabel: { fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.8, textTransform: 'uppercase' },
  sellerName: { fontSize: 15, color: COLORS.brownDeep, fontFamily: FONTS.bodySemiBold, marginTop: 2 },

  mapsBtn: {
    backgroundColor: '#FFF', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 12,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)',
  },
  mapsBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark },

  safetyBlock: {
    backgroundColor: 'rgba(196,163,90,0.12)', borderRadius: 14,
    padding: 14, marginTop: 16,
  },
  safetyTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 6, letterSpacing: 0.4 },
  safetyBody: { fontSize: 12, color: COLORS.textMid, lineHeight: 19, fontFamily: FONTS.body },

  stats: { fontSize: 11, color: COLORS.textLight, marginTop: 16, textAlign: 'center', fontFamily: FONTS.body },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 28,
    backgroundColor: COLORS.cream, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  // Phase 2a editorial pass — yolk-pill primary CTA, brownDeep text on
  // yolkLight, pill radius matching app-wide primary pattern.
  messageBtn: {
    backgroundColor: COLORS.yolkLight, borderRadius: 999,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  messageBtnDisabled: { backgroundColor: COLORS.textLight, opacity: 0.7 },
  messageBtnText: { color: COLORS.brownDeep, fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },

  reportLink: {
    marginTop: 20, alignSelf: 'center',
    paddingVertical: 8, paddingHorizontal: 14,
  },
  reportLinkText: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.bodySemiBold },
});
