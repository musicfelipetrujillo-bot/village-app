-- 135_ai_rate_limits.sql
-- Per-user quota ledger for the model-backed edge functions.
--
-- WHY (security audit 2026-09-04, batch 5 scope boundary):
--   Batch 5 gated ~12 LLM/vision endpoints behind a real signed-in user. That
--   closed ANONYMOUS abuse — they are no longer reachable with the publishable
--   anon key that ships in the mobile bundle — but it left every one of them an
--   UNMETERED per-account endpoint. One signed-up account looping
--   `gear-vision-identify` in a shell script still bills Villie for unbounded
--   Haiku multimodal calls. A gate answers "who is this"; it does not answer
--   "how much may they have".
--
--   `room-ai-companion` already does this correctly for one surface (≤3 @village
--   replies per user per room per hour, counted off `ai_companion_mentions`).
--   This generalises that idea so every model endpoint can share one mechanism
--   instead of each grow its own — the same consolidation lesson as
--   `_shared/service-role.ts`.
--
-- DESIGN — fixed window, not sliding.
--   A sliding window needs every call timestamp retained and an aggregate per
--   check. A fixed window needs ONE row per (user, function, bucket) and a single
--   atomic upsert. The tradeoff is the standard burst-at-the-boundary: a user can
--   spend a full window at 10:59:59 and another at 11:00:00. For a COST control
--   (not a safety control) that is a fine trade for the simpler, cheaper,
--   race-free check.
--
-- ATOMICITY is the whole point. A read-then-write (SELECT count, decide, UPDATE)
--   is a TOCTOU race: N concurrent requests all read the same count and all pass.
--   The upsert below decides and increments in ONE statement — Postgres takes a
--   row lock on conflict, so concurrent callers serialise and the (N+1)th gets
--   zero rows back and is denied. That is why the limit lives in SQL and not in
--   the edge function.

begin;

create table if not exists public.ai_rate_limits (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  fn           text        not null,
  window_start timestamptz not null,
  call_count   int         not null default 0,
  primary key (user_id, fn, window_start)
);

comment on table public.ai_rate_limits is
  'Per-user fixed-window call counters for model-backed edge functions. Written only by consume_ai_quota() under service_role; never read by clients.';

-- Supports a future retention purge (the RPC self-cleans per caller, but a global
-- sweep wants this). Not needed for the hot path, which is PK-exact.
create index if not exists idx_ai_rate_limits_window
  on public.ai_rate_limits (window_start);

-- RLS on with NO policies: the deliberate deny-all shape already used by
-- `events_partner_feeds`, `specialist_invites`, `pro_launch_targets` and
-- `push_sends` (documented in CLAUDE.md's accepted-advisor register). Every
-- direct PostgREST read or write fails closed; only the SECURITY DEFINER function
-- below, invoked by service_role, touches this table. A client that could write
-- here could reset its own quota.
alter table public.ai_rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- consume_ai_quota — atomically record one call and say whether it was allowed.
--
-- Returns exactly one row:
--   allowed              — false when the caller is already at the limit
--   remaining            — calls left in this window after this one (0 when denied)
--   retry_after_seconds  — seconds until the current window rolls over
--
-- p_user_id is supplied by the caller, NOT taken from auth.uid(), because the
-- invoker is service_role inside an edge function. That is safe only because the
-- id has already been established from a VERIFIED JWT via
-- `_shared/user-auth.ts::getCallerUserId` — which validates the token against
-- Supabase Auth rather than decoding what it claims about itself. EXECUTE is
-- granted to service_role only, so no client can call this to inflate, reset, or
-- probe another user's quota.
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_quota(
  p_user_id        uuid,
  p_fn             text,
  p_limit          int,
  p_window_seconds int
)
returns table (allowed boolean, remaining int, retry_after_seconds int)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_window_start timestamptz;
  v_count        int;
begin
  if p_user_id is null or p_fn is null or coalesce(p_limit, 0) < 1
     or coalesce(p_window_seconds, 0) < 1 then
    raise exception 'consume_ai_quota: bad arguments';
  end if;

  -- Floor now() onto the window grid so every caller in the same period shares
  -- one row and the key stays deterministic.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Decide + increment in one statement. On conflict the WHERE is evaluated
  -- against the LOCKED existing row; when it fails, no row is returned and
  -- v_count stays NULL — that is the denial signal.
  insert into public.ai_rate_limits as arl (user_id, fn, window_start, call_count)
  values (p_user_id, p_fn, v_window_start, 1)
  on conflict (user_id, fn, window_start) do update
    set call_count = arl.call_count + 1
    where arl.call_count < p_limit
  returning arl.call_count into v_count;

  -- Bounded self-cleanup: drop this caller's stale buckets for this function.
  -- PK-prefixed, so it touches only rows we already have locality on. Keeps the
  -- table from growing without a separate cron.
  delete from public.ai_rate_limits
   where user_id = p_user_id
     and fn = p_fn
     and window_start < v_window_start - make_interval(secs => p_window_seconds);

  if v_count is null then
    return query
      select false,
             0,
             greatest(
               1,
               ceil(extract(epoch from
                 (v_window_start + make_interval(secs => p_window_seconds)) - now()
               ))::int
             );
  else
    return query
      select true,
             greatest(0, p_limit - v_count),
             greatest(
               1,
               ceil(extract(epoch from
                 (v_window_start + make_interval(secs => p_window_seconds)) - now()
               ))::int
             );
  end if;
end;
$$;

-- Service-role only. `authenticated` must never reach this: the whole control
-- depends on the count being incremented by trusted server code exactly once per
-- real call.
revoke execute on function public.consume_ai_quota(uuid, text, int, int) from public, anon, authenticated;
grant  execute on function public.consume_ai_quota(uuid, text, int, int) to service_role;

commit;

-- ── Verification (run after apply) ──
-- Third call must be refused when the limit is 2:
--   select * from consume_ai_quota('<uuid>','test',2,3600);  -- t, 1
--   select * from consume_ai_quota('<uuid>','test',2,3600);  -- t, 0
--   select * from consume_ai_quota('<uuid>','test',2,3600);  -- f, 0, retry_after
--
-- Deny-all shape holds (both should error / return nothing for a client role):
--   set role authenticated;
--   select * from public.ai_rate_limits;
--   select * from consume_ai_quota('<uuid>','test',2,3600);
--   reset role;
