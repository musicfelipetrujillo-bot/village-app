// V1 highest-traffic screen — matches MASTER_PLAN § SpecialistProfileScreen
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
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
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{`← ${t('specialistProfile.back')}`}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>👩‍⚕️</Text>
          </View>
          <Text style={styles.heroName}>{spec.full_name}</Text>
          <Text style={styles.heroCredentials}>{spec.credentials}</Text>
          {spec.practice_name ? (
            <Text style={styles.heroPractice}>{spec.practice_name}</Text>
          ) : null}
          <View style={styles.heroBadges}>
            {spec.npi_verified && (
              <View style={[styles.badge, styles.badgeNPI]}>
                <Text style={styles.badgeText}>{t('specialistProfile.badgeNpi')}</Text>
              </View>
            )}
            {spec.telehealth_available && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t('specialistProfile.badgeTelehealth')}</Text>
              </View>
            )}
            {spec.accepting_patients && (
              <View style={[styles.badge, styles.badgeGreen]}>
                <Text style={styles.badgeText}>{t('specialistProfile.badgeAccepting')}</Text>
              </View>
            )}
          </View>
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
          {(['about', 'services', 'insurance', 'location'] as InfoTab[]).map((tab) => (
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

        {/* Tab content */}
        <View style={styles.tabContent}>
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
                    <Text style={[styles.infoValue, { color: COLORS.rust }]}>{spec.phone}</Text>
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
  container: { flex: 1, backgroundColor: COLORS.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backBtn: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  backText: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodyMedium },

  content: { paddingBottom: 100 },

  hero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.rustLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 40 },
  heroName: {
    fontFamily: FONTS.headerItalic,
    fontSize: 24,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroCredentials: { fontSize: 14, color: COLORS.textMid, marginBottom: 2, fontFamily: FONTS.body },
  heroPractice: { fontSize: 13, color: COLORS.textLight, marginBottom: 10, fontFamily: FONTS.body },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeGreen: { backgroundColor: '#EEF2E6' },
  badgeNPI: { backgroundColor: '#EEF2E6' },
  badgeText: { fontSize: 11, fontFamily: FONTS.bodyMedium, color: COLORS.textMid },

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
    backgroundColor: COLORS.yolkLight,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnPrimaryText: { color: COLORS.brownDeep, fontSize: 15, fontFamily: FONTS.bodySemiBold },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  stars: { fontSize: 16, color: COLORS.gold },
  ratingNum: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.textDark },
  ratingCount: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.body },
  aiSummaryBtn: { fontSize: 12, color: COLORS.rust, fontFamily: FONTS.bodyMedium },

  aiSummaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFF8E8',
    borderRadius: 12,
    padding: 14,
  },
  aiSummaryTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.gold, marginBottom: 6 },
  aiSummaryText: { fontSize: 13, color: COLORS.textDark, lineHeight: 20, fontFamily: FONTS.body },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 0,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.cream },
  tabText: { fontSize: 12, color: COLORS.textLight, fontFamily: FONTS.bodyMedium },
  tabTextActive: { color: COLORS.textDark },

  tabContent: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
  },
  bio: { fontSize: 14, color: COLORS.textDark, lineHeight: 22, fontFamily: FONTS.body },
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
  infoValue: { fontSize: 14, fontFamily: FONTS.bodyMedium, color: COLORS.textDark, maxWidth: '50%', textAlign: 'right' },
  emptyTabText: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingVertical: 12, fontFamily: FONTS.body },

  reviewsSection: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontFamily: FONTS.headerItalic,
    fontSize: 20,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  writeReviewBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.rust,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  writeReviewText: { color: COLORS.rust, fontSize: 14, fontFamily: FONTS.bodyMedium },

  aiRail: {
    marginHorizontal: 16,
    backgroundColor: COLORS.brownMid,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  aiRailTitle: { color: 'white', fontSize: 14, fontFamily: FONTS.bodySemiBold },
  aiRailChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  aiRailChipText: { color: 'white', fontSize: 13, fontFamily: FONTS.bodyMedium },
});
