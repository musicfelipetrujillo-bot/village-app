# Care — clinical experts + hands-on help (was "Specialists")

**Status:** direction approved 2026-07-11. Rename shipped (OTA `dd6363b0`). The
non-clinical "Extra hands" tier is **spec'd here, not yet built.**
**Source of the pivot:** most postpartum moms don't need another appointment —
they need an extra pair of hands. "Specialists" quietly excluded exactly that.

## The bet
One **Care** tab holds two tiers of help under one roof, each with its own trust
signal. Clinical care is what we already had; **extra hands (nannies, night
nurses, postpartum doulas, mother's helpers) is the new supply** — higher demand,
higher liability, and the reason to broaden the name.

```
Care
├─ Clinical care      → NPI-verified        (OB, lactation/IBCLC, pelvic-floor PT,
│                                             PPD therapist, dietitian, sleep coach)
└─ Extra hands        → Background-checked   (night nurse, postpartum doula, nanny,
                                              mother's helper, sitter)
```

## Naming — DECIDED
"Specialists"/"Experts" → **Care** everywhere (Home tile, Village tile, bottom tab).
Shipped 2026-07-11. Route name stays `Experts` in code (no nav churn). The screen
already read *"Find your care team,"* so the umbrella fits.

## Two-tier trust model (the core idea)
A mom must instantly read *how* someone is trusted:
- **Clinical → `NPI-verified`** (sage check). Reuses the existing `npi-verify`
  edge fn + `admin-approve-specialist` flow. Licensed, so a public registry exists.
- **Extra hands → `Background-checked`** (rose shield). No license exists, so trust
  is built from: government ID + a criminal background check + references +
  experience + on-platform reviews.
- **"Checked only" filter** at the top of Care — the single strongest safety lever,
  one tap. Parents will overwhelmingly self-select checked providers, pulling the
  whole market toward safety without us hard-blocking anyone.

## Onboarding — it forks
| | Clinical | Extra hands |
|---|---|---|
| Identity | NPI number → `npi-verify` | Gov ID upload |
| Vetting | NPI registry + admin approve | Background check (Checkr / Certn) + references |
| Profile | specialty, credentials, insurance | services, experience, availability, hourly rate |
| Badge | `NPI-verified` | `Background-checked` (+ optional references-verified) |
| Invite | Option C invite-only (existing, see `project_specialist_signin_path`) | same invite-only shell, non-clinical questionnaire |

Reuse the **Option C invite-only** shell (memory `project_specialist_invite_runbook`)
for both — issue invites, provider onboards. The *questionnaire* + *badge logic*
differ per tier. Model this like the **milk-donor trust badge** (a tiered,
verifiable badge a provider earns), not like the clinical NPI-only path.

## Background checks — the crux (recommended posture)
Childcare is a **materially higher liability surface** than milk or gear — a helper
harming a child is catastrophic and lawsuit-grade. So:
1. **Don't hard-require** a check to list (kills supply cold-start), **but** make
   **`Background-checked` a prominent badge + filter**. Un-checked providers show
   plainly un-badged.
2. **Provider pays** for their own check (~$30–50 via Checkr/Certn) as the cost of
   earning the badge — keeps Villie's connector-only, cost-light posture.
   **Subsidize the first cohort** if needed to seed supply.
3. **Re-check cadence** (annual) + badge expiry, so "background-checked" stays true.
4. Villie **surfaces** the check result as a badge; it is **not** the employer and
   does not place workers.

## Compliance posture (thread through every phase)
- **Connector-only, arranged-directly, cash/off-platform** (same line as Milk/Gear).
  Copy on every Care surface: *"Villie verifies credentials + background checks and
  connects you — care is arranged directly between you and the provider."*
- ⚠️ **Higher-liability gate:** before ANY "Extra hands" build ships, run against
  `docs/source/Village_Risk_and_Compliance.md` + get an **attorney note** — same
  launch gate Milk/Gear had, but weightier ("we connected you to the person who
  watched your baby" > "we connected you to milk"). Questions counsel must answer:
  can we display a background-check badge without becoming a "consumer reporting"
  or "employment agency" under state law? What disclaimer + FCRA-adjacent consent
  does Checkr/Certn integration require? Negligent-referral exposure?
- Keep clinical medical claims out of the non-clinical tier (a nanny is not care advice).

## Build order (dependency-driven)
| Phase | Scope | Notes |
|---|---|---|
| 0 — Rename ✅ | Care labels across app | shipped 2026-07-11 |
| 1 — Data model | non-clinical provider type + `Background-checked` badge fields; RLS | one migration; mirrors milk trust-badge shape |
| 2 — Directory UI | two-tier Care browse (Clinical / Extra hands), badges, "checked only" filter, category chips | the approved mockup |
| 3 — Onboarding fork | non-clinical invite → ID + services + availability + rate questionnaire | reuse Option C invite shell |
| 4 — Background-check integration | Checkr/Certn edge fn, provider-pays flow, badge issuance + expiry | **attorney-gated** |
| 5 — Booking/connect | message-to-arrange (cash/direct), reviews | reuse specialist messaging |

**Do Phase 4 (real checks) only after the attorney note.** Phases 1–3 can build the
shell + directory with a manually-granted badge for a pilot cohort.

## Open decisions (need founder / counsel)
- Exact non-clinical taxonomy (night nurse vs. postpartum doula vs. nanny vs. sitter).
- Background-check vendor (Checkr vs. Certn vs. Yardstik) + price + who-pays final call.
- Hard-require check for "Extra hands," or badge-only? (recommend badge-only.)
- Does "Care" also absorb the current Experts screen wholesale, or is it a new home?

## Related
- Rename commit `f3c0dd7`. Existing infra: `npi-verify`, `admin-approve-specialist`,
  `specialist_invites` (Option C invite-only), milk-donor trust-badge pattern.
- Memory: `project_specialist_signin_path`, `project_specialist_invite_runbook`,
  `feedback_risk_compliance_scope`.
