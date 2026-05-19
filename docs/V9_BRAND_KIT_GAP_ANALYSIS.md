# V9 Brand Kit — Gap Analysis vs Canonical Kit

**Source of truth (NEW, supersedes everything earlier):**
`/Users/gp/Desktop/the-village-ig/project/The Village - Brand Kit.html`

This doc captures what the canonical kit says vs what the app currently does, so we can plan the catch-up work. Not a code-change doc — this is the audit.

---

## What the canonical kit says

### Color tokens (canon)

| Token | Hex | Role per kit |
|---|---|---|
| `--cream` | `#F4ECD8` | Page surface |
| `--paper` | `#FDFBF6` | Alt page (where the app actually lives) |
| `--parchment` | `#EAE0C8` | Card surface · "Week 30" card bg |
| `--card` | `#FEFAF6` | Pure-white substitute |
| `--butter` | `#FAD080` | Halos, gradients |
| `--marigold` | `#F2C130` | IG hero pop |
| **`--caramel`** | **`#D4A880`** | Italic-name accent ("Feli."), neutral chips |
| **`--cinnamon`** | **`#C07840`** | **The wordmark + every CTA, link, active tab. One spark per screen.** |
| `--blush` | `#F5BEB6` | Empathy moments |
| `--salmon` | `#EDA8A0` | Soft action chips, Feel-adjacent |
| `--sage` | `#D8CEB0` | Cool exhale, "Find moms" |
| `--moss` | `#606E46` | Heal chapter, garden energy |
| `--persimmon` | `#E0543B` | **IG only — NOT in the app.** |
| `--cocoa` | `#3D1F0E` | UI ink, headlines |
| `--walnut` | `#7A4A28` | Body text |
| **`--amber`** | **`#A77349`** | **Eyebrows, captions, secondary copy. The quietest voice.** |
| `--rule` | `rgba(61,31,14,0.13)` | Hairline rule |

### Manual chapter palette (canon — page 02·E)

| Chapter | Hex | Note |
|---|---|---|
| Feel | `#D09789` | Warm pink — emotion, matrescence |
| Heal | `#6E7E51` | Moss — body, recovery |
| Feed | `#C7B39B` | Warm tan — breast / bottle / combo / solids |
| Sleep | `#A1775F` | Warm brown — naps, regressions, 3am |
| Tips | `#986A50` | Coppery brown — small hard-won tricks |

Kit shows **5 chapters total** — not 10. No mom-vs-baby split.

### Typography canon
- **Playfair Display roman 700** is the DEFAULT. Italic is the flourish.
- **Playfair italic 600** = ONE moment per screen on user's name OR key noun OR brand line. Always in **cinnamon `#C07840`**.
- **Plus Jakarta Sans** for body / buttons / tabs / forms / labels. 400 body, 500 labels, 600 buttons.
- **Caprasimo** only for the typeset "villie" fallback when the wordmark asset can't be placed.
- **JetBrains Mono** for eyebrows / dates / metadata. Tracking 0.26em, uppercase, **amber** (per section 02 + CSS class).

### Italic rule (one-per-screen) — three sanctioned uses
1. **User's name** — `Good evening, <em cinnamon>Feli.</em>`
2. **Key noun-phrase at end of a question** — `What do you need <em cinnamon>right now?</em>`
3. **Brand line** — `It takes <em cinnamon>a village.</em>`

ALL three uses → italic accent color = **cinnamon `#C07840`**.

---

## How far off we are

### A. Critical — Color hierarchy collapsed
I shipped the entire v9 rollout using **rust-deep `#9A4A2B`** as the universal accent for eyebrows + italic names + section headlines. The kit splits this into THREE distinct colors:

- **Eyebrows / captions** → amber `#A77349` (the quietest voice)
- **Italic names + section flourishes** → cinnamon `#C07840` (the brand spark)
- **CTAs / links / tabs** → cinnamon `#C07840`

So my rust-deep is doing the job of all three. Visual hierarchy collapses because the eyebrow above a title and the italic accent in the title are the same color — they should differ in loudness.

**Affected surfaces** — basically everything I touched this session:
- All `eyebrow:` style blocks across hubs and depth screens
- Every italic title accent
- Every "back" link
- Every section eyebrow bar

### B. Critical — CTA color
I picked **`#945A41` action-deep** for CTAs because cinnamon `#C07840` on white text = 3.5:1 (fails WCAG AA at normal text). Brand kit canon is **cinnamon `#C07840`**.

Resolution path: cinnamon passes WCAG AA for "large text" (≥18pt OR ≥14pt bold), which all our CTA buttons use. Brand kit explicitly says "every CTA … cinnamon." So **cinnamon is the correct CTA fill**.

22 CTAs unified to action-deep this session need to swap back to cinnamon. Text on top stays paper white `#FDFAF5` and contrast is fine for the 15-16pt SemiBold/Bold weights we use.

