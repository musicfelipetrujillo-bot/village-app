# The Village App — Claude Context

## What This Is
A maternal health platform for expecting and postpartum moms. 4 verticals built sequentially:
- **V1 Specialists** (🩺) — Find & book OB/GYN, Doula, Midwife, Lactation, Pediatrician
- **V2 Milk Connect** (🤱) — Peer breast milk donor marketplace
- **V3 Community** (💬) — Live moderated chat rooms by pregnancy stage
- **V4 Discover + Home** (✦/🏠) — Events, brand perks, gear exchange, milestone tracker

## Full Plan
See `docs/MASTER_PLAN.md` — contains all DB schemas, API routes, screens, AI skills, and build sequences for all 4 verticals.

## UI Reference
See `docs/prototype.html` — open in browser. This is the source of truth for all UI, colors, navigation, and copy.

## Tech Stack
- **Mobile**: React Native + Expo (managed workflow)
- **Backend**: Supabase-first — RLS handles auth + CRUD directly from mobile. Edge Functions only for AI routes + webhooks.
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **AI**: Claude API — `claude-haiku-4-5` for real-time, `claude-sonnet-4-6` for summaries/cron
- **Maps**: Google Maps + Google Places
- **Payments**: Stripe + Stripe Connect
- **SMS**: Twilio
- **Notifications**: OneSignal
- **Booking**: Calendly (v1), Zocdoc (v2)

## Design Tokens (from prototype.html)
```
--cream:      #F5F0E8  (background)
--rust:       #B85C38  (primary CTA, active nav)
--rust-dark:  #9A4A2B
--rust-light: #D4744F
--brown-deep: #2C1A0E
--brown-mid:  #4A2E1A
--olive:      #5C6B3A
--gold:       #C4A35A
--text-dark:  #1C1008
--text-light: #9A8070
--white:      #FDFAF5

Font headers: Playfair Display (serif, italic)
Font body:    DM Sans
```

## Architecture Rules
1. **Supabase direct** for all CRUD — never write Express routes for reads/writes
2. **Edge Functions** only for: AI skill routes, Stripe webhooks, Twilio SMS, Calendly webhooks
3. **RLS on every table** — never rely on application-level auth checks alone
4. **One migration file per vertical** — `001_v1.sql`, `002_v2.sql`, etc.
5. **`supabase gen types typescript`** for all TypeScript types — never write them manually
6. **Prompt caching** on all Claude system prompts — `cache_control: { type: "ephemeral" }`
7. **Haiku for real-time** (message scan, Q&A), **Sonnet for batch** (summaries, weekly cron)

## Naming Conventions
- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- DB tables: `snake_case`, prefixed by vertical (`milk_`, `gear_`, `room_`)
- Edge Functions: `kebab-case` folder name

## Build Order
V1 fully live → V2 → V3 → V4+Home. Never start next vertical until current is in production.

## Current Status
🔴 Not started — all planning complete, ready to scaffold.
