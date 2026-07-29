# The Buzz — Discovery Candidates (2026-07-29)

**Step:** Discovery (Step A) for The Buzz weekly pipeline (see `THE_BUZZ_TRENDING.md` §4).
**Window:** last 30 days (~2026-06-29 → 2026-07-29).
**Scope:** zero-config sources only — Reddit, Hacker News, Polymarket, GitHub, web. No X/TikTok/Instagram/LinkedIn (auth-gated, out of scope).
**Note on mechanism:** `last30days-skill` (`mvanhorn/last30days-skill`) was not installed in this unattended environment, and running its scraper scripts unattended is the exact permission-surface risk the spec flags. Its zero-config source set was surveyed directly via keyless web/Reddit/HN discovery instead — output is discovery-only candidate topics, never cited/stored/shown (per §4/§6). Next step (villie-buzz-sourcing-ingest-weekly) sources + verifies citations from the §3 allowlists.

## Candidate trending topics

- **FDA safety review of infant RSV monoclonal antibodies (Beyfortus / Enflonsia)** — parents are anxious that an ongoing FDA safety review could restrict or chill access to the RSV shots even though no safety signals have been found and infant RSV hospitalizations are down ~43% since the antibodies launched. *(medical-claim)*
- **Nara Organics European formula recall + infant botulism outbreak** — a June 2026 FDA/CDC multistate infant-botulism investigation triggered a recall of a Europe-manufactured powdered formula, reigniting parent fear and confusion about formula safety despite it being <1% of the US supply. *(medical-claim)*
- **Gentle-parenting backlash and parental burnout** — a new peer-reviewed (PLoS ONE) study found roughly a third of self-identified "gentle parents" report burnout, fueling a loud cultural reckoning over whether the approach is too hard on parents. *(mixed — leans myth-vs-fact "does gentle parenting work?")*
- **The "Parenting Reset" / de-influencing movement** — moms are trading viral, Pinterest-perfect, over-scheduled parenting for "do less, sustainably": second-hand gear, fewer competitive activities, and pushing back on the mental load. *(cultural, non-medical)*
- **AI baby monitors and baby-tracking-app data privacy** — ML breathing/sleep-stage detection and smart bassinets are the 2026 nursery default, but parents are increasingly alarmed that "free" baby-tracking apps harvest and sell infant health data. *(cultural/tech — directly relevant to Villie's own posture)*
- **Postpartum care access gaps and perinatal mental health** — late-July 2026 research (Aeroflow) spotlighted why moms miss postpartum visits (childcare, transport, scheduling, in-network gaps) alongside a documented shortage of certified perinatal mental-health providers and high rates of undiagnosed perinatal anxiety. *(medical-claim)*
