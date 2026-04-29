                                                   THE VILLAGE
                                                   Tech Stack & Team Plan
                                                   MVP → Scale Architecture · April 2026



                                                   Execu ve Summary
                                                   The Village is a bilingual (English/Spanish) mobile app for Miami mothers covering 5 ver cals: Breast Milk Hub,
                                                   Specialist Directory, Events & Community, Knowledge & Educa on, and Support Groups & Mental Health. All
                                                   features are loca on-aware.

                                                   This document covers: the recommended tech stack, build-vs-buy decisions, team composi on, budget, and a
                                                   12-month delivery meline.


                                                    Key Principles
                                                    ✦ Loca on- rst — every ver cal is anchored to GPS proximity (PostGIS + Google Maps SDK)

                                                    ✦ Mobile-na ve — React Na ve for iOS + Android from day one (single codebase)

                                                    ✦ Lean SaaS — buy third-party services for anything not core to the product (chat, auth, no                    ca ons, AI)

                                                    ✦ Spanish- rst content — all copy wri en in both languages; AI responses in user's language

                                                    ✦ Privacy by design — lat/lng never sent to client; neighborhood-level only for lis ngs




                                                   1 · Tech Stack
                                                   1.1 Mobile App (Frontend)

                                                    Decision: React Na ve + Expo
                                                    Single codebase ships to both iOS and Android. Expo managed work ow removes most na ve tooling complexity.

                                                    TypeScript throughout — catches errors early, essen al for a team that may rotate developers.


                                                    Library / Tool                                     Purpose                       Why this one
                                                    React Na ve 0.73                                   UI framework                  Largest ecosystem, best Expo support
                                                    Expo SDK 50                                        Build & OTA updates           Instant OTA deploys without App Store review
                                                    TypeScript 5                                       Type safety                   Mandatory — reduces bugs in async loca on code
                                                    React Naviga on 6                                  Screen rou ng                 Industry standard for RN naviga on
                                                    Zustand                                            State management              Lighter than Redux; perfect for loca on + auth state
                                                    React Query (TanStack)                             Server state / caching        Automa c cache invalida on, o ine support
                                                    React Na ve Maps                                   Map views (Google Maps SDK)   Wraps Google Maps SDK for iOS + Android
                                                    i18n-js + expo-localiza on                         EN/ES transla ons             Run me language switching without reload
                                                    React Na ve Paper                                  UI components                 Material Design 3, accessible, bilingual-ready




                                                                                                                                ti
                                                                        ti                                                                                    ti
                                                                                   ti                                                     ti
                                                                             ffl             ti
                                                                              ti                                                                    ti
                                                                                                                                               fi
                                                                                                  ti
                                                                   ti                                                                ti
                                                              ti                                                     fl
                                                         ti                                                                                              ti
                                                    ti                                                                    ti
                                                    ti
                                              ti
                                         ti
                                        ti
                                         ti
                                   fi
                              fi
                         ti
                    ti
               ti
               ti
               ti
          ti
     ti
