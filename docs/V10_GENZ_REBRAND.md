# V10 — villie Gen Z Rebrand (Living Plan)

**Status anchor for every Gen Z / rebrand session.** Read this top-to-bottom before touching any design code. Update the checklists as work lands so the next session starts from the actual state.

Supersedes the **palette + typography + voice** of `docs/V9_BRAND_ROLLOUT.md` and `memory/project_brand_kit_v2.md`. **Reuses** V9's *structural* recipes (page wash, card lift, glass sheen, editorial masthead skeleton) — only the colors, fonts, and copy change. Decision: Felipe, 2026-05-29 ("Full rebrand of the app").

Source kit: `villie - Brand Kit (Gen Z)` (Claude design artifact, 2026-05-29).

---

## How to use this doc (mandatory)

1. Start every rebrand session here. Don't re-ask "where did we leave off."
2. Move items `Pending → Done` in the same commit that lands the code.
3. **Never invent a recipe out of band.** If a screen needs a pattern not in *Canonical V10 Recipes*, add it here first.
4. The token layer in `apps/mobile/src/utils/constants.ts` (`COLORS.*` / `FONTS.*`) is the leverage point — change values behind tokens, the app follows. Sweep hardcoded literals second.

---

## The decision + the one hard carve-out

Full rebrand of the **app** to the Gen Z kit: rose-led palette, Bricolage/Hanken/Caveat type, lowercase group-chat voice.

**CRISIS / SAFETY / LEGAL SURFACES STAY SOBER — non-negotiable.** The lowercase-meme voice never touches:
- `CrisisResourcesSheet` + every 988 / suicide / PPD / 911 surface
- Daily-checkin crisis verdict path (`CheckinResponseScreen` crisis card)
- `room-message-scan` crisis routing, moderator-facing copy
- Legal disclosure modals (`MilkLegalDisclosureModal`, `GearLegalDisclosureModal`), Terms, Privacy
- Anything Apple/FDUTPA/CPSIA-facing

These keep calm, plain, clinician-grade copy (EN + ES). Palette/type may update for visual consistency, but **tone does not**. "lowercase 3am meme" voice on a suicide hotline is harmful and a guaranteed Apple/legal flag.

---

## Distribution / ship path

**The whole rebrand is OTA-able.** Fonts load at runtime via `@expo-google-fonts/*` + `useFonts` (App.tsx); palette + type route through `constants.ts` tokens; voice lives in hand-rolled i18n JSON. No native module changes → ship via `eas update`, no Build 14 native rebuild required (unless an unrelated native change rides along). Fully reversible: revert the token values + i18n and the v2 look returns.

Build train context: Build 13 is mid-flight to external testers (see `docs/TESTFLIGHT_STATE.md`). The rebrand rides OTA on top of whatever native build is live; it does not block or depend on the TestFlight train.

---

## Kit spec (condensed)

### Palette
| Name | Hex | Role |
|---|---|---|
| Cream | `#FCF7EF` | app / page canvas |
| Bone | `#FFFCF6` | cards, raised surfaces |
| Honey | `#F4C53C` | bee color, sunshine moments, **secondary** buttons |
| **Rose** | `#D96C88` | **PRIMARY action** — buttons, links, active tab, key accent |
| Berry | `#C25A78` | deep pink — pressed CTA, emphasis tiles, small action text (WCAG) |
| Blush | `#F7C5CB` | soft tiles, chips, highlight rings, empathy |
| Caramel | `#C8814A` | warm chestnut accent, logo family, feature tiles |
| Clay | `#DDB58C` | dividers, dashed borders, muted warm fills |
| Chestnut Ink | `#43260F` | primary text, dark "night" tiles |
| Soft Ink | `#7A4A24` | secondary text, captions, eyebrows |

No green in this kit. No persimmon. (See *Chapter families remap* for what replaces the moss/sage/slate chapter palette.)

