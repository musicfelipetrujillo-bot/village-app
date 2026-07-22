# Villie Agent Roster

A curated set of specialist subagents drawn from [agency-agents](https://github.com/msitarzewski/agency-agents),
adopted for Villie's real workstreams. This doc is the **map**: which agent to pull for what, the phrase that
invokes it, and where it overlaps something we already have (so we don't double-invoke).

## How this works

- **Installed at:** `.claude/agents/` (project-scoped to this workspace — *not* your global `~/.claude/agents/`,
  so it doesn't pollute other projects). 26 agents.
- **Source format:** each file is an agency-agents persona. We normalized only the `name:` field to a kebab slug
  so it's callable as a `subagent_type`; the `description`, personality (`vibe`/`emoji`/`color`), and body are
  preserved verbatim.
- **To invoke:** ask for it by name in-session — e.g. *"Use the **data-privacy-officer** to review the Milk
  social-links change"* — or reference the trigger phrases below. These agents are on-demand specialists, not
  always-on.
- **Curation principle:** we adopted ~26 of 232. The rest were skipped either as irrelevant (game-dev, GIS,
  XR, blockchain, China-market) or as **duplicates of skills already installed** — see the overlap column.

## ⚠️ Don't double-invoke

Villie's Claude setup is already loaded with strong tooling. Prefer the existing skill/agent for these; the
agency-agents equivalents were deliberately **not** installed:

| Need | Use the installed thing (not agency-agents) |
|---|---|
| Code review | `superpowers:requesting-code-review`, `feature-dev:code-reviewer`, `/code-review` |
| Debugging | `superpowers:systematic-debugging` |
| Architecture / feature design | `feature-dev:code-architect`, `superpowers:brainstorming` → `writing-plans` |
| UI / visual design | `impeccable`, `ui-ux-pro-max`, `taste-skill:*`, `brandkit`, `design:*` |
| Product specs / roadmap / metrics | `product-management:*` |
| Marketing campaigns / SEO / content | `marketing:*` |
| MCP building | `anthropic-skills:mcp-builder` |
| Accessibility audit | `design:accessibility-review` |
| Security review of a diff | `/security-review` |

The roster below is the **gap** those don't cover: compliance/health/legal/privacy, and the business-side
go-to-market motion.

---

## Compliance · Health · Legal · Privacy · Security

Villie's highest-risk surface: health data, milk-sharing PII, a gear marketplace, cash-only posture,
EN/ES clinical-grade copy, and a solo-founder moderation SLA.

| Agent | When to invoke | Trigger | Villie workstream | Overlaps |
|---|---|---|---|---|
| `healthcare-marketing-compliance` | Before publishing any health claim, Manual content, or discharge copy | "check this for health-claim compliance" | Manual, hospital GTM, discharge copy | — (unique) |
| `data-privacy-officer` | Any new PII surface, consent flow, privacy-policy edit | "privacy review this data flow" | Milk social links, health data, pre-launch privacy policy | partial: `/security-review` |
| `security-compliance-auditor` | The Risk & Compliance gate before Milk (V2) and Gear (V4) changes | "run a compliance audit on…" | Milk, Gear, Risk & Compliance doc | — |
| `legal-document-review` | Drafting/reviewing legal text — Gear Addendum, cash-only disclosures, ToS | "review this legal language" | Gear Legal Addendum, Milk disclaimers | — |
| `support-legal-compliance-checker` | Lightweight recurring compliance spot-check of support/user-facing flows | "compliance spot-check" | Support, moderation | dup-ish of the auditor; use for quick passes |
| `healthcare-customer-service` | Support/reply copy that must stay clinician-handoff-grade & non-diagnostic | "draft support reply, clinical tone" | Support, Emergency hub tone | — |
| `security-appsec-engineer` | App/auth/data-layer security review (OAuth, Supabase RLS, edge fns) | "appsec review this" | OAuth, Supabase, edge functions | partial: `/security-review` |
| `security-architect` | Designing a new security-sensitive subsystem end-to-end | "design the security model for…" | New PII/payment subsystems | partial: `feature-dev:code-architect` |

## Fundraise & Finance

Seed stage — the raise, the model, non-dilutive money.

| Agent | When to invoke | Trigger | Villie workstream | Overlaps |
|---|---|---|---|---|
| `finance-fpa-analyst` | Building/updating the financial model behind the raise | "build the FP&A model for…" | Seed deck ($1.5M / 25k moms) | — |
| `chief-financial-officer` | Pressure-test unit economics, pricing, runway | "CFO gut-check these numbers" | Boxes/Boost/Pro monetization, deck | — |
| `finance-investment-researcher` | Mapping femtech/maternal-health investors to target | "research investors for…" | Seed raise | — |
| `grant-writer` | Non-dilutive: hospital/public-health/maternal-health grants | "draft a grant application for…" | Hospital GTM, non-dilutive funding | — |

## Hospital GTM & Partnerships

The primary distribution motion: bundled into mom+baby discharge.

| Agent | When to invoke | Trigger | Villie workstream | Overlaps |
|---|---|---|---|---|
| `sales-proposal-strategist` | Writing a hospital pilot proposal | "draft a hospital pilot proposal" | Hospital discharge distribution | — |
| `sales-deal-strategist` | Structuring/closing a hospital partnership | "strategize this hospital deal" | Hospital partnerships | — |
| `sales-account-strategist` | Managing/expanding an existing hospital account | "account plan for [hospital]" | Post-signature partner success | — |
| `change-management-consultant` | Getting nurses to actually hand out the app at discharge | "adoption plan for clinician handoff" | Discharge workflow adoption | — |

## Launch Marketing & Audience

Reach the Gen Z rebrand audience + EN/ES.

| Agent | When to invoke | Trigger | Villie workstream | Overlaps |
|---|---|---|---|---|
| `marketing-app-store-optimizer` | ASO for the App Store listing | "optimize the App Store listing" | ASO, launch | partial: `marketing:seo-audit` |
| `marketing-pr-communications-manager` | Launch PR, hospital-partner announcements | "draft the launch PR plan" | Launch, partner announcements | partial: `marketing:*` |
| `marketing-tiktok-strategist` | TikTok content strategy for the Gen Z audience | "tiktok strategy for…" | V10 Gen Z audience | partial: `marketing:*` |
| `marketing-reddit-community-builder` | Organic presence in mom/parenting subreddits | "reddit community plan" | Community growth | — |
| `cultural-intelligence-strategist` | EN/ES nuance, Latina-audience resonance, localization beyond translation | "cultural review for ES audience" | i18n EN/ES, discharge copy | — |

## Ops & Strategy

Solo-founder force-multipliers.

| Agent | When to invoke | Trigger | Villie workstream | Overlaps |
|---|---|---|---|---|
| `chief-of-staff` | Keeping rollout threads coherent; routing/prioritizing across functions | "chief-of-staff: help me sequence…" | Cross-workstream ops | partial: `product-management:*` |
| `business-strategist` | Strategic framing of a GTM or product bet | "strategize the go-to-market for…" | GTM, positioning | — |
| `strategy-duel-agent` | Stress-test a decision — it argues *against* your plan | "duel my plan: [plan]" | High-stakes decisions | — |
| `customer-success-manager` | Post-launch retention, onboarding, churn playbooks | "design the CS/retention plan" | Retention, activation | — |
| `pricing-analyst` | Monetization tuning across Boxes / Boost / Pro | "pricing analysis for…" | Monetization | overlaps `chief-financial-officer` — use for pricing specifics |

---

## Cadence (LIVE — wired 2026-07-07)

The "monitor" half. Now running as local scheduled tasks (they fire while the Claude app is open; if it was
closed when due, they run on next launch). Each run is **read-only** and writes a dated report to
`village-app/docs/audits/` — it never modifies code, commits, or pushes.

| Scheduled task ID | Agent | Schedule | Report | Watches |
|---|---|---|---|---|
| `villie-compliance-audit-weekly` | `security-compliance-auditor` | Mondays ~9am | `docs/audits/compliance-YYYY-MM-DD.md` | Drift against the Risk & Compliance gate across Milk/Gear + health content + EN/ES parity |
| `villie-appsec-review-weekly` | `security-appsec-engineer` | Wednesdays ~9am | `docs/audits/appsec-YYYY-MM-DD.md` | Auth/RLS/edge-function/OAuth security posture |
| `villie-privacy-review-monthly` | `data-privacy-officer` | 1st of month ~9am | `docs/audits/privacy-YYYY-MM-DD.md` | New PII surfaces, consent flows, policy accuracy |
| `villie-buzz-discovery-weekly` | `last30days-skill` (no agent persona — direct skill invocation) | Mondays ~8am | `docs/audits/buzz-discovery-YYYY-MM-DD.md` | Candidate trending topics for The Buzz — discovery only, no DB write |
| `villie-buzz-sourcing-ingest-weekly` | none — direct WebSearch/WebFetch + trending-ingest POST | Mondays ~8:30am | (posts directly to trending_items via trending-ingest; no markdown report) | Allowlist-constrained sourcing + ingest for The Buzz, holds TRENDING_INGEST_SECRET |

**Note:** the privacy review is *also* meant to be run manually before any launch — the monthly cadence does
not replace the pre-launch pass. Manage/pause/edit these from the app's **Scheduled** sidebar, or update them
via the `update_scheduled_task` tool by ID.

**Note on the two Buzz agents (added 2026-07-22):** unlike the three read-only audit agents above, `villie-buzz-sourcing-ingest-weekly` DOES write — it POSTs to `trending-ingest`, which inserts draft/in_review rows into `trending_items`. It never publishes anything itself; every medical-claim item still waits on a human via `ClinicalReviewScreen`, and every insert is allowlist-checked at the DB layer regardless of what the agent's research believed it verified. See `docs/THE_BUZZ_TRENDING.md` for the full pipeline.

---

## Maintenance

- **Adding an agent:** copy the file from agency-agents into `.claude/agents/`, normalize `name:` to a kebab
  slug, add a row here. Standby candidates not yet installed: `minimal-change-engineer`,
  `incident-response-commander`, `testing-reality-checker`, `product-feedback-synthesizer`,
  `marketing-email-strategist`.
- **Retiring an agent:** delete the file, strike the row. If usage shows an agent never gets pulled, retire it —
  a smaller roster is a sharper roster.
- **Keep the overlap table honest:** if a new first-party skill lands that covers a roster agent's job, move that
  agent to the "don't double-invoke" list.
