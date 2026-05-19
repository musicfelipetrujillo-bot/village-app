// V4 Phase G7 — Check-in AI response screen.
// Renders the AI reply from ai-daily-checkin. If crisis_flagged=TRUE, surfaces
// crisis resources as tappable rows (tel:/sms: deeplinks) at the top.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { homeApi, type DailyCheckin } from '@api/home';
import { useT } from '@/i18n';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

type Props = NativeStackScreenProps<HomeStackParamList, 'CheckinResponse'>;

// The edge function (and its system prompt) always appends the medical-advice
// disclaimer as the final sentence of ai_reply. We render it as a separate
// footnote below the Villie card — not as body copy — so it reads as an
// actual disclaimer, not part of the warm reply.
//
// Detects both EN ("This is a check-in") and ES ("Esto es un chequeo") leading
// phrases so a Spanish-language AI reply still splits correctly. If neither
// matches (older row, unexpected wording), falls back to a generic medical-
// advice keyword search before giving up — better to render the disclaimer
// inline once than to misclassify it as body copy.
const DISCLAIMER_LEAD = /\b(?:This is a check-in|Esto es un chequeo)\b/i;
const DISCLAIMER_FALLBACK = /(?:not medical advice|no consejo médico)/i;

function splitDisclaimer(reply: string): { body: string; disclaimer: string | null } {
  let idx = reply.search(DISCLAIMER_LEAD);
  if (idx <= 0) {
    // Fallback: jump back to the start of the sentence containing the keyword.
    const keywordIdx = reply.search(DISCLAIMER_FALLBACK);
    if (keywordIdx > 0) {
      const sentenceStart = reply.lastIndexOf('.', keywordIdx);
      idx = sentenceStart >= 0 ? sentenceStart + 1 : keywordIdx;
    }
  }
  if (idx > 0) {
    return { body: reply.slice(0, idx).trim(), disclaimer: reply.slice(idx).trim() };
  }
  return { body: reply, disclaimer: null };
}

export default function CheckinResponseScreen({ navigation }: Props) {
  const t = useT();
  const [row, setRow] = useState<DailyCheckin | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const today = await homeApi.getTodayCheckin();
      setRow(today);
    } catch (err) {
      console.error('[checkinResponse] load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const callNumber = (phone: string) => Linking.openURL(`tel:${phone}`).catch(() => {});
  const textNumber = (num: string, body?: string) => {
    const url = body ? `sms:${num}&body=${encodeURIComponent(body)}` : `sms:${num}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.popToTop()}
          accessibilityRole="button"
          accessibilityLabel={t('checkin.responseBackA11y')}
        >
          <Text style={styles.back}>← {t('checkin.responseHeaderBack')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('checkin.headerTitle')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#C07840" /></View>
      ) : !row ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('checkin.responseErrorLoad')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {row.crisis_flagged && row.crisis_resources && (
            <View style={styles.crisisCard}>
              <Text style={styles.crisisEyebrow}>{t('checkin.responseCrisisEyebrow')}</Text>
              <Text style={styles.crisisBody}>{t('checkin.responseCrisisBody')}</Text>
              {Object.entries(row.crisis_resources).map(([key, res]) => (
                <View key={key} style={styles.resourceRow}>
                  <View style={styles.resourceText}>
                    <Text style={styles.resourceName}>{res.name}</Text>
                    <Text style={styles.resourceDesc}>{res.description}</Text>
                  </View>
                  {res.phone && (
                    <TouchableOpacity
                      style={styles.resourceBtn}
                      onPress={() => res.phone && callNumber(res.phone)}
                      accessibilityRole="button"
                      accessibilityLabel={t('checkin.responseCallA11y', { name: res.name })}
                    >
                      <Text style={styles.resourceBtnText}>{t('checkin.responseCallBtn')}</Text>
                    </TouchableOpacity>
                  )}
                  {res.sms && (
                    <TouchableOpacity
                      style={[styles.resourceBtn, styles.resourceBtnAlt]}
                      onPress={() => res.sms && textNumber(res.sms, res.sms_body)}
                      accessibilityRole="button"
                      accessibilityLabel={t('checkin.responseTextA11y', { name: res.name })}
                    >
                      <Text style={styles.resourceBtnText}>{t('checkin.responseTextBtn')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {(() => {
            const { body, disclaimer } = row.ai_reply
              ? splitDisclaimer(row.ai_reply)
              : { body: '', disclaimer: null };
            return (
              <>
                <View style={styles.replyCard}>
                  <Text style={styles.replyEyebrow}>{t('checkin.responseReplyEyebrow')}</Text>
                  {row.ai_reply ? (
                    <Text style={styles.replyBody}>{body}</Text>
                  ) : (
                    <Text style={styles.replyBody}>{t('checkin.responseFallbackReply')}</Text>
                  )}
                </View>
                {disclaimer && (
                  <Text style={styles.disclaimer}>{disclaimer}</Text>
                )}
              </>
            );
          })()}

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.popToTop()}
            accessibilityRole="button"
            accessibilityLabel={t('checkin.responseBackA11y')}
          >
            <Text style={styles.doneBtnText}>{t('checkin.responseDoneBtn')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontSize: 14, color: COLORS.barkSoft },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },
  title: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  content: { padding: 20, paddingBottom: 60 },

  // Crisis card — v9 paper lift with rust-deep hairline border (not a 2px
  // colored stroke, which reads as a generic alert). Pink-soft bg still
  // signals empathy. Shadow is the same cocoa drop the rest of the app uses.
  crisisCard: {
    backgroundColor: COLORS.pinkSoft, borderRadius: 18, padding: 18, marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(154, 74, 43, 0.35)',
    shadowColor: '#6B2E0E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 18, elevation: 5,
  },
  crisisEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.5,
    color: '#A77349', marginBottom: 6,
  },
  crisisBody: { fontSize: 14, color: COLORS.bark, lineHeight: 20, marginBottom: 14 },
  resourceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(184,92,56,0.2)',
  },
  resourceText: { flex: 1 },
  resourceName: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  resourceDesc: { fontSize: 12, color: COLORS.barkSoft, marginTop: 2 },
  resourceBtn: {
    backgroundColor: '#C07840', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  resourceBtnAlt: { backgroundColor: COLORS.sage },
  resourceBtnText: { color: '#FDFBF6', fontSize: 13, fontFamily: FONTS.bodySemiBold },

  replyCard: {
    backgroundColor: COLORS.paper, borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150, 80, 50, 0.18)',
    shadowColor: '#6B2E0E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 18, elevation: 5,
  },
  replyEyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.5,
    color: COLORS.sage, marginBottom: 6, textTransform: 'uppercase',
  },
  replyBody: { fontSize: 15, color: COLORS.bark, lineHeight: 22 },

  disclaimer: {
    fontSize: 11, color: COLORS.textLight, lineHeight: 16,
    fontStyle: 'italic', textAlign: 'center',
    paddingHorizontal: 20, marginTop: -4, marginBottom: 18,
  },

  doneBtn: {
    marginTop: 8, backgroundColor: COLORS.bark, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { color: '#FDFBF6', fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
