    🤱 The Village · Milk Connect                                 Peer-to-Peer Tool Stack & Safety Architecture



     🤱
     Milk Connect
     Peer-to-Peer Breast Milk Exchange
     Ideal Tool Stack · Donor-Recipient Flow · Safety Architecture
     The Village App · Research & Recommendations

    April 2026 · Prepared for The Village Product Team




     ⚠ Read This First: Milk Connect is not a marketplace

     Unlike Baby Gear Swap, Milk Connect does not involve the exchange of money. It is a platform for
     facilitating informal, peer-to-peer, community-based breast milk sharing between consenting
     adults.

     The Village's role is: facilitator only. We connect donors and recipients. We never handle, store,
     process, test, ship, or guarantee the safety of breast milk. All safety decisions belong to the
     participants, supported by transparent information and best-practice guidance.

     This distinction — facilitator vs. supplier — is the most important legal concept governing every
     technology choice in this document.



    Executive Summary
    Milk Connect needs to do one thing better than anything else: connect a mom who has extra milk with a
    mom who needs it, safely, locally, and quickly. Every tool choice in this stack serves that goal. The
    technology is less complex than the Gear Swap — the hard part is the safety architecture and the trust
    system, not the engineering.



    The four-layer architecture:



     Layer              What it does                       Recommended tool
     LOCATE             Find donors near the recipient's   Supabase + PostGIS (ST_DWithin) — already in
                        location                           your stack
     VERIFY             Build trust through profile        Persona (self-serve ID verification) + in-app health
                        completeness + optional ID         questionnaire
                        verification



    Page 1 · Confidential



￼
    🤱 The Village · Milk Connect                                     Peer-to-Peer Tool Stack & Safety Architecture

     Layer              What it does                         Recommended tool
     CONNECT            Secure, private messaging            Sendbird (HIPAA-eligible messaging SDK for
                        between matched donors and           React Native)
                        recipients
     INFORM             Safety checklists, screening         In-app content (no third-party API needed) +
                        guidance, legal disclosures —        HMBANA guidelines embedded
                        always visible




    What Already Exists — and Why The Village Can Do Better
    Understanding the existing platforms reveals exactly where to differentiate. None of them have cracked
    the safety + trust + bilingual + local-community combination that The Village is uniquely positioned to
    deliver.



     Platform                Model              Gaps The Village fills
     HM4HB (Hum. Milk 4      Facebook groups    No app, no location search, no safety screening, no private
     Human Babies)                              messaging. Requires Facebook account. English only. Community
                                                trust but zero structure.
     Only The Breast         Paid marketplace   Allows sale of breast milk (legally and ethically controversial). No
                                                health screening enforced. Not community-driven. Not bilingual.
                                                No safety checks.
     Share the Drop          App (freemium)     Closest competitor. Has geo-search, allergy filters, real-time
                                                matching. Recipients pay $9.99/mo. BUT: English only, US only,
                                                no integrated safety guidance, no community layer, no IBCLC
                                                connection.

     The Village ✅           Free, community    EN/ES bilingual · Miami-local · Integrated safety guidance · IBCLC
                                                connection in-app · Community trust layer · No charge to either
                                                party · HMBANA-aligned screening · Built for mothers BY a
                                                platform mothers trust.




    The Donor Journey (Becoming a Milk Donor)
    A donor is a mom with surplus milk who wants to help. She should be able to create a donor profile in
    one session — under 5 minutes — with no ambiguity about what she's agreeing to. Trust starts here.




    Page 2 · Confidential



