-- 060_v1_specialist_invites.sql
--
-- V1 Specialists · invite + onboarding (Option C: invite-only, no self-signup).
--
-- Flow:
--   1. Admin issues an invite via the `specialist-invite-create` edge function.
--      That function inserts a row here, generates the token, and dispatches
--      the invite email via Resend (separate concern — see edge function).
--   2. The recipient clicks the link → village.app/onboard/:token. The static
--      onboarding page calls `get_specialist_invite_by_token(token)` to read
--      the pre-filled fields and verify the token is alive.
--   3. The recipient submits the form → `specialist-invite-accept` edge
--      function. That function (service-role): creates `auth.users`, inserts
--      a `specialists` row with `admin_approved=TRUE` + `accepting_patients=TRUE`
--      (the invite is the trust signal — per project memory), marks the invite
--      `used_at` + records `used_specialist_id`, and returns a session so the
--      specialist is auto-signed-in on the confirmation screen.
--
-- Security posture:
--   * Table RLS is enabled with NO policies → no anon/authenticated CRUD.
--     All reads happen via the SECURITY DEFINER token-lookup RPC; all writes
--     happen via service-role from the edge functions.
--   * The token-lookup RPC returns the SAFE pre-fill subset only (never
--     `token`, `invited_by`, `used_specialist_id`, etc.) and gates on
--     `used_at IS NULL AND revoked_at IS NULL AND expires_at > now()` so a
--     stolen-but-expired link can't be replayed.
--   * Token length CHECK ≥ 32 chars stops a misconfigured caller from ever
--     inserting a guessable short token. The edge function generates with
--     `crypto.randomUUID()` (≈36 chars) so this is comfortably above the
--     minimum.
--
-- Pairs with edge functions (not in this migration):
--   - `specialist-invite-create` (service-role, admin-only)
--   - `specialist-invite-accept`  (anon — verifies token + creates account)

CREATE TABLE specialist_invites (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient. Email is stored lowercased by the edge function; the
  -- CHECK only enforces a basic shape so a malformed value can't slip
  -- past the DB even if the function regresses.
  email                       TEXT        NOT NULL
                                          CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  -- Optional pre-fill — admin types what they already know about the
  -- specialist into the create-invite form so the onboarding page can show
  -- "Welcome, Dr. {full_name}" instead of an empty shell. All optional;
  -- specialist can override during onboarding.
  full_name                   TEXT        CHECK (full_name IS NULL OR char_length(full_name) BETWEEN 1 AND 120),
  credentials                 TEXT        CHECK (credentials IS NULL OR char_length(credentials) BETWEEN 1 AND 60),
  -- Specialty must match the same allowlist as `specialists.specialty`
  -- (defined in migration 001). Kept in sync manually — if the specialists
  -- enum grows, update this CHECK too.
  specialty                   TEXT        CHECK (specialty IS NULL OR specialty IN (
                                            'ob_gyn','midwife','doula','lactation_consultant','pediatrician',
                                            'sleep_coach','pelvic_floor_pt','perinatal_dietitian','ppd_therapist'
                                          )),
  npi_number                  TEXT        CHECK (npi_number IS NULL OR char_length(npi_number) BETWEEN 1 AND 20),

  -- Personal note from the admin, shown in the invite email body
  -- (e.g. "Looking forward to working with you, Dr. Reyes!"). Optional.
  personal_note               TEXT        CHECK (personal_note IS NULL OR char_length(personal_note) <= 500),

  -- The invite token. The edge function generates a URL-safe random
  -- string (≥36 chars from crypto.randomUUID()); we enforce min 32 here
  -- as a defense-in-depth. The UNIQUE constraint guarantees collision
  -- impossibility per row.
  token                       TEXT        NOT NULL UNIQUE
                                          CHECK (char_length(token) BETWEEN 32 AND 200),

  -- Audit + lifecycle.
  invited_by                  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at                  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at                     TIMESTAMPTZ,
  used_specialist_id          UUID        REFERENCES specialists(id) ON DELETE SET NULL,
  revoked_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lifecycle invariants:
  --   * used_at and used_specialist_id are coupled — either both set or both null.
  --   * A used invite cannot also be revoked (revocation is a pre-use action).
  --   * Expiry must be in the future at insert time (the default handles this;
  --     the CHECK catches admins passing custom values).
  CONSTRAINT specialist_invites_use_coupled
    CHECK ((used_at IS NULL) = (used_specialist_id IS NULL)),
  CONSTRAINT specialist_invites_no_use_and_revoke
    CHECK (revoked_at IS NULL OR used_at IS NULL),
  CONSTRAINT specialist_invites_expiry_after_creation
    CHECK (expires_at > created_at)
);

