// Shared tool contract for the app-help-chat tool-use loop.
import type { SupabaseClient } from 'npm:@supabase/supabase-js';

export type ToolTier = 'read' | 'do' | 'route';
export type Loc = { lat: number; lng: number } | null;

export interface ToolContext {
  supabase: SupabaseClient;      // user-scoped (RLS) — reads/writes ONLY her rows
  loc: Loc;                      // best-effort device location
}

// A do/read tool returns any JSON (becomes the tool_result the model reads).
// A route tool returns a sentinel { __navigate } the loop lifts into the response.
export interface ToolDef {
  schema: { name: string; description: string; input_schema: Record<string, unknown> };
  tier: ToolTier;
  handler: (ctx: ToolContext, input: any) => Promise<unknown>;
}

export type NavigateSentinel = { __navigate: { screen: string; params?: Record<string, unknown> } };
export const isNavigate = (x: unknown): x is NavigateSentinel =>
  !!x && typeof x === 'object' && '__navigate' in (x as Record<string, unknown>);
