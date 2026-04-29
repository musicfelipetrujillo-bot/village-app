// Shared runtime contract types — source of truth.
// Mirrors the handoff package's RUNTIME_CONNECTION_CONTRACT.md.
// Mobile + Edge Functions + any future internal surface derive from here.
// DO NOT add Village-business fields (pregnancy_stage, etc.) — keep this
// a faithful mirror of the runtime contract. Village-only wrapping types
// belong in the Edge Function layer, not in the shared package.

export type AgentMode = 'triage' | 'run';

/**
 * Request payload for POST /triage and POST /run.
 * Matches the runtime's expected input shape exactly.
 */
export type AgentRequest = {
  raw_input: string;
  source: string;
  related_project?: string | null;
  current_context?: string | null;
  active_projects?: string[];
  approved_for_planning?: boolean;
  validation_notes?: string;
  open_issues?: string;
};

/**
 * The integration envelope the runtime returns on success.
 * This is the core artifact a human reviewer should inspect —
 * route, owner, workstream, human-review flag, category, summary,
 * next_step, risk.
 */
export type IntegrationEnvelope = {
  route: string;
  owner: string;
  workstream: string;
  requires_human_review: boolean;
  category: string;
  summary: string;
  next_step: string;
  risk: string;
};

/**
 * Full response envelope from the runtime. Additional fields beyond
 * `integration_envelope` are left typed as `unknown` on purpose — we
 * pass them through for debug inspection but do not (yet) depend on
 * their internal shape from Village code.
 */
export type AgentResponse = {
  ok: boolean;
  mode?: AgentMode;
  integration_envelope?: IntegrationEnvelope;
  triage?: unknown;
  focus?: unknown;
  plan?: unknown;
  closure?: unknown;
  escalated_to_human?: boolean;
  escalation_reason?: string | null;
  logs?: string[];
  trace?: unknown[];
  error?: string;
  detail?: string;
};

/**
 * Response for GET /health. Shape is intentionally loose — we only care
 * that we can reach the runtime and get a 2xx back.
 */
export type AgentHealthResponse = {
  ok: boolean;
  error?: string;
  detail?: string;
  [k: string]: unknown;
};

/**
 * Village-side taxonomy — keep in sync with VILLAGE_WORKSTREAM_TAXONOMY.md.
 * Surfaced on the internal console so we can visually flag when the runtime
 * returns a workstream outside this set (drift signal).
 */
export const VILLAGE_WORKSTREAMS = [
  'onboarding',
  'donor_trust',
  'milk_flow',
  'specialist_booking',
  'community',
  'events',
  'bugs',
  'research',
  'follow_up',
  'admin',
] as const;

export type VillageWorkstream = (typeof VILLAGE_WORKSTREAMS)[number];

export function isKnownWorkstream(w: string | undefined): w is VillageWorkstream {
  return !!w && (VILLAGE_WORKSTREAMS as readonly string[]).includes(w);
}