### C. Critical — Chapter set
App ships **10 chapters** (mom × {Feel, Heal, Nourish, Rest, Tips} + baby × {Feed, Sleep, Grow, Care, Tips}).
Brand kit canon: **5 chapters** (Feel · Heal · Feed · Sleep · Tips).

The kit folds:
- Nourish → Feed (covers mom feeding too)
- Rest → Sleep
- The mom-vs-baby split disappears entirely

Plus the kit chapter HEX values are different — softer, ceramic-glaze tones (`#D09789` / `#6E7E51` / `#C7B39B` / `#A1775F` / `#986A50`) versus my deep saturated set (`#A55248` / `#606E46` / `#8C6D1E` / `#5B6A82` / `#9F5F30`).

**Decision needed (product call, not just design):**
1. **Adopt kit canon** — drop to 5 universal chapters, restructure manual_videos to remove `audience` split, retint pills to the soft kit colors with cocoa/walnut text (not paper white).
2. **Keep app's 10-chapter expansion** — treat the kit's 5 as a "common" set and document the mom/baby split as an app-only extension.
3. **Halfway** — keep 10 chapters but adopt kit pill colors + collapse Nourish/Feed and Rest/Sleep to use the same family color.

### D. Medium — Persimmon is IG-only
Kit explicitly says persimmon `#E0543B` "NOT used in the app." Verified: no app screens currently use persimmon. ✓

### E. Medium — `--paper` is `#FDFBF6`, not `#FDFAF5`
I've been writing `'#FDFAF5'` as the paper-white literal. Kit's paper is `#FDFBF6` (1 hex off — `5F`→`F6`). Tiny visual difference but technically drift.

### F. Minor — Wordmark Caprasimo asset path
Kit names the asset `assets/villie-wordmark.png` (and `villie-v-mark.png`). Repo has `assets/brand/villie-wordmark-v2.png` and similar. Asset paths diverge.

---

## What's already correct

- Page wash pattern (paper-leaning gradient) ✓ matches "Paper page surface" intent
- Card lift recipe (cocoa drop) ✓ correct intent
- iOS-26 Liquid Glass top sheen ✓ adds tactile depth
- "Italic per screen ≤ 1 phrase" rule ✓ followed everywhere
- Playfair Bold roman as default display ✓ all titles now use it after this session's sweep
- Plus Jakarta for body / buttons ✓ canonical
- JetBrains Mono for eyebrows ✓ (where it's used)
- Big numbers in Playfair ✓ swept this session
- No pure white text ✓ swept to paper this session
- No side-stripe borders ✓ swept earlier
- No persimmon in app ✓ never shipped

---

## Recommended catch-up plan (do NOT auto-execute)

This is a meaningful rework. Need user sign-off on each phase before shipping.

### Phase 1 — Color hierarchy split (lowest risk, high impact)
1. Replace canonical italic-name accent: `#9A4A2B` → `#C07840` cinnamon. Affected: greetingNameAccent on HomeScreen + all editorial mastheads (10 screens).
2. Replace canonical eyebrow color: `#9A4A2B` → `#A77349` amber. Affected: every `eyebrow:` style + `eyebrowBar:` background across the app (~30 spots).
3. Section bars / hairlines under titles stay rule-tinted (rgba(61,31,14,0.18)). ✓ already correct.

### Phase 2 — CTA color swap (medium risk)
1. Replace `#945A41` → `#C07840` cinnamon on the 22 unified CTAs. Test WCAG AA on each (should pass for 15pt+ bold).
2. Shadow shifts from cocoa-tinted to cinnamon-tinted: `shadowColor: '#7A4530'` → `shadowColor: '#C07840'` to match the fill.

### Phase 3 — Chapter set decision + repaint (high risk, product-level)
Pick adoption mode 1 / 2 / 3 above. If adopting kit chapters:
1. Migration to rename `manual.babyNourish` → `babyFeed` (already exists), drop `babyGrow` / `babyCare` mapping, rename `momRest` → `momSleep` mapping.
2. Repaint pill colors with the ceramic-glaze tones. Pill text shifts from paper white → cocoa `#3D1F0E` (because new pill colors fail WCAG on paper text).
3. Chapter pages get the new accents — affects 10 chapter routes, the home Manual block, and Manual Home tiles.

### Phase 4 — Token correction (cosmetic)
1. `'#FDFAF5'` literal → `'#FDFBF6'` per kit `--paper`. Sweep ~20+ files.
2. Verify wordmark asset paths match the kit's expected names.

---

## Update memory + rollout doc

If the user approves any of these phases, update:
- `docs/V9_BRAND_ROLLOUT.md` — canonical recipes section gets the corrected values
- `memory/project_brand_kit_v2.md` — palette table gets the corrected hexes
- The "rust-deep `#9A4A2B`" mantra throughout the rollout doc gets retired

**Until then**: this gap analysis is the authoritative reference for what the kit says vs what shipped.
