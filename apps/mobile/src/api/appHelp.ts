// Global in-app AI help chat ("Villie") — app-guide + light context.
// Backed by supabase/functions/app-help-chat.

import { supabase } from '@/lib/supabase';
import { callEdgeFunction } from '@/lib/edgeFunction';

export interface HelpMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HelpUserContext {
  pregnancy_stage?: string | null;
  due_date?: string | null;
  display_name?: string | null;
}

export interface CrisisResource {
  name: string;
  description: string;
  phone?: string;
  sms?: string;
  sms_body?: string;
}

export interface HelpChatResponse {
  reply: string;
  crisis: boolean;
  crisis_resources?: Record<string, CrisisResource>;
  /** Optional tap-to-send suggested replies for common structured questions. */
  quick_replies?: string[];
  /** Route-to action: Billy deep-links the mom to a screen to finish a sensitive task herself. */
  navigate?: { screen: string; params?: Record<string, unknown> };
  /** Optional tappable open-button under the reply — deep-links via the same NAV_ROUTES map. */
  cta?: { label: string; screen: string };
}

export const appHelpApi = {
  async sendMessage(
    messages: HelpMessage[],
    userContext: HelpUserContext = {},
    location?: { lat: number; lng: number } | null,
    availability?: { start: string; end: string }[] | null,
  ): Promise<HelpChatResponse> {
    // callEdgeFunction, not a bare fetch: app-help-chat became quota'd at 40/hr
    // (05699a2, `_shared/rate-limit.ts`). Without the shared caller a mother who
    // hits the ceiling sees the raw wire error instead of the translated
    // "try again in N min" — the same defect the 2026-09-04 audit's item 3
    // recorded for gear and milk-vault. It also parses defensively, so a
    // cold-start 502 no longer surfaces as a JSON SyntaxError.
    return await callEdgeFunction<HelpChatResponse>('app-help-chat', {
      messages,
      user_context: userContext,
      user_location: location ?? null,
      user_availability: availability && availability.length ? { busy: availability } : null,
    });
  },

  async fetchUserContext(userId: string): Promise<HelpUserContext> {
    const { data, error } = await supabase
      .from('users')
      .select('pregnancy_stage, due_date, display_name')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return {};
    return {
      pregnancy_stage: (data as { pregnancy_stage?: string | null }).pregnancy_stage ?? null,
      due_date: (data as { due_date?: string | null }).due_date ?? null,
      display_name: (data as { display_name?: string | null }).display_name ?? null,
    };
  },
};
