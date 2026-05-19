# Villie · V4 Gear Marketplace — Counsel Sign-Off Package

**Date prepared:** 2026-05-19
**Prepared by:** Felipe T. (Founder / Engineering)
**For:** outside counsel — Florida marketplace, FinCEN, consumer-product safety
**Status:** code complete across G5–G8; pre-launch legal review is the remaining gate before opening V4 Gear publicly

---

## A. Engagement scope (read first)

### What we're asking counsel to do

We have built a peer-to-peer secondhand baby-gear marketplace as one vertical of a Florida-based maternal-health mobile app. The product is **code complete and runs on staging**. We are not asking counsel to architect compliance — that work is done in code and documented here. We are asking counsel to:

1. **Review** the posture we have taken and tell us where it is wrong.
2. **Draft** the actual Gear Marketplace Terms Addendum body. The in-app acceptance scaffold is shipped (3-step modal, version-pinned per-user persistence, automatic re-prompt on version bump) but the document users currently click through is placeholder text. Every "acceptance" recorded between today and the day the real text lands is legally hollow.
3. **Sign off** on the specific items in Part C. Each line item names a defensible position we've taken; counsel either affirms it, requests changes, or rejects it.
4. **Be available** during the pre-launch window for follow-up questions on the marketplace-vs-supplier distinction and the FinCEN posture.

### Timeline & process

- **Target launch window:** TBD pending this review. We will not flip V4 Gear public until Part C is fully signed off.
- **Preferred response form:** redlines on this document or a separate memo. Email is fine. We do not need a video call unless counsel wants one for Item C-1 (FinCEN) since that is the highest-stakes line.
- **Engineering point of contact:** Felipe T. Counsel can reply directly.
- **Code traceability:** every claim in this document cites the file or migration that implements it. Counsel does not need to read the code; the citations exist so any disputed claim can be verified.

### What is in this package

- **Part A** (this section) — engagement scope
- **Part B** — legal posture brief (the substantive material being reviewed)
- **Part C** — the sign-off checklist (the executable deliverable for counsel)

The package is ~13 pages. Parts A and C are the ones counsel must read. Part B is the substantive material being reviewed.

---

## B. Legal posture brief

### 1. Executive summary

The Village is a Florida-based maternal-health mobile app. **V4 Gear** is its peer-to-peer secondhand baby-gear marketplace. Every legally salient subsystem identified in our internal Risk & Compliance memo (CPSC recall sync, prohibited-items allowlist, informed-consent acceptance flow, in-app reporting pipeline, safe-meeting interstitial, off-platform-payment disclosures) is implemented in code with an audit trail.

What blocks public rollout is **not code**. It is the set of attorney sign-offs in Part C — chiefly: (a) the attorney-drafted Gear Marketplace Terms Addendum body, (b) FDUTPA review of every in-app safety/verification claim, (c) confirmation that the GL + E&O insurance policy actually covers marketplace facilitation, and (d) the FinCEN / Florida money-transmitter question for the post-MVP payment path (we ship cash-only at MVP precisely to avoid this fork; the question remains open for v2).

### 2. The cash-only architecture decision

The V4 Gear MVP **does not process payments**. Buyers and sellers arrange and execute the cash or P2P transfer themselves, off-platform, at the in-person meet. The Village's role ends at the in-app chat and the safe-meeting interstitial.

We explicitly did NOT build:
- No Stripe Connect onboarding for gear sellers. (Stripe Connect is live for V2 Milk Connect but is not extended to Gear.)
- No `gear-purchase-intent` Edge Function. No `GearCheckoutScreen`. No PaymentSheet. No card field in the Gear flow at all.
- No escrow, no 48-hour buyer-protection hold, no chargeback handling, no dispute-driven refund path.
- No marketplace fee, no platform commission.

Internal Risk & Compliance §2.7 lists "Non-Negotiable #5 — NO PAYMENT PROCESSING" verbatim: *"Do not process payments for gear at MVP — facilitate cash/P2P only to avoid FinCEN money transmitter licensing obligations."* The build decision is recorded as a binding project memory dated 2026-04-23.

