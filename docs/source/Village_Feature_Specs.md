The Village · Feature Specifications (PRD) · v1.1 · April 2026



🌸 The Village
Feature Specifications — All 5 Verticals
PRD v1.1 · April 2026 · Miami, FL

 Document Contents



 📍 Location Architecture — Cross-cutting location requirements (applies to all verticals)

 🍼 Spec 1 — Breast Milk Hub

 🏥 Spec 2 — Specialist Directory

 🎉 Spec 3 — Events & Community

 📚 Spec 4 — Knowledge & Education

 💛 Spec 5 — Support Groups & Mental Health



 Each spec includes: Problem Statement · Goals · Non-Goals · User Stories · Screen Flow · Requirements
 (P0/P1/P2) · Data Model · Business Rules · Success Metrics · Open Questions




The Village — Confidential · Page 1



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026


 📍 Location Architecture — Required Across All 5 Verticals


 Location is the foundation of The Village. Every vertical must know where the user is so it can surface
 nearby specialists, events, milk donors, support groups, and locally relevant content. Location must be
 requested on first launch and used as the default sort/filter across all content types.


Core Location Stack
 Requirement                       P        Acceptance Criteria                                  Notes / Connector
 GPS permission — on first         P0       App requests device location on first open (iOS:     iOS CoreLocation +
 launch                                     'Allow Once / While Using / Always'). If denied,     Android Location API
                                            user enters city manually. Stored in Supabase
                                            user profile.
 Location stored in user           P0       User's lat/lng (or city fallback) stored in          Supabase PostGIS
 profile                                    Supabase. Updated each foreground open.              extension (free tier)
                                            Used by all 5 verticals for proximity queries.
 Global radius preference          P0       User sets preferred search radius: 2 / 5 / 10 / 25   Supabase
                                            miles. Default: 10 miles. Applies to all location-   user_settings table
                                            filtered content globally.
 All distance queries server-      P0       Proximity queries run on Supabase with PostGIS Supabase PostGIS +
 side                                       ST_Distance or ST_DWithin. Never calculate      spatial index
                                            distance client-side. Prevents stale/inaccurate
                                            results.
 Fallback: city-level location     P0       If user denies GPS and skips manual entry,           Hardcoded fallback +
                                            default to Miami city center (25.7617° N,            Supabase
                                            80.1918° W) with a visible 'Update your location'
                                            prompt.
 Privacy: distance only,           P0       User coordinates never shown to other users. All     Legal + UI
 never coordinates                          proximity output shown as '{X} miles away' or        enforcement
                                            neighborhood name only. No exact addresses
                                            stored for peer listings (Breast Milk Hub).
 Google Maps SDK — in-app          P0       All map views use Google Maps iOS/Android            Google Maps SDK
 maps                                       SDK. Required for pins, clustering, and
                                            directions links. Free up to 28k map loads/
                                            month.
 Google Places                     P1       Location search uses Google Places API for           Google Places API
 Autocomplete                               autocomplete when user types location                (~$0.002/request)
                                            manually.
 OneSignal geofencing —            P1       Push notifications for nearby events/specialists     OneSignal free tier (up
 push by location                           use OneSignal location segments. No manual           to 10k subscribers)
                                            targeting needed.
 Background location               P2       Optional: detect when user is near an event          iOS + Android
 nudges                                     venue → 'You're almost there!' nudge. Requires       background location
                                            'Always' location permission and separate
                                            consent prompt.


 Vertical               Map View       Radius       Distance        Geo Push        Location Tool
                                       Filter       Badge

The Village — Confidential · Page 2



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 1 — Breast Milk        P1            P0           P0            —    Supabase PostGIS + Google Maps
 Hub                                                                  SDK
 2 — Specialists        P0            P0           P0            P1   Google Maps SDK + Supabase
                                                                      PostGIS
 3 — Events             P0            P0           P0            P1   Google Maps SDK + OneSignal
                                                                      geofence
 4 — Knowledge          —             —            —             —    Supabase: location tag on content
 5 — Support            P1            P0           P0            —    Google Maps SDK + Supabase
 Groups                                                               PostGIS




The Village — Confidential · Page 3



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026



 🍼 Spec 1 — Breast Milk Hub
 Certified Banks · Peer Sharing · Safety Resources · Location-Based Matching


 Feature Specification · PRD v1.0 · April 2026


Problem Statement
Mothers with oversupply and mothers whose babies need donor milk have no single, safe, mobile-first place to
connect in Miami. Certified milk banks are hard to find and have long screening processes. Peer sharing exists on
Facebook and apps like Udderly and HM4HB, but mothers don't know about them or how to navigate them safely.
No current platform provides a clear, tiered, safety-first experience that routes mothers to the right resource —
certified bank first, peer options second, with full informed consent at every step.

Goals
• Every session begins with certified bank options BEFORE peer options — 100% of the time
• Safety acknowledgment completed by 100% of users before accessing peer listings
• Miami-area milk bank contact surfaced within 2 taps, with distance and map
• In v1: zero in-app financial transactions — all payments routed to external platforms
• AI correctly routes mother to the right tier in >90% of test cases

Non-Goals
• NOT processing milk payments in v1 — link to Udderly / Only the Breast externally
• NOT screening donors ourselves — that is the certified bank's clinical role
• NOT building in-app messaging in v1 — routing to external contact methods
• NOT making medical claims — display FDA/AAP guidelines only, with source links
• NOT storing exact donor addresses — neighborhood name only

User Stories
Mother with oversupply
• As a mother with excess milk, I want to know how to donate safely so that my milk helps a baby who needs it
and I understand what I'm agreeing to
• As a mother with oversupply, I want to find a certified milk bank near me so I can donate through a vetted,
pasteurized process
• As a mother with oversupply, I want to post a peer listing so that local mothers can find me without me sharing
my home address
Mother needing donor milk
• As a mother whose baby needs donor milk, I want to find the nearest certified bank so that I know the milk is
pasteurized and screened
• As a mother considering peer milk, I want to read the safety guidelines first so that I can make a fully informed
decision
• As a mother near a donor, I want to see how far away they are without seeing their exact address
The Village (Safety & Legal)
• As the app, I want every user to complete a safety acknowledgment before seeing peer listings so that no
exchange happens without informed consent
• As the app, I want listings to expire automatically so that outdated offers are never shown

Screen Flow
 Step     Screen                        What the user does / sees
 1        Hub Home                      User sees 3 tiers (Certified / Peer Apps / Community) with a safety notice
                                        banner. Certified section is open by default; peer sections require safety
                                        gate.




The Village — Confidential · Page 4



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 2       Safety Gate                    Full-screen modal with FDA/AAP summary. User must tap 'I understand the
                                        risks and will consult my pediatrician' before peer content unlocks. Logged
                                        in Supabase.
 3       Certified Banks                List of certified banks sorted by distance. Each card shows: name, distance,
                                        phone, map preview. 'Get directions' opens Google Maps.
 4       Certified Bank Map             Google Maps view with pins for all nearby banks. Tap pin → card with phone
                                        and website. Distance shown on each pin.
 5       Peer Listings — Browse         Filtered list of offer/seek listings within user's radius. Each card shows: type,
                                        quantity, neighborhood, distance, verified badge (if applicable). No phone
                                        number visible.
 6       Listing Detail                 Expanded listing: type, quantity, neighborhood, date posted, notes, donor's
                                        verified badge. Contact button shown: tap to reveal contact method (SMS/
                                        WhatsApp). Phone never shown in plain text.
 7       Post a Listing                 Form: offer or seek, quantity (oz), neighborhood (from GPS — not editable
                                        to street level), contact preference (SMS/WhatsApp/email), diet/health
                                        notes, safety checkbox. Submit → pending review.
 8       My Listings                    User sees their active listings, status (active/matched/archived), expiry date.
                                        Can deactivate or re-post.
 9       Report a Listing               Flag button on every listing → reason selection (unsafe content, spam,
                                        scam, other) → submitted to admin queue. Listing hidden after 3 flags.
 10      AI Routing                     'I need donor milk' or 'I have extra milk' typed in search → AI responds with
                                        tier recommendation + nearest bank distance + peer listing count in their
                                        radius.


Requirements
P0 — Must Have
 Requirement                      P        Acceptance Criteria                                   Notes / Connector
 Certified milk bank locator +    P0       User sees Mothers' Milk Bank of Florida +             HMBANA.org data +
 map                                       HMBANA directory within 2 taps. Distance              Google Maps SDK +
                                           calculated from user location. Map pins +             Supabase PostGIS
                                           directions link. Sorted nearest first.
 Safety acknowledgment            P0       Full-screen modal before peer content. FDA/           Simple modal +
 gate                                      AAP summary shown. User must explicitly tap           Supabase:
                                           confirm. Gate re-shown if user clears app data.       safety_ack_at field
                                           Logged in Supabase with timestamp.
 Safety resource library          P0       Dedicated articles: FDA guidelines, AAP               Static content in
                                           recommendations, safe storage temps,                  Supabase — reviewed
                                           pasteurization basics, home pasteurization risks.     before launch
                                           Linked sources.
 External platform links          P0       Deep links to: Udderly, Share the Drop, Only the      Deep links — no in-
                                           Breast, HM4HB Florida Facebook group. Each            app hosting
                                           link shows a brief description and what to
                                           expect.
 AI routing assistant             P0       'I need donor milk' / 'I have extra milk' → Claude    Claude API +
                                           recommends tier, nearest bank distance, peer          Supabase location
                                           listing count in radius.                              query




