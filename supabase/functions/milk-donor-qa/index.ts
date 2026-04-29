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
      supabase.from('milk_questionnaire_responses')
        .select('question_key, question_text, answer_value')
        .eq('donor_profile_id', donor_profile_id),
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

Questionnaire responses:
${qAnswers}
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
