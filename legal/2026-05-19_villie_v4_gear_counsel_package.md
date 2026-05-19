# Villie · V4 Gear Marketplace — Counsel Sign-Off Package

**Date prepared:** 2026-05-19
**Prepared by:** Felipe T. (Founder / Engineering)
**For:** outside counsel — Florida marketplace, FinCEN, consumer-product safety
**Status:** code complete across G5–G8; pre-launch legal review is the remaining gate before opening V4 Gear publicly

---

## A. Engagement scope (read first)

### What we're asking counsel to do

We have built a peer-to-peer secondhand baby-gear marketplace as one vertical of a Florida-based maternal-health mobile app. The product is **code complete and runs on staging**. We are **not asking counsel to architect compliance** — that work is done in code and documented here. We are asking counsel to:

1. **Review** the posture we have taken and tell us where it is wrong.
2. **Draft** the actual Gear Marketplace Terms Addendum body. The in-app acceptance scaffold is shipped (3-step modal, version-pinned per-user persistence, automatic re-prompt on version bump) but the document users currently click through is placeholder text. Every "acceptance" recorded between today and the day the real text lands is legally hollow.
3. **Sign off** on the specific items enumerated in Part E of this package. Each line item names a defensible position we've taken; counsel either affirms it, requests changes, or rejects it. The lines that change require code changes which are scoped and ready to execute.
4. **Be available** during the pre-launch window for follow-up questions on the marketplace-vs-supplier distinction and the FinCEN posture.

### What we're not asking

- We are not asking counsel to design a new architecture.
- We are not asking for general pre-launch legal advice on the broader app — V1 Specialists, V2 Milk Connect, V3 Community, and V4 Home / Manual / Events / Perks are out of scope for this engagement. (Milk Connect has its own legal sign-off track.)
- We are not asking counsel to draft consumer-facing copy beyond the Addendum itself. UX copy in the app is engineering / product.

### Timeline & process

- **Target launch window:** TBD pending this review. We will not flip V4 Gear public until Part E is fully signed off.
- **Preferred response form:** redlines on this document or a separate memo. Email is fine. We do not need a video call unless counsel wants one for the FinCEN question (Item E-1) since that is the highest-stakes item.
- **Engineering point of contact:** Felipe T. — same person as the document preparer. Counsel can reply directly.
- **Code traceability:** every claim in this document cites the file and migration that implements it. Counsel does not need to read the code; the citations exist so any disputed claim can be verified.

### What is in this package