### Type
| Family | Weights | Role |
|---|---|---|
| **Bricolage Grotesque** | 700 Bold / 800 ExtraBold, tracking −0.03em | display headlines, big statements, wordmark fallback — "the loud bits" |
| **Hanken Grotesk** | 400 / 500 / 600 / 700 | body, UI, buttons, labels, captions. Retires JetBrains Mono. Label variant = uppercase, tracked 0.2em |
| **Caveat** | 400 / 600 | handwritten marker layer — "we see you" accents, margin notes, the per-screen human flourish. **Used sparingly.** |

### Voice
- Validate first, inform second. Lowercase, warm, texting tone. One idea per line.
- Humor about chaos / 3am — **never** about genuinely scary or sad content (see carve-out).
- Taglines: "You're a good mom. That's the post." · "it takes a village. ours lives in your pocket." · "spoiler: it's normal."
- Use: village, we see you, mom, finally, real, pocket, 3am, no notes, you're not alone.
- Avoid: you should, must, optimize, perfect, failure, guilt, bounce back, clinical jargon.

---

## Foundation token map (Phase 1)

### FONTS (`constants.ts`) — reroute RHS values
| Token(s) | Was | → Gen Z |
|---|---|---|
| `headerBold` `v2_display` `v2_display_big` `v2_bold` `bodyBold` `v3_display` | PlusJakartaSans_700Bold | **BricolageGrotesque_700Bold** (big surfaces → _800ExtraBold via style) |
| `headerItalic` `v2_display_italic` `v3_display_italic` | Fraunces_600SemiBold_Italic | **Caveat_600SemiBold** (the human accent — replaces serif italic flourish) |
| `header` | PlayfairDisplay_400Regular | BricolageGrotesque_400Regular |
| `body` `v2_body` | PlusJakartaSans_400Regular | **HankenGrotesk_400Regular** |
| `bodyMedium` `v2_label` | PlusJakartaSans_500Medium | HankenGrotesk_500Medium |
| `bodySemiBold` `v2_link` | PlusJakartaSans_600SemiBold | HankenGrotesk_600SemiBold |
| `v2_mono` `v2_mono_light` | JetBrainsMono | HankenGrotesk_600SemiBold / _500Medium (mono retired; rely on uppercase + tracking in styles) |
| `v2_wordmark` | Caprasimo_400Regular | BricolageGrotesque_800ExtraBold |
| **new** `v2_script` / `marker` | — | **Caveat_400Regular** (marginalia layer) |

> Caveat-on-accent-word is the most debatable call — it's instantly Gen Z but small x-height vs a Bricolage headline. Reversible at the token. If it reads too cute, route accent → Bricolage and reserve Caveat for true marginalia.

### COLORS (`constants.ts`) — reroute hex behind tokens
| Token(s) | Was | → Gen Z |
|---|---|---|
| `v2_cream` `cream` `ceramic` | `#F4ECD8` | `#FCF7EF` |
| `v2_paper` `v2_card` `paper` `white` `cardBg` | `#FDFBF6`/`#FEFAF6` | `#FFFCF6` (bone) |
| `v2_cinnamon` `coco` `rust` `sienna` `diner` (action) | `#C07840` | **`#D96C88` (rose)** |
| `v2_cinnamon_dk` `cocoDeep` `rustDark` (action-deep) | `#9F5F30` | **`#C25A78` (berry)** |
| `v2_butter` `v2_marigold` `gold` `yolk` | `#FAD080`/`#F2C130` | `#F4C53C` (honey) |
| `v2_blush` `pink` `pinkSoft` `blush` `v2_salmon` | `#F5BEB6`/`#F4CBC2`/`#EDA8A0` | `#F7C5CB` (blush) |
| `v2_caramel` `cocoSoft` `rustLight` | `#D4A880` | `#C8814A` (caramel) |
| `sand` `sandSoft` `v2_parchment` `creamDeep` (warm dividers/tints) | `#D4B896`/`#EAE0C8` | `#DDB58C` (clay) |
| `v2_cocoa` `bark` `brownDeep` `textDark` | `#3D1F0E` | `#43260F` (chestnut ink) |
| `v2_walnut` `barkSoft` `textMid` `brownMid` | `#7A4A28` | `#7A4A24` (soft ink) |
| `v2_amber` `textLight` (eyebrows/captions) | `#A77349` | `#7A4A24` (soft ink) |
| **+ new tokens** | — | `genz_rose` `genz_berry` `genz_honey` `genz_blush` `genz_caramel` `genz_clay` `genz_cream` `genz_bone` `genz_chestnut` `genz_softink` |

