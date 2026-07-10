# Privacy — Data-Minimization & Retention Map (Villie)

**Date:** 2026-07-09
**Author:** Data Privacy Officer (read-only audit)
**Scope:** Every PII / sensitive column in `supabase/migrations/001–096`, cross-referenced against `apps/mobile/src/api/*.ts`, `docs/APP_PRIVACY_QUESTIONNAIRE.md`, `docs/MILK_SOCIAL_LINKS_PRIVACY_RISK.md`, and `CLAUDE.md` product posture.
**Status:** ADVISORY. Not a legal opinion. Schema-affecting recommendations must clear the attorney-gated retention review (CLAUDE.md A2.c) before any migration lands. This document changed no schema and no code.

---

## (a) Executive Summary

Villie is a **connector**, not a transaction processor. Milk sharing and Gear are cash-only; the app's job is to introduce two people, not to hold the machinery of a sale. That role sets the whole minimization lens: the cheapest PII to protect is the PII we never store. Migration 096 already applied exactly this reasoning — it dropped donor `address_line` + `phone` + the `get_transaction_pickup_address` RPC as vestigial Stripe/Shippo-era artifacts. **This audit finds the same pattern in several other places, plus three surfaces that hold more, or broader, PII than the connector role requires.**

Headline findings, in order of leverage:

1. **The milk donor profile is the single largest over-exposure.** `milk_donor_profiles` is public-read to *any* authenticated user when `is_active = TRUE`, and that public row carries **precise `lat`/`lng` (7-decimal, ~1cm resolution), `neighborhood`, plus self-attested `social_links` (IG/TikTok/FB/website)**. Donors are new mothers; precise coordinates + real-world social identity, broadcast to strangers arranging an in-person handoff, is exactly the de-anonymization risk the social-links risk memo flagged. Coarsening precise location to a ZIP centroid for the public read is the highest-value single change available.

2. **Dead Stripe/Shippo scaffolding still holds — or is shaped to hold — PII the cash-only posture forbids.** `milk_donor_profiles.stripe_account_id` / `stripe_onboarding_complete`, `milk_shipping_labels` (Shippo label + carrier records, addresses were the point of the table), `milk_disputes`, and the `milk_transactions` Stripe columns are all dormant under cash-only. These are the direct siblings of what 096 removed. They need the "retire Stripe Connect from Milk" pass 096's header explicitly deferred.

3. **`villie_box_orders` (migration 092) is a genuine, live PII surface** — full `ship_name`, `ship_line1/2`, `ship_city/state/zip`, `ship_phone`, plus `stripe_payment_intent_id`. This one is **KEEP** (Boxes is first-party retail Villie actually ships, so a mailing address is necessary and lawful), but it is the app's only stored physical-address surface and therefore the anchor case for a written retention schedule.

4. **No retention or deletion policy exists yet.** The A2.c soft-delete cascade is attorney-gated and unbuilt; today `account-delete` only sets `deleted_at`. Legal-acceptance rows (`ip_address` + `user_agent`), analytics-event JSONB, crisis flags, and check-in mood history accumulate with no defined lifespan. This is the biggest *systemic* gap and it gates the safe removal of everything else.

**Recommendation counts across all surfaces:**

| Recommendation | Count |
|---|---|
| **KEEP** | 41 |
| **COARSEN** | 8 |
| **DROP** | 12 |

(Counts are per sensitive field/column group assessed in section (c); "group" means e.g. the four Stripe columns on `milk_transactions` counted individually.)

---

## (b) Quick Wins — droppable / coarsenable cheaply, right now

Ordered by (privacy value ÷ effort). Each is defensible today; none needs new product decisions. Items marked ⚠️ touch the attorney-gated retention question and should be sequenced behind it.