The Village — Confidential · Page 5



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 Tier visual labeling             P0       Color-coded tiers throughout: Tier 1 Certified       UI design — enforced
                                           (green), Tier 2 Apps (blue), Tier 3 Community        in Supabase
                                           (gray). Never mix tiers in the same list.            content_tier field
 Location-based listing filter    P0       Listings filtered to user's radius (2/5/10/25        Supabase PostGIS
                                           miles). Distance displayed as '{X} miles away'.      ST_DWithin on
                                           Exact address never stored or shown.                 listings.lat/lng
 Certified bank map               P0       All HMBANA-member banks and Mothers' Milk            Google Maps SDK +
                                           Bank of Florida shown on Google Map with             Supabase PostGIS
                                           distance and directions. Map view requires 1 tap
                                           from Hub Home.
P1 — Should Have
 Requirement                      P        Acceptance Criteria                                  Notes / Connector
 In-app peer listing board        P1       Mothers post: offer or seek, quantity (oz),          Supabase listings
                                           neighborhood (GPS-derived, not exact), contact       table + admin
                                           method, diet/health notes. Reviewed by admin         moderation queue
                                           within 24h before going live.
 Listing expiry (auto-archive)    P1       Listings automatically archived after 30 days.     Supabase cron +
                                           User gets push 7 days before expiry: 'Your listing OneSignal push
                                           is expiring — renew it?' One-tap renewal resets
                                           timer.
 Phone-verified badge             P1       Users who verify phone number via OTP get a          Twilio Verify (~$0.05/
                                           'Verified' badge on their listings. Builds trust     check)
                                           without revealing identity.
 Report / flag listing            P1       Flag button on every listing. Reason options:        Supabase flags table +
                                           unsafe content, scam, outdated, spam. 3 flags        admin CMS
                                           → listing hidden, admin alerted. Admin can
                                           restore or permanently remove.
 Secure contact routing           P1       Contact button shows donor's preferred method        Supabase:
                                           (SMS/WhatsApp/email) only after tap.                 contact_pref field +
                                           Generates pre-filled message template. Never         app-generated
                                           exposes raw phone number in UI.                      message
 Listing state tracking           P1       Listing states: draft → pending_review → active      Supabase: status
                                           → matched → archived. User can mark                  enum on listings table
                                           'matched' when connection made. Matched
                                           listings hidden from browse but shown in user's
                                           history.
P2 — Future
 Requirement                      P        Acceptance Criteria                                  Notes / Connector
 In-app payments (milk            P2       Sellers receive payment in-app; buyers               Stripe Connect —
 sales)                                    protected by Stripe. Only available for 'For Sale'   requires legal review
                                           tier listings.                                       first
 Seller ID verification           P2       Sellers must submit government ID before listing     Stripe Identity ($1.50/
                                           for sale. One-time check per user.                   check)
 Monthly safety re-screening      P2       Active sellers prompted monthly to re-confirm no     Supabase cron +
                                           new medications, illnesses, or diet changes.         OneSignal
 Milk bank live inventory         P2       Live availability / waitlist status from certified   Custom API —
                                           banks via API partnership.                           requires bank
                                                                                                partnership agreement