**Pending to Phase 3 (no clean 1:1):** `sage`/`sageDeep`/`v2_moss` (green — no Gen Z equiv), chapter pill tokens, the olive "always here" crisis card tint. Left as-is in Phase 1 so layouts don't break; remapped deliberately in the chapter-families phase.

---

## Canonical V10 Recipes

### Primary CTA
```tsx
{ backgroundColor: '#D96C88',        // rose
  borderRadius: 999,                  // pill (or 14 paired with rect inputs)
  paddingVertical: 15, alignItems: 'center',
  shadowColor: '#C25A78',             // berry tonal shadow
  shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 3 }
// Label: { color: '#FFFCF6', fontFamily: FONTS.bodySemiBold, fontSize: 15, letterSpacing: 0.2 }
```
- Rose + bone-white label passes **AA Large (3:1, ~3.2:1)** at 15pt+ bold — fine for buttons.
- Small rose text on cream → use **berry `#C25A78`** for contrast headroom.
- Honey `#F4C53C` is the **secondary** button (chestnut-ink label, AA-strong).
- One rose spark per screen (the "one idea, loud" rule). Disabled: `opacity: 0.45`.

### Masthead — lowercase + Caveat flourish
The big shift from V9: **headlines are lowercase Bricolage**, and the accent word is **Caveat** (handwritten), not serif italic.
```tsx
<View style={styles.greetingBlock}>
  <View style={styles.eyebrowRow}><View style={styles.eyebrowBar} /><Text style={styles.eyebrow}>SECTION</Text></View>
  <Text style={styles.title}>you're a good <Text style={styles.titleScript}>mom.</Text></Text>
  <View style={styles.rule} />
</View>
// title:       Bricolage 800, lowercase, letterSpacing -0.5, color chestnut #43260F
// titleScript: FONTS.v2_script (Caveat), color rose #D96C88, fontSize ~1.15× title (handwriting runs small)
// eyebrow:     Hanken 600, uppercase, letterSpacing 1.8, color soft-ink #7A4A24
// eyebrowBar:  22×2, rose #D96C88   ·   rule: hairline chestnut@18%, 48px
```

### Caveat marker layer
Margin notes / stickers — "we see you ♡", "no notes", "promise." Caveat 400, soft-ink or rose, slight rotation (`-3deg`). **Sparingly** — one per screen max, never on functional copy.

### Page wash + card lift (structure reused from V9, retinted)
- Page wash `V9PageBackdrop`: keep the U-shape, retint stops to cream→blush warm (`#FFFCF6 → #FCF7EF → #FCEFE9 → #F9E2E6`). Rename usage stays.
- Card: bone `#FFFCF6` bg, hairline border `rgba(201,108,120,0.18)` (rose-tinted), shadow `#43260F` offset (0,8) opacity 0.16 radius 18.
- Glass sheen unchanged (white top sheen + hairline ridge).

### Chapter color families remap (Phase 3 — no green in kit)
10 chapters / 5 families, mapped to Gen Z palette. WCAG text pairing per pill. (Final hexes set in Phase 3.)
| Family (mom / baby) | Light bg | Deep accent | Text |
|---|---|---|---|
| Feel / Grow | blush `#F7C5CB` | rose `#D96C88` | chestnut |
| Heal / Care | clay-tint | caramel `#C8814A` | bone |
| Nourish / Feed | honey-tint | honey-deep | chestnut |
| Rest / Sleep | cream-tint | soft-ink `#7A4A24` | bone |
| Tips / Tips | blush-deep | berry `#C25A78` | bone |

---

## Phases + checklists