ti                                                                                      tt
                                                                     1.2 Backend

                                                                               Decision: Supabase (PostgreSQL + PostGIS) + Node.js Edge Func ons
                                                                               Supabase gives you Postgres with PostGIS (geospa al queries), real- me subscrip ons, auth, storage, and Edge
                                                                               Func ons — all managed. This avoids running a separate server for MVP.

                                                                               Node.js Edge Func ons (Deno run me inside Supabase) handle custom business logic: breast milk matching, AI rou ng,
                                                                               modera on hooks.


                                                                               Service                                         Purpose                                 Notes
                                                                                                                                                                       Managed Postgres; automa c backups, point-in-
                                                                               Supabase PostgreSQL                             Primary database
                                                                                                                                                                        me restore
                                                                                                                                                                       ST_DWithin for radius search; spa al index on all
                                                                               PostGIS extension                               Geospa al queries
                                                                                                                                                                       user/lis ng lat-lng
                                                                                                                                                                       Built-in RLS (row level security) — cri cal for
                                                                               Supabase Auth                                   Email + phone OTP sign-in
                                                                                                                                                                       HIPAA-adjacent data
                                                                                                                                                                       Breast milk lis ng photos, pro le images, event
                                                                               Supabase Storage                                Photos & documents
                                                                                                                                                                        yers
                                                                                                                                                                       AI rou ng, distress detec on, matching
                                                                               Supabase Edge Func ons                          Business logic
                                                                                                                                                                       algorithm, webhooks
                                                                               Supabase Real me                                Live updates                            Group chat presence, event seat counters


                                                                     1.3 Third-Party Services (Buy, Not Build)

                                                                     These are capabili es where building from scratch would take months and add risk. Buy the best-in-class SaaS
                                                                     instead.

                                                                               Service                                       What we use it for                        Free Tier?         Est. Monthly Cost at MVP
                                                                                                                             AI Q&A, specialist rou ng, distress
                                                                               Claude API (Haiku)                                                                      No                 $30–80
                                                                                                                             detec on, bilingual responses
                                                                                                                             In-app maps, direc ons, place             Free up to
                                                                               Google Maps SDK                                                                                            $0–50
                                                                                                                             autocomplete, geocoding                   $200/mo credit
                                                                                                                                                                       Free ≤10k
                                                                               OneSignal                                     Push no   ca ons + geofencing alerts                         Free
                                                                                                                                                                       subscribers
                                                                               Sendbird                                      Support group in-app chat rooms           Free ≤1k MAU       Free→$400

                                                                               Twilio Verify                                 Phone OTP for breast milk veri ed badge   No                 $5–20

                                                                               Expo EAS                                      Cloud build + OTA updates                 Free er            Free→$99

                                                                               Sentry                                        Crash repor ng & performance              Free er            Free

                                                                                                                                                                       Free ≤1M
                                                                               PostHog                                       Product analy cs (privacy- rst)                              Free
                                                                                                                                                                       events/mo
                                                                                                                                                                       Free 3k emails/
                                                                               Resend                                        Transac onal email (welcome, alerts)                         Free
                                                                                                                                                                       mo
                                                                               Stripe                                        Future: premium subscrip ons              No monthly fee     $0 un l mone zed




                                                ti                                                                ti                              ti
                                                                                                   ti                                                  ti
                                                                                         ti                                                                    ti
                                                                                              fi                                                                                               ti
                                                                                    ti                                         ti
                                                                               ti
                                                                          ti
                                                                     ti
                                                                ti
                                                               ti
                                                          ti                                                 fi
                                                     ti
                                                     ti
                                           ti
                                      ti
                                 fi
                            ti
                           ti
                       ti
                      ti
                      ti
            ti   ti
           ti
      ti
      ti                                                                                                                ti
                                                                                                                   ti
     ti