The Village — Confidential · Page 6



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Data Model — Listings Table
 Field                       Type              Rules / Description
 id                          UUID             Primary key. Auto-generated.
 user_id                     UUID (FK)        References users table. One user can have max 1 active offer + 1
                                              active seek listing.
 listing_type                enum: offer |    Whether the user is offering or seeking milk.
                             seek
 quantity_oz                 integer          Approximate ounces available or needed. Required for offer type.
 neighborhood                string           Derived from GPS lat/lng using reverse geocoding (e.g., 'Coral
                                              Gables'). User cannot enter street address.
 lat / lng                   float            Stored server-side for proximity queries. NEVER returned to client or
                                              shown in UI.
 city                        string           Always 'Miami' in v1. Indexed for future multi-city expansion.
 contact_pref                enum: sms |      How the donor prefers to be contacted. Shown only after user taps
                             whatsapp |       'Contact'.
                             email
 contact_value               encrypted        Phone or email. Encrypted at rest. Never shown in plain text in UI —
                             string           only used to generate pre-filled message.
 health_notes                text             Optional: diet, medications, health conditions. Shown on listing detail.
                                              User-entered free text.
 safety_ack_at               timestamp        When user completed the safety acknowledgment. Listing cannot be
                                              created without this.
 verified                    boolean          True if user's phone number is OTP-verified via Twilio.
 status                      enum             draft → pending_review → active → matched → archived. See
                                              business rules.
 flags_count                 integer          Number of user flags. >= 3 → auto-hidden, admin alerted.
 expires_at                  timestamp        created_at + 30 days. Cron job checks daily and archives expired
                                              listings.
 created_at / updated_at     timestamp        Standard audit fields.


Business Rules
• BR-1: Certified banks ALWAYS appear before peer listings in every view. This cannot be overridden by filters.
• BR-2: Safety acknowledgment gate is required once per account. Re-shown if app data is cleared.
• BR-3: A user can have maximum 1 active offer listing and 1 active seek listing at the same time.
• BR-4: Exact coordinates (lat/lng) are NEVER returned to the client or shown in the UI. Neighborhood name only.
• BR-5: Listings hidden automatically after 3 user flags. Admin review within 24h.
• BR-6: Listings auto-archive after 30 days. User notified at day 23 with one-tap renewal.
• BR-7: Contact information is never displayed in the listing card. Only visible after intentional tap.
• BR-8: Admin must approve all new listings within 24h before they go live (peer listing board only).
• BR-9: Financial transactions are NOT facilitated in v1. Any listing tagged 'for sale' links to external platform only.




The Village — Confidential · Page 7



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Success Metrics
 Type                   Metric                                   Target           How to Measure
 Safety                 Safety gate completion rate              >95% of users    Mixpanel:
                                                                 who open peer    safety_ack_completed
                                                                 section
                                                                 complete
                                                                 acknowledgme
                                                                 nt
 Leading                Certified bank contact rate              >30% of Hub      Mixpanel:
                                                                 sessions →       bank_contact_tapped
                                                                 bank contact
                                                                 tapped
 Leading                AI routing accuracy                      >90% correct     Manual QA + Claude eval
                                                                 tier             logs
                                                                 recommendati
                                                                 on (monthly
                                                                 QA test)
 Leading                Listing post rate                        >20% of Hub      Mixpanel: listing_posted +
                                                                 users post or    listing_browsed
                                                                 browse peer
                                                                 listings
 Lagging                Zero liability incidents                 0 reported       Support tickets + legal
                                                                 unsafe           review
                                                                 exchanges
                                                                 attributed to
                                                                 The Village
 Lagging                Repeat usage                             40% of Hub       Mixpanel: retention cohort by
                                                                 users return     feature
                                                                 within 30 days


Open Questions
• [Legal] CRITICAL: Legal review of peer listing board liability before launch. Determine if Terms of Service
indemnification is sufficient.
• [Legal] Does The Village need specific Terms of Service language covering breast milk exchanges? Draft with
healthcare attorney.
• [Design] How prominent should the safety warning be on every peer listing card? Repeated icon? Banner? Full-
screen only once?
• [Business] Formal partnership with Mothers' Milk Bank of Florida — can we get a referral agreement or featured
placement?
• [Engineering] Reverse geocoding for neighborhood name: use Google Geocoding API (~$0.005/call) or
Supabase + Nominatim (free)?
• [Moderation] Who reviews listings within 24h? Paid admin or volunteer moderator? Define the moderation
protocol now.




The Village — Confidential · Page 8



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026



 🏥 Spec 2 — Specialist Directory
 OB/GYN · Midwives · Doulas · Lactation Consultants · Pediatricians


 Feature Specification · PRD v1.0 · April 2026


Problem Statement
Expectant and new mothers in Miami struggle to find trusted, bilingual maternity specialists — especially doulas,
lactation consultants, and postpartum providers not surfaced by standard Google searches. The process involves
fragmented websites, outdated directories, and no way to filter by language, distance, insurance, or telehealth.
Without the right provider, mothers delay care and risk worse outcomes. The Village solves this with a curated,
searchable, bilingual directory of verified Miami specialists, sorted by proximity.

Goals
• 80% of mothers find a relevant specialist within 2 minutes of opening the directory
• 50+ verified Miami specialists onboarded by end of Month 2
• 40% of directory visits result in a contact action (call, message, or booking)
• 100% of listings available in English and Spanish at launch
• Every listing shows distance from user — no specialist shown without a proximity indicator

Non-Goals
• NOT building our own telemedicine platform — link to providers' existing tools (Doxy.me, Zoom)
• NOT verifying insurance in real time in v1 — display what providers self-report
• NOT enabling in-app payments for consultations in v1 — handled externally
• NOT expanding beyond Miami-Dade County in v1
• NOT allowing self-signup by providers in v1 — all listings manually reviewed and added by admin

User Stories
Expectant Mother (first trimester)
• As an expectant mother, I want to search for a bilingual OB/GYN near me so that I can find a doctor who speaks
my language and understands my culture
• As an expectant mother, I want to see providers within 10 miles first so that I'm not overwhelmed by irrelevant
results
• As an expectant mother, I want to see which providers offer telehealth so that I can consult from home during my
first trimester
Postpartum Mother
• As a postpartum mother, I want to quickly find a lactation consultant available this week so that I can get
breastfeeding help before my supply drops
• As a postpartum mother, I want to read reviews from other moms so that I feel confident before contacting a
provider
• As a postpartum mother, I want to save a specialist to my profile so that I can reach them later without searching
again
The Village (Admin)
• As an admin, I want to manually update specialist listings so that contact info stays current and accurate
• As an admin, I want to flag listings for review when a provider no longer accepts new patients




The Village — Confidential · Page 9



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Screen Flow
 Step     Screen                        What the user does / sees
 1        Directory Home                Category chips (OB/GYN, Doula, LC, Midwife, Pediatrician) + search bar +
                                        'Near me' toggle. Default: sorted by distance within user's radius.
 2        Search Results — List         Scrollable list. Each card: photo, name, credential, specialty badge,
          View                          language badges, distance, telehealth badge, star rating. 'Nearest first'
                                        default sort.
 3        Map View                      Toggle button switches to Google Maps view. All specialists in radius shown
                                        as color-coded pins by specialty. Tap pin → mini profile card. Tap card → full
                                        profile.
 4        Filter Panel                  Drawer from bottom: Specialty multi-select, Language (EN/ES/Other),
                                        Telehealth (yes/no), Radius (2/5/10/25 mi). Active filters shown as
                                        dismissible chips above results.
 5        Specialist Profile            Header: photo, name, credentials, specialty. Sections: About (bio), Services,
                                        Languages, Telehealth info, Insurance accepted, Location (static map +
                                        address), Contact actions, Reviews.
 6        Contact Action                Tap 'Call' → tel: link. Tap 'WhatsApp' → wa.me link with pre-filled message.
                                        Tap 'Book' → provider's Calendly/Zocdoc. All actions tracked in Mixpanel.
 7        Save to Profile               Heart icon on profile → saved. Appears in user's 'Saved specialists' in profile
                                        tab. Push option: 'Remind me to book this provider' → user sets date for
                                        reminder.
 8        Leave a Review                After contact action, in-app prompt at next app open: 'Did you visit {Name}?
                                        Leave a quick review.' 1–5 stars + optional text. Goes live after 24h
                                        moderation window.
 9        No Results State              If radius yields no results → auto-expand to all Miami-Dade + message: 'No
                                        {specialty} within {X} miles. Showing all Miami results.' User can adjust
                                        radius in filter.


Requirements
P0 — Must Have
 Requirement                      P        Acceptance Criteria                                 Notes / Connector
 Category browse                  P0       Category chips on home screen. Tap → filtered       Supabase: specialty
                                           list. Categories: OB/GYN, Midwife, Doula,           field, manual curation
                                           Lactation Consultant, Pediatrician, Postpartum
                                           Nurse.
 Search by name or keyword        P0       Search bar with real-time results. Searches:        Supabase full-text
                                           name, specialty, services field. Minimum 2          search (pg_trgm)
                                           characters to trigger search.
 Distance display on every        P0       Each specialist card shows '{X} miles away' from    Supabase PostGIS
 card                                      user's current location. Calculated via Supabase    ST_Distance
                                           PostGIS.
 Radius filter — default 10       P0       Radius options: 2 / 5 / 10 / 25 miles. Default: 10   Supabase PostGIS
 miles                                     miles. If no results in radius, expand to all Miami- ST_DWithin
                                           Dade automatically with notice.
 Sort by distance (default)       P0       Default sort: nearest first. User can switch to     Supabase ORDER BY
                                           'Highest rated' or 'Most reviewed'. Sort            distance ASC
                                           preference saved per session.



The Village — Confidential · Page 10



                     ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 Map view — Google Maps           P0       Map toggle shows all in-radius specialists as        Google Maps SDK
 SDK                                       color-coded pins. Clustered when zoomed out.         (iOS + Android)
                                           Tap pin → mini card. Tap card → full profile.
 Language filter                  P0       Filter to bilingual providers (EN/ES) or specific    Supabase:
                                           language. Language shown as badges on every          languages[] array field
                                           card.
 Telehealth filter                P0       Filter to providers offering virtual visits.         Supabase: telehealth
                                           Telehealth badge shown prominently on cards          boolean field
                                           and profile.
 Specialist profile page          P0       Full profile: photo, name, credentials, specialty,   Supabase specialists
                                           bio EN+ES, services[], languages[], telehealth       table + admin CMS
                                           info, insurance[], contact actions, static map,
                                           reviews.
 Contact actions                  P0       Call (tel:), WhatsApp (wa.me), Website link. All     tel: links + wa.me +
                                           tracked. Phone number shown only after tap —         Mixpanel
                                           not in list view.
 Spanish language toggle          P0       All specialist bios and services viewable in         Google Translate API
                                           Spanish. Toggle visible on profile screen.           (auto) or manually
                                                                                                entered bio_es
P1 — Should Have
 Requirement                      P        Acceptance Criteria                                  Notes / Connector
 Save specialist to profile       P1       Heart button on profile → saved. 'Saved              Supabase:
                                           specialists' tab in user profile. Optional: set a    saved_specialists
                                           reminder to book.                                    junction table +
                                                                                                OneSignal
 Reviews & ratings                P1       1–5 star rating + optional text review. Shown on     Supabase reviews
                                           profile. Avg displayed on card. 24h moderation       table + admin
                                           before going live.                                   moderation
 AI specialist matcher            P1       'I need help with X' typed in search → Claude        Claude API + specialty
                                           recommends specialty type and links to filtered      routing logic
                                           list.
 In-app booking link              P1       'Book appointment' button → provider's         Calendly URL field in
                                           Calendly, Zocdoc, or website booking page (URL Supabase + external
                                           stored in profile).                            link
 SMS appointment reminder         P1       After booking (user confirms externally), user       Twilio SMS +
                                           can set an in-app reminder → SMS sent 24h            OneSignal
                                           before date.
 Verified provider badge          P1       NPI number stored and verified against NPI           NPI Registry API (free
                                           Registry. Verified badge shown on card and           public API)
                                           profile.
P2 — Future
 Requirement                      P        Acceptance Criteria                                  Notes / Connector
 Insurance filter                 P2       Filter by accepted insurance plan (Medicaid,         Insurance verification
                                           BlueCross, Cigna, etc.).                             API or self-reported
                                                                                                field
 Provider video intro             P2       30-second video from each provider on their          Supabase Storage /
                                           profile.                                             CDN




The Village — Confidential · Page 11



                     ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 Provider self-management             P2   Providers log in and update their own profiles,        Separate provider web
 portal                                    hours, insurance info.                                 portal — new build
 Haitian Creole support               P2   Creole translation for Miami's Haitian community. Google Translate API
 Referral tracking                    P2   Providers can see how many patients found              Mixpanel + provider
                                           them via The Village (anonymous aggregate              dashboard
                                           only).


Data Model — Specialists Table
 Field                       Type              Rules / Description
 id                          UUID             Primary key.
 name                        string           Full name e.g. 'Dr. Maria Gonzalez'. Required.
 credentials                 string           e.g. 'MD', 'CNM', 'IBCLC', 'CD(DONA)'. Shown next to name.
 specialty                   enum[]           Array: OB_GYN | MIDWIFE | DOULA | LACTATION_CONSULTANT |
                                              PEDIATRICIAN | POSTPARTUM_NURSE
 bio_en / bio_es             text             Long-form bio in English and Spanish. bio_es can be auto-translated
                                              if not provided manually.
 services                    text[]           Array of service strings e.g. ['Prenatal care', 'Home birth', 'Postpartum
                                              visits'].
 languages                   string[]         e.g. ['English', 'Spanish', 'Haitian Creole'].
 telehealth                  boolean          True if provider offers virtual visits.
 photo_url                   string           Supabase Storage URL. Required — category placeholder used if not
                                              provided.
 lat / lng                   float            Provider's primary practice location. Used for all distance calculations.
 address / city / zip        string           Display address (e.g. '123 Coral Way, Miami, FL 33145'). Not used for
                                              proximity — lat/lng used instead.
 phone                       string           Stored but not shown in list view. Revealed only on tap of 'Call' button.
 whatsapp                    string           WhatsApp number for wa.me link. Optional.
 website / calendly_url      string           External booking or website URL.
 insurance                   string[]         Self-reported accepted insurance plans.
 npi_number                  string           NPI Registry identifier. Used for verified badge.
 verified                    boolean          True if NPI verified against NPI Registry API.
 rating_avg                  float            Computed from reviews table. Updated on each new review.
 review_count                integer          Denormalized count from reviews table.
 active                      boolean          False = hidden from all users. Used when provider leaves the
                                              directory.
 created_at / updated_at     timestamp        Standard audit fields. Admin tracks last manual review.




The Village — Confidential · Page 12



                     ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Business Rules
• BR-1: All specialist listings must be manually reviewed and approved by admin before going live. No self-signup
in v1.
• BR-2: Phone numbers are NEVER shown in list view. Shown only after intentional tap on the contact button.
• BR-3: If no specialists found in user's radius, auto-expand to all Miami-Dade with a notice: 'No results within X
miles. Showing all Miami providers.'
• BR-4: Specialists without a photo use a category-specific placeholder icon. A blank image is never shown.
• BR-5: Reviews go live after 24h moderation window with no admin flag. Admin can remove reviews that violate
guidelines.
• BR-6: Verified badge shown ONLY for providers with a confirmed NPI number. Never added manually.
• BR-7: Providers marked active=false are immediately hidden from all users and searches.

Success Metrics
 Type                   Metric                                         Target              How to Measure
 Leading                % of users who open directory within first 7   >60%                Mixpanel: directory_opened
                        days
 Leading                Time to first contact action                   <2 minutes          Mixpanel funnel:
                                                                       median              directory_opened →
                                                                                           contact_tapped
 Leading                Filter usage rate                              >40% of             Mixpanel: filter_applied
                                                                       directory
                                                                       sessions use
                                                                       at least 1 filter
 Leading                Map view usage                                 >20% of             Mixpanel:
                                                                       directory           map_view_toggled
                                                                       sessions use
                                                                       map view
 Lagging                Contact conversion rate                        >25% of profile     Mixpanel: profile_view →
                                                                       views →             contact_tapped
                                                                       contact action
 Lagging                Specialist retention (stay listed 90d)         >80%                Admin CRM — manual
                                                                                           tracking


Open Questions
• [Legal] Need a disclaimer on every profile: 'The Village does not verify licenses in v1. Always verify credentials
independently.'
• [Design] Map view or list view as default? A/B test with first 50 beta users to determine preference.
• [Engineering] Can we auto-import Miami specialist data from Zocdoc or Healthgrades? Legal review required
before scraping.
• [Business] Specialist onboarding: email outreach or form-based self-submission with admin approval gate?
• [Admin] How often do we audit listings for accuracy? Propose quarterly review cycle with reminder emails to
providers.




The Village — Confidential · Page 13



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026



 🎉 Spec 3 — Events & Community
 Baby Trails · Classes · Stroller Walks · Meetups · Local Family Events


 Feature Specification · PRD v1.0 · April 2026


Problem Statement
New and expectant mothers in Miami are isolated — especially after birth, when leaving the house is hard and
community feels impossible. Existing platforms (Eventbrite, Facebook) are noisy and not tailored to mothers'
needs. There is no single place to discover stroller walks, sensory events like Baby Trails, free community
programs, and mom meetups — all filtered by baby age, distance, and cost. The Village becomes that trusted,
curated calendar.

Goals
• Mothers discover at least 3 relevant local events in their first session
• Baby Trails Miami featured as launch partner — event feed embedded at launch
• 50+ events listed in the Miami calendar within Month 1
• 30% of users RSVP or save at least one event per month
• Every event shows distance — no event card without a proximity indicator

Non-Goals
• NOT a general-purpose events platform — focused on maternity and early parenthood only
• NOT hosting live-streamed events in v1 — in-person + external virtual links only
• NOT charging mothers to attend events in v1 — paid ticketing is P1
• NOT expanding beyond Miami-Dade events in v1

User Stories
Expectant Mother (32 weeks)
• As an expectant mother, I want to find childbirth prep classes near me sorted by distance so that I can choose
the closest one
• As an expectant mother, I want to add events to my Google Calendar so that I don't forget them
New Mother (3-month-old baby)
• As a new mother, I want to find sensory play events for my baby's age within 10 miles so that I can get out of the
house and meet other moms
• As a new mother, I want a push notification when a new event is added near me so that I never miss something
I'd enjoy
Event Organizer (e.g. Baby Trails)
• As a partner event organizer, I want my events in The Village feed with our branding so that I reach Miami
mothers who need our community

Screen Flow
 Step     Screen                        What the user does / sees
 1        Events Home                   Header: 'What's near you?' Location badge showing user's city/
                                        neighborhood. Featured Baby Trails banner (always top). List of upcoming
                                        events sorted by date within radius.
 2        Filter Panel                  Swipe up from bottom: Age filter (pregnancy / 0-3mo / 3-6mo / 6-12mo /
                                        12mo+), Cost (free/paid/all), Distance (2/5/10/25mi), Category (class/
                                        meetup/sensory/workshop). Multiple active filters shown as chips.
 3        List View                     Each card: image, event name, host, date+time, distance badge, age
                                        badge, cost badge (Free / $X), 'X spots left' if capacity set. Tap → Event
                                        Detail.


The Village — Confidential · Page 14



                      ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 4       Map View                       Toggle to Google Maps. Events in radius shown as pins. Color by category.
                                        Clustered when zoomed out. Tap pin → event mini card. Tap card → Event
                                        Detail.
 5       Event Detail                   Full info: image, title, host (with logo if partner), date/time, venue, distance,
                                        embedded Google Map, description, what to bring, age range, cost,
                                        capacity/spots left, host contact.
 6       RSVP / Save                    'RSVP — I'm going!' CTA. If free: immediate confirmation + push reminder
                                        set. If paid: redirected to external ticket link (Eventbrite/host site). Save
                                        (bookmark) always available.
 7       RSVP Confirmed                 Confirmation screen: 'You're in! 🎉 We'll remind you the day before.' Option
                                        to add to Google Calendar. Share event to WhatsApp/text.
 8       My Events                      Profile tab: 'My events' shows upcoming RSVPs and saved events. Past
                                        events shown below with option to leave a post/photo.
 9       Event Cancelled                If event cancelled: all RSVPed users get push 'Event cancelled: {Name}'.
                                        Listing shows 'Cancelled' banner. Not deleted — kept in history.


Requirements
P0 — Must Have
 Requirement                      P        Acceptance Criteria                                    Notes / Connector
 Events list view — distance      P0       Upcoming events sorted by date within user's           Supabase PostGIS
 sorted                                    radius. Each card shows distance badge from            ST_DWithin + distance
                                           user's GPS location.                                   in query
 Map view of events               P0       Toggle to Google Maps view. Events in radius           Google Maps SDK +
                                           shown as pins. Tap pin → event mini-card. Only         Supabase PostGIS
                                           events within radius shown on map by default.
 Distance badge on every          P0       Every event card shows '{X} miles from you'. If        Supabase PostGIS
 card                                      user location unknown, show distance from              ST_Distance
                                           Miami city center with a 'Set location' prompt.
 Radius filter for events         P0       Filter options: 2 / 5 / 10 / 25 miles. Default: 10     Supabase geo query +
                                           miles. Synced with user's global radius                user_settings
                                           preference.
 Baby age filter                  P0       Filter: Pregnancy / 0-3mo / 3-6mo / 6-12mo /           Supabase:
                                           12mo+. Baby's age derived from user profile            events.baby_age_min/
                                           (due date or baby birthdate). Pre-applied on first     max fields
                                           session.
 Event detail page with           P0       Full info + embedded Google Maps Static map            Supabase + Google
 embedded map                              showing venue pin. 'Get directions' opens native       Maps Static API
                                           maps app.
 Baby Trails featured             P0       Baby Trails events always appear at the top of         Baby Trails partner
 integration                               the list with partner branding, regardless of date     data feed +
                                           sort. Never filtered out by baby age filter.           featured=true flag
 Save / bookmark event            P0       Bookmark icon on every card. Saved events              Supabase
                                           appear in profile. Push reminder sent 24h before       saved_events table +
                                           event.                                                 OneSignal
 Google Calendar integration P0            'Add to my calendar' on event detail → opens           Google Calendar API /
                                           Google Calendar with event title, date, time,          calendar: deep link
                                           venue, description pre-filled.



The Village — Confidential · Page 15



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 Free vs. paid labeling           P0       Free events show a green 'Free' badge. Paid        Supabase:
                                           events show '${amount}'. Both shown on card        events.price field (0 =
                                           and detail. Never ambiguous.                       free)
P1 — Should Have
 Requirement                      P        Acceptance Criteria                                Notes / Connector
 Eventbrite live feed             P1       Miami maternity/family events auto-imported        Eventbrite API — rate
                                           from Eventbrite daily. Deduplication check to      limits to check
                                           avoid double-listing.
 In-app ticket purchase           P1       For paid events, mother buys tickets without       Stripe + Eventbrite
                                           leaving the app. Stripe + Eventbrite ticketing     ticketing API
                                           integration.
 Submit a Village Meetup          P1       Any user can propose a community meetup via        Supabase + admin
                                           form. Admin reviews + approves before              CMS + OneSignal
                                           publishing. Organizer notified.
 Community event feed             P1       After attending, mothers can post a photo +        Supabase + image
                                           caption to the event's feed. Other RSVPed users    upload (Supabase
                                           see the posts.                                     Storage)
 AI weekly event picks            P1       Every Monday: 'Your picks this week' — 3           Claude API +
                                           personalized events based on baby age + user's     Supabase event query
                                           location. Shown on home feed.
 Geo-push: new nearby             P1       Push notification when a new event is published    OneSignal location
 event                                     within user's radius. Respects notification        segments / geofence
                                           preferences.
 Capacity tracking                P1       Events with max_capacity set show 'X spots left'   Supabase: rsvp_count
                                           when <10 remaining. Full events show 'Join         vs max_capacity
                                           waitlist' instead of RSVP.
 Event cancellation handling      P1       If event cancelled: all RSVPed users get           Supabase:
                                           immediate push. Event listing shows 'Cancelled'    status='cancelled' +
                                           banner. Not deleted.                               OneSignal bulk push
P2 — Future
 Requirement                      P        Acceptance Criteria                                Notes / Connector
 QR code event check-in           P2       Organizer generates a QR code. Attendees scan Custom QR
                                           to check in. Attendance data visible to organizer. generation +
                                                                                              Supabase
 Event photo albums               P2       Shared photo album per event. All attendees can Supabase Storage +
                                           upload photos post-event.                       in-app gallery
 Facebook Events import           P2       Auto-import from Facebook Events API for           Facebook Graph API
                                           Miami family events.                               — requires FB
                                                                                              approval
 Village-branded events           P2       The Village hosts its own branded stroller walks   Internal ops +
                                           and meetups.                                       Eventbrite self-listing




The Village — Confidential · Page 16



                     ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Data Model — Events Table
 Field                       Type              Rules / Description
 id                          UUID             Primary key.
 title                       string           Event name. Required.
 description                 text             Full description. Supports EN and ES versions.
 host_name                   string           Name of organizer or partner (e.g. 'Baby Trails Miami').
 partner_id                  UUID (FK)        FK to partners table if this is a partner-sourced event.
 venue_name                  string           Name of venue or 'Online'. Required.
 address / lat / lng         string + float   Full address for display; lat/lng for proximity. Online events: lat/lng =
                                              null.
 city                        string           Always 'Miami' in v1.
 date                        date             Event date. Past events auto-archived 48h after end_time.
 time_start / time_end       time             Start and end time. time_end optional.
 price                       integer          Cost in cents. 0 = free. Displayed as 'Free' or '$X.XX'.
 ticket_url                  string           External URL for paid ticket purchase (Eventbrite, host site, or Stripe
                                              link).
 baby_age_min /              integer          Age range in months. -1 = all ages. Pregnancy events: min=-1,
 baby_age_max                                 max=0.
 category                    enum             class | meetup | sensory | workshop | walk | support | other
 image_url                   string           Event image. Supabase Storage URL. Category placeholder if not
                                              provided.
 max_capacity                integer          Null = unlimited. Enables 'X spots left' display when rsvp_count
                                              approaches limit.
 rsvp_count                  integer          Denormalized count updated on each RSVP. Checked against
                                              max_capacity.
 featured                    boolean          True = Baby Trails or Village-promoted event. Always shown at top.
 status                      enum             draft → published → cancelled → past. Past: auto-set 48h after
                                              end_time.
 source                      enum             manual | eventbrite | baby_trails | user_submitted
 created_at / updated_at     timestamp        Standard audit fields.


Business Rules
• BR-1: Events auto-archive to status='past' 48 hours after end_time. They remain visible in users' saved history.
• BR-2: Cancelled events are NEVER deleted — show 'Cancelled' banner. All RSVPed users get immediate push
notification.
• BR-3: Baby Trails events always appear at the top of the list with featured=true. They are never filtered out by
baby age filter.
• BR-4: Free events (price=0) must show a green 'Free' badge. Paid events must show the price. Ambiguity is
never acceptable.
• BR-5: User-submitted meetups go through admin review before going live. Submitter gets a push when
approved or rejected.
• BR-6: When rsvp_count >= max_capacity, RSVP button changes to 'Join waitlist'. Waitlisted users notified if spot
opens.
• BR-7: Geo-push for new events only fires once per event per user. Not retriggered if user reopens event.




The Village — Confidential · Page 17



                       ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Success Metrics
 Type                   Metric                                   Target            How to Measure
 Leading                Events browsed per session               >4 event detail   Mixpanel:
                                                                 views per         event_detail_viewed
                                                                 active session
 Leading                RSVP / save rate                         >30% of event     Mixpanel: event_saved +
                                                                 detail views →    event_rsvpd
                                                                 save or RSVP
 Leading                Map view engagement                      >15% of           Mixpanel:
                                                                 Events            events_map_toggled
                                                                 sessions use
                                                                 map view
 Leading                Baby Trails click-through                >20% of Baby      Mixpanel:
                                                                 Trails listings   partner_link_tapped
                                                                 → external
                                                                 ticket page
 Lagging                Monthly active event browsers            >60% of MAU       Mixpanel:
                                                                 open Events       events_tab_opened
                                                                 tab monthly
 Lagging                First Village Meetup attendance          >25 mothers       Manual RSVP count
                                                                 attend first
                                                                 hosted meetup


Open Questions
• [Business] Has Baby Trails agreed to a data-sharing partnership? — CRITICAL dependency for launch. Get
signed agreement.
• [Legal] Event liability disclaimers needed for Village-hosted meetups? Draft with attorney before first Village
Meetup.
• [Design] Events personalized by default (baby age filter auto-applied from profile) or open/unfiltered by default?
• [Engineering] Eventbrite API refresh frequency and rate limits — confirm before integration.
• [Operations] Who curates the manual event calendar initially? Admin team or community manager role?




The Village — Confidential · Page 18



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026



 📚 Spec 4 — Knowledge & Education
 AI Q&A · Week Guide · Birth Plan Builder · Curated Articles · Local Resources


 Feature Specification · PRD v1.0 · April 2026


Problem Statement
Pregnant and postpartum mothers are overwhelmed by unreliable information from Google, social media, and
well-meaning relatives. They need fast, trusted, personalized answers — in their language, at 2am, without a
doctor's appointment. No current app combines AI-powered Q&A with curated expert content, a week-by-week
pregnancy guide, and real-time referrals to local Miami specialists, all in one bilingual experience.

Goals
• Mothers get a relevant answer to any pregnancy or newborn question within 30 seconds
• AI Q&A handles 100+ unique question types correctly in beta testing
• 80% of pregnant users open the week-by-week guide at least once per week
• Birth plan builder used by >40% of pregnant users before their due date
• All content available in English and Spanish at launch

Non-Goals
• NOT providing medical diagnoses — AI always recommends professional consultation for medical concerns
• NOT replacing doctors — AI answers are informational only, with mandatory disclaimers
• NOT building original content in v1 — curate and cite from trusted sources (Mayo Clinic, AAP, ACOG)
• NOT building a symptom checker in v1 — requires medical oversight and legal review

User Stories
Pregnant Mother (any trimester)
• As a pregnant mother, I want to ask the AI any question about my pregnancy and get a reliable answer without
Googling or waiting for my next appointment
• As a pregnant mother, I want to see what's happening with my baby this week so that I feel connected and
informed
• As a pregnant mother, I want to build my birth plan step by step so that I'm prepared and can share it with my
OB
New Mother (0–6 months postpartum)
• As a new mother, I want to ask why my baby is doing something unusual and know whether to call a doctor or
relax
• As a new mother, I want to read postpartum recovery articles in Spanish so that I understand what my body is
going through
• As a new mother who asked about latching issues, I want the AI to show me lactation consultants near me so
that I can get help fast

Screen Flow
 Step     Screen                        What the user does / sees
 1        Knowledge Home                Three entry points: 'Ask anything' AI input field (center, prominent), 'Your
                                        pregnancy this week' card (based on due date), 'Today's read' featured
                                        article. Topic chips below.
 2        Week Guide Detail             Week N card: baby size comparison (fruit icon), development milestones,
                                        common symptoms this week, tips for the mother, 'Local note' (Miami-
                                        specific if applicable). Shareable.
 3        Ask AI — Input                Full-screen chat view. Pre-suggested questions as chips. User types free
                                        text. 'Ask' button or return key submits. Loading indicator while Claude
                                        responds.

The Village — Confidential · Page 19



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 4        AI Response                   Claude's response displayed in a warm message bubble. Medical disclaimer
                                        always shown below response. If question implies care need: 'We have {N}
                                        specialists near you →' link appended.
 5        Local Specialist Referral     Tapping the specialist referral link in AI response → Specialist Directory pre-
                                        filtered to the relevant specialty + user's current radius. Closes back to AI
                                        chat.
 6        Article Browse                Topic grid: Pregnancy / Labor & Birth / Breastfeeding / Newborn Care /
                                        Postpartum / Mental Health / Nutrition. Each shows article count. Miami-
                                        tagged articles shown first.
 7        Article Detail                Full article: title, read time, author/source, body text, images. Save
                                        (bookmark), share, 'Ask AI about this' prompt at bottom. Related articles
                                        below.
 8        Birth Plan Builder            Step-by-step guided form (8 sections). Progress bar at top. Each section:
                                        question + options (radio or multi-select) + notes field. Preview before
                                        export.
 9        Birth Plan Export             Final birth plan shown as formatted preview. Export as PDF. Share to
                                        WhatsApp or print. Stored in user profile under 'My birth plan'.
 10       Video Library                 YouTube embeds organized by topic. Tap → plays inline. Topics: Breathing,
                                        Latching, Swaddling, Skin-to-skin, Postpartum recovery.


Requirements
P0 — Must Have
 Requirement                      P        Acceptance Criteria                                  Notes / Connector
 AI Q&A — free text input         P0       Mother types any question; Claude responds           Claude API (Haiku
                                           under 5 seconds with a warm, informative             model for speed +
                                           answer. Response shown in chat bubble format.        cost)
 Medical disclaimer — every       P0       Every AI response ends with: 'This is not medical Prompt engineering —
 AI response                               advice. For medical concerns, always consult      reviewed by
                                           your provider.' Non-removable. Hard-coded in      healthcare attorney
                                           system prompt.
 AI: local specialist referral    P0       When AI response implies a care need (latch          Claude API +
 in answers                                issues, postpartum anxiety, pain, bleeding, etc.),   Supabase: count
                                           AI appends: 'We have {N} specialists near you        specialists in radius by
                                           →' with link to filtered specialist list.            specialty
 Miami-specific content           P0       Articles tagged miami_specific=true when             Supabase:
 tagging                                   referencing local hospitals, birth centers,          articles.miami_specific
                                           providers, or resources. Miami-tagged articles       + articles.tags[]
                                           appear first for all Miami users.
 Week-by-week pregnancy           P0       Based on due date from user profile → current        Supabase:
 guide                                     week calculated → content for that week              week_guide table,
                                           fetched. Content: baby size, development,            week 1–42
                                           maternal symptoms, tips.
 Top 20 curated articles at       P0       Hand-picked articles covering: labor prep,     Static content in
 launch                                    breastfeeding basics, newborn care, postpartum Supabase — requires
                                           recovery, pain management, baby blues vs PPD. editorial review
                                           Medically reviewed before publish.




The Village — Confidential · Page 20



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 Language toggle EN/ES               P0    All articles, week guide content, and AI                     Claude API: respond
                                           responses available in Spanish. Toggle visible               in user's language;
                                           and persistent across sessions.                              Google Translate API
                                                                                                        for static content
P1 — Should Have
 Requirement                         P     Acceptance Criteria                                          Notes / Connector
 Personalized content feed           P1    Home feed shows articles relevant to user's                  Supabase:
                                           current pregnancy week OR baby age. Powered                  articles.week_min/max
                                           by week/age fields from user profile.                        + baby_age_min/max
                                                                                                        fields
 Birth plan builder                  P1    Step-by-step form (8 sections: pain mgmt, who's              Claude API (draft text
                                           in room, cord cutting, skin-to-skin, placenta,               suggestions per
                                           photography, feeding, neonatal requests).                    section) + PDF
                                           Exports to PDF. Stored in profile.                           generation (pdfkit or
                                                                                                        similar)
 Weekly push: 'Your baby             P1    Every Monday: push with baby development                     OneSignal +
 this week'                                summary for user's current pregnancy week.                   Supabase week
                                           Personalized to user's due date.                             calculation cron
 Video library                       P1    Curated YouTube embeds by topic. Videos                      YouTube Data API +
                                           vetted for accuracy before adding. Inline                    Supabase:
                                           playback.                                                    video_library table
 'Is this normal?' quick             P1    Common symptom → quick 1-2 sentence                          Supabase: symptoms
 check                                     answer with context. Pre-built library of 50+                table + Claude API for
                                           common symptoms. Not a diagnosis tool.                       fallback
