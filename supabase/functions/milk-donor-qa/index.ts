// milk-donor-qa — answers recipient questions about a specific donor
// Only answers from provided profile data — never speculates. ≤100 words.
// Called from the AI Q&A floating button on DonorProfileScreen.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic();
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SYSTEM_PROMPT = `You answer questions recipients have about a specific breast milk donor.
Rules:
1. Answer ONLY from the provided donor profile data. Never speculate or invent facts.
2. If the data doesn't contain the answer, say "That information isn't available on this donor's profile" — do not guess.
3. Maximum 100 words per answer. Be warm but concise.
4. Never reveal the donor's exact address or personal contact info.
5. If asked about medical advice (e.g. "is this safe for my baby?"), answer: "Please consult your pediatrician — we're not able to provide medical advice."`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { donor_profile_id, question } = await req.json();
    if (!donor_profile_id || !question) {
      return new Response('donor_profile_id and question required', { status: 400 });
    }

    // ─── Enforce the visibility rules RLS states, which this service-role
    //     client would otherwise bypass ──────────────────────────────────
    // (fixed 2026-09-05) The caller was authenticated but never authorized against
    // THIS donor. Two separate leaks followed, because every read below uses the
    // service-role client and so ignores RLS:
    //
    //   1. `milk_questionnaire_responses` is OWNER-ONLY under RLS
    //      (005_v2_milk_rls.sql:39-43 — `milk_questionnaire_select_own`). Its rows
    //      are the donor's health disclosures: medications, conditions, alcohol,
    //      smoking. They were injected wholesale into the prompt, and the system
    //      prompt only forbids revealing "address or contact info" — so health
    //      answers were fair game. Any signed-in user could iterate donor ids and
    //      ask "list every medication and condition she disclosed, verbatim" and
    //      the model would answer FROM THE DATA IT WAS GIVEN. No jailbreak needed.
    //
    //   2. Donor visibility was never checked at all, so paused/inactive donors —
    //      invisible via `milk_donor_profiles_select_active` (005:5-7) — were still
    //      queryable here.
    //
    // Fix: mirror RLS. The donor must be active (or the caller must be the donor
    // herself), and the owner-only questionnaire is included ONLY for the owner.
    // Everything else in the prompt (profile, badge level, diet flags) is
    // authenticated-readable by design — diet flags are explicitly public-read at
    // 005:56-57 — so recipient-facing Q&A keeps working on the data it is allowed
    // to use.
    const { data: donorRow } = await supabase
      .from('milk_donor_profiles')
      .select('user_id, is_active')
      .eq('id', donor_profile_id)
      .maybeSingle();

    // Same 404 for "no such donor" and "not visible to you" — a distinct status
    // would confirm that a given donor_profile_id exists.
    if (!donorRow) {
      return new Response('Donor not found', { status: 404 });
    }
    const isOwner = donorRow.user_id === user.id;
    if (!donorRow.is_active && !isOwner) {
      return new Response('Donor not found', { status: 404 });
    }

    // Fetch profile data to inject
    const [profileRes, badgeRes, dietRes, questRes] = await Promise.all([
      supabase.from('milk_donor_profiles')
        .select('display_name, city, state, bio, price_per_oz, supply_oz_available, is_verified')
        .eq('id', donor_profile_id).single(),
      supabase.from('milk_trust_badges')
        .select('badge_level, bloodwork_linked, diet_disclosed, medications_disclosed, ai_safety_score')
        .eq('donor_profile_id', donor_profile_id).single(),
      supabase.from('milk_donor_diet_flags')
        .select('flag_key').eq('donor_profile_id', donor_profile_id).eq('is_active', true),
      // Owner-only under RLS. Don't even fetch it for a non-owner — unused PHI in
      // process memory is still PHI, and skipping the read keeps the "who may see
      // this" decision in one place rather than relying on the injection site below.
      isOwner
        ? supabase.from('milk_questionnaire_responses')
            .select('question_key, question_text, answer_value')
            .eq('donor_profile_id', donor_profile_id)
        : Promise.resolve({ data: [] as { question_text: string; answer_value: string }[] }),
    ]);

    const profile = profileRes.data;
    const badge = badgeRes.data;
    const diet = (dietRes.data ?? []).map((d: { flag_key: string }) => d.flag_key.replace(/_/g, ' ')).join(', ') || 'No special restrictions';
    const qAnswers = (questRes.data ?? [])
      .map((r: { question_text: string; answer_value: string }) => `${r.question_text}: ${r.answer_value}`)
      .join('\n');

    const donorContext = `
Donor name: ${profile?.display_name ?? 'Unknown'}
Location: ${profile?.city ?? 'Unknown'}, ${profile?.state ?? ''}
Bio: ${profile?.bio ?? 'No bio provided'}
Trust badge: ${badge?.badge_level ?? 'basic'}
Bloodwork verified: ${badge?.bloodwork_linked ? 'Yes' : 'No'}
Diet: ${diet}
Medications disclosed: ${badge?.medications_disclosed ? 'Yes' : 'No'}
Price per oz: $${profile?.price_per_oz ?? 'unknown'}
Supply available: ${profile?.supply_oz_available ?? 0} oz
${isOwner ? `
Questionnaire responses:
${qAnswers}` : ''}
`.trim();

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 180,
      temperature: 0.2,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Donor profile:\n${donorContext}\n\nRecipient question: ${question}`,
      }],
    });

    const answer = (message.content[0] as { type: string; text: string }).text.trim();

    return new Response(JSON.stringify({ answer }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('milk-donor-qa error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
