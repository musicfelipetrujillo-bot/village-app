// V4 Phase G6 — Gear chat thread.
// Mirrors MilkMessageDetailScreen: optimistic send, realtime via Supabase
// postgres_changes (migration 035 added `gear_messages` to `supabase_realtime`),
// mark-read on mount. The top banner shows the listing title + a small
// "View listing" jump so either party can jump back to the product page.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  FlatList, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import {
  getGearThreadMessages, sendGearMessage, markGearThreadRead,
  subscribeToGearThread,
  logGearEvent,
  type GearMessageRow,
} from '@api/gear';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { GearStackParamList } from '@/navigation/GearNavigator';

type Props = NativeStackScreenProps<GearStackParamList, 'GearMessageDetail'>;

export default function GearMessageDetailScreen({ navigation, route }: Props) {
  const t = useT();
  const { threadId, listingId, listingTitle, otherDisplayName, isSellerSide } = route.params;
  const user = useAuthStore((s) => s.user);

  const [messages, setMessages] = useState<GearMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<GearMessageRow>>(null);

  const load = useCallback(async () => {
    try {
      const rows = await getGearThreadMessages(threadId);
      setMessages(rows);
    } catch (err) { console.error('[gearChat] load', err); }
  }, [threadId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    markGearThreadRead(threadId).catch(() => {});
    logGearEvent('gear_thread_opened', {
      thread_id: threadId,
      listing_id: listingId,
      side: isSellerSide ? 'seller' : 'buyer',
    }).catch(() => {});
    // Realtime — dedupe by id (own optimistic temp-id stays until handleSend
    // swaps it). Mark-read on incoming messages from the counterparty so the
    // inbox unread badge clears live.
    const unsubscribe = subscribeToGearThread(threadId, (row) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      if (user && row.sender_id !== user.id) {
        markGearThreadRead(threadId).catch(() => {});
      }
    });
    return unsubscribe;
  }, [threadId, listingId, isSellerSide, load, user]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !user || sending) return;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: GearMessageRow = {
      id: tempId, thread_id: threadId, sender_id: user.id,
      body, is_read: false, sent_at: new Date().toISOString(),
      message_type: 'user',
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const real = await sendGearMessage(threadId, user.id, body);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
      logGearEvent('gear_message_sent', {
        thread_id: threadId,
        listing_id: listingId,
        side: isSellerSide ? 'seller' : 'buyer',
        body_len: body.length,
      }).catch(() => {});
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      Alert.alert(t('gearChat.errSendTitle'), err instanceof Error ? err.message : t('gearChat.errSendBody'));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('gearChat.backA11y')}
        >
          <Text style={styles.back}>{t('gearInbox.back')}</Text>
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={1}>
            {otherDisplayName ?? t('gearChat.headerFallback')}
          </Text>
          <Text style={styles.sideLabel}>
            {isSellerSide ? t('gearChat.sideSeller') : t('gearChat.sideBuyer')}
          </Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <TouchableOpacity
        style={styles.listingBanner}
        onPress={() => navigation.navigate('GearListingDetail', { id: listingId })}
        accessibilityRole="link"
        accessibilityLabel={t('gearChat.viewListingA11y', { title: listingTitle })}
      >
        <Text style={styles.listingLabel}>{t('gearChat.aboutListing')}</Text>
        <Text style={styles.listingTitle} numberOfLines={1}>{listingTitle}</Text>
        <Text style={styles.listingCta}>{t('gearChat.viewListing')}</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#C07840" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            // System messages (auto-withdraw notices, moderator takedown
            // templates per migration 063) render as a centered cream card
            // with a rust eyebrow — distinct from user bubbles so the seller
            // can't confuse them with messages from the buyer.
            if (item.message_type === 'system') {
              return (
                <View style={styles.systemRow}>
                  <View style={styles.systemCard}>
                    <Text style={styles.systemEyebrow}>{t('gearChat.systemEyebrow')}</Text>
                    <Text style={styles.systemBody}>{item.body}</Text>
                  </View>
                </View>
              );
            }
            const mine = item.sender_id === user?.id;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: '#FDFBF6' }]}>{item.body}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('gearChat.emptyText')}</Text>
              <Text style={styles.emptyHint}>
                {t('gearChat.emptyHint')}
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={t('gearChat.inputPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={t('gearChat.sendA11y')}
        >
          <Text style={styles.sendBtnText}>{sending ? '…' : '↑'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },
  titleCol: { flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  sideLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2, fontFamily: FONTS.body },

  listingBanner: {
    backgroundColor: COLORS.paper,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  listingLabel: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.textLight,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  listingTitle: { fontSize: 13, color: COLORS.bark, fontFamily: FONTS.bodySemiBold, marginTop: 2 },
  listingCta: { fontSize: 12, color: '#C07840', fontFamily: FONTS.bodySemiBold, marginTop: 3 },

  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 6 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  // System messages — center-aligned, cream card with rust eyebrow. Distinct
  // enough from user bubbles that the seller never mistakes a takedown
  // notice for a message from the buyer.
  systemRow: { alignItems: 'center', marginVertical: 4 },
  systemCard: {
    maxWidth: '92%',
    backgroundColor: '#FBF6E8',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(192,120,64,0.25)',
  },
  systemEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#9F5F30',
    marginBottom: 4,
  },
  systemBody: { fontSize: 14, color: '#3D1F0E', lineHeight: 20, fontFamily: FONTS.body },
  // v9 walnut bubble (kit canon, WCAG 7.4:1 with paper text).
  bubbleMine: { backgroundColor: '#7A4A28', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.paper, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: COLORS.bark, lineHeight: 20, fontFamily: FONTS.body },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  emptyHint: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', lineHeight: 18, fontFamily: FONTS.body },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 28,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1, maxHeight: 120,
    backgroundColor: COLORS.cream, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.bark,
    fontFamily: FONTS.body,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#C07840', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#FDFBF6', fontSize: 22, fontFamily: FONTS.bodySemiBold },
});
