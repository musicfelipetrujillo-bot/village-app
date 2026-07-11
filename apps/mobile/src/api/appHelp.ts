// Global in-app AI help chat ("Villie") — app-guide + light context.
// Backed by supabase/functions/app-help-chat.

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

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
}

export const appHelpApi = {
  async sendMessage(
    messages: HelpMessage[],
    userContext: HelpUserContext = {},
    location?: { lat: number; lng: number } | null,
  ): Promise<HelpChatResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/app-help-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ messages, user_context: userContext, user_location: location ?? null }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'app-help-chat failed');
    return json as HelpChatResponse;
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