| # | Change | Surface | Type | Why it's cheap | Precedent |
|---|---|---|---|---|---|
| **QW-1** | Coarsen the **public** read of `milk_donor_profiles.lat`/`lng` to a ZIP/neighborhood centroid; keep precise coords private to the owner + service role for distance ranking only. | Milk | COARSEN | Distance ranking already happens server-side in `search_donors_near`; the client only needs "≈ how far," never the exact point. A view or RPC that rounds coordinates for non-owners is a contained change. | Mirrors 096's "connector shouldn't hold/expose pinpoint PII." |
| **QW-2** | Drop `milk_donor_profiles.stripe_account_id` + `stripe_onboarding_complete`. | Milk | DROP | Cash-only since 2026-05-21; the Stripe listing gate is flag-off. 096 explicitly named these as the next-pass targets. Requires retiring the flag-off `StripeOnboardingScreen` reference in the same release (same shape as 096's app-side stub). | Direct continuation of 096. |
| **QW-3** | Drop the dormant Shippo/dispute PII tables: `milk_shipping_labels` (carrier, tracking, label PDFs — the table existed to move an *address* to a courier) and `milk_transactions.stripe_payment_intent`/`stripe_transfer_id`. | Milk | DROP | Zero rows under cash-only (no transactions ⇒ no labels ⇒ no disputes, per CLAUDE.md M5 note). Vestigial exactly like 096's targets. | Direct continuation of 096. |
| **QW-4** | Stop persisting **precise** `expo-location` anywhere it isn't already ephemeral, and confirm gear/event pickup writes round to ZIP centroid on the public surface. | Gear/Events | COARSEN | The privacy questionnaire already asserts precise location is "not persisted to backend" for search; `gear_listings.location` (GEOGRAPHY point) *is* persisted and public. Rounding the public point to the pickup ZIP centroid matches the stated posture and the questionnaire's own claim. | Consistency with APP_PRIVACY_QUESTIONNAIRE.md line 52. |
| **QW-5** | Coarsen `baby_profiles.date_of_birth` exposure to week/month for any non-owner read path, and confirm `birth_weight_grams` is never surfaced beyond the owner. | Baby/Child | COARSEN | The app computes `current_week_number` (STORED) from DOB; almost nothing needs the exact calendar date. Children's data warrants elevated care. | Data-minimization + children's-data elevated care. |
| **QW-6** ⚠️ | Define a TTL + purge for `home_feed_cache` (24h `expires_at` already present but no delete job) and `daily_checkins.ai_reply` beyond the window the product actually shows. | Baby/Health | DROP (aged rows) | `home_feed_cache` already has `expires_at`; it just needs a cron delete. Check-in mood history is health data with no defined retention. | Storage limitation principle. |
| **QW-7** ⚠️ | Confirm milk **donor social_links** are included in any deletion scrub, and add a point-of-entry "this is public" acknowledgement (already an open item in the risk memo). | Milk | COARSEN/KEEP | Opt-in and disclaimed already; the gap is deletion-cascade inclusion + entry acknowledgement, both cheap. | MILK_SOCIAL_LINKS_PRIVACY_RISK.md §3.5 / §4. |

**Top 3 (one line each):**
- **QW-1:** Stop broadcasting donor pinpoint GPS + neighborhood to every signed-in user — coarsen the public donor read to a ZIP-centroid, keep precise coords owner/service-only for distance math.
- **QW-2:** Delete the milk donor `stripe_account_id` / `stripe_onboarding_complete` columns — dead Stripe Connect under cash-only, exactly the pass migration 096 deferred.
- **QW-3:** Drop the dormant `milk_shipping_labels` + `milk_transactions` Stripe columns — zero rows under cash-only and pure Shippo/Stripe-era vestige.

---

## (c) Per-Surface Field-by-Field Map

Classification key: **KEEP** = needed for core connector/app function · **COARSEN** = reduce precision/granularity · **DROP** = vestigial or beyond connector role.

### Account / Identity — `users`

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Account | `email` | Auth identifier, transactional mail | KEEP | Core auth (Supabase). Minimum necessary. |
| Account | `phone` | Optional in-app contact | KEEP (nullable) | Optional; keep but never require. Confirm it's actually read somewhere — if only specialists/donors need phone, drop from the generic `users` row. |
| Account | `full_name` | Display / greetings / contact | KEEP | Necessary for the connector introduction. |
| Account | `avatar_url` | Profile image | KEEP | Optional, user-supplied. |
| Account | `pregnancy_stage`, `due_date` | Stage-matched content | KEEP | Core personalization; `due_date` optional. Health-adjacent — keep owner-scoped. |
| Account | `insurance_provider` | Specialist insurance filter | KEEP | Health-adjacent; used by `specialists_near`. Owner-scoped. Confirm it is never exposed on any public/shared surface. |
| Account | `zip_code` | Coarse location for search | KEEP | This is the *correct* granularity — coarse by design. It's the model precise coords should be coarsened toward. |
| Account | `deleted_at`, `deletion_requested_at` | Soft-delete audit | KEEP | Needed for the (attorney-gated) cascade. Ensure these timestamps are the trigger for the eventual PII scrub, not a permanent shadow record. |

### Milk — `milk_donor_profiles` and sub-tables

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Milk | `milk_donor_profiles.lat` / `lng` (DECIMAL 10,7) | Distance ranking | **COARSEN** (public) / KEEP (private) | **Top finding.** Public-read to any authenticated user (`is_active=TRUE`). 7 decimals ≈ 1cm. A connector needs "how far," not "which house." Round for non-owners; keep precise for the owner + service-role distance RPC. |
| Milk | `milk_donor_profiles.neighborhood` | Display locality | **COARSEN** | Public-read. Neighborhood + precise coords together sharply de-anonymize a new mother. City/ZIP is enough for a public profile. |
| Milk | `milk_donor_profiles.social_links` (JSONB) | Self-attested social proof | KEEP (opt-in) + guard | Public-read, opt-in, disclaimed. Keep, but (a) include in deletion scrub; (b) add point-of-entry "public" acknowledgement (risk memo open items). Do not verify/scrape. |
| Milk | `milk_donor_profiles.display_name`, `bio`, `city`, `state`, `zip_code` | Public donor profile | KEEP | Appropriate connector-level identity at coarse granularity. |
| Milk | `milk_donor_profiles.stripe_account_id` | Stripe Connect payout | **DROP** | Cash-only; flag-off. Named by 096 as the next-pass target. |
| Milk | `milk_donor_profiles.stripe_onboarding_complete` | Stripe Connect gate | **DROP** | Same as above. |
| Milk | `milk_donor_medications` (`medication_name`, `dosage`, `frequency`, `notes`) | Milk-safety disclosure | KEEP | **Health data (special category).** RLS is owner-only (`milk_medications_own`) with a redacted profile-screen view — good. Keep owner-only; never widen. Confirm the public profile screen shows only presence-of-disclosure, not the med list. |
| Milk | `milk_questionnaire_responses` (`answer_value` free text) | Trust badge | KEEP | Health/lifestyle disclosures; owner-write, owner-scoped. Keep tight. |
| Milk | `milk_donor_diet_flags` | Diet badge | KEEP | Public-read but low-sensitivity (diet labels). Acceptable. |
| Milk | `milk_trust_badges.bloodwork_report_url` | Bloodwork evidence link | KEEP + verify | Health data. `milk_trust_badges` is public-read (`USING(TRUE)`) — **confirm `bloodwork_report_url` is NOT in the public projection.** If it is, that's a health-data leak; COARSEN to a boolean `bloodwork_verified` on the public read. |
| Milk | `milk_shipping_labels` (carrier, tracking, `label_url` PDF) | Shippo shipping | **DROP** | Dormant under cash-only; existed to hand an address to a courier. Vestigial like 096. |
| Milk | `milk_transactions.stripe_payment_intent`, `stripe_transfer_id` | Stripe charge | **DROP** | Cash-only; no charges flow. |
| Milk | `milk_transactions` (donor/recipient ids, amounts) | Legacy order record | KEEP (retain) / scrub | CLAUDE.md flags `milk_transactions` as a legally-retained table — PII-scrub on delete rather than row-delete. Keep the row, drop the Stripe columns. |
| Milk | `milk_messages.body`, `milk_message_threads` | Donor↔mom DMs | KEEP | Core connector function. Participant-scoped RLS. |
| Milk | `milk_legal_acceptances.ip_address` (INET), `user_agent` | Consent audit | KEEP (retain) + TTL | Legitimate compliance evidence. But `ip_address` + `user_agent` are PII — set a retention TTL and include in the retention schedule (see §d). |
| Milk | `milk_disputes.opened_by_user_id`, description | Dispute record | **DROP** (dormant) | No transactions ⇒ no disputes under cash-only (CLAUDE.md M5). Vestigial; drop with the Stripe retirement pass. |

### Gear — `gear_listings` and sub-tables

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Gear | `gear_listings.location` (GEOGRAPHY point) | "Near me" search | **COARSEN** | Public-read (active/pending/sold). Persisting a precise point contradicts the questionnaire's "precise location not persisted" claim. Round the public point to the pickup-ZIP centroid. |
| Gear | `gear_listings.pickup_city`, `pickup_zip` | Pickup locality | KEEP | Correct coarse granularity. |
| Gear | `gear_listings.seller_id`, `title`, `description`, `brand`, `model`, `upc` | Listing | KEEP | Core marketplace data. Free text is user-authored and public by intent. |
| Gear | `gear_messages.body`, `gear_message_threads` | Buyer↔seller DMs | KEEP | Participant-scoped. Core. |
| Gear | `gear_listing_reports.description`, `resolution_notes` | Moderation | KEEP | Service-role/reporter-scoped; safety function. |
| Gear | `gear_legal_acceptances.ip_address` (INET), `user_agent` | Consent audit | KEEP (retain) + TTL | Same as milk — legitimate but PII; needs a retention TTL. |
| Gear | `gear_boosts.platform_transaction_id` | IAP anti-replay | KEEP | No Stripe; Apple/RevenueCat txn id for anti-replay only. Owner-scoped. Not payment PII. |
| Gear | `cpsc_recall_cache.*` | Recall lookup | KEEP | No PII — mirrors public CPSC data. |

### Baby / Child — `baby_profiles`, `daily_checkins`, `milestones`, tracker

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Baby | `baby_profiles.baby_name` | Personalization | KEEP | Children's data — owner-only RLS. Keep tight, never expose off-owner. |
| Baby | `baby_profiles.date_of_birth` (DATE) | Week/milestone math | **COARSEN** (non-owner paths) | `current_week_number` is STORED and derived; the exact calendar date rarely needs to leave the owner scope. Children's data → elevated care. |
| Baby | `baby_profiles.birth_weight_grams` | Preemie corrected-age | KEEP (owner-only) + verify | Health data about an infant. Confirm it never appears in any shared/feed projection. |
| Baby | `baby_profiles.gender`, `feeding_method`, `is_premature` | Personalization | KEEP (owner-only) | Sensitive infant attributes; owner-scoped only. |
| Health | `daily_checkins.mood_score`, `energy_score` | Postpartum tracking | KEEP (owner-only) | **Sensitive mental-health data.** Owner-only RLS. Core to the postpartum product. |
| Health | `daily_checkins.user_response` (free text ≤1000) | Check-in narrative | KEEP + TTL | Free-text health narrative — highest-sensitivity user content. Needs a retention limit (§d). |
| Health | `daily_checkins.ai_reply` (≤800), `crisis_resources` (JSONB) | AI response / routing | KEEP + TTL | Reflects the app's mental-health assessment. Owner-only. Age out with the check-in. |
| Baby | `baby_sleep_logs`, `baby_feed_logs`, `baby_diaper_logs`, `baby_log_notes.raw_text` | Tracker | KEEP (owner-only) + TTL | Infant care data + free-text notes. Owner-only RLS is correct. Consider a user-controllable purge/retention. |

### Specialists / Appointments

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Specialist | `specialists.npi_number`, `full_name`, `credentials`, `practice_name`, `address_line1`, `city`, `state`, `zip`, `phone`, `website_url` | Public provider directory | KEEP | Professional/business contact info, published by intent. Directory data, not consumer PII. |
| Specialist | `specialists.lat`/`lng` | Directory map | KEEP | Business address of a public practice — different from a donor's home. Acceptable at precision. |
| Specialist | `specialists.stripe_account_id` | Specialist booking payout | KEEP | **V1 Specialist booking is the one live Stripe flow** (CLAUDE.md milk-cash-only note). Not vestigial here. |
| Appointments | `appointments.stripe_payment_intent_id`, `amount_cents` | Booking payment | KEEP (retain) | Live for specialist booking; retained purchase record per questionnaire. |
| Appointments | `appointments.notes`, `service_type` | Booking detail | KEEP | Health-adjacent free text; owner/participant-scoped. |
| Specialist | `specialist_invites.email`, `full_name`, `npi_number` | Invite onboarding | KEEP + TTL | Service-role registry; token-gated anon read is scoped and non-enumerable (CLAUDE.md accepts this). Add a TTL to purge consumed/expired invites. |
| Messaging | `messages.body` (specialist DMs) | User↔specialist | KEEP | Core. Participant-scoped. |
| AI | `ai_conversations.messages` (JSONB), `context_snapshot` | AI Q&A transcripts | KEEP + TTL | May contain health free text. Owner-scoped. Needs retention limit. |

### Community / Rooms

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Community | `room_messages.body` | Peer chat | KEEP | Members-only via RPC gate + `ai_scan_status='clear'`. Core. May hold mental-health disclosures — keep the gate strict. |
| Community | `crisis_flags.*` (`severity`, `ai_assessment`, `trigger_phrases`, `moderator_notes`, `flagged_user_id`) | Safety pipeline | KEEP (hard-blocked) + TTL | **Postpartum mental-health, highest sensitivity.** RLS `USING(FALSE)` — excellent, direct reads impossible; moderator access via scoped RPC only. Keep, but define a retention/aging policy for resolved flags. |
| Community | `user_anonymous_identities.user_id ↔ anon_alias` | Pseudonymity | KEEP (hard-blocked) | The de-anonymization key. `USING(FALSE)` seals it. Do not add any reverse-lookup path. |
| Community | `room_presence`, `room_members` | Membership/presence | KEEP (owner-scoped) | Minimal, own-scoped. |
| Community | `room_moderators.calendly_event_type_uri` | Moderator scheduling | KEEP + verify | Confirm it stays out of the public `room_moderators_read_public` projection (agent indicates it does). |
| Community | `ai_companion_mentions.crisis_detected`, `suppressed` | Rate-limit/audit | KEEP (own-read) + TTL | Reflects mental-health assessment of the user; own-read only. Age out. |
| Community | `room_weekly_summaries.summary` | Digest | KEEP | Anonymized by prompt; members-only. Acceptable. |

### Perks / Events / Commerce

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Events | `event_rsvps.user_id`, `event_id`, `calendar_event_id` | RSVP | KEEP (owner-only) | Ties user to event/time; owner-scoped. `calendar_event_id` bridges to device calendar — keep owner-only, purge on RSVP cancel. |
| Perks | `deal_claims.subid` (`v_<user8>_<deal8>_<rand6>`) | Affiliate attribution | KEEP (owner-only) + note | Owner-scoped. The embedded user-id fragment is a deterministic identifier shared with affiliate networks *by design* when a claim is clicked. Acceptable for attribution, but disclose in the privacy notice (third-party sharing) and confirm no affiliate is a data broker. |
| Perks | `deal_claims.click_url`, `revealed_code`, `converted_amount_cents`, `network_order_id` | Attribution | KEEP (owner-only) + TTL | Purchase-behavior trail; owner-scoped. Age out old claims. |
| Commerce | `villie_box_orders.ship_name`, `ship_line1/2`, `ship_city/state/zip`, `ship_phone` | Physical shipping | **KEEP** | **Necessary** — first-party retail Villie actually ships. Lawful basis = contract. Owner-only RLS + service-role writes. This is the correct place for an address; it's the anchor for the retention schedule. |
| Commerce | `villie_box_orders.stripe_payment_intent_id`, `amount_cents`, `paid_at` | Merchant charge | KEEP (retain) | Legitimate first-party merchant record (no Connect, no money transmission). Retain per tax/accounting rules; define the period. |
| Commerce | `villie_box_order_items.removed_indices`, `addon_indices` | Order composition | KEEP (owner-only) | Preference data; owner-scoped. Minimal. |

### Analytics / Audit

| Surface | Field | Why held | Verdict | Rationale |
|---|---|---|---|---|
| Analytics | `gear_analytics_events.properties` (JSONB), `user_id` | Compliance/behavioral | KEEP (retain) + schema-guard | Service-role-only. Includes CPSIA §19 evidence (`gear_cpsc_block_shown`). Keep for compliance, but the free-text JSONB should be schema-validated so no unexpected PII lands there, and given a retention TTL. |
| Analytics | `milk_analytics_events.properties` (JSONB), `user_id` | Compliance/behavioral | KEEP (retain) + schema-guard | Same posture. |
| Audit | `admin_audit_log.metadata` (JSONB), `performed_by`, `target_id` | Admin chain-of-custody | KEEP (retain) | Service-role-only. Legitimate audit. Ensure `metadata` doesn't accumulate free-text PII beyond what the audit needs. |
| Diagnostics | Sentry crash/breadcrumb data (external) | Crash triage | KEEP | Not in DB. PII scrubbed via `beforeSend` (id-only user tagging). Confirm scrub covers health free text in breadcrumbs. |

---

## (d) Systemic / Retention Gaps

1. **No retention or deletion policy exists (highest-priority systemic gap).**
   - The A2.c soft-delete cascade is **attorney-gated and unbuilt**; `account-delete` today only sets `deleted_at`. Every table below accumulates indefinitely with no defined lifespan:
     - **Health/mental-health:** `daily_checkins` (mood + free text + AI reply), `crisis_flags`, `ai_companion_mentions`, `ai_conversations`, baby tracker logs + notes.
     - **Consent evidence with PII:** `milk_legal_acceptances` / `gear_legal_acceptances` (`ip_address` + `user_agent`).
     - **Behavioral:** `gear_analytics_events` / `milk_analytics_events` JSONB, `deal_claims`.
     - **Caches:** `home_feed_cache` (has `expires_at` but no purge job).
   - **Action:** counsel must sign off on a retention schedule (what is row-deleted vs PII-scrubbed vs retained-for-compliance). CLAUDE.md already lists the retained set (`milk_transactions`, `gear_listings` w/ recall status, analytics events, `admin_audit_log`). Everything else should have a documented TTL. **This blocks the safe DROP of the vestigial items in QW-2/QW-3** only insofar as the scrub logic must know about them — the drops themselves (dead columns, zero rows) are independently safe.

2. **Precise-location exposure beyond the connector role.**
   - `milk_donor_profiles.lat/lng` (public, pinpoint) and `gear_listings.location` (public GEOGRAPHY point) both persist and expose precision the app doesn't need. The privacy questionnaire *asserts* precise location "is not persisted to backend" — that's true for the ephemeral `expo-location` search path, but **not** for these two stored/public columns. This is an internal inconsistency between the stated posture and the schema. Coarsen the public projections (QW-1, QW-4).

3. **Children's-data handling — mostly good, verify the edges.**
   - `baby_profiles` and tracker tables are correctly owner-only. Remaining checks: confirm `birth_weight_grams`, `date_of_birth`, and `baby_name` never appear in any shared/feed/summary projection; coarsen DOB to week where a non-owner path exists (QW-5). COPPA is not directly triggered (data is *about* an infant, held by the parent-account holder, not collected *from* a child), but infant health data still warrants the elevated care already largely in place.

4. **Health-data public-read risk in the trust-badge surface.**
   - `milk_trust_badges` is public-read (`USING(TRUE)`) and the table contains `bloodwork_report_url`. **Verify the public projection excludes the bloodwork URL and any med detail** — if a bloodwork report link is publicly reachable, that is a special-category-data leak. Reduce the public read to booleans (`bloodwork_verified`, badge level) only.

5. **Over-collection vs. `APP_PRIVACY_QUESTIONNAIRE.md`.**
   - The questionnaire is broadly accurate and conservative (good). Two reconciliation items:
     - It says Payment Info is "not collected" and Milk/Gear are cash-only — yet dead Stripe columns still exist in the milk schema. Removing them (QW-2/QW-3) makes the schema match the label.
     - It should be updated to reflect **`villie_box_orders` physical address collection** (Boxes is the one place a mailing address is now stored) and the **`deal_claims` subid sharing with affiliate networks**. Both are "Yes" data flows not fully mirrored in the current questionnaire.

6. **Consent-evidence PII (`ip_address` + `user_agent`) has no TTL.**
   - Legitimate to keep as consent proof, but indefinite retention of IP + UA is over-retention. Set a defined period (e.g., life of the account + statutory limitation window) and include in the retention schedule.

7. **Analytics JSONB is unschematized.**
   - `*_analytics_events.properties` accepts arbitrary JSONB. Without a validated shape, future code could silently write free-text PII (message bodies, descriptions) into a service-role table with no minimization control. Add a documented allowed-keys shape and a TTL.

---

## (e) Recommended Next Migrations (sequenced)

> All below are **recommendations only** — nothing here has been applied. Schema drops that intersect the deletion cascade should land *after* the attorney retention sign-off; the pure-vestige drops (dead columns / zero-row tables) are independently safe and mirror migration 096.

- **097 — Retire Stripe Connect from Milk (continues 096).**
  Drop `milk_donor_profiles.stripe_account_id`, `stripe_onboarding_complete`; drop `milk_transactions.stripe_payment_intent`, `stripe_transfer_id`. App-side: stub the flag-off `StripeOnboardingScreen` reference (same pattern 096 used for `getTransactionAddress`). *(QW-2)*

- **098 — Drop dormant Shippo/dispute PII.**
  Drop `milk_shipping_labels` and `milk_disputes` (zero rows under cash-only; vestigial). Verify no live API reader first (`apps/mobile/src/api/milk.ts`). *(QW-3)*

- **099 — Coarsen public donor location.**
  Introduce a public donor read path (view or RPC) that returns ZIP/neighborhood-centroid coordinates rounded to ~2–3 decimals; restrict raw `lat`/`lng` to owner + service-role. Redact `neighborhood` on the public projection to city/ZIP. *(QW-1)*

- **100 — Coarsen public gear location + verify trust-badge projection.**
  Round `gear_listings.location` on the public read to the pickup-ZIP centroid. In the same pass, verify/lock the `milk_trust_badges` public projection to booleans only (no `bloodwork_report_url`, no med detail). *(QW-4, gap #4)*

- **101 — Retention TTL + purge jobs (AFTER attorney sign-off).**
  Add pg_cron purge for `home_feed_cache` (past `expires_at`); define + enforce TTLs for `daily_checkins`, `ai_conversations`, `ai_companion_mentions`, resolved `crisis_flags`, `*_analytics_events`, `*_legal_acceptances` IP/UA, expired `specialist_invites`, and aged `deal_claims`. Wire these TTLs into the A2.c cascade so account deletion and time-based purge share one policy. *(QW-6, gaps #1, #6, #7)*

- **102 — Children's-data edge hardening.**
  Coarsen `baby_profiles.date_of_birth` to week on any non-owner path; assert (via projection/tests) that `baby_name`, `birth_weight_grams`, and DOB never leave owner scope. *(QW-5, gap #3)*

- **Docs (no migration) — reconcile the questionnaire.**
  Update `APP_PRIVACY_QUESTIONNAIRE.md` to reflect `villie_box_orders` physical-address collection and `deal_claims` subid sharing with affiliate networks; and update it to drop the milk Stripe references once 097 lands. Add donor `social_links` point-of-entry public acknowledgement + deletion-scrub inclusion (risk-memo open items). *(gaps #5, QW-7)*
