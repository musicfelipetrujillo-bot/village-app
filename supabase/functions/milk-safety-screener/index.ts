// milk-safety-screener — AI safety evaluation of donor questionnaire responses
// Called by milk-stripe-connect after questionnaire completion.
// Returns { safety_score, flags[], auto_deactivate }
// block severity → auto-deactivates listing + sends Twilio SMS to donor.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic();
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SYSTEM_PROMPT = `You are a safety screener for a peer breast milk donation platform.
Your job is to evaluate donor questionnaire responses for infant safety risks.

You MUST return ONLY valid JSON in this exact format:
{
  "safety_score": <number 0.0–10.0, where 10 = safest>,
  "flags": [
    {
      "severity": "block" | "warn" | "note",
      "category": "medication" | "substance" | "health_condition" | "diet" | "storage",
      "description": "<brief plain-English explanation>"
    }
  ],
  "summary": "<1-2 sentence overall assessment>"
}

Severity definitions:
- block: Immediate infant safety risk (active chemotherapy, recreational drugs, certain medications contraindicated in breastfeeding). Listing must be deactivated.
- warn: Potential concern requiring recipient awareness (non-essential medications, certain dietary supplements).
- note: Informational flag with no safety concern (common vitamins, disclosed diet restrictions).

If no flags, return "flags": [].
Be conservative. When in doubt, escalate severity.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { donor_profile_id } = await req.json();
    if (!donor_profile_id) return new Response('donor_profile_id required', { status: 400 });

    // Verify caller owns the donor profile or is service role
    const { data: profile } = await supabase
      .from('milk_donor_profiles')
      .select('id, display_name, user_id')
      .eq('id', donor_profile_id)
      .single();

    if (!profile || profile.user_id !== user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // Fetch questionnaire responses
    const { data: responses } = await supabase
      .from('milk_questionnaire_responses')
      .select('question_key, question_text, answer_value')
      .eq('donor_profile_id', donor_profile_id);

    // Fetch medications
    const { data: medications } = await supabase
      .from('milk_donor_medications')
      .select('medication_name, dosage, frequency, is_current')
      .eq('donor_profile_id', donor_profile_id)
      .eq('is_current', true);

    // Fetch diet flags
    const { data: dietFlags } = await supabase
      .from('milk_donor_diet_flags')
      .select('flag_key')
      .eq('donor_profile_id', donor_profile_id)
      .eq('is_active', true);

    const questionnaireSummary = (responses ?? [])
      .map((r: { question_key: string; question_text: string; answer_value: string }) => `Q: ${r.question_text}\nA: ${r.answer_value}`)
      .join('\n\n');

    const medicationSummary = (medications ?? []).length > 0
      ? (medications as { medication_name: string; dosage: string | null; frequency: string | null }[]).map((m) => `${m.medication_name} ${m.dosage ?? ''} ${m.frequency ?? ''}`.trim()).join(', ')
      : 'None disclosed';

    const dietSummary = (dietFlags ?? []).length > 0
      ? (dietFlags as { flag_key: string }[]).map((f) => f.flag_key).join(', ')
      : 'No special diet';

    const userContent = `Donor questionnaire responses:

${questionnaireSummary}

Current medications: ${medicationSummary}
Diet flags: ${dietSummary}

Please evaluate for infant safety risks.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      temperature: 0,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    let result: {
      safety_score: number;
      flags: { severity: string; category: string; description: string }[];
      summary: string;
    };
    try {
      result = JSON.parse(raw);
    } catch {
      result = { safety_score: 5.0, flags: [{ severity: 'warn', category: 'health_condition', description: 'Could not parse AI response — manual review required.' }], summary: 'Requires manual review.' };
    }

    const hasBlock = result.flags.some((f: { severity: string }) => f.severity === 'block');

    // Update trust badge with AI evaluation
    await supabase.from('milk_trust_badges').upsert({
      donor_profile_id,
      ai_safety_score: result.safety_score,
      ai_safety_flags: result.flags,
      ai_last_evaluated_at: new Date().toISOString(),
    }, { onConflict: 'donor_profile_id' });

    // Auto-deactivate if block flag
    if (hasBlock) {
      await supabase
        .from('milk_donor_profiles')
        .update({ is_active: false })
        .eq('id', donor_profile_id);

      await supabase
        .from('milk_listings')
        .update({ status: 'paused' })
        .eq('donor_profile_id', donor_profile_id)
        .eq('status', 'active');

      // Notify donor via Twilio (best-effort)
      const { data: donorUser } = await supabase
        .from('users')
        .select('phone, full_name, notif_prefs')
        .eq('id', profile.user_id)
        .single();

      // A2.b: honor milk_hub notif pref. The DB-side is_active/paused change
      // still happens regardless — this gate only silences the outgoing SMS.
      // A donor who's opted out of Milk Hub pings will still see "paused"
      // when they open the app. If product/legal later deems this transactional
      // (account status), remove this gate — it is NOT crisis-tier safety SMS.
      const mhuPref = donorUser?.notif_prefs?.milk_hub ?? true;
      if (donorUser?.phone && mhuPref) {
        const smsBody = `Hi ${donorUser.full_name ?? 'there'}, your Village Milk listing has been paused for a safety review. Our team will reach out within 24 hours. Questions? Email support@thevillage.app`;
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ to: donorUser.phone, body: smsBody }),
        });
      }
    }

    return new Response(JSON.stringify({
      safety_score: result.safety_score,
      flags: result.flags,
      summary: result.summary,
      auto_deactivated: hasBlock,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('milk-safety-screener error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
