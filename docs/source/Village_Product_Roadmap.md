The Village · Product Roadmap · April 2026 — Now / Next / Later


🌸 The Village — Product Roadmap
Now / Next / Later · Miami Launch 2026
For mothers, by mothers — from pregnancy through early parenthood
 VERTICAL                 🟢 NOW                                        🔵 NEXT                                    🟣 LATER

                          Months 1–3 · MVP Launch                      Months 4–6 · Growth                       Months 7–12 · Scale
                          • User sign up / login (email + phone)       • Social login (Google, Apple)            • Multi-baby profiles

                          • Onboarding: due date, baby age, language   • Baby profile & milestone tracker        • Partner / co-parent access
 ⚙
                          • Mother profile (name, stage, location)     • Notification preferences center         • Offline mode for key features
 Core
                          • Push notifications (OneSignal)             • Referral program ('Invite a mom')       • Expand: Broward & Palm Beach
 Platform
                          • Spanish + English language toggle          • Dark mode + accessibility settings      • iOS & Android app stores launch

                          • Home feed with vertical shortcuts
                          • Browse specialists by category             • In-app booking (Calendly / Zocdoc)      • Insurance verification (NPI Registry)

                          • Filter: language, virtual, insurance       • Verified badge for licensed providers   • Video intro from each specialist
 🏥
                          • Specialist profile pages                   • Reviews & star ratings                  • Specialist subscription / premium listing
 Specialists
                          • Map view (Google Maps)                     • Telehealth session links                • Expand to Broward & Palm Beach
 Directory
                          • Direct contact / WhatsApp link             • AI: 'Which specialist do I need?'       • Multilingual profiles (Creole)

                          • Manual curated list (Miami directory)      • SMS appointment reminders (Twilio)
                          • Event calendar (list + map view)           • Eventbrite API live event feed          • Live event check-in (QR code)

                          • Baby Trails Miami — featured partner       • In-app ticket purchase (Stripe)         • Photo sharing from events
 🎉
                          • Strong Florida Moms free events            • Host a Village Meetup (submit event)    • Village-branded hosted events
 Events &
                          • RSVP & save events                         • AI: weekly personalized event picks     • Sponsor / partner event features
 Community
                          • Push alerts for new nearby events          • Community social board / feed           • Expand event reach beyond Miami

                          • Add to Google Calendar                     • Facebook Events API import




The Village · Confidential · Page 1



                      ￼
The Village · Product Roadmap · April 2026 — Now / Next / Later
                          • Certified milk bank locator (HMBANA)            • In-app peer listing board (donate / sell)     • Stripe payments for milk sales

                          • Safety resource library (FDA / AAP)             • Mother verification badges                    • ID verification for sellers (Stripe Identity)
 🍼
                          • Links to Udderly, Share the Drop, HM4HB         • Secure in-app messaging (Sendbird)            • Monthly seller safety re-screening
 Breast
                          • Safety checklist before any exchange            • AI: guide mom to right tier safely            • Integration with milk bank APIs
 Milk Hub
                          • Educational content on milk sharing             • Location-based donor matching                 • Milk supply & demand analytics

                                                                            • Report / flag unsafe listings
                          • AI Q&A: ask anything about pregnancy            • Personalized content by week / baby age       • Expert-hosted live Q&A sessions

                          • Week-by-week pregnancy guide                    • Video content library (YouTube API)           • Certification: 'Village Verified' content
 📚
                          • Top 20 curated expert articles                  • Birth plan builder (AI-powered)               • Content from partner specialists
 Knowledge
                          • Postpartum basics library                       • Symptom checker ('Is this normal?')           • Offline article downloads
 & Education
                          • Newborn care FAQ                                • Push: weekly 'your baby this week'            • Podcast integration

                          • Multilingual (EN / ES)
                          • Support group directory (in-person + virtual)   • In-app group chat rooms (Sendbird)            • Live video group sessions (Zoom SDK)

                          • Magnolia Birth House / Gathering Place links    • Anonymous posting option                      • PHQ-9 / EPDS postpartum screening
 💛
                          • Beyond The Birth perinatal groups               • Therapist directory (perinatal-specialized)   • Crisis Text Line API integration
 Support
                          • Crisis resource quick-access button             • Mood check-in tracker (daily)                 • Village-hosted support circles
 Groups
                          • Postpartum depression info & resources          • AI: detect distress, suggest support          • Therapist booking in-app (Calendly)

                                                                            • RSVP for virtual group sessions




