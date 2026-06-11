# Gear Marketplace — CPSC Prohibited Items Policy + Moderation Coverage

**Status:** DRAFT for counsel review (Risk & Compliance P2). Not legal advice. Prepared
2026-06-10 from the shipped implementation (migrations 012 + 023, gear CPSC edge functions,
`GearLegalDisclosureModal`, takedown SOP). **Gate:** attorney sign-off before the hospital
pilot / real users.

---

## 1. What's already enforced in code (factual basis)

The policy below is not aspirational — most of it is enforced by the schema + pipeline today:

- **Allowlist categories (CHECK enum, migration 012).** Only these may be listed:
  `stroller, carrier_wrap, high_chair, bouncer_swing, toy, feeding_gear, clothing, book,
  activity_center, nursery_furniture`.
- **Excluded by design (cannot be listed):** `car_seat`, `breast_pump`, `sleep_positioner`,
  `inclined_sleeper`, `helmet` — high-recall / safety-critical / hygiene categories.
- **Year-of-manufacture gates:** toys must be year ≥ **1978** (`toy_year_safe`, CPSIA era);
  cribs/nursery furniture year ≥ **2011** (`crib_year_safe`, post drop-side-crib ban).
- **CPSC recall screening (migration 023 + edge functions):** every listing is checked against
  SaferProducts.gov by UPC and brand+title; a **recalled** match **hard-blocks** the listing
  (`CPSCRecallBlockModal`, no "list anyway" escape) and auto-withdraws. A nightly
  `sweep_active_listings_for_recalls` cron re-checks live listings and withdraws + notifies
  sellers on new recalls.
- **Informed-consent gate:** buyers/sellers accept the `GearLegalDisclosureModal` (platform-not-
  seller, no-recalls, own-risk) before transacting; cash/P2P-only, no in-app payments.
- **Audit trail:** `gear_cpsc_block_shown` + CPSC-check results logged for CPSIA §19 defense.

---

## 2. Prohibited Items Policy — public-facing draft

> ### What you can and can't list on The Village Gear marketplace
> The Village is a venue that connects parents to buy, sell, and give away gently-used baby gear.
> To keep families safe, the following may **not** be listed:
>
> **Always prohibited (safety-critical / recall-prone):**
> - Car seats and car seat bases
> - Breast pumps and pump parts (hygiene/medical)
> - Crib sleep positioners, inclined sleepers, and similar sleep products subject to federal bans
> - Infant helmets and other prescribed medical devices
>
> **Recalled products:** Any item subject to a current CPSC recall. Listings are automatically
> screened against the CPSC recall database and blocked if a match is found.
>
> **Age/era limits:** Toys must be manufactured 1978 or later; cribs and nursery furniture 2011
> or later, to comply with federal lead-content (CPSIA) and crib-safety standards.
>
> **General:** No counterfeit, stolen, hazardous, or non-baby items; no items that violate any law.
>
> **Before you meet:** The Village does not inspect, test, or warrant any item. Buyers should
> check the item and the CPSC recall list (cpsc.gov/Recalls) before purchase. Report anything
> unsafe or against this policy using the ⚑ Report option on the listing.

---

## 3. Moderation coverage — the gap that must close before launch

**Current state (documented risk, `project_gear_takedown_sla_unassigned`):** the founder is the
**sole** named takedown moderator (`moderator@villieapp.com`, UUID
`eb2c4fc7-d5be-47b9-bafb-eb706b141d60`), with a **24-hour takedown SLA**. This is only defensible
pre-launch because the user base is ~zero and the auto-withdraw cron fires for
`recalled_item` / `harassment_or_abuse` regardless of human acknowledgement.

**Hard triggers to add a second moderator + block launch until done:**
- Hospital-partner pilot goes live, OR
- > 25 active listings, OR
- First real-user report, OR
- Planned founder absence > 12h.

**Action when a second moderator exists:** add their account UUID to
`GEAR_MODERATOR_EXTERNAL_IDS` (see `docs/V4_GEAR_TAKEDOWN_SOP.md` §3). *Give me the UUID and I'll
wire it in a one-line change.* The person must still be designated + briefed by you.

---

## 4. Open items before launch (attorney)
- [ ] **P1** — Gear Marketplace Terms Addendum: real text (the in-app Addendum is currently a
      placeholder; every `gear_legal_acceptances` row is legally hollow until counsel writes it +
      we bump `LEGAL_DOC_VERSION`). *This is the single biggest gear legal gap.*
- [ ] **P2** — Approve this Prohibited Items Policy for publication (in-app + web).
- [ ] FDUTPA review of all in-app gear copy.
- [ ] Insurance: confirm GL + E&O covers marketplace activity.
- [ ] Designate + brief a second takedown moderator (then send me the UUID).
