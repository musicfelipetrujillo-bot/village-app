# Villie Bee — per-section character art (image-gen prompt pack)

Route B: bespoke **painterly raster** bee characters that match the existing
`assets/brand/villie-bee.png` mascot, for the four Village section heroes.
Generate these, hand me the transparent PNGs, and I'll wire them into the
honeycomb mastheads (background-removed if needed, @2x/@3x, animated).

## How to use this
1. **Best results = image-to-image / character reference.** If your tool
   supports a reference image (gpt-image-1, Gemini image, Flux Kontext,
   Ideogram "character"), attach `assets/brand/villie-bee.png` as the style +
   character reference so every new bee is unmistakably the *same* bee.
2. Generate the **base bee sprite first** (below), confirm it matches, then
   generate each scene/variant so they all share one look.
3. Recommended models from what's available: **gpt-image-1-high** or
   **gemini-3-pro-image-hd** (great at transparent backgrounds + character
   consistency), **flux-kontext-pro** (if using the reference image), or
   **recraft-v4** (clean, transparent). Avoid generic "illustration" presets —
   they drift off-style.

## Output specs (every asset)
- **Transparent background**, PNG.
- **Square canvas, 1024×1024**, character centered with ~12% padding.
- No drop shadow baked in (I add shadows in-app), no ground plane, no text.
- Deliver one file per item below. For the animated scenes I want the
  **individual bees as separate sprites** (so I can fly them in), PLUS the
  prop as its own sprite. If you only want static scenes, the "scene" prompts
  also work — tell me and I'll place them as single images.

## Global style block (paste into every prompt)
> Soft hand-illustrated children's-book mascot, warm and friendly, gentle
> painterly shading with no harsh outlines. A rounded honey-yellow bee
> (honey `#F4C53C`) with warm dark-brown stripes (`#43260F`), small translucent
> cream wings, slim antennae with rounded tips, tiny friendly face. Cohesive
> with a cozy maternal brand in cream + honey + blush tones. Centered,
> transparent background, no text, no ground shadow.

## The base bee (generate + approve first)
> [global style block] A single villie bee in a calm 3/4 flying pose, facing
> right, wings up mid-flutter, soft and approachable.

## 1. 🍼 Milk Connect — "two bees meet"
- **Sprites:** the base bee (facing right) + a mirrored copy (facing left), and
  a small **milk droplet** (soft cream/white teardrop with a faint blush rim).
- **Scene prompt (if static):**
> [global style block] Two villie bees facing each other, nuzzling tenderly
> just above a single glowing honeycomb cell that cradles one soft white milk
> droplet. Warm, gentle, a moment of connection between two moms.

## 2. 📦 Baby Gear — "the hand-off"
- **Sprites:** base bee (facing right, arms/forelegs forward, *offering*) +
  mirrored bee (facing left, *receiving*) + a small **parcel** (kraft/cream box,
  blush ribbon tied in a cross, tiny gift tag).
- **Scene prompt (if static):**
> [global style block] Two villie bees passing a small ribbon-tied parcel
> between them mid-air over a honeycomb, one gently handing it to the other.
> Joyful, generous, "hand-me-down" warmth.

## 3. 🩺 Specialists — "the expert bee" (the one that needs real art)
- **Sprite:** the base bee wearing a **soft teal surgical cap** and a
  **stethoscope** draped around its neck (slim charcoal-teal tubing, round
  chestpiece resting on its chest). Optional tiny clipboard in one foreleg.
  Keep it adorable, not clinical-cold — trustworthy and kind.
- **Prompt:**
> [global style block] The villie bee as a gentle care provider: wearing a soft
> teal surgical cap and a stethoscope draped around its neck with a round
> chestpiece on its chest. Warm, reassuring, expert-but-kind. Same bee, same
> style as the reference.

## 4. 🗓️ Villie Plans — "the gathering"
- **Sprites:** three base bees at slightly different sizes/angles (for a little
  circle), + an optional **glowing honeycomb cell** they gather around (or I'll
  draw that part in-app).
- **Scene prompt (if static):**
> [global style block] Three villie bees gathered in a friendly little circle
> around one warm, glowing honeycomb cell, as if meeting for coffee. Community,
> belonging, a cozy get-together.

## After you generate
Send me the PNGs (or drop them in `assets/brand/bees/`). Naming I'll expect:
`bee-base.png`, `bee-base-flip.png`, `bee-scrubs.png`, `bee-offer.png`,
`bee-receive.png`, `parcel.png`, `milk-drop.png`. I'll handle background
removal (if any), resizing, and the entry animations.