fl
ti                                                                                                      fi
                                                                              1.4 Infrastructure & DevOps

                                                                                    Tool                                    Role                                Notes
                                                                                    Supabase Cloud (Pro)                    Managed backend                     Auto-scaling, 8GB DB, 100GB storage, daily backups
                                                                                    Expo EAS Build                          CI/CD for mobile                    Automated iOS + Android builds on PR merge
                                                                                    GitHub Ac ons                           CI pipeline                         Lint, type-check, unit tests on every PR
                                                                                    Vercel (or Supabase Edge)               Admin dashboard (web)               Internal ops tool for moderators
                                                                                    Cloud are R2                            CDN for media (op onal)             Cheaper than S3 for image delivery at scale




                                                                              2 · Build vs. Buy Decision Matrix
                                                                              Use this matrix when deciding whether to build a feature in-house or buy a SaaS solu on. Green = buy, amber
                                                                              = build with SaaS sca old, red = build custom.

                                                                                    Feature / Capability                                             Decision   Ra onale
                                                                                    Authen ca on (email + phone OTP)                                 BUY        Supabase Auth is ba le-tested, includes RLS
                                                                                    Loca on / Geospa al queries                                      BUILD      PostGIS custom queries — core IP of the product
                                                                                    Google Maps display                                              BUY        Maps SDK; reinven ng maps is wasted engineering
                                                                                    AI Q&A (bilingual)                                               BUY        Claude API Haiku; prompt engineering is our work
                                                                                    Push no                 ca ons                                   BUY        OneSignal; geofencing included at no extra cost
                                                                                    In-app chat (support groups)                                     BUY        Sendbird; modera on tools built in
                                                                                    Breast milk matching algorithm                                   BUILD      Core product di eren ator — loca on + criteria
                                                                                                                                                     BUILD      scoring
                                                                                    Specialist directory pro les                                                Custom schema; veri ca on work ow unique to us
                                                                                    Content / knowledge ar cles                                      BUILD      Bilingual editorial content is the brand moat
                                                                                    Event lis ngs + RSVP                                             HYBRID     Build RSVP; consider Google Calendar API for
                                                                                                                                                     BUY        reminders
                                                                                    Payments / subscrip ons                                                     Stripe — never build payment processing
                                                                                    Analy cs                                                         BUY        PostHog — privacy- rst; no building required
                                                                                    Admin / modera on dashboard                                      BUILD      Simple internal web app (Next.js); cri cal for safety
                                                                                    Email delivery                                                   BUY        Resend / SendGrid — commodity




                                                                              3 · Team Plan

                                                                                    Hiring Philosophy
                                                                                    Start with a 4-person core team (founder + 3 hires). Use contractors for design and QA.

                                                                                    Milestone-gate hiring: add roles only when revenue or trac on jus             es the headcount.

                                                                                    Miami market advantage: tap FIU / UM CS programs for junior talent; bilingual engineers preferred.




                                                                                                                                                                        ti
                                                                                                                                                fi
                                                                                                                                           ti
                                                                                                                                     ti
                                                                                                                       ti
                                                                                                                  ti
                                                                                                             fl
                                                                                                       ti
                                                                                                  ti
                                                                                             fi
                                                                                             ff
                                                                                        ti
                                                                              ti   fi
                                                                              tt
                                                                         fi
                                                                    ti
                                                             ti
                                                              ti   ti
                                                        ti
                                                   ff
                                              ti
                                         ti
                                    ti
                               fi
                          ti
                         ti
                    ti
          ti   fl
     ti
ti
                                                   3.1 Phase 1 Team (Months 1–6, MVP)
                                                                                                                                                                       Es mated Monthly
                                                   Role                                        Type         Key Responsibili es
                                                                                                                                                                       Cost
                                                   Founder / Product                           Full- me     Product vision, user research, partnerships, fundraising   Sweat equity
                                                   Lead
                                                   Full-Stack Engineer #1

                                                   (React Na ve +                              Full- me     Mobile app, backend API, loca on queries, auth             $7,000–9,000
                                                   Supabase)
                                                   Full-Stack Engineer #2
                                                                                               Contract     Admin dashboard, Edge Func ons, AI integra on              $4,000–6,000
                                                   (or contractor)
                                                   UX/UI Designer                              Contract     Figma designs, design system, bilingual UX review          $2,500–4,000
                                                   Community Manager                                        Seed Miami community, moderate groups, onboard
                                                                                               Part- me                                                                $1,500–2,500
                                                   (bilingual EN/ES)                                        specialists


                                                   3.2 Phase 2 Team (Months 7–12, Growth)

                                                   Role                                               When to Hire              Why
                                                   Mobile Engineer #2                                 Month 7                   Parallel feature streams; iOS/Android-speci c polish
                                                   QA / SDET                                          Month 8                   Test automa on before scaling user base
                                                   Content & SEO Lead (bilingual)                     Month 8                   Drive organic growth; Spanish content is underserved
                                                   Customer Success / Support                         Month 9                   Handle breast milk match facilita on, specialist onboarding
                                                   Data / Analy cs Engineer                           Month 10                  PostHog pipeline, cohort analysis, reten on dashboards
                                                   Backend Engineer #2                                Month 11                  Scale PostGIS, API performance, real- me features




                                                   4 · Budget Es mate
                                                   4.1 Monthly Infrastructure Costs

                                                   Item                                                          Tier                                  Monthly Cost
                                                                                                                 8GB DB, 100GB storage, 10M edge
                                                   Supabase Pro                                                                                        $25
                                                                                                                 func on invoca ons
                                                   Claude API (Haiku)                                            ~200K tokens/day at MVP scale         $50

                                                   Google Maps Pla orm                                           Under $200 free credit                $0–50

                                                   OneSignal                                                     Up to 10,000 subscribers              Free

                                                   Sendbird                                                      Up to 1,000 MAU                       Free

                                                   Expo EAS Produc on                                            Unlimited builds, OTA                 $99

                                                   Sentry + PostHog                                              Free ers                              Free

                                                   Twilio Verify                                                 ~300 veri ca ons/mo                   $15

                                                   Resend                                                        3,000 emails/mo                       Free

                                                   Domain + misc                                                 DNS, SSL, No on, Figma                $50

                                                   TOTAL (MVP)                                                   —                                     $239–289/mo




                                                                      ti   ti
                                                                 ti             ti
                                                            ti                            ti
                                                     ti
                                              ti
                                              tf
                                         ti
                                    ti
                               ti
                               ti
                               ti
                          ti
                fi   ti
           ti
     ti   ti
     ti
     ti
