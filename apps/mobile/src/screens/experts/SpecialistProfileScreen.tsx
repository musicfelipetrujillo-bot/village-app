// V1 highest-traffic screen — matches MASTER_PLAN § SpecialistProfileScreen
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { cardLift, cardLiftBorder } from '@utils/cardLift';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { useT } from '@/i18n';
import { useExpertsStore } from '@store/experts';
import { useAuthStore } from '@store/auth';
import { ReviewCard } from '@components/experts/ReviewCard';
import { AIAssistantModal } from '@components/experts/AIAssistantModal';
import { ProfileHeroSkeleton, ReviewCardSkeleton } from '@components/shared/SkeletonLoader';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'SpecialistProfile'>;
type InfoTab = 'about' | 'services' | 'insurance' | 'location';

export default function SpecialistProfileScreen({ navigation, route }: Props) {
  const t = useT();
  const TAB_LABEL_KEYS: Record<InfoTab, string> = {
    about: 'specialistProfile.tabAbout',
    services: 'specialistProfile.tabServices',
    insurance: 'specialistProfile.tabInsurance',
    location: 'specialistProfile.tabLocation',
  };
  const { specialistId } = route.params;
  const { selectedSpecialist: spec, reviews, loading, favorites, selectSpecialist, loadReviews, toggleFavorite } = useExpertsStore();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<InfoTab>('about');
  const [aiSummaryVisible, setAiSummaryVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);

  const isFavorited = spec ? favorites.has(spec.id) : false;

  useEffect(() => {
    selectSpecialist(specialistId);
    loadReviews(specialistId);
  }, [specialistId]);

  if (loading || !spec) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{`← ${t('specialistProfile.back')}`}</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ProfileHeroSkeleton />
          <ReviewCardSkeleton />
          <ReviewCardSkeleton />
        </ScrollView>
      </View>
    );
  }

  const isHelp = spec.provider_kind === 'help';

  const handleBook = () => {
    navigation.navigate('Booking', { specialistId: spec.id });
  };

  const handleTelehealth = () => {
    if (spec.telehealth_link) Linking.openURL(spec.telehealth_link);
  };

  const handleMessage = () => {
    navigation.navigate('Messaging', { specialistId: spec.id });
  };

  const handleFavorite = () => {
    if (!user) return;
    toggleFavorite(user.id, spec.id);
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(243,183,156,0.38)', 'rgba(243,183,156,0.11)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{`← ${t('specialistProfile.back')}`}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          {spec.photo_url ? (
            <Image
              source={{ uri: spec.photo_url }}
              style={styles.avatarCircle}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>👩‍⚕️</Text>
            </View>
          )}
          <Text style={styles.heroName}>{spec.full_name}</Text>
          <Text style={styles.heroCredentials}>{spec.credentials}</Text>
          {isHelp && spec.hourly_rate_cents ? (
            <Text style={styles.heroPractice}>${Math.round(spec.hourly_rate_cents / 100)}/hr · you arrange directly</Text>
          ) : spec.practice_name ? (
            <Text style={styles.heroPractice}>{spec.practice_name}</Text>
          ) : null}
          <View style={styles.heroBadges}>
            {isHelp ? (
              spec.background_checked && (
                <View style={[styles.badge, styles.badgeChecked]}>
                  <Text style={styles.badgeText}>🛡 Background-checked</Text>
                </View>
              )
            ) : spec.npi_verified && (
              <View style={[styles.badge, styles.badgeNPI]}>
                <Text style={styles.badgeText}>{t('specialistProfile.badgeNpi')}</Text>
              </View>
            )}
            {!isHelp && spec.telehealth_available && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t('specialistProfile.badgeTelehealth')}</Text>
              </View>
            )}
            {spec.accepting_patients && (
              <View style={[styles.badge, styles.badgeGreen]}>
                <Text style={styles.badgeText}>{isHelp ? 'Available' : t('specialistProfile.badgeAccepting')}</Text>
              </View>
            )}
          </View>
          {/* v9 editorial hairline rule — closes the hero block like
              HomeScreen's greetingRule does for the masthead. */}
          <View style={styles.heroRule} />
        </View>

        {/* Action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleFavorite}
            accessibilityLabel={isFavorited ? t('specialistProfile.actionSaveA11ySaved') : t('specialistProfile.actionSaveA11yUnsaved')}
            accessibilityRole="button"
          >
            <Text style={styles.actionIcon}>{isFavorited ? '❤️' : '🤍'}</Text>
            <Text style={styles.actionLabel}>{t('specialistProfile.actionSave')}</Text>
          </TouchableOpacity>
          {isHelp ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleMessage}
              accessibilityLabel={`Contact ${spec.full_name}`}
              accessibilityRole="button"
            >
              <Text style={styles.actionBtnPrimaryText}>Contact</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={handleBook}
                accessibilityLabel={t('specialistProfile.actionBookA11y', { name: spec.full_name })}
                accessibilityRole="button"
              >
                <Text style={styles.actionBtnPrimaryText}>{t('specialistProfile.actionBook')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleMessage}
                accessibilityLabel={t('specialistProfile.actionMessageA11y', { name: spec.full_name })}
                accessibilityRole="button"
              >
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionLabel}>{t('specialistProfile.actionMessage')}</Text>
              </TouchableOpacity>
            </>
          )}
          {spec.telehealth_available && spec.telehealth_link && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleTelehealth}
              accessibilityLabel={t('specialistProfile.actionVirtualA11y')}
              accessibilityRole="button"
            >
              <Text style={styles.actionIcon}>📱</Text>
              <Text style={styles.actionLabel}>{t('specialistProfile.actionVirtual')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Rating row */}
        <View style={styles.ratingRow}>
          <Text style={styles.stars}>{'★'.repeat(Math.round(spec.rating_avg))}{'☆'.repeat(5 - Math.round(spec.rating_avg))}</Text>
          <Text style={styles.ratingNum}>{spec.rating_avg.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>{t('specialistProfile.reviewsCount', { count: spec.review_count })}</Text>
          {spec.review_summary_cache && (
            <TouchableOpacity onPress={() => setAiSummaryVisible(!aiSummaryVisible)}>
              <Text style={styles.aiSummaryBtn}>{t('specialistProfile.aiSummaryBtn')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AI Summary (expandable) */}
        {aiSummaryVisible && spec.review_summary_cache && (
          <View style={styles.aiSummaryCard}>
            <Text style={styles.aiSummaryTitle}>{t('specialistProfile.aiSummaryTitle')}</Text>
            <Text style={styles.aiSummaryText}>{spec.review_summary_cache}</Text>
          </View>
        )}

        {/* Info tabs */}
        <View style={styles.tabs}>
          {(isHelp ? (['about', 'services', 'location'] as InfoTab[]) : (['about', 'services', 'insurance', 'location'] as InfoTab[])).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {t(TAB_LABEL_KEYS[tab])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content — v9 hero glass sheen on the lifted tab body so the
            tab → content transition has the iOS-26 wet-glass top highlight. */}
        <View style={styles.tabContent}>
          <GlassHighlight radius={14} height={16} />
          {activeTab === 'about' && (
            <Text style={styles.bio}>{spec.bio ?? t('specialistProfile.noBio')}</Text>
          )}

          {activeTab === 'services' && (
            <View style={styles.infoList}>
              {(spec.services ?? []).length === 0 ? (
                <Text style={styles.emptyTabText}>{t('specialistProfile.noServices')}</Text>
              ) : (
                spec.services!.map((svc) => (
                  <View key={svc.id} style={styles.infoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>{svc.service_name}</Text>
                      {svc.description ? (
                        <Text style={styles.infoSub}>{svc.description}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.infoValue}>
                      {svc.price_cents ? t('specialistProfile.servicePriceAmount', { amount: Math.round(svc.price_cents / 100) }) : t('specialistProfile.servicePriceContact')}
                      {svc.duration_min ? t('specialistProfile.serviceDuration', { minutes: svc.duration_min }) : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'insurance' && (
            <View style={styles.infoList}>
              {(spec.insurances ?? []).length === 0 ? (
                <Text style={styles.emptyTabText}>{t('specialistProfile.noInsurance')}</Text>
              ) : (
                spec.insurances!.map((ins) => (
                  <View key={ins} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>✓ {ins}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'location' && (
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('specialistProfile.rowAddress')}</Text>
                <Text style={styles.infoValue}>
                  {[spec.address_line1, spec.city, spec.state].filter(Boolean).join(', ')}
                </Text>
              </View>
              {spec.distance_miles != null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('specialistProfile.rowDistance')}</Text>
                  <Text style={styles.infoValue}>{t('specialistProfile.rowDistanceVal', { miles: spec.distance_miles.toFixed(1) })}</Text>
                </View>
              )}
              {spec.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('specialistProfile.rowPhone')}</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${spec.phone}`)}>
                    <Text style={[styles.infoValue, { color: COLORS.coco }]}>{spec.phone}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>{t('specialistProfile.reviewsTitle')}</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyTabText}>{t('specialistProfile.noReviews')}</Text>
          ) : (
            reviews.map((r) => <ReviewCard key={r.id} review={r} />)
          )}
          <TouchableOpacity
            style={styles.writeReviewBtn}
            onPress={() => navigation.navigate('ReviewSubmit', { specialistId: spec.id })}
          >
            <Text style={styles.writeReviewText}>{t('specialistProfile.writeReview')}</Text>
          </TouchableOpacity>
        </View>

        {/* AI Assistant rail */}
        <TouchableOpacity style={styles.aiRail} onPress={() => setAiModalVisible(true)} activeOpacity={0.85}>
          <Text style={styles.aiRailTitle}>{t('specialistProfile.aiRailTitle')}</Text>
          <View style={styles.aiRailChip}>
            <Text style={styles.aiRailChipText}>{t('specialistProfile.aiRailAsk', { name: spec.full_name.split(' ').pop() ?? '' })}</Text>
          </View>
          <View style={styles.aiRailChip}>
            <Text style={styles.aiRailChipText}>{t('specialistProfile.aiRailQuestions')}</Text>
          </View>
        </TouchableOpacity>

        <AIAssistantModal
          visible={aiModalVisible}
          onClose={() => setAiModalVisible(false)}
          specialist={spec}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backBtn: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  backText: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodyMedium },

  content: { paddingBottom: 100 },

  hero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.cocoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 40 },
  heroName: {
    fontFamily: FONTS.headerItalic,
    fontSize: 24,
    color: COLORS.bark,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroCredentials: { fontSize: 14, color: COLORS.barkSoft, marginBottom: 2, fontFamily: FONTS.body },
  heroPractice: { fontSize: 13, color: COLORS.textLight, marginBottom: 10, fontFamily: FONTS.body },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  heroRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 16, width: 48, alignSelf: 'center',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeGreen: { backgroundColor: '#F2E6DD' },
  badgeNPI: { backgroundColor: '#F2E6DD' },
  badgeChecked: { backgroundColor: '#FDECEF' },
  badgeText: { fontSize: 11, fontFamily: FONTS.bodyMedium, color: COLORS.barkSoft },

  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: { alignItems: 'center', gap: 2, padding: 8 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 10, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },
  // Yolk-pill primary CTA (Phase 2a editorial pass) — matches Home,
  // Milk, and other primary buttons app-wide. brownDeep text on yolk
  // reads warmer than the prior rust filled button.
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: COLORS.sandSoft,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnPrimaryText: { color: COLORS.bark, fontSize: 15, fontFamily: FONTS.bodySemiBold },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  stars: { fontSize: 16, color: COLORS.sand },
  ratingNum: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  ratingCount: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.body },
  aiSummaryBtn: { fontSize: 12, color: '#7A4A24', fontFamily: FONTS.bodyMedium },

  // AI summary — was flat butter-cream that blended into the page wash;
  // now paper-lifted v3 card.
  aiSummaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.v2_card,
    borderRadius: 12,
    padding: 16,
    ...cardLiftBorder,
    ...cardLift,
  },
  aiSummaryTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.sand, marginBottom: 6 },
  aiSummaryText: { fontSize: 13, color: COLORS.bark, lineHeight: 20, fontFamily: FONTS.body },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 0,
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.cream },
  tabText: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },
  tabTextActive: { color: COLORS.bark },

  tabContent: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 16,
    // v9 paper lift — cocoa drop matching every other v9 surface
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#43260F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 5,
  },
  bio: { fontSize: 14, color: COLORS.bark, lineHeight: 22, fontFamily: FONTS.body },
  infoList: { gap: 0 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoLabel: { fontSize: 14, color: COLORS.textLight, flex: 1, fontFamily: FONTS.body },
  infoSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2, fontFamily: FONTS.body },
  infoValue: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: COLORS.bark, maxWidth: '50%', textAlign: 'right' },
  emptyTabText: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingVertical: 12, fontFamily: FONTS.body },

  reviewsSection: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontFamily: FONTS.headerItalic,
    fontSize: 20,
    color: '#D96C88',  // v9 rust-deep — unified italic accent
    marginBottom: 12,
  },
  writeReviewBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.coco,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  writeReviewText: { color: '#7A4A24', fontSize: 14, fontFamily: FONTS.bodyMedium },

  aiRail: {
    marginHorizontal: 16,
    backgroundColor: COLORS.barkSoft,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  aiRailTitle: { color: '#FFFCF6', fontSize: 14, fontFamily: FONTS.bodySemiBold },
  aiRailChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  aiRailChipText: { color: '#FFFCF6', fontSize: 13, fontFamily: FONTS.bodyMedium },
});
