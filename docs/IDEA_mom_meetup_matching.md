# Future initiative — mom-to-mom meetups & matching

**Status:** parked / exploratory (raised 2026-05-30). Not scheduled. This doc captures it so it isn't lost.

## The idea
Connect moms with other moms nearby — coffee, meetups, baby-friendly hangouts — and eventually **1:1 proximity matching** (a "find a mom like me, close by" friend-finder).

## Why it's on-mission
The Village *is* other moms. Peer connection is the brand's core promise and the highest-potential community feature. This is not a tangent — it's arguably the most on-brand thing we could build.

## Why it's parked (the real weight)
- **It re-opens V3 Community**, which was deliberately shelved (Connect tab hidden; "not really going to ship" — see the V3 build table in `CLAUDE.md` + memory `project_v3_community_scope`). This is that, with *higher* stakes because it's offline meetups, not just chat.
- **Trust & safety is the gate.** Matching a vulnerable postpartum population with nearby strangers to meet *in person, with infants* is the highest T&S bar in the app: identity/vetting, moderation, in-person-meeting safety, **liability**, and **privacy** (proximity = location sharing, which we keep deliberately coarse / opt-in).
- **Risk & Compliance review is mandatory** before any build (platform-vs-supplier posture, Section-230-shaped framing, attorney sign-off) — mirror the community C7 gates: load test, RLS audit, crisis drill, moderator runbook, legal review, 50-user beta.

## Two tiers — keep them distinct
1. **Hosted group meetups ("coffee circles") — LOW risk.** Already exists as **Villie Plans / events** (the tile literally reads "classes, circles, real coffee"). A host, a place, a structure. *Grow this first.* The Village stage-aware section's `1yr+` bucket already routes **"Meetups & playdates → Villie Plans"** as the soft, no-new-machinery taste of "meet moms nearby."
2. **1:1 proximity matching (friend-finder) — HIGH weight.** A full vertical: profiles, matching algorithm, messaging, in-person-meeting safety, moderation, reporting. **This is the parked item.**

## Recommended path
- **Near-term:** lean entirely on hosted meetups via Villie Plans. Amplify "coffee circles" content there. No new T&S surface.
- **To pursue 1:1 matching:** requires an explicit decision to staff trust & safety + a legal review, and should be scoped as its own vertical with a C1–C7-style spec. Don't bolt it onto a hub.

## One-line summary
Great idea, most on-brand of all — but it's a safety-critical *vertical*, not a hub section, and it revives the shelved community work. Soft-test the appetite through hosted Plans meetups; build the matcher only behind a deliberate trust-&-safety investment.