ti                                                                                   fi
                                                                       4.2 One-Time Setup Costs

                                                                                Item                                                                    Notes                                               Es mated Cost
                                                                                Apple Developer Program                                                 Required for App Store                              $99/yr

                                                                                Google Play Developer Account                                           One- me                                             $25

                                                                                Legal / Privacy Policy                                                  HIPAA-adjacent; a orney review                      $500–1,500

                                                                                HIPAA Security Assessment                                               Breast milk + health data review                    $1,000–3,000

                                                                                Ini al UI Design Sprint                                                 Figma design system + 20 screens                    $3,000–5,000

                                                                                App Store op miza on (ASO)                                              Screenshots, keywords, descrip on                   $500




                                                                       5 · 12-Month Delivery Timeline
                                                                       The Village ships in 3 phases. Each phase ships a working app — no big-bang launches.

                                                                       Phase 1 · Founda on (Months 1–3) → Private Beta

                                                                                Month                     Milestone                                               Key Deliverables
                                                                                                                                                                  Supabase project, React Na ve repo, Figma design system, onboarding
                                                                                M1                        Project setup & design
                                                                                                                                                                  screens
                                                                                                                                                                  Phone OTP sign-in, GPS permission ow, loca on preferences stored in
                                                                                M1                        Core auth + loca on
                                                                                                                                                                  DB
                                                                                M2                        Breast Milk Hub MVP                                     Donor lis ng, proximity search, contact ow, veri ed badge (Twilio)
                                                                                M2                        Specialist Directory MVP                                Provider pro les, loca on-based search, lter, pro le detail screen
                                                                                M3                        Private beta launch                                     TestFlight (iOS) + Play internal track; 50 Miami mothers invited
                                                                                M3                        Analy cs baseline                                       PostHog events, reten on dashboard, NPS survey in-app


                                                                       Phase 2 · Ver cal Expansion (Months 4–6) → Public Launch

                                                                                Month                     Milestone                                               Key Deliverables
                                                                                M4                        Events & Community                                      Event lis ngs, loca on map view, RSVP, push no     ca ons
                                                                                M4                        Knowledge & Educa on                                    Ar cle library, bilingual AI Q&A (Claude), category browse
                                                                                                                                                                  Sendbird chat rooms, loca on-based group matching, modera on
                                                                                M5                        Support Groups
                                                                                                                                                                  dashboard
                                                                                M5                        Spanish localiza on complete                            All 5 ver cals fully bilingual; i18n QA pass
                                                                                M6                        App Store launch                                        iOS App Store + Google Play public release (Miami only)
                                                                                M6                        50 specialists onboarded                                Doulas, lacta on consultants, OBs — veri ed pro les




                                                                                                                                              fi   ti
                                                                                                                     fi
                                                                                                           fl             fi
                                                                                                     ti                        ti
                                                                                                ti                                                       ti
                                                                                           ti                                       ti
                                                                                      ti                                                 fi
                                                                                 ti                                                      fi
                                                                                ti
                                                                           ti
                                                                      ti
                                                                 ti
                                                            ti
                                                       tt
                                             ti   ti
                                        ti
                                   ti
                              fi
                         ti
                    ti
                    ti
               ti
          ti
