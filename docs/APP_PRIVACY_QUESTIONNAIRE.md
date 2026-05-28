# App Store Connect — App Privacy Questionnaire (villie)

Paste-ready answers for App Store Connect → App Privacy. Walk Apple's wizard top-to-bottom, this doc mirrors the order of their questions.

**App Store ID**: 6773357128
**Privacy policy URL** (must be live before submit): https://villieapp.com/privacy
**Last reviewed**: 2026-05-28

---

## Step 1 — "Does this app collect data?"

**Answer: Yes.**

---

## Step 2 — Data types collected

For each category below, check the listed boxes. The rationale column is for your reference, not Apple's form.

### Contact Info

| Data type | Collected? | Rationale |
|---|---|---|
| Name | ✅ Yes | Display name on profile, used in greetings + when contacting a donor/specialist. Supplied via Apple Sign-In, Google Sign-In, or typed at sign-up. |
| Email Address | ✅ Yes | Account identifier (Supabase auth). Used for sign-in + transactional email (booking confirmations, password reset, weekly digest). |
| Phone Number | ✅ Yes | Optional. Specialists + milk donors enter phone for in-app contact button. Hospital-partner moms may have phone pre-populated from intake. |
| Physical Address | ❌ No | Never collected. ZIP only (see Location). |
| Other User Contact Info | ❌ No | — |

### Health & Fitness

| Data type | Collected? | Rationale |
|---|---|---|
| Health | ✅ Yes | Daily check-in mood + free-text symptoms. Postpartum care plan tracking (sleep, feeding, mood, recovery). Crisis-flag indicators routed to AI triage edge function. |
| Fitness | ❌ No | — |

> **Important**: this is a real Yes, not a maybe. The check-in stores mood scores + free-text answers that constitute health information. Do not check No.

### Financial Info

| Data type | Collected? | Rationale |
|---|---|---|
| Payment Info | ❌ No | All card data is handled by Stripe via PaymentSheet; villie never receives or stores PAN, CVV, expiry. We only persist booking ID + amount + status. |
| Credit Info | ❌ No | — |
| Other Financial Info | ❌ No | Gear + Milk Hub are cash-only. No financial data flows through villie for those verticals. |

### Location

| Data type | Collected? | Rationale |
|---|---|---|
| Precise Location | ✅ Yes | `expo-location` requests foreground permission for "near me" search on Specialists, Donors, Gear map views. Used only to compute distance ranking client-side and inform the map viewport. Not persisted to backend. |
| Coarse Location | ❌ No | — |

### Sensitive Info

| Data type | Collected? | Rationale |
|---|---|---|
| Sensitive Info | ✅ Yes | Postpartum mental-health indicators in daily check-ins (e.g. PHQ-style mood signals, crisis flag). Treated as sensitive per Apple's definition. |

### Contacts

| Data type | Collected? | Rationale |
|---|---|---|
| Contacts | ❌ No | — |

### User Content

| Data type | Collected? | Rationale |
|---|---|---|
| Emails or Text Messages | ❌ No | — |
| Photos or Videos | ✅ Yes | Profile photo (optional); gear listing photos; specialist profile photo. Uploaded via `expo-image-picker` to Supabase Storage. |
| Audio Data | ❌ No | — |
| Gameplay Content | ❌ No | — |
| Customer Support | ❌ No | Support is via email reply to founder, not in-app. |
| Other User Content | ✅ Yes | Daily check-in free-text answers; AI Help chat transcripts; gear listing descriptions; milk donor profiles. |

### Browsing History

| Data type | Collected? | Rationale |
|---|---|---|
| Browsing History | ❌ No | — |

### Search History

| Data type | Collected? | Rationale |
|---|---|---|
| Search History | ❌ No | Search inputs (specialty, brand, distance) are not retained. |

### Identifiers

