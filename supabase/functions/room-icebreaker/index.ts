// V3 Phase C5 — Icebreaker suggestion generator.
// POST /functions/v1/room-icebreaker
// Body: { room_id: string, user_id: string }
// Returns: { suggestion: string }
//
// Called once from the mobile client right after a successful joinRoom.
// Upserts icebreaker_suggestions(user_id, room_id, suggestion).
// RoomChatScreen then reads the row via get_icebreaker() and offers the
// suggestion as a tappable prefill in the composer — NEVER auto-sent.
//
// Prompt uses Haiku 4.5, temp 0.8 so we get some variety across users.
// Output is a single sentence, ≤ 160 chars, no emojis, no questions starting
// with "Did you" (too leading). If the model misbehaves, we fall back to a
// hardcoded generic opener keyed on room_type.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACKS: Record<string, string> = {
  stage_local: "Just joined — anyone else in this stage around here?",
  topic:       "First time posting here. Curious what's been helping lately.",
  support:     "Hi everyone — just here to read for now, but glad this space exists.",
};

const SYSTEM_PROMPT = `You are writing a ONE-sentence icebreaker for a new member of a maternal peer-support room.

## Rules
1. ONE sentence, at most 160 characters.
2. First-person, casual, warm. No emoji. No hashtag.
3. Don't assume details you weren't told (don't mention "baby #2", "breastfed", "c-section", etc., unless stage hints it).
4. Never give advice. Never mention @village or The Village. Never say "just joined" twice.
5. Don't ask a clinical question. Don't ask about medications, symptoms, diagnoses.
6. If the room is a support room (e.g. PPD, grief), lean extra gentle — "just here to read" is welcome.

Return ONLY JSON: { "suggestion": "your one-sentence opener" }`;

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { room_id: roomId, user_id: userId } = await req.json();
    if (!roomId || !userId) {
      return new Response(JSON.stringify({ error: 'room_id and user_id required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('name, description, room_type, stage_week_min, stage_week_max, anonymous_mode')
      .eq('id', roomId)
      .maybeSingle();
    if (!room) {
      return new Response(JSON.stringify({ error: 'room not found' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('pregnancy_stage')
      .eq('id', userId)
      .maybeSingle();

    const roomType = String(room.room_type ?? 'topic');
    const stageLine = userRow?.pregnancy_stage
      ? `Asker's stage: ${userRow.pregnancy_stage}.`
      : '';
    const weekLine = (room.stage_week_min != null && room.stage_week_max != null)
      ? `Room stage window: weeks ${room.stage_week_min}–${room.stage_week_max}.`
      : '';

    const userPrompt = `Room name: ${room.name}
Room description: ${room.description}
Room type: ${roomType}
Anonymous mode: ${room.anonymous_mode}
${weekLine}
${stageLine}

Write a one-sentence icebreaker per the rules. JSON only.`;

    let suggestion = FALLBACKS[roomType] ?? FALLBACKS.topic;
    try {
      const ai = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        temperature: 0.8,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
      });
      const raw = (ai.content[0] as { text: string }).text;
      const parsed = JSON.parse(stripFence(raw)) as { suggestion?: string };
      const cand = (parsed.suggestion ?? '').trim();
      // Sanity: enforce length + no emoji pattern.
      if (cand.length >= 8 && cand.length <= 200 && !/[\p{Emoji_Presentation}\u200d]/u.test(cand)) {
        suggestion = cand.length > 160 ? cand.slice(0, 157) + '…' : cand;
      }
    } catch {
      /* fall through to hardcoded opener */
    }

    // Upsert: one active suggestion per (user, room). If an older row exists,
    // replace its text (unique constraint drives the upsert conflict target).
    const { error: upsertErr } = await supabase
      .from('icebreaker_suggestions')
      .upsert(
        {
          user_id: userId,
          room_id: roomId,
          suggestion,
          used_at: null,
          dismissed_at: null,
        },
        { onConflict: 'user_id,room_id' },
      );

    if (upsertErr) {
      return new Response(JSON.stringify({ suggestion, _warning: upsertErr.message }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ suggestion }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(
      JSON.stringify({ suggestion: FALLBACKS.topic, _error: err instanceof Error ? err.message : 'unknown' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
