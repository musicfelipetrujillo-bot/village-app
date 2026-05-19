# Village App — 60/30/10 Color Audit
**Date:** 2026-05-10  
**Scope:** `apps/mobile/src` — all color usage across tokens, hardcoded values, and gradient definitions  
**Source of truth:** `apps/mobile/src/utils/constants.ts` (Brand Kit v5)

---

## 1. Token Inventory

| Token name | Hex | Semantic role today | Coverage estimate | Verdict vs 60/30/10 |
|---|---|---|---|---|
| `cream` / `ceramic` | `#F5EFE6` | Page background (60% dominant surface) | ~55% of screen area | ✅ Correct — 60% |
| `paper` | `#FDFAF5` | Raised cards, inputs, modal surfaces | ~25% of screen area | ✅ Correct — 30% |
| `coco` / `rust` / `sienna` / `diner` | `#AD795B` | Primary CTA, active nav, eyebrows, hairlines | ~5–8% of screen area | ✅ Correct — 10% |
| `cocoDeep` / `rustDark` / `siennaDeep` | `#8B5E40` | Pressed CTA, strong accent | Rare — < 2% | ✅ Accent variant, fine |
| `cocoSoft` / `rustLight` / `dinerLight` | `#C99B7C` | Secondary CTA, hover state | Rare — < 1% | ✅ Accent variant, fine |
| `bark` / `brownDeep` / `textDark` | `#3D1F0D` | Primary body text | Text layer only | ✅ Text — outside 60/30/10 |
| `barkSoft` / `brownMid` / `textMid` | `#5A3520` | Secondary body/label text | Text layer only | ✅ Text — outside 60/30/10 |
| `textLight` | `#9A8070` | Quiet meta text (dates, captions) | Text layer only | ✅ Text — outside 60/30/10 |
| `pink` / `blush` | `#F4CBC2` | Hero accent washes, pill backgrounds, decorative | ~3–5% of screen area | ⚠️ Competing with cream for 60% — needs audit |
| `pinkDeep` / `blushDeep` | `#E5A698` | Selected pill, pressed pink state | Rare — < 1% | ⚠️ Pink family competes with coco family |
| `pinkSoft` | `#FAE2DB` | Soft tint surfaces | Rare — < 1% | ⚠️ Same |
| `sage` / `olive` | `#8B9A6B` | Calm/success accent, NPI badge | ~1–2% | ⚠️ 4th accent color — dilutes 10% bucket |
| `sageDeep` / `limeDeep` | `#6B7A4B` | Pressed sage | Rare | ⚠️ Same |
| `oliveLight` / `lime` | `#A8B58A` | Mid sage hover | Rare | ⚠️ Same |
| `mauve` | `#B8909A` | Tags, secondary labels | ~1% | ⚠️ 5th accent — further dilution |
| `mauveDeep` | `#9A707A` | Pressed mauve | Rare | ⚠️ Same |
| `sand` / `yolk` / `gold` | `#D4B896` | Warm neutral surface, inner card bands | ~2–3% | ⚠️ Competes with paper for 30% |
| `sandSoft` / `yolkLight` | `#E5D2B8` | Lighter sand/yolk wash | ~1% | ⚠️ Same |
| `yolkDark` | `#B59B7A` | Pressed sand | Rare | ⚠️ Same |
| `ceramicDeep` | `#E8DCC8` | Card-border shadow base, hairlines | < 1% | ⚠️ Borderline — could unify with sand |
| `white` / `cardBg` | `#FFFFFF` | Pure white (legacy) | ~1% | ⚠️ Conflicts with paper — two "white" tokens |

---

## 2. WarmGlowBackdrop Gradient

```
['#FDFCF9', '#FAF3EB', '#F7EDE2', '#F6E6E1', '#F5DED8', '#F3D8D0', '#F2D2CA', '#F0CECC']
```

**Assessment:** Gradient spans cream → pale pink — bridges the 60% and 10% families nicely. Serves as the "paper to warmth" transition across the full scroll height. No token conflict; all stops are in-family.  
**Verdict:** ✅ On-brand, within 60% zone

---

## 3. Hardcoded Hex Values (bypass token system)

These values appear in component files and **do not** reference `COLORS.*`:

| Location | Hardcoded value | What it is | Problem |
|---|---|---|---|
| `SpecialistCard.tsx` — `SPECIALTY_CONFIG` | `#FDEEE8`, `#EEF2E6`, `#F7F0E0`, `#EEF0FF` | Specialty tile backgrounds (4 distinct) | ❌ Off-token — 4 new tints not in system |
| `SpecialistCard.tsx` — card `borderColor` | `rgba(150, 80, 50, 0.12)` | Subtle card border | ⚠️ Should map to `rgba(COLORS.coco, 0.12)` |
| `SpecialistCard.tsx` — card `shadowColor` | `#2C1A0E` | Card drop shadow | ⚠️ Close to bark; use `COLORS.bark` |
| `SpecialistCard.tsx` — npiBadge bg | `#EEF2E6` | Same as doula/midwife specialty bg | ❌ Duplicates an off-token value |
| `SignUpScreen.tsx` — strength bar colors | `#D87530`, `#C4A35A`, `#7A8A50`, `#5C6B3A` | Password strength 4-tier gradient | ❌ 4 new colors — rust family + olive family, all off-token |
| `WarmGlowBackdrop.tsx` — gradient stops | 8 custom hex values | Backdrop gradient | ⚠️ In-family but off-token; consider tokenizing top 2–3 stops |
| `HomeScreen.tsx` — helpCard bg | `rgba(253,250,245,0.92)` | Semi-transparent card lift | ⚠️ Near-paper; use `COLORS.paper` at full opacity or add `paperGlass` token |
| `HomeScreen.tsx` — various shadow/border RGBAs | `rgba(150,80,50,…)`, `rgba(44,26,14,…)` | Borders and shadows | ⚠️ Should derive from token colors |
| Multiple screens — milk badges | `#D87530` (rust-orange), `#2E7D32` (green) | Milk status badge colors | ❌ Hard-coded, no token equivalent |