The Village · Confidential · Page 2



                      ￼
The Village · Product Roadmap · April 2026 — Now / Next / Later

📌 MoSCoW Prioritization — MVP (Now, Months 1–3)
MUST: Core platform, specialist directory, events calendar, AI Q&A, Baby Trails integration, safety resources SHOULD: Breast milk listing board, community feed, in-app booking, mood
tracker, support group directory COULD: Video content, birth plan builder, peer listings marketplace, group chat rooms WON'T (yet): Live video sessions, ID verification, multi-city
expansion, podcast integration


🗓 Key Milestones

 Month             Milestone                 What it means
 Month 1           🟢 Beta app live           Core platform + specialist directory + Baby Trails events. First 50 test
                                             users (Miami moms).
 Month 2           🟢 Miami soft launch       Full MVP live on iOS + Android. Onboard first 10 specialist partners.
                                             Events calendar active.
 Month 3           🟢 500 registered          AI Q&A active. Breast milk safety hub live. First Village Meetup hosted in
                                             Miami.
                   mothers
 Month 4           🔵 In-app booking          Calendly / Zocdoc integration. Mothers can book appointments without
                                             leaving the app.
                   live
 Month 5           🔵 Community               Breast milk peer listings, community feed, group chat rooms, mood
                                             tracker.
                   features launch
 Month 6           🔵 2,500 active users Referral program running. First revenue from specialist premium listings.
                                        Eventbrite feed live.
 Month 9           🟣 Support groups          Live video sessions (Zoom SDK), therapist directory, postpartum
                                             screening (PHQ-9).
                   vertical
 Month 10          🟣 Breast milk             Stripe payments + ID verification for milk sellers. Full peer-to-peer
                                             marketplace.
                   marketplace
 Month 12          🟣 Broward & Palm          Expand directory, events, and specialist network beyond Miami-Dade.
                                             10,000+ users.
                   Beach



⚠ Top Risks & Mitigations

 Risk                         Impact                      Mitigation

The Village · Confidential · Page 3



                       ￼
The Village · Product Roadmap · April 2026 — Now / Next / Later
 Breast milk safety         Legal exposure if          Display FDA/AAP warnings prominently. Link to certified
 liability                  exchange goes wrong        banks first. No direct facilitation of transactions in MVP.
 Specialist data goes       Wrong contact info         Build admin CMS to update listings. Ask specialists to self-
 stale                      erodes trust               manage profiles. Quarterly review process.
 Low initial user           App feels empty without    Seed with 50 beta moms before public launch. Partner with
 adoption                   community                  Baby Trails & Magnolia Birth House from day 1.
 Mental health feature      Mothers in crisis not      Crisis Text Line integration from day 1. AI never replaces
 misuse                     getting real help          therapy — always escalates to licensed resources.
 Dev cost overrun           MVP takes too long or      Use free-tier-first stack (Supabase, OneSignal, Sendbird
                            costs too much             free). Launch web app first, native app in month 3.
 WhatsApp / Meta API        Event/specialist comms     Use Twilio SMS as primary. WhatsApp only as optional add-
 restrictions               get blocked                on, not core dependency.



 💸 Estimated Cost to Build MVP (Months 1–3)



 Developer (1 full-stack, freelance): $3,000–$8,000 (depending on complexity and location)

 Design (UI/UX, 1 designer, 3 weeks): $1,500–$3,000

 Infrastructure (Supabase, OneSignal, Claude API): ~$0–$50/month at MVP scale

 App Store fees (Apple + Google): $124/year

 Domain + hosting (Vercel): ~$20/year

 ──────────────────────────────────────────────

 TOTAL MVP BUILD COST: ~$5,000–$12,000 (one-time) + <$100/month running costs



 💡 Tip: A no-code MVP using Bubble.io or FlutterFlow could cut build cost to ~$500–$2,000 and launch in 4–6
 weeks.




The Village · Confidential · Page 4



                      ￼
