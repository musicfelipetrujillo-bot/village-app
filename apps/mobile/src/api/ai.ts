import { supabase } from '@/lib/supabase';
import { t, type Lang } from '@/i18n';
import { useUserStore } from '@store/user';
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
  if (!res.ok) {
    // 429 = per-user quota (edge `_shared/rate-limit.ts`, migration 135). Without
    // this branch the raw wire code `rate_limited` would be thrown straight into
    // an Alert and shown to the user, which is meaningless to her and alarming in
    // an app she opens at 3am. Translate it, and use Retry-After to say WHEN
    // rather than just "no".
    if (res.status === 429) {
      const lang = (useUserStore.getState().profile?.preferred_language ?? 'en') as Lang;
      const secs = Number(res.headers.get('Retry-After') ?? json.retry_after_seconds ?? 0);
      const minutes = Math.max(1, Math.ceil(secs / 60));
      throw new Error(t('errors.rateLimited', lang, { minutes }));
    }
    throw new Error(json.error ?? `${name} failed`);
  }
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
