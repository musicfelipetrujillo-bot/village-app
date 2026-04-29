// V3 Phase C5 — AI Companion (@village) responder.
// POST /functions/v1/room-ai-companion
// Body: { message_id: string }
// Returns: { posted: boolean, reply_message_id?: string, crisis_detected?: boolean }
//
// Flow (called from the mobile client immediately after it has SENT the
// user's @village-mention message and gotten a real row id back):
//   1. Service-role-load the trigger message + the asking user's stage context.
//   2. If the trigger row's ai_scan_status is 'crisis' → suppress reply.
//      (The C4 pipeline already removed it from the feed + opened the crisis
//      sheet on the sender.) Log the suppression to ai_companion_mentions.
//   3. Otherwise, pull the last 20 cleared messages in the room as short
//      context for coherence.
//   4. Rate-limit: at most 3 @village replies per user per room per 60 min.
//   5. Haiku 4.5, temp 0.4, 2–4 warm sentences + mandatory disclaimer.
//   6. Insert a message_type='ai_companion' row as service role; the C4
//      trigger marks it 'clear' inline (trusted type) and Realtime surfaces
//      it to every member.
//   7. Log to ai_companion_mentions for audit + rate-limit ledger.
//
// Safety:
//   - Haiku temp 0.4 (warmer than crisis classifier but still measured).
//   - Prompt forbids diagnosis/prescription. Disclaimer enforced post-hoc.
//   - If the user's message trips C4 crisis, we never compete with the
//     CrisisResourcesSheet routing — companion stays silent.
//   - Fail-silent on AI/insert errors. Missing reply is better than a
//     hallucinated one.

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

const RATE_LIMIT_PER_HOUR = 3;

const SYSTEM_PROMPT = `You are "Villie", the AI companion in The Village — a maternal health peer-support chat app.
You are invoked only when someone explicitly types @village in a room. Treat that as a direct ask.

## Role
Reply in 2–4 warm, specific sentences. You are NOT a therapist, doctor, lactation consultant, or midwife. You are a kind, informed presence who:
- validates what the mom is experiencing,
- shares one small, practical, NON-PRESCRIPTIVE idea if appropriate,
- points to a real human resource (988 / PSI / her provider / an IBCLC / a therapist) when the ask is heavy.

## Hard rules
1. NEVER diagnose, prescribe, or interpret symptoms. No drug names, no dosages, no "you probably have X".
2. NEVER promise outcomes ("this will pass in 3 days").
3. NEVER quote another user or reveal names. Reference the asker only as "you".
4. Always end the reply with one plain sentence exactly: "Not medical advice — please talk to your provider for anything urgent."
5. Keep the reply under 90 words. Shorter is almost always better.
6. Match tone. If she wrote "exhausted", don't be chipper; if she wrote "yay!", don't be somber.
7. If the message hints at suicidal ideation, self-harm, or a medical emergency, your ENTIRE reply is: name 988 (or 911 if emergency) + "Please reach out right now — you don't have to be alone in this." + disclaimer.

## Output
Return ONLY valid JSON:
{ "reply": "your 2–4 sentence reply ending with the disclaimer" }`;

interface TriggerMessage {
  id: string;
  room_id: string;
  sender_user_id: string | null;
  body: string;
  ai_scan_status: string;
  message_type: string;
}

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

