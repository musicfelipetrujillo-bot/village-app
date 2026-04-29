# The Village — Build Status

_Single-page dashboard. CLAUDE.md remains the authoritative per-phase log; this is the “where are we” view._

> Last refreshed: **2026-04-24** (later in day — Sentry stage tag, ZIP validation, gear/milk a11y polish, skeleton loaders, root error boundary + CreateListing a11y, EditProfile avatar upload, Me · Account & security, notif-pref telemetry, CreateListing upload progress, empty-state pass on Gear/Perks/Events/Milk lists, auth polish on Login + SignUp)

---

## Top-line

```
V1  Specialists ████████████████████████████  100%   ✅ Production
V2  Milk Connect ███████████████████████████  100%   ✅ Code complete (M1–M5)
V3  Community   ████████████████░░░░░░░░░░░░   57%   ⏸  Tab hidden (low-priority per memory 2026-04-24)
V4  Gear + Home ████████████████████████████  100%   ✅ Code complete (G5 legal pending)
A   Me/Account  ███████████████████░░░░░░░░░   67%   🟡 A2.a + A2.b done; A2.c legal-blocked
```

---

## V1 — Specialists 🩺  (10 / 10 phases)

```
P0 Foundation       ✅
P1 Auth             ✅
P2 Search           ✅
P3 Reviews          ✅
P4 Booking + Pay    ✅
P5 Messaging        ✅
P6 7 AI skills      ✅
P7 NPI verify+admin ✅
P8 Cron + push      ✅
P9 Skeletons + a11y ✅
P10 Sentry + EAS    ✅
```

**Status:** Live. No open phases.

---

## V2 — Milk Connect 🤱  (5 / 5 phases)

```
M1 Donor onboarding   ✅  (Stripe Connect, AI coach, trust badges)
M2 Search + map       ✅  (FlashList, AI narrative, Q&A modal)
M3 Match + purchase   ✅  (15% platform fee, pickup reveal)
M4 Messaging + reviews✅  (inbox, threads, rating-avg trigger)
M5 Disputes + ship    ✅  (Shippo labels, legal addendum gate)
```

**Open ops:** none code-side. Production rollout depends on insurance + attorney review per Risk & Compliance §3.2.

---

## V3 — Community 💬  (4 / 7 phases · tab hidden)

```
C1 Foundation       ✅  (10 tables + RLS + 4 seed rooms)
C2 Real-time chat   ✅  (room_messages RPC + Realtime + reactions)
C3 Anonymous mode   ⚪
C4 AI safety        ✅  (Haiku scan + crisis flags + moderator RPCs)
C5 AI growth        ✅  (companion + icebreaker + match + weekly digest)
C6 Calendly events  ⚪
C7 Pre-launch audit ⚪  (load test, anon RLS audit, crisis drill, beta)
```

**Posture:** Connect tab is **hidden in AppNavigator**. Per memory (2026-04-24) Community is low-priority — C3/C6/C7 work stays stub. Don't re-enable on your own; tab visibility is a product call.

**Pre-launch gates** (if revived):
- OneSignal external_ids registered for all room members ✅ (V1 infra handles)
- pg_cron Postgres GUCs `app.supabase_url` + `app.service_role_key`
- Sonnet billing budget headroom (weekly summary × active rooms)
- ≥1 active moderator per room
- Crisis drill + C7 audit

---

## V4 — Gear + Home 🛒/🏠  (8 / 8 phases)

```
G1 Home foundation       ✅  (baby_profiles, milestone_library, 52-week seed)
G2 Events near you       ✅  (PostGIS, Calendly, RSVP, calendar handoff)
G3 Brand perks           ✅  (4-network webhook verify code-complete)
G4 Gear marketplace      ✅  (allowlist categories, CPSIA year guards)
G5 CPSC + AI safety      ✅  (Haiku vision, UPC, recall hard-block) ⚠️ legal sign-off pending
G6 Messaging + safe meet ✅  (Addendum + safe-meeting gates)
G7 Home AI feed          ✅  (6 cards · Haiku + Sonnet curator · daily check-in)
G8 Cash-only marketplace ✅  (no Stripe Connect; Risk §2.7 NN#5)
```

**Open ops gates:**
- **G3** affiliate contracts (Impact / ShareASale / CJ) — code is verified-ready; flip when contracts sign + secrets set
- **G4** Supabase Storage public-read bucket `gear-listings` — must be created in dashboard before first listing upload
- **G5** attorney review of prohibited-items policy + 24hr takedown SLA assignee + insurance GL+E&O confirms marketplace coverage
- eBay Marketplace Insights API application — submit now (4–6wk approval)
- G2 event ingestion path — manual / partner feed / API scrape (ops decision)

---

