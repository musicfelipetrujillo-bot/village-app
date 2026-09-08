import { callEdgeFunction } from '@/lib/edgeFunction';
import type { AIMatchRequest, AIMatchResponse, AITriageResponse } from 'shared/src/types/v1';

// The fetch + 429-translation path now lives in `@/lib/edgeFunction` so gear and
// milk-vault callers share it instead of re-deriving it (audit 2026-09-04, item 3).

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