￼
    🤱 The Village · Milk Connect                                 Peer-to-Peer Tool Stack & Safety Architecture


     🤱 STEP 1 Create Donor Profile
     Donor taps "Become a Donor" → brief orientation screen explaining what peer-to-peer sharing
     means

     Full legal disclosure shown (not buried in ToS): "The Village connects donors and recipients. We
     do not test, handle, or guarantee the safety of breast milk. All sharing is between consenting adults
     at their own informed decision."

     She acknowledges with a specific tap: "I understand and agree to share responsibly."

     Profile fields: First name only · Neighborhood (not full address) · Languages spoken · Baby's age
     (establishes milk stage — colostrum, transitional, mature) · Estimated monthly volume available




     📋 STEP 2 Complete Health Questionnaire (in-app, required)
     A structured 12-question health screening — based on HMBANA informal sharing guidelines —
     that every donor must complete before being visible to recipients.

     Questions cover:

     · Current medications (prescription and OTC), supplements, herbal remedies

     · Alcohol and substance use (frequency, last use)

     · Smoking or vaping status

     · Recent blood transfusion or organ transplant (last 12 months)

     · History of or current treatment for: HIV, Hepatitis B or C, HTLV, syphilis

     · Recent tattoo or piercing (last 6 months)

     · Recent travel to malaria-endemic regions

     Responses are stored encrypted. Any "disqualifying" answer shows a compassionate explanation
     + suggestion to speak with her IBCLC. She is not blocked from the app — only from the donor-
     visible pool.




    Page 3 · Confidential



￼
    🤱 The Village · Milk Connect                                  Peer-to-Peer Tool Stack & Safety Architecture


     📦 STEP 3 Post a Donation
     Once profile is complete, she posts a donation listing:

     · Milk stored since: [date] — helps recipients know freshness

     · Storage method: Fresh · Refrigerated · Frozen

     · Volume: approximate oz available

     · Pickup: neighborhood only (never full address — shared privately after match)

     · Diet notes: dairy-free · gluten-free · vegan · etc. (for recipients with specific needs)

     Listing goes live immediately. Expires in 7 days or when she marks it fulfilled.




    The Recipient Journey (Finding a Milk Donor)
    A recipient is a mom or caregiver who needs donor milk. She may be stressed, exhausted, and time-
    sensitive. The experience needs to be warm, fast, and give her the information she needs to make a
    safe decision — without overwhelming her.




     🔍 STEP 1 Set Needs & Location
     Recipient sets her neighborhood (used for radius search — not stored as precise GPS).

     Optional filters she can set:

     · Radius: 5 · 10 · 25 miles

     · Milk stage needed: colostrum · early · mature

     · Dietary needs: dairy-free · gluten-free · vegan · nut-free

     · Language preference: EN · ES · Both




    Page 4 · Confidential



￼
    🤱 The Village · Milk Connect                               Peer-to-Peer Tool Stack & Safety Architecture


     👀 STEP 2 Browse Donors (with Safety Transparency)
     Each donor card shows:

     · First name + neighborhood · Baby age (milk stage) · Volume available · Storage method

     · Health questionnaire completion badge: "Screening Complete ✓" or "Partial"

     · Diet notes · Languages spoken

     A permanent banner appears at the top of every donor list:

     "Breast milk sharing is a personal decision. The Village provides a space to connect — we do not
     test milk or verify health claims. Read our Safety Guide before requesting."

     The Safety Guide is always one tap away and contains the full HMBANA informal sharing
     checklist.




     💬 STEP 3 Connect & Arrange Privately
     Recipient taps "Connect" on a donor card → in-app message opens (Sendbird).

     First message is pre-templated (editable):

     "Hi [name], I saw your donation on The Village. I'm looking for [volume] for my [age] baby. Would
     you be willing to connect?"

     All logistics — full address, pickup time, handoff method — happen inside the private chat.

     After handoff, both parties get a soft prompt: "How did it go?" (1–5 stars + optional note). Reviews
     build the community trust layer.




    Page 5 · Confidential



￼
    🤱 The Village · Milk Connect     Peer-to-Peer Tool Stack & Safety Architecture

    Layer 1 — Location & Proximity Matching




    Page 6 · Confidential