P2 — Future
 Requirement                         P     Acceptance Criteria                                          Notes / Connector
 Expert live Q&A                     P2    Monthly live session with a Miami specialist.                Zoom SDK +
                                           Mothers submit questions in advance via app.                 scheduling system
 Podcast integration                 P2    Curated maternal health podcasts browsable in                RSS / Spotify API
                                           app.
 Offline article downloads           P2    Save articles to read without internet.                      Local device storage
                                                                                                        (React Native
                                                                                                        AsyncStorage)
 'Village Verified' content          P2    Content reviewed by a licensed Miami provider                Editorial process +
 badge                                     gets a verified badge.                                       partner network


Data Model — Articles & AI
 Field                        Type             Rules / Description
 articles.id                  UUID            Primary key.
 articles.title_en /          string          Article title in English and Spanish.
 title_es
 articles.body_en /           text            Full article body. Markdown supported.
 body_es
 articles.category            enum            pregnancy | labor | breastfeeding | newborn | postpartum |
                                              mental_health | nutrition
 articles.tags[]              string[]        e.g. ['Miami', 'lactation', 'NICU', 'first trimester'].



The Village — Confidential · Page 21



                       ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 articles.miami_specific     boolean          True → shown first for Miami users. Must reference Miami-area
                                              resource.
 articles.week_min /         integer          Pregnancy week relevance range. Null = relevant at all stages.
 week_max
 articles.baby_age_min/      integer          Baby age in months. Null = all stages.
 max
 articles.read_time_min      integer          Estimated read time. Shown on card.
 utes
 articles.village_verified   boolean          True = reviewed by a licensed provider. P2 feature.
 week_guide.week             integer          Pregnancy week 1–42.
 week_guide.baby_size_ string                 e.g. 'Your baby is the size of a lime'.
 comparison
 week_guide.developme        text             What's happening developmentally this week.
 nt
 week_guide.symptoms         text[]           Common maternal symptoms this week.
 week_guide.tips             text[]           Actionable tips for the mother.
 week_guide.miami_not        text             Optional: Miami-specific note (e.g., Miami birth center
 e                                            recommendation for this stage).
 ai_conversations.id         UUID             Each AI chat session. Linked to user_id.
 ai_conversations.mess       jsonb            Array of {role, content, timestamp}. Stored for QA and safety review.
 ages
 ai_conversations.speci      boolean          True if AI appended a specialist referral in this session. Used for
 alist_referral_shown                         conversion tracking.


