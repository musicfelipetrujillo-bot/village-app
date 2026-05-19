// Global in-app AI help chat — "Villie" — app guide + light context.
// Invoked as a modal Stack.Screen from RootNavigator. NOT tied to Connect tab.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  FlatList, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { appHelpApi, type HelpMessage, type HelpUserContext, type CrisisResource } from '@api/appHelp';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  crisisResources?: Record<string, CrisisResource>;
}

export default function AIHelpChatScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const t = useT();

  const [messages, setMessages] = useState<UIMessage[]>(() => [
    { id: 'greeting', role: 'assistant', content: t('help.greeting') },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [ctx, setCtx] = useState<HelpUserContext>({});
  const listRef = useRef<FlatList<UIMessage>>(null);

  useEffect(() => {
    if (!user?.id) return;
    appHelpApi.fetchUserContext(user.id).then(setCtx).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);

    const userMsg: UIMessage = { id: `u-${Date.now()}`, role: 'user', content: body };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft('');

    try {
      const history: HelpMessage[] = next
        .filter((m) => m.id !== 'greeting')
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await appHelpApi.sendMessage(history, ctx);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          crisisResources: res.crisis ? res.crisis_resources : undefined,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('help.errorGeneric');
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: t('help.errorPrefix', { msg }) },
      ]);
    } finally {
      setSending(false);
    }
  }, [draft, messages, ctx, sending, t]);

  const callResource = (r: CrisisResource) => {
    if (r.phone) Linking.openURL(`tel:${r.phone}`);
    else if (r.sms) Linking.openURL(`sms:${r.sms}${r.sms_body ? `&body=${encodeURIComponent(r.sms_body)}` : ''}`);
  };

  const renderItem = ({ item }: { item: UIMessage }) => {
    const mine = item.role === 'user';
    return (
      <View>
        <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, mine && { color: '#FDFBF6' }]}>{item.content}</Text>
          </View>
        </View>
        {item.crisisResources && (
          <View style={styles.crisisCard}>
            <Text style={styles.crisisTitle}>{t('help.crisisTitle')}</Text>
            {Object.entries(item.crisisResources).map(([key, r]) => (
              <TouchableOpacity key={key} style={styles.crisisRow} onPress={() => callResource(r)}>
                <Text style={styles.crisisName}>{r.name}</Text>
                <Text style={styles.crisisDesc}>{r.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('help.closeA11y')}>
          <Text style={styles.close}>{t('help.closeBtn')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.titleHeader}>{t('help.headerTitle')}</Text>
          <Text style={styles.subtitle}>{t('help.headerSubtitle')}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator color="#C07840" size="small" />
          <Text style={styles.typingText}>{t('help.typing')}</Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={t('help.composerPlaceholder')}
          placeholderTextColor="#B5A095"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={800}
          accessibilityLabel={t('help.composerA11y')}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={t('help.sendA11y')}
        >
          <Text style={styles.sendBtnText}>{sending ? '…' : '↑'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  close: { fontSize: 15, color: '#A77349', fontFamily: FONTS.bodyMedium },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  titleHeader: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  subtitle: { fontSize: 11, color: COLORS.textLight, marginTop: 2, letterSpacing: 0.5, fontFamily: FONTS.body },

  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 6 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  // v9 walnut bubble (kit canon, WCAG 7.4:1 with paper text).
  bubbleMine: { backgroundColor: '#7A4A28', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.paper, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: COLORS.bark, lineHeight: 20, fontFamily: FONTS.body },

  crisisCard: {
    marginTop: 6, marginHorizontal: 8, padding: 12, borderRadius: 12,
    backgroundColor: '#FFF7F2', borderWidth: 1, borderColor: COLORS.cocoSoft,
  },
  crisisTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#A77349', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  crisisRow: { paddingVertical: 6 },
  crisisName: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  crisisDesc: { fontSize: 13, color: COLORS.barkSoft, marginTop: 2, fontFamily: FONTS.body },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  typingText: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic', fontFamily: FONTS.body },

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
