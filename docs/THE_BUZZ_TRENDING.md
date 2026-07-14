# The Buzz — Trending in Maternal Health (Design Spec)

**Status:** Design approved 2026-07-08 · operational gaps resolved 2026-07-14 · moving to implementation planning
**Author:** brainstormed with Claude (roster feature)
**Working name:** "The Buzz" (bee brand + "buzz" = trending chatter — the name sets a *conversation* frame, not a medical-directive frame)

**2026-07-14 addendum:** four things unresolved in the original spec are settled below and threaded through the doc: (1) the actual research mechanism is a scheduled Claude Code agent, with `last30days-skill` (`mvanhorn/last30days-skill`, real + verified — see §4) wired in as a discovery-only input, never a citation source; (2) the review surface is the existing `ClinicalReviewScreen`, extended — §3/§4; (3) copy needs the V10 Gen Z voice, and the mandatory-human-review gate is keyed on medical-claim content rather than item kind — §2/§4; (4) migration number corrected to 104 — §3.

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
- Auto-publishing of **any medical-claim** content (`is_medical_claim=true`, §3) — always mandatory human sign-off, whether it's a news item or the myth-buster. *(Non-medical myth-busters — e.g. debunking a cost/product claim with nothing health-related in it — can auto-clear same as non-medical news items; see §4.)*
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

### Voice (2026-07-14)

All Buzz copy — item titles, summaries, the "ask your provider" line — is written in the **V10 Gen Z voice** (lowercase, casual, group-chat tone; see `docs/V10_GENZ_REBRAND.md`): reads like a friend texting you the tea, not a health-article headline. **Exception:** the standing disclaimer stays sober and clearly legible as a disclaimer — same carve-out V10 already makes for crisis/legal copy elsewhere in the app. This is copy-only; no schema impact.

---

## 3. Data model (migration 104 — corrected 2026-07-14, was `~096`)

The research step is a **scheduled agent feeding a review queue** — it never writes published content directly (see §4).

### `trending_issues`
One row per weekly issue.
- `id`, `issue_date` (week anchor), `status` (`draft` | `in_review` | `published` | `archived`), `published_at`, `title`, `intro`, `created_at`, `updated_at`.

### `trending_items`
Belongs to an issue.
- `id`, `issue_id` (FK), `kind` (`news` | `myth_buster`), `rank`.
- `status` (`draft` | `agent_cleared` | `approved` | `rejected`).
- **`is_medical_claim` BOOLEAN NOT NULL DEFAULT TRUE** (added 2026-07-14). Drives the review gate in §4 — replaces "kind determines the gate" with "does this item make a health claim." Defaults TRUE (fail-safe): the research agent only sets it FALSE when an item is purely cultural/product trend with no health content. A human reviewer can flip it back to TRUE if the agent mis-tagged something; there's no path for a human to flip TRUE→FALSE from inside the review UI (avoids a reviewer accidentally waving through medical content — if it's mistagged FALSE and shouldn't be, fix it in the draft, not in review).
- **Two sources:** `trend_source_name` / `trend_source_url`, `evidence_source_name` / `evidence_source_url`.
- **Localized content:** `title_en/es`, `summary_en/es`; for `myth_buster` kind also `myth_claim_en/es` + `fact_en/es`; `ask_provider_en/es` (the "questions for your provider" line). All copy fields follow the V10 Gen Z voice (§2) except the standing disclaimer, which is fixed app copy, not a per-item field.
- **Audit:** `reviewed_by` (FK users), `reviewed_at`, `review_notes`.

### RLS & pipeline reuse
- Public reads **published issues + approved items only**. Drafts are reviewer/service-role only.
- Reuses existing infra: `is_clinical_reviewer()`, `approve_content_row(p_table, p_id, p_notes)`, `list_pending_review()` — all three get a `trending_items` arm added (see §4).
- **Source-allowlist enforced at insert:** a DB-side check (or trigger) rejects any item whose `trend_source_url` / `evidence_source_url` domain is not on the allowlist table (`trending_source_allowlist`: domain, tier `trend`|`evidence`).
  - **Proposed seed (editable in-DB, not code):** trend tier — apnews.com, reuters.com, nytimes.com, washingtonpost.com, motherly.com, parents.com, romper.com. Evidence tier — acog.org, aap.org, cdc.gov, who.int, nih.gov / pubmed.ncbi.nlm.nih.gov, llli.org.

---

## 4. Pipeline (research → review → publish → archive) — mechanism corrected 2026-07-14

1. **Research (weekly), two isolated steps — not one combined agent (decided 2026-07-14).** `last30days-skill`'s `SKILL.md` declares `allowed-tools: Bash, Read, Write, AskUserQuestion, WebSearch` — it runs its own bash scripts and writes files, a meaningfully bigger permission surface than plain web search. Since the same pipeline also needs to hold the `trending-ingest` DB write credential, the two responsibilities are split into separate steps/sessions with no shared credential, so a misbehaving third-party script has no path to the database:
   - **Step A — Discovery.** A scheduled Claude Code agent (same pattern as the existing 3 local audit agents — see `project_villie_agent_roster`) with `last30days-skill` installed (`mvanhorn/last30days-skill`, verified real: MIT, 52k★, actively maintained) runs `/last30days` scoped to its **zero-config sources only** (Reddit, Hacker News, Polymarket, GitHub, web) — no X/TikTok/Instagram/LinkedIn, since those need browser-cookie or API-key auth that has no business in an unattended weekly cron. This step **holds no `trending-ingest` credential**. Its only output is a plain-text list of candidate topics, handed to Step B. **The list is discovery-only — never cited, never stored, never shown to a user.**
   - **Step B — Sourcing + ingest.** A separate agent session/step, given the topic list from Step A (and nothing else from it — no last30days access here), uses plain WebSearch/WebFetch restricted to the two allowlists in §3 to find an actual citable trend-tier article and an evidence-tier grounding source per topic. Only these allowlisted URLs ever become `trend_source_url`/`evidence_source_url`. This step alone holds the **`trending-ingest` Edge Function** credential (service-role, shared-secret auth — not a public/JWT route) and performs the insert into `trending_items` as `draft`. The DB-side allowlist trigger remains the real enforcement point regardless of either step's prompt. MVP stays founder-in-the-loop weekly (a human still reviews every medical-claim item regardless — see step 2).
