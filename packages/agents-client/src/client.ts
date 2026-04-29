// Village-side agents client.
//
// IMPORTANT: this client does NOT call the runtime (`AGENT_BASE_URL`) directly.
// It calls The Village's internal Edge Function bridge, which in turn calls
// the runtime. That indirection is enforced for three reasons:
//   (1) the runtime URL / auth secret never ships in the mobile bundle,
//   (2) we get a single kill-switch inside The Village backend,
//   (3) runtime outputs cannot leak into public flows without review.
//
// Consumers must inject their own invoker (a supabase-js `functions.invoke`
// or a Deno fetch wrapper). This keeps the package free of a hard dependency
// on @supabase/supabase-js and lets Edge Functions reuse the types without
// pulling in a mobile-only runtime.

import type {
  AgentRequest,
  AgentResponse,
  AgentHealthResponse,
} from './schemas';

export type AgentsInvoker = <T>(
  fnName: 'agents-health' | 'agents-triage' | 'agents-run',
  body?: AgentRequest,
) => Promise<{ data: T | null; error: { message: string } | null }>;

export type AgentsClient = {
  health(): Promise<AgentHealthResponse>;
  triage(payload: AgentRequest): Promise<AgentResponse>;
  run(payload: AgentRequest): Promise<AgentResponse>;
};

function safeError(detail: string): AgentResponse {
  return { ok: false, error: 'village_bridge_error', detail };
}

/**
 * Build a Village agents client bound to a specific invoker.
 * Typical usage in mobile:
 *   const client = createAgentsClient((name, body) =>
 *     supabase.functions.invoke(name, { body })
 *   );
 */
export function createAgentsClient(invoke: AgentsInvoker): AgentsClient {
  return {
    async health() {
      const { data, error } = await invoke<AgentHealthResponse>('agents-health');
      if (error) return { ok: false, error: 'village_bridge_error', detail: error.message };
      return data ?? { ok: false, error: 'village_bridge_error', detail: 'empty response' };
    },
    async triage(payload) {
      if (!payload?.raw_input || !payload?.source) {
        return safeError('raw_input and source are required');
      }
      const { data, error } = await invoke<AgentResponse>('agents-triage', payload);
      if (error) return safeError(error.message);
      return data ?? safeError('empty response');
    },
    async run(payload) {
      if (!payload?.raw_input || !payload?.source) {
        return safeError('raw_input and source are required');
      }
      const { data, error } = await invoke<AgentResponse>('agents-run', payload);
      if (error) return safeError(error.message);
      return data ?? safeError('empty response');
    },
  };
}
