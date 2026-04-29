// UI-card mapper: flattens an AgentResponse's integration_envelope into
// something a screen can render directly. Never throws — unknown fields
// fall back to safe defaults so a malformed response can still be inspected.

import type { AgentResponse } from './schemas';

export type AgentUiCard = {
  route: string;
  owner: string;
  workstream: string;
  category: string;
  summary: string;
  nextStep: string;
  risk: string;
  humanReview: boolean;
  escalated: boolean;
  escalationReason: string | null;
  mode: string;
};

const UNKNOWN = 'unknown';

export function toUiCard(resp: AgentResponse | null | undefined): AgentUiCard {
  const env = resp?.integration_envelope;
  return {
    route: env?.route ?? UNKNOWN,
    owner: env?.owner ?? UNKNOWN,
    workstream: env?.workstream ?? UNKNOWN,
    category: env?.category ?? UNKNOWN,
    summary: env?.summary ?? '',
    nextStep: env?.next_step ?? '',
    risk: env?.risk ?? '',
    humanReview: Boolean(env?.requires_human_review),
    escalated: Boolean(resp?.escalated_to_human),
    escalationReason: resp?.escalation_reason ?? null,
    mode: resp?.mode ?? UNKNOWN,
  };
}