Claude AI System Prompt — Required Fields
 AI System Prompt Structure (Engineering Reference)


 Role: 'You are The Village's AI assistant — a warm, knowledgeable friend who specializes in pregnancy,
 birth, and early motherhood. You are NOT a doctor.'

 Tone: 'Respond warmly, clearly, and without jargon. Speak directly to the mother. Use 'you' and 'your baby'.'

 Language: 'Respond in the same language the user writes in. If they write in Spanish, respond entirely in
 Spanish.'

 Context injected with every request: user's pregnancy_week OR baby_age_months, city='Miami'

 Disclaimer: 'Always end every response with: This is not medical advice. For medical concerns, please
 consult your healthcare provider.'

 Specialist referral: 'If the question implies a care need (breastfeeding issues, anxiety, pain, bleeding, infection
 signs), append: We have [X] specialists near you who may be able to help → [link]'

 Crisis routing: 'If message contains distress signals (self-harm, hopelessness, despair), respond with
 empathy and immediately offer: Here are resources that can help right now. [Provide crisis line info]'

 Hard limit: 'NEVER diagnose a condition. NEVER say a symptom is definitely normal or definitely abnormal
 without a provider seeing the patient.'


The Village — Confidential · Page 22



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026



Business Rules
• BR-1: Medical disclaimer is hardcoded in the Claude system prompt. It cannot be removed, overridden, or
shortened by any UI change.
• BR-2: AI conversations are stored in Supabase (ai_conversations table) for safety review. Retention: 90 days.
• BR-3: Specialist referral is injected by the backend (not by Claude) so it reflects real-time available specialists in
the user's radius.
• BR-4: All articles must be reviewed by at least one medical advisor before going live. Article.status =
'pending_review' until approved.
• BR-5: Week guide content is static and pre-loaded for all 42 weeks. Calculated from due_date in user profile. If
no due date: show week 20 as default with 'Enter your due date' prompt.
• BR-6: AI chat history is NOT shown across sessions in v1 — each session starts fresh. History stored server-
side only for QA.

