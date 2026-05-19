// Reusable shimmer skeleton for loading states
// Uses Animated API — no extra deps required
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '@utils/constants';

interface SkeletonBoxProps {
  width?: ViewStyle['width'];
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// Single animated shimmer box
export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: 'rgba(0,0,0,0.08)' },
        { opacity },
        style,
      ]}
    />
  );
}

// Specialist list card skeleton
export function SpecialistCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBox width={52} height={52} borderRadius={14} />
      <View style={styles.cardBody}>
        <SkeletonBox width="70%" height={15} borderRadius={6} />
        <SkeletonBox width="50%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
        <SkeletonBox width="40%" height={11} borderRadius={6} style={{ marginTop: 5 }} />
      </View>
      <View style={styles.cardRight}>
        <SkeletonBox width={48} height={13} borderRadius={6} />
        <SkeletonBox width={52} height={30} borderRadius={50} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

// Specialist profile hero skeleton
export function ProfileHeroSkeleton() {
  return (
    <View style={styles.profileHero}>
      <SkeletonBox width={88} height={88} borderRadius={44} style={{ alignSelf: 'center' }} />
      <SkeletonBox width="55%" height={22} borderRadius={8} style={{ alignSelf: 'center', marginTop: 14 }} />
      <SkeletonBox width="40%" height={14} borderRadius={6} style={{ alignSelf: 'center', marginTop: 7 }} />
      <SkeletonBox width="35%" height={12} borderRadius={6} style={{ alignSelf: 'center', marginTop: 5 }} />
      <View style={styles.profileBadges}>
        <SkeletonBox width={100} height={26} borderRadius={50} />
        <SkeletonBox width={120} height={26} borderRadius={50} />
      </View>
    </View>
  );
}

// Review card skeleton
export function ReviewCardSkeleton() {
  return (
    <View style={styles.reviewCard}>
      <SkeletonBox width="40%" height={14} borderRadius={6} />
      <SkeletonBox width="90%" height={13} borderRadius={6} style={{ marginTop: 10 }} />
      <SkeletonBox width="75%" height={13} borderRadius={6} style={{ marginTop: 6 }} />
    </View>
  );
}

// Full experts list loading state (3 stacked card skeletons)
export function ExpertsListSkeleton() {
  return (
    <View style={styles.listContainer}>
      <SpecialistCardSkeleton />
      <SpecialistCardSkeleton />
      <SpecialistCardSkeleton />
    </View>
  );
}

// Generic gear/marketplace card with thumbnail on the left
export function GearCardSkeleton() {
  return (
    <View style={styles.gearCard}>
      <SkeletonBox width={88} height={88} borderRadius={10} />
      <View style={styles.gearBody}>
        <SkeletonBox width="35%" height={10} borderRadius={4} />
        <SkeletonBox width="80%" height={14} borderRadius={6} style={{ marginTop: 6 }} />
        <SkeletonBox width="55%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
        <View style={styles.gearMetaRow}>
          <SkeletonBox width={56} height={12} borderRadius={6} />
          <SkeletonBox width={70} height={12} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}

export function GearListSkeleton() {
  return (
    <View style={styles.listContainer}>
      <GearCardSkeleton />
      <GearCardSkeleton />
      <GearCardSkeleton />
    </View>
  );
}

// Event card (full-width tile w/ image header)
export function EventCardSkeleton() {
  return (
    <View style={styles.eventCard}>
      <SkeletonBox width="100%" height={120} borderRadius={12} />
      <View style={{ padding: 12, gap: 6 }}>
        <SkeletonBox width="35%" height={10} borderRadius={4} />
        <SkeletonBox width="85%" height={15} borderRadius={6} />
        <SkeletonBox width="60%" height={12} borderRadius={6} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

export function EventListSkeleton() {
  return (
    <View style={styles.listContainer}>
      <EventCardSkeleton />
      <EventCardSkeleton />
    </View>
  );
}

// Perk row (icon + title + body)
export function PerkCardSkeleton() {
  return (
    <View style={styles.perkCard}>
      <SkeletonBox width={48} height={48} borderRadius={12} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox width="50%" height={11} borderRadius={4} />
        <SkeletonBox width="80%" height={14} borderRadius={6} />
        <SkeletonBox width="65%" height={12} borderRadius={6} />
      </View>
    </View>
  );
}

export function PerkListSkeleton() {
  return (
    <View style={styles.listContainer}>
      <PerkCardSkeleton />
      <PerkCardSkeleton />
      <PerkCardSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  cardBody: { flex: 1, gap: 0 },
  cardRight: { alignItems: 'flex-end' },

  profileHero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    gap: 0,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },

  reviewCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },

  listContainer: { paddingHorizontal: 16, paddingTop: 10 },

  gearCard: {
    flexDirection: 'row', backgroundColor: COLORS.paper, borderRadius: 10,
    padding: 8, gap: 12, marginBottom: 12, alignItems: 'center',
  },
  gearBody: { flex: 1 },
  gearMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  eventCard: {
    backgroundColor: COLORS.paper, borderRadius: 10, padding: 8, marginBottom: 12,
  },

  perkCard: {
    flexDirection: 'row', backgroundColor: COLORS.paper, borderRadius: 10,
    padding: 12, gap: 12, marginBottom: 10, alignItems: 'center',
  },
});