￼
    🤱 The Village · Milk Connect                          Peer-to-Peer Tool Stack & Safety Architecture
    Milk Connect is a hyper-local feature. A mom needs a donor who is within reasonable driving distance.
    The matching engine must be fast, private, and already in The Village tech stack.




    Page 7 · Confidential



￼
    🤱 The Village · Milk Connect                                  Peer-to-Peer Tool Stack & Safety Architecture



    Tool: Supabase + PostGIS (already in your stack — zero additional cost)

    PostGIS is a PostgreSQL extension that Supabase enables with a single toggle in the dashboard. It
    gives you geospatial queries that can find all donors within X miles of a recipient instantly.



     Enable                   Supabase Dashboard → Database → Extensions → Enable PostGIS
     Key SQL function         ST_DWithin(donor_location, recipient_location, radius_meters) — returns all
                              donors within the radius
     What gets stored         PostGIS Point geometry (lat/long) — stored as a geography column, not
                              exposed to the client app
     Privacy rule             NEVER return raw coordinates to the recipient app. Return neighborhood label
                              + distance only ("2.3 miles away in Brickell"). Full address only in private chat
                              after match.
     Radius options           5 miles (walking distance) · 10 miles (city) · 25 miles (greater metro). Default:
                              10 miles.
     Sorting                  ORDER BY ST_Distance(donor.location, recipient.location) ASC — closest
                              donors appear first
     Cost                     Free — PostGIS is included in Supabase at no extra charge



    Location Privacy Architecture

    Milk Connect handles sensitive information (a mother's home area, her infant's needs). The location
    strategy must be privacy-first from day one:



     Stage                             What the app reveals vs. what stays private
     Browsing (pre-match)              REVEALS: Neighborhood name (e.g., "Brickell") + approximate distance
                                       ("~3 mi away"). HIDES: Street address, exact GPS coordinates, building/
                                       unit.
     After both parties agree to       Pickup location shared by donor inside private chat at her discretion. The
     connect                           Village never automatically reveals addresses.
     GPS permission on device          REQUEST: "While using the app" only — never background location.
                                       Expo Location API with expo-location.
     Manual entry fallback             Moms who decline GPS can type their ZIP code or neighborhood. Stored
                                       as a PostGIS point at the neighborhood centroid (not their home).




    Layer 2 — Verification & Trust Architecture

    The single most important UX challenge in Milk Connect is trust. A mother is making a health decision
    for her infant. She needs to know the donor is real and has been honest about her health status. The

    Page 8 · Confidential