ti   ti
ti                                                                                                                                       fi
                                                                                                                fl
                                                                       Phase 3 · Growth & Mone za on (Months 7–12)
                                                                                 Month                              Milestone                                                   Key Deliverables
                                                                                                                                                                                Push no ca on op miza on, personalized event feeds, re-
                                                                                 M7–8                               Reten on & engagement
                                                                                                                                                                                engagement ows
                                                                                 M8–9                               Specialist premium lis ngs                                  Paid featured placement for specialists (Stripe); rst revenue
                                                                                 M9–10                              Community features                                          User-generated posts, local paren ng groups, peer Q&A
                                                                                 M10–11                             Data & partnerships                                         Pediatrician referral network, Miami-Dade hospital partnerships
                                                                                 M11–12                             Series A prep / expansion                                   1,000+ MAU, 3 months reten on data, investor deck ready




                                                                       6 · Security & Compliance Checklist

                                                                                 Why this ma ers for The Village
                                                                                 The app handles sensi ve data: breast milk donor health info, mental health support conversa ons, and loca on data
                                                                                 for mothers and infants.

                                                                                 While The Village is not a covered en ty under HIPAA, it handles HIPAA-adjacent health data. Legal review is required
                                                                                 before public launch.


                                                                                 Requirement                                                                       How we address it                                              Status

                                                                                 Row Level Security (RLS)                                                          Supabase RLS policies — users only see their own data          ✅ Day 1

                                                                                                                                                                   Lat/lng stored server-side only; client receives
                                                                                 Loca on privacy                                                                                                                                  ✅ Day 1
                                                                                                                                                                   neighborhood name

                                                                                 Phone OTP authen ca on                                                            Supabase Auth + Twilio Verify — no password storage            ✅ Day 1

                                                                                                                                                                   Contact info gated; only revealed on inten onal tap a er
                                                                                 Breast milk donor contact privacy                                                                                                                ✅ Day 1
                                                                                                                                                                   match
                                                                                                                                                                   Claude prompt includes crisis keyword detec on → 988 /
                                                                                 Crisis detec on & rou ng                                                                                                                         ✅ Day 1
                                                                                                                                                                   local resources

                                                                                 Group chat modera on                                                              Sendbird keyword lter + human moderator escala on path         ✅ Day 1

                                                                                 HTTPS everywhere                                                                  Supabase + Expo enforce TLS 1.3                                ✅ Day 1

                                                                                                                                                                   Dra policy: 2yr inac ve account dele on; GDPR-ready opt-
                                                                                 Data reten on policy                                                                                                                             Month 1
                                                                                                                                                                   out
                                                                                 Privacy policy (a orney                                                           Must cover loca on data, health info, minors (if teen moms)    Month 2
                                                                                 reviewed)
                                                                                 HIPAA security assessment                                                         Op onal but recommended given breast milk health data          Month 3
                                                                                 App Store data safety form                                                        Accurate disclosure of loca on + health data collec on         Month 6
                                                                                 Penetra on test                                                                   Third-party pen test before Series A                           Month 10




                                                                                                                      ti        ti
                                                                                                                           ti
                                                                                                               ti                    ti
                                                                                                          ti                              ti   ti   fi
                                                                                                ti                                                       ti
                                                                                      ti                                                                 ti
                                                                                           ti                                                                 ft
                                                                                      ti                                                                                                                  ti
                                                                                 ti
                                                                            ti
                                                                       ti
                                                                       ti
                                                                  ti
                                                             fi
                                                        tt
                                                   ti
                                              tt
                                         fl
                                        ti
                                   ti
                              ti
                         fi
                    ti
                    ti
               ti
          ti
     ft
