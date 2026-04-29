-- A2.b — Notification preferences
-- Stores per-user opt-in/out for each notification surface.
-- Keys mirror docs/source/Village_Onboarding_UX.md §Settings.
--
-- Defaults: transactional surfaces default to TRUE (opt-out),
-- "promotions" defaults to FALSE (opt-in per CAN-SPAM / FTC marketing rules).
--
-- Call sites must check the matching key before enqueuing a push/SMS.
-- Transactional/safety surfaces (crisis moderator SMS, specialist admin
-- approval) are NEVER gated on this column — they are compliance-critical.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notif_prefs JSONB NOT NULL
  DEFAULT '{
    "events": true,
    "groups": true,
    "specialists": true,
    "milk_hub": true,
    "articles": true,
    "ai": true,
    "promotions": false
  }'::jsonb;

COMMENT ON COLUMN public.users.notif_prefs IS
  'Per-surface notification opt-in. Keys: events, groups, specialists, milk_hub, articles, ai, promotions. Transactional/safety sends (crisis SMS, admin approval) bypass this column.';