￼
    🤱 The Village · Milk Connect                                   Peer-to-Peer Tool Stack & Safety Architecture
    Village cannot verify medical claims — but it can build a layered trust system that gives recipients the
    confidence to make informed decisions.



    Three-Tier Trust Model (rename from "Badge T1/T2/T3" — see compliance doc)

    The compliance document flagged the T1/T2/T3 badge naming as a legal risk because it implies The
    Village certifies health/safety. The names below are legally safe alternatives that communicate
    community engagement rather than safety certification:



     Old name       New name (safe)      How earned                     What it tells the recipient

     T1             🌱 Community          Profile complete + agreed to   She is a real member of The Village
                                         sharing guidelines             community who has read the sharing
                    Member
                                                                        guidelines.

     T2             ✅ Screened Donor     Health questionnaire 100%      She completed The Village's self-reported
                                         complete + no disqualifying    health screening. Results are self-reported
                                         responses                      — not medically verified.

     T3             ⭐ Trusted Donor      Screened + verified ID + 3+    She has completed ID verification AND has
                                         successful donations with      a track record of positive exchanges in the
                                         positive reviews               community.




    CRITICAL: Every badge must include a "?" tap-to-explain button that shows exactly how the
    badge was earned and what it does NOT mean (i.e., it does not mean The Village has verified her
    health, tested her milk, or guarantees safety). This is the legal protection.



    Optional ID Verification: Persona API

    For donors who want the "Trusted Donor" (T3) badge, The Village offers optional identity verification.
    This is NOT mandatory — it is a trust-enhancer for donors who want to signal additional credibility. It
    verifies that the name on the profile matches a real government ID.



     Tool                     Persona (persona.com) — preferred over Onfido/Stripe Identity for mobile-first
                              apps
     What it verifies         Government-issued ID (driver's license, passport) + optional selfie liveness
                              check
     What it does NOT         Medical history, health status, milk quality. Never imply otherwise.
     verify
     React Native SDK         Yes — Persona has a React Native SDK (expo-compatible) that handles the
                              entire verification flow in-app
     Cost                     ~$1–2 per verification. At 100 T3 applicants/month = $100–200/mo. Free tier
                              for testing.
     UX note                  Show ID verification as a badge of community commitment: "Help families trust
                              you. Verify your identity." Never frame it as a requirement.

    Page 9 · Confidential



￼
    🤱 The Village · Milk Connect                                       Peer-to-Peer Tool Stack & Safety Architecture

     Data                      Persona handles ID data storage and compliance. The Village stores only a
                               boolean: id_verified: true/false.



    Health Questionnaire — Implementation

    The health questionnaire is built entirely in-app. No third-party API needed. It is a structured form stored
    in Supabase with the following design rules:



     Design rule                          Rationale
     Never block on a "yes"               A "yes" to a disqualifying question shows compassionate guidance, not a
     answer                               hard wall. Moms should never feel judged.
     Store answers as encrypted           Questionnaire responses contain sensitive health information. Supabase
     JSON                                 Row Level Security + encryption at rest.
     Responses visible only to            Recipients never see the raw questionnaire answers. They only see the
     the donor                            completion badge + any diet notes the donor chose to share.
     Annual refresh required              Health status changes. Questionnaire expires 12 months after completion
                                          and must be re-taken. Donor listing is hidden while expired.
     Bilingual from day 1                 All 12 questions exist in both EN and ES. The language follows the app's
                                          language setting.
     Timestamp every                      Stored with ISO timestamp. If a legal question arises, The Village can show
     submission                           the donor self-certified at a specific date.




    Layer 3 — Private Messaging: Sendbird

    Once a donor and recipient connect, all coordination happens inside The Village app. Using an external
    messaging channel (WhatsApp, SMS) removes The Village's ability to moderate, support, and maintain
    community standards. The right tool is a purpose-built in-app chat SDK.



    Why Sendbird over alternatives

     SDK                     HIPAA-eligible           React Native      Notes
     Sendbird                ✅ Yes (BAA               ✅ Native SDK      Best for healthcare/community. Free tier: 1,000
                                                                        MAU. ~$399/mo at scale. Moderation tools built
                             available)
                                                                        in.

     Stream (GetStream)      ✅ Yes                    ✅ Native SDK      Comparable to Sendbird. Slightly better
                                                                        developer experience. Free tier: 5M API calls/
                                                                        mo.

     Twilio                  ⚠ Partial (select        ✅ Via API         More configuration needed for HIPAA. Better
     Conversations                                                      for SMS-based flows than in-app chat.
                             products)




    Page 10 · Confidential



￼
    🤱 The Village · Milk Connect                                   Peer-to-Peer Tool Stack & Safety Architecture

     SDK                     HIPAA-eligible       React Native      Notes
     Custom (Supabase        ✅ (you control it)   ✅ Via Supabase    Lowest cost if built well. Requires significant
     Realtime)                                                      engineering effort for file sharing, notifications,
                                                  JS
                                                                    moderation.




    Chat Rules for Milk Connect

    The chat between donor and recipient must follow specific rules to keep The Village protected and the
    community safe:



     Channel type              Private 1:1 channel created when recipient taps "Connect." Donor must accept
                               before messages are visible.
     First message             Pre-written but fully editable. Reduces anxiety for new users, ensures polite
     template                  opening.
     No money exchange         Automated scan flags messages containing payment keywords (Venmo, Zelle,
     in chat                   PayPal, "$", "pay"). Milk sharing is always free on The Village.
     Report & block            Standard Sendbird moderation: report message + block user. Village
                               moderators review flagged chats.
     Push notifications        Expo Push Notifications via Sendbird webhooks. Notification copy: "You have a
                               new message from [first name]." Never reveals message content in
                               notification.
     Chat retention            90-day message history retained, then purged. Reduces data liability while
                               giving adequate time for dispute resolution.
     Estimated cost            Sendbird free tier covers first 1,000 MAU (Monthly Active Users). First 6
                               months likely free.




    Layer 4 — Safety Information Architecture

    The Village cannot test milk, verify donors, or guarantee safety. What it can do — and must do — is
    ensure every user has immediate access to accurate, compassionate, evidence-based safety guidance
    at every step of the experience.



    HMBANA Informal Sharing Checklist (embedded in-app)

    The Human Milk Banking Association of North America (HMBANA) has published best practices for
    informal milk sharing. These do not need a third-party API — they are static, curated content that The
    Village produces and maintains.




    Page 11 · Confidential



￼
    🤱 The Village · Milk Connect                                       Peer-to-Peer Tool Stack & Safety Architecture

     Checklist item                             Guidance shown to recipient in-app
     Donor health history                       Ask about medications, smoking, alcohol, recreational drugs, recent
                                                illness, blood transfusions.
     Blood tests                                Consider asking if donor has been recently tested for HIV, Hepatitis B/
                                                C, HTLV, and CMV.
     Milk handling                              Ask how milk was expressed, stored, and how long it has been frozen/
                                                refrigerated.
     Storage containers                         Breast milk storage bags or food-grade hard plastic/glass only. BPA-
                                                free.
     Freezer duration                           Properly stored frozen milk: up to 6 months in a standard freezer, 12
                                                months in deep freeze.
     Thawing                                    Never microwave. Thaw in refrigerator or warm water bath. Use within
                                                24 hours of thawing.
     Transport                                  Keep frozen or chilled during transport. Insulated bag with ice packs.
     Trust your instincts                       If anything feels wrong, it's okay to decline. Community sharing works
                                                because of mutual respect.




    Safety Touchpoints (when they appear in the UX)

     Moment                               What the user sees
     First time entering Milk Connect     Full-screen orientation card with platform disclaimer. Must scroll to bottom +
     (any role)                           tap "I understand." Shown once, then never again.
     Donor: before health                 "Why do we ask these questions?" explainer — empathetic, not clinical.
     questionnaire
     Recipient: top of every donor list   Persistent soft banner: "All exchanges are between consenting adults. Read
                                          our Safety Guide." Tappable.
     Recipient: before sending first      Interstitial: "Before you connect — here's what to ask your donor." 5-item
     message to a donor                   quick checklist. Skip option available.
     Chat: after both agree on            Auto-message from The Village bot: "Remember to ask about storage
     handoff                              conditions! 🤍 Here's a quick checklist." (Not mandatory, dismissible.)

     Post-exchange rating screen          "How was your experience? Your feedback helps other moms in the
                                          community."
     Seasonal: viral illness season       Banner on Milk Connect home: "Heads up — RSV season is here. Ask
     (e.g., flu, RSV season)              donors about recent illness."




    Page 12 · Confidential



￼
    🤱 The Village · Milk Connect         Peer-to-Peer Tool Stack & Safety Architecture

    Notifications & Real-Time Matching




    Page 13 · Confidential



￼
    🤱 The Village · Milk Connect                             Peer-to-Peer Tool Stack & Safety Architecture
    A donor posts a listing that expires in 7 days. A recipient with matching needs is 3 miles away. The
    Village's job is to connect them before the listing expires. Push notifications are the engine that makes
    this happen.




    Page 14 · Confidential



￼
    🤱 The Village · Milk Connect   Peer-to-Peer Tool Stack & Safety Architecture




    Page 15 · Confidential



￼
    🤱 The Village · Milk Connect                                    Peer-to-Peer Tool Stack & Safety Architecture

     Notification type             Trigger                      Example copy (EN / ES)
     New donor near you            Donor posts listing within   "A donor in Brickell just posted! She has 40oz available.
                                   recipient's saved radius     🤍 " / "¡Una donante en Brickell acaba de publicar!
                                                                Tiene 40oz disponibles."

     New message                   Chat message received        "You have a message from María. 💬 " / "Tienes un
                                                                mensaje de María."

     Listing about to expire       Donor's listing is 48h       "Your donation listing expires in 2 days. Mark as fulfilled
                                   from expiry with no          or extend it. 🤱 "
                                   match
     Questionnaire expired         Health questionnaire >12     "Your health screening has expired. Update it to stay
                                   months old                   visible to recipients."

     Review received               Post-exchange rating         "Someone left you a review! See what the community is
                                   submitted                    saying. ⭐ "

     Match fulfilled               Donor marks listing as       "Your milk found a home. 🤍 Thank you for helping a
                                   fulfilled
                                                                family in Miami."




    Page 16 · Confidential



￼
    🤱 The Village · Milk Connect   Peer-to-Peer Tool Stack & Safety Architecture




    Page 17 · Confidential



￼
    🤱 The Village · Milk Connect                                 Peer-to-Peer Tool Stack & Safety Architecture
    Tool: Expo Push Notifications (expo-notifications) + Supabase Edge Function as the notification trigger. When a
    new donor listing is inserted within X miles of a saved recipient radius preference, the Edge Function fires the
    push automatically.




    Page 18 · Confidential



￼
    🤱 The Village · Milk Connect                                     Peer-to-Peer Tool Stack & Safety Architecture




    Complete Tech Stack Summary
     Layer          Tool / Service              Purpose                 Est. monthly        Priority
                                                                        cost
     Location       Supabase + PostGIS          Radius donor            Free (in stack)     🔴 MVP
                                                matching
     Location       Expo Location API           Device GPS              Free                🔴 MVP
                                                permission
     Verification   In-app questionnaire        Self-reported health    Free (built in-     🔴 MVP
                                                screen                  app)
     Verification   Persona ID verification     Optional T3 badge /     ~$1–2/              🟡 Phase 2
                                                ID check                verification
     Messaging      Sendbird SDK                Private 1:1 donor-      Free (≤1,000        🔴 MVP
                                                recipient chat          MAU)
     Messaging      Expo Push Notifications     Real-time donor         Free                🔴 MVP
                                                match alerts
     Safety         In-app HMBANA content       Safety guides +         Free (editorial)    🔴 MVP
                                                checklists
     Moderation     Sendbird moderation tools   Report/block +          Included in         🔴 MVP
                                                human review            Sendbird
                                                queue
     Data           Supabase + RLS +            Health data, donor      ~$25 (shared)       🔴 MVP
                    encryption                  profiles, chat
     TOTAL          MVP stack — Location + Questionnaire + Sendbird + ~$25–50/mo            Significantly lower cost
                    Notifications + Safety content                                          than Gear Swap




    Page 19 · Confidential



￼
    🤱 The Village · Milk Connect   Peer-to-Peer Tool Stack & Safety Architecture

    Recommended Build Sequence




    Page 20 · Confidential



￼
    🤱 The Village · Milk Connect                                     Peer-to-Peer Tool Stack & Safety Architecture

     Week 1–2          Location matching + donor/recipient profiles
     →                 Enable PostGIS on Supabase. Set up donors table with geography column.
     →                 Donor profile form: name, neighborhood, baby age, volume, diet notes.
     →                 Recipient preferences: radius, milk stage, dietary filters, language.
     →                 ST_DWithin query returns sorted donor list to recipient.
     →                 Donor card UI: name, neighborhood, distance, "Connect" button.




    Page 21 · Confidential



￼
    🤱 The Village · Milk Connect   Peer-to-Peer Tool Stack & Safety Architecture




    Page 22 · Confidential



￼
    🤱 The Village · Milk Connect                                  Peer-to-Peer Tool Stack & Safety Architecture

     Week 3–4          Health questionnaire + trust badges
     →                 Build 12-question health questionnaire (EN + ES) — stored in Supabase.
     →                 Questionnaire scoring: no disqualifying responses → "Screened Donor" badge.
     →                 Questionnaire expiry logic: flag donors whose screening is >12 months old.
     →                 Badge display on donor cards with "?" explainer tap.
     →                 Legal disclaimer flow: orientation card + acknowledgement tap.




    Page 23 · Confidential



￼
    🤱 The Village · Milk Connect   Peer-to-Peer Tool Stack & Safety Architecture




    Page 24 · Confidential



￼
    🤱 The Village · Milk Connect                                   Peer-to-Peer Tool Stack & Safety Architecture

     Week 5–6          Messaging + push notifications
     →                 Integrate Sendbird React Native SDK. Create private 1:1 channel on "Connect" tap.
     →                 Pre-written first message template (editable, EN + ES).
     →                 Expo Push Notifications: new message alerts + listing expiry alerts.
     →                 Supabase Edge Function: trigger push when new donor appears within recipient radius.
     →                 Report & block flow. Moderation queue in dashboard.




    Page 25 · Confidential



￼
    🤱 The Village · Milk Connect   Peer-to-Peer Tool Stack & Safety Architecture




    Page 26 · Confidential



￼
    🤱 The Village · Milk Connect                                     Peer-to-Peer Tool Stack & Safety Architecture

     Week 7–8          Safety content + Persona ID verification
     →                 Embed full HMBANA checklist as in-app Safety Guide (EN + ES).
     →                 Safety touchpoints: banner on donor list, interstitial before first message, chat bot
                       message.
     →                 Post-exchange rating flow: 1–5 stars + optional note.
     →                 Integrate Persona SDK for optional T3 "Trusted Donor" ID verification.
     →                 Seasonal safety banner system: editorial team can push timely alerts (RSV season,
                       etc.).




    Page 27 · Confidential



￼
    🤱 The Village · Milk Connect                                             Peer-to-Peer Tool Stack & Safety Architecture




    The Differentiation Matrix
     Feature                      The Village           HM4HB (FB)            Only The Breast         Share the Drop
     GPS-based proximity                                ❌                     ❌                       ✅
                                  ✅
     search
     Health questionnaire                               ❌                     ❌                       ❌
                                  ✅
     In-app private messaging                           ❌                     ❌                       ✅
                                  ✅
     Trust badge system                                 ❌                     ❌                       ❌
                                  ✅
     Bilingual EN/ES                                    ❌                     ❌                       ❌
                                  ✅
     No charge to either party                          ✅                     ❌ (paid)                ⚠ (recipient pays)
                                  ✅
     Integrated safety                                  ❌                     ❌                       ❌
                                  ✅
     guidance
     IBCLC connection in-app                            ❌                     ❌                       ❌
                                  ✅
     Community reviews                                  ❌                     ❌                       ❌
                                  ✅
     HMBANA-aligned                                     ❌                     ❌                       ❌
                                  ✅
     guidelines
     Part of broader mom                                ❌                     ❌                       ❌
                                  ✅
     platform




    The Village · Milk Connect Research · April 2026

    This document is for internal product planning. Milk Connect facilitates informal peer-to-peer sharing between consenting adults. The
    Village does not act as a milk bank, medical provider, or safety guarantor. All trust features must be reviewed by a healthcare attorney
    before public launch.




    Page 28 · Confidential



￼