**Counsel should confirm:** that the current architecture sits outside the FinCEN money-transmitter definition under 31 CFR §1010.100(ff)(5), and that Florida Chapter 560 (MSB regime) is likewise inapplicable. See §6 below for the post-MVP architectural fork.

### 3. CPSC §19 compliance posture

CPSIA §19 makes it unlawful to "sell, offer for sale, manufacture for sale, distribute in commerce, or import" any product subject to a CPSC recall. Risk & Compliance §2.1 identifies this as our #1 risk and cites CPSC's 2022 enforcement action against an Amazon reseller of recalled infant product.

Our mitigation has **four independent defense-in-depth layers**:

| Layer | Catches | Implementation |
|---|---|---|
| 1. Category allowlist | A seller picking a prohibited category from the dropdown | DB-level CHECK constraint on `gear_listings.category` (migration 012). Cannot be bypassed by any client bug or admin action without a schema migration. |
| 2. Year-safety CHECKs | Pre-CPSIA toys (pre-1978) and drop-side cribs (pre-2011, 16 CFR 1219) | DB-level CHECK constraints (migration 012). |
| 3. Pre-upload vision gate (shipped 2026-05-19) | A mis-tagged listing — e.g. category=toy + photo of breast pump | Every photo runs `gear-vision-identify` (Claude Haiku multimodal) silently in the background on upload. If any photo matches a prohibited category at confidence ≥ 0.6, listing is hard-blocked via `ProhibitedItemBlockModal`. No row is inserted, no photos uploaded to storage. |
| 4. CPSC recall check | Listings whose product/UPC matches an active CPSC recall | Pre-insert call to `gear-cpsc-check` (synchronous, hard block via `CPSCRecallBlockModal`) and a nightly cron sweep across active listings (`gear-cpsc-recall-sync`, migration 023). |

Three observations:

1. **Each layer has its own audit trail.** Hard-block modal renders write `gear_cpsc_block_shown` / `gear_prohibited_block_shown` events to `gear_analytics_events`. The CPSC check itself logs every result via `gear_cpsc_check_result`. These are the chain-of-custody records for any future §19 enforcement defense.

2. **Fail-open posture on transient API errors.** When SaferProducts.gov or Anthropic API is degraded, the upload proceeds (`status='unknown'`) and the nightly sweep is responsible for catching drift. The trade-off is deliberate: a fail-closed posture would block every gear upload during any upstream outage. Logged for audit.

3. **Counsel question:** is the nightly-sweep-plus-seller-notification mitigation sufficient defense for the window between insert and the next sweep, given CPSIA §19's strict-liability framing for resale?

### 4. Prohibited-items policy (CPSIA + safety law)

`gear_listings.category` is enforced as a database **CHECK enum allowlist** with exactly ten values:

```
stroller, carrier_wrap, high_chair, bouncer_swing, toy,
feeding_gear, clothing, book, activity_center, nursery_furniture
```

The following five categories are **explicitly excluded** from the allowlist. Each line maps to a specific safety-law citation:

| Excluded | Legal / safety basis |
|---|---|
| `car_seat` | CPSIA + CPSC recall DB. Invisible crash damage; mandatory expiration; high recall frequency. Blanket exclusion chosen over per-listing expiration/accident-history declarations as the lower-risk path at MVP. |
| `breast_pump` | FDA 21 CFR Part 880 — classified as single-user Class II medical device; internal tubing cannot be fully sanitized. |
| `sleep_positioner` | Joint CPSC + FDA warning. Linked to infant deaths; majority recalled. |
| `inclined_sleeper` | CPSC 2019 ruling + Safe Sleep for Babies Act 2022. Includes anything >10° incline. |
| `helmet` | CPSC + manufacturer guidance. Invisible impact damage; lifecycle expiration. |

**What counsel needs to do:**
- Confirm the allowlist matches counsel's read of CPSIA / FDA / Florida marketplace exposure.
- Produce the published **prohibited-items policy document** (attorney-reviewed page accessible from inside the app and from villieapp.com). Risk & Compliance §3.1 budgets this as P2 ($500–1,000).

### 5. Marketplace-vs-supplier posture (Section 230 + FDUTPA + *Oberdorf*)

