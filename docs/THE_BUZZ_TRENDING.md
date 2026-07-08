# The Buzz — Trending in Maternal Health (Design Spec)

**Status:** Design approved 2026-07-08 · not yet implemented
**Author:** brainstormed with Claude (roster feature)
**Working name:** "The Buzz" (bee brand + "buzz" = trending chatter — the name sets a *conversation* frame, not a medical-directive frame)

---

## 1. Goal & posture

Give moms real, current value — **not** a mini-CDC feed. The Buzz is an **editorial, conversational** surface: *"here's what the village is talking about this week, here's what's actually known, here's what to ask your provider."*

The framing is deliberate and is itself the primary risk control:

- **News/conversation, not clinical guidance.** We never issue guidelines ("the new rule is X"). We report what's being discussed and ground it with credible context. Commentary-with-citations is far more defensible than quasi-guidelines, and fits the V10 Gen Z brand voice.
- **Public sources only — no hospital/clinical data.** The pipeline ingests, cites, and implies **only public, published, third-party information**. It never touches hospital, patient, or clinical-record data. That murky water is simply not in scope.
- **"Proven" and "trending" are two paired sources.** Each item carries both a *trend signal* (what's buzzing) and a *grounding* (what's known), from different sources — see §2.

### Non-goals (YAGNI — deferred to v2)
- Per-stage personalization (one global issue for everyone at MVP).
- A live/real-time social feed.
- User comments / sharing.
- Auto-publishing of **any** myth/clarification content.
- Fully-headless always-on automation (MVP is founder-in-the-loop weekly).

---

## 2. Editorial model

A weekly **issue** = **3 curated trend items + 1 clarification ("myth vs fact") item**. Global, EN + ES (clinician-grade ES per the i18n standard).

**Every item is built from two sources, paired:**

| Half | Question it answers | Sources |
|---|---|---|
| **Trend signal** | What are moms talking about right now? | `last30days` across mom communities + vetted journalism (AP/Reuters health, NYT/WaPo parenting, reputable maternal outlets) |
| **Grounding / evidence** | What is actually known about it? | Health authorities + journals (ACOG, AAP, CDC, WHO, NIH, La Leche League, peer-reviewed) |

**Item template (how it renders):** `trending topic → what's actually known (context, cited) → questions for your provider`. Never a directive.

The clarification item is the same shape: *"everyone's posting about X — here's what's actually known."*

**Standing disclaimer (editorial, not clinical):** *"This is what's being talked about — not medical advice. Always check with your provider."*

---

## 3. Data model (new migration ~096)

`last30days` is a **research/draft engine feeding a review queue** — it never writes published content.

### `trending_issues`
One row per weekly issue.
- `id`, `issue_date` (week anchor), `status` (`draft` | `in_review` | `published` | `archived`), `published_at`, `title`, `intro`, `created_at`, `updated_at`.

### `trending_items`
Belongs to an issue.
- `id`, `issue_id` (FK), `kind` (`news` | `myth_buster`), `rank`.
- `status` (`draft` | `agent_cleared` | `approved` | `rejected`).
- **Two sources:** `trend_source_name` / `trend_source_url`, `evidence_source_name` / `evidence_source_url`.
- **Localized content:** `title_en/es`, `summary_en/es`; for `myth_buster` kind also `myth_claim_en/es` + `fact_en/es`; `ask_provider_en/es` (the "questions for your provider" line).
- **Audit:** `reviewed_by` (FK users), `reviewed_at`, `review_notes`.

### RLS & pipeline reuse
- Public reads **published issues + approved items only**. Drafts are reviewer/service-role only.
- Reuses existing infra: `is_clinical_reviewer()`, `approve_content_row(p_table, p_id, p_notes)`, `list_pending_review()`.
- **Source-allowlist enforced at insert:** a DB-side check (or trigger) rejects any item whose `trend_source_url` / `evidence_source_url` domain is not on the allowlist table (`trending_source_allowlist`: domain, tier `trend`|`evidence`).

---

## 4. Pipeline (research → review → publish → archive)

1. **Research (weekly).** A `last30days`-backed agent run, domain-allowlisted, drafts candidate items into `trending_items` as `draft` — trend half + evidence half + localized copy. *MVP: founder-triggered weekly* (a human reviews the clarification item every week regardless, so a fragile always-on cron buys little; full automation is a v2 lever). Reuses the scheduled-agent pattern already established for the weekly audits.
2. **Two-tier gate.**
   - **News items** → automated `healthcare-marketing-compliance` agent pass → `agent_cleared`. `cultural-intelligence-strategist` assists the ES pass.
   - **Clarification item** → stays `in_review` until a human `is_clinical_reviewer` approves via `approve_content_row`. **Human sign-off is mandatory**; `reviewed_by/at` stored for chain-of-custody.
3. **Publish.** When the issue has its approved items, it flips to `published` → surfaces the Home card + optional push (respecting notif prefs via a new `trending` key, default on, suppressible; routed through `push-notify` with the pref gate).
4. **Archive.** Published issues list into the Manual archive.

---

## 5. Placement & UI

- **Home:** `home-feed-curator` emits a **"The Buzz — this week"** card when a published issue exists for the current week → taps into `TheBuzzScreen`.
- **`TheBuzzScreen`:** news items as cards showing the trend source + grounded context + tappable evidence link + "ask your provider" line; the clarification item rendered as a distinct **"myth vs fact"** card. Standing editorial disclaimer at the top.
- **Manual archive:** past published issues list into the Manual → `TheBuzzScreen` in archive mode.
- EN/ES driven by the item's localized fields.

---

## 6. Compliance guardrails (the part a hospital partner scrutinizes)

- **Source allowlist** enforced *both* in the research prompt *and* validated at DB insert (reject off-allowlist domains). Trend tier allows vetted journalism; evidence tier restricted to authorities/journals.
- **Public sources only** — never hospital/patient/clinical-record data.
- Every item cites **both** sources with live links.
- **Editorial disclaimer** on every surface; framing is "conversation," never "directive."
- Clarification item: never restates a claim without the grounding in the same card; no sensational framing; **mandatory human clinical sign-off** with audit trail.
- **Audit events** for publish + each review decision (mirror the `admin_audit_log` / analytics-events pattern used by Gear/Milk compliance).

---

## 7. Cadence & MVP scope

- **Weekly** issue, **global** (not personalized), **3 news + 1 clarification**, **EN + ES**.
- Founder-in-the-loop weekly: research draft → two-tier review → publish.

---

## 8. Build sequence (proposed phases)

- **B1 — Data + gate:** migration 096 (`trending_issues`, `trending_items`, `trending_source_allowlist`, RLS, insert-time allowlist check), wired to existing review RPCs.
- **B2 — Research draft path:** the `last30days`-backed weekly research step that drafts items (+ install `last30days-skill` as a backend tool), including the `healthcare-marketing-compliance` auto-pass for news.
- **B3 — Review surface:** a lightweight in-app (or ops) review screen for the clinical reviewer to approve/reject the clarification item and edit copy.
- **B4 — Publish + Home card:** issue publish flip, `home-feed-curator` card, `TheBuzzScreen`, notif pref + push.
- **B5 — Manual archive + ES polish + analytics/audit.**

Each phase is independently shippable; B1–B4 is the thinnest end-to-end slice.

---

## 9. Open questions (resolve during planning)

- Exact allowlist membership (which journalism outlets qualify as "vetted" for the trend tier).
- Whether the review surface is in-app (reuses mobile) or an ops/web tool.
- Push cadence: notify on every issue vs silent Home-card refresh.
- Final section name + all copy → V10 brand-voice pass (not an architecture decision).
