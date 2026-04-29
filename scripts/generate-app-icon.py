#!/usr/bin/env python3
"""
Generate The Village app icon — a grounded, abstract circle of people seated
around a small campfire. Hand-drawn pencil look on a cream field.

Output: apps/mobile/assets/icon.png (1024x1024, opaque)

v6 design — per user direction ("go towards the first one with the new
directions… the v1 had some abstract factors that were cool… like a
grounded abstract circle"):

- Plain cream field, soft pencil noise. No bezel / frame.
- The "ground" is a single wobbly rust ring — slightly flattened (ellipse,
  not a perfect circle) so the viewer feels elevated ~20°, not directly
  above. That's the grounded-circle read.
- Each seated person is an ABSTRACT mark, not a literal silhouette:
    • round head dot (dark brown)
    • a simple open "V" opening downward-outward = crossed legs on the floor
    • a short arc behind the head = shoulders/back
  The marks are pencil-wobbly, not polygons. This preserves v1's graphic
  quality and reads at any size without looking like blobs or balls.
- A small campfire sits at the center of the ring: soft warm glow + crossed
  dark logs + two low gold flame tongues. Not a sun. No radial rays.
- One figure (front-right) is rendered in rust instead of brown for a gentle
  focal accent — echoes v1's color rhythm.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# ---- design tokens ----
# Palette shifts v9: figures are one consistent warm dark umber (tanner than
# near-black FIGURE), background is a clay/sand tone (earthier than the
# cream CLAUDE.md token), ring is a muted terracotta. Fire keeps gold/rust
# so it stays warm against the earthier field.
CLAY        = (216, 184, 146)   # warm sand / clay background
FIGURE      = (82,  50,  30)    # warm dark umber — silhouettes
FIGURE_HI   = (128, 84,  54)    # lighter rim/highlight on figures (fire glow)
FIGURE_LO   = (54,  32,  18)    # darker accent (hair / hood suggestion)
SWADDLE     = (236, 214, 176)   # pale cream — baby wrap peeking over shoulder
MOON        = (240, 220, 180)   # soft cream crescent moon
RING_COLOR  = (158, 78,  46)    # muted terracotta
RING_ECHO   = (198, 118, 82)    # faint inner-ring echo
RUST        = (184, 92,  56)    # fire
RUST_DARK   = (154, 74,  43)
RUST_LIGHT  = (212, 116, 79)
GOLD        = (196, 163, 90)
SPARK       = (228, 200, 130)

SIZE  = 1024
CX    = SIZE // 2
CY    = 540          # slightly above center so the fire + ring feel grounded

# Ring geometry — flattened ellipse (ry / rx ~= 0.58) gives a low 3/4 view.
# Zoomed further in v11 so the scene pushes toward the canvas edges and
# reads at small icon sizes. The iOS rounded-rect mask will crop the
# outermost figures cleanly.
RING_RX = 380
RING_RY = 222

random.seed(7)


# ---------- sketch primitives ----------

def jitter(pt, amp=2.4):
    return (pt[0] + random.uniform(-amp, amp), pt[1] + random.uniform(-amp, amp))


def sketch_line(draw, p1, p2, color, width=6, passes=2, segments=10, jitter_amp=1.8):
    for _ in range(passes):
        prev = jitter(p1, jitter_amp)
        for i in range(1, segments + 1):
            t = i / segments
            raw = (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)
            nxt = jitter(raw, jitter_amp)
            draw.line([prev, nxt], fill=color, width=width)
            prev = nxt


def sketch_arc(draw, center, rx, ry, start_deg, end_deg, color,
               width=6, passes=2, steps=60, jitter_amp=1.8):
    for _ in range(passes):
        prev = None
        for i in range(steps + 1):
            t = i / steps
            ang = math.radians(start_deg + (end_deg - start_deg) * t)
            raw = (center[0] + rx * math.cos(ang), center[1] + ry * math.sin(ang))
            cur = jitter(raw, jitter_amp)
            if prev is not None:
                draw.line([prev, cur], fill=color, width=width)
            prev = cur


def wobbly_dot(draw, center, rx, ry, color, wobble=1.2, steps=28):
    pts = []
    for i in range(steps):
        ang = 2 * math.pi * i / steps
        wx = rx + random.uniform(-wobble, wobble)
        wy = ry + random.uniform(-wobble, wobble)
        pts.append((center[0] + wx * math.cos(ang), center[1] + wy * math.sin(ang)))
    draw.polygon(pts, fill=color)


# ---------- paper ----------

def paint_background(img):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, SIZE, SIZE], fill=CLAY)
    # Fine grain — earthy, less busy than cream paper noise.
    noise = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    nd = ImageDraw.Draw(noise)
    for _ in range(2400):
        x = random.randint(0, SIZE - 1)
        y = random.randint(0, SIZE - 1)
        a = random.randint(3, 10)
        nd.point((x, y), fill=(*FIGURE, a))
    noise = noise.filter(ImageFilter.GaussianBlur(radius=0.7))
    img.alpha_composite(noise)


# ---------- ground ring ----------

def draw_ground_ring(draw):
    """A single wobbly terracotta ring = the 'ground circle' they sit around.
    Two passes for a pencil-rubbed feel; one lighter inner echo for depth."""
    sketch_arc(
        draw, (CX, CY),
        rx=RING_RX, ry=RING_RY,
        start_deg=0, end_deg=360,
        color=RING_COLOR,
        width=9, passes=2, steps=180, jitter_amp=3.0,
    )
    sketch_arc(
        draw, (CX, CY),
        rx=RING_RX - 16, ry=RING_RY - 10,
        start_deg=0, end_deg=360,
        color=RING_ECHO,
        width=3, passes=1, steps=140, jitter_amp=2.2,
    )


# ---------- campfire ----------

def draw_campfire(draw):
    """Soft warm glow + crossed logs + lively layered flame tongues. Not a sun."""
    # Extended warm glow — reaches all the way to the ring in a soft gradient
    # from faint RUST_LIGHT at the ring's inner edge through warmer tones to
    # GOLD at the fire. Built as a stack of concentric wobbly ellipses with
    # progressively shorter radii and stronger alpha so painter-order blends
    # into a continuous degrade against the clay background.
    #
    # Each layer: (rx, ry, color, alpha, wobble, steps). Outermost first so
    # later (brighter/smaller) layers land on top.
    glow_layers = [
        (372, 214, RUST_LIGHT, 18, 5.4, 64),   # kisses the ring
        (336, 192, RUST_LIGHT, 28, 5.0, 60),
        (298, 170, RUST_LIGHT, 40, 4.8, 58),
        (262, 148, RUST_LIGHT, 55, 4.6, 56),
        (226, 128, RUST_LIGHT, 78, 4.2, 54),
        (190, 108, RUST_LIGHT, 110, 3.6, 50),
        (156, 90,  GOLD,       140, 3.0, 48),
        (124, 70,  GOLD,       180, 2.6, 46),
        (92,  54,  GOLD,       220, 2.0, 42),
        (68,  42,  GOLD,       255, 1.6, 38),
    ]
    for rx, ry, base_color, alpha, wobble, steps in glow_layers:
        color = (*base_color, alpha) if alpha < 255 else base_color
        wobbly_dot(draw, (CX, CY + 10), rx, ry, color, wobble=wobble, steps=steps)

    # Crossed logs — flattened onto ground plane, longer and chunkier.
    log_len = 148
    for deg in (18, -22, 82):
        ang = math.radians(deg)
        dx = math.cos(ang) * log_len
        dy = math.sin(ang) * log_len * 0.38
        a = (CX - dx, CY - dy + 16)
        b = (CX + dx, CY + dy + 16)
        sketch_line(draw, a, b, FIGURE, width=18, passes=2, segments=10, jitter_amp=1.6)
        for pt in (a, b):
            wobbly_dot(draw, pt, 13, 9, FIGURE, wobble=0.9, steps=20)

    # Flames — layered outer rust tongues behind taller gold tongues for a
    # flickering, lively silhouette. Varied heights + slight asymmetric lean.
    def flame_poly(base_x, base_y, tall, wide, lean=0.0, curl=0.0):
        """Teardrop-ish flame with a curved tip, built as a wobbly polygon."""
        tip = (base_x + lean, base_y - tall)
        pts = []
        steps_side = 10
        # Left side: base-left -> tip, with inward curl near the top.
        for i in range(steps_side + 1):
            t = i / steps_side
            # Width tapers from `wide` at base to 0 at tip, with a slight
            # bulge at the midpoint.
            w = wide * (1 - t) ** 0.85 + wide * 0.18 * math.sin(math.pi * t)
            # Curl the tip sideways.
            sway = curl * (t ** 2)
            x = base_x - w + lean * t + sway
            y = base_y - tall * t
            pts.append(jitter((x, y), 0.9))
        pts.append(jitter(tip, 0.6))
        # Right side: tip -> base-right.
        for i in range(steps_side + 1):
            t = 1 - (i / steps_side)
            w = wide * (1 - t) ** 0.85 + wide * 0.18 * math.sin(math.pi * t)
            sway = curl * (t ** 2)
            x = base_x + w + lean * t + sway
            y = base_y - tall * t
            pts.append(jitter((x, y), 0.9))
        return pts

    fire_base_y = CY + 14

    # Outer rust flames — wider, shorter, behind.
    outer = [
        dict(base_x=CX - 30, base_y=fire_base_y, tall=106, wide=36, lean=-4, curl=-7),
        dict(base_x=CX + 32, base_y=fire_base_y, tall=120, wide=40, lean=4,  curl=10),
        dict(base_x=CX,      base_y=fire_base_y, tall=86,  wide=30, lean=0,  curl=0),
    ]
    for o in outer:
        draw.polygon(flame_poly(**o), fill=RUST)

    # Mid gold flames — tall, layered on top of rust.
    mid = [
        dict(base_x=CX - 22, base_y=fire_base_y - 6, tall=130, wide=24, lean=-7, curl=-10),
        dict(base_x=CX + 24, base_y=fire_base_y - 6, tall=146, wide=26, lean=8,  curl=11),
    ]
    for m in mid:
        draw.polygon(flame_poly(**m), fill=GOLD)

    # Bright inner core.
    core = flame_poly(base_x=CX + 4, base_y=fire_base_y - 12, tall=82, wide=14, lean=3, curl=4)
    draw.polygon(core, fill=(240, 210, 140))

    # Sparks floating higher above the bigger fire.
    for (sx, sy, sr) in (
        (CX - 14, fire_base_y - 172, 4),
        (CX + 22, fire_base_y - 200, 4),
        (CX + 46, fire_base_y - 140, 3),
        (CX - 32, fire_base_y - 130, 3),
    ):
        wobbly_dot(draw, (sx, sy), sr + 1, sr + 1, SPARK, wobble=0.5, steps=14)


def draw_moon(draw):
    """Soft crescent moon above the fire — maternal/feminine symbol.
    Built as a pale wobbly disc with a clay-colored bite taken out."""
    moon_cx = CX - 240
    moon_cy = CY - 300
    r = 28
    # Full pale disc.
    wobbly_dot(draw, (moon_cx, moon_cy), r, r, MOON, wobble=1.6, steps=40)
    # Bite — a clay-colored disc offset slightly right-and-down carves out
    # the crescent shape. Offset is what defines the crescent's thickness.
    wobbly_dot(draw, (moon_cx + 11, moon_cy + 2), r, r, CLAY, wobble=1.6, steps=40)


# ---------- a single abstract seated person ----------

def draw_person(draw, center, scale=1.0, accent=False, cradle=False, depth=0.5):
    """
    Abstract seated silhouette. Every figure faces the campfire at the
    center. The viewer is slightly elevated, so figures on the BACK of the
    ring (low depth, top of icon) face TOWARD the viewer — their babies
    are fully visible cradled in their arms. Figures on the FRONT of the
    ring (high depth, bottom of icon) have their BACKS to the viewer —
    their babies are mostly occluded by the mother's body, only a small
    peek of swaddle is visible at her side.

    `depth` ∈ [0, 1]: 0 = far/back of ring (facing viewer), 1 = near/front
    of ring (back to viewer). Used to decide baby visibility.

    `accent` is retained in the signature for call-site compatibility but
    currently unused — all figures are one consistent umber silhouette.
    """
    _ = accent  # intentionally unused; see docstring
    cx, cy = center
    body_color = FIGURE

    # ---- back (rounded pear silhouette) ----
    # Two half-ellipses stitched at the equator — shoulder dome up top,
    # rounded base below (crossed legs tucked under). Slimmed base + taller
    # shoulders so the figure reads as a person, not a mushroom.
    back_w_top    = 30 * scale   # shoulder half-width
    back_w_bottom = 42 * scale   # base half-width
    back_h_top    = 42 * scale   # shoulder dome height
    back_h_bottom = 50 * scale
    equator_y     = cy + 2 * scale

    # Rougher hand-drawn edges + a low-frequency undulation along the
    # contour so the outline reads as organic fabric/blanket folds rather
    # than a stamped vector shape.
    contour_steps = 80
    pts = []
    for i in range(contour_steps):
        ang = 2 * math.pi * (i / contour_steps) - math.pi / 2
        sin_a = math.sin(ang)
        cos_a = math.cos(ang)
        if sin_a < 0:
            rx = back_w_top
            ry = back_h_top
        else:
            rx = back_w_bottom
            ry = back_h_bottom
        undulate = 1.0 + 0.055 * math.sin(ang * 5.0 + (cx + cy) * 0.013)
        x = cx + rx * cos_a * undulate
        y = equator_y + ry * sin_a * undulate
        pts.append(jitter((x, y), 2.6))
    draw.polygon(pts, fill=body_color)

    # Subtle fire-side rim-light: a short wobbly arc along the upper inner
    # edge of the shoulder dome, painted in FIGURE_HI. Only the inner edge,
    # not the full outline — suggests warmth catching one side of the back.
    # Unit vector from this figure toward the fire at (CX, CY):
    dx_to_fire = CX - cx
    dy_to_fire = CY - equator_y
    to_fire_ang = math.degrees(math.atan2(dy_to_fire, dx_to_fire))
    # Convert to the ellipse-coordinate convention used by sketch_arc:
    # sketch_arc's deg 0 is +x, 90 is +y (PIL's y-down). Draw a ~90° arc
    # centered on the direction to the fire.
    sketch_arc(
        draw, (cx, equator_y),
        rx=back_w_top * 0.92, ry=back_h_top * 0.92,
        start_deg=to_fire_ang - 55, end_deg=to_fire_ang + 55,
        color=FIGURE_HI,
        width=max(3, int(4 * scale)),
        passes=1, steps=28, jitter_amp=1.4,
    )

    # --- hair (long cascade down the back) ---
    # Darker polygon draped from around head-crown height down to mid-shoulder.
    # Frames the head and signals a feminine/maternal figure from behind.
    # Built as a soft teardrop: narrow at the top, flaring wider as it
    # descends onto the shoulder, tapering slightly at the bottom edge.
    head_rx_pre = 22 * scale   # mirrors the head size computed below
    hair_top_w  = head_rx_pre * 0.72
    hair_mid_w  = head_rx_pre * 1.35
    hair_bot_w  = back_w_top  * 0.95
    hair_top_y  = equator_y - back_h_top - head_rx_pre * 0.30
    hair_bot_y  = equator_y - back_h_top * 0.18

    hair_pts = []
    def hair_width(t: float) -> float:
        # Width interpolates: narrow top -> widest around 35% down -> slightly
        # narrower at the bottom where it hangs over the shoulder.
        if t < 0.35:
            u = t / 0.35
            return hair_top_w + (hair_mid_w - hair_top_w) * u
        u = (t - 0.35) / 0.65
        return hair_mid_w + (hair_bot_w - hair_mid_w) * u

    n_side = 14
    # Left side top -> bottom
    for i in range(n_side):
        t = i / (n_side - 1)
        w = hair_width(t)
        y = hair_top_y + (hair_bot_y - hair_top_y) * t
        hair_pts.append(jitter((cx - w, y), 1.6))
    # Bottom edge — slight wave
    for i in range(1, 8):
        t = i / 8
        x = (cx - hair_bot_w) + (2 * hair_bot_w) * t
        y = hair_bot_y + math.sin(math.pi * t) * 6 * scale
        hair_pts.append(jitter((x, y), 1.4))
    # Right side bottom -> top
    for i in range(n_side):
        t = 1 - (i / (n_side - 1))
        w = hair_width(t)
        y = hair_top_y + (hair_bot_y - hair_top_y) * t
        hair_pts.append(jitter((cx + w, y), 1.6))
    # Top curve — small dome over the crown.
    for i in range(1, 6):
        t = i / 6
        x = (cx + hair_top_w) - (2 * hair_top_w) * t
        y = hair_top_y - math.sin(math.pi * t) * 4 * scale
        hair_pts.append(jitter((x, y), 1.1))

    draw.polygon(hair_pts, fill=FIGURE_LO)

    # ---- head ----
    # Same color as body — they merge into a single silhouette. The hair
    # polygon already drawn sits behind and around it, framing the face.
    head_rx = 22 * scale
    head_ry = 23 * scale
    head_cx = cx
    head_cy = equator_y - back_h_top - head_ry * 0.35
    wobbly_dot(draw, (head_cx, head_cy), head_rx, head_ry, body_color, wobble=1.2, steps=30)

    # A soft bun / hair-crown darker cap just above the head-top, letting
    # hair visibly sit over the back of the skull too.
    sketch_arc(
        draw, (head_cx, head_cy - head_ry * 0.25),
        rx=head_rx * 0.80, ry=head_ry * 0.55,
        start_deg=200, end_deg=340,
        color=FIGURE_LO,
        width=max(3, int(4 * scale)),
        passes=2, steps=22, jitter_amp=1.0,
    )

    # Small warm rim-light on the fire-side cheek of the head.
    rim_ang = math.degrees(math.atan2(CY - head_cy, CX - head_cx))
    sketch_arc(
        draw, (head_cx, head_cy),
        rx=head_rx * 0.95, ry=head_ry * 0.95,
        start_deg=rim_ang - 35, end_deg=rim_ang + 35,
        color=FIGURE_HI,
        width=max(2, int(3 * scale)),
        passes=1, steps=18, jitter_amp=0.9,
    )

    # ---- cradled baby (drawn LAST, in front of the mother silhouette) ----
    # Visibility depends on viewer POV. Back-row figures face the camera,
    # so the whole baby bundle is visible in their arms. Front-row figures
    # have their backs to the camera — their baby is held in front of the
    # body (away from us), so only a small peek of swaddle shows at the
    # side of the silhouette.
    if cradle:
        if depth < 0.5:
            # Far-side mother — facing the viewer. Full baby: round head
            # on top of a wrapped bundle. Head + body spaced so both shapes
            # read distinctly (not a single blob). Kept small so the far
            # baby doesn't dominate the smaller far figure.
            body_rx = 9 * scale
            body_ry = 7 * scale
            body_cx = cx
            body_cy = equator_y - back_h_top * 0.02
            head_r  = 5.5 * scale
            head_cx = cx
            # Stack: head bottom meets body top with a small overlap seam.
            head_cy = body_cy - body_ry - head_r * 0.25

            # Wrapped body (wider oval, narrower at neck via a second pass).
            wobbly_dot(draw, (body_cx, body_cy), body_rx, body_ry, SWADDLE, wobble=1.1, steps=32)
            # Seam shadow between head and body to separate them visually.
            sketch_arc(
                draw, (head_cx, head_cy + head_r * 0.85),
                rx=head_r * 0.90, ry=head_r * 0.35,
                start_deg=200, end_deg=340,
                color=FIGURE_LO,
                width=max(2, int(2 * scale)),
                passes=1, steps=16, jitter_amp=0.5,
            )
            # Round head.
            wobbly_dot(draw, (head_cx, head_cy), head_r, head_r * 1.02, SWADDLE, wobble=0.8, steps=28)
            # Soft dark cap of hair on the top of the head.
            sketch_arc(
                draw, (head_cx, head_cy - head_r * 0.15),
                rx=head_r * 0.85, ry=head_r * 0.80,
                start_deg=200, end_deg=340,
                color=FIGURE_LO,
                width=max(3, int(3 * scale)),
                passes=2, steps=18, jitter_amp=0.7,
            )
            # Subtle arm hint — a thin curved stroke wrapping the body on
            # the fire-side, suggesting the mother's arm cradling underneath.
            arm_ang = math.degrees(math.atan2(CY - body_cy, CX - body_cx))
            sketch_arc(
                draw, (body_cx, body_cy + body_ry * 0.25),
                rx=body_rx * 1.05, ry=body_ry * 0.95,
                start_deg=arm_ang - 70, end_deg=arm_ang + 70,
                color=FIGURE_LO,
                width=max(2, int(2 * scale)),
                passes=1, steps=16, jitter_amp=0.6,
            )
        else:
            # Near-side mother — back to the viewer. Baby is in front of
            # her (away from us), so we only see a small edge of swaddle
            # peeking around her arm. Placed on the fire-side to read
            # naturally (warm light catches it).
            side = 1 if (CX - cx) < 0 else -1
            peek_cx = cx + side * back_w_top * 0.72
            peek_cy = equator_y - back_h_top * 0.20
            peek_rx = 9 * scale
            peek_ry = 12 * scale
            wobbly_dot(draw, (peek_cx, peek_cy), peek_rx, peek_ry, SWADDLE, wobble=1.0, steps=24)
            # A subtle secondary edge hint — the mother's hand cupping the
            # baby, same umber as her body so it just crops the swaddle.
            wobbly_dot(
                draw,
                (peek_cx - side * peek_rx * 0.55, peek_cy + peek_ry * 0.15),
                peek_rx * 0.70, peek_ry * 0.55,
                body_color, wobble=0.8, steps=20,
            )


# ---------- main ----------

def main():
    img = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    paint_background(img)
    draw = ImageDraw.Draw(img, "RGBA")

    # Ground circle first (everything else sits on/around it).
    draw_ground_ring(draw)

    # Place 7 figures evenly around the ring. Index 0 = top (far side),
    # counted clockwise. Body center sits ON the ring (radial=1.0) — the
    # hunch overlaps the ring line naturally.
    # Three figures cradle babies (indices 2, 3, 6) — spread around the
    # ring so the maternal read is unmistakable from any angle.
    count = 7
    # Cradles spread across the POV range so the "mamas and babies" read
    # works at every angle:
    #   0 — back-center, facing viewer (full baby visible)
    #   3 — front-left, back to viewer (only a peek of swaddle)
    #   5 — mid-right, 3/4 view (full baby visible)
    cradle_indices = {0, 3, 5}
    figures = []
    for i in range(count):
        t = i / count
        ang = 2 * math.pi * t - math.pi / 2    # start at top
        fx = CX + RING_RX * math.cos(ang)
        fy = CY + RING_RY * math.sin(ang)

        depth = (math.sin(ang) + 1) / 2   # 0 at back (top), 1 at front (bottom)
        scale = 1.12 + 0.70 * depth       # 1.12 .. 1.82 — zoomed-in figures
        figures.append({
            "center": (fx, fy),
            "scale": scale,
            "accent": False,
            "cradle": i in cradle_indices,
            "depth": depth,
        })

    # Back-to-front paint so near figures overlap far ones naturally.
    figures.sort(key=lambda f: f["depth"])

    # Campfire renders between the back half and the front half — lets the
    # nearest figure partially occlude the flame, selling the 3/4 depth.
    midpoint = len(figures) // 2
    for f in figures[:midpoint]:
        draw_person(draw, f["center"], scale=f["scale"], accent=f["accent"],
                    cradle=f["cradle"], depth=f["depth"])

    draw_campfire(draw)

    for f in figures[midpoint:]:
        draw_person(draw, f["center"], scale=f["scale"], accent=f["accent"],
                    cradle=f["cradle"], depth=f["depth"])

    # Flatten to opaque (iOS requirement).
    out = Image.new("RGB", (SIZE, SIZE), CLAY)
    out.paste(img, (0, 0), img)

    assets_dir = Path(__file__).resolve().parent.parent / "apps" / "mobile" / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    out_path = assets_dir / "icon.png"
    out.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path} ({out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
