import { supabase } from '@/lib/supabase';
import type { AIMatchRequest, AIMatchResponse, AITriageResponse } from 'shared/src/types/v1';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

async function callEdgeFunction<T>(name: string, body: object): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `${name} failed`);
  return json as T;
}

export const aiApi = {
  /** Match mom to best-fit specialists */
  match: (req: AIMatchRequest) =>
    callEdgeFunction<AIMatchResponse>('ai-match', req),

  /** Answer a question about a specific specialist profile */
  profileQA: (specialistId: string, question: string, pregnancyStage?: string, preferredLanguage = 'en') =>
    callEdgeFunction<{ answer: string }>('ai-profile-qa', {
      specialist_id: specialistId,
      question,
      pregnancy_stage: pregnancyStage,
      preferred_language: preferredLanguage,
    }),

  /** Generate 5-7 questions to ask at appointment */
  followupQuestions: (specialistId: string, pregnancyStage: string, preferredLanguage = 'en') =>
    callEdgeFunction<{ questions: string[] }>('ai-followup-questions', {
      specialist_id: specialistId,
      pregnancy_stage: pregnancyStage,
      preferred_language: preferredLanguage,
    }),

  /** Triage a mom's concern — emergency detection first */
  triage: (message: string, pregnancyStage?: string, preferredLanguage = 'en') =>
    callEdgeFunction<AITriageResponse>('ai-triage', {
      message,
      pregnancy_stage: pregnancyStage,
      preferred_language: preferredLanguage,
    }),

  /** Translate a specialist profile field */
  translate: (specialistId: string, fieldName: string, fieldContent: string, targetLang: 'es' | 'ht') =>
    callEdgeFunction<{ translated_text: string; cached: boolean }>('ai-translate', {
      specialist_id: specialistId,
      field_name: fieldName,
      field_content: fieldContent,
      target_lang: targetLang,
    }),

  /** Generate/refresh AI review summary for a specialist */
  refreshReviewSummary: (specialistId: string) =>
    callEdgeFunction<{ summary: string | null }>('ai-review-summary', {
      specialist_id: specialistId,
    }),
};
