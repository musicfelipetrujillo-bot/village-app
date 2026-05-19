import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, TextInput, Modal, Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import {
  getDonorProfile, getDonorReviews, getDonorActiveListing,
  getDietFlags, getTrustBadge, saveDonor, unsaveDonor, isSaved,
  callTrustNarrative, callDonorQA, getOrCreateThread,
} from '@api/milk';
import type { DonorPublicProfile, MilkReview, MilkListing, MilkTrustBadge , DietFlagKey } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type T = ReturnType<typeof useT>;

type Props = NativeStackScreenProps<MilkStackParamList, 'DonorProfile'>;

const BADGE_COLOR = { none: COLORS.textLight, basic: COLORS.statusAlert, verified: COLORS.sageDeep, verified_bloodwork: COLORS.statusSuccess };
const BADGE_LABEL_KEYS: Record<keyof typeof BADGE_COLOR, string> = {
  none: 'donorProfile.badgeNone',
  basic: 'donorProfile.badgeBasic',
  verified: 'donorProfile.badgeVerified',
  verified_bloodwork: 'donorProfile.badgeVerifiedBloodwork',
};

const DIET_LABEL_KEYS: Record<string, string> = {
  dairy_free: 'donorProfile.dietDairyFree',
  organic: 'donorProfile.dietOrganic',
  gluten_free: 'donorProfile.dietGlutenFree',
  vegan: 'donorProfile.dietVegan',
  nut_free: 'donorProfile.dietNutFree',
};

function StarRow({ rating, count, t }: { rating: number; count: number; t: T }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {[1,2,3,4,5].map((s) => (
        <Text key={s} style={{ fontSize: 16, color: s <= Math.round(rating) ? '#C4A35A' : '#E0D5C5' }}>★</Text>
      ))}
      <Text style={{ fontSize: 13, color: '#9A8070', fontFamily: FONTS.bodyMedium }}>
        {Number(rating).toFixed(1)} ({t('donorProfile.reviewsCount', { count })})
      </Text>
    </View>
  );
}

