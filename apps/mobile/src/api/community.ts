// V3 Community Rooms — API client (Phase C1)
// Read operations hit tables directly (RLS enforced); membership goes through RPCs
// so the member_count trigger stays accurate and future admission rules have one
// choke point.
import { supabase } from '@/lib/supabase';

export type RoomType = 'stage_local' | 'topic' | 'support';
export type RoomColor = 'rust' | 'olive' | 'brown' | 'cream';
export type AnonymousMode = 'none' | 'optional' | 'mandatory';
export type NotifPref = 'all' | 'mentions' | 'none';

export interface Room {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  room_type: RoomType;
  color_theme: RoomColor;
  city: string | null;
  stage_week_min: number | null;
  stage_week_max: number | null;
  anonymous_mode: AnonymousMode;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export interface RoomDiscoveryRow extends Omit<Room, 'is_active' | 'created_at'> {
  is_member: boolean;
  stage_match_score: number;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_muted: boolean;
  notif_pref: NotifPref;
}

export interface PinnedResource {
  id: string;
  room_id: string;
  title: string;
  resource_type: 'crisis_hotline' | 'article' | 'booking_link' | 'event';
  url: string | null;
  phone_number: string | null;
  display_order: number;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Discovery — stage-match-ranked room list
// ---------------------------------------------------------------------------
export async function listRoomsForDiscovery(userId: string | null): Promise<RoomDiscoveryRow[]> {
  const { data, error } = await supabase.rpc('list_rooms_for_discovery', {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data ?? []) as RoomDiscoveryRow[];
}

// ---------------------------------------------------------------------------
// Fetch a single room by slug (for deep links)
// ---------------------------------------------------------------------------
export async function getRoomBySlug(slug: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data as Room | null;
}

// ---------------------------------------------------------------------------
// Membership (via RPC so member_count trigger fires)
// ---------------------------------------------------------------------------
export async function joinRoom(roomId: string): Promise<RoomMember> {
  const { data, error } = await supabase.rpc('join_room', { p_room_id: roomId });
  if (error) throw error;
  return data as RoomMember;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_room', { p_room_id: roomId });
  if (error) throw error;
}

export async function getMyMembership(roomId: string, userId: string): Promise<RoomMember | null> {
  const { data, error } = await supabase
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as RoomMember | null;
}

// ---------------------------------------------------------------------------
// Pinned resources (always visible in PPD/support rooms)
// ---------------------------------------------------------------------------
export async function listPinnedResources(roomId: string): Promise<PinnedResource[]> {
  const { data, error } = await supabase
    .from('pinned_resources')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PinnedResource[];
}

// ---------------------------------------------------------------------------
// Phase C2 — Messaging
// ---------------------------------------------------------------------------
export const REACTION_EMOJIS = ['❤️', '🤗', '💪', '😂', '😢', '🙏'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export type MessageType = 'user' | 'system' | 'ai_companion' | 'expert';
export type AiScanStatus = 'pending' | 'clear' | 'flagged' | 'crisis';

export interface RoomMessage {
  id: string;
  room_id: string;
  sender_user_id: string | null;
  sender_anon_id: string | null;
  body: string;
  message_type: MessageType;
  parent_id: string | null;
  ai_scan_status: AiScanStatus;
  created_at: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  /** e.g. { "❤️": 3, "🙏": 1 }. Empty object if none. */
  reactions: Record<string, number>;
}

/** Page of messages, newest-first. `before` is the oldest row's `created_at` for the next page. */
export async function listRoomMessages(
  roomId: string,
  opts: { limit?: number; before?: string | null } = {},
): Promise<RoomMessage[]> {
  const { data, error } = await supabase.rpc('list_room_messages', {
    p_room_id: roomId,
    p_limit: opts.limit ?? 50,
    p_before: opts.before ?? null,
  });
  if (error) throw error;
  return (data ?? []) as RoomMessage[];
}

/** Insert a message. Server RLS requires caller to be a room member. */
export async function sendRoomMessage(
  roomId: string,
  body: string,
): Promise<{ id: string; created_at: string }> {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    throw new Error('Message must be 1–2000 characters.');
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');

  const { data, error } = await supabase
    .from('room_messages')
    .insert({ room_id: roomId, sender_user_id: user.id, body: trimmed })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

/** Mark the room read (advances room_members.last_read_at to now()). */
export async function markRoomRead(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_room_read', { p_room_id: roomId });
  if (error) throw error;
}

/**
 * Subscribe to NEW messages in a room via Supabase Realtime.
 *
 * C4: Messages are inserted with `ai_scan_status='pending'` and transition
 * to 'clear' only after the BEFORE-publish scan pipeline succeeds. We listen
 * for both INSERTs and UPDATEs — an INSERT of a pending row is filtered out,
 * and an UPDATE that flips the row to 'clear' surfaces the message.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToRoomMessages(
  roomId: string,
  onNew: (row: RoomMessageInsertPayload) => void,
): () => void {
  const emit = (row: RoomMessageInsertPayload) => {
    if (row.ai_scan_status === 'clear') onNew(row);
  };

  const channel = supabase
    .channel(`room_messages:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => emit(payload.new as RoomMessageInsertPayload),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => emit(payload.new as RoomMessageInsertPayload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * C4: Poll a message's scan status until it leaves 'pending' (or budget runs out).
 * Used by the composer to surface CrisisResourcesSheet when the sender's own
 * message trips the crisis classifier.
 */
export async function waitForScanVerdict(
  messageId: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<AiScanStatus> {
  const intervalMs = opts.intervalMs ?? 1500;
  const maxAttempts = opts.maxAttempts ?? 5;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const { data } = await supabase
      .from('room_messages')
      .select('ai_scan_status')
      .eq('id', messageId)
      .maybeSingle();
    const status = data?.ai_scan_status as AiScanStatus | undefined;
    if (status && status !== 'pending') return status;
  }
  return 'pending';
}

/** Shape of the raw INSERT payload. Lacks sender_name/avatar/reactions —
 *  the subscriber should refetch or enrich client-side. */
export interface RoomMessageInsertPayload {
  id: string;
  room_id: string;
  sender_user_id: string | null;
  sender_anon_id: string | null;
  body: string;
  message_type: MessageType;
  parent_id: string | null;
  ai_scan_status: AiScanStatus;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------
export async function addReaction(messageId: string, emoji: ReactionEmoji): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { error } = await supabase
    .from('room_message_reactions')
    .insert({ message_id: messageId, user_id: user.id, emoji });
  // Dedupe error from UNIQUE(message_id, user_id, emoji) is benign.
  if (error && !/duplicate key/i.test(error.message)) throw error;
}

export async function removeReaction(messageId: string, emoji: ReactionEmoji): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { error } = await supabase
    .from('room_message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji);
  if (error) throw error;
}

/** Current user's active reaction emojis for a set of messages. */
export async function listMyReactions(messageIds: string[]): Promise<Record<string, ReactionEmoji[]>> {
  if (messageIds.length === 0) return {};
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data, error } = await supabase
    .from('room_message_reactions')
    .select('message_id, emoji')
    .eq('user_id', user.id)
    .in('message_id', messageIds);
  if (error) throw error;
  const out: Record<string, ReactionEmoji[]> = {};
  for (const row of (data ?? []) as { message_id: string; emoji: ReactionEmoji }[]) {
    (out[row.message_id] ??= []).push(row.emoji);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phase C4 — Moderator dashboard (crisis flag review)
// ---------------------------------------------------------------------------
export type CrisisSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CrisisStatus = 'open' | 'reviewed' | 'escalated' | 'resolved';

export interface CrisisFlag {
  id: string;
  message_id: string;
  room_id: string;
  room_name: string;
  flagged_user_id: string | null;
  severity: CrisisSeverity;
  trigger_phrases: string[] | null;
  ai_assessment: string | null;
  status: CrisisStatus;
  created_at: string;
  message_body: string | null;
  sender_name: string | null;
}

/** Does the current user moderate any room? Used to gate ModeratorDashboard entry. */
export async function isModeratorAnywhere(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_moderator_anywhere');
  if (error) throw error;
  return Boolean(data);
}

/** Open crisis flags across all rooms the caller moderates (severity-sorted). */
export async function listOpenCrisisFlags(): Promise<CrisisFlag[]> {
  const { data, error } = await supabase.rpc('list_open_crisis_flags_for_moderator');
  if (error) throw error;
  return (data ?? []) as CrisisFlag[];
}

/** Mark a flag as reviewed/escalated/resolved. Caller must moderate the flag's room. */
export async function resolveCrisisFlag(
  flagId: string,
  action: 'reviewed' | 'escalated' | 'resolved',
  notes?: string,
): Promise<void> {
  const { error } = await supabase.rpc('resolve_crisis_flag', {
    p_flag_id: flagId,
    p_action: action,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Phase C5 — AI companion (@village), icebreakers, auto-match
// ---------------------------------------------------------------------------

/**
 * Word-boundary match for an @village mention. Mirrors the Postgres
 * `has_village_mention` helper so we don't round-trip for the cheap check.
 */
export function hasVillageMention(body: string): boolean {
  return /(^|[^a-z0-9_])@village($|[^a-z0-9_])/i.test(body);
}

/**
 * Invoke the companion on the just-sent message. Fire-and-forget from the
 * client — the reply arrives via Realtime as a `message_type='ai_companion'`
 * row. Returns the edge-function verdict for optional UI telemetry.
 */
export async function invokeAiCompanion(messageId: string): Promise<{
  posted: boolean;
  reply_message_id?: string;
  crisis_detected?: boolean;
  reason?: string;
}> {
  const { data, error } = await supabase.functions.invoke('room-ai-companion', {
    body: { message_id: messageId },
  });
  if (error) throw error;
  return (data ?? { posted: false }) as {
    posted: boolean;
    reply_message_id?: string;
    crisis_detected?: boolean;
    reason?: string;
  };
}

/** Read the current user's pending icebreaker for this room, if any. */
export async function getIcebreaker(roomId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_icebreaker', { p_room_id: roomId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Mark the icebreaker dismissed so we don't show it again for this (user, room). */
export async function dismissIcebreaker(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('dismiss_icebreaker', { p_room_id: roomId });
  if (error) throw error;
}

/**
 * Generate (or refresh) the icebreaker suggestion for a (user, room) pair.
 * Fire-and-forget right after a successful joinRoom — result is persisted
 * server-side; client reads it via getIcebreaker on RoomChat mount.
 */
export async function generateIcebreaker(roomId: string): Promise<{ suggestion: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { data, error } = await supabase.functions.invoke('room-icebreaker', {
    body: { room_id: roomId, user_id: user.id },
  });
  if (error) throw error;
  return data as { suggestion: string };
}

export interface RoomMatchSuggestion {
  primary_room: Room | null;
  secondary_rooms: Room[];
  reason: string | null;
  created_at: string | null;
}

/** Fetch the user's current AI-suggested rooms (hydrated). */
export async function getMyRoomMatch(): Promise<RoomMatchSuggestion | null> {
  const { data, error } = await supabase.rpc('get_my_room_match');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    primary_room: (row.primary_room ?? null) as Room | null,
    secondary_rooms: ((row.secondary_rooms ?? []) as Room[]),
    reason: (row.reason ?? null) as string | null,
    created_at: (row.created_at ?? null) as string | null,
  };
}

/** Kick off a refresh of the user's room-match suggestion. Fire-and-forget. */
export async function refreshRoomMatch(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.functions.invoke('room-auto-match', {
    body: { user_id: user.id },
  });
}

export interface RoomWeeklySummary {
  id: string;
  room_id: string;
  period_start: string;
  period_end: string;
  summary: string;
  message_count: number;
  pushed_at: string | null;
  created_at: string;
}

/** Latest weekly summary for a room (if any). */
export async function getLatestWeeklySummary(roomId: string): Promise<RoomWeeklySummary | null> {
  const { data, error } = await supabase
    .from('room_weekly_summaries')
    .select('*')
    .eq('room_id', roomId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RoomWeeklySummary | null;
}
