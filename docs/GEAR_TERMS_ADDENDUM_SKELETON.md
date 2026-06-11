# Gear Marketplace Terms Addendum — DRAFT SKELETON for counsel

**Status:** SKELETON ONLY. Not legal advice; not final text. Prepared 2026-06-10 to give
counsel a structure grounded in the shipped implementation. **`[COUNSEL: …]`** marks every
spot where a lawyer must write/decide. **P1 gate** — until counsel finalizes this and we swap
it in, every `gear_legal_acceptances` row is legally hollow.

## How this plugs in (engineering)
- The in-app `GearLegalDisclosureModal` presents this Addendum, scroll-gated, with **three
  explicit acknowledgments**: `not_a_seller`, `no_recalls`, `own_risk`. The section structure
  below maps to those three pillars so the acks line up with the text the user accepted.
- Versioning: text is pinned by **`GEAR_LEGAL_DOC_VERSION`**. When counsel's final copy lands,
  swap the Addendum body **and** bump the version **in one atomic commit** — the existing
  version-gate then re-prompts every user for fresh acceptance on their next gear interaction.
- Acceptances are persisted (user, version, timestamp) for the audit trail.

---

## §0. Preamble & scope  `[COUNSEL]`
- One-paragraph: this Addendum supplements the main Terms of Service and governs use of the
  Gear marketplace specifically; on conflict, `[COUNSEL: which controls]`.
- Effective date + version. Define "Listing," "Seller," "Buyer," "Item."

## §1. The Village is a venue, not the seller  → ack `not_a_seller`
- Plain-language draft: *"The Village is a neutral venue that lets parents connect to buy, sell,
  or give away used baby gear. The Village is **not** the seller, manufacturer, distributor, or
  shipper of any item. All transactions are solely between Buyer and Seller."*
- `[COUNSEL: Section 230 / intermediary framing; disclaim agency; no endorsement of listings.]`

## §2. No inspection, testing, or warranty; recall screening is best-effort  → ack `no_recalls`
- Draft: *"The Village does not inspect, test, repair, or warrant any item. Items are sold
  as-is. The Village screens listings against the U.S. CPSC recall database as a courtesy, but
  this screening is automated, **not guaranteed**, and is not a substitute for the Buyer's own
  due diligence (cpsc.gov/Recalls)."*
- `[COUNSEL: disclaimer of warranties (merchantability/fitness); UCC posture; the exact
  "best-effort, no guarantee" wording for the CPSC screen so it can't be read as a safety
  warranty.]`

## §3. Assumption of risk — in-person meetups & item safety  → ack `own_risk`
- Draft: *"Buyer and Seller arrange and complete exchanges off-platform and in person. You
  assume all risk of meeting, payment, and item condition/safety. Follow the in-app safe-meeting
  guidance."*
- `[COUNSEL: assumption-of-risk + release/waiver language; reference the SafeMeetingGuide; any
  required jurisdiction carve-outs.]`

## §4. Payments are off-platform (cash / P2P only)
- Draft: *"The Village does not process payments. All payment is arranged directly between Buyer
  and Seller (e.g., cash or peer-to-peer apps). The Village provides **no** payment processing,
  escrow, buyer protection, refunds, chargebacks, or dispute resolution for payments."*
- `[COUNSEL: confirm this keeps us clear of money-transmitter classification (ties to the FinCEN/
  FL review); ensure no implied guarantee of any transaction.]`

## §5. Prohibited & restricted items
- Reference + incorporate `GEAR_CPSC_PROHIBITED_ITEMS_POLICY.md` (allowlist categories; banned:
  car seats, breast pumps, sleep positioners/inclined sleepers, helmets; recalled items; toy
  year ≥1978 / crib year ≥2011; no counterfeit/stolen/hazardous/illegal).
- `[COUNSEL: incorporate-by-reference vs inline; right to remove + enforce.]`

## §6. Seller obligations  /  §7. Buyer obligations
- Seller: own the item, describe accurately, not knowingly list recalled/banned/unsafe items,
  comply with law. Buyer: inspect before buying, check recalls, judgment on safety.
- `[COUNSEL: representations & warranties by each party; consequences of breach.]`

## §8. Reporting & takedown
- Draft: *"Report listings via the in-app ⚑ Report. The Village reviews reports and may remove
  listings; recalled items and abuse reports are subject to automated and human takedown
  (target 24 hours)."* `[COUNSEL: DMCA-style process? retention of removed-listing records.]`

## §9. Disclaimers & limitation of liability  `[COUNSEL — core]`
- `[COUNSEL: full disclaimer of warranties; limitation/cap of liability; exclusion of
  consequential damages; "as-is/as-available."]`

## §10. Indemnification  `[COUNSEL]`
## §11. Dispute resolution between users  `[COUNSEL: The Village not a party; arbitration/venue.]`
## §12. Changes to this Addendum  `[COUNSEL]`
- Note the mechanism: material changes bump the version and re-prompt acceptance in-app.

## §13. Acceptance
- Draft: *"By tapping Accept, you confirm you have read and agree to this Addendum, including
  that The Village is not the seller (§1), screening is not a warranty (§2), and you assume the
  risk of off-platform, in-person transactions (§3)."*

---

## Open items
- [ ] Counsel drafts/edits all `[COUNSEL]` sections → returns final body text.
- [ ] Engineering swaps Addendum body + bumps `GEAR_LEGAL_DOC_VERSION` (one atomic commit;
      auto re-prompts all users).
- [ ] Confirm §4 against the FinCEN / FL money-transmitter review (separate gate).
- [ ] Confirm §5 incorporation matches the published Prohibited Items Policy.