Risk & Compliance §2.4 is candid about the limits of Section 230 in product-liability contexts: *Oberdorf v. Amazon* (3rd Cir. 2019) and *Bolger v. Amazon* (Cal. Ct. App. 2020) both found Amazon could be held liable as a "seller" under state product-liability law for third-party marketplace listings. Risk & Compliance instructs that "The Village should consult Florida counsel on whether Florida product liability law could reach the platform for third-party seller listings." That consultation is the work of this review.

The engineering posture is the mitigation the Risk & Compliance memo prescribes: make the platform-not-seller distinction both **contractually explicit** (via informed-consent acceptance) and **behaviorally consistent** (we don't inspect, fulfill, or guarantee anything).

**The three-step Gear Legal Disclosure Addendum** (`GearLegalDisclosureModal`, migration 024 `gear_legal_acceptances`). Before any buyer can message a seller for the first time:

1. **Scroll-gated disclosure** — the Addendum body must be fully scrolled before the acknowledgment chips become enabled.
2. **Three individual chip acknowledgments**, each a separate tap:
   - `not_a_seller` — "I understand The Village is not the seller, does not inspect products, and is not a party to my transaction."
   - `no_recalls` — "I understand I am responsible for confirming any product I buy is not under a CPSC recall, even if The Village's automated check passed."
   - `own_risk` — "I understand I am transacting at my own risk; there is no buyer protection, no escrow, no chargeback recourse through the platform."
3. **Success state** — fires `gear_legal_addendum_accepted` analytics event; writes a version-pinned row to `gear_legal_acceptances` with `user_id`, `document_key`, `document_version`, `accepted_at`, `ip_address`, `user_agent`. UNIQUE on `(user_id, document_key, document_version)`.

The version pin is critical: when the Addendum text changes (which counsel may instruct as part of this review), every user re-accepts on their next gear interaction.

**🔴 The Addendum body itself is placeholder.** Engineering shipped the scaffold around copy that satisfies the UI but does not satisfy the legal function. Every acceptance recorded between today and the day the real text lands is legally hollow. This is item C-3.3 below — counsel deliverable required.

**The Safe Meeting Guide gate** (`SafeMeetingGuideModal`, migration 024). After Addendum acceptance, a second scroll-gated acknowledgment runs before the user can initiate a chat on any specific listing: meet in public, bring another adult, inspect the item, **cash or P2P only**, trust your gut, what to do if something goes wrong. Acknowledgment writes `safe_meeting_ack_at` on the `gear_message_threads` row.

**The report-and-takedown pipeline.** `gear_listing_reports` (migration 024) — 8-reason enum (`recalled_item`, `prohibited_category`, `counterfeit_or_fake`, `damaged_or_unsafe`, `misleading_description`, `price_or_scam`, `harassment_or_abuse`, `other`), 4-status pipeline (`open` → `under_review` → `resolved` | `dismissed`). **RLS is seller-silent**: the seller has no read access to the reports filed against their listing. Only the reporter (read) and service-role admins (full) can see them.

The in-app `ReportListingModal` surfaces the eight reasons and includes copy promising **"review within 24 hours"** — this is Risk & Compliance §2.7 #7. The full operational playbook for that 24-hour SLA — severity tiers, response templates EN+ES, failure-mode posture — is summarized in §7 below.

### 6. Insurance gate (GL + E&O)

Risk & Compliance §2.7 #8 reads verbatim: "INSURANCE: Confirm with broker that general liability policy covers marketplace facilitation."

**What counsel needs to confirm with the broker:**

- The active **General Liability** policy covers third-party bodily injury arising from a product purchased through the marketplace — i.e. that "you facilitated a peer-to-peer sale" is not excluded.
- **Errors & Omissions** (tech E&O / professional liability) covers claims arising from the CPSC recall-check feature — e.g. a buyer claiming reliance on "CPSC Checked ✓" when the check returned a false negative.
- **Cyber liability** covers a breach of `gear_legal_acceptances` (PII: IP address, user agent) and `gear_listing_reports` (which may contain narrative descriptions of harassment or harm).
- Whether the policy carries a marketplace-specific exclusion or sublimit.

The engineering build log enumerates this as a launch-blocking item; we should not flip the production feature flag for public rollout until the broker confirmation is in writing.

### 7. The 24-hour SLA — operational playbook summary

The in-app copy promises "reviewed within 24 hours." This is the operational system behind that promise.

**Severity tiers** (mapped from the 8 reason codes):

| Tier | Internal SLA | Public commitment | Reason codes | Why this tier |
|---|---|---|---|---|
| P0 | 4 hours | (covered by the 24hr public SLA) | `recalled_item`, `harassment_or_abuse` | CPSIA §19 exposure + Section 230 / safety exposure |
| P1 | 24 hours | **The published 24hr SLA** | `prohibited_category`, `counterfeit_or_fake`, `damaged_or_unsafe` | Material safety / consumer-protection |
| P2 | 48 hours | (internal only — no public promise) | `misleading_description`, `price_or_scam`, `other` | Marketplace quality |

**Coverage.** Founder + co-founder cover the queue transitionally via `moderator@villieapp.com` + `moderator-backup@villieapp.com` (personal contact details in a private vault, not in this document). Three structural risks documented internally that do not go away just because owners are named: single-household coverage breaks on joint PTO; bus factor of one effective person; no counsel in the escalation chain yet. Coverage scales up at >100 active gear listings or first paying hospital partner.

**The failure-mode posture is what makes the 24-hour promise legally defensible:**

- **P0 missed (no human action within 4 hours):** The listing is **auto-withdrawn** by a pg_cron job (migration 063 + edge function `gear-moderation-auto-withdraw`, both shipped 2026-05-19). The seller receives a template-A or template-B system message automatically. `auto_escalated = TRUE` is set on the report; primary + backup are both paged. **This is the only auto-action defensible without human review — CPSC §19 makes it federally compelling for recalls, and the harassment path needs explicit counsel sign-off (Item C-4.4).**

- **P1 missed (no human action within 24 hours):** No auto-action — P1 false-positive risk is too high. Instead an `auto_acknowledged_at` timestamp is written, an internal alert fires, and the escalation contact takes over. *We have not silently dropped the report* — this is the FDUTPA defense.

- **Every SLA miss** writes a row to `admin_audit_log`: timestamped record of every missed deadline and the escalation that followed.

**Response templates (EN + ES, delivered as `message_type='system'` rows in the existing `gear_messages` thread):**

**Template A — Listing withdrawn (CPSC recall).**
EN: *"We've withdrawn your listing because the item matches an active CPSC recall ({{recall_number}}). Recalled items can't be resold on Villie under federal law (CPSIA §19). Details: {{recall_url}}. This isn't a strike on your account."*
ES: *"Retiramos tu anuncio porque el artículo coincide con un retiro activo de la CPSC ({{recall_number}}). Por ley federal (CPSIA §19), los artículos retirados no pueden revenderse en Villie. Detalles: {{recall_url}}. Esto no afecta tu cuenta."*

**Template B — Listing withdrawn (prohibited category / safety / misrepresentation).**
EN: *"We've withdrawn your listing after a moderator review. Reason: {{reason_short}}. Our Gear Marketplace Addendum (in your account → Account & security) explains the categories we don't allow and the listing standards we follow. You can list other items at any time."*
ES: *"Retiramos tu anuncio tras la revisión de un moderador. Razón: {{reason_short}}. El Adendo del Intercambio de Artículos (en tu cuenta → Cuenta y seguridad) explica las categorías no permitidas y los estándares que seguimos. Puedes publicar otros artículos cuando quieras."*

`reason_short` is one of: "matches a category we don't allow", "photos show a safety hazard", "description didn't match the photos", "signs of counterfeit goods", "pattern of reports across your account."

**Template C — Account suspended pending verification.**
EN: *"Your Villie seller account is paused while we look into a report. Reply to this message with proof of purchase (receipt, original packaging photo, or original listing screenshot) for the items you've listed. We'll restore your account within 3 business days of receiving documentation."*
ES: *"Tu cuenta de vendedor en Villie está en pausa mientras revisamos un reporte. Responde a este mensaje con comprobante de compra (recibo, foto del empaque original, o captura del anuncio original) de los artículos que publicaste. Restauraremos tu cuenta dentro de 3 días hábiles después de recibir la documentación."*

### 8. Open architectural fork — the G8 FinCEN P2P question

The single largest open question for V4 is **whether The Village can ever process P2P gear payments**, and if so, under what regulatory posture. Risk & Compliance §2.7 #5 says NO at MVP, defers to "v2 ... if we become a proper marketplace escrow." The Master Plan (separate strategy document) **assumes** P2P payments will exist post-MVP.

The MVP is built to be on the safe side. The fork only matters when the company chooses to ship payments post-MVP, but the question should be answered *now* so the v2 roadmap can be sized.

**The question we need counsel to frame:** under a post-MVP architecture in which (a) The Village runs a Stripe Connect destination-charge flow (same flow already live for Milk Connect); (b) a platform fee is taken; (c) funds are held by Stripe (not by The Village) and released on a configurable hold; (d) a 48-hour buyer-protection window allows dispute filings:

- Does this cause The Village to be a money transmitter under 31 CFR §1010.100(ff)(5)?
- Does the exemption under §1010.100(ff)(5)(ii)(F) ("agent of a payee") apply when the platform takes a fee?
- Does Stripe's status as the registered MSB shield The Village, or does the platform fee + the hold introduce independent transmission?
- How does Florida Chapter 560 overlay?
- If the architecture *would* create money-transmitter status, is there a configuration (e.g. seller-direct payouts, no platform fee, no hold) that would not?

---

## C. Sign-off checklist — the executable deliverable

Each item below is a specific position we have taken in code. Counsel either signs off (mark Status ✓), requests changes (notes in **Edits requested**), or rejects (note why). Lines requiring counsel deliverables (the Addendum body, the published prohibited-items policy, etc.) are tagged in bold.

### C-1 · FinCEN / Florida money-transmitter posture (HIGHEST STAKES)

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 1.1 | V4 Gear MVP processes no payments. No Stripe Connect, no escrow, no chargeback handling, no marketplace fee. Cash / P2P only, off-platform. | B §2 | ⬜ | |
| 1.2 | This architecture sits outside 31 CFR §1010.100(ff)(5) FinCEN money-transmitter definition. | B §2 | ⬜ | |
| 1.3 | Florida Chapter 560 MSB regime is likewise inapplicable. | B §2 | ⬜ | |
| 1.4 | Any future state that would trigger FinCEN registration (in-app tip jar, "Buy Now" button, escrow hold) will be treated as a binding architectural fork; counsel re-engaged before building. | B §2, B §8 | ⬜ | |

### C-2 · CPSC §19 + prohibited-items posture

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 2.1 | Allowlist is enforced via DB CHECK constraint. A row with `category='car_seat'` literally cannot insert. | B §3, B §4, migration 012 | ⬜ | |
| 2.2 | Mis-tagged listings (e.g. category=toy + photo of breast pump) are caught at upload via the pre-insert vision-identify gate. | B §3 | ⬜ | |
| 2.3 | CPSC recall cross-check runs at upload (synchronously, hard block) and nightly via cron sweep. | B §3, migration 023 | ⬜ | |
| 2.4 | Recalled listings auto-withdraw via cron; the seller receives Template A. | B §7 | ⬜ | |
| 2.5 | Fail-open on transient API errors is the documented posture. Logged for audit. | B §3 | ⬜ | |
| 2.6 | **Counsel deliverable: the published prohibited-items policy document** (in-app + villieapp.com). | B §4 | ⬜ | **YES — publication required** |

### C-3 · Marketplace-vs-supplier (Section 230 + FDUTPA)

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 3.1 | Villie facilitates listings + chat. Villie does not take possession, handle payment, or materially modify user content. | B §5 | ⬜ | |
| 3.2 | The 3-step Gear Legal Disclosure Addendum makes the user acknowledge (a) Villie is not a seller, (b) item has no known recall to user's knowledge, (c) the transaction is at their own risk. | B §5, migration 024 | ⬜ | |
| 3.3 | **🔴 The Addendum BODY ITSELF is placeholder.** Counsel must draft the real text. Version-gate plumbing automatically re-prompts every user when `LEGAL_DOC_VERSION` bumps. | B §5 | ⬜ | **YES — draft required** |
| 3.4 | The Safe Meeting Guide modal is content-final and a separate scroll-gated acceptance step. | B §5 | ⬜ | |
| 3.5 | In-app safety claims ("CPSC checked", "reviewed within 24 hours") are FDUTPA-defensible because the corresponding systems actually perform the check / review. | B §3, B §7 | ⬜ | |
| 3.6 | **Counsel deliverable: FDUTPA review of all marketing copy and in-app safety claims**, including the `CPSCBadge` label, the Safe Meeting Guide's 6 sections, and the Addendum's "automated check" language. | B §5 | ⬜ | **YES — review required** |

### C-4 · Takedown SOP + 24-hour SLA

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 4.1 | 8-reason structured report system shipped (8 enum values, 4-status pipeline). | B §5, migration 024 | ⬜ | |
| 4.2 | Reporter anonymity from the seller is operationally enforceable (seller-silent RLS; no surface ever includes `reporter_user_id`). | B §5 | ⬜ | |
| 4.3 | Severity tiers split the 8 reasons into P0 / P1 / P2 (4hr / 24hr / 48hr SLAs respectively). | B §7 | ⬜ | |
| 4.4 | P0 SLA-miss auto-withdraws the listing (recall + abuse only). Defensible under CPSIA §19 for recall path; **counsel confirmation needed for the abuse path.** | B §7, migration 063 | ⬜ | **counsel confirmation needed** |
| 4.5 | Three response templates (EN + ES) cover recall takedown, generic withdrawal, account suspension. | B §7 | ⬜ | |
| 4.6 | Founder + co-founder cover the queue transitionally; coverage scales up at >100 active listings or first paying hospital partner. | B §7 | ⬜ | |
| 4.7 | **Counsel input needed: counter-notice procedure for the reported seller** — DMCA's safe-harbor model assumes one. CPSIA §19 does not (a recall report should not be subject to counter-notice). Risk & Compliance is silent on this. | — | ⬜ | **counsel to specify** |
| 4.8 | **Counsel input needed: repeat-offender / suspension policy**. When does a seller's account get suspended? | — | ⬜ | **counsel to specify** |

### C-5 · Insurance + indemnification

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 5.1 | GL + E&O policy needs to confirm marketplace facilitation coverage (not just SaaS / mobile app). | B §6 | ⬜ | **counsel to brief insurer** |
| 5.2 | If insurer carves out marketplace, counsel and underwriter should propose either (a) endorsement, (b) separate marketplace policy, or (c) what risk we accept uninsured. | B §6 | ⬜ | |

### C-6 · Privacy + retention

| # | Position taken | Reference | Status | Edits requested |
|---|---|---|---|---|
| 6.1 | Compliance-relevant data lives in `gear_analytics_events`, `gear_legal_acceptances`, `gear_listing_reports`, `admin_audit_log`. Currently all retained indefinitely. | B §3, B §5 | ⬜ | **counsel to specify retention schedule** |
| 6.2 | **Counsel deliverable: Privacy Policy update** covering location data (gear browse), IP / user-agent capture in `gear_legal_acceptances`, analytics-event contents, Florida Digital Bill of Rights compliance. | — | ⬜ | **YES — update required** |
| 6.3 | **Counsel deliverable: General Terms of Service update** covering account-termination, dispute-resolution forum, relationship to the Addendum. | — | ⬜ | **YES — update required** |

### C-7 · Final go / no-go

| Signature | Date |
|---|---|
| Counsel signature: ___________________________ | ____________ |
| Affirms C-1 through C-6 reviewed: ⬜ |  |
| Conditions (if any): | |

---

*Engineering will treat the signed C-7 line as the go-signal for public Gear launch, subject to resolution of any items left blank or marked with requested edits. For any factual claim in this document that does not match the codebase, the codebase is authoritative — please open an issue rather than relying on a verbal correction.*
