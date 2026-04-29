    🛒 The Village · Baby Gear Swap                                        Tool Stack & Listing Flow Research



     🛒
     Baby Gear Swap
     Ideal Tool Stack & 3-Step Listing Flow
     The Village App · Research & Recommendations

    April 2026 · Prepared for The Village Product Team




    Executive Summary
    The Baby Gear Swap listing flow needs to feel as effortless as taking a photo. The goal: a new mom
    can list a stroller in under 60 seconds without typing a single word of product description. This
    document maps out the precise API toolkit and user experience flow to make that possible.



    The recommended architecture combines three layers:



     Layer                  What it does                             Recommended tool
     IDENTIFY               Camera sees the product → AI names it,   GPT-4o Vision API (primary) + ML Kit
                            brand, model                             (on-device assist)
     ENRICH                 Barcode scan → product name, MSRP,       Go-UPC API + UPCitemdb (dual-source
                            image, specs auto-fill                   for coverage)
     PRICE                  Show MSRP + smart used price             eBay Marketplace Insights API + internal
                            suggestion + custom input                depreciation model




    Why Not Google Lens Directly?
    This is the first question every team asks. The short answer: Google Lens has no official public API for
    developers. There is no SDK or endpoint you can call. What exists are unofficial third-party scrapers of
    the Google Lens search interface — these violate Google's Terms of Service and are fragile (they break
    every time Google updates their UI).



    Here is what the landscape actually looks like:




    Page 1 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                       Tool Stack & Listing Flow Research

     Option                          Status        Why it matters for The Village
     Google Lens (official)          ❌ No API      No public developer access. Cannot be used.

     Google Cloud Vision (Product ⚠                In maintenance mode, Google recommends migrating
     Search)                                       away. Requires you to upload your own product catalog
                                     Maintenance
                                                   — not suitable for a marketplace with user-generated
                                                   listings.
     SerpApi / SearchApi (Google     ⚠ ToS Risk    Third-party scraper. Violates Google ToS, can be shut
     Lens scraper)                                 down without notice. ~$50/month. Avoid for a production
                                                   app.
     GPT-4o Vision API (OpenAI)      ✅ BEST        Official API, production-grade, identifies products by
                                                   brand/model/category from any angle photo. Returns
                                                   structured JSON. ~$0.01 per listing photo. The only risk-
                                                   free option.
     Google ML Kit (on-device,       ✅ FREE        Free, runs on-device with no server call. Perfect for
     barcode only)                                 barcode scanning as the fast fallback. Cannot identify
                                                   product from photo without a barcode.




    The 3-Step Listing Flow
    This is the end-to-end experience from the mom's perspective. Every technical recommendation in this
    document is designed to make this flow work flawlessly.




     STEP 1 Snap a Photo (or scan the barcode)
     The mom taps "Post a Listing" → camera opens immediately (no forms).

     She has two options:

     📷 Take a photo → GPT-4o Vision API identifies the product in ~2 seconds

     ⚡ Scan barcode → ML Kit reads it on-device instantly (offline-capable)

     Either path feeds into the same Step 2 enrichment screen. The barcode path is faster; the photo path
     works when there's no barcode (used gear, box thrown away).




    Page 2 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                         Tool Stack & Listing Flow Research

     STEP 2 Confirm & Enrich (auto-populated, one tap to confirm)
     The screen shows the identified product with all fields pre-filled:

     ✓ Product name, brand, model (from Vision AI or UPC database)

     ✓ Category auto-set (Stroller / Car Seat / High Chair / etc.)

     ✓ MSRP shown prominently (from UPC database retail price field)

     ✓ Smart used price suggestion (MSRP × depreciation by category, validated against eBay sold
     data)

     ✓ Product image (pulled from UPC database if available)

     ✓ CPSC recall check runs automatically in the background

     She only taps to confirm or correct. Most moms tap once and move on.




     STEP 3 Set Condition & Price (then Post)
     Three condition chips — she taps one:

     ✨ Like New · 👍 Good · 👌 Fair

     Price section shows three options:

     ① Suggested price (pre-selected, based on condition + market data)

     ② MSRP reference (shown greyed out for context: "Retail $349")

     ③ Custom price (number input if she wants to set her own)

     Optional: add 1–3 more photos, confirm Miami neighborhood for pickup.

     "Post Listing" button → listing live in under 60 seconds total.




    Page 3 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                      Tool Stack & Listing Flow Research

    Tool-by-Tool Breakdown
    Layer 1 — Visual Product Identification
    Primary: GPT-4o Vision API (OpenAI)

    This is the closest thing to Google Lens that a developer can actually build on. You send a photo, get
    back structured text identifying the product. The key is prompting it correctly to return a consistent
    JSON structure.



     API endpoint           https://api.openai.com/v1/chat/completions (model: gpt-4o)
     What it returns        Product name, brand, model, category, estimated MSRP range, confidence
                            score
     Accuracy               Excellent for branded baby gear (Uppababy, Chicco, Graco, Doona, Bugaboo,
                            etc.)
     Cost per listing       ~$0.01–0.02 per photo (at 1 image per listing, 1,000 listings/month = $10–20/
                            mo)
     Latency                1.5–3 seconds — acceptable for a "we're identifying your item" loading screen
     React Native           Yes — call from your Supabase Edge Function (keeps API key server-side,
                            secure)
     Best practice          Prompt: "Identify this baby product. Return JSON: { name, brand, model,
                            category, msrpEstimateUSD, confidence }. If you cannot identify it, return
                            confidence: low."



    Backup / On-Device: Google ML Kit (Vision)

    ML Kit runs entirely on the device, no network call needed. It handles barcode scanning (UPC/EAN/
    QR) instantly and also does basic object labeling. Use it as the barcode scanner in Step 1 and as a
    confidence boost when GPT-4o returns low confidence.



     SDK                    @react-native-google-mlkit/barcode-scanning + vision (npm packages)
     Cost                   Free — fully on-device, no API call
     Barcode formats        UPC-A, UPC-E, EAN-8, EAN-13, QR, Code 128, and more
     Latency                Near-instant (<200ms) — reads barcode from live camera frame
     Use case               Barcode path in Step 1. Also shows a barcode overlay frame in the camera UI
                            so the mom knows where to aim




    Layer 2 — Product Database & Auto-Population



    Page 4 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                        Tool Stack & Listing Flow Research
    Once a barcode is scanned (or GPT-4o identifies a product name), you query a product database to get
    the full spec sheet: official product name, brand, description, image URL, retail price, and weight/
    dimensions. Two APIs cover this well, and using both in a waterfall gives you maximum coverage.




     API                      Database size            Cost              Recommendation
     Go-UPC                   1 billion+ products      ~$29/mo (10k      ✅ PRIMARY — best coverage,
                                                       lookups)
                                                                         returns name, image, retail price,
                                                                         brand, description, category
     UPCitemdb                495 million products     ~$29/mo (6k       FALLBACK — if Go-UPC returns no
                                                       lookups)          match, try UPCitemdb. Both return
                                                                         retail price, image, and specs
     Barcode Lookup           900 million+ products    ~$49/mo (5k       TERTIARY — optional 3rd source.
                                                       lookups)          Has baby gear coverage. Only
                                                                         needed if top two miss.




    Combined monthly cost for product database at MVP scale (500 listings/month): ~$29/month using Go-
    UPC alone. Budget ~$60/month once both layers are active. Waterfall logic = call Go-UPC first; if no
    match → try UPCitemdb; if still no match → show empty form (mom fills in manually, which is the
    Facebook Marketplace fallback experience).



    Layer 3 — Smart Pricing Intelligence

    This is the feature that will make moms love the listing flow. Instead of guessing "what should I charge
    for my 1-year-old Uppababy Vista?" the app shows them the answer instantly. Three data points
    displayed side by side:




     Price point            Source                            How it's calculated
     MSRP                   UPC database retail price field   Pulled directly from Go-UPC / UPCitemdb.
                                                              Shown greyed-out as reference ("Retail $549").
                                                              Not editable.
     Suggested used         eBay Marketplace Insights API +   eBay's API returns avg sold price for the exact
     price                  depreciation model                product in the last 90 days. Adjusted by
                                                              condition (Like New: 65%, Good: 45%, Fair:
                                                              30% of MSRP). Pre-selected by default.
     Custom price           User input                        Simple number field. Mom taps it to override
                                                              the suggested price. Shown with a min-price
                                                              guardrail ("Prices under $5 are unusual — are
                                                              you sure?").




    Page 5 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                   Tool Stack & Listing Flow Research
    eBay Marketplace Insights API — What It Gives You

    The eBay Marketplace Insights API returns sold item history for the last 90 days. You query it by
    product name or GTIN (UPC/EAN). It returns: average sold price, price range (min/max), number of
    recent sales, and item condition. This is the most accurate real-world used price signal available via
    API.



    Important notes:

    → Access requires applying to eBay's Limited Release program. Plan 4–6 weeks for approval. Apply
    on Day 1 of development.

    → Amazon's Product Advertising API (PA-API) is being deprecated April 30, 2026. Do not build on it.

    → Fallback if eBay API is pending: use a hard-coded depreciation table (by category and age) until the
    API integration is approved.



    Category Depreciation Table (used until eBay API is live)

     Category                        Like New     Good            Fair             Rationale
     Strollers                       65%          48%             32%              High demand, durable,
                                                                                   brand matters

     High Chairs                     60%          45%             28%              Heavy wear on trays/
                                                                                   straps

     Bouncers & Swings               65%          50%             35%              Short use window,
                                                                                   good resale

     Baby Monitors                   55%          40%             25%              Tech depreciates faster

     Carriers & Wraps                70%          55%             38%              Fabric holds value well

     Play Mats                       55%          40%             25%              Fabric wear visible

     Bottles & Feeding               50%          35%             20%              Hygiene concerns drive
                                                                                   price down

     Clothing (sets)                 40%          28%             15%              High volume, low unit
                                                                                   price

     Toys                            50%          38%             22%              Condition very visible




    Page 6 · Confidential



￼
    🛒 The Village · Baby Gear Swap        Tool Stack & Listing Flow Research

    Safety Integration (Non-Negotiable)




    Page 7 · Confidential



￼
    🛒 The Village · Baby Gear Swap                               Tool Stack & Listing Flow Research
    Per the compliance document, CPSC recall checking is mandatory. It must run automatically during the
    listing flow — the seller should never need to think about it.




    Page 8 · Confidential



￼
    🛒 The Village · Baby Gear Swap   Tool Stack & Listing Flow Research




    Page 9 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                       Tool Stack & Listing Flow Research

     API                     CPSC Recalls API — recalls.gov/api/recalls (free, no key needed)
     When to call            Immediately when Step 2 loads — run in background while mom reviews auto-
                             filled fields
     Query by                Product name + brand (from Vision/UPC lookup). Also query by UPC if
                             barcode was scanned.
     If recalled             Block the listing. Show a full-screen alert: "[Product name] is under an active
                             CPSC recall and cannot be listed. This protects you and other families." Offer a
                             "Why?" modal with CPSC link.
     If not recalled         Show a small green "CPSC Checked ✓" badge on the listing (visible to
                             buyers). This is a marketing differentiator vs Facebook Marketplace.
     Car seats               EXCLUDED from the marketplace at MVP per compliance doc. Complexity of
                             expiration + recall checking too high. Show a message: "Car seats aren't listed
                             on The Village Swap — safety requires a specialist."




    Page 10 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                            Tool Stack & Listing Flow Research




    Complete Tech Stack Summary
    Below is the full toolkit with estimated monthly costs at MVP scale (500 listings/month, 2,000 MAU):



     Layer          Tool / API                    Purpose                  Est. monthly cost   Priority
     Vision         GPT-4o Vision API             Photo → product ID       ~$10–20             🔴 MVP

     Vision         Google ML Kit                 Barcode scanning         Free                🔴 MVP

     Product DB     Go-UPC API                    UPC → name, MSRP,        ~$29                🔴 MVP
                                                  image
     Product DB     UPCitemdb                     Fallback product         ~$29                🟡 Nice
                                                  lookup
     Pricing        eBay Marketplace Insights     Real used price data     ~Free (limited)     🟡 Phase 2

     Pricing        Internal depreciation table   Fallback pricing logic   Free (in-app)       🔴 MVP

     Safety         CPSC Recalls API              Mandatory recall         Free                🔴 MVP
                                                  check
     Safety         Supabase Edge Function        Server-side API key      ~$25 (shared)       🔴 MVP
                                                  mgmt
     Storage        Supabase Storage              Listing photos (3 max)   ~$5–10              🔴 MVP

     TOTAL          MVP stack (Vision + Go-UPC + CPSC + Storage +          ~$70–85/mo          At 500 listings =
                    Edge Fn)                                                                   ~$0.17/listing




    Recommended Build Sequence
    Build in this order to get to a testable prototype as fast as possible:



     Week 1–2          Camera + ML Kit barcode scanner
     →                 Camera screen opens on "Post a Listing" tap
     →                 ML Kit barcode scanning overlay — live camera, tap to scan
     →                 On scan: call Go-UPC API → display product name + MSRP
     →                 Hard-coded depreciation table returns suggested price
     →                 Basic form: condition chips + price selection + Post button
     →                 Listings stored in Supabase with photo upload




    Page 11 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                           Tool Stack & Listing Flow Research

     Week 3–4          GPT-4o Vision + CPSC recall check
     →                 Add "Take photo" option alongside barcode scan
     →                 Photo → Supabase Edge Function → GPT-4o Vision API → return product JSON
     →                 Loading state: animated "Identifying your item..." while AI processes
     →                 CPSC recall check runs in parallel on product name
     →                 If recalled: block flow with full-screen warning
     →                 "CPSC Checked ✓" badge appears on confirmed listings




     Week 5–6          eBay real-time pricing + UX polish
     →                 Apply for eBay Marketplace Insights API access (do this Week 1!)
     →                 Replace depreciation table with live eBay sold data where available
     →                 Price display: MSRP (greyed) + Suggested (highlighted) + Custom input
     →                 UPCitemdb as fallback for product lookup
     →                 Edit capability: mom can correct product name if AI misidentified
     →                 Add "no barcode / AI couldn't identify" manual entry fallback




    Page 12 · Confidential



￼
    🛒 The Village · Baby Gear Swap       Tool Stack & Listing Flow Research

    UX Principles for the Listing Flow




    Page 13 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                 Tool Stack & Listing Flow Research
    These are the design rules that make the 3-step flow feel magical rather than mechanical:




    Page 14 · Confidential



￼
    🛒 The Village · Baby Gear Swap   Tool Stack & Listing Flow Research




    Page 15 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                             Tool Stack & Listing Flow Research

     Principle                       What it means in practice
     Camera first, form never        Open the camera immediately when "Post a Listing" is tapped. Never show
                                     a blank form first. The photo IS the form.
     AI as assistant, not            If GPT-4o misidentifies the product (confidence: low), show the best guess
     gatekeeper                      with an "Edit" button — never a dead end. The mom is always in control.
     Pre-select the smart default    The suggested price should be pre-selected. Moms who accept it (the
                                     majority) never have to interact with the price field at all.
     Progress is visible             Step indicators (1 → 2 → 3) at the top. Mom always knows where she is
                                     and how far she has to go.
     Safety as reassurance, not      The CPSC check runs silently. The only time it surfaces is (a) a recall is
     friction                        found (important!) or (b) a green badge appears (positive reinforcement).
     Never ask for what you          If the UPC database returns a product image, use it. If GPT-4o returns a
     already know                    category, pre-set it. Every field that is pre-filled is a field the mom doesn't
                                     have to type.
     One thumb, one hand             The target user is holding a baby. Every tap target ≥ 48px. No two-handed
                                     gestures. Condition chips and price options are large tap targets, not tiny
                                     radio buttons.
     "60 seconds" is the promise     Measure listing completion time in testing. If it exceeds 60 seconds for a
                                     user who knows the product, the flow needs another simplification pass.




    Page 16 · Confidential



￼
    🛒 The Village · Baby Gear Swap                                                       Tool Stack & Listing Flow Research




    How This Compares to Competitors
    The Village Gear Swap will be the only secondhand baby marketplace with all three of these
    capabilities. This is the differentiation:



     Feature                       The Village           Facebook              OfferUp                Poshmark
                                                         Marketplace

     Photo → AI product ID
                                   ✅                     ❌                     ❌                      ❌
     Barcode scan to list
                                   ✅                     ❌                     ✅                      ❌
     Auto-fill product details
                                   ✅                     ❌                     ❌                      ❌
     MSRP shown to seller
                                   ✅                     ❌                     ❌                      ✅
     Used price suggestion
                                   ✅                     ❌                     ❌                      ✅
     CPSC recall check
                                   ✅                     ❌                     ❌                      ❌
     Baby-only focus
                                   ✅                     ❌                     ❌                      ❌
     Bilingual (EN/ES)
                                   ✅                     ❌                     ❌                      ❌
     Community trust layer
                                   ✅                     ❌                     ✅                      ✅




    The Village · Baby Gear Swap Research · April 2026

    This document is for internal product planning. All API pricing is estimated from public rate cards as of April 2026 and subject to
    change. eBay Marketplace Insights API requires a separate access application.




    Page 17 · Confidential



￼