## A — Me / Account 👤  (2 / 3 subphases)

```
A1   Profile + cross-tab links ✅
A2.a Search radius pref        ✅  (migration 031)
A2.b Notif toggles + quiet hrs ✅  (migrations 032, 033)
A2.c Delete account            ⚪  legal-blocked (retention policy + privacy notice)
```

**A2.b extras shipped:** OneSignal tag sync (segments from dashboard) · 3 sender gates (`appointment-reminder`, `room-weekly-summary`, `milk-safety-screener`) · `push-notify` central pref gate (defense-in-depth) · quiet-hours Home indicator.

**A2.c blockers:** attorney sign-off on which records are retained-by-law (transactions, disputes, CPSIA trail) before we cascade-delete.

---

## Cross-cutting work (this session)

```
Sentry user tagging              ✅  setUser(id) on auth state — id only, HIPAA-cautious
ExpertsHome radius pref          ✅  uses A2.a getPreferredRadiusMiles()
ExpertsHome insurance chip       ✅  conditional, reuses specialists_near insurance_filter
Profile completion meter (Me)    ✅  stage-aware due_date weighting
Onboarding funnel analytics      ✅  4 events: step_view / advanced / complete / failed
Admin compliance-event viewer    ✅  service-role edge fn · JSON+CSV export · audit trail
Push-notify central pref gate    ✅  pref_key + respect_quiet_hours + bypass_prefs
Quiet-hours shared edge helper   ✅  supabase/functions/_shared/quiet-hours.ts
Quiet-hours mobile mirror        ✅  apps/mobile/src/utils/quietHours.ts
Room weekly summary refactor     ✅  delegates groups+quiet hours to push-notify (pref_key)
Due-date input unification       ✅  utils/dueDate.ts · MM/DD mask + ISO boundary on Onboarding+EditProfile
Sentry user_meta context         ✅  pregnancy_stage + preferred_language as context (not user, HIPAA-cautious)
ZIP validation utility           ✅  utils/zip.ts · 5-digit + ZIP+4 mask, applied to Onboarding + EditProfile
Gear/Milk a11y pass              ✅  back/qty/fulfillment/cards labeled in MilkPurchase, MilkOrders, Gear list/detail/threads
Skeleton loaders (G2/G3/G4)      ✅  GearCard / EventCard / PerkCard skeletons replace ActivityIndicator on browse/list
Root error boundary              ✅  components/shared/ErrorBoundary wraps RootNavigator · Sentry capture + retry UI
CreateListingScreen a11y         ✅  cancel/scan/identify/photo/free-switch/location/submit all labeled w/ state
EditProfile avatar upload        ✅  expo-image-picker → avatars storage bucket (mig 034) · 1:1 crop · optimistic + revert
Me · Account & security          ✅  ChangePassword + ChangeEmail screens · supabase.auth.updateUser · confirm-link UX
Notif-pref telemetry             ✅  notification_pref_changed + quiet_hours_changed events on Switch toggle
CreateListing upload progress    ✅  "Uploading photo N of M" + thin progress bar under submit btn during multi-photo posts
Empty-state pass (5 list views)  ✅  emoji + title + body + rust CTA on MyListings/SavedGear/MyClaims/MyRsvps/MilkOrders
Auth polish (Login + SignUp)     ✅  Show/Hide password · email-format gate on SignUp · a11y on submit/forgot/role
```

---

## Agents runtime bridge

```
Shared contracts package         ✅  packages/agents-client
3 edge functions                 ✅  agents-health / agents-triage / agents-run
Mobile wrapper                   ✅  apps/mobile/src/api/agents.ts
Internal hidden screen           ✅  AGT badge gated by EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED
Hard constraints upheld          ✅  no public flow · no DB mutation · no AGENT_BASE_URL leak
```

---

## Currently legal/ops-blocked (not buildable)

| Item | Blocker |
|---|---|
| A2.c delete account | Attorney review of retention policy |
| G3 webhook live | Brand contracts (Impact / ShareASale / CJ) |
| G4 first upload | Storage bucket creation in Supabase dashboard |
| G5 public rollout | Prohibited-items policy attorney sign-off + 24hr takedown SLA assignee |
| G8 future buyer-protection | FinCEN / FL money-transmitter counsel review |
| eBay smart pricing | Marketplace Insights API approval (4–6 wk) |
| C3–C7 effort | Community deprioritized per memory 2026-04-24 |

---

## Code-ready, no further dev needed

V1 production · V2 M1–M5 · V3 C1–C2/C4–C5 (hidden) · V4 G1–G8 · A1 / A2.a / A2.b · Agents bridge.

Run `supabase db reset` against migrations 001–034 for a clean rebuild. Mobile typecheck is currently clean as of the last edit on 2026-04-24.