| Data type | Collected? | Rationale |
|---|---|---|
| User ID | ✅ Yes | Supabase `auth.uid` (UUID). Used to scope every database row to its owner. |
| Device ID | ✅ Yes | OneSignal `external_id` / player ID for push delivery. Sentry installation ID for crash attribution. |

### Purchases

| Data type | Collected? | Rationale |
|---|---|---|
| Purchase History | ✅ Yes | Specialist bookings (Stripe-mediated) are persisted as `bookings` rows with amount + status + booking timestamp. Used to render "My bookings". |

### Usage Data

| Data type | Collected? | Rationale |
|---|---|---|
| Product Interaction | ✅ Yes | Sentry breadcrumbs capture screen views + tap events for crash-context reconstruction. No third-party product analytics SDK installed. |
| Advertising Data | ❌ No | No ad SDK, no IDFA collection. |
| Other Usage Data | ❌ No | — |

### Diagnostics

| Data type | Collected? | Rationale |
|---|---|---|
| Crash Data | ✅ Yes | Sentry. Includes stack traces + device model + OS version + Sentry breadcrumbs. |
| Performance Data | ✅ Yes | Sentry transactions (cold-start time, screen render time, slow API spans). |
| Other Diagnostic Data | ❌ No | — |

### Surroundings

| Data type | Collected? | Rationale |
|---|---|---|
| Environment Scanning | ❌ No | — |

### Body

| Data type | Collected? | Rationale |
|---|---|---|
| Hands | ❌ No | — |
| Head | ❌ No | — |

### Other Data

| Data type | Collected? | Rationale |
|---|---|---|
| Other Data Types | ❌ No | — |

---

## Step 3 — For each ✅ Yes, answer these four sub-questions

Apple asks the same four questions for every "Yes" data type. Use this table as the crib sheet.

| Data type | Purpose(s) | Linked to user? | Used to track them? |
|---|---|---|---|
| **Name** | App Functionality | ✅ Linked | ❌ No |
| **Email Address** | App Functionality, Developer's Advertising or Marketing (newsletter — opt-in) | ✅ Linked | ❌ No |
| **Phone Number** | App Functionality | ✅ Linked | ❌ No |
| **Health** | App Functionality | ✅ Linked | ❌ No |
| **Precise Location** | App Functionality | ❌ Not linked (never persisted to backend; used in-session only) | ❌ No |
| **Sensitive Info** | App Functionality | ✅ Linked | ❌ No |
| **Photos or Videos** | App Functionality | ✅ Linked | ❌ No |
| **Other User Content** | App Functionality | ✅ Linked | ❌ No |
| **User ID** | App Functionality, Analytics | ✅ Linked | ❌ No |
| **Device ID** | App Functionality, Analytics | ✅ Linked | ❌ No |
| **Purchase History** | App Functionality | ✅ Linked | ❌ No |
| **Product Interaction** | Analytics | ✅ Linked | ❌ No |
| **Crash Data** | App Functionality, Analytics | ✅ Linked | ❌ No |
| **Performance Data** | Analytics | ✅ Linked | ❌ No |

### Purpose definitions (Apple's wording)

- **App Functionality** — Authenticate the user, enable the feature they requested, prevent fraud, troubleshoot a crash they reported.
- **Analytics** — Evaluate user behavior, improve the app, measure the effectiveness of features.
- **Developer's Advertising or Marketing** — Display first-party ads, send marketing communications (e.g. weekly newsletter — only if opted in).
- **Third-Party Advertising** — ❌ NEVER select. We don't do this.
- **Product Personalization** — ❌ Not selected. We don't customize content based on data.
- **Other Purposes** — ❌ Not selected.

### "Linked to user" definition

Data is "linked" if it can be tied to a specific user identity. Since every row in our backend is scoped by `auth.uid`, almost everything is linked. The only exception flagged above is **Precise Location**, which never leaves the device session.

### "Tracking" definition

