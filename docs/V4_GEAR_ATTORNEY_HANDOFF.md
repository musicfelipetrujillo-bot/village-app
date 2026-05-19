# V4 Gear Marketplace — Attorney Handoff (G5–G8)

**Audience:** outside counsel (Florida marketplace / FinCEN / consumer-product safety)
**Status:** code complete across G5–G8; pre-launch legal review is the remaining gate
**Owner:** Engineering (Felipe T.) — escalate ambiguities back via the issue tracker, not Slack
**Last updated:** 2026-05-18
**Companion references (do not require reading; cited for chain-of-custody):**
- `village-app/CLAUDE.md` — engineering build log; see "V4 Gear + Home — Build Progress" table rows G5–G8 and "V4 Open gates"
- `village-app/docs/source/Village_Risk_and_Compliance.md` — internal risk memo (§2.1 CPSC, §2.2 Prohibited Items, §2.4 Section 230, §2.5 Safe Transaction, §2.7 Required Mitigations, §3.1 Terms architecture, §3.2 Informed Consent)
- `village-app/supabase/migrations/012_*.sql` (G4 allowlist), `023_*.sql` (G5 CPSC), `024_*.sql` (G6 messaging + legal acceptance), `025_*.sql` (G7 AI), and analytics events table created in 024
- `village-app/apps/mobile/src/screens/gear/CreateListingScreen.tsx` — listing-creation flow with the pre-insert CPSC gate

---

## 1. Executive summary

The Village is a Florida-based maternal-health mobile app. **V4 Gear** is its peer-to-peer secondhand baby-gear marketplace. The product surface has been built end-to-end and runs on staging. Every legally salient subsystem identified in the internal Risk & Compliance memo (CPSC recall sync, prohibited-items allowlist, informed-consent acceptance flow, in-app reporting pipeline, safe-meeting interstitial, off-platform-payment disclosures) is implemented in code with an audit trail.

**What blocks public rollout** is *not* code. It is the set of attorney sign-offs enumerated in §8 below — chiefly: (a) attorney-drafted Gear Marketplace Terms Addendum, (b) FDUTPA review of every in-app safety/verification claim, (c) confirmation that the GL + E&O insurance policy actually covers marketplace facilitation, (d) a named human assignee for the 24-hour takedown SLA already promised to users in the in-app report flow, and (e) the FinCEN / Florida money-transmitter question for the post-MVP payment path (we ship cash-only at MVP precisely to avoid this fork; the question remains open for v2).

This document is the paper trail for that review.

---

## 2. The cash-only architecture decision

### What we did
The V4 Gear MVP **does not process payments**. Buyers and sellers arrange and execute the cash or P2P transfer themselves, off-platform, at the in-person meet. The Village's role ends at the in-app chat and the safe-meeting interstitial.

### What we explicitly did NOT build
This is the bright line we want counsel to confirm we are on the correct side of:

- **No Stripe Connect onboarding for gear sellers.** Stripe Connect *is* live for the unrelated V2 Milk Connect product, but it is not extended to Gear.
- **No `gear-purchase-intent` Edge Function.** (Compare to `milk-purchase-intent`, which exists.)
- **No `GearCheckoutScreen`, no PaymentSheet, no card field.** The mobile app has no surface to enter card data in the Gear flow.
- **No escrow, no 48-hour buyer-protection hold, no chargeback handling, no dispute-driven refund path.**
- **No marketplace fee, no platform commission, no SubID-style attribution for the transaction itself.**

### The rationale on record
Internal Risk & Compliance §2.7 lists "Non-Negotiable #5 — NO PAYMENT PROCESSING" verbatim:

> "Do not process payments for gear at MVP — facilitate cash/P2P only to avoid FinCEN money transmitter licensing obligations. Use Stripe only if we become a proper marketplace escrow in v2."

§2.5 reiterates: "Cash is safest for in-person transactions; Venmo/Zelle to known individuals only."

The build decision was logged on 2026-04-23 and is recorded as a binding project memory ("V4 Gear MVP is cash-only — no in-app payments, no Stripe Connect; off-platform cash/P2P only"). The G8 row of the engineering build table is explicit: "**Decision 2026-04-23: cash-only MVP** ... NO Stripe Connect, NO gear-purchase-intent, NO GearCheckoutScreen, NO 48h hold — all Stripe/buyer-protection paths explicitly deferred to post-MVP."

