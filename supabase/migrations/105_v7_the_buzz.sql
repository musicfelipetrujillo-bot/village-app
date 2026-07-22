-- 105_v7_the_buzz.sql — The Buzz: weekly trending maternal-health digest.
-- Spec: docs/THE_BUZZ_TRENDING.md. Editorial (not clinical) surface — every
-- item pairs a trend signal with a grounding source, both restricted to an
-- allowlisted domain set enforced at insert. Review gate is keyed on
-- is_medical_claim (not item kind): non-medical items auto-clear via an
-- automated compliance pass, medical-claim items always require a human
-- clinical reviewer sign-off (reuses is_clinical_reviewer() from migration 043).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. trending_source_allowlist — reference table, service-role only.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_source_allowlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      TEXT NOT NULL,
  tier        TEXT NOT NULL CHECK (tier IN ('trend', 'evidence')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain, tier)
);

ALTER TABLE trending_source_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_source_allowlist_service_all" ON trending_source_allowlist
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO trending_source_allowlist (domain, tier) VALUES
  ('apnews.com', 'trend'),
  ('reuters.com', 'trend'),
  ('nytimes.com', 'trend'),
  ('washingtonpost.com', 'trend'),
  ('motherly.com', 'trend'),
  ('parents.com', 'trend'),
  ('romper.com', 'trend'),
  ('acog.org', 'evidence'),
  ('aap.org', 'evidence'),
  ('cdc.gov', 'evidence'),
  ('who.int', 'evidence'),
  ('nih.gov', 'evidence'),
  ('pubmed.ncbi.nlm.nih.gov', 'evidence'),
  ('llli.org', 'evidence')
ON CONFLICT (domain, tier) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. trending_issues — one row per weekly issue.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_issues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_date    DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at  TIMESTAMPTZ,
  title         TEXT NOT NULL,
  intro         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issue_date)
);

ALTER TABLE trending_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_issues_public_read" ON trending_issues
  FOR SELECT TO authenticated
  USING (status = 'published');

CREATE POLICY "trending_issues_reviewer_read" ON trending_issues
  FOR SELECT TO authenticated
  USING (is_clinical_reviewer());

CREATE POLICY "trending_issues_service_write" ON trending_issues
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. trending_items — belongs to an issue.
--    status enum includes 'in_review' (missing from the original spec's §3
--    list but required by its own §4 pipeline description — see plan header).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id               UUID NOT NULL REFERENCES trending_issues(id) ON DELETE CASCADE,
  kind                   TEXT NOT NULL CHECK (kind IN ('news', 'myth_buster')),
  rank                   INTEGER NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'agent_cleared', 'in_review', 'approved', 'rejected')),
  is_medical_claim       BOOLEAN NOT NULL DEFAULT TRUE,

  trend_source_name      TEXT NOT NULL,
  trend_source_url       TEXT NOT NULL,
  evidence_source_name   TEXT NOT NULL,
  evidence_source_url    TEXT NOT NULL,

  title_en               TEXT NOT NULL,
  title_es               TEXT,
  summary_en             TEXT NOT NULL,
  summary_es             TEXT,
  myth_claim_en          TEXT,
  myth_claim_es          TEXT,
  fact_en                TEXT,
  fact_es                TEXT,
  ask_provider_en        TEXT NOT NULL,
  ask_provider_es        TEXT,

  reviewed_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  review_notes           TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trending_items_myth_fields CHECK (
    kind <> 'myth_buster' OR (myth_claim_en IS NOT NULL AND fact_en IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_trending_items_issue ON trending_items(issue_id, rank);
CREATE INDEX IF NOT EXISTS idx_trending_items_review_queue
  ON trending_items(status, is_medical_claim)
  WHERE status = 'in_review' AND is_medical_claim = TRUE;

ALTER TABLE trending_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_items_public_read" ON trending_items
  FOR SELECT TO authenticated
  USING (
    status IN ('approved', 'agent_cleared')
    AND EXISTS (
      SELECT 1 FROM trending_issues ti
      WHERE ti.id = trending_items.issue_id
        AND ti.status = 'published'
    )
  );

CREATE POLICY "trending_items_reviewer_read" ON trending_items
  FOR SELECT TO authenticated
  USING (is_clinical_reviewer());

CREATE POLICY "trending_items_service_write" ON trending_items
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Source-allowlist enforcement — BEFORE INSERT/UPDATE trigger. This is
--    the real enforcement point regardless of what any research agent's
--    prompt believes it verified (docs/THE_BUZZ_TRENDING.md §3/§6).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION extract_url_domain(p_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT lower(
    regexp_replace(
      split_part(regexp_replace(p_url, '^https?://', ''), '/', 1),
      '^www\.', ''
    )
  );
$$;

CREATE OR REPLACE FUNCTION check_trending_source_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_trend_domain    TEXT := extract_url_domain(NEW.trend_source_url);
  v_evidence_domain TEXT := extract_url_domain(NEW.evidence_source_url);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM trending_source_allowlist
    WHERE tier = 'trend' AND domain = v_trend_domain
  ) THEN
    RAISE EXCEPTION 'trend_source_url domain % is not on the trend allowlist', v_trend_domain
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trending_source_allowlist
    WHERE tier = 'evidence' AND domain = v_evidence_domain
  ) THEN
    RAISE EXCEPTION 'evidence_source_url domain % is not on the evidence allowlist', v_evidence_domain
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trending_items_allowlist_check
  BEFORE INSERT OR UPDATE OF trend_source_url, evidence_source_url ON trending_items
  FOR EACH ROW EXECUTE FUNCTION check_trending_source_allowlist();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Auto-publish — when every item on an issue reaches a terminal-cleared
--    status, flip the issue to published. The founder's last approve tap
--    in the review screen IS the publish action; there is no separate
--    manual publish step or screen. Fires a fire-and-forget pg_net POST to
--    trending-publish-notify (deployed in a later task) — safe no-op
--    locally where pg_net/the app.* GUCs aren't configured. Also writes an
--    admin_audit_log row (schema: id, action, target_table, target_id,
--    performed_by, metadata, created_at — from migration 016).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trending_items_after_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_all_done BOOLEAN;
  v_issue    trending_issues%ROWTYPE;
BEGIN
  IF NEW.status NOT IN ('approved', 'agent_cleared') THEN
    RETURN NEW;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM trending_items
    WHERE issue_id = NEW.issue_id
      AND status NOT IN ('approved', 'agent_cleared')
  ) INTO v_all_done;

  IF v_all_done THEN
    UPDATE trending_issues
       SET status = 'published', published_at = now(), updated_at = now()
     WHERE id = NEW.issue_id
       AND status <> 'published'
     RETURNING * INTO v_issue;

    IF FOUND THEN
      INSERT INTO admin_audit_log (action, target_table, target_id, performed_by, metadata)
      VALUES (
        'publish_trending_issue', 'trending_issues', v_issue.id, 'system',
        jsonb_build_object('issue_date', v_issue.issue_date, 'title', v_issue.title)
      );

      BEGIN
        PERFORM net.http_post(
          url     := current_setting('app.supabase_url') || '/functions/v1/trending-publish-notify',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body    := jsonb_build_object('issue_id', v_issue.id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- pg_net/GUCs unavailable — publish itself still succeeded.
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trending_items_after_review_trg
  AFTER UPDATE OF status ON trending_items
  FOR EACH ROW EXECUTE FUNCTION trending_items_after_review();
