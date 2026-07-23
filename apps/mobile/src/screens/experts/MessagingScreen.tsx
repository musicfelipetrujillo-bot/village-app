// V1 Phase 5 — Direct messaging between user and specialist
// Realtime via Supabase postgres_changes (migration 035 added `messages` to
// `supabase_realtime` publication). RLS still gates which rows each subscriber
// receives — the publication only decides which tables emit changes at all.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import { useAuthStore } from '@store/auth';
import { useExpertsStore } from '@store/experts';
import { messagesApi, type Message } from '@api/messages';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'Messaging'>;

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function MessagingScreen({ navigation, route }: Props) {
  const t = useT();
  const { specialistId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { selectedSpecialist: spec, selectSpecialist } = useExpertsStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await messagesApi.getThread(specialistId);
      setMessages(data);
      // Mark specialist messages as read
      if (user) await messagesApi.markThreadRead(specialistId, user.id);
    } catch {
      // Fail silently on poll refresh
    }
  }, [specialistId, user]);

  useEffect(() => {
    if (!spec || spec.id !== specialistId) selectSpecialist(specialistId);
  }, [specialistId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchMessages();
      setLoading(false);
    };
    init();

    // Realtime — INSERTs flow in via Supabase postgres_changes. We dedupe by id
    // so own-optimistic bubbles (synthetic id) and the server echo coexist
    // until handleSend's fetchMessages refresh swaps the temp id for the real
    // one. Also mark thread read on each incoming message from the specialist
    // so the unread dot clears in real time.
    const unsubscribe = messagesApi.subscribeToThread(specialistId, (row) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      if (user && row.sender_id !== user.id) {
        messagesApi.markThreadRead(specialistId, user.id).catch(() => {});
      }
    });
    return unsubscribe;
  }, [fetchMessages, specialistId, user]);

  // Scroll to bottom when messages load or new one arrives
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !user || sending) return;
    setSending(true);
    setDraft('');

    // Optimistic insert
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_id: user.id,
      specialist_id: specialistId,
      body,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      await messagesApi.send(user.id, specialistId, body);
      await fetchMessages(); // Refresh to get server-assigned ID
    } catch {
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const prev = messages[index - 1];
    const showTimestamp =
      !prev ||
      new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;

    return (
      <View>
        {showTimestamp && (
          <Text style={styles.timestamp}>{formatTime(item.created_at)}</Text>
        )}
        <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
          {!isOwn && (
            <View style={styles.avatarSmall}>
              <Text style={{ fontSize: 14 }}>👩‍⚕️</Text>
            </View>
          )}
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
              {item.body}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const specName = spec?.full_name ?? t('messaging.headerFallback');
  const firstName = spec?.full_name?.split(' ')[0] ?? t('messaging.providerFallback');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <V9PageBackdrop />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{t('messaging.back')}</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerName}>{specName}</Text>
            {spec?.credentials && (
              <Text style={styles.headerSub}>{spec.credentials}</Text>
            )}
          </View>
          {spec?.telehealth_available && spec?.telehealth_link && (
            <TouchableOpacity
              style={styles.videoBtn}
              onPress={() => Linking.openURL(spec.telehealth_link!)}
            >
              <Text style={styles.videoBtnText}>📱</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Disclaimer banner */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {t('messaging.disclaimer')}
          </Text>
        </View>

        {/* Message list */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#E84B79" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>{t('messaging.emptyTitle')}</Text>
                <Text style={styles.emptyText}>
                  {t('messaging.emptyText', { name: firstName })}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={t('messaging.inputPlaceholder', { name: firstName })}
            placeholderTextColor={COLORS.textLight}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color='#FFFCF6' />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    gap: 10,
  },
  backBtn: { width: 52 },
  backText: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodyMedium },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: {
    fontFamily: FONTS.headerItalic,
    fontSize: 16,
    color: COLORS.bark,
  },
  headerSub: { fontSize: 11, color: COLORS.textLight, marginTop: 1, fontFamily: FONTS.body },
  videoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBtnText: { fontSize: 20 },

  disclaimer: {
    backgroundColor: '#FFF8E8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  disclaimerText: { fontSize: 11, color: '#E98A6A', lineHeight: 16, textAlign: 'center', fontFamily: FONTS.body },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  messageList: { padding: 16, paddingBottom: 12, gap: 2, flexGrow: 1 },

  timestamp: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: FONTS.body,
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 8,
  },
  bubbleRowOwn: { flexDirection: 'row-reverse' },

  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.18)',
  },

  bubble: {
    maxWidth: '72%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  // v9 walnut bubble (kit canon, WCAG 7.4:1 with paper text — readable at 3am).
  bubbleOwn: {
    backgroundColor: '#7A4A28',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.paper,
    borderBottomLeftRadius: 4,
    shadowColor: '#43260F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.body },
  bubbleTextOwn: { color: '#FFFCF6' },                                 // v9 paper white (kit canon)
  bubbleTextOther: { color: COLORS.bark },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20, fontFamily: FONTS.body },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.bark,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.18)',
    fontFamily: FONTS.body,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E84B79',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: '#FFFCF6', fontSize: 20, fontFamily: FONTS.bodySemiBold, lineHeight: 22 },
});