### Phase 1 — Foundation (OTA-safe, low regret) — DONE 2026-05-29
- [x] `pnpm add @expo-google-fonts/{bricolage-grotesque,hanken-grotesk,caveat}`
- [x] Load the new families in `App.tsx` `useFonts` (legacy families kept loaded through Phase 2)
- [x] Reroute `FONTS` tokens (19) + add `v2_script` / `marker` (Caveat)
- [x] Reroute `COLORS` hex behind tokens (39) + add `genz_*` named tokens
- [x] `npx tsc --noEmit` clean
- [ ] Smoke-render Home + one masthead screen in the simulator (visual gut-check before Phase 2 sweep)

> **Note vs the FONTS table above:** `bodyBold` / `v2_bold` were routed to **Hanken 700** (body-emphasis), NOT Bricolage — only the dedicated *display* tokens (`headerBold`, `v2_display`, `v2_display_big`, `v3_display`, `v2_wordmark`) go Bricolage, so headline weight never leaks into inline bold text.
>
> **Phase 2 scope (measured):** hardcoded literals to sweep — `#C07840`→rose (269 occ / 91 files), `#945A41`→rose (45/34), `#FDFBF6`/`#FDFAF5`→bone (166/82), `#A77349`→soft-ink (105/50), `#3D1F0E`/`#3D1F0D`→chestnut (35/22), `#9F5F30`→berry (2), `#9A4A2B`→by-role (3). Raw Playfair font-name literals in **30 files** → Bricolage/Caveat. `#EAE0C8` (10) deferred to Phase 3 surface-tints.

### Phase 2 — Font + color identity sweep — DONE 2026-05-29
- [x] **Fonts changed app-wide** — all `fontFamily` was already token-driven (Phase 1 reroute); only raw refs left were 4 SVG labels in `ManualTileArt.tsx` (`"Playfair Display"` → `Caveat_600SemiBold`). Zero raw Playfair refs remain.
- [x] **Color identity sweep** — 626 literal replacements across 103 files: `#C07840`/`#945A41`→rose, `#9F5F30`→berry, `#3D1F0E`/`#3D1F0D`→chestnut `#43260F`, `#FDFBF6`/`#FDFAF5`/`#FEFAF6`→bone `#FFFCF6`, `#F4ECD8`→cream `#FCF7EF`, `#A77349`/`#9A4A2B`→soft-ink `#7A4A24`. `tsc` clean.
- [x] **Logo kept** — `v2_wordmark` token reverted to `Caprasimo_400Regular`; the `villie-wordmark-v2.png` lockup is untouched. We do NOT adopt the kit's Bricolage wordmark (Felipe 2026-05-29).
- [x] **Voice = calm-ish Gen Z hybrid** (Felipe 2026-05-29) — warm + a little playful, validate-first; NOT full lowercase-meme. Governs Phase 5. Crisis/legal stays sober.
- [ ] Retool `v9-audit.mjs` → `v10-audit.mjs` (Gen Z bans: no serif, no green spark, no mono eyebrow)
- [ ] Still v2, deferred to Phase 3: chapter pills/families, greens (moss/sage), decorative tans/butter/salmon, parchment surface tint

