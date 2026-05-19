// AI Assistant Modal — used on SpecialistProfileScreen
// Supports: Profile Q&A and Follow-up Question generation
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { aiApi } from '@api/ai';
import { useUserStore } from '@store/user';
import type { Specialist } from 'shared/src/types/v1';

interface Props {
  visible: boolean;
  onClose: () => void;
  specialist: Specialist;
}

type Mode = 'menu' | 'qa' | 'followup';

interface QAMessage {
  role: 'user' | 'assistant';
  text: string;
}

export function AIAssistantModal({ visible, onClose, specialist }: Props) {
  const profile = useUserStore((s) => s.profile);
  const [mode, setMode] = useState<Mode>('menu');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setMode('menu');
    setQuestion('');
    setMessages([]);
    setQuestions([]);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const { answer } = await aiApi.profileQA(
        specialist.id,
        q,
        profile?.pregnancy_stage ?? undefined,
        profile?.preferred_language ?? 'en',
      );
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: "I couldn't get an answer right now — try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowup = async () => {
    if (!profile?.pregnancy_stage) return;
    setLoading(true);
    try {
      const { questions: qs } = await aiApi.followupQuestions(
        specialist.id,
        profile.pregnancy_stage,
        profile?.preferred_language ?? 'en',
      );
      setQuestions(qs);
      setMode('followup');
    } catch {
      setQuestions(["Couldn't load questions right now — try again."]);
      setMode('followup');
    } finally {
      setLoading(false);
    }
  };

  const firstName = specialist.full_name.split(' ').pop() ?? specialist.full_name;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={mode === 'menu' ? handleClose : () => setMode('menu')} style={styles.backBtn}>
              <Text style={styles.backText}>{mode === 'menu' ? '✕ Close' : '← Back'}</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>🤖 Village AI</Text>
              <Text style={styles.headerSub}>About {firstName}</Text>
            </View>
            <View style={{ width: 64 }} />
          </View>

          {/* Menu */}
          {mode === 'menu' && (
            <View style={styles.menu}>
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>Powered by Claude · Haiku</Text>
              </View>

              <Text style={styles.menuTitle}>What can I help you with?</Text>

              <TouchableOpacity style={styles.menuCard} onPress={() => setMode('qa')}>
                <Text style={styles.menuCardIcon}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuCardTitle}>Ask about {firstName}</Text>
                  <Text style={styles.menuCardSub}>
                    Services, insurance, availability, what to expect — answered from her profile.
                  </Text>
                </View>
                <Text style={styles.menuCardArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuCard, !profile?.pregnancy_stage && styles.menuCardDisabled]}
                onPress={handleFollowup}
                disabled={!profile?.pregnancy_stage || loading}
              >
                <Text style={styles.menuCardIcon}>📋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuCardTitle}>Suggest questions to ask</Text>
                  <Text style={styles.menuCardSub}>
                    5–7 tailored questions for your {profile?.pregnancy_stage?.replace(/_/g, ' ')} stage.
                  </Text>
                </View>
                {loading ? (
                  <ActivityIndicator color="#C07840" size="small" />
                ) : (
                  <Text style={styles.menuCardArrow}>›</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                AI responses are based on {firstName}'s profile only. Always verify important details directly with the provider.
              </Text>
            </View>
          )}

          {/* Q&A mode */}
          {mode === 'qa' && (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.qaContent}
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 && (
                  <View style={styles.qaEmpty}>
                    <Text style={styles.qaEmptyText}>
                      Ask me anything about {firstName} — services, pricing, what she specializes in, languages, insurance…
                    </Text>
                    <View style={styles.suggestedChips}>
                      {[
                        'Does she take Medicaid?',
                        'Does she offer telehealth?',
                        `What's her experience with my stage?`,
                      ].map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={styles.chip}
                          onPress={() => { setQuestion(s); }}
                        >
                          <Text style={styles.chipText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {messages.map((msg, i) => (
                  <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
                    {msg.role === 'assistant' && (
                      <Text style={styles.bubbleAILabel}>🤖 Village AI</Text>
                    )}
                    <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
                      {msg.text}
                    </Text>
                  </View>
                ))}

                {loading && (
                  <View style={styles.bubbleAI}>
                    <Text style={styles.bubbleAILabel}>🤖 Village AI</Text>
                    <ActivityIndicator color="#C07840" size="small" style={{ marginTop: 4 }} />
                  </View>
                )}
              </ScrollView>

              <View style={styles.inputBar}>
                <TextInput
                  style={styles.input}
                  placeholder={`Ask about ${firstName}…`}
                  placeholderTextColor={COLORS.textLight}
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  maxLength={400}
                  returnKeyType="send"
                  onSubmitEditing={handleAsk}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!question.trim() || loading) && styles.sendBtnDisabled]}
                  onPress={handleAsk}
                  disabled={!question.trim() || loading}
                >
                  <Text style={styles.sendBtnText}>↑</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Follow-up questions mode */}
          {mode === 'followup' && (
            <ScrollView contentContainerStyle={styles.followupContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.followupTitle}>Questions to ask {firstName}</Text>
              <Text style={styles.followupSub}>
                Tailored to your {profile?.pregnancy_stage?.replace(/_/g, ' ')} stage
              </Text>
              {questions.map((q, i) => (
                <View key={i} style={styles.questionCard}>
                  <View style={styles.questionNum}>
                    <Text style={styles.questionNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.questionText}>{q}</Text>
                </View>
              ))}
              <Text style={styles.followupDisclaimer}>
                These are suggestions — feel free to ask your own questions too.
              </Text>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  backBtn: { width: 64 },
  backText: { fontSize: 14, color: COLORS.coco, fontFamily: FONTS.bodyMedium },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  headerSub: { fontSize: 11, color: COLORS.textLight, marginTop: 1, fontFamily: FONTS.body },

  // Menu
  menu: { flex: 1, padding: 20, gap: 16 },
  menuBadge: {
    alignSelf: 'center',
    backgroundColor: '#FFF8E8',
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  menuBadgeText: { fontSize: 11, color: '#8B6914', fontFamily: FONTS.bodyMedium },
  menuTitle: {
    fontFamily: FONTS.headerItalic,
    fontSize: 22,
    color: COLORS.bark,
    textAlign: 'center',
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paper,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuCardDisabled: { opacity: 0.5 },
  menuCardIcon: { fontSize: 28 },
  menuCardTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 3 },
  menuCardSub: { fontSize: 12, color: COLORS.textLight, lineHeight: 17, fontFamily: FONTS.body },
  menuCardArrow: { fontSize: 22, color: COLORS.textLight },
  disclaimer: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
    marginTop: 8,
    fontFamily: FONTS.body,
  },

  // Q&A
  qaContent: { padding: 16, gap: 12, flexGrow: 1 },
  qaEmpty: { gap: 16 },
  qaEmptyText: { fontSize: 14, color: COLORS.textLight, lineHeight: 20, textAlign: 'center', paddingTop: 12, fontFamily: FONTS.body },
  suggestedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    backgroundColor: COLORS.paper,
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.18)',
  },
  chipText: { fontSize: 12, color: COLORS.bark, fontFamily: FONTS.bodyMedium },

  bubble: { borderRadius: 16, padding: 13, maxWidth: '86%' },
  bubbleUser: {
    backgroundColor: '#C07840',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: COLORS.paper,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleAILabel: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: COLORS.coco, marginBottom: 5, letterSpacing: 0.5 },
  bubbleText: { fontSize: 14, color: COLORS.bark, lineHeight: 21, fontFamily: FONTS.body },
  bubbleTextUser: { color: '#FDFBF6' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
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
    fontSize: 14,
    color: COLORS.bark,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.18)',
    fontFamily: FONTS.body,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C07840',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: '#FDFBF6', fontSize: 20, fontFamily: FONTS.bodySemiBold, lineHeight: 22 },

  // Follow-up questions
  followupContent: { padding: 20, gap: 12 },
  followupTitle: {
    fontFamily: FONTS.headerItalic,
    fontSize: 22,
    color: COLORS.bark,
  },
  followupSub: { fontSize: 13, color: COLORS.textLight, marginTop: -6, fontFamily: FONTS.body },
  questionCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  questionNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#C07840',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  questionNumText: { color: '#FDFBF6', fontSize: 12, fontFamily: FONTS.bodySemiBold },
  questionText: { fontSize: 14, color: COLORS.bark, lineHeight: 21, flex: 1, fontFamily: FONTS.body },
  followupDisclaimer: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 8,
    fontFamily: FONTS.body,
  },
});