- **Part A** (this section) — engagement scope
- **Part B** — legal posture brief (the full V4 Gear architecture, decision history, code surfaces, accepted exposures)
- **Part C** — operational playbook for the post-launch 24-hour takedown SLA
- **Part D** — what changed in the last 72 hours (pre-upload prohibited-item hard block shipped 2026-05-19; flagged here so counsel doesn't review a stale snapshot)
- **Part E** — the sign-off checklist (the executable deliverable for counsel)

The package is ~25 pages. Parts A and E are the ones counsel must read. Parts B, C, D are the substantive material being reviewed.

---

## B. Legal posture brief


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

#### 1. Executive summary

The Village is a Florida-based maternal-health mobile app. **V4 Gear** is its peer-to-peer secondhand baby-gear marketplace. The product surface has been built end-to-end and runs on staging. Every legally salient subsystem identified in the internal Risk & Compliance memo (CPSC recall sync, prohibited-items allowlist, informed-consent acceptance flow, in-app reporting pipeline, safe-meeting interstitial, off-platform-payment disclosures) is implemented in code with an audit trail.

**What blocks public rollout** is *not* code. It is the set of attorney sign-offs enumerated in §8 below — chiefly: (a) attorney-drafted Gear Marketplace Terms Addendum, (b) FDUTPA review of every in-app safety/verification claim, (c) confirmation that the GL + E&O insurance policy actually covers marketplace facilitation, (d) a named human assignee for the 24-hour takedown SLA already promised to users in the in-app report flow, and (e) the FinCEN / Florida money-transmitter question for the post-MVP payment path (we ship cash-only at MVP precisely to avoid this fork; the question remains open for v2).

This document is the paper trail for that review.

---

#### 2. The cash-only architecture decision

##### What we did
The V4 Gear MVP **does not process payments**. Buyers and sellers arrange and execute the cash or P2P transfer themselves, off-platform, at the in-person meet. The Village's role ends at the in-app chat and the safe-meeting interstitial.

##### What we explicitly did NOT build
This is the bright line we want counsel to confirm we are on the correct side of:

- **No Stripe Connect onboarding for gear sellers.** Stripe Connect *is* live for the unrelated V2 Milk Connect product, but it is not extended to Gear.
- **No `gear-purchase-intent` Edge Function.** (Compare to `milk-purchase-intent`, which exists.)
- **No `GearCheckoutScreen`, no PaymentSheet, no card field.** The mobile app has no surface to enter card data in the Gear flow.
- **No escrow, no 48-hour buyer-protection hold, no chargeback handling, no dispute-driven refund path.**
- **No marketplace fee, no platform commission, no SubID-style attribution for the transaction itself.**

##### The rationale on record
Internal Risk & Compliance §2.7 lists "Non-Negotiable #5 — NO PAYMENT PROCESSING" verbatim:

> "Do not process payments for gear at MVP — facilitate cash/P2P only to avoid FinCEN money transmitter licensing obligations. Use Stripe only if we become a proper marketplace escrow in v2."

§2.5 reiterates: "Cash is safest for in-person transactions; Venmo/Zelle to known individuals only."

The build decision was logged on 2026-04-23 and is recorded as a binding project memory ("V4 Gear MVP is cash-only — no in-app payments, no Stripe Connect; off-platform cash/P2P only"). The G8 row of the engineering build table is explicit: "**Decision 2026-04-23: cash-only MVP** ... NO Stripe Connect, NO gear-purchase-intent, NO GearCheckoutScreen, NO 48h hold — all Stripe/buyer-protection paths explicitly deferred to post-MVP."

##### What counsel should confirm
- That the current architecture, as described above, falls outside the FinCEN definition of a money transmitter under 31 CFR §1010.100(ff)(5).
- That Florida's chapter-560 money-services-business regime is likewise inapplicable.
- That the in-app copy disclaiming payment processing (see §5 below) is sufficient to defeat a reasonable user expectation that we offer buyer protection.

A separate question — what would change about the analysis if we later add in-app payments — is the architectural fork in §9.

---

#### 3. CPSC §19 compliance posture

CPSIA §19 makes it unlawful to "sell, offer for sale, manufacture for sale, distribute in commerce, or import into the United States" any product subject to a CPSC recall. Risk & Compliance §2.1 identifies this as "The #1 Risk" for the gear marketplace and cites the CPSC's 2022 enforcement action against an Amazon reseller of recalled infant product.

The Village's mitigation has four layers:

##### 3.1 Pre-insert gate (hard block at listing time)
File: `apps/mobile/src/screens/gear/CreateListingScreen.tsx`. Before a new listing is inserted into the database — and **before** photos are uploaded — the client calls the `gear-cpsc-check` Edge Function with `{ category, title, brand, upc }`. If the response returns `status='recalled'`, the submission is aborted, no row is inserted, and a full-screen `CPSCRecallBlockModal` renders.

The modal:
- Displays the recall hazard and remedy text from `cpsc_recall_cache`.
- Includes an expandable "Why is this blocked?" explainer that references CPSIA §19 by name.
- Provides "Open CPSC notice →" linking to the recall URL on saferproducts.gov (or `cpsc.gov/Recalls` as fallback).
- Has **no "list anyway" escape hatch.** The only affordance is "Got it" (close).

A `gear_cpsc_block_shown` analytics event is written each time the modal renders. This is the chain-of-custody record for any future §19 enforcement defense.

Source: migration `023_v4_g5_cpsc_vision.sql`.

##### 3.2 Post-insert verification (best-effort persistence)
After a successful insert (i.e. the pre-insert check returned `clear` or `unknown`), the client fires a non-blocking `cpscCheck(listing_id)` so the `mark_listing_cpsc` RPC writes the verdict (`clear` / `recalled` / `unknown`) and the matched `cpsc_recall_id`/`cpsc_recall_url` onto the row. This makes the verdict a queryable column on every listing rather than just a transient client-side check.

##### 3.3 Nightly recall sweep
A `pg_cron` job named `gear-cpsc-recall-sync` runs daily at 02:00 ET (06:00 UTC). It:
1. Pulls fresh recalls from SaferProducts.gov for the prior 365 days.
2. Upserts them in 500-row chunks into `cpsc_recall_cache` (table keyed on `recall_number`, with lowercased brand/product name and a GIN-indexed `upcs[]` array for fast lookup).
3. Invokes the SECURITY DEFINER RPC `sweep_active_listings_for_recalls`, which matches active listings by UPC or by `brand + title LIKE`, sets `status='recalled'` + `removed_reason='cpsc_recall'`, transitions the listing out of `active`, and inserts a row of `type='gear_recall'` into `user_notifications_feed` so the seller is notified.

This is the "actively monitored" half of the §2.1 requirement that "every listing should be cross-checked at submission time **and periodically re-checked**."

Source: migration `023_v4_g5_cpsc_vision.sql`; Edge Function `gear-cpsc-recall-sync`.

##### 3.4 Audit-trail telemetry
Two analytics event names exist exclusively for §19 defense:
- `gear_cpsc_check_result` — fired on every CPSC check call. Properties: `status`, `has_upc`, `recall_number` (when matched).
- `gear_cpsc_block_shown` — fired only when the hard-block modal renders. This is the record that the user *attempted* to list a recalled item and was prevented from doing so.

Both write to `gear_analytics_events` via the `logGearEvent` API. See §10 for the full event catalogue.

##### 3.5 Fail-open posture and counsel question
The `gear-cpsc-check` function is designed to fail open: if the SaferProducts.gov live query times out or errors, the result is `status='unknown'`, the listing is allowed to post, and the nightly sweep is responsible for catching the drift. This is a deliberate trade-off (CPSC API is intermittent and a fail-closed posture would block every listing whenever the upstream is degraded).

**Counsel question:** is the nightly-sweep-plus-seller-notification mitigation sufficient defense for the window between insert and the next sweep, given CPSIA §19's strict-liability framing for resale?

---

#### 4. Prohibited-items policy (CPSIA + drop-side crib rule)

##### 4.1 The allowlist
Migration `012_v4_g4_gear_marketplace.sql` defines `gear_listings.category` as a `CHECK` enum with exactly these ten values:

```
stroller, carrier_wrap, high_chair, bouncer_swing, toy,
feeding_gear, clothing, book, activity_center, nursery_furniture
```

This is an **allowlist**, not a blocklist. Categories outside the enum cannot be inserted at the database layer — a deliberate engineering choice so that no client bug, future feature, or admin action can bypass the policy without a schema migration.

##### 4.2 Categories explicitly excluded, and the reasoning
The following are excluded from the allowlist. Each maps to a specific Risk & Compliance §2.2 entry:

| Excluded | Legal / safety basis (per Risk & Compliance §2.2) |
|---|---|
| `car_seat` | CPSIA + CPSC recall DB. Invisible crash damage; mandatory expiration; high recall frequency. We chose blanket exclusion over per-listing expiration/accident-history declarations as the lower-risk path at MVP. |
| `breast_pump` | FDA 21 CFR Part 880 — classified as single-user Class II medical device; internal tubing cannot be fully sanitized. Risk & Compliance §2.3 calls this out as a *separate* note because Milk Connect users might naturally want to also sell their pump. |
| `sleep_positioner` | CPSC + FDA joint warning. Linked to infant deaths; majority recalled. |
| `inclined_sleeper` | CPSC 2019 ruling; class-action litigation; linked to deaths. (Includes anything >10° incline.) |
| `helmet` | CPSC + manufacturer guidance. Invisible impact damage; lifecycle expiration. |

##### 4.3 Date-based hard constraints
Two `CHECK` constraints on `gear_listings` enforce the federal rules that depend on manufacture year:

- `toy_year_safe`: when `category = 'toy'`, `year_manufactured` must be `≥ 1978`. This blocks pre-1978 toys that may contain lead paint (CPSIA federal prohibition on lead paint in children's products).
- `crib_year_safe`: any nursery furniture listed as a crib must have `year_manufactured ≥ 2011`. This enforces CPSC Final Rule 16 CFR 1219, which federally banned drop-side cribs in 2011 following strangulation deaths.

These constraints fire at the database layer; the form-side UX in `CreateListingScreen.tsx` conditionally requires `year_manufactured` and surfaces the CPSIA / drop-side reasoning in plain copy when the category is `toy` or matches a crib.

##### 4.4 In-app surfacing
`CreateListingScreen.tsx` renders a prohibited-items notice at the very top of the form (the `prohibitedBlock` style) with a tappable inline link to `cpsc.gov/Recalls`. This is the in-app surface for what Risk & Compliance §2.7 #3 calls "Prohibited Items Policy ... published in app and on web; enforced with category blocking in the listing form (not just a checkbox)."

The "published on web" half is not yet shipped. See §8 pending items.

##### 4.5 What counsel needs to publish or sign off
- The **prohibited-items policy document** itself — a published, attorney-reviewed page accessible from inside the app and from the marketing site. Internal Risk & Compliance §2.7 budgets this as P2, $500–1,000.
- Confirmation that the allowlist matches counsel's read of CPSIA / FDA / state-law exposure for Florida marketplace operators.

---

#### 5. Marketplace-vs-supplier posture (Section 230 / FDUTPA / Oberdorf)

##### 5.1 The legal context
Risk & Compliance §2.4 is candid about the limits of Section 230 in product-liability contexts: *Oberdorf v. Amazon* (3rd Cir. 2019) and *Bolger v. Amazon* (Cal. Ct. App. 2020) both found Amazon could be held liable as a "seller" under state product-liability law for third-party marketplace listings. Risk & Compliance instructs that "The Village should consult Florida counsel on whether Florida product liability law could reach the platform for third-party seller listings."

That consultation is the work of the present review. The engineering posture below is the mitigation the Risk & Compliance memo prescribes: make the platform-not-seller posture both *contractually explicit* (via informed-consent acceptance) and *behaviorally consistent* (we don't inspect, fulfill, or guarantee anything).

##### 5.2 The three-step Gear Legal Disclosure Addendum
Before any buyer is allowed to message a seller for the *first* time (per user, not per listing), the `GearLegalDisclosureModal` component (`apps/mobile/src/components/gear/GearLegalDisclosureModal.tsx`) gates the flow. It mirrors the Milk Connect informed-consent pattern that Risk & Compliance §3.2 prescribes:

1. **Scroll-gated disclosure** — the Gear Marketplace Addendum body must be fully scrolled to the bottom before the acknowledgment chips become enabled.
2. **Three individual chip acknowledgments**, each a separate tap:
   - `not_a_seller` — "I understand The Village is not the seller, does not inspect products, and is not a party to my transaction."
   - `no_recalls` — "I understand I am responsible for confirming any product I buy is not under a CPSC recall, even if The Village's automated check passed."
   - `own_risk` — "I understand I am transacting at my own risk; there is no buyer protection, no escrow, no chargeback recourse through the platform."
3. **Success state** — fires `gear_legal_addendum_accepted` analytics event; writes a version-pinned row to `gear_legal_acceptances` (table created in migration 024 with `user_id`, `document_key`, `document_version`, `accepted_at`, `ip_address`, `user_agent`, optional context JSON, UNIQUE `(user_id, document_key, document_version)`).

The version pin is critical: when the Addendum changes (which counsel may instruct us to do as part of this review), users must re-accept. The `GEAR_LEGAL_DOC_VERSION` constant in `apps/mobile/src/api/gear.ts` is the canonical version string.

##### 5.3 The Safe Meeting Guide gate
After Addendum acceptance, if this is the user's first message on *this specific listing*, `SafeMeetingGuideModal` (`apps/mobile/src/components/gear/SafeMeetingGuideModal.tsx`) runs. It is scroll-gated and has six sections:

1. Meet in a public place (Risk & Compliance §2.5 enumerates: police station parking lots, public libraries, busy coffee shops).
2. Bring another adult; never meet alone.
3. Inspect the item before paying.
4. **Cash or P2P only** — Venmo/Zelle/Apple Cash at pickup; no wire transfers, no shipping for payment.
5. Trust your gut — back out if anything feels wrong.
6. What to do if something goes wrong (report-listing pointer + local police).

Acknowledgment writes `safe_meeting_ack_at` on the `gear_message_threads` row (migration 024) and writes a `gear_safe_meeting_accepted` analytics event. The thread cannot proceed to chat until this gate clears.

##### 5.4 The report-and-takedown pipeline
Table: `gear_listing_reports` (migration 024). Schema fields:

- `reason_code` (`CHECK` enum, exactly eight values): `recalled_item`, `prohibited_category`, `counterfeit_or_fake`, `damaged_or_unsafe`, `misleading_description`, `price_or_scam`, `harassment_or_abuse`, `other`.
- `description` — required free-text, 10–2000 chars.
- `status` (`CHECK` enum): `open` → `under_review` → `resolved` | `dismissed`.
- `resolution_note`, `resolved_at`, `resolved_by` columns for audit trail.

RLS is *seller-silent*: the seller has **no read access** to the reports filed against their listing. Only the reporter (read) and service-role admins (full) can see them. This is intentional — a reporting flow that the reported party can see chills reports of harassment and fraud.

The in-app `ReportListingModal` (`apps/mobile/src/components/gear/ReportListingModal.tsx`) surfaces the eight reasons as chips and includes copy promising "review within 24 hours" — this is the 24-hour SLA referenced in Risk & Compliance §2.7 #7.

##### 5.5 The 24-hour SLA — the assignee is still unnamed
**This is a gap.** The in-app copy makes a 24-hour-human-review promise that the company has not yet operationally staffed. Risk & Compliance §2.7 #7 is binding: "In-app 'Report this listing' available on every listing; 24hr human review of flagged items." Engineering has built the queue (`gear_listing_reports` with status pipeline + admin-only RLS) and the admin compliance-event viewer (`admin-compliance-events` Edge Function with `admin_audit_log` writes). What is missing:

- A named human (or on-call rotation) accountable for the 24-hour clock.
- A response template for the reporter.
- An escalation path for the four legally-serious reason codes (`recalled_item`, `prohibited_category`, `damaged_or_unsafe`, `harassment_or_abuse`).

See §6 and §8 for the items counsel should specify.

---

#### 6. DMCA-style takedown SOP

Risk & Compliance §2.1 calls for "a DMCA-style takedown process for recalled product reports." We have the *infrastructure*; we lack the *SOP*.

##### What is built
- The eight-reason `gear_listing_reports` enum (see §5.4) covers every category of takedown notice we expect to receive.
- Reports are surfaced through a service-role-only admin viewer (`admin-compliance-events` Edge Function) that returns filterable, paginated reports + analytics events with JSON or RFC-4180 CSV export.
- Every admin call writes an `admin_audit_log` row recording the filters used and the count returned. This is the chain-of-custody artifact for any future challenge that the platform did or did not act on a specific notice.
- When a reporting decision results in a listing withdrawal, the existing `mark_listing_cpsc` (for recall hits) or admin override sets `status` out of `active` and writes a notification to the seller.

##### What is missing — items that need counsel input
- **Named assignee for the 24-hour SLA.** (Same gap as §5.5.)
- **Response template** for reporter and (where appropriate) for seller.
- **Escalation path** for the four legally-serious reason codes vs. the four lower-severity codes. Should `harassment_or_abuse` route to a different reviewer than `price_or_scam`?
- **Counter-notice procedure** for the reported seller. DMCA's safe-harbor model assumes a counter-notice path. CPSIA §19 does not — a recall report should not be subject to counter-notice. Risk & Compliance is silent on this.
- **Repeat-offender policy.** When does a seller's account get suspended? Risk & Compliance §3.1 lists "General Terms of Service ... account termination" as one of the clauses counsel must draft; this maps to the same operational question.
- **Document retention** for resolved reports. We currently retain indefinitely; counsel should specify a policy.

---

#### 7. Insurance gate (GL + E&O)

Risk & Compliance §2.7 #8 reads, verbatim: "INSURANCE: Confirm with broker that general liability policy covers marketplace facilitation."

The "V4 Open gates" section of the engineering build log includes this requirement under "Before G5 public rollout: ... insurance GL+E&O confirms marketplace coverage."

##### What counsel needs to confirm with the broker
- That the active **General Liability** policy covers third-party bodily injury arising from a product purchased through the marketplace — i.e. that "you facilitated a peer-to-peer sale" is not excluded.
- That **Errors & Omissions** (a.k.a. tech E&O / professional liability) covers claims arising from the CPSC recall-check feature — e.g. a buyer claiming reliance on "CPSC Checked ✓" when the check returned a false negative.
- That **Cyber liability** covers the breach of `gear_legal_acceptances` (PII: IP address, user agent) and `gear_listing_reports` (which may contain narrative descriptions of harassment or harm).
- Whether the policy carries a marketplace-specific exclusion or sublimit we should be aware of.

The engineering build log enumerates this as a launch-blocking item; we should not flip the production feature flag for public rollout until the broker confirmation is in writing.

---

#### 8. Pending attorney sign-offs (priority ordered)

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

#### 9. Open architectural fork — the G8 FinCEN P2P question

The single largest open question for V4 is **whether The Village can ever process P2P gear payments**, and if so, under what regulatory posture. Risk & Compliance and the company's internal Master Plan disagree on this point:

- **Risk & Compliance §2.7 #5** is unambiguous: NO payment processing at MVP. Stripe Connect is reserved for "v2 ... if we become a proper marketplace escrow."
- **The Master Plan** (separate strategy document) **assumes** P2P payments will exist post-MVP.

The engineering build log records this as the largest V4 architectural fork: "Before G8: FinCEN / Florida money-transmitter counsel review — can The Village process P2P gear payments at MVP? Risk doc says NO; Master Plan assumes YES. Biggest V4 architectural fork."

##### The question we need counsel to frame
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

#### 10. Appendix — telemetry surfaces for chain-of-custody

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

##### Two adjacent stores that counsel should know about
- `gear_legal_acceptances` (migration 024) — the *signed* record of every Addendum/Safe-Meeting acceptance, with `ip_address`, `user_agent`, `accepted_at`, `document_version`, and optional `context` JSON. This is the artifact you would subpoena-respond with.
- `admin_audit_log` — every admin read of the compliance-events viewer writes a row recording the filter set and result count. If the company is ever asked "did you look at reports from June?", this is the answer.

##### Retention
Currently all three stores (`gear_analytics_events`, `gear_legal_acceptances`, `gear_listing_reports`) are retained indefinitely. Counsel should specify a retention schedule as part of the Privacy Policy work (§8 item 7).

---

*End of handoff. For any factual claim in this document that does not match the codebase, the codebase is authoritative — please open an issue rather than relying on a verbal correction.*


---

## C. Operational playbook — 24-hour takedown SLA


> **Purpose**: define exactly who is on the hook for the 24-hour review
> promise the app makes inside `ReportListingModal`, what they do when a
> report lands, and what happens if they miss the window.
>
> **Status**: draft. Owner name + backup + paging channel still TBD.
> Approve / fill in those fields, then this becomes the live playbook.
>
> **Why this exists**: production app copy promises every reporter
> "A moderator reviews every report within 24 hours." An unkept public
> promise is FDUTPA-actionable on its own, independent of whether the
> underlying complaint was valid. A documented, followed SOP is the
> defense.

---

#### 1 · Promises in the app today

Verbatim, from `apps/mobile/src/components/gear/ReportListingModal.tsx`:

| Surface | Copy |
|---|---|
| Modal body | "Help us keep Villie safe. A moderator reviews every report within 24 hours. The seller will not be told who reported them." |
| Post-submit alert | "A Village moderator will review this listing within 24 hours. You will not be notified of the outcome, but we may take the listing down without warning the seller." |

Two commitments are made:

1. **Review within 24 hours.** This is the SLA.
2. **Reporter anonymity from the seller.** Operationally enforceable (we never include `reporter_user_id` in any seller-facing surface).

The reporter is explicitly told they will **not** be notified of the
outcome. That simplifies the SOP — no reporter-facing follow-up is owed.

---

#### 2 · Severity tiers

The 8 reason codes from `gear_listing_reports.reason_code` map to three
severity tiers. The 24-hour figure in the in-app copy is the **P1**
window; P0 reports get tighter treatment internally.

| Tier | SLA | Reason codes | Why this tier |
|---|---|---|---|
| **P0** | **4 hours** | `recalled_item`, `harassment_or_abuse` | CPSC §19 exposure + Section 230 / safety exposure |
| **P1** | **24 hours** (the published SLA) | `prohibited_category`, `counterfeit_or_fake`, `damaged_or_unsafe` | Material safety / consumer-protection concerns |
| **P2** | 48 hours (internal target only — no public promise) | `misleading_description`, `price_or_scam`, `other` | Quality of marketplace, lower legal exposure |

Reporting clocks start at `gear_listing_reports.created_at`.

---

#### 3 · Roles

**Current state (transitional, pre-ops-hire)** — both moderator slots
sit with the founder + co-founder. Per the recommendation in the
attorney handoff doc, personal contact details are kept out of this
file; they live in the private contacts vault (1Password / Notion).

| Role | Owner | Responsibility |
|---|---|---|
| **Primary moderator** | Founder (Felipe) — alias `moderator@villieapp.com` (route to founder inbox + push) | Reviews the queue twice daily, owns P0 paging. |
| **Backup moderator** | Co-founder (founder's partner) — alias `moderator-backup@villieapp.com` (route to partner inbox + push) | Covers PTO, weekends, and overflow. |
| **Escalation contact** | Counsel (TBD — engagement pending per attorney handoff doc) + founder | Receives anything that triggers legal exposure or threatens to. Until counsel is engaged, the founder owns escalation by default. |

**Transitional constraints worth naming explicitly:**

- **Single-household coverage**: primary + backup share a residence and
  often a schedule. For P0 at 03:00 ET this is fine (one phone wakes
  both). For a 2-week joint PTO, coverage breaks. Either don't take
  joint PTO during the launch window, or hand-off the on-call to a
  third human (counsel, advisor, contractor) for the gap.
- **Bus factor of one effective person**: if both founders are
  unreachable, the SLA fails. This is acceptable risk pre-launch but
  is **not** acceptable at meaningful user volume. Trigger to revisit:
  >100 active gear listings OR first paying hospital partner.
- **No legal counsel in escalation chain yet**: until counsel is
  engaged (open item in `V4_GEAR_ATTORNEY_HANDOFF.md`), genuine legal
  exposure events have nowhere to escalate to. P0 events with legal
  surface area (e.g., a credible CSAM report, a threat-of-violence
  message) should be reported directly to law enforcement via 911 /
  the local non-emergency line, with the founder documenting
  the timeline in `admin_audit_log` for the eventual counsel review.

**Hard rule**: the role pair `primary + backup` must cover **24/7**
for P0 severities. P1 + P2 can be business-hours queue work.

**Pre-launch deliverables before this section is enforceable:**

- [ ] `moderator@villieapp.com` and `moderator-backup@villieapp.com` email aliases configured (forwarding to founder + partner respectively).
- [ ] OneSignal push channel verified on both founders' personal devices.
- [ ] 1Password / Notion entry created with phone numbers + real email behind the aliases (label: "Villie · Moderator on-call").

---

#### 4 · How reports reach the moderator

Three surfacing channels, layered by severity:

1. **Real-time pager** (P0 only)
   - Webhook fired on `gear_listing_reports` INSERT when `reason_code IN ('recalled_item', 'harassment_or_abuse')`.
   - Routes to PagerDuty / OneSignal push to the primary's phone.
   - Backup is paged if primary doesn't ack within 30 min.
   - _Implementation: trigger + edge fn, not yet built. See §10 to-do._

2. **Daily digest email** (all tiers)
   - 09:00 ET cron writes a digest to the moderator inbox: every report opened in the last 24h + every report still `under_review` past its SLA window.
   - Reuses `admin-compliance-events` edge fn output.

3. **Studio saved query** (ad-hoc)
   - Bookmark: `SELECT id, listing_id, reason_code, description, status, created_at FROM gear_listing_reports WHERE status IN ('open', 'under_review') ORDER BY created_at ASC;`
   - Used for manual sweeps and when the daily digest fails.

The primary moderator's day starts by clearing the digest email.

---

#### 5 · The review pipeline

The DB already has the four-status pipeline. The SOP names what each
transition means in practice.

```
  open ──claim──▶ under_review ──action──▶ resolved
                                       ╲
                                        ╲──no action──▶ dismissed
```

| Transition | When | Who | Audit-log entry |
|---|---|---|---|
| `open → under_review` | Moderator opens the report and starts investigating. Must happen within the SLA. | Primary / backup | `gear_report_claimed` |
| `under_review → resolved` | Action taken: listing withdrawn, seller account flagged, message thread escalated, etc. The "what was done" is required in the audit log. | Primary / backup | `gear_report_resolved` (with `action_taken` field) |
| `under_review → dismissed` | No action. Either the report was incorrect or the listing was already in compliance. Reasoning required. | Primary / backup | `gear_report_dismissed` (with `reason` field) |

Every transition writes a row to `admin_audit_log` with
`{ report_id, listing_id, reason_code, prior_status, new_status, action_taken_or_dismissal_reason, moderator_user_id }`. **No silent
status changes.** The audit log is the FDUTPA defense file.

---

#### 6 · Per-reason decision tree

What the moderator does once they open a report, by `reason_code`.

##### `recalled_item` (P0 · 4 hours)

1. Pull the listing from `get_gear_listing(listing_id)`.
2. Check `cpsc_recall_status`:
   - `'recalled'` → listing is already auto-withdrawn (migration 023 trigger handled it). Confirm and `resolved`. No further action needed; CPSC compliance is automated.
   - `'clear'` or `'unknown'` → run `gear-cpsc-check` edge fn manually with the listing's UPC and brand+title. Re-check status.
3. If new status comes back `'recalled'`, auto-withdraw fires → `resolved`.
4. If still `'clear'` after manual recheck, **dismiss with reasoning** in the audit log. Reporter was wrong — that's fine, the SOP defended the user.

##### `harassment_or_abuse` (P0 · 4 hours)

1. Open the relevant `gear_message_threads` row for `listing_id` + the seller. The thread is participant-RLS so the moderator must use the service-role admin view (`admin-compliance-events` already exposes this).
2. Read the message history. Look for: threats, slurs, sexual content directed at a user, doxxing, repeated contact after "stop" was sent.
3. Three possible resolutions:
   - **Confirmed abuse** → suspend reported user account (service-role UPDATE on `users.deleted_at` flag, or a softer `users.is_suspended` if/when that column exists). Withdraw all their active listings. Audit-log it.
   - **Threat of physical harm or minor involved** → escalate to escalation contact + law enforcement (911 or local non-emergency line). Document the timestamp of escalation.
   - **No abuse confirmed** → dismiss with reasoning. Do not message either party.

##### `prohibited_category` (P1 · 24 hours)

1. Check `gear_listings.category` against the migration 012 allowlist (no `car_seat`, `breast_pump`, `sleep_positioner`, `inclined_sleeper`, `helmet`).
2. If category is on the allowlist but the **title / description / photos** describe a prohibited item that slipped past the picker (e.g., listed as `toy` but is actually a `breast_pump`):
   - Withdraw the listing (`listing_status = 'withdrawn'`, `removed_reason = 'prohibited_after_review'`).
   - Send the seller the template in §7.
   - Apply a 7-day cooldown before that seller can post a new listing (manual flag in `admin_audit_log` for now; future column).
3. If the listing is legitimately on the allowlist, dismiss.

##### `counterfeit_or_fake` (P1 · 24 hours)

The moderator usually cannot verify counterfeit status from photos alone.
Default posture is to act on **patterns**, not single reports.

1. Look up the seller's other listings: `SELECT * FROM gear_listings WHERE seller_user_id = ? AND listing_status != 'withdrawn'`.
2. Count active reports across all their listings.
3. If **≥2 separate reporters** have filed `counterfeit_or_fake` against this seller, withdraw all flagged listings and suspend the seller account pending verification (seller emails proof of purchase / receipt).
4. If single report, dismiss with reasoning. Note in audit log so the next report compounds.

##### `damaged_or_unsafe` (P1 · 24 hours)

1. Review listing photos + description.
2. If photos confirm a hazard (cracked frame, mold, missing safety part, expired by-date on consumables): withdraw, notify seller via §7 template.
3. If ambiguous, dismiss. Reporter was free to walk away from the meet.

##### `misleading_description` (P2 · 48h internal target)

1. Compare listing copy to photos. Look for material misrepresentation (brand claimed but not visible, condition graded "Excellent" when photos show clear wear, capacity / weight figures invented).
2. **Material** misrepresentation → withdraw + §7 template.
3. **Minor** misrepresentation (color slightly off, year off by one) → dismiss.

##### `price_or_scam` (P2 · 48h internal target)

1. Check seller account age (`users.created_at`).
2. Check whether they have any completed milk or gear transactions or specialist bookings as a credibility signal.
3. New account (<7 days) + multiple listings + reported for scam → suspend pending verification.
4. Established account + single report → dismiss.

##### `other` (P2 · 48h internal target)

1. Read the free-text `description` field.
2. Route to whichever category from above fits best, follow that branch.
3. If nothing fits, dismiss.

---

#### 7 · Response templates

Reporters are told upfront they won't get a response — no template needed
for them. Sellers get one of three system messages when an action is
taken against their listing.

All templates ship EN + ES because the user's `preferred_language`
governs delivery.

##### Template A — Listing withdrawn (CPSC recall)

**EN**: "We've withdrawn your listing because the item matches an active CPSC recall ({{recall_number}}). Recalled items can't be resold on Villie under federal law (CPSIA §19). Details: {{recall_url}}. This isn't a strike on your account."

**ES**: "Retiramos tu anuncio porque el artículo coincide con un retiro activo de la CPSC ({{recall_number}}). Por ley federal (CPSIA §19), los artículos retirados no pueden revenderse en Villie. Detalles: {{recall_url}}. Esto no afecta tu cuenta."

##### Template B — Listing withdrawn (prohibited category / safety / misrepresentation)

**EN**: "We've withdrawn your listing after a moderator review. Reason: {{reason_short}}. Our Gear Marketplace Addendum (in your account → Account & security) explains the categories we don't allow and the listing standards we follow. You can list other items at any time."

**ES**: "Retiramos tu anuncio tras la revisión de un moderador. Razón: {{reason_short}}. El Adendo del Intercambio de Artículos (en tu cuenta → Cuenta y seguridad) explica las categorías no permitidas y los estándares que seguimos. Puedes publicar otros artículos cuando quieras."

`reason_short` is one of: "matches a category we don't allow",
"photos show a safety hazard", "description didn't match the photos",
"signs of counterfeit goods", "pattern of reports across your account".

##### Template C — Account suspended pending verification

**EN**: "Your Villie seller account is paused while we look into a report. Reply to this message with proof of purchase (receipt, original packaging photo, or original listing screenshot) for the items you've listed. We'll restore your account within 3 business days of receiving documentation."

**ES**: "Tu cuenta de vendedor en Villie está en pausa mientras revisamos un reporte. Responde a este mensaje con comprobante de compra (recibo, foto del empaque original, o captura del anuncio original) de los artículos que publicaste. Restauraremos tu cuenta dentro de 3 días hábiles después de recibir la documentación."

All three templates are delivered as `system` messages inside the
existing `gear_messages` thread tied to the affected listing, so the
seller sees them in-app.

---

#### 8 · Failure-mode posture (most important section)

What happens if the moderator misses the SLA. **This is what makes the
24-hour promise legally defensible.**

##### P0 missed (no `under_review` claim within 4 hours)

- The listing is **auto-withdrawn** by a Postgres-side trigger. Better to over-withdraw and reinstate later than to leave a recalled / abusive listing live.
- The seller receives Template A (recall) or Template B (other P0) automatically.
- The report status flips to `under_review` with `auto_escalated = true` flag; primary + backup are both paged.
- This is the only auto-action defensible without human review — CPSC §19 makes it federally compelling for recalls, and harassment is safety-tier.

##### P1 missed (no `under_review` claim within 24 hours)

- The report is **not** auto-actioned. P1 reasons aren't safe to auto-withdraw without human review (false-positive risk).
- Instead, an `auto_acknowledged_at` timestamp is written and an internal alert fires to the escalation contact.
- This buys defensible time: we have not silently dropped the report.
- The moderator must clear it within the next 24 hours or the escalation contact takes it over.

##### P2 missed

- Internal alert only. No legal exposure beyond marketplace quality.

##### What gets logged either way

Every SLA miss writes a row to `admin_audit_log` with
`{ event: 'gear_report_sla_missed', tier, report_id, time_since_created }`.
This is part of the FDUTPA defense file: we did not silently ignore
reports; we have a timestamped record of every missed deadline and the
escalation that followed.

---

#### 9 · Coverage cadence

| Window | Coverage |
|---|---|
| **Weekdays 09:00–18:00 ET** | Primary on the queue. Acks all reports in the daily digest before noon. |
| **Weekdays 18:00–09:00 ET** | Backup on call for P0 only. P1/P2 reports wait until morning. |
| **Weekends + holidays** | Backup primary on call for P0 only. P1 + P2 acked by Monday 12:00 ET. |
| **PTO** | Primary notifies Felipe 7+ days in advance. Backup becomes acting primary for the window. |

Both humans must have the OneSignal push channel enabled on a personal
device. Phone-off-for-the-night is fine for P1+; P0 will wake them.

---

#### 10 · Implementation to-do (pre-launch)

Code that needs to land before this SOP is enforceable:

- [ ] **P0 real-time pager** — Postgres trigger on `gear_listing_reports` INSERT, fires edge fn that posts to OneSignal / PagerDuty for `reason_code IN ('recalled_item', 'harassment_or_abuse')`.
- [ ] **SLA-miss auto-withdraw for P0** — pg_cron every 15 min: any `recalled_item` or `harassment_or_abuse` report still `open` past 4 hours → auto-withdraw the listing + Template A/B.
- [ ] **Daily digest email** — pg_cron 09:00 ET → email via Resend (or SES) to primary + backup with every report open in the last 24h + every report past its SLA.
- [ ] **`auto_escalated` + `auto_acknowledged_at` columns** on `gear_listing_reports`.
- [ ] **`admin_audit_log` schema confirmation** — verify `action_taken` and `dismissal_reason` fields exist and are surfaced by `admin-compliance-events` edge fn.
- [ ] **System-message dispatch helper** — small edge fn that writes a `system`-type message into `gear_messages` for a given thread (used by Templates A / B / C). Reuses existing message infra.
- [ ] **Optional**: `gear_seller_cooldowns` table for the 7-day reposting ban after a `prohibited_category` strike.

Until those are built, the SOP runs manually: the primary moderator
checks Studio twice daily and dispatches templates by hand.

---

#### 11 · Onboarding from zero

A new moderator should read, in order:

1. This SOP (you're reading it).
2. `docs/V4_GEAR_ATTORNEY_HANDOFF.md` for the legal posture context.
3. `docs/source/Village_Risk_and_Compliance.md` §2.1 (CPSC) — the source of truth for the marketplace's compliance commitments.
4. CPSC SaferProducts.gov — where recalled-item reports get cross-referenced.
5. FTC marketplace guidance on Section 230 + FDUTPA.

They should shadow the primary for at least 5 P1/P2 reports before
taking the queue solo. P0 reports they observe only until 10+ resolutions
under supervision.

---

#### 12 · Open items for counsel review before this SOP goes live

- **Auto-withdraw on P0 miss** (§8). Is the trigger-based auto-action without human review acceptable for recalled-item reports? CPSC §19 suggests yes; counsel should confirm for `harassment_or_abuse` specifically.
- **Reporter-anonymity language** (§1). The modal says "the seller will not be told who reported them." Confirm we're under no subpoena-style obligation to surface the reporter even on legal request without a court order.
- **Suspension without notice** (§6 `counterfeit_or_fake`, `price_or_scam`). Suspending an account pending verification is standard marketplace practice; confirm we have the right under our Gear Marketplace Addendum once the real Addendum text lands.
- **7-day reposting ban** (§6 `prohibited_category`). Confirm acceptable; otherwise replace with a warning + automatic re-screen on next post.

---

#### Cross-references

- `/Users/gp/.claude/projects/-Users-gp-The-Village-App/memory/project_gear_takedown_sla_unassigned.md` — the memory entry this SOP closes out.
- `docs/V4_GEAR_ATTORNEY_HANDOFF.md` — the legal-posture brief.
- `supabase/migrations/024_v4_gear_messaging.sql` — schema for `gear_listing_reports`, `gear_message_threads`, `gear_messages`.
- `apps/mobile/src/components/gear/ReportListingModal.tsx` — the in-app surface that makes the 24-hour promise.
- `apps/mobile/src/api/gear.ts` — `GearReportReason` type + `gearReportReasonLabel`.
- `supabase/functions/admin-compliance-events/index.ts` — admin viewer for both gear + milk analytics events.



---

## D. Delta since Part B was written (2026-05-19)

The legal posture brief in Part B was last fully revised on 2026-05-18.
One non-trivial change shipped on 2026-05-19 that counsel should be aware
of when reviewing the CPSC + prohibited-items section (Part B §3).

### Pre-upload prohibited-item hard block (shipped 2026-05-19, commit `023b09a`)

**What it changes:** previously, the prohibited-items list (`car_seat`,
`breast_pump`, `sleep_positioner`, `inclined_sleeper`, `helmet`) was
enforced at three layers — DB-level CHECK constraint on `gear_listings.category`,
the reactive 24-hour moderator queue, and a pre-submit CPSC recall check.
The gap: a seller could pick `category='toy'` (passes the allowlist),
title their listing "Used breast pump", upload a clear photo, and the DB
would accept the row because the category-level check passed.

**Now:** a fourth layer sits between photo upload and row insert. Every
photo added to a draft listing fires `gear-vision-identify` (Claude
Haiku multimodal) silently in the background. The model is prompted to
return a `prohibited_category` enum value (one of the 5 prohibited
types) when it identifies a prohibited item from the photo at
confidence ≥ 0.6. On submit, before any photos upload or any row
inserts, the cached results are checked; if any photo matches a
prohibited category, the listing is hard-blocked via
`ProhibitedItemBlockModal`. No "post anyway" escape hatch. No photos
upload to storage. No row inserts.

**Audit trail:** three new analytics events writing to
`gear_analytics_events`:

| Event | Fires when |
|---|---|
| `gear_vision_prohibited_identified` | Background scan catches a prohibited item at photo-add time |
| `gear_prohibited_block_shown` | Hard-block modal renders (source field tracks `identify_button` vs `submit_gate`) |
| `gear_vision_check_failed` | Fail-open path on submit (network outage, Anthropic API down) — for completeness of the audit record |

**Fail-open posture:** matches the existing CPSC fail-open. If the vision
call genuinely cannot complete (network outage, Anthropic API down) after
an in-line retry on submit, we log `gear_vision_check_failed` and let the
submission proceed. The nightly compliance sweep and the reactive
moderator queue catch anything that slips through. The decision rationale:
a hard fail-closed posture means a single Anthropic outage could block
every gear upload in the country, which is worse for the business than the
small residual risk of a prohibited item slipping through one of four
layers.

**What this means for counsel review:** the marketplace-vs-supplier
distinction in Part B §4 strengthens. We now have four independent
defense-in-depth layers against prohibited items, each with its own
audit trail. The Section 230 posture (we curate aggressively but do not
materially modify user content) is unaffected. If counsel reviews Part B
and asks "but what if someone uploads a breast pump under category=toy?"
the answer is: that listing now never inserts.

### Moderator role assignment (Part C §3, 2026-05-19)

The takedown SOP in Part C lists `_TBD_` slots for primary moderator,
backup moderator, and escalation contact at the time it was first
written (2026-05-18). Those slots are now filled with the transitional
founder-owned posture: founder + co-founder cover the queue via email
aliases (`moderator@villieapp.com` + `moderator-backup@villieapp.com`).
Three structural risks that don't go away with this arrangement are
named explicitly in Part C §3 (single-household coverage breaks on joint
PTO; bus factor of one effective person; no counsel in the escalation
chain yet). Coverage scales up at >100 active gear listings or first
paying hospital partner.

---

## E. Sign-off checklist — the executable deliverable

Each item below is a specific position we have taken in the code.
Counsel either signs off (initials in the **Status** column), requests
changes (notes in the **Edits requested** column), or rejects (note
why). Lines requiring code changes are scoped — the engineering effort
to comply is named so the cost of each "change" is legible to counsel.

### E-1 · FinCEN / Florida money-transmitter posture (HIGHEST STAKES)

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 1.1 | V4 Gear MVP processes no payments. No Stripe Connect, no escrow, no chargeback handling, no marketplace fee. Cash / P2P only, off-platform. | Part B §2 | ⬜ | |
| 1.2 | This architecture sits outside 31 CFR §1010.100(ff)(5) FinCEN money-transmitter definition. | Part B §2 | ⬜ | |
| 1.3 | Florida Chapter 560 MSB regime is likewise inapplicable. | Part B §2 | ⬜ | |
| 1.4 | If counsel concludes that any future state (e.g., adding an in-app tip jar, or a "Buy Now" payment button) would trigger FinCEN registration, we will treat that as a binding architectural fork and re-engage counsel before building. | Part B §2 | ⬜ | |

### E-2 · CPSC §19 + prohibited-items posture

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 2.1 | Prohibited-items allowlist is enforced via DB CHECK constraint, not application logic. A row with `category='car_seat'` literally cannot insert. | Part B §3, migration 012 | ⬜ | |
| 2.2 | Mis-tagged listings (e.g., category=toy + photo of breast pump) are caught at upload via the pre-insert vision-identify gate shipped 2026-05-19. | Part D | ⬜ | |
| 2.3 | CPSC recall cross-check runs at upload (synchronously, hard block) and nightly via cron sweep across active listings. | Part B §3, migration 023, edge function `gear-cpsc-recall-sync` | ⬜ | |
| 2.4 | Recalled listings auto-withdraw via Postgres trigger; the seller is notified via Template A in Part C §7. | Part C §6 + §7 | ⬜ | |
| 2.5 | Fail-open on transient API errors (CPSC SaferProducts.gov down, Anthropic API down) is the documented posture. Logged to `gear_analytics_events` for audit. | Part B §3 + Part D | ⬜ | |

### E-3 · Marketplace-vs-supplier (Section 230 + FDUTPA)

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 3.1 | Villie facilitates listings + chat. Villie does not take possession, do not handle payment, do not modify user content materially. | Part B §4 | ⬜ | |
| 3.2 | The 3-step Gear Legal Disclosure Addendum makes the user acknowledge (a) Villie is not a seller, (b) item has no known recall to user's knowledge, (c) the transaction is at their own risk. | Part B §4, migration 024 `gear_legal_acceptances` | ⬜ | |
| 3.3 | The Addendum BODY ITSELF is placeholder. Counsel must draft the real text. The version-gate plumbing automatically re-prompts every user on next gear interaction when `LEGAL_DOC_VERSION` bumps. | Memory `project_gear_legal_addendum_placeholder.md` | ⬜ | **YES — draft required** |
| 3.4 | The Safe Meeting Guide modal is content-final and a separate scroll-gated acceptance step before the user can initiate a buyer-seller message thread. | migration 024 + `SafeMeetingGuideModal` | ⬜ | |
| 3.5 | In-app safety claims ("CPSC checked", "reviewed within 24 hours") are FDUTPA-defensible because the corresponding system actually performs that check / review. | Part B §4 + Part C §1 | ⬜ | |

### E-4 · DMCA-style takedown SOP

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 4.1 | 8-reason structured report system shipped (recalled_item, prohibited_category, counterfeit_or_fake, damaged_or_unsafe, misleading_description, price_or_scam, harassment_or_abuse, other). | migration 024 `gear_listing_reports` | ⬜ | |
| 4.2 | Reporter anonymity from the seller is operationally enforceable (no seller-facing surface ever includes `reporter_user_id`). | Part C §1 | ⬜ | |
| 4.3 | Severity tiers split the 8 reasons into P0 (4hr internal), P1 (24hr published SLA), P2 (48hr internal). | Part C §2 | ⬜ | |
| 4.4 | P0 SLA-miss auto-withdraws the listing (recall + abuse only) — defensible under CPSIA §19 for recall path; counsel confirmation needed for the abuse path. | Part C §8 | ⬜ | **counsel confirmation needed** |
| 4.5 | Founder + co-founder cover the queue transitionally; coverage scales up at >100 active gear listings or first paying hospital partner. | Part C §3 + Part D | ⬜ | |

### E-5 · Insurance + indemnification

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 5.1 | GL + E&O policy needs to confirm marketplace facilitation coverage (not just SaaS / mobile app). | Part B §6 | ⬜ | **counsel to brief insurer** |
| 5.2 | If insurer carves out marketplace, counsel and underwriter should propose either (a) endorsement, (b) separate marketplace policy, or (c) what risk we accept uninsured. | Part B §6 | ⬜ | |

### E-6 · Response templates (EN + ES)

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 6.1 | Three seller-facing templates exist (CPSC recall takedown / generic withdrawal / account suspension pending verification). | Part C §7 | ⬜ | |
| 6.2 | Templates are delivered as `system`-type messages inside the existing `gear_messages` thread tied to the affected listing. | Part C §7 | ⬜ | |
| 6.3 | EN + ES copy is included; counsel approval on tone and disclaimers needed. | Part C §7 | ⬜ | |

### E-7 · Telemetry / audit-trail completeness

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 7.1 | Every legally salient event writes to `gear_analytics_events` with timestamp + user + event type + context. | migration 024 + Part D | ⬜ | |
| 7.2 | The `admin-compliance-events` edge function (service-role-gated, every read logged to `admin_audit_log`) is the moderator's view onto this data, with CSV export. | CLAUDE.md A2 row | ⬜ | |
| 7.3 | This data is the FDUTPA defense file. Retention policy should default to "indefinite for compliance-relevant events" unless counsel specifies otherwise. | Part B §7 | ⬜ | **counsel to specify retention** |

### E-8 · Final go / no-go

| Signature | Date |
|---|---|
| Counsel signature: ___________________________ | ____________ |
| Affirms package E-1 through E-7 reviewed: ⬜ |  |
| Conditions (if any): | |

---

*End of counsel package. Engineering will treat the signed E-8 line as
the go-signal for the public Gear launch, subject to the resolution of
any items left blank or marked with requested edits.*