Success Metrics
 Type                   Metric                                        Target            How to Measure
 Leading                AI questions asked per active user per week   >3 questions/     Mixpanel:
                                                                      week              ai_question_asked
 Leading                Week guide view rate                          >80% of           Mixpanel:
                                                                      pregnant users    week_guide_opened
                                                                      open week
                                                                      guide weekly
 Leading                AI → Specialist conversion                    % of sessions     >15%
                                                                      where
                                                                      specialist link
                                                                      shown →
                                                                      specialist
                                                                      directory
                                                                      opened
 Leading                Answer satisfaction rate                      >75% tap 'This    In-app thumbs up/down
                                                                      was helpful' on
                                                                      AI responses
 Lagging                Birth plan completion rate                    >40% of           Supabase: birth_plan.status
                                                                      pregnant users    = completed
                                                                      complete birth
                                                                      plan before
                                                                      due date
 Lagging                Content session time                          >8 min avg        Mixpanel: session_duration
                                                                      session
                                                                      duration for
                                                                      content-
                                                                      focused users


Open Questions
• [Legal] CRITICAL: Claude system prompt disclaimer wording must be reviewed by a healthcare attorney before
launch.
• [Content] Who reviews and approves the initial 20 articles and 42 weeks of guide content? Need a named
medical advisor before launch.
• [Engineering] Claude API cost at scale: estimate at 1k DAU × 3 questions/day = 3k calls/day. Model choice:
Haiku vs. Sonnet tradeoff (cost vs. quality).
• [Design] AI chat: conversational chatbot UI vs. search-bar-style input? Run a preference test with 10 beta users.
• [Privacy] AI conversations stored 90 days. Do we need explicit user consent for storing chat history? Check
GDPR / CCPA implications.