### Phase 3 — Decorative recolor + chapter families — DONE 2026-05-30
Per Felipe (2026-05-30): "change font + colors but nothing else — all details (gradients, bubbles, bees) stay, only their colors change." So this was a **pure recolor**, no structural/recipe changes.
- [x] Curated decorative sweep — 466 hex replacements / 70 files: greens→caramel/clay, slate→warm, old-salmons→blush, butters→honey, old-browns→chestnut/soft-ink. **Functional preserved**: success-green `#2E7D32`, alert `#D87530`, error `#B3261E`, Google `#4285F4`, password-strength scale, `CrisisResourcesSheet` palette (file excluded).
- [x] Chapter families = 5 distinct Gen Z (`MANUAL_PILL_COLORS` / `TILE_FAMILY`+`FAMILY_*` / `CHAPTER_THEME` / `SCENE_BG`): Feel/Grow=blush, Heal/Care=caramel, Nourish/Feed=honey, Rest/Sleep=clay, Tips=berry. Rose stays reserved for the action spark. Last `#C07840` cleared.
- [x] `tsc` clean · verified live on **Expo web in Chrome** (Home + Manual) — no greens, warm cream/blush/rose throughout.
- [~] Structural recipe items (PrimaryCTA component, lowercase-masthead recipe) **descoped** — colors/fonts already flow via tokens; "nothing structural" per user.
- [x] **Section-fill rule (Felipe 2026-05-30):** a full section / band background uses a **light tint** of the family color — never a saturated or dark fill across a whole section. The saturated family color stays on small elements (chips, the title period, accent stripes, the checked-row highlight). Applied to all 10 Manual chapter bands (`ManualScrollV3` BABY/MOM_CHAPTERS) + `CHAPTER_THEME` week-hero card bgs. Light tints: blush `#FBE3DF`, caramel `#F4E7D6`, honey `#FBF0D2`, clay `#F2E9DA`, berry `#FBDFE7`.
- [x] **No-brown shift (Felipe 2026-05-30, "avoid colors that look too brown / poop"):** retired caramel `#C8814A` → coral `#E98A6A` (81×) and clay `#DDB58C` → light neutral `#F2E6DD` (60×) across src + tokens; tan band tints → light coral/blush; dark-brown "Open chapter" CTA → rose. Warm accents now live on **coral + rose + honey + blush + berry** over cream/bone — no muddy mid-browns. Text inks (chestnut `#43260F`, soft-ink `#7A4A24`) stay as ink only. (crisis sheet excluded)
- [x] **Boldness via accents (Felipe 2026-05-30, "a bit bolder, not overbearing"):** the boldness lives on small elements, not sections. Active chapter chip fills with its **saturated** family color (`CHIP_TONE` in ManualScrollV3: sleep=caramel · feed/nourish=honey · grow/feel=rose · care/rest=blush · tips=berry), WCAG-correct fg (light on rose/berry/caramel, dark on honey/blush). Canvas + section fills stay light. Same lever to reach for if more pop is wanted elsewhere (active tabs, CTAs already rose).

### Phase 4 — Lockup / iconography
- [ ] Bee-over-second-i wordmark lockup (confirm asset vs. Bricolage typeset)
- [ ] Graphic elements: scribble underline, hand arrow, dot cluster, pill chip, sparkle sticker
- [ ] Clear-space = one bee-height rule on wordmark usages

### Phase 5 — Voice = measured calm-ish Gen Z hybrid (Felipe 2026-05-30: "enough to match the rebrand, not overboard")
First measured pass DONE 2026-05-30 — warmer, lowercase-leaning, kit words ("real", "promise", "in your pocket"). ~9 strings EN + 8 ES on the brand-voice path. NOT full lowercase-meme.
- [x] Splash tagline, onboarding welcome (sub + CTA "Let's go →"), login sub, signup sub ("…you're in. promise."), home villageBeat + check-in prompt/body
- [ ] Remaining surfaces (Manual, Community, Perks, Events, Gear, Milk, Me, Onboarding steps, empty states) — same measured register
- [ ] **Carve-out held**: crisis/legal/safety stay sober; ES on discharge surfaces clinician-grade
- [ ] Sync ES `checkinPendingBody` (EN warmed this pass, ES left)

### Phase 6 — Marketing surfaces (parallel / optional)
- [ ] App Store screenshots, landing page, IG/TikTok templates in the Gen Z kit

### QA gate
- [ ] WCAG AA pass on rose/berry/honey text pairings
- [ ] `v10-audit.mjs` → 0 bans
- [ ] `tsc` clean · simulator smoke on Home/Manual/Me/Onboarding

---

## Reconciliation / supersedes
- `memory/project_brand_kit_v2.md` — update to point here as the new canon **after Phase 1 lands** (don't rewrite canon before it's real).
- `CLAUDE.md` Design Tokens section — already flagged stale; V10 is the new source once Phase 1 ships.
- `docs/V9_BRAND_ROLLOUT.md` — structural recipes still valid; its color/type/voice are historical.