2. **Gate, keyed on `is_medical_claim` (not on `kind`).**
   - `is_medical_claim = false` → automated `healthcare-marketing-compliance` agent pass (brand-safety/tone/legal, not medical fact-check) → `agent_cleared` → publishable without a human. `cultural-intelligence-strategist` assists the ES pass.
   - `is_medical_claim = true` (default, includes most `news` items and the clarification item) → stays `in_review` until a human `is_clinical_reviewer` approves via `approve_content_row`. **Human sign-off is mandatory**; `reviewed_by/at` stored for chain-of-custody.
3. **Publish.** When the issue has its approved items, it flips to `published` → surfaces the Home card + push (respecting notif prefs via a new `trending` key, default on, quiet-hours-respecting, suppressible; routed through `push-notify` with the pref gate).
4. **Archive.** Published issues list into the Manual archive.
5. **Review surface.** `ClinicalReviewScreen` + its 3 RPCs are extended with a `trending_items` arm rather than built new: `list_pending_review()` groups by ISO week of `issue_date` (fits the screen's existing week-grouped layout); the card component grows an optional block rendering `trend_source_url`/`evidence_source_url` and, for `myth_buster` kind, `myth_claim`/`fact`; `approve_content_row`/`reject_content_row` grow a matching CASE arm. Only rows with `is_medical_claim=true` and `status='in_review'` ever reach this screen — the rest never enter the human queue.

---

## 5. Placement & UI

- **Home:** `home-feed-curator` emits a **"The Buzz — this week"** card when a published issue exists for the current week → taps into `TheBuzzScreen`.
- **`TheBuzzScreen`:** news items as cards showing the trend source + grounded context + tappable evidence link + "ask your provider" line; the clarification item rendered as a distinct **"myth vs fact"** card. Standing editorial disclaimer at the top.
- **Manual archive:** past published issues list into the Manual → `TheBuzzScreen` in archive mode.
- EN/ES driven by the item's localized fields.

---

## 6. Compliance guardrails (the part a hospital partner scrutinizes)

- **Source allowlist** enforced *both* in the research prompt *and* validated at DB insert (reject off-allowlist domains). Trend tier allows vetted journalism; evidence tier restricted to authorities/journals.
- **last30days-skill output never becomes a citation.** It's a discovery-only input to step 1a (§4) — raw Reddit/HN/Polymarket/GitHub/web engagement data is never stored on a `trending_items` row, never shown to a user, and can't reach `trend_source_url`/`evidence_source_url` (those only accept allowlisted domains, enforced at insert). This is what keeps "know what moms are actually buzzing about" from becoming the "live/real-time social feed" the spec's non-goals rule out.
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

## 8. Build sequence (proposed phases — updated 2026-07-14)

- **B1 — Data + gate:** migration 104 (`trending_issues`, `trending_items` incl. `is_medical_claim`, `trending_source_allowlist` seeded per §3, RLS, insert-time allowlist check), extends `list_pending_review` / `approve_content_row` / `reject_content_row` with a `trending_items` arm.
- **B2 — Research draft path, two isolated steps:** Step A — scheduled discovery agent with `last30days-skill` installed (`/plugin marketplace add mvanhorn/last30days-skill` + `/plugin install last30days`), zero-config sources only, no DB credential, outputs a plain topic list. Step B — separate scheduled agent (no last30days access) doing allowlist-constrained WebSearch/WebFetch sourcing + holding the `trending-ingest` Edge Function credential (service-role, shared-secret) that performs the insert; `healthcare-marketing-compliance` auto-pass for `is_medical_claim=false` items.
- **B3 — Review surface:** extend `ClinicalReviewScreen` with the `trending_items` card variant (source links + myth/fact block), grouped by ISO week of `issue_date`.
- **B4 — Publish + Home card:** issue publish flip, `home-feed-curator` card, `TheBuzzScreen` (V10 Gen Z voice copy), `trending` notif pref key + push via `push-notify`.
- **B5 — Manual archive + ES polish + analytics/audit.**

Each phase is independently shippable; B1–B4 is the thinnest end-to-end slice.

---

## 9. Open questions — resolved 2026-07-14

- ~~Exact allowlist membership~~ → proposed seed list in §3 (editable in-DB anytime, not a code change).
- ~~Whether the review surface is in-app or ops/web~~ → in-app, extends `ClinicalReviewScreen` (§4 step 5).
- ~~Push cadence~~ → notify on every publish via `trending` notif_prefs key, default on, quiet-hours-respecting.
- ~~Gate keyed on item kind~~ → re-keyed to `is_medical_claim` (§3/§4) so non-medical trend/culture items move fast while anything health-related still requires mandatory human clinical sign-off.
- Voice: V10 Gen Z voice on all copy except the standing disclaimer (§2).
- Still open, non-blocking for planning: exact final section-name copy and the very first week's seed content — both are content/copy decisions to make when B4 lands, not architecture.
