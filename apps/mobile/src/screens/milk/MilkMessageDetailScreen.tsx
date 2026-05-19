// V2 M4 — MilkMessageDetailScreen
// Chat thread UI: optimistic send, realtime via Supabase postgres_changes
// (migration 035 added `milk_messages` to `supabase_realtime`), mark-read on
// mount. RLS still scopes which rows each subscriber sees.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  FlatList, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import {
  getThreadMessages, sendMilkMessage, markThreadRead,
  subscribeToMilkThread,
  type MilkMessageRow,
} from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkMessageDetail'>;

export default function MilkMessageDetailScreen({ navigation, route }: Props) {
  const { threadId, otherDisplayName } = route.params;
  const user = useAuthStore((s) => s.user);
  const t = useT();

  const [messages, setMessages] = useState<MilkMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<MilkMessageRow>>(null);

  const load = useCallback(async () => {
    try {
      const rows = await getThreadMessages(threadId);
      setMessages(rows);
    } catch (e) { console.error(e); }
  }, [threadId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    markThreadRead(threadId).catch(() => {});
    // Realtime — dedupe by id so the optimistic temp bubble (synthetic id) and
    // the server INSERT echo coexist until handleSend swaps the temp id for
    // the real one. Mark-read on incoming messages from the other party so
    // unread counts on the inbox clear in real time.
    const unsubscribe = subscribeToMilkThread(threadId, (row) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      if (user && row.sender_id !== user.id) {
        markThreadRead(threadId).catch(() => {});
      }
    });
    return unsubscribe;
  }, [threadId, load, user]);

  useEffect(() => {
    // Scroll to end when messages arrive
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !user || sending) return;
    setSending(true);

    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic: MilkMessageRow = {
      id: tempId, thread_id: threadId, sender_id: user.id,
      body, is_read: false, sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const real = await sendMilkMessage(threadId, user.id, body);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      Alert.alert(t('milkChat.sendFailedTitle'), e.message ?? t('milkChat.sendFailedBody'));
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
          accessibilityLabel={t('milkChat.back')}
        >
          <Text style={styles.back}>{t('milkChat.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{otherDisplayName ?? t('milkChat.fallbackTitle')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#C07840" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
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
              <Text style={styles.emptyText}>{t('milkChat.emptyText')}</Text>
            </View>
          }
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={t('milkChat.inputPlaceholder')}
          placeholderTextColor="#B5A095"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
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
  back: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodyMedium },
  title: { flex: 1, fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#2C1810', textAlign: 'center' },

  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 6 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  // v9 walnut bubble (kit canon, WCAG 7.4:1 with paper text — readable at 3am).
  bubbleMine: { backgroundColor: '#7A4A28', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.paper, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#2C1810', lineHeight: 20 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 14, color: '#9A8070' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 28,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1, maxHeight: 120,
    backgroundColor: '#F5F0E8', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#2C1810',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#C07840', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#FDFBF6', fontSize: 22, fontFamily: FONTS.bodySemiBold },
});
