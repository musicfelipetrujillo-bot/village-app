// milk-trust-narrative — "Sarah is a strong match because..."
// Generates a warm, factual 2-3 sentence match narrative for a donor profile.
// Cached 24h on milk_trust_badges.ai_trust_narrative.
// Called when recipient views DonorProfileScreen.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic();
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SYSTEM_PROMPT = `You write warm, factual match narratives for a breast milk donor marketplace.
Given a donor's profile data, write 2–3 sentences starting with the donor's first name.
Focus on specific, verifiable attributes (badge level, diet, storage practices, experience).
Never speculate beyond the provided data. Tone: warm, reassuring, factual.
Do NOT include pricing or contact info. End with why this donor is trustworthy.
Return only the narrative text — no JSON, no formatting.`;

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

    const { donor_profile_id, recipient_preferences } = await req.json();

    // Check 24h cache first
    const { data: badge } = await supabase
      .from('milk_trust_badges')
      .select('ai_trust_narrative, ai_trust_narrative_cached_at')
      .eq('donor_profile_id', donor_profile_id)
      .single();

    const cacheAgeHours = badge?.ai_trust_narrative_cached_at
      ? (Date.now() - new Date(badge.ai_trust_narrative_cached_at).getTime()) / 3_600_000
      : Infinity;

    if (badge?.ai_trust_narrative && cacheAgeHours < 24) {
      return new Response(JSON.stringify({ narrative: badge.ai_trust_narrative, cached: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Fetch full donor profile
    const { data: profile } = await supabase
      .from('milk_donor_profiles')
      .select('display_name, city, state, bio, price_per_oz, supply_oz_available, rating_avg, review_count, is_verified')
      .eq('id', donor_profile_id)
      .single();

    const { data: trustBadge } = await supabase
      .from('milk_trust_badges')
      .select('badge_level, questionnaire_complete, bloodwork_linked, diet_disclosed, medications_disclosed, ai_safety_score')
      .eq('donor_profile_id', donor_profile_id)
      .single();

    const { data: dietFlags } = await supabase
      .from('milk_donor_diet_flags')
      .select('flag_key')
      .eq('donor_profile_id', donor_profile_id)
      .eq('is_active', true);

    const { data: questionnaire } = await supabase
      .from('milk_questionnaire_responses')
      .select('question_key, answer_value')
      .eq('donor_profile_id', donor_profile_id)
      .in('question_key', ['breastfeeding_duration', 'storage_practices', 'smoking', 'alcohol', 'caffeine']);

    const donorName = profile?.display_name?.split(' ')[0] ?? 'This donor';
    const diet = (dietFlags ?? []).map((d: { flag_key: string }) => d.flag_key.replace(/_/g, ' ')).join(', ') || 'no special restrictions';
    const q = Object.fromEntries((questionnaire ?? []).map((r: { question_key: string; answer_value: string }) => [r.question_key, r.answer_value]));

    const profileSummary = [
      `Name: ${donorName}`,
      `Location: ${profile?.city ?? 'Unknown'}, ${profile?.state ?? ''}`,
      `Trust badge: ${trustBadge?.badge_level ?? 'basic'}`,
      `AI safety score: ${trustBadge?.ai_safety_score ?? 'N/A'}/10`,
      `Bloodwork verified: ${trustBadge?.bloodwork_linked ? 'Yes' : 'No'}`,
      `Breastfeeding duration: ${q.breastfeeding_duration ?? 'not specified'}`,
      `Diet: ${diet}`,
      `Storage method: ${q.storage_practices ?? 'not specified'}`,
      `Smoking: ${q.smoking ?? 'not specified'}`,
      `Caffeine: ${q.caffeine ?? 'not specified'}`,
      `Rating: ${profile?.rating_avg ?? 'no reviews yet'} (${profile?.review_count ?? 0} reviews)`,
      `Supply available: ${profile?.supply_oz_available ?? 0} oz`,
      recipient_preferences ? `Recipient preferences: ${recipient_preferences}` : '',
    ].filter(Boolean).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      temperature: 0.5,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Donor profile:\n${profileSummary}` }],
    });

    const narrative = (message.content[0] as { type: string; text: string }).text.trim();

    // Cache on trust badge row
    await supabase
      .from('milk_trust_badges')
      .update({ ai_trust_narrative: narrative, ai_trust_narrative_cached_at: new Date().toISOString() })
      .eq('donor_profile_id', donor_profile_id);

    return new Response(JSON.stringify({ narrative, cached: false }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('milk-trust-narrative error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
