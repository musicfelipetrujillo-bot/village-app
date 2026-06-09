import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { cardLift, cardLiftBorder } from '@utils/cardLift';
import type { Review } from 'shared/src/types/v1';

interface Props { review: Review }

export function ReviewCard({ review }: Props) {
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric',
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.stars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
        <Text style={styles.date}>{date}</Text>
        {review.verified_patient && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ Verified patient</Text>
          </View>
        )}
      </View>
      {review.body ? <Text style={styles.body}>{review.body}</Text> : null}
      {review.ai_summary ? (
        <View style={styles.aiNote}>
          <Text style={styles.aiNoteText}>🤖 {review.ai_summary}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Review card — lift bumped from 0.05/1r to canonical recipe (was
  // barely visible against the cream wash per blend audit).
  card: {
    backgroundColor: COLORS.v2_card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    ...cardLiftBorder,
    ...cardLift,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  stars: { fontSize: 14, color: COLORS.sand },
  date: { fontSize: 11, color: COLORS.textLight, fontFamily: FONTS.body },
  verifiedBadge: {
    backgroundColor: '#F2E6DD',
    borderRadius: 50,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  verifiedText: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.sage },
  body: { fontSize: 13, color: COLORS.bark, lineHeight: 20, fontFamily: FONTS.body },
  aiNote: {
    marginTop: 8,
    backgroundColor: '#FFF8E8',
    borderRadius: 8,
    padding: 8,
  },
  aiNoteText: { fontSize: 11, color: '#E98A6A', lineHeight: 16, fontFamily: FONTS.body },
});