### What counsel should confirm
- That the current architecture, as described above, falls outside the FinCEN definition of a money transmitter under 31 CFR §1010.100(ff)(5).
- That Florida's chapter-560 money-services-business regime is likewise inapplicable.
- That the in-app copy disclaiming payment processing (see §5 below) is sufficient to defeat a reasonable user expectation that we offer buyer protection.

A separate question — what would change about the analysis if we later add in-app payments — is the architectural fork in §9.

---

## 3. CPSC §19 compliance posture

CPSIA §19 makes it unlawful to "sell, offer for sale, manufacture for sale, distribute in commerce, or import into the United States" any product subject to a CPSC recall. Risk & Compliance §2.1 identifies this as "The #1 Risk" for the gear marketplace and cites the CPSC's 2022 enforcement action against an Amazon reseller of recalled infant product.

The Village's mitigation has four layers:

### 3.1 Pre-insert gate (hard block at listing time)
File: `apps/mobile/src/screens/gear/CreateListingScreen.tsx`. Before a new listing is inserted into the database — and **before** photos are uploaded — the client calls the `gear-cpsc-check` Edge Function with `{ category, title, brand, upc }`. If the response returns `status='recalled'`, the submission is aborted, no row is inserted, and a full-screen `CPSCRecallBlockModal` renders.

The modal:
- Displays the recall hazard and remedy text from `cpsc_recall_cache`.
- Includes an expandable "Why is this blocked?" explainer that references CPSIA §19 by name.
- Provides "Open CPSC notice →" linking to the recall URL on saferproducts.gov (or `cpsc.gov/Recalls` as fallback).
- Has **no "list anyway" escape hatch.** The only affordance is "Got it" (close).

A `gear_cpsc_block_shown` analytics event is written each time the modal renders. This is the chain-of-custody record for any future §19 enforcement defense.

Source: migration `023_v4_g5_cpsc_vision.sql`.

### 3.2 Post-insert verification (best-effort persistence)
After a successful insert (i.e. the pre-insert check returned `clear` or `unknown`), the client fires a non-blocking `cpscCheck(listing_id)` so the `mark_listing_cpsc` RPC writes the verdict (`clear` / `recalled` / `unknown`) and the matched `cpsc_recall_id`/`cpsc_recall_url` onto the row. This makes the verdict a queryable column on every listing rather than just a transient client-side check.

### 3.3 Nightly recall sweep
A `pg_cron` job named `gear-cpsc-recall-sync` runs daily at 02:00 ET (06:00 UTC). It:
1. Pulls fresh recalls from SaferProducts.gov for the prior 365 days.
2. Upserts them in 500-row chunks into `cpsc_recall_cache` (table keyed on `recall_number`, with lowercased brand/product name and a GIN-indexed `upcs[]` array for fast lookup).
3. Invokes the SECURITY DEFINER RPC `sweep_active_listings_for_recalls`, which matches active listings by UPC or by `brand + title LIKE`, sets `status='recalled'` + `removed_reason='cpsc_recall'`, transitions the listing out of `active`, and inserts a row of `type='gear_recall'` into `user_notifications_feed` so the seller is notified.

This is the "actively monitored" half of the §2.1 requirement that "every listing should be cross-checked at submission time **and periodically re-checked**."

Source: migration `023_v4_g5_cpsc_vision.sql`; Edge Function `gear-cpsc-recall-sync`.

### 3.4 Audit-trail telemetry
Two analytics event names exist exclusively for §19 defense:
- `gear_cpsc_check_result` — fired on every CPSC check call. Properties: `status`, `has_upc`, `recall_number` (when matched).
- `gear_cpsc_block_shown` — fired only when the hard-block modal renders. This is the record that the user *attempted* to list a recalled item and was prevented from doing so.

Both write to `gear_analytics_events` via the `logGearEvent` API. See §10 for the full event catalogue.