-- Lookup by email — supports the "has this email already been invited?"
-- check in the create-invite flow (prevents an admin double-inviting the
-- same address while a prior invite is still alive).
CREATE INDEX idx_specialist_invites_email
  ON specialist_invites (LOWER(email));

-- Partial index over still-alive invites — drives the future cleanup cron
-- (purge invites older than 30d that were never used) cheaply.
CREATE INDEX idx_specialist_invites_alive
  ON specialist_invites (expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;

-- RLS enabled with NO policies. All access goes through:
--   * `get_specialist_invite_by_token` (SECURITY DEFINER) — public read by token
--   * service-role inserts/updates from the edge functions
ALTER TABLE specialist_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RPC · get_specialist_invite_by_token
-- ============================================================================
--
-- Public token-gated read used by the onboarding web page. Returns the
-- pre-fill subset if the token is alive (unused, unrevoked, unexpired);
-- otherwise returns nothing. NEVER returns the token itself or any audit
-- fields — those are internal only.
--
-- The function is SECURITY DEFINER so it can read the RLS-locked table on
-- anon's behalf. We pin `search_path` per CLAUDE.md function-hardening rule
-- so a session-level path mutation can't redirect the table reference.
CREATE OR REPLACE FUNCTION get_specialist_invite_by_token(p_token TEXT)
RETURNS TABLE (
  email          TEXT,
  full_name      TEXT,
  credentials    TEXT,
  specialty      TEXT,
  npi_number     TEXT,
  personal_note  TEXT,
  expires_at     TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT
    i.email,
    i.full_name,
    i.credentials,
    i.specialty,
    i.npi_number,
    i.personal_note,
    i.expires_at
  FROM specialist_invites i
  WHERE i.token       = p_token
    AND i.used_at     IS NULL
    AND i.revoked_at  IS NULL
    AND i.expires_at  > now();
$$;

-- Revoke broad-default EXECUTE and re-grant per-role per CLAUDE.md security
-- hardening (function_search_path + explicit-role grants).
REVOKE EXECUTE ON FUNCTION get_specialist_invite_by_token(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_specialist_invite_by_token(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- RPC · revoke_specialist_invite (service-role only)
-- ============================================================================
--
-- Admin tool to invalidate an outstanding invite (e.g. wrong email, specialist
-- declined, hired elsewhere). Idempotent — calling on an already-used or
-- already-revoked invite is a no-op. Returns the affected row id, or NULL.
CREATE OR REPLACE FUNCTION revoke_specialist_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  UPDATE specialist_invites
     SET revoked_at = now()
   WHERE id          = p_invite_id
     AND used_at     IS NULL
     AND revoked_at  IS NULL
  RETURNING id;
$$;

REVOKE EXECUTE ON FUNCTION revoke_specialist_invite(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION revoke_specialist_invite(UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION revoke_specialist_invite(UUID) TO service_role;

-- ============================================================================
-- Documentation comments
-- ============================================================================
COMMENT ON TABLE  specialist_invites IS
  'Invite tokens issued by Village team to onboard specialists. Consumed by specialist-invite-accept edge function. RLS: no policies; read via get_specialist_invite_by_token RPC, write via service role.';
COMMENT ON COLUMN specialist_invites.token IS
  'URL-safe random token (≥32 chars). Generated client-side via crypto.randomUUID() in the create edge function. Stored as-is; the unique constraint guarantees collision-free.';
COMMENT ON COLUMN specialist_invites.used_specialist_id IS
  'Pointer back to the specialists row created during accept. Coupled with used_at via CHECK — either both set or both null.';
COMMENT ON FUNCTION get_specialist_invite_by_token(TEXT) IS
  'Public token-gated read of an alive invite. Returns pre-fill fields only; never the token or audit fields. Used by the static onboarding web page.';
COMMENT ON FUNCTION revoke_specialist_invite(UUID) IS
  'Service-role-only admin tool to invalidate an outstanding invite. Idempotent — no-op on already-used or already-revoked rows.';
