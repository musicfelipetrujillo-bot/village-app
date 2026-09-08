// Shared edge-function caller for the mobile client.
//
// WHY THIS EXISTS (security audit 2026-09-04, open item 3):
// `supabase.functions.invoke` does not expose the HTTP status cleanly — a 429
// arrives as a generic `FunctionsHttpError` whose `message` is "Edge Function
// returned a non-2xx status code". So every caller that went through `invoke`
// showed a mother a meaningless error when she hit her per-user quota
// (`_shared/rate-limit.ts`, migration 135), while `api/ai.ts` — which used raw
// `fetch` — translated it properly. This is that fetch path, extracted so
// there is one implementation instead of one-per-file.
//
// Use this for any edge function that appears in `HOURLY_LIMITS`. Plain
// Supabase-direct CRUD and non-quota'd functions can keep using `invoke`.

import { supabase } from '@/lib/supabase';
import { t, type Lang } from '@/i18n';
import { useUserStore } from '@store/user';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export async function callEdgeFunction<T>(name: string, body: object): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  // Parse defensively. The gateway can answer with an empty body or an HTML
  // error page (502, cold-start timeout), and a bare `res.json()` would then
  // throw a SyntaxError that the caller reports as if the function itself had
  // failed in some semantically meaningful way — the same class of confusion as
  // the JSON.parse that once impersonated a crisis reply in app-help-chat.
  const raw = await res.text();
  let json: any = {};
  if (raw) {
    try { json = JSON.parse(raw); } catch { json = {}; }
  }
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
    throw new Error(json.error ?? `${name} failed (${res.status})`);
  }
  return json as T;
}