ti                                                                                                                                                                                                                    ti
                                                                                                     ti
                                                        7 · Top Risks & Mi ga ons
                                                              Risk                                                                           Likelihood     Impact       Mi ga on
                                                                                                                                                                         Review Apple Health guidelines early; avoid 'medical
                                                              App Store rejec on (health data)                                               Medium         High
                                                                                                                                                                         advice' framing
                                                                                                                                                                         Personal outreach to 10 Miami doulas in Month 1; o er
                                                              Low specialist adop on                                                         Medium         High
                                                                                                                                                                         free premium lis ng
                                                                                                                                                                         Clear disclaimers; link to HMBANA guidelines; a orney-
                                                              Breast milk safety liability                                                   Low            Very High
                                                                                                                                                                         reviewed T&C
                                                                                                                                                                         Na ve Spanish-speaking community manager reviews all
                                                              Spanish localiza on quality                                                    Medium         Medium
                                                                                                                                                                         copy
                                                              Engineer turnover                                                              Low            High         TypeScript + docs from day 1; no knowledge silos
                                                                                                                                                                         Spa al index on all geo columns; query pro ling at 10k
                                                              PostGIS performance at scale                                                   Low            Medium
                                                                                                                                                                         users
                                                                                                                                                                         Rate limit per user; Haiku model is cheapest; cache
                                                              Claude API cost spike                                                          Low            Medium
                                                                                                                                                                         common answers




                                                        8 · Recommended First Steps (Next 30 Days)
                                                        These are the ac ons that unblock everything else. Do these before any coding:

                                                              When                              Focus Area                                          Ac on
                                                                                                                                                    Hire a Miami-based healthcare a orney to review the app concept; get sign-
                                                              Week 1                            Legal & compliance
                                                                                                                                                    o on breast milk lis ng model
                                                                                                                                                    Create Supabase org, enable PostGIS extension, set up staging + produc on
                                                              Week 1                            Supabase project setup
                                                                                                                                                    environments
                                                              Week 1                            Domain & accounts                                   Register thevillage.app (or similar), Apple Dev account, Google Play account
                                                                                                                                                    Post on LinkedIn / Wellfound; lter for React Na ve + Supabase experience;
                                                              Week 2                            Hire Engineer #1
                                                                                                                                                    bilingual is a plus
                                                                                                                                                    Brief the UX designer on the 5 ver cals; deliver Figma design system by end of
                                                              Week 2                            Design sprint kicko
                                                                                                                                                    Week 4
                                                                                                                                                    DM 20 Miami doulas and lacta on consultants on Instagram; schedule 5
                                                              Week 2                            Community outreach
                                                                                                                                                    discovery calls
                                                              Week 3                            GitHub repo + CI                                    React Na ve monorepo, TypeScript con g, ESLint, GitHub Ac ons pipeline
                                                                                                                                                    Build phone OTP sign-in + GPS permission ow as proof of concept; validate
                                                              Week 3                            Auth + loca on POC
                                                                                                                                                    Supabase RLS
                                                              Week 4                            Figma review & feedback                             Review onboarding + Breast Milk Hub designs with 3 Miami mothers; iterate
                                                              Week 4                            MVP sprint planning                                 Break Month 2 into 2-week sprints; assign issues in GitHub Projects




                                                        The Village · Tech Stack & Team Plan · April 2026 | Con den al — Internal Use Only




                                                                                                                                               ti
                                                                                                                                        ti
                                                                                                                                   ff                       ti
                                                                                                                         ti
                                                                                                                        tt
                                                                                                                   fi
                                                                                                              fl
                                                                                                         fi
                                                                                                    ti
                                                                                           ti
                                                                                      tt
                                                                                 ti
                                                                            ti
                                                                       fi
                                                         ti
                                                        ti
                                                   ff
                                              ti
                                    ti   ti
                               ti
                          ti
                     ti
                ti
           ti
     ti
      ti
      ti
ff                                                                                                                            fi