async function logMention(row: {
  user_id: string;
  room_id: string;
  trigger_message_id: string;
  reply_message_id?: string | null;
  crisis_detected?: boolean;
  suppressed?: boolean;
}) {
  await supabase.from('ai_companion_mentions').insert({
    user_id: row.user_id,
    room_id: row.room_id,
    trigger_message_id: row.trigger_message_id,
    reply_message_id: row.reply_message_id ?? null,
    crisis_detected: row.crisis_detected ?? false,
    suppressed: row.suppressed ?? false,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { message_id: messageId } = await req.json();
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'message_id required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { data: msg } = await supabase
      .from('room_messages')
      .select('id, room_id, sender_user_id, body, ai_scan_status, message_type')
      .eq('id', messageId)
      .maybeSingle();
    if (!msg) {
      return new Response(JSON.stringify({ error: 'message not found' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const trigger = msg as TriggerMessage;
    if (!trigger.sender_user_id) {
      return new Response(JSON.stringify({ posted: false, reason: 'no_sender' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // C4 hand-off: if the sender's message is crisis-classified, suppress.
    if (trigger.ai_scan_status === 'crisis') {
      await logMention({
        user_id: trigger.sender_user_id,
        room_id: trigger.room_id,
        trigger_message_id: trigger.id,
        crisis_detected: true,
        suppressed: true,
      });
      return new Response(JSON.stringify({ posted: false, crisis_detected: true }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Rate-limit: ≤ RATE_LIMIT_PER_HOUR per user per room per 60 min.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('ai_companion_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', trigger.sender_user_id)
      .eq('room_id', trigger.room_id)
      .gte('created_at', hourAgo);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      await logMention({
        user_id: trigger.sender_user_id,
        room_id: trigger.room_id,
        trigger_message_id: trigger.id,
        suppressed: true,
      });
      return new Response(JSON.stringify({ posted: false, reason: 'rate_limited' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Pull short context: last 20 cleared messages in the room.
    const { data: ctxRows } = await supabase
      .from('room_messages')
      .select('body, message_type, created_at')
      .eq('room_id', trigger.room_id)
      .eq('ai_scan_status', 'clear')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20);
    const context = (ctxRows ?? []).reverse()
      .map((r) => `[${r.message_type}] ${r.body}`)
      .join('\n')
      .slice(0, 3000);

    // Stage context for the asker.
    const { data: userRow } = await supabase
      .from('users')
      .select('pregnancy_stage')
      .eq('id', trigger.sender_user_id)
      .maybeSingle();

    const stageNote = userRow?.pregnancy_stage
      ? `Asker's stage: ${userRow.pregnancy_stage}.`
      : '';

    const userPrompt = `Recent room context (oldest → newest):
${context || '(room has no prior cleared messages)'}

The asker's @village message: ${trigger.body}

${stageNote}

Reply per the rules. JSON only.`;

    const ai = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      temperature: 0.4,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (ai.content[0] as { text: string }).text;
    const parsed = JSON.parse(stripFence(raw)) as { reply?: string };
    let reply = (parsed.reply ?? '').trim();
    if (!reply) {
      return new Response(JSON.stringify({ posted: false, reason: 'empty_reply' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    // Enforce disclaimer.
    if (!/medical advice/i.test(reply)) {
      reply += '\n\nNot medical advice — please talk to your provider for anything urgent.';
    }
    if (reply.length > 800) reply = reply.slice(0, 780) + '…';

    // Insert the companion reply. message_type='ai_companion' is trusted by
    // the C4 AFTER-INSERT trigger, which marks it 'clear' inline.
    const { data: replyRow, error: insertErr } = await supabase
      .from('room_messages')
      .insert({
        room_id:        trigger.room_id,
        sender_user_id: null,
        sender_anon_id: null,
        body:           reply,
        message_type:   'ai_companion',
        parent_id:      trigger.id,
        ai_scan_status: 'clear',
      })
      .select('id')
      .single();

    if (insertErr || !replyRow) {
      await logMention({
        user_id: trigger.sender_user_id,
        room_id: trigger.room_id,
        trigger_message_id: trigger.id,
        suppressed: true,
      });
      return new Response(JSON.stringify({ posted: false, reason: 'insert_failed' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    await logMention({
      user_id: trigger.sender_user_id,
      room_id: trigger.room_id,
      trigger_message_id: trigger.id,
      reply_message_id: replyRow.id,
    });

    return new Response(JSON.stringify({ posted: true, reply_message_id: replyRow.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(
      JSON.stringify({ posted: false, _error: err instanceof Error ? err.message : 'unknown' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
