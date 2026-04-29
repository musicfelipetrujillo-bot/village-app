// V3 Phase C4 — Async crisis detection + content moderation for room_messages.
// POST /functions/v1/room-message-scan
// Body: { message_id: string }
// Returns: { ai_scan_status: 'clear'|'flagged'|'crisis', crisis: boolean }
//
// Flow:
//   1. AFTER-INSERT trigger on room_messages fires pg_net POST here.
//   2. We service-role-read the message row.
//   3. Fire two Haiku 4.5 calls in Promise.all (3s timeout each):
//        - crisis scan  (suicidal ideation, self-harm, maternal emergencies)
//        - moderation scan (harassment, hate, spam, prescriptive medical advice)
//   4. PATCH the row: 'crisis' wins over 'flagged' wins over 'clear'.
//   5. If 'crisis' → insert crisis_flags row + invoke twilio-sms to moderators.
//
// Fail-open: any timeout/parse error → mark 'clear'. Keeps chat usable when
// Anthropic is flaky. A future nightly sweep can re-scan cleared rows for
// drift.

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

const SCAN_TIMEOUT_MS = 3000;

const CRISIS_PROMPT = `You are a safety classifier for a maternal health peer-support chat.
Analyze the single message below and return JSON indicating whether it warrants an urgent crisis response.

Crisis triggers (severity = critical or high):
- Suicidal ideation ("I want to die", "I can't go on", "I might hurt myself")
- Self-harm or ideation of harming baby
- Active medical emergency (heavy bleeding, severe pain, baby unresponsive, seizure, stroke signs)
- Active domestic violence or abuse in progress

Severity guide:
- critical: imminent danger, active emergency
- high: strong suicidal/self-harm language, not necessarily imminent
- medium: severe depression, hopelessness, concerning patterns
- low: sad/struggling but no crisis signal
- none: no safety concern

Return ONLY JSON:
{
  "is_crisis": boolean,
  "severity": "critical"|"high"|"medium"|"low"|"none",
  "phrases": string[],
  "assessment": string
}`;

const MOD_PROMPT = `You are a content moderation classifier for a maternal peer-support chat.
Flag ONLY content that violates community guidelines. Do NOT flag normal venting, sadness, or struggles.

Flag:
- Harassment or personal attacks against another user
- Hate speech (race, religion, gender identity, etc.)
- Spam / commercial promotion / external recruitment
- Prescriptive unsolicited medical advice ("Take drug X at dose Y")
- Graphic sexual content
- Doxxing (phone numbers, addresses of others)

Do NOT flag:
- Expressing own struggles, sadness, anxiety
- Asking for advice
- Venting about baby, partner, family
- Sharing one's own medical experience

Return ONLY JSON:
{
  "should_flag": boolean,
  "reason": string | null
}`;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function stripCodeFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

async function scanCrisis(body: string) {
  const ai = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system: [{ type: 'text', text: CRISIS_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Message: ${body}\n\nJSON only.` }],
  });
  const raw = (ai.content[0] as { text: string }).text;
  return JSON.parse(stripCodeFence(raw)) as {
    is_crisis: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
    phrases: string[];
    assessment: string;
  };
}

async function scanModeration(body: string) {
  const ai = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system: [{ type: 'text', text: MOD_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Message: ${body}\n\nJSON only.` }],
  });
  const raw = (ai.content[0] as { text: string }).text;
  return JSON.parse(stripCodeFence(raw)) as {
    should_flag: boolean;
    reason: string | null;
  };
}

async function notifyModerators(roomId: string, severity: string, messageBody: string) {
  const { data: moderators } = await supabase
    .from('room_moderators')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('is_active', true);
  if (!moderators || moderators.length === 0) return;

  const userIds = moderators.map((m) => m.user_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, phone')
    .in('id', userIds);
  const phones = (users ?? []).map((u) => u.phone).filter(Boolean) as string[];
  if (phones.length === 0) return;

  const snippet = messageBody.length > 80 ? messageBody.slice(0, 77) + '…' : messageBody;
  const smsBody = `[Village] Crisis flag (${severity}) in community chat: "${snippet}". Open the Moderator Dashboard to review.`;

  await Promise.all(phones.map((to) =>
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ to, body: smsBody }),
    }).catch(() => null)
  ));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let messageId = '';
  try {
    const payload = await req.json();
    messageId = payload.message_id;
    if (!messageId) throw new Error('message_id required');

    const { data: msg } = await supabase
      .from('room_messages')
      .select('id, room_id, sender_user_id, body, message_type, ai_scan_status')
      .eq('id', messageId)
      .maybeSingle();

    if (!msg) {
      return new Response(JSON.stringify({ error: 'message not found' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (msg.ai_scan_status !== 'pending') {
      return new Response(
        JSON.stringify({ ai_scan_status: msg.ai_scan_status, crisis: false, noop: true }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const [crisisRes, modRes] = await Promise.all([
      withTimeout(scanCrisis(msg.body), SCAN_TIMEOUT_MS).catch(() => null),
      withTimeout(scanModeration(msg.body), SCAN_TIMEOUT_MS).catch(() => null),
    ]);

    let finalStatus: 'clear' | 'flagged' | 'crisis' = 'clear';
    if (crisisRes?.is_crisis) finalStatus = 'crisis';
    else if (modRes?.should_flag) finalStatus = 'flagged';

    await supabase.from('room_messages')
      .update({ ai_scan_status: finalStatus, ai_scan_at: new Date().toISOString() })
      .eq('id', messageId);

    if (finalStatus === 'crisis' && crisisRes) {
      // crisis_flags.severity CHECK is (low|medium|high|critical); coerce none→high.
      const sev = crisisRes.severity === 'none' || crisisRes.severity === 'low'
        ? 'high'
        : crisisRes.severity;
      await supabase.from('crisis_flags').insert({
        message_id:      messageId,
        room_id:         msg.room_id,
        flagged_user_id: msg.sender_user_id,
        severity:        sev,
        trigger_phrases: crisisRes.phrases ?? [],
        ai_assessment:   crisisRes.assessment ?? null,
        status:          'open',
      });
      await notifyModerators(msg.room_id, sev, msg.body);
    }

    return new Response(
      JSON.stringify({ ai_scan_status: finalStatus, crisis: finalStatus === 'crisis' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Fail-open — mark as clear so chat stays usable.
    if (messageId) {
      await supabase.from('room_messages')
        .update({ ai_scan_status: 'clear', ai_scan_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('ai_scan_status', 'pending');
    }
    return new Response(
      JSON.stringify({
        ai_scan_status: 'clear',
        crisis: false,
        _error: err instanceof Error ? err.message : 'unknown',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