The Village — Confidential · Page 23



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026



 💛 Spec 5 — Support Groups & Mental Health
 Peer Groups · Therapist Directory · Mood Tracker · Crisis Resources


 Feature Specification · PRD v1.0 · April 2026


Problem Statement
1 in 5 mothers experience postpartum depression or anxiety — yet most never get help. In Miami's diverse
community, stigma, language barriers, and cost prevent mothers from seeking support. Support groups exist
(Magnolia Birth House, Beyond The Birth) but mothers don't know about them and have no centralized way to find
or join them. The Village can be the first touchpoint that connects a struggling mother to the right support — peer
group, licensed therapist, or crisis line — before it becomes a crisis.

Goals
• 100% of users can access crisis resources within 2 taps from anywhere in the app
• Every mother who self-reports postpartum distress is offered a support resource in the same session
• 15+ Miami support groups listed in directory at launch
• AI mood check-in used by >30% of postpartum users weekly
• Zero instances of AI replacing professional mental health care — always escalate

Non-Goals
• NOT providing therapy or clinical mental health services — we connect mothers to licensed providers
• NOT building video sessions in v1 — link to providers' existing Zoom/telehealth platforms
• NOT conducting clinical assessments (PHQ-9 / EPDS) in v1 — provide resource links only
• NOT moderating group chats in real time in v1 — use community guidelines + report button + keyword alerts

User Stories
Mother experiencing postpartum struggles
• As a mother struggling after birth, I want to find a support group within 10 miles of me so that I can attend in
person and know I'm not alone
• As a mother feeling overwhelmed, I want to reach a crisis resource in 2 taps from anywhere in the app so that I
can get help immediately
• As a mother with postpartum anxiety, I want a daily mood check-in I can show my therapist so that my provider
has context between appointments
Mother seeking community connection
• As an isolated new mother, I want to join a virtual peer group so that I can connect with other moms from home
while my baby sleeps
• As a Spanish-speaking mother, I want to find a support group that meets in Spanish near me
The Village (Safety)
• As the app, I want to detect when a user may be in distress so that I can offer support resources immediately
and never leave her without help

Screen Flow
 Step     Screen                        What the user does / sees
 1        Support Home                  Persistent 'I need help now' button at top (always visible, red). Below: mood
                                        check-in card (if postpartum user). Group directory section. Therapist
                                        directory link. Info articles section.
 2        Crisis Resource Tap           Tapping 'I need help now' → full-screen resource page: Crisis Text Line (text
                                        HOME to 741741), 988 Suicide & Crisis Lifeline, Postpartum Support
                                        International (1-800-944-4773), local emergency (911). No back-press delay.




The Village — Confidential · Page 24



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 3       Group Directory                List of Miami support groups filtered by user's location. In-person groups
                                        show distance badge. Virtual groups show 'Online' badge. Filter: in-person/
                                        virtual/distance/language.
 4       Group Detail                   Name, host org, type, schedule (day/time/frequency), location (map for in-
                                        person), cost (most are free), language, contact info, RSVP option for
                                        scheduled sessions.
 5       Group RSVP                     If group has scheduled sessions with RSVP: tap → confirmation + calendar
                                        invite + reminder set 1h before. If drop-in only: show contact info to reach
                                        host.
 6       Therapist Directory            Perinatal therapists in Miami. Filter: language, insurance, telehealth. Same
                                        card format as specialists. Distance shown for in-person therapists. Sourced
                                        from manual curation.
 7       Mood Check-in                  Daily card: 5 emoji options (1 = very difficult, 5 = great). Single tap logs
                                        mood. History chart shown (30-day view). Export to PDF for therapist.
                                        Option to add a short note.
 8       Mood Trigger Alert             If user logs mood = 1 for 3 consecutive days → proactive push: 'We're
                                        thinking of you. Would it help to talk to someone?' → Support Home with
                                        therapist + group resources highlighted.
 9       Group Chat Rooms               Topic-based peer chats (Sendbird). Topics: PPD/Anxiety, NICU Mamas,
                                        Breastfeeding Struggles, First-Time Moms, Solo Mamas, En Español.
                                        Anonymous option per room.
 10      AI Distress Detection          If AI message in any vertical contains distress signals → Claude response:
                                        empathy first, then: 'It sounds like you might need some extra support right
                                        now. Here are resources that can help.' → crisis resources shown inline.


Requirements
P0 — Must Have
 Requirement                      P        Acceptance Criteria                                   Notes / Connector
 Crisis resource button —         P0       Persistent 'I need help now' button accessible Deep links to external
 always visible                            from Support Home and as a floating element on resources — no API
                                           crisis-adjacent screens. Opens full-screen     needed
                                           resource page with: Crisis Text Line, 988, PSI
                                           hotline, 911.
 Support group directory          P0       List of Miami support groups: name, type (in-         Manual curation —
 with location                             person/virtual), host, schedule, cost, language,      15+ groups at launch.
                                           distance from user (in-person groups), contact        Supabase PostGIS for
                                           info.                                                 distance.
 Location filter: in-person vs    P0       Filter: In-person within X miles / Virtual / Both.    Supabase: group_type
 virtual                                   In-person default shows groups within 10 miles.       field + PostGIS
                                           Synced with global radius preference.                 ST_DWithin
 Distance display on in-          P0       Each in-person group card shows '{X} miles            Supabase PostGIS
 person groups                             away' + neighborhood. Virtual groups show             ST_Distance
                                           'Online' badge instead of distance.
 Postpartum info library          P0       Articles: baby blues vs PPD, signs of postpartum Static Supabase
                                           anxiety, when to seek help, how to talk to your  content — reviewed by
                                           doctor, what therapy looks like, impact of       clinical psychologist
                                           untreated PPD on bonding.




The Village — Confidential · Page 25



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 AI: distress detection +         P0       If AI chat in any vertical detects distress signals,   Claude API system
 empathy response                          Claude responds with empathy first, then offers        prompt: distress
                                           crisis resources. Never leads with resources           detection instructions
                                           before empathy.
 AI: never replaces therapy       P0       All AI responses on mental health topics include:      Prompt engineering +
 — hard rule                               'I'm not a therapist. For ongoing support, please      hardcoded in system
                                           reach out to a professional or a peer group.'          prompt
                                           Non-removable.
