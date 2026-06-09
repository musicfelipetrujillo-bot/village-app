-- 075_v2_milk_donor_social_links.sql
-- V2 Milk Connect — optional donor-provided social links ("added credibility").
--
-- Compliance posture (Risk & Compliance — read before any Milk change):
--   * Donor-CONTROLLED + donor-PROVIDED + explicitly NOT verified by The
--     Village. Mirrors the §1 platform-not-supplier stance and the badge
--     disclaimer rule ("The Village does not verify, test, or guarantee...").
--     The public profile shows a "links added by the donor, not verified"
--     disclaimer, and the editor warns the donor these are publicly visible.
--   * We store only the handles/URLs the donor types — NO OAuth, NO scraping,
--     NO identity claim, NO PII pulled from the networks. It is a self-attested
--     social-proof signal, opt-in, and the donor chooses what (if anything) to
--     share. Safety note on the editor: only add what you're comfortable
--     sharing with people you haven't met.
--
-- Shape: { instagram?, tiktok?, facebook?, website? } (handles or URLs as the
-- donor entered them; the client normalizes to links for display).
--
-- Rides existing milk_donor_profiles RLS (owner-update + public-read-active),
-- so no new policy is needed.

ALTER TABLE public.milk_donor_profiles
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
