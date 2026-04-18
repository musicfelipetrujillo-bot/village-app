import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@utils/constants';
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
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  stars: { fontSize: 14, color: COLORS.gold },
  date: { fontSize: 11, color: COLORS.textLight },
  verifiedBadge: {
    backgroundColor: '#EEF2E6',
    borderRadius: 50,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  verifiedText: { fontSize: 10, fontWeight: '700', color: COLORS.olive },
  body: { fontSize: 13, color: COLORS.textDark, lineHeight: 20 },
  aiNote: {
    marginTop: 8,
    backgroundColor: '#FFF8E8',
    borderRadius: 8,
    padding: 8,
  },
  aiNoteText: { fontSize: 11, color: '#8B6914', lineHeight: 16 },
});
