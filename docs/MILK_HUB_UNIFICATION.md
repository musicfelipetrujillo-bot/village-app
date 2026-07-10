# Milk Hub Unification — Vault + Connect → one ecosystem

**Status:** plan approved 2026-07-10. Source: `Villie_Milk_Hub_Strategy.pdf`.
**Not yet built.** Build begins only after the two foundation PRs land (see "Build order").

## The bet
Don't ship Milk Vault and Milk Connect as two products. Fuse them into one **Milk Hub**
where a single bag is the atom and its `status` decides where it appears. Inventory
tracking is useful day one (solves marketplace cold-start); selling/donating becomes a
natural extension once a mom has surplus. "Operating system for breastfeeding," not just
a marketplace.

## Target architecture
`milk_vault_bags` is the single source of truth. Status is the switch:

```
milk_vault_bags.status:  stored → reserved → available → sold / donated / used
                         └──── My Stash (private) ────┘  └── Milk Connect (public) ──┘
```

Two surfaces, one inventory. "List for sale" = flip bags to `available`; they surface in
Connect. No re-entry. The Vault status enum already matches the strategy doc's model.

## Approved decisions (2026-07-10)
1. **Seller identity:** a stash-only mom who decides to sell/donate gets a
   `milk_donor_profiles` row auto-created — that's the public, geo'd, verifiable identity
   Connect already needs. No second identity concept.
2. **Collapse listings:** retire `milk_vault_listings` as a standalone table. Marketplace
   visibility is driven by `bag.status='available'` + the existing Connect
   `milk_listings` / donor-discovery surface. One listing concept.
3. **Cash-only holds:** buy/sell/donate stays **connector-only, off-platform cash,
   estimate-only** — no in-app payment. Villie connects; it is not a party to the
   transaction. Hard compliance line (see `docs/source/Village_Risk_and_Compliance.md`,
   memory `project_milk_cash_only.md`). Payout/value figures remain "for planning only."
4. **Naming / IA:** adopt **"Milk Hub"** as the umbrella. Merge today's separate
   `MilkConnectHomeScreen` + Vault dashboard into one hub home with **My Stash /
   Marketplace** surfaces. Onboarding becomes **multi-select** (Track / Buy / Sell /
   Donate).

## Gap analysis — exists vs. needed
| Concept | Milk Connect (V2, live) | Milk Vault (V6, PR #3) | Delta |
|---|---|---|---|
| Bag (atom) | none — donor-centric | `milk_vault_bags` w/ status model | make Connect read from bags |
| Seller identity + geo | `milk_donor_profiles` (name, lat/lng, verified, badges) | `user_id` only, no geo/identity | auto-create donor profile on first sell/donate |
| The listing | `milk_listings` (oz, price, pickup/ship) — buyers search this | `milk_vault_listings` — estimate-only, private, unpublished | collapse to one (decision 2) |
| Discovery | `search_donors_near` (geo + trust badge) | none | point discovery at available inventory |
| Messaging / cash handoff | threads + SafeMilkHandoff (cash-only) | none | reuse Connect's |
| Onboarding | "Become a donor" | mode picker: stash OR marketplace | multi-select intent |
| Value dashboard | none | freezer oz, market value, lifetime logged | add formula savings, lifetime value, families helped |

One-liner: Vault has *inventory + stash*; Connect has *marketplace + identity + discovery
+ messaging*. Unifying = let an `available` bag flow into a Connect listing tied to the
mom's donor profile, and collapse the two listing tables into one.

## Build order (dependency-driven)
**Step 0 — land the foundation first.** The unification sits on top of both open PRs.
Merge and deploy before starting:
- **PR #1** — Retire Milk Stripe Connect (migration `098`; 5 edge fns already deleted).
- **PR #3** — Milk Vault V6 (migration `099`; deploy `milk-vault-scan`).
- Apply migrations `098` → `099` in the Supabase dashboard.

Building the Hub before these are in `main` means basing on a branch that shifts when they
merge → avoidable conflicts.

**Then — one branch + one PR per phase, each off updated `main`:**
| Phase | Branch | New migration | Depends on |
|---|---|---|---|
| 1 — Unified shell + multi-select onboarding | `feat/milk-hub-shell` | none (IA/nav/copy) | Step 0 |
| 2 — Bag→marketplace bridge (core) | `feat/milk-hub-bridge` | `100` (collapse `milk_vault_listings`, bags→donor profile, status sync) | Phase 1 |
| 3 — Value dashboard | `feat/milk-hub-value` | `101` if needed | Phase 1 |
| 4 — Marketplace depth (verified / maps / shipping) | `feat/milk-hub-depth` | as needed | Phase 2 |

Rationale: each phase stays reviewable and Phase 1 (the shell) can ship and get real usage
while Phase 2's schema work bakes — which is the whole inventory-first point.

## Value dashboard targets (Phase 3)
Current ounces stored · estimated market value · **formula cost savings (new)** · lifetime
ounces pumped · **lifetime value created (new)** · **milk donated + families helped (new)**.

## Compliance guardrails (thread through every phase)
- Connector-only copy; off-platform cash; no in-app payment; estimate-only payout.
- Milk-safety + not-a-party disclaimers on every marketplace surface (reuse
  `SafeMilkHandoffModal` + Vault `VAULT_LEGAL_COPY`).
- Any "buy/sell" language reviewed against Risk & Compliance before shipping.

## Related
- Memory: `project_milk_vault.md`, `project_milk_cash_only.md`, `feedback_risk_compliance_scope.md`.
- PRs: #1 (retire Stripe), #3 (Milk Vault V6).