Tracking means linking user / device data with **third-party** data for advertising or measurement, OR sharing with a data broker. **villie does none of this.** All ✅ Yes answers above get ❌ No for tracking.

---

## Step 4 — Privacy Policy URL

App Store Connect → App Information → Privacy Policy URL must be live BEFORE submission. Confirm:

- [ ] `https://villieapp.com/privacy` returns 200 OK
- [ ] Policy mentions: data collected, third-party SDKs (OneSignal, Sentry, Stripe, Supabase, Apple/Google Sign-In), retention, deletion request path (`privacy@villieapp.com`), CA + CT minor-specific clauses if applicable.

If the policy isn't live yet, this is BLOCKING. App Store review will reject without it.

---

## Step 5 — Permission usage strings (Info.plist)

These are separate from the App Privacy form but Apple compares them against your answers. Make sure each one exists in `apps/mobile/app.json` → `ios.infoPlist`:

| Key | Required because | Suggested string |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | Precise Location ✅ | "villie uses your location to show nearby specialists, milk donors, and gear listings." |
| `NSCameraUsageDescription` | Photos collection (camera path) ✅ | "villie uses the camera so you can take photos of gear listings or scan product barcodes." |
| `NSPhotoLibraryUsageDescription` | Photos collection (library path) ✅ | "villie uses your photo library so you can attach images to gear listings and your profile." |
| `NSPhotoLibraryAddUsageDescription` | Save-to-camera-roll (PDF export Build 12+) ✅ | "villie saves your Manual chapter PDFs to your photo library when you tap Save." |
| `NSCalendarsUsageDescription` | `expo-calendar` for booking add-to-calendar ✅ | "villie adds your specialist booking to your calendar when you tap Add to Calendar." |
| `NSUserTrackingUsageDescription` | ❌ NOT required — we don't do ATT prompts | omit |

### ⚠️ STALE permission strings to remove from `app.json` (Build 12 batch)

Audit done 2026-05-28. The plist currently declares the strings below but the app has **zero** runtime calls to the underlying APIs. Apple's review checks for this mismatch and has rejected apps over it. Remove these from `apps/mobile/app.json` → `ios.infoPlist` before Build 12 cuts.

| Key currently declared | Why it's stale | Action |
|---|---|---|
| `NSContactsUsageDescription` | No `expo-contacts` import anywhere in `apps/mobile/src/`. The "Share villie with contacts" flow isn't built. | **Delete** the key. |
| `NSMicrophoneUsageDescription` | No video recording surface ships. Gear listings accept stills only (`expo-image-picker` with `mediaTypes: Images`). | **Delete** the key. |
| `NSLocationAlwaysUsageDescription` | Only `requestForegroundPermissionsAsync` is called (confirmed in `apps/mobile/src/utils/devLocation.ts`). No background location use. | **Delete** the key. Keep `NSLocationWhenInUseUsageDescription`. |

> Cleanup is native config → requires a rebuild → batched into Build 12. Build 11 is already past Apple's automated plist scan so it's not blocking — but DO NOT submit Build 12 without this cleanup.

---

## Step 6 — Cross-check against Apple Sign-In requirement

Apple requires that if you offer Google Sign-In, you must also offer Sign In with Apple. ✅ We do — both ship in Build 10+. No additional questionnaire impact.

---

## Step 7 — Submit + lock

Once the form is filled:
1. Click **Publish** in App Privacy. The labels become the nutrition-label card on the App Store listing.
2. Re-verify the visible labels on the listing preview match expectations (no surprise "Tracking" pillar).
3. After publish, any change to data practices requires a new submission — keep this doc updated as the source of truth.

---

## Maintenance triggers

Update this doc when:
- A new SDK is added (especially analytics, ads, attribution)
- A new data type is collected (e.g. voice notes, biometrics)
- The newsletter opt-in flow changes its consent model
- A new third-party processor is added (e.g. swapping Sentry for Datadog)

Commit changes alongside the code change in the same PR.
