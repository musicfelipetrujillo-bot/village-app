// Resolve the project's API keys from the variables Supabase actually injects.
//
// WHY THIS EXISTS (API key migration, 2026-09-08 — docs/API_KEY_MIGRATION.md §E2):
// Supabase documents two shapes. The legacy variables hold a plain string and,
// per the docs, "still exist in the runtime, but they carry the legacy keys".
// The new variables hold a JSON dictionary keyed by key name:
//
//   SUPABASE_SECRET_KEYS       {"default":"sb_secret_…"}      ← authoritative
//   SUPABASE_PUBLISHABLE_KEYS  {"default":"sb_publishable_…"} ← authoritative
//   SUPABASE_SECRET_KEY        "sb_secret_…"                  ← local CLI only
//   SUPABASE_PUBLISHABLE_KEY   "sb_publishable_…"             ← local CLI only
//   SUPABASE_SERVICE_ROLE_KEY  "…"                            ← legacy name
//   SUPABASE_ANON_KEY          "…"                            ← legacy name
//
// Measured in THIS project's deployed runtime on 2026-09-08, the legacy names do
// NOT behave as documented: SUPABASE_SERVICE_ROLE_KEY returned a 41-char `sb_`
// value and SUPABASE_ANON_KEY a 46-char one — the NEW keys, not the legacy ones.
// Supabase has aliased the old names to the new keys.
//
// That aliasing is undocumented and contradicts the docs, so it is not something
// to depend on. The legacy keys are now DISABLED on this project, which makes the
// dependency load-bearing in the worst way: if Supabase ever "fixes" the aliasing
// to match its own documentation, every function reading the legacy name would
// get a disabled key and fail closed simultaneously.
//
// Reading the documented variable first, and treating the legacy name as a last
// resort, is correct under BOTH behaviours — today's aliasing and a future
// correction of it.

/** Pull one key out of a `{"name":"key"}` JSON dictionary variable. */
function fromDict(varName: string, keyName = 'default'): string | null {
  const raw = Deno.env.get(varName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const dict = parsed as Record<string, unknown>;
    // Prefer the conventional "default" entry; fall back to the sole entry so a
    // project that named its key differently still resolves.
    const picked = dict[keyName] ?? Object.values(dict)[0];
    return typeof picked === 'string' && picked.trim() ? picked.trim() : null;
  } catch {
    return null; // not JSON — treat as absent rather than throwing at import time
  }
}

function firstNonEmpty(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  return '';
}

/**
 * The privileged key: bypasses RLS. Never expose it to a client.
 * Empty string when nothing is configured — callers already fail closed on that.
 */
export function secretKey(): string {
  return firstNonEmpty(
    fromDict('SUPABASE_SECRET_KEYS'),      // hosted, documented
    Deno.env.get('SUPABASE_SECRET_KEY'),   // local CLI
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), // legacy name, last resort
  );
}

/** The public client key. Safe to ship in a bundle; RLS still applies to it. */
export function publishableKey(): string {
  return firstNonEmpty(
    fromDict('SUPABASE_PUBLISHABLE_KEYS'),     // hosted, documented
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),  // local CLI
    Deno.env.get('SUPABASE_ANON_KEY'),         // legacy name, last resort
  );
}