export default function DonorProfileScreen({ route, navigation }: Props) {
  const { donorProfileId } = route.params;
  const user = useAuthStore((s) => s.user);
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en');
  const t = useT();

  const [profile, setProfile] = useState<DonorPublicProfile | null>(null);
  const [badge, setBadge] = useState<MilkTrustBadge | null>(null);
  const [listing, setListing] = useState<MilkListing | null>(null);
  const [reviews, setReviews] = useState<MilkReview[]>([]);
  const [dietFlags, setDietFlags] = useState<DietFlagKey[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // AI Q&A state
  const [qaModalVisible, setQaModalVisible] = useState(false);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaLoading, setQaLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
  }, [donorProfileId]);

  const loadAll = async () => {
    try {
      const [p, b, l, r, df, savedState] = await Promise.all([
        getDonorProfile(donorProfileId),
        getTrustBadge(donorProfileId),
        getDonorActiveListing(donorProfileId),
        getDonorReviews(donorProfileId),
        getDietFlags(donorProfileId),
        user ? isSaved(user.id, donorProfileId) : Promise.resolve(false),
      ]);
      setProfile(p);
      setBadge(b);
      setListing(l);
      setReviews(r);
      setDietFlags(df);
      setSaved(savedState);

      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

      // Load AI narrative async (non-blocking)
      callTrustNarrative(donorProfileId).then(({ narrative: n }) => setNarrative(n)).catch(() => {});
    } catch (err) {
      console.error('DonorProfileScreen loadAll error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user) return;
    setSaved((prev) => !prev);
    try {
      if (saved) await unsaveDonor(user.id, donorProfileId);
      else await saveDonor(user.id, donorProfileId);
    } catch {
      setSaved((prev) => !prev); // rollback
    }
  };

  const handleAskQuestion = async () => {
    if (!qaQuestion.trim()) return;
    setQaLoading(true);
    setQaAnswer(null);
    try {
      const { answer } = await callDonorQA(donorProfileId, qaQuestion.trim());
      setQaAnswer(answer);
    } catch {
      setQaAnswer(t('donorProfile.askError'));
    } finally {
      setQaLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <TouchableOpacity
          style={styles.backBtnAbsolute}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('donorProfile.back')}
        >
          <Text style={styles.backText}>← {t('donorProfile.back')}</Text>
        </TouchableOpacity>
        <ActivityIndicator color="#C07840" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{t('donorProfile.notFound')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>{t('donorProfile.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const badgeLevel = (badge?.badge_level ?? 'none') as keyof typeof BADGE_COLOR;
  const firstName = profile.display_name.split(' ')[0];

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('donorProfile.back')}
          >
            <Text style={styles.backText}>← {t('donorProfile.back')}</Text>
          </TouchableOpacity>

          <View style={styles.heroContent}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{profile.display_name.charAt(0)}</Text>
              </View>
            )}

            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName}>{profile.display_name}</Text>
                <TouchableOpacity onPress={handleSaveToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={[styles.heart, saved && styles.heartSaved]}>{saved ? '♥' : '♡'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.heroLocation}>
                {profile.city ?? ''}{profile.state ? `, ${profile.state}` : ''}
              </Text>

              <View style={[styles.badgePill, { backgroundColor: BADGE_COLOR[badgeLevel] }]}>
                <Text style={styles.badgePillText}>{t(BADGE_LABEL_KEYS[badgeLevel])}</Text>
              </View>

              {profile.review_count > 0 && (
                <StarRow rating={profile.rating_avg ?? 0} count={profile.review_count} t={t} />
              )}
            </View>
          </View>
          {/* v9 editorial hairline rule */}
          <View style={styles.heroRule} />
        </View>

        {/* ── AI Match Narrative ── */}
        {/* v9 hero glass sheen — the AI narrative is the most premium "in
            their voice" moment on the donor profile. Sheen gives it the
            iOS-26 wet-glass top highlight so it reads as a curated, distinct
            beat above the trust/diet/review cards below. */}
        {narrative && (
          <View style={styles.narrativeCard}>
            <GlassHighlight radius={14} height={16} />
            <Text style={styles.narrativeLabel}>{t('donorProfile.narrativeLabel')}</Text>
            <Text style={styles.narrativeText}>{narrative}</Text>
          </View>
        )}

        {/* ── Trust Badge Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('donorProfile.trustTitle')}</Text>
          <View style={[styles.badgeRow, { borderColor: BADGE_COLOR[badgeLevel] }]}>
            <View style={[styles.badgeLarge, { backgroundColor: BADGE_COLOR[badgeLevel] }]}>
              <Text style={styles.badgeLargeText}>{t(BADGE_LABEL_KEYS[badgeLevel])}</Text>
            </View>
            {badge?.ai_safety_score !== null && badge?.ai_safety_score !== undefined && (
              <View style={styles.safetyScore}>
                <Text style={styles.safetyScoreLabel}>{t('donorProfile.aiSafetyScore')}</Text>
                <View style={styles.safetyBar}>
                  <View style={[styles.safetyFill, { width: `${(badge.ai_safety_score / 10) * 100}%` }]} />
                </View>
                <Text style={styles.safetyScoreNum}>{t('donorProfile.safetyScoreNum', { score: badge.ai_safety_score.toFixed(1) })}</Text>
              </View>
            )}
          </View>
          <View style={styles.checklistCompact}>
            {[
              { done: badge?.questionnaire_complete, label: t('donorProfile.checkQuestionnaire') },
              { done: badge?.diet_disclosed, label: t('donorProfile.checkDiet') },
              { done: badge?.medications_disclosed, label: t('donorProfile.checkMeds') },
              { done: badge?.bloodwork_linked, label: t('donorProfile.checkBloodwork') },
            ].map((item, i) => (
              <View key={i} style={styles.checkRow}>
                <Text style={[styles.checkIcon, item.done && styles.checkDone]}>{item.done ? '✓' : '○'}</Text>
                <Text style={[styles.checkLabel, !item.done && styles.checkLabelMuted]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Pricing & Availability ── */}
        {listing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('donorProfile.pricingTitle')}</Text>
            <View style={styles.pricingGrid}>
              <View style={styles.pricingItem}>
                <Text style={styles.pricingValue}>${Number(listing.price_per_oz).toFixed(2)}</Text>
                <Text style={styles.pricingLabel}>{t('donorProfile.perOz')}</Text>
              </View>
              <View style={styles.pricingDivider} />
              <View style={styles.pricingItem}>
                <Text style={styles.pricingValue}>{listing.oz_available}</Text>
                <Text style={styles.pricingLabel}>{t('donorProfile.ozAvailable')}</Text>
              </View>
              <View style={styles.pricingDivider} />
              <View style={styles.pricingItem}>
                <Text style={styles.pricingValue}>{listing.min_order_oz}</Text>
                <Text style={styles.pricingLabel}>{t('donorProfile.ozMinimum')}</Text>
              </View>
            </View>
            <View style={styles.fulfillmentRow}>
              {listing.pickup_available && (
                <View style={styles.fulfillmentChip}>
                  <Text style={styles.fulfillmentText}>{t('donorProfile.pickup')}</Text>
                </View>
              )}
              {listing.shipping_available && (
                <View style={styles.fulfillmentChip}>
                  <Text style={styles.fulfillmentText}>
                    {listing.shipping_price
                      ? t('donorProfile.shippingWithPrice', { price: Number(listing.shipping_price).toFixed(2) })
                      : t('donorProfile.shipping')}
                  </Text>
                </View>
              )}
            </View>
            {listing.notes && (
              <Text style={styles.listingNotes}>{listing.notes}</Text>
            )}
          </View>
        )}

        {/* ── Diet & Medications ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('donorProfile.dietTitle')}</Text>
          {dietFlags.length > 0 ? (
            <View style={styles.dietFlags}>
              {dietFlags.map((flag) => (
                <View key={flag} style={styles.dietChip}>
                  <Text style={styles.dietChipText}>
                    {DIET_LABEL_KEYS[flag] ? t(DIET_LABEL_KEYS[flag]) : `• ${flag.replace(/_/g, ' ')}`}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.dietNone}>{t('donorProfile.dietNone')}</Text>
          )}
          <Text style={styles.medicationStatus}>
            {badge?.medications_disclosed
              ? t('donorProfile.medsDisclosed')
              : t('donorProfile.medsNotDisclosed')}
          </Text>
        </View>

        {/* ── Bio ── */}
        {profile.bio && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('donorProfile.aboutTitle', { name: firstName })}</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* ── Reviews ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {reviews.length > 0
              ? t('donorProfile.reviewsTitleCount', { count: reviews.length })
              : t('donorProfile.reviewsTitle')}
          </Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>{t('donorProfile.noReviews')}</Text>
          ) : (
            reviews.slice(0, 5).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewStars}>
                  {[1,2,3,4,5].map((s) => (
                    <Text key={s} style={{ fontSize: 12, color: s <= review.rating ? '#C4A35A' : '#E0D5C5' }}>★</Text>
                  ))}
                </View>
                {review.body && <Text style={styles.reviewBody}>{review.body}</Text>}
                <Text style={styles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString(
                    lang === 'es' ? 'es-US' : 'en-US',
                    { month: 'short', year: 'numeric' },
                  )}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Safety disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{t('donorProfile.disclaimer')}</Text>
        </View>

        {/* Spacer for sticky action bar */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* ── Sticky Action Bar ── */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={async () => {
            if (!user) return;
            try {
              const thread = await getOrCreateThread(donorProfileId, user.id, listing?.id);
              navigation.navigate('MilkMessageDetail', {
                threadId: thread.id,
                donorProfileId,
                otherDisplayName: profile?.display_name,
              });
            } catch (e: any) {
              Alert.alert(t('donorProfile.openChatErrorTitle'), e.message ?? t('donorProfile.openChatErrorBody'));
            }
          }}
        >
          <Text style={styles.messageBtnText}>{t('donorProfile.messageBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.purchaseBtn}
          onPress={() => navigation.navigate('MilkPurchase', { donorProfileId, listingId: listing?.id ?? '' })}
        >
          <Text style={styles.purchaseBtnText}>{t('donorProfile.purchaseBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── AI Q&A Floating Button ── */}
      <TouchableOpacity
        style={styles.qaFab}
        onPress={() => { setQaModalVisible(true); setQaAnswer(null); setQaQuestion(''); }}
      >
        <Text style={styles.qaFabText}>{t('donorProfile.askFab', { name: firstName })}</Text>
      </TouchableOpacity>

      {/* ── AI Q&A Modal ── */}
      <Modal visible={qaModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('donorProfile.askModalTitle', { name: firstName })}</Text>
            <Text style={styles.modalSub}>{t('donorProfile.askModalSub')}</Text>

            <TextInput
              style={styles.qaInput}
              placeholder={t('donorProfile.askPlaceholder', { name: firstName })}
              value={qaQuestion}
              onChangeText={setQaQuestion}
              multiline
              numberOfLines={3}
              placeholderTextColor="#9A8070"
              textAlignVertical="top"
            />

            {qaLoading && <ActivityIndicator color="#C07840" style={{ marginVertical: 12 }} />}

            {qaAnswer && (
              <View style={styles.qaAnswer}>
                <Text style={styles.qaAnswerLabel}>{t('donorProfile.askAnswerLabel')}</Text>
                <Text style={styles.qaAnswerText}>{qaAnswer}</Text>
              </View>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setQaModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>{t('donorProfile.modalClose')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAsk, (!qaQuestion.trim() || qaLoading) && styles.disabled]}
                onPress={handleAskQuestion}
                disabled={!qaQuestion.trim() || qaLoading}
              >
                <Text style={styles.modalAskText}>{t('donorProfile.modalAsk')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 160 },

  // Hero
  hero: { backgroundColor: COLORS.paper, paddingBottom: 20 },
  backBtn: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12 },
  backBtnAbsolute: { position: 'absolute', top: 56, left: 16 },
  backText: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },
  heroContent: { flexDirection: 'row', paddingHorizontal: 20, gap: 16, alignItems: 'flex-start' },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  avatarPlaceholder: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#F0D9C8', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 30, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },
  heroInfo: { flex: 1, gap: 6 },
  heroRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 18, marginLeft: 20, width: 48,
  },
  heroNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroName: { fontSize: 22, fontFamily: FONTS.headerItalic, color: '#2C1810', flex: 1, marginRight: 8 },
  heart: { fontSize: 26, color: '#C5B8AE' },
  heartSaved: { color: COLORS.coco },
  heroLocation: { fontSize: 13, color: '#9A8070', fontFamily: FONTS.bodyMedium },
  badgePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgePillText: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: '#FDFBF6' },

  // AI Narrative — v9: side-stripe was a v9 absolute ban → full cinnamon hairline.
  narrativeCard: {
    margin: 16, backgroundColor: '#FFF9F0', borderRadius: 14, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(192,120,64,0.35)',
  },
  narrativeLabel: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: '#A77349', marginBottom: 8, letterSpacing: 0.6 },
  narrativeText: { fontSize: 14, color: '#2C1810', lineHeight: 22, fontFamily: FONTS.headerItalic },

  // Cards — v9 paper lift, cocoa drop matching the rest of the app.
  card: {
    margin: 16, marginTop: 0, backgroundColor: COLORS.paper,
    borderRadius: 16, padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  cardTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 14 },

  // Badge
  badgeRow: { borderWidth: 1.5, borderRadius: 12, padding: 16, marginBottom: 14, gap: 12 },
  badgeLarge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 8 },
  badgeLargeText: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#FDFBF6' },
  safetyScore: { gap: 4 },
  safetyScoreLabel: { fontSize: 11, color: '#9A8070', fontFamily: FONTS.bodySemiBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  safetyBar: { height: 6, backgroundColor: '#E0D5C5', borderRadius: 3, overflow: 'hidden' },
  safetyFill: { height: 6, backgroundColor: '#6B7C3F', borderRadius: 3 },
  safetyScoreNum: { fontSize: 13, color: '#6B7C3F', fontFamily: FONTS.bodySemiBold },
  checklistCompact: { gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkIcon: { fontSize: 15, color: '#C5B8AE', width: 20, textAlign: 'center' },
  checkDone: { color: '#6B7C3F' },
  checkLabel: { fontSize: 13, color: '#2C1810', fontFamily: FONTS.bodyMedium },
  checkLabelMuted: { color: '#9A8070', fontFamily: FONTS.body },

  // Pricing
  pricingGrid: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  pricingItem: { flex: 1, alignItems: 'center' },
  pricingValue: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: '#A77349', marginBottom: 2 },
  pricingLabel: { fontSize: 11, color: '#9A8070', fontFamily: FONTS.bodyMedium, textTransform: 'uppercase' },
  pricingDivider: { width: 1, height: 36, backgroundColor: '#E0D5C5' },
  fulfillmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  fulfillmentChip: {
    backgroundColor: '#F0F4E8', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  fulfillmentText: { fontSize: 12, color: '#6B7C3F', fontFamily: FONTS.bodySemiBold },
  listingNotes: { fontSize: 13, color: '#9A8070', lineHeight: 19, marginTop: 4, fontFamily: FONTS.body },

  // Diet
  dietFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dietChip: {
    backgroundColor: '#F0F4E8', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  dietChipText: { fontSize: 12, color: '#6B7C3F', fontFamily: FONTS.bodyMedium },
  dietNone: { fontSize: 14, color: '#9A8070', marginBottom: 10, fontFamily: FONTS.body },
  medicationStatus: { fontSize: 13, color: '#6B5C52', fontFamily: FONTS.headerItalic },

  // Bio
  bioText: { fontSize: 14, color: '#6B5C52', lineHeight: 22, fontFamily: FONTS.body },

  // Reviews
  noReviews: { fontSize: 14, color: '#9A8070', textAlign: 'center', paddingVertical: 12, fontFamily: FONTS.body },
  reviewCard: {
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0E8E0', gap: 4,
  },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewBody: { fontSize: 14, color: '#2C1810', lineHeight: 21, fontFamily: FONTS.body },
  reviewDate: { fontSize: 11, color: '#9A8070', fontFamily: FONTS.body },

  // Disclaimer
  disclaimer: { marginHorizontal: 16, padding: 16, backgroundColor: COLORS.paper, borderRadius: 12 },
  disclaimerText: { fontSize: 12, color: '#9A8070', lineHeight: 18, textAlign: 'center', fontFamily: FONTS.body },

  // Error
  errorText: { fontSize: 16, color: '#9A8070', marginBottom: 16, fontFamily: FONTS.body },
  backLink: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },

  // Action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingBottom: 36, paddingTop: 14,
    backgroundColor: '#FDFBF6', borderTopWidth: 1, borderTopColor: '#E8E0D5',
  },
  // Phase 2a editorial pass — yolk-pill primary + rust outline
  // secondary, mirroring the rest of the app. Pill radius (999) +
  // brownDeep text matches MilkConnect, Home, ExpertsProfile.
  messageBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.coco,
    borderRadius: 999, paddingVertical: 14, alignItems: 'center',
  },
  messageBtnText: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },
  purchaseBtn: { flex: 2, backgroundColor: COLORS.sandSoft, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  purchaseBtnText: { fontSize: 15, color: COLORS.bark, fontFamily: FONTS.bodySemiBold },

  // AI Q&A FAB
  qaFab: {
    position: 'absolute', bottom: 110, right: 16,
    backgroundColor: '#2C1810', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#6B2E0E', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  qaFabText: { fontSize: 13, color: '#FDFBF6', fontFamily: FONTS.bodySemiBold },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 44,
  },
  modalTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#9A8070', marginBottom: 16, fontFamily: FONTS.body },
  qaInput: {
    backgroundColor: '#F5F0E8', borderRadius: 12, padding: 16,
    fontSize: 14, color: '#2C1810', minHeight: 80, borderWidth: 1.5, borderColor: '#E0D5C5', fontFamily: FONTS.body,
  },
  qaAnswer: {
    marginTop: 14, backgroundColor: '#FFF9F0', borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(192,120,64,0.35)',  // v9: ex side-stripe
  },
  qaAnswerLabel: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: '#A77349', marginBottom: 6, letterSpacing: 0.6 },
  qaAnswerText: { fontSize: 14, color: '#2C1810', lineHeight: 21, fontFamily: FONTS.body },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalClose: {
    flex: 1, borderWidth: 1.5, borderColor: '#9A8070',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  modalCloseText: { fontSize: 14, color: '#9A8070', fontFamily: FONTS.bodySemiBold },
  modalAsk: { flex: 2, backgroundColor: '#C07840', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalAskText: { fontSize: 14, color: '#FDFBF6', fontFamily: FONTS.bodySemiBold },
  disabled: { opacity: 0.4 },
});