### 3.5 Fail-open posture and counsel question
The `gear-cpsc-check` function is designed to fail open: if the SaferProducts.gov live query times out or errors, the result is `status='unknown'`, the listing is allowed to post, and the nightly sweep is responsible for catching the drift. This is a deliberate trade-off (CPSC API is intermittent and a fail-closed posture would block every listing whenever the upstream is degraded).

**Counsel question:** is the nightly-sweep-plus-seller-notification mitigation sufficient defense for the window between insert and the next sweep, given CPSIA §19's strict-liability framing for resale?

---

## 4. Prohibited-items policy (CPSIA + drop-side crib rule)

### 4.1 The allowlist
Migration `012_v4_g4_gear_marketplace.sql` defines `gear_listings.category` as a `CHECK` enum with exactly these ten values:

```
stroller, carrier_wrap, high_chair, bouncer_swing, toy,
feeding_gear, clothing, book, activity_center, nursery_furniture
```

This is an **allowlist**, not a blocklist. Categories outside the enum cannot be inserted at the database layer — a deliberate engineering choice so that no client bug, future feature, or admin action can bypass the policy without a schema migration.

### 4.2 Categories explicitly excluded, and the reasoning
The following are excluded from the allowlist. Each maps to a specific Risk & Compliance §2.2 entry:

| Excluded | Legal / safety basis (per Risk & Compliance §2.2) |
|---|---|
| `car_seat` | CPSIA + CPSC recall DB. Invisible crash damage; mandatory expiration; high recall frequency. We chose blanket exclusion over per-listing expiration/accident-history declarations as the lower-risk path at MVP. |
| `breast_pump` | FDA 21 CFR Part 880 — classified as single-user Class II medical device; internal tubing cannot be fully sanitized. Risk & Compliance §2.3 calls this out as a *separate* note because Milk Connect users might naturally want to also sell their pump. |
| `sleep_positioner` | CPSC + FDA joint warning. Linked to infant deaths; majority recalled. |
| `inclined_sleeper` | CPSC 2019 ruling; class-action litigation; linked to deaths. (Includes anything >10° incline.) |
| `helmet` | CPSC + manufacturer guidance. Invisible impact damage; lifecycle expiration. |

### 4.3 Date-based hard constraints
Two `CHECK` constraints on `gear_listings` enforce the federal rules that depend on manufacture year:

- `toy_year_safe`: when `category = 'toy'`, `year_manufactured` must be `≥ 1978`. This blocks pre-1978 toys that may contain lead paint (CPSIA federal prohibition on lead paint in children's products).
- `crib_year_safe`: any nursery furniture listed as a crib must have `year_manufactured ≥ 2011`. This enforces CPSC Final Rule 16 CFR 1219, which federally banned drop-side cribs in 2011 following strangulation deaths.

These constraints fire at the database layer; the form-side UX in `CreateListingScreen.tsx` conditionally requires `year_manufactured` and surfaces the CPSIA / drop-side reasoning in plain copy when the category is `toy` or matches a crib.

### 4.4 In-app surfacing
`CreateListingScreen.tsx` renders a prohibited-items notice at the very top of the form (the `prohibitedBlock` style) with a tappable inline link to `cpsc.gov/Recalls`. This is the in-app surface for what Risk & Compliance §2.7 #3 calls "Prohibited Items Policy ... published in app and on web; enforced with category blocking in the listing form (not just a checkbox)."

The "published on web" half is not yet shipped. See §8 pending items.

### 4.5 What counsel needs to publish or sign off
- The **prohibited-items policy document** itself — a published, attorney-reviewed page accessible from inside the app and from the marketing site. Internal Risk & Compliance §2.7 budgets this as P2, $500–1,000.
- Confirmation that the allowlist matches counsel's read of CPSIA / FDA / state-law exposure for Florida marketplace operators.

---

## 5. Marketplace-vs-supplier posture (Section 230 / FDUTPA / Oberdorf)

### 5.1 The legal context
Risk & Compliance §2.4 is candid about the limits of Section 230 in product-liability contexts: *Oberdorf v. Amazon* (3rd Cir. 2019) and *Bolger v. Amazon* (Cal. Ct. App. 2020) both found Amazon could be held liable as a "seller" under state product-liability law for third-party marketplace listings. Risk & Compliance instructs that "The Village should consult Florida counsel on whether Florida product liability law could reach the platform for third-party seller listings."

That consultation is the work of the present review. The engineering posture below is the mitigation the Risk & Compliance memo prescribes: make the platform-not-seller posture both *contractually explicit* (via informed-consent acceptance) and *behaviorally consistent* (we don't inspect, fulfill, or guarantee anything).

### 5.2 The three-step Gear Legal Disclosure Addendum
Before any buyer is allowed to message a seller for the *first* time (per user, not per listing), the `GearLegalDisclosureModal` component (`apps/mobile/src/components/gear/GearLegalDisclosureModal.tsx`) gates the flow. It mirrors the Milk Connect informed-consent pattern that Risk & Compliance §3.2 prescribes:

1. **Scroll-gated disclosure** — the Gear Marketplace Addendum body must be fully scrolled to the bottom before the acknowledgment chips become enabled.
2. **Three individual chip acknowledgments**, each a separate tap:
   - `not_a_seller` — "I understand The Village is not the seller, does not inspect products, and is not a party to my transaction."
   - `no_recalls` — "I understand I am responsible for confirming any product I buy is not under a CPSC recall, even if The Village's automated check passed."
   - `own_risk` — "I understand I am transacting at my own risk; there is no buyer protection, no escrow, no chargeback recourse through the platform."
3. **Success state** — fires `gear_legal_addendum_accepted` analytics event; writes a version-pinned row to `gear_legal_acceptances` (table created in migration 024 with `user_id`, `document_key`, `document_version`, `accepted_at`, `ip_address`, `user_agent`, optional context JSON, UNIQUE `(user_id, document_key, document_version)`).

The version pin is critical: when the Addendum changes (which counsel may instruct us to do as part of this review), users must re-accept. The `GEAR_LEGAL_DOC_VERSION` constant in `apps/mobile/src/api/gear.ts` is the canonical version string.

### 5.3 The Safe Meeting Guide gate
After Addendum acceptance, if this is the user's first message on *this specific listing*, `SafeMeetingGuideModal` (`apps/mobile/src/components/gear/SafeMeetingGuideModal.tsx`) runs. It is scroll-gated and has six sections:

1. Meet in a public place (Risk & Compliance §2.5 enumerates: police station parking lots, public libraries, busy coffee shops).
2. Bring another adult; never meet alone.
3. Inspect the item before paying.
4. **Cash or P2P only** — Venmo/Zelle/Apple Cash at pickup; no wire transfers, no shipping for payment.
5. Trust your gut — back out if anything feels wrong.
6. What to do if something goes wrong (report-listing pointer + local police).

Acknowledgment writes `safe_meeting_ack_at` on the `gear_message_threads` row (migration 024) and writes a `gear_safe_meeting_accepted` analytics event. The thread cannot proceed to chat until this gate clears.

### 5.4 The report-and-takedown pipeline
Table: `gear_listing_reports` (migration 024). Schema fields:

- `reason_code` (`CHECK` enum, exactly eight values): `recalled_item`, `prohibited_category`, `counterfeit_or_fake`, `damaged_or_unsafe`, `misleading_description`, `price_or_scam`, `harassment_or_abuse`, `other`.
- `description` — required free-text, 10–2000 chars.
- `status` (`CHECK` enum): `open` → `under_review` → `resolved` | `dismissed`.
- `resolution_note`, `resolved_at`, `resolved_by` columns for audit trail.

RLS is *seller-silent*: the seller has **no read access** to the reports filed against their listing. Only the reporter (read) and service-role admins (full) can see them. This is intentional — a reporting flow that the reported party can see chills reports of harassment and fraud.

The in-app `ReportListingModal` (`apps/mobile/src/components/gear/ReportListingModal.tsx`) surfaces the eight reasons as chips and includes copy promising "review within 24 hours" — this is the 24-hour SLA referenced in Risk & Compliance §2.7 #7.

### 5.5 The 24-hour SLA — the assignee is still unnamed
**This is a gap.** The in-app copy makes a 24-hour-human-review promise that the company has not yet operationally staffed. Risk & Compliance §2.7 #7 is binding: "In-app 'Report this listing' available on every listing; 24hr human review of flagged items." Engineering has built the queue (`gear_listing_reports` with status pipeline + admin-only RLS) and the admin compliance-event viewer (`admin-compliance-events` Edge Function with `admin_audit_log` writes). What is missing:

- A named human (or on-call rotation) accountable for the 24-hour clock.
- A response template for the reporter.
- An escalation path for the four legally-serious reason codes (`recalled_item`, `prohibited_category`, `damaged_or_unsafe`, `harassment_or_abuse`).

See §6 and §8 for the items counsel should specify.

---

## 6. DMCA-style takedown SOP

Risk & Compliance §2.1 calls for "a DMCA-style takedown process for recalled product reports." We have the *infrastructure*; we lack the *SOP*.

### What is built
- The eight-reason `gear_listing_reports` enum (see §5.4) covers every category of takedown notice we expect to receive.
- Reports are surfaced through a service-role-only admin viewer (`admin-compliance-events` Edge Function) that returns filterable, paginated reports + analytics events with JSON or RFC-4180 CSV export.
- Every admin call writes an `admin_audit_log` row recording the filters used and the count returned. This is the chain-of-custody artifact for any future challenge that the platform did or did not act on a specific notice.
- When a reporting decision results in a listing withdrawal, the existing `mark_listing_cpsc` (for recall hits) or admin override sets `status` out of `active` and writes a notification to the seller.

### What is missing — items that need counsel input
- **Named assignee for the 24-hour SLA.** (Same gap as §5.5.)
- **Response template** for reporter and (where appropriate) for seller.
- **Escalation path** for the four legally-serious reason codes vs. the four lower-severity codes. Should `harassment_or_abuse` route to a different reviewer than `price_or_scam`?
- **Counter-notice procedure** for the reported seller. DMCA's safe-harbor model assumes a counter-notice path. CPSIA §19 does not — a recall report should not be subject to counter-notice. Risk & Compliance is silent on this.
- **Repeat-offender policy.** When does a seller's account get suspended? Risk & Compliance §3.1 lists "General Terms of Service ... account termination" as one of the clauses counsel must draft; this maps to the same operational question.
- **Document retention** for resolved reports. We currently retain indefinitely; counsel should specify a policy.

---

## 7. Insurance gate (GL + E&O)

Risk & Compliance §2.7 #8 reads, verbatim: "INSURANCE: Confirm with broker that general liability policy covers marketplace facilitation."

The "V4 Open gates" section of the engineering build log includes this requirement under "Before G5 public rollout: ... insurance GL+E&O confirms marketplace coverage."

### What counsel needs to confirm with the broker
- That the active **General Liability** policy covers third-party bodily injury arising from a product purchased through the marketplace — i.e. that "you facilitated a peer-to-peer sale" is not excluded.
- That **Errors & Omissions** (a.k.a. tech E&O / professional liability) covers claims arising from the CPSC recall-check feature — e.g. a buyer claiming reliance on "CPSC Checked ✓" when the check returned a false negative.
- That **Cyber liability** covers the breach of `gear_legal_acceptances` (PII: IP address, user agent) and `gear_listing_reports` (which may contain narrative descriptions of harassment or harm).
- Whether the policy carries a marketplace-specific exclusion or sublimit we should be aware of.

The engineering build log enumerates this as a launch-blocking item; we should not flip the production feature flag for public rollout until the broker confirmation is in writing.

---

## 8. Pending attorney sign-offs (priority ordered)

This list is the concatenation of every legal-review item still open in the engineering build log (`CLAUDE.md`, "V4 Open gates" section, lines 169–171) and the Risk & Compliance §2.7 / §3.1 non-negotiables. Priorities are taken verbatim from Risk & Compliance Part 3.4 ("Priority"):

1. **[P1 — before Gear Marketplace beta] Gear Marketplace Terms Addendum.** Attorney-drafted document covering: no-warranty disclaimer, seller representations, platform-not-seller posture, CPSC compliance commitments, indemnification, governing law (Florida), dispute resolution. Risk & Compliance §3.1 estimate: $800–1,500. The text the user actually accepts in the three-step Addendum modal is the current placeholder and will need to be replaced with counsel's final draft. The version-pin system (§5.2) means we can deploy the new draft without retroactively losing the audit trail on the old one.

2. **[P1 — before App Store submission] FDUTPA review of all marketing copy and in-app claims**, especially any verification or safety language. Risk & Compliance §3.1 estimate: $500–1,000. Concrete in-app strings that counsel should review and bless or rewrite:
   - "CPSC Checked ✓" (the `CPSCBadge` component label).
   - The Safe Meeting Guide's six sections (any of which could be construed as a safety claim).
   - The Addendum's "automated check" language (does it overpromise verification?).
   - Marketing-site copy currently using phrases like "Every listing checked against CPSC recall database" (Risk & Compliance §4.5 internal positioning).

3. **[P1 — before Gear Marketplace beta] Insurance GL + E&O confirmation** (see §7).

4. **[P1 — before G5 public rollout] 24-hour takedown SLA — named human assignee** (see §5.5 and §6). This is technically operational, not legal, but counsel should specify the SOP so the assignee has a script.

5. **[P2 — before Gear Marketplace public launch] CPSC compliance review of the prohibited-items policy.** Risk & Compliance §3.1 estimate: $500–1,000. This is the formal publication of the allowlist (see §4) as a customer-facing policy document, with counsel-confirmed reasoning for each excluded category.

6. **[P1 — gating G8 post-MVP path] FinCEN / Florida money-transmitter counsel review** (see §9 below).

7. **[Cross-cutting, P0 — required before any public launch] Privacy Policy update** covering: location data (the gear browse experience uses `expo-location` for distance ranking), the IP-address / user-agent capture in `gear_legal_acceptances`, the analytics-events table contents (§10), and Florida Digital Bill of Rights compliance. Risk & Compliance §3.1 estimate: $800–1,500.

8. **[P0 — before any public launch] General Terms of Service** covering account-termination conditions, dispute-resolution forum, and the relationship between the platform and the marketplace addendum.

9. **[Operational] Repeat-offender / account-suspension policy** for sellers with confirmed reports (see §6).

10. **[Operational] Document-retention policy** for `gear_listing_reports`, `gear_legal_acceptances`, and `gear_analytics_events` (see §10).

---

## 9. Open architectural fork — the G8 FinCEN P2P question

The single largest open question for V4 is **whether The Village can ever process P2P gear payments**, and if so, under what regulatory posture. Risk & Compliance and the company's internal Master Plan disagree on this point:

- **Risk & Compliance §2.7 #5** is unambiguous: NO payment processing at MVP. Stripe Connect is reserved for "v2 ... if we become a proper marketplace escrow."
- **The Master Plan** (separate strategy document) **assumes** P2P payments will exist post-MVP.

The engineering build log records this as the largest V4 architectural fork: "Before G8: FinCEN / Florida money-transmitter counsel review — can The Village process P2P gear payments at MVP? Risk doc says NO; Master Plan assumes YES. Biggest V4 architectural fork."

### The question we need counsel to frame
Under the following hypothetical post-MVP architecture:

- The Village runs a Stripe Connect destination-charge flow (the same one already live for Milk Connect).
- A platform fee is taken from the buyer's payment.
- Funds are held by Stripe (not by The Village's own accounts) and released to the seller on a configurable hold.
- A 48-hour buyer-protection window allows dispute filings before release.

**Does this architecture cause The Village to be a money transmitter under 31 CFR §1010.100(ff)(5)?** Specifically:
- Does the exemption under §1010.100(ff)(5)(ii)(F) ("the person only provides ... agent of a payee") apply when the platform takes a fee?
- Does Stripe's status as the registered MSB shield The Village from being one, or does the existence of the platform fee and the hold introduce independent transmission?
- How does Florida Chapter 560 (Money Services Businesses) overlay?
- If the architecture *would* create money-transmitter status, is there a configuration (e.g. seller-direct payouts, no platform fee, no hold) that would not?

The current MVP is built to be on the safe side of this question. The fork only matters when the company chooses to ship payments post-MVP, but the question should be answered *now* so the v2 roadmap can be sized.

---

## 10. Appendix — telemetry surfaces for chain-of-custody

Every event below writes to `gear_analytics_events` (migration 024). Schema: `(user_id UUID, event_name VARCHAR(80), properties JSONB, occurred_at TIMESTAMPTZ)`. The table is RLS-locked to service role; mobile clients only `INSERT` via the `logGearEvent` API. Events are persisted *server-side* so they survive client analytics outages, app uninstalls, and platform-level analytics opt-outs.

The legal purpose of each event:

| event_name | Fired when | Legal purpose |
|---|---|---|
| `gear_listing_viewed` | Buyer opens a listing detail screen. Properties: `category`, `cpsc_recall_status`. | FDUTPA — establishes what was visible to the user at view time. If a buyer later claims "I never saw the recall status," we can produce the contrary record. |
| `gear_listing_saved` / `gear_listing_unsaved` | Save/unsave toggle. | Engagement; not load-bearing for legal. |
| `gear_listing_created` | After successful insert. Properties: `category`, `has_upc`, `is_free`, `image_count`, `year_manufactured`. | CPSIA + prohibited-items defense — records the metadata that drove the CPSC check and the allowlist decision. |
| `gear_cpsc_check_result` | Every call to `gear-cpsc-check`. Properties: `status`, `has_upc`, `recall_number`. | **CPSIA §19 defense.** Records the verdict for every listing at submission time, even for listings that were never inserted because the gate blocked them. |
| `gear_cpsc_block_shown` | The hard-block modal renders. | **CPSIA §19 defense.** Direct evidence that the platform actively prevented a recalled-item listing. This is the most legally load-bearing event in the system. |
| `gear_barcode_scanned` | Buyer/seller uses the barcode scanner. Properties: `upc`, `found`, `source`. | CPSC defense — establishes that automated identification was attempted. |
| `gear_vision_identified` | Seller uses "Identify from photo" (Claude Haiku vision). Properties: `confidence`, `has_name`, `category_hint`. | CPSC defense + FDUTPA — establishes what category the AI suggested, which is relevant if the listing later turns out to be a prohibited item. |
| `gear_safe_meeting_shown` | Safe Meeting Guide modal renders. | Section 230 / negligence defense — records that the safety interstitial was actually surfaced. |
| `gear_safe_meeting_accepted` | Buyer ack's the Safe Meeting Guide. Persists to `gear_message_threads.safe_meeting_ack_at`. | Section 230 / negligence defense — affirmative acknowledgment record. |
| `gear_legal_addendum_shown` | Gear Legal Disclosure Modal renders. | Informed-consent record (Risk & Compliance §3.2). |
| `gear_legal_addendum_accepted` | All three chip acks tapped + scroll-gate passed. Also writes a version-pinned row to `gear_legal_acceptances`. | **Section 230 + Oberdorf defense + FDUTPA defense.** Direct evidence of informed consent to the platform-not-seller posture. |
| `gear_thread_opened` | Chat screen mount. Properties: `thread_id`, `listing_id`, `side` (buyer/seller). | Discoverability — establishes when a conversation began. |
| `gear_message_sent` | A message lands. Properties: `body_len`, `side`. (Note: body content itself is *not* in analytics — only on `gear_messages`.) | Discoverability — counts only. |
| `gear_listing_reported` | Reporter submits a report. Also writes a full row to `gear_listing_reports`. | 24-hour SLA chain-of-custody. The analytics event survives even if the seller-silent `gear_listing_reports` row is later expunged for retention reasons. |

### Two adjacent stores that counsel should know about
- `gear_legal_acceptances` (migration 024) — the *signed* record of every Addendum/Safe-Meeting acceptance, with `ip_address`, `user_agent`, `accepted_at`, `document_version`, and optional `context` JSON. This is the artifact you would subpoena-respond with.
- `admin_audit_log` — every admin read of the compliance-events viewer writes a row recording the filter set and result count. If the company is ever asked "did you look at reports from June?", this is the answer.

### Retention
Currently all three stores (`gear_analytics_events`, `gear_legal_acceptances`, `gear_listing_reports`) are retained indefinitely. Counsel should specify a retention schedule as part of the Privacy Policy work (§8 item 7).

---

*End of handoff. For any factual claim in this document that does not match the codebase, the codebase is authoritative — please open an issue rather than relying on a verbal correction.*
