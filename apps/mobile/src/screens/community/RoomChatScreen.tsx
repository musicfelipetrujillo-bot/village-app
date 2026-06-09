// V3 Phase C2 + C4 — Room chat feed with live Realtime subscription + reactions
// + AI safety pipeline.
//
// Flow:
//   1. Load the last 50 messages on mount (RPC `list_room_messages`, which
//      filters to `ai_scan_status='clear'` only).
//   2. Subscribe to room_messages INSERT + UPDATE via Supabase Realtime.
//      C4: messages enter with status='pending', the scan edge function flips
//      to 'clear'|'flagged'|'crisis'. We surface rows only when they reach
//      'clear' (handled inside subscribeToRoomMessages).
//   3. Optimistic send: local bubble shows with a "Scanning…" pill while the
//      server-side scan runs, then swaps in once the verdict lands. If the
//      sender's own message comes back 'crisis', we remove it from the feed
//      and open CrisisResourcesSheet. 'flagged' removes with a silent toast.
//   4. Render inverted FlatList — newest at bottom. Pinned resources (crisis
//      hotlines) stay above the feed regardless of scroll.
//   5. Long-press a message → reaction picker (6 emojis).
//   6. Mark the room read on focus (advances last_read_at).
//
// Safety posture (C4):
//   - Crisis Detection + Content Moderation run in parallel BEFORE messages
//     become visible. See supabase/functions/room-message-scan.
//   - Fail-open on scan timeout (status='clear') — keeps chat usable.
//   - Crisis flags inserted for moderator dashboard review + SMS alert.
//   - Pinned resources bar always visible above the feed.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Linking,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Modal, Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useAuthStore } from '@store/auth';
import {
  listPinnedResources, getRoomBySlug,
  listRoomMessages, sendRoomMessage, markRoomRead,
  subscribeToRoomMessages, addReaction, removeReaction, listMyReactions,
  waitForScanVerdict,
  hasVillageMention, invokeAiCompanion,
  getIcebreaker, dismissIcebreaker,
  REACTION_EMOJIS,
  type PinnedResource, type Room, type RoomMessage, type ReactionEmoji,
} from '@api/community';
import type { CommunityStackParamList } from '@/navigation/CommunityNavigator';
import CrisisResourcesSheet from '@components/community/CrisisResourcesSheet';

type Props = NativeStackScreenProps<CommunityStackParamList, 'RoomChat'>;

