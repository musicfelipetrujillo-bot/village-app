// Mobile-side wrapper around @village/agents-client.
//
// This file binds the shared client to our supabase-js instance so callers
// can just `import { agentsApi } from '@api/agents'`. Mobile NEVER calls
// the starter runtime directly — only Village Edge Functions.
//
// Internal-only surface. Not used from any public user screen.

import { supabase } from '@/lib/supabase';
import { createAgentsClient, type AgentsInvoker } from '@village/agents-client';

const invoker: AgentsInvoker = async (fnName, body) => {
  const { data, error } = await supabase.functions.invoke(fnName, {
    body: body ?? {},
  });
  // Normalise supabase-js error shape → { message } contract expected by client.
  if (error) return { data: null, error: { message: error.message } };
  return { data: (data as unknown) as any, error: null };
};

export const agentsApi = createAgentsClient(invoker);

export type {
  AgentRequest,
  AgentResponse,
  AgentMode,
  IntegrationEnvelope,
} from '@village/agents-client';