---

## 4. Token Alias Bloat

The token system has **14 legacy aliases** all pointing to the same 3–5 underlying values:

```
rust = sienna = diner = coco  →  #AD795B
rust/sienna/diner + Dark/Deep  →  #8B5E40
rust/sienna/diner + Light      →  #C99B7C
brownDeep = textDark = bark    →  #3D1F0D
brownMid = textMid = barkSoft  →  #5A3520
ceramic = cream                →  #F5EFE6
blush = pink                   →  #F4CBC2
olive = sage                   →  #8B9A6B
yolk = sand = gold             →  #D4B896
cardBg = white                 →  #FFFFFF (legacy — paper is canonical)
```

**Impact:** No runtime bug, but designers and developers see a 40-token list that is actually 12 unique colors. Intent is unclear at every call site.

---

## 5. 60/30/10 Mapping — Current State

| Role | Target | What we have today | Gap |
|---|---|---|---|
| **60% — dominant surface** | One warm off-white | `cream` #F5EFE6 + WarmGlowBackdrop gradient + `paper` #FDFAF5 + `pinkSoft` + partial `sand` washes | ⚠️ 4–5 values share the 60% zone — not one clean dominant |
| **30% — secondary structure** | One raised/lifted tone | `paper` #FDFAF5 (strong, mostly consistent) | ✅ Paper is clearly 30% — but `sand` trespasses here too |
| **10% — accent** | One warm CTA color | `coco` #AD795B (strong, consistent on CTAs + nav) | ⚠️ But `pink`, `sage`, `mauve` + hardcoded specialty colors all compete for this slot — effectively 5+ accent families |

---

## 6. Key Issues (priority order)

1. **5 competing accent families** (`coco`, `pink`, `sage`, `mauve`, `sand`) dilute the 10% slot. One should win per context — coco for interactive, pink for decorative wash, sage for success/health, mauve deprecate.
2. **14 legacy aliases** create decision fatigue. Every `rust` / `sienna` / `diner` call site should migrate to `coco`.
3. **4 off-token specialty tile backgrounds** in `SpecialistCard.tsx` — need to map to `pinkSoft`, `sage`-tinted, or `sand`-tinted tokens.
4. **Password strength colors** (`#D87530`, `#C4A35A`, `#7A8A50`, `#5C6B3A`) — 4 new greys/olives outside the token system.
5. **Milk status badge colors** (`#D87530`, `#2E7D32`) — hardcoded, no token equivalent.
6. **`white` / `cardBg` tokens** still in use — should be replaced with `paper` everywhere; white only for `#FFFFFF` accents like the shine layer.
7. **`ceramicDeep`** (`#E8DCC8`) is borderline — closest match is `sandSoft` (`#E5D2B8`); could consolidate.

---

## 7. What's Working Well

- `coco` is clean and consistent as the primary CTA — all buttons, active nav, Book pills use it.
- `paper` reads clearly as the raised card surface — most card backgrounds use it.
- `bark` / `textDark` is used consistently as the primary text color — no mixed text palettes on body copy.
- `cream` / `ceramic` as the page background is stable — no page-level color conflicts.
- WarmGlowBackdrop gradient is on-brand and in-family.
- The 3-token primary palette documentation in `constants.ts` is correct and useful.

---

## 8. Recommended 60/30/10 Targets (for Step 2 approval)

| Role | Proposed canonical token | Hex | Notes |
|---|---|---|---|
| 60% page surface | `cream` | `#F5EFE6` | Lock this as THE background; deprecate `ceramic` alias |
| 60% gradient range | WarmGlowBackdrop | `#FDFCF9`→`#F0CECC` | Keep as-is — it's a cream variation, not a new color |
| 30% raised surface | `paper` | `#FDFAF5` | All cards, inputs, modals — clean |
| 30% inner band | `sand` | `#D4B896` | Limit to baby card stat bands + dividers only; deprecate `yolk`/`gold` aliases |
| 10% interactive accent | `coco` | `#AD795B` | All CTAs, active states, eyebrows — deprecate `rust`/`sienna`/`diner` |
| 10% decorative wash | `pink` | `#F4CBC2` | Decorative tints only (no interactive) — deprecate `blush` alias |
| Health/success signal | `sage` | `#8B9A6B` | NPI badge, crisis card accents, success states — deprecate `olive`/`lime` |
| ~~`mauve`~~ | deprecate | `#B8909A` | No clear role; replace with `textLight` at affected call sites |

> **This section is a preview only. Await approval before Step 2 (palette proposal) and Step 3 (token refactor).**