P1 — Should Have
 Requirement                      P        Acceptance Criteria                                    Notes / Connector
 Daily mood check-in              P1       5-option emoji scale. One log per day. 30-day          Supabase: mood_logs
                                           history chart. PDF export for therapist. If 3          table + OneSignal +
                                           consecutive days at lowest score: proactive            chart library
                                           outreach push.
 Group chat rooms (topic-         P1       Moderated chat rooms by topic. Anonymous               Sendbird free tier +
 based)                                    option per room. All messages from accounts <7         keyword moderation
                                           days old held for 30min review. Keyword alerts         rules
                                           for crisis terms.
 Map view of in-person            P1       Toggle to Google Maps view. In-person group            Google Maps SDK
 groups                                    locations as pins. Virtual groups excluded. Tap
                                           pin → group card.
 Therapist directory              P1       Miami therapists specializing in perinatal mental      Manual curation +
 (perinatal)                               health. Filter: language, insurance, telehealth.       external booking links
                                           Distance shown for in-person. Booking via
                                           external link.
 RSVP for scheduled group         P1       Groups with fixed session times allow RSVP →           Calendly link or
 sessions                                  calendar invite + 1h reminder push.                    Supabase RSVP +
                                                                                                  OneSignal
 Anonymous posting in chat        P1       Users can toggle anonymous mode per chat               Supabase:
                                           room. Anonymous users shown as 'Village                anonymous_flag on
                                           Mama' with a generic avatar.                           messages. Display
                                                                                                  name override.
P2 — Future
 Requirement                      P        Acceptance Criteria                                    Notes / Connector
 PHQ-9 / EPDS in-app              P2       Validated postpartum depression self-                  Requires clinical
 screening                                 assessment with score interpretation and               review and legal sign-
                                           resource routing.                                      off before build
 Live video group sessions        P2       Village-hosted virtual support circles via Zoom        Zoom SDK +
                                           SDK.                                                   scheduling system
 Crisis Text Line API             P2       Direct in-app text to Crisis Text Line (741741)        Crisis Text Line API
                                           without leaving the app.                               partnership required
 Therapist in-app booking         P2       Book perinatal therapist appointment without           Calendly API +
                                           leaving the app.                                       therapist onboarding
                                                                                                  flow




The Village — Confidential · Page 26



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Data Model — Support Groups
 Field                       Type              Rules / Description
 id                          UUID             Primary key.
 name                        string           Group name. Required.
 description                 text             What the group is for, who it's for, what to expect.
 group_type                  enum             in_person | virtual | hybrid
 host_name                   string           Facilitator name.
 host_org                    string           Organization (e.g. 'Magnolia Birth House', 'Beyond The Birth').
 lat / lng                   float            In-person location coordinates. Null for virtual groups.
 address / city              string           Display address for in-person. 'Online' for virtual.
 schedule_text               string           Human-readable schedule (e.g. 'Every Tuesday at 10am'). Flexible
                                              format.
 meeting_url                 string           Zoom/Google Meet URL for virtual groups. Hidden until RSVP
                                              confirmed.
 cost                        integer          Cost in cents. 0 = free. Most Miami groups are free.
 language                    string[]         e.g. ['Spanish', 'English'].
 max_capacity                integer          Null = open/no limit.
 tags[]                      string[]         e.g. ['PPD', 'NICU', 'Solo mamas', 'En Español'].
 active                      boolean          False = hidden from all users.
 partner                     boolean          True = formal partner organization (Beyond The Birth, Magnolia, etc.).
 contact_email               string           Admin contact for the group. Not shown to users — used for Village
                                              outreach.
 created_at / updated_at     timestamp        Standard audit fields.




The Village — Confidential · Page 27



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

Moderation Protocol — Chat Rooms
 Group Chat Moderation Rules (Engineering + Operations)


 Platform: Sendbird free tier. Moderation: Sendbird Profanity Filter + custom keyword list.

 New user hold: Messages from accounts created <7 days ago are held for 30-minute review before
 appearing.

 Crisis keyword alert: Keywords triggering immediate admin alert: [harm, die, kill myself, can't go on, end it,
 suicide, self-harm]. List reviewed monthly.

 Response target: Admin response to flagged content within 15 minutes during 8am–10pm EST.

 After hours: Crisis keywords trigger auto-response with crisis resources (not admin-dependent).

 Escalation path: Flagged message → admin review → if confirmed crisis → DM user with crisis resources +
 escalate to Postpartum Support International if needed.

 Community guidelines: Shown on first join and linked in every room. Violations: warning → temporary mute
 → permanent ban.

 Anonymous users: Cannot be banned from anonymous mode specifically — ban applied to account
 (anonymous flag removed, account suspended).


Business Rules
• BR-1: Crisis resource button is ALWAYS visible on the Support Home screen. It cannot be dismissed, minimized,
or hidden by any filter or scroll action.
• BR-2: AI NEVER leads with resources before empathy. Response order: 1) Empathy, 2) Validation, 3)
Resources. Hardcoded in Claude system prompt.
• BR-3: Mood data is private to the user only. It is never shown to other users, group moderators, or any third
party.
• BR-4: If a user logs mood = 1 for 3 consecutive days, a proactive support push is sent. Maximum 1 proactive
push per 7-day period.
• BR-5: All chat rooms use anonymous option by default for new users (first 30 days). User can turn off anonymity
any time.
• BR-6: In-person groups with lat/lng = null are treated as virtual and never shown on map or given a distance
badge.
• BR-7: Village AI never provides specific clinical resource referrals (e.g., prescriptions, diagnoses) — only
general referrals to therapists and crisis lines.

Success Metrics
 Type                   Metric                                           Target             How to Measure
 Safety                 Crisis resource access rate (distressed users)   100% of users      Mixpanel:
                                                                         expressing         crisis_resource_shown
                                                                         distress offered   event after distress_signal
                                                                         resources in       detected
                                                                         same session
 Leading                Mood check-in weekly completion rate             >30% of        Supabase: mood_logs count
                                                                         postpartum     per user per week
                                                                         users log mood
                                                                         at least 3x/
                                                                         week




The Village — Confidential · Page 28



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026

 Leading                Support group directory engagement       >25% of           Mixpanel:
                                                                 postpartum        support_group_directory_op
                                                                 users open        ened
                                                                 group directory
                                                                 monthly
 Leading                Chat room participation                  >15% of          Sendbird analytics:
                                                                 support vertical messages_sent
                                                                 users send at
                                                                 least 1 chat
                                                                 message per
                                                                 month
 Lagging                Retention of high-distress users         Users who log     Mixpanel: cohort retention by
                                                                 mood=1            mood score segment
                                                                 retained at
                                                                 same rate as
                                                                 general users
                                                                 after 30 days
 Lagging                Zero critical safety incidents           No reported       Support tickets + user
                                                                 cases of          feedback review
                                                                 Village AI
                                                                 deterring a
                                                                 user from
                                                                 seeking
                                                                 professional
                                                                 help


Open Questions
• [Legal] CRITICAL: All AI responses touching mental health must be reviewed by a licensed clinical psychologist
before launch.
• [Legal] Specific Terms of Service clause for mental health features? Draft with attorney.
• [Safety] Who monitors chat rooms for crisis situations during off-hours? Paid admin or on-call volunteer
moderator?
• [Partnership] Formal referral agreements with Beyond The Birth and Magnolia Birth House — get signed before
launch.
• [Engineering] Keyword list for crisis detection: who maintains it? How often reviewed? Needs a clinical
psychologist sign-off.
• [Privacy] Mood tracking data retention policy. How long stored? User right to delete? HIPAA implications?




The Village — Confidential · Page 29



                    ￼
The Village · Feature Specifications (PRD) · v1.1 · April 2026


 ✅ Pre-Launch Legal & Safety Checklist (All Verticals)



 ☐ Healthcare attorney: review AI medical disclaimer language (Specs 4 & 5)

 ☐ Healthcare attorney: review breast milk peer listing board liability (Spec 1)

 ☐ Healthcare attorney: review event liability for Village-hosted meetups (Spec 3)

 ☐ Clinical psychologist: review all mental health AI responses and distress detection prompt (Spec 5)

 ☐ Clinical psychologist: review keyword crisis alert list (Spec 5)

 ☐ Medical advisor: review and approve all 20 launch articles and 42 weeks of week guide content (Spec 4)

 ☐ Privacy policy updated: health data (mood logs, pregnancy info, due date)

 ☐ Privacy policy updated: location data — what stored, how long, who sees it

 ☐ Privacy policy updated: breast milk listing data — confirm exact coords never stored

 ☐ Terms of Service: updated for all 5 verticals including breast milk exchanges

 ☐ HIPAA compliance review: mood tracking, AI conversation storage, pregnancy data

 ☐ Google Maps SDK: Terms of Service compliance review (attribution, usage limits)

 ☐ iOS NSLocationWhenInUseUsageDescription string: must explain WHY location is needed

 ☐ Supabase PostGIS: enable and test spatial index on production database before launch

 ☐ Sendbird: configure keyword moderation rules and test crisis alert flow

 ☐ Baby Trails partnership agreement signed (Spec 3)

 ☐ Mothers' Milk Bank of Florida partnership confirmed (Spec 1)

 ☐ Beyond The Birth + Magnolia Birth House partnership confirmed (Spec 5)

 ☐ Admin moderation protocol documented and team trained before public launch




The Village — Confidential · Page 30



                    ￼