export default function RoomChatScreen({ navigation, route }: Props) {
  const { roomId, roomSlug } = route.params;
  const user = useAuthStore((s) => s.user);

  const [room, setRoom] = useState<Room | null>(null);
  const [pinned, setPinned] = useState<PinnedResource[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [myReactions, setMyReactions] = useState<Record<string, ReactionEmoji[]>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<RoomMessage | null>(null);
  const [crisisSheetVisible, setCrisisSheetVisible] = useState(false);
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const listRef = useRef<FlatList<RoomMessage>>(null);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, p, msgs] = await Promise.all([
          getRoomBySlug(roomSlug),
          listPinnedResources(roomId),
          listRoomMessages(roomId, { limit: 50 }),
        ]);
        if (!alive) return;
        setRoom(r);
        setPinned(p);
        setMessages(msgs);
        if (msgs.length > 0) {
          const mine = await listMyReactions(msgs.map((m) => m.id));
          if (alive) setMyReactions(mine);
        }
        // C5: surface an icebreaker if one is waiting for this (user, room).
        try {
          const ib = await getIcebreaker(roomId);
          if (alive && ib) setIcebreaker(ib);
        } catch {
          /* non-fatal — icebreaker just won't show */
        }
      } catch (err) {
        console.error('[roomChat] load', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId, roomSlug]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToRoomMessages(roomId, async (row) => {
      // Skip if this row is already in state (our own optimistic insert will
      // have arrived via the INSERT callback with a different temp id — the
      // real id arrives here).
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        // Build a minimal RoomMessage; sender_name/avatar/reactions enrich on refresh.
        const optimistic: RoomMessage = {
          id: row.id,
          room_id: row.room_id,
          sender_user_id: row.sender_user_id,
          sender_anon_id: row.sender_anon_id,
          body: row.body,
          message_type: row.message_type,
          parent_id: row.parent_id,
          ai_scan_status: row.ai_scan_status,
          created_at: row.created_at,
          sender_name: row.sender_user_id === user?.id
            ? (user?.user_metadata?.full_name ?? 'You')
            : null,
          sender_avatar_url: row.sender_user_id === user?.id
            ? (user?.user_metadata?.avatar_url ?? null) : null,
          reactions: {},
        };
        return [optimistic, ...prev];
      });

      // If the sender wasn't us, we're missing their display name — lazy fetch
      // the single message via a 1-row window so the bubble gets a name.
      if (row.sender_user_id && row.sender_user_id !== user?.id) {
        try {
          const fresh = await listRoomMessages(roomId, { limit: 1 });
          if (fresh.length > 0 && fresh[0].id === row.id) {
            setMessages((prev) => prev.map((m) => (m.id === row.id ? fresh[0] : m)));
          }
        } catch {
          /* non-fatal */
        }
      }
    });
    return () => { unsub(); };
  }, [roomId, user?.id, user?.user_metadata?.full_name, user?.user_metadata?.avatar_url]);

  // ── Mark-read on focus ────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    markRoomRead(roomId).catch(() => {});
  }, [roomId]));

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending || !user) return;
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: RoomMessage = {
      id: tempId,
      room_id: roomId,
      sender_user_id: user.id,
      sender_anon_id: null,
      body,
      message_type: 'user',
      parent_id: null,
      // C4: local bubble starts 'pending' so MessageBubble shows a "Scanning…"
      // pill until the server-side verdict lands.
      ai_scan_status: 'pending',
      created_at: new Date().toISOString(),
      sender_name: user.user_metadata?.full_name ?? 'You',
      sender_avatar_url: user.user_metadata?.avatar_url ?? null,
      reactions: {},
    };
    setMessages((prev) => [optimistic, ...prev]);
    setDraft('');
    // C5: if this was triggered from the icebreaker prefill, hide the chip.
    if (icebreaker && body === icebreaker) {
      setIcebreaker(null);
      void dismissIcebreaker(roomId).catch(() => {});
    }
    const mentionsVillage = hasVillageMention(body);
    try {
      const real = await sendRoomMessage(roomId, body);
      // Swap temp id → real id. The realtime subscription will pick up the
      // UPDATE → 'clear' transition and refresh this row's status.
      setMessages((prev) => prev.map((m) =>
        m.id === tempId ? { ...m, id: real.id, created_at: real.created_at } : m));

      // Poll the scan verdict so we can (a) flip our local 'pending' bubble to
      // 'clear' if Realtime didn't already, and (b) route the sender to crisis
      // resources if their own message trips the classifier.
      void (async () => {
        const verdict = await waitForScanVerdict(real.id);
        if (verdict === 'crisis') {
          setMessages((prev) => prev.filter((m) => m.id !== real.id));
          setCrisisSheetVisible(true);
        } else if (verdict === 'flagged') {
          setMessages((prev) => prev.filter((m) => m.id !== real.id));
          Alert.alert(
            'Message held for review',
            'A moderator will take a look. Please keep the room supportive and on-topic.',
          );
        } else if (verdict === 'clear') {
          setMessages((prev) => prev.map((m) =>
            m.id === real.id ? { ...m, ai_scan_status: 'clear' } : m));
          // C5: now that scan passed, invoke @village companion if the
          // message mentioned it. The reply is posted by the edge function
          // as a message_type='ai_companion' row and arrives via Realtime.
          if (mentionsVillage) {
            void invokeAiCompanion(real.id).catch(() => {});
          }
        }
        // 'pending' → scan still running or failed silently; leave the bubble
        // as-is. The nightly sweep (future) will resolve drift.
      })();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Reactions ─────────────────────────────────────────────────────────────
  const toggleReaction = useCallback(async (message: RoomMessage, emoji: ReactionEmoji) => {
    const mine = myReactions[message.id] ?? [];
    const isActive = mine.includes(emoji);

    // Optimistic flip.
    setMyReactions((prev) => ({
      ...prev,
      [message.id]: isActive ? mine.filter((e) => e !== emoji) : [...mine, emoji],
    }));
    setMessages((prev) => prev.map((m) => {
      if (m.id !== message.id) return m;
      const count = m.reactions[emoji] ?? 0;
      const next = { ...m.reactions };
      const updated = count + (isActive ? -1 : 1);
      if (updated <= 0) delete next[emoji]; else next[emoji] = updated;
      return { ...m, reactions: next };
    }));
    setReactionTarget(null);

    try {
      if (isActive) await removeReaction(message.id, emoji);
      else await addReaction(message.id, emoji);
    } catch (err) {
      // Revert on failure.
      console.error('[roomChat] reaction', err);
      setMyReactions((prev) => ({
        ...prev,
        [message.id]: isActive ? [...mine] : mine.filter((e) => e !== emoji),
      }));
      setMessages((prev) => prev.map((m) => {
        if (m.id !== message.id) return m;
        const count = m.reactions[emoji] ?? 0;
        const next = { ...m.reactions };
        const reverted = count + (isActive ? 1 : -1);
        if (reverted <= 0) delete next[emoji]; else next[emoji] = reverted;
        return { ...m, reactions: next };
      }));
    }
  }, [myReactions]);

  const openResource = (res: PinnedResource) => {
    if (res.url) { void Linking.openURL(res.url); return; }
    if (res.phone_number) { void Linking.openURL(`tel:${res.phone_number}`); }
  };

  const myUserId = user?.id ?? null;

  const renderItem = useCallback(({ item }: { item: RoomMessage }) => (
    <MessageBubble
      message={item}
      isMine={item.sender_user_id === myUserId}
      myEmojis={myReactions[item.id] ?? []}
      onLongPress={() => setReactionTarget(item)}
      onToggleReaction={(emoji) => toggleReaction(item, emoji)}
    />
  ), [myUserId, myReactions, toggleReaction]);

  const feed = useMemo(() => messages, [messages]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {room ? `${room.emoji}  ${room.name}` : 'Room'}
          </Text>
          {room && (
            <Text style={styles.headerMeta} numberOfLines={1}>
              {room.member_count} {room.member_count === 1 ? 'member' : 'members'}
            </Text>
          )}
        </View>
      </View>

      {pinned.length > 0 && (
        <View style={styles.pinnedBar}>
          <Text style={styles.pinnedTitle}>Always-available resources</Text>
          {pinned.map((res) => (
            <TouchableOpacity
              key={res.id}
              style={styles.pinnedRow}
              onPress={() => openResource(res)}
              accessibilityRole="button"
              accessibilityLabel={res.title}
            >
              <Text style={styles.pinnedEmoji}>
                {res.resource_type === 'crisis_hotline' ? '🆘' : '📎'}
              </Text>
              <Text style={styles.pinnedRowText}>{res.title}</Text>
              <Text style={styles.pinnedRowArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loading ? (
          <ActivityIndicator color="#D96C88" />
        ) : (
          <FlatList
            ref={listRef}
            data={feed}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={styles.feed}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>Be the first to share</Text>
                <Text style={styles.emptyBody}>
                  Every room is moderated. Pinned resources stay visible above.
                </Text>
              </View>
            }
          />
        )}

        {icebreaker && !draft.trim() && (
          <View style={styles.icebreakerWrap}>
            <View style={styles.icebreakerHeader}>
              <Text style={styles.icebreakerLabel}>✨ Icebreaker</Text>
              <TouchableOpacity
                onPress={() => {
                  setIcebreaker(null);
                  void dismissIcebreaker(roomId).catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss icebreaker suggestion"
                hitSlop={8}
              >
                <Text style={styles.icebreakerDismiss}>Not now</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setDraft(icebreaker)}
              accessibilityRole="button"
              accessibilityLabel="Use this suggestion"
            >
              <Text style={styles.icebreakerText}>{icebreaker}</Text>
              <Text style={styles.icebreakerHint}>Tap to use — you can edit before sending.</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the room…"
            placeholderTextColor={COLORS.textLight}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? <ActivityIndicator color="#FFFCF6" /> : <Text style={styles.sendBtnText}>Send</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Reaction picker */}
      <Modal
        transparent
        visible={!!reactionTarget}
        animationType="fade"
        onRequestClose={() => setReactionTarget(null)}
      >
        <Pressable style={styles.reactionBackdrop} onPress={() => setReactionTarget(null)}>
          <View style={styles.reactionSheet}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => reactionTarget && toggleReaction(reactionTarget, emoji)}
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* C4: crisis resources sheet — opens when the sender's own message is
          classified 'crisis' by the scan pipeline. */}
      <CrisisResourcesSheet
        visible={crisisSheetVisible}
        onClose={() => setCrisisSheetVisible(false)}
        lead="What you just wrote sounds really heavy. You don't have to carry this alone — these lines are staffed right now."
      />
    </SafeAreaView>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({
  message, isMine, myEmojis, onLongPress, onToggleReaction,
}: {
  message: RoomMessage;
  isMine: boolean;
  myEmojis: ReactionEmoji[];
  onLongPress: () => void;
  onToggleReaction: (emoji: ReactionEmoji) => void;
}) {
  const reactionEntries = Object.entries(message.reactions);
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
  });
  const isCompanion = message.message_type === 'ai_companion';
  const isSystem    = message.message_type === 'system';

  // C5: system digests render as a centered card — no reactions, no long-press.
  if (isSystem) {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemCard}>
          <Text style={styles.systemText}>{message.body}</Text>
          <Text style={styles.systemMeta}>{time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      <View style={{ maxWidth: '82%' }}>
        {isCompanion && (
          <Text style={styles.companionName}>✨ Villie · AI companion</Text>
        )}
        {!isMine && !isCompanion && message.sender_name && (
          <Text style={styles.senderName}>{message.sender_name}</Text>
        )}
        <Pressable
          onLongPress={onLongPress}
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            isCompanion && styles.bubbleCompanion,
            isMine && message.ai_scan_status === 'pending' && styles.bubblePending,
          ]}
          accessibilityRole="text"
          accessibilityHint="Long-press to react"
        >
          <Text
            style={[
              styles.bubbleText,
              isMine && styles.bubbleTextMine,
              isCompanion && styles.bubbleTextCompanion,
            ]}
          >
            {message.body}
          </Text>
          <View style={styles.bubbleFooter}>
            {isMine && message.ai_scan_status === 'pending' && (
              <View style={styles.scanningPill}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
                <Text style={styles.scanningPillText}>Scanning…</Text>
              </View>
            )}
            <Text style={[styles.bubbleMeta, isMine && styles.bubbleMetaMine]}>{time}</Text>
          </View>
        </Pressable>
        {reactionEntries.length > 0 && (
          <View style={[styles.reactionsRow, isMine && styles.reactionsRowMine]}>
            {reactionEntries.map(([emoji, count]) => {
              const active = myEmojis.includes(emoji as ReactionEmoji);
              return (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.reactionChip, active && styles.reactionChipActive]}
                  onPress={() => onToggleReaction(emoji as ReactionEmoji)}
                  accessibilityRole="button"
                  accessibilityLabel={`${emoji} reaction, ${count}, ${active ? 'remove' : 'add'}`}
                >
                  <Text style={styles.reactionChipEmoji}>{emoji}</Text>
                  <Text style={[styles.reactionChipCount, active && styles.reactionChipCountActive]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:             { flex: 1, backgroundColor: COLORS.cream },
  header:             {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.paper,
  },
  back:               { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodyMedium, paddingRight: 14 },
  headerTitleWrap:    { flex: 1 },
  headerTitle:        { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  headerMeta:         { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  pinnedBar: {
    backgroundColor: '#F5E9D8',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  pinnedTitle: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold,
    color: COLORS.barkSoft, textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: 6,
  },
  pinnedRow:          {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7,
  },
  pinnedEmoji:        { fontSize: 16, marginRight: 8 },
  pinnedRowText:      { flex: 1, fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.bark },
  pinnedRowArrow:     { color: '#7A4A24', fontSize: 16 },

  chatArea:           { flex: 1 },
  feed:               { padding: 12, flexGrow: 1, justifyContent: 'flex-end' },

  bubbleRow:          { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMine:      { justifyContent: 'flex-end' },
  senderName:         {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.textLight,
    marginBottom: 3, marginLeft: 10, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  bubble:             {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleTheirs:       { backgroundColor: COLORS.paper, borderBottomLeftRadius: 4 },
  bubbleMine:         { backgroundColor: COLORS.coco, borderBottomRightRadius: 4 },
  bubbleCompanion:    {
    backgroundColor: '#F5E9D8',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.sand,
    borderBottomLeftRadius: 4,
  },
  bubbleTextCompanion:{ color: COLORS.bark },
  bubblePending:      { opacity: 0.75 },
  companionName:      {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.sand,
    marginBottom: 3, marginLeft: 10, textTransform: 'uppercase', letterSpacing: 0.4,
  },

  systemRow:          { alignItems: 'center', marginBottom: 10, paddingHorizontal: 8 },
  systemCard:         {
    backgroundColor: 'rgba(184,92,56,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: '90%',
  },
  systemText:         { fontSize: 13, color: COLORS.bark, lineHeight: 19 },
  systemMeta:         { fontSize: 10, color: COLORS.textLight, marginTop: 6, alignSelf: 'flex-end' },

  icebreakerWrap: {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#FFF5E6',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    borderLeftWidth: 3, borderLeftColor: COLORS.sand,
  },
  icebreakerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  icebreakerLabel: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.sand,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  icebreakerDismiss: {
    fontSize: 12, fontFamily: FONTS.bodyMedium, color: COLORS.textLight,
  },
  icebreakerText: { fontSize: 14, color: COLORS.bark, lineHeight: 20 },
  icebreakerHint: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  bubbleText:         { fontSize: 15, color: COLORS.bark, lineHeight: 21 },
  bubbleTextMine:     { color: '#FFF' },
  bubbleFooter:       {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', marginTop: 4, gap: 8,
  },
  bubbleMeta:         { fontSize: 10, color: COLORS.textLight, alignSelf: 'flex-end' },
  bubbleMetaMine:     { color: 'rgba(255,255,255,0.7)' },
  scanningPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
    gap: 5,
  },
  scanningPillText: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontFamily: FONTS.bodyMedium },

  reactionsRow:       { flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' },
  reactionsRowMine:   { justifyContent: 'flex-end' },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
    marginRight: 4, marginTop: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  reactionChipActive: { borderColor: COLORS.coco, backgroundColor: 'rgba(184,92,56,0.12)' },
  reactionChipEmoji:  { fontSize: 13, marginRight: 4 },
  reactionChipCount:  { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  reactionChipCountActive: { color: COLORS.coco },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 8, gap: 8,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: COLORS.cream,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: COLORS.bark,
  },
  sendBtn: {
    backgroundColor: COLORS.coco,
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 64,
  },
  sendBtnText: { color: '#FFFCF6', fontSize: 14, fontFamily: FONTS.bodySemiBold },

  emptyWrap:          { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyEmoji:         { fontSize: 44, marginBottom: 12 },
  emptyTitle:         { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 6 },
  emptyBody:          { fontSize: 13, color: COLORS.barkSoft, textAlign: 'center', lineHeight: 19 },

  reactionBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  reactionSheet: {
    flexDirection: 'row',
    backgroundColor: COLORS.paper,
    paddingHorizontal: 8, paddingVertical: 10,
    borderRadius: 24,
  },
  reactionBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  reactionEmoji: { fontSize: 28 },
});
