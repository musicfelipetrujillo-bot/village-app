// Manual tile artwork — full-band SVG illustrations per category.
//
// Each tile renders a single <Svg> with the following layers:
//   1. Page-aligned tan-blush gradient
//   2. Light wash (soft cream highlight in top-left)
//   3. Pink corner blush (top-right)
//   4. Risograph halftone pattern, masked away in a soft radial around
//      the icon so the texture only lives in the corners — Option B.
//   5. The icon itself, painted opaquely so the texture never bleeds onto it.
//
// Each scene was designed in a parallel HTML/canvas mockup, then translated
// to react-native-svg here. All icons use the live brand palette.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Pattern,
  Mask,
  Stop,
  Rect,
  Circle,
  Ellipse,
  Path,
  G,
  Line,
  Text as SvgText,
  Polygon,
  Image as SvgImage,
} from 'react-native-svg';

// Brand mascot — used as the hero of every Manual tile.
const VILLIE = require('../../../assets/brand/villie-bee.png');

/* ===========================================================
   PALETTE — live app brand colors
   =========================================================== */
const C = {
  paper:     '#FFFCF6',
  cream:     '#F5F0E8',
  // Kit canon (2026-05-16): cinnamon family replaces old rust in SVG tile art.
  // Token names kept for grep compatibility across 50+ Path/Circle fills below.
  rust:      '#D96C88', // cinnamon (was #D96C88)
  rustDeep:  '#D96C88', // action-deep (was #7A4A24)
  coco:      '#AD795B',
  cocoDeep:  '#E98A6A',
  cocoLight: '#C9A07E',
  bark:      '#43260F',
  barkSoft:  '#7A4A24',
  sage:      '#E98A6A',
  sageDeep:  '#E98A6A',
  sageLight: '#F2E6DD',
  pink:      '#E8C4B6',
  pinkSoft:  '#F5D9CC',
  pinkDeep:  '#E98A6A',
  sandSoft:  '#E8DFC9',
  sandDeep:  '#F2E6DD',
  flame:     '#F4C53C',
  flameDeep: '#E98A6A',
};

export type ManualTileScene =
  | 'candle'   // Mom: Feel
  | 'salve'    // Mom: Heal
  | 'bowl'     // Mom: Nourish
  | 'pillow'   // Mom: Rest, Baby: Sleep
  | 'note'     // Mom: Tips, Baby: Tips
  | 'bottle'   // Baby: Feed
  | 'foot'     // Baby: Grow
  | 'bib';     // Baby: Care

// Map between Manual category keys and the right scene. Centralised so the
// screen never has to know which key maps to which illustration.
export const SCENE_BY_CATEGORY: Record<string, ManualTileScene> = {
  // Mom
  feel:    'candle',
  heal:    'salve',
  nourish: 'bowl',
  rest:    'pillow',
  // Baby
  feed:    'bottle',
  sleep:   'pillow',
  grow:    'foot',
  care:    'bib',
  // Shared
  tips:    'note',
};

const VB_W = 200;
const VB_H = 100;

/* ===========================================================
   PER-SCENE HERO BACKGROUND (flat brand-aligned solid).
   Each tile gets a single warm color so the icon pops against
   the cream page background (#F5F0E8) without any gradient.
   =========================================================== */
const SCENE_BG: Record<ManualTileScene, string> = {
  candle: '#F7C5CB', // Feel — warm flame peach (saturated)
  salve:  '#E98A6A', // Heal — rose blush
  bowl:   '#F4C53C', // Nourish — sage
  pillow: '#F2E6DD', // Rest — sand
  note:   '#C25A78', // Tips — paper sand
  bottle: '#F4C53C', // Feed — cream blush
  foot:   '#F7C5CB', // Grow — pink
  bib:    '#E98A6A', // Care — sage
};

/* ===========================================================
   DEFS — shared gradients / patterns / mask used by every tile
   =========================================================== */
function SharedDefs({ maskCx, maskCy, maskInnerPct, maskOuterPct }: {
  maskCx: number; maskCy: number; maskInnerPct: number; maskOuterPct: number;
}) {
  // The mask's inner radius is 100% opaque (texture fully erased), then
  // fades to transparent at the outer radius (texture reappears at corners).
  return (
    <Defs>
      <RadialGradient id="bottomShadow" cx={VB_W * 0.85} cy={VB_H * 0.88} r={VB_W * 0.75} gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#43260F" stopOpacity={0.12} />
        <Stop offset="0.55" stopColor="#43260F" stopOpacity={0} />
      </RadialGradient>
      <Pattern id="halftoneDots" x="0" y="0" width={5} height={5} patternUnits="userSpaceOnUse">
        <Circle cx={2.5} cy={2.5} r={0.85} fill="#43260F" fillOpacity={0.42} />
        <Circle cx={3.9} cy={3.9} r={0.72} fill="#D96C88" fillOpacity={0.38} />
      </Pattern>
      {/* Mask: white = halftone visible, black = erased.
          Inner zone (around the icon) is fully erased; transitions to visible at the corners. */}
      <RadialGradient
        id="maskFade"
        cx={maskCx}
        cy={maskCy}
        r={maskOuterPct}
        fx={maskCx}
        fy={maskCy}
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset="0" stopColor="#000000" stopOpacity={1} />
        <Stop offset={maskInnerPct / maskOuterPct} stopColor="#000000" stopOpacity={1} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={1} />
      </RadialGradient>
      <Mask id="halftoneMask" maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
        <Rect width={VB_W} height={VB_H} fill="#FFFFFF" />
        <Rect width={VB_W} height={VB_H} fill="url(#maskFade)" />
      </Mask>
    </Defs>
  );
}

function BgLayers({ scene }: { scene: ManualTileScene }) {
  return (
    <G>
      <Rect width={VB_W} height={VB_H} fill={SCENE_BG[scene]} />
      <Rect width={VB_W} height={VB_H} fill="url(#halftoneDots)" />
      <Rect width={VB_W} height={VB_H} fill="url(#bottomShadow)" />
    </G>
  );
}

/* ===========================================================
   SHADOW HELPER — a soft elliptical drop shadow under each icon
   =========================================================== */
function GroundShadow({ cx, cy, rx = 24, ry = 4, opacity = 0.20 }: {
  cx: number; cy: number; rx?: number; ry?: number; opacity?: number;
}) {
  return (
    <Ellipse cx={cx + 2} cy={cy + 6} rx={rx} ry={ry} fill={C.bark} opacity={opacity} />
  );
}

/* ===========================================================
   BEE PRIMITIVE — Villie (PNG asset), sized + rotated per scene
   We use the actual brand mascot rather than a hand-drawn bee so
   the icon matches every other surface in the app exactly.
   `scale` is kept for backward-compat — converts to a target size
   in viewBox units. The Villie PNG is ~square; size sets the side.
   =========================================================== */
function Bee({ cx, cy, scale = 1, rotation = 0 }: {
  cx: number; cy: number; scale?: number; rotation?: number;
  // `sleeping` was a hand-drawn variant; PNG ignores it.
  sleeping?: boolean;
}) {
  // baseline visual width when scale=1 was ~30 viewBox units.
  const size = 36 * scale;
  return (
    <G transform={`rotate(${rotation} ${cx} ${cy})`}>
      <SvgImage
        href={VILLIE}
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
      />
    </G>
  );
}

/* ===========================================================
   SCENE · CANDLE  (Mom: Feel)
   =========================================================== */
function SceneCandle() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58; // sits at the global scale anchor → no scale distortion
  // Sparkle halo — alternating brand colors around the bee. Tighter radius
  // so every sparkle lives inside the band after the 1.55× global scale.
  const halo = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const rx = 22;
    const ry = 16; // flatter ellipse → keeps top/bottom stars in the band
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    const colors = [C.rust, C.flameDeep, C.coco];
    const sizes = [1.2, 1.0, 0.8];
    return { x, y, c: colors[i % 3], r: sizes[i % 3] };
  });
  return (
    <G>
      <GroundShadow cx={cx} cy={cy + 20} rx={16} ry={3} opacity={0.18} />
      {halo.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={0.9} />
      ))}
      {/* a couple of cream star-points tucked just inside the ring */}
      <Path d={`M ${cx - 14} ${cy - 11} l 0.8 2.4 l 2.4 0.8 l -2.4 0.8 l -0.8 2.4 l -0.8 -2.4 l -2.4 -0.8 l 2.4 -0.8 z`} fill={C.paper} opacity={0.9} />
      <Path d={`M ${cx + 15} ${cy - 6}  l 0.7 2 l 2 0.7 l -2 0.7 l -0.7 2 l -0.7 -2 l -2 -0.7 l 2 -0.7 z`} fill={C.paper} opacity={0.85} />
      <Bee cx={cx} cy={cy} scale={1.45} rotation={-8} />
    </G>
  );
}

/* ===========================================================
   SCENE · SALVE JAR  (Mom: Heal)
   =========================================================== */
function SceneSalve() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58;
  return (
    <G>
      <GroundShadow cx={cx} cy={cy + 18} rx={18} ry={3} />
      {/* sage leaf canopy — pulled down so its top stays inside the band */}
      <G transform={`translate(${cx} ${cy - 22}) rotate(-12)`}>
        <Path d="M -22 0 C -18 -8, 18 -8, 22 0 C 18 4, -18 4, -22 0 Z" fill={C.sage} />
        <Path d="M -22 0 C -8 -2, 8 -2, 22 0" stroke={C.sageDeep} strokeWidth={0.7} fill="none" />
        <Path d="M -14 -1 Q -12 1, -10 3" stroke={C.sageDeep} strokeWidth={0.4} fill="none" opacity={0.6} />
        <Path d="M 0 -2 Q 0 1, 0 3" stroke={C.sageDeep} strokeWidth={0.4} fill="none" opacity={0.6} />
        <Path d="M 14 -1 Q 12 1, 10 3" stroke={C.sageDeep} strokeWidth={0.4} fill="none" opacity={0.6} />
      </G>
      {/* leaf stem */}
      <Path d={`M ${cx + 3} ${cy - 18} Q ${cx + 1} ${cy - 10}, ${cx} ${cy - 4}`} stroke={C.sageDeep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {/* bee at the anchor */}
      <Bee cx={cx} cy={cy} scale={1.35} rotation={4} />
      {/* bandage on top of bee body */}
      <G transform={`translate(${cx - 1} ${cy - 6}) rotate(18)`}>
        <Rect x={-6} y={-2.2} width={12} height={4.5} rx={1.2} fill={C.pinkSoft} stroke={C.bark} strokeWidth={0.6} />
        <Rect x={-2.5} y={-2.2} width={5} height={4.5} fill={C.pink} />
        <Circle cx={-3.5} cy={-1} r={0.45} fill={C.bark} />
        <Circle cx={-3.5} cy={1} r={0.45} fill={C.bark} />
        <Circle cx={3.5} cy={-1} r={0.45} fill={C.bark} />
        <Circle cx={3.5} cy={1} r={0.45} fill={C.bark} />
      </G>
      {/* small sage leaves around bee feet */}
      <Ellipse cx={cx - 22} cy={cy + 10} rx={3.5} ry={1.6} fill={C.sageDeep} transform={`rotate(-30 ${cx - 22} ${cy + 10})`} />
      <Ellipse cx={cx + 22} cy={cy + 12} rx={3} ry={1.5} fill={C.sage} transform={`rotate(35 ${cx + 22} ${cy + 12})`} />
      <Circle cx={cx - 24} cy={cy - 10} r={1} fill={C.rust} opacity={0.8} />
    </G>
  );
}

/* ===========================================================
   SCENE · BOWL  (Mom: Nourish)
   =========================================================== */
function SceneBowl() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58;
  // Composition centroid: bee on left (anchor), honey pot to the right.
  // Honey pot top sits at cy-2, bottom at cy+14 — fully inside the band.
  return (
    <G>
      <GroundShadow cx={cx + 16} cy={cy + 16} rx={20} ry={3} />
      {/* honey pot, shifted right so the bee sits at the anchor */}
      <G transform={`translate(${cx + 18} 0)`}>
        <Path d={`M ${- 14} ${cy + 0} C ${- 17} ${cy + 14}, ${+ 17} ${cy + 14}, ${+ 14} ${cy + 0} Z`} fill={C.rust} />
        <Path d={`M ${- 12} ${cy + 2} C ${- 14} ${cy + 10}, ${- 11} ${cy + 13}, ${- 8} ${cy + 13}`} stroke={C.flame} strokeWidth={1.1} fill="none" opacity={0.5} />
        <Ellipse cx={0} cy={cy + 0} rx={15} ry={3.2} fill={C.flameDeep} />
        <Ellipse cx={0} cy={cy - 1} rx={13} ry={2} fill={C.flame} />
        <Ellipse cx={0} cy={cy + 0} rx={11} ry={1.6} fill={C.rustDeep} opacity={0.7} />
        <Rect x={-9} y={cy + 5} width={18} height={5} rx={1} fill={C.paper} />
        <SvgText x={0} y={cy + 8.8} textAnchor="middle" fontFamily="Caveat_600SemiBold" fontWeight="600" fontSize={4.4} fill={C.rust}>honey</SvgText>
      </G>
      {/* viscous honey drip from bee mouth to pot rim */}
      <Path d={`M ${cx + 8} ${cy - 1} Q ${cx + 14} ${cy + 2}, ${cx + 18} ${cy - 1}`} stroke={C.flameDeep} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {/* bee at the anchor */}
      <Bee cx={cx - 6} cy={cy} scale={1.3} rotation={-6} />
      {/* sparkles — kept inside the band */}
      <Circle cx={cx - 28} cy={cy - 14} r={1.1} fill={C.rust} opacity={0.85} />
      <Circle cx={cx + 32} cy={cy - 12} r={0.9} fill={C.coco} opacity={0.75} />
    </G>
  );
}

/* ===========================================================
   SCENE · PILLOW + ZZZ  (Mom: Rest, Baby: Sleep)
   =========================================================== */
function ScenePillow() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58;
  // Hammock vertical extent: cy-18 (rope tops) to cy+14 (fringe bottom).
  return (
    <G>
      <GroundShadow cx={cx} cy={cy + 18} rx={28} ry={3} />
      {/* arching stems acting as hammock anchors */}
      <Path d={`M ${cx - 34} ${cy - 18} C ${cx - 36} ${cy - 4}, ${cx - 34} ${cy + 10}, ${cx - 28} ${cy + 16}`} stroke={C.sageDeep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d={`M ${cx + 34} ${cy - 18} C ${cx + 36} ${cy - 4}, ${cx + 34} ${cy + 10}, ${cx + 28} ${cy + 16}`} stroke={C.sageDeep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {/* tiny leaves at stem tops */}
      <Ellipse cx={cx - 34} cy={cy - 18} rx={3.5} ry={1.8} fill={C.sage} transform={`rotate(-35 ${cx - 34} ${cy - 18})`} />
      <Ellipse cx={cx + 34} cy={cy - 18} rx={3.5} ry={1.8} fill={C.sage} transform={`rotate(35 ${cx + 34} ${cy - 18})`} />
      {/* hammock ropes */}
      <Path d={`M ${cx - 34} ${cy - 4} L ${cx - 26} ${cy - 2}`} stroke={C.coco} strokeWidth={0.8} />
      <Path d={`M ${cx + 34} ${cy - 4} L ${cx + 26} ${cy - 2}`} stroke={C.coco} strokeWidth={0.8} />
      {/* hammock cradle */}
      <Path d={`M ${cx - 28} ${cy - 2} C ${cx - 23} ${cy + 12}, ${cx + 23} ${cy + 12}, ${cx + 28} ${cy - 2} L ${cx + 26} ${cy - 4} C ${cx + 20} ${cy + 4}, ${cx - 20} ${cy + 4}, ${cx - 26} ${cy - 4} Z`} fill={C.pinkSoft} stroke={C.bark} strokeWidth={0.7} strokeLinejoin="round" />
      <Path d={`M ${cx - 24} ${cy + 2} C ${cx - 18} ${cy + 6}, ${cx + 18} ${cy + 6}, ${cx + 24} ${cy + 2}`} stroke={C.pink} strokeWidth={1.8} fill="none" opacity={0.85} />
      {/* fringe */}
      {[-20, -12, -4, 4, 12, 20].map(dx => (
        <Line key={dx} x1={cx + dx} y1={cy + 9} x2={cx + dx} y2={cy + 12} stroke={C.coco} strokeWidth={0.7} strokeLinecap="round" />
      ))}
      {/* tiny pillow under bee */}
      <Ellipse cx={cx - 1} cy={cy + 1} rx={9} ry={2.6} fill={C.paper} stroke={C.bark} strokeWidth={0.5} />
      {/* bee asleep at the anchor */}
      <Bee cx={cx + 2} cy={cy - 4} scale={1.0} rotation={12} sleeping={true} />
      {/* zzz — top z stays inside band */}
      <SvgText x={cx + 14} y={cy - 10} fontFamily="Caveat_600SemiBold" fontWeight="700" fontSize={8} fill={C.bark} fillOpacity={0.7}>z</SvgText>
      <SvgText x={cx + 18} y={cy - 16} fontFamily="Caveat_600SemiBold" fontWeight="700" fontSize={11} fill={C.bark} fillOpacity={0.85}>z</SvgText>
      <SvgText x={cx + 24} y={cy - 22} fontFamily="Caveat_600SemiBold" fontWeight="700" fontSize={14} fill={C.rust} fillOpacity={0.95}>z</SvgText>
      {/* tiny moon on left */}
      <Path d={`M ${cx - 26} ${cy - 18} A 4 4 0 1 0 ${cx - 20} ${cy - 18} A 3.2 3.2 0 1 1 ${cx - 26} ${cy - 18} Z`} fill={C.coco} opacity={0.8} />
    </G>
  );
}

/* ===========================================================
   SCENE · NOTE  (Mom: Tips, Baby: Tips)
   =========================================================== */
function SceneNote() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58;
  return (
    <G>
      <GroundShadow cx={cx + 4} cy={cy + 22} rx={26} ry={3} />
      {/* paper note tilted — vertical extent kept inside [cy-22, cy+22] */}
      <G transform={`translate(${cx - 2} ${cy + 2}) rotate(-5)`}>
        <Path d="M -26 -22 L 14 -22 L 26 -12 L 26 20 L -26 20 Z" fill={C.paper} stroke={C.bark} strokeWidth={0.7} />
        <Path d="M 14 -22 L 26 -12 L 14 -12 Z" fill={C.sandSoft} stroke={C.bark} strokeWidth={0.5} />
        {/* washi tape */}
        <Rect x={-28} y={-26} width={18} height={5.5} rx={1} fill={C.sage} opacity={0.85} transform="rotate(-22 -19 -23)" />
        {[-10, -3, 4, 11].map((y, i) => (
          <Path key={i} d={`M -20 ${y} Q -10 ${y - 1.5}, 0 ${y} T 20 ${y}`} stroke={C.bark} strokeWidth={0.8} strokeOpacity={0.5} fill="none" strokeLinecap="round" />
        ))}
      </G>
      {/* bee perched on the top-right corner of the note */}
      <Bee cx={cx + 14} cy={cy - 18} scale={0.85} rotation={-22} />
      {/* shorter quill kept inside the band */}
      <G transform={`translate(${cx + 22} ${cy - 20}) rotate(35)`}>
        <Path d="M 0 0 L 10 -12" stroke={C.bark} strokeWidth={1} strokeLinecap="round" />
        <Path d="M 10 -12 C 13 -15, 15 -15, 16 -12 C 13 -10, 10 -7, 8 -5 C 7 -8, 9 -11, 10 -12 Z" fill={C.rust} stroke={C.bark} strokeWidth={0.5} />
      </G>
      {/* ink dot just under the nib */}
      <Circle cx={cx + 13} cy={cy - 14} r={0.9} fill={C.rust} />
      {/* sparkles, both inside band */}
      <Circle cx={cx - 26} cy={cy - 14} r={1} fill={C.rust} opacity={0.85} />
      <Path d={`M ${cx + 26} ${cy + 10} l 0.6 1.6 l 1.6 0.6 l -1.6 0.6 l -0.6 1.6 l -0.6 -1.6 l -1.6 -0.6 l 1.6 -0.6 z`} fill={C.coco} opacity={0.75} />
    </G>
  );
}

/* ===========================================================
   SCENE · BOTTLE  (Baby: Feed)
   =========================================================== */
function SceneBottle() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58;
  // Bee flies in from left; tiny honey dropper dangles beneath. Whole comp
  // sits inside [cy-18, cy+22].
  return (
    <G>
      <GroundShadow cx={cx} cy={cy + 20} rx={18} ry={3} />
      {/* motion trail behind bee — short dotted arc */}
      {[0, 1, 2, 3].map(i => (
        <Circle key={i} cx={cx - 22 - i * 4} cy={cy - 4 - i * 1.2} r={1 + i * 0.2} fill={C.coco} opacity={0.55 - i * 0.1} />
      ))}
      {/* bee at the anchor */}
      <Bee cx={cx + 2} cy={cy - 4} scale={1.3} rotation={-12} />
      {/* string from bee belly */}
      <Path d={`M ${cx - 5} ${cy + 5} Q ${cx - 6} ${cy + 9}, ${cx - 6} ${cy + 12}`} stroke={C.bark} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      {/* honey dropper hanging — compact so the tip stays in band */}
      <G transform={`translate(${cx - 6} ${cy + 16}) rotate(10)`}>
        <Ellipse cx={0} cy={-2} rx={3.5} ry={3.5} fill={C.rust} stroke={C.bark} strokeWidth={0.6} />
        <Ellipse cx={-1} cy={-3} rx={1.2} ry={0.8} fill={C.paper} opacity={0.6} />
        <Rect x={-1.5} y={1.5} width={3} height={6} fill={C.paper} stroke={C.bark} strokeWidth={0.5} />
        <Rect x={-1.2} y={4} width={2.4} height={3.5} fill={C.flameDeep} />
        <Path d={`M 0 7.5 C 1.2 8.6, 1.2 10, 0 10 C -1.2 10, -1.2 8.6, 0 7.5 Z`} fill={C.flameDeep} />
      </G>
    </G>
  );
}

/* ===========================================================
   SCENE · FOOT  (Baby: Grow) — soft pink baby foot
   =========================================================== */
function SceneFoot() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58;
  // Tulip cup hugs the bee. Stem + leaves stay inside [cy+0, cy+18].
  return (
    <G>
      <GroundShadow cx={cx} cy={cy + 18} rx={18} ry={3} />
      {/* short stem */}
      <Path d={`M ${cx} ${cy + 18} Q ${cx + 2} ${cy + 8}, ${cx} ${cy + 2}`} stroke={C.sageDeep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {/* leaves */}
      <Path d={`M ${cx} ${cy + 9} C ${cx - 9} ${cy + 6}, ${cx - 12} ${cy + 13}, ${cx - 3} ${cy + 14} Z`} fill={C.sage} />
      <Path d={`M ${cx} ${cy + 14} C ${cx + 9} ${cy + 11}, ${cx + 12} ${cy + 17}, ${cx + 3} ${cy + 17} Z`} fill={C.sageDeep} />
      {/* tulip cup hugging the anchor */}
      <Path d={`M ${cx - 14} ${cy + 2} C ${cx - 16} ${cy + 12}, ${cx + 16} ${cy + 12}, ${cx + 14} ${cy + 2} C ${cx + 8} ${cy}, ${cx - 8} ${cy}, ${cx - 14} ${cy + 2} Z`} fill={C.rust} />
      <Path d={`M ${cx - 8} ${cy + 1} C ${cx - 5} ${cy + 6}, ${cx + 5} ${cy + 6}, ${cx + 8} ${cy + 1}`} stroke={C.rustDeep} strokeWidth={0.7} fill="none" />
      <Path d={`M ${cx} ${cy + 0} L ${cx} ${cy + 6}`} stroke={C.rustDeep} strokeWidth={0.5} opacity={0.6} />
      {/* baby Villie at the anchor */}
      <Bee cx={cx} cy={cy - 6} scale={1.05} rotation={-8} />
      {/* sparkles inside the band */}
      <Circle cx={cx - 24} cy={cy - 10} r={1} fill={C.rust} opacity={0.85} />
      <Circle cx={cx + 24} cy={cy - 8} r={0.85} fill={C.coco} opacity={0.75} />
      <Path d={`M ${cx - 12} ${cy - 18} l 0.6 1.7 l 1.7 0.6 l -1.7 0.6 l -0.6 1.7 l -0.6 -1.7 l -1.7 -0.6 l 1.7 -0.6 z`} fill={C.flameDeep} opacity={0.9} />
    </G>
  );
}

/* ===========================================================
   SCENE · BIB  (Baby: Care)
   =========================================================== */
function SceneBib() {
  const cx = VB_W * 0.5;
  const cy = VB_H * 0.58;
  return (
    <G>
      <GroundShadow cx={cx} cy={cy + 22} rx={36} ry={4} />
      {/* big Villie on the left */}
      <Bee cx={cx - 16} cy={cy} scale={1.5} rotation={-6} />
      {/* small Villie on the right */}
      <Bee cx={cx + 20} cy={cy + 4} scale={0.95} rotation={8} />
      {/* heart floating between them */}
      <Path
        d={`M ${cx + 4} ${cy - 18} C ${cx + 4} ${cy - 22}, ${cx} ${cy - 24}, ${cx - 2} ${cy - 20} C ${cx - 4} ${cy - 24}, ${cx - 8} ${cy - 22}, ${cx - 8} ${cy - 18} C ${cx - 8} ${cy - 14}, ${cx - 2} ${cy - 10}, ${cx - 2} ${cy - 10} C ${cx - 2} ${cy - 10}, ${cx + 4} ${cy - 14}, ${cx + 4} ${cy - 18} Z`}
        fill={C.rust}
      />
      {/* tiny heart sparkles */}
      <Circle cx={cx + 32} cy={cy - 22} r={0.9} fill={C.coco} opacity={0.75} />
      <Circle cx={cx - 34} cy={cy - 14} r={1.1} fill={C.rust} opacity={0.85} />
      <Path d={`M ${cx + 26} ${cy + 22} l 0.6 1.6 l 1.6 0.6 l -1.6 0.6 l -0.6 1.6 l -0.6 -1.6 l -1.6 -0.6 l 1.6 -0.6 z`} fill={C.sageDeep} opacity={0.7} />
    </G>
  );
}

/* ===========================================================
   PER-SCENE MASK CENTERS (proportions of viewBox, 0..1)
   Each scene has its own "icon footprint" — the mask erases
   halftone inside this footprint so the icon stays clean.
   =========================================================== */
const MASK_INFO: Record<ManualTileScene, { cyPct: number; innerPct: number; outerPct: number }> = {
  candle: { cyPct: 0.45, innerPct: 0.18, outerPct: 0.40 },
  salve:  { cyPct: 0.60, innerPct: 0.20, outerPct: 0.40 },
  bowl:   { cyPct: 0.60, innerPct: 0.20, outerPct: 0.40 },
  pillow: { cyPct: 0.55, innerPct: 0.22, outerPct: 0.42 },
  note:   { cyPct: 0.55, innerPct: 0.18, outerPct: 0.38 },
  bottle: { cyPct: 0.55, innerPct: 0.18, outerPct: 0.38 },
  foot:   { cyPct: 0.55, innerPct: 0.20, outerPct: 0.42 },
  bib:    { cyPct: 0.60, innerPct: 0.20, outerPct: 0.42 },
};

/* ===========================================================
   SCENE ROUTER + PUBLIC COMPONENT
   =========================================================== */
function SceneRenderer({ scene }: { scene: ManualTileScene }) {
  switch (scene) {
    case 'candle': return <SceneCandle />;
    case 'salve':  return <SceneSalve />;
    case 'bowl':   return <SceneBowl />;
    case 'pillow': return <ScenePillow />;
    case 'note':   return <SceneNote />;
    case 'bottle': return <SceneBottle />;
    case 'foot':   return <SceneFoot />;
    case 'bib':    return <SceneBib />;
  }
}

export interface ManualTileArtProps {
  scene: ManualTileScene;
}

/**
 * Full-band SVG illustration for a Manual category tile.
 * Renders the page-aligned warm gradient bg, a masked riso halftone
 * pattern at the edges, and the per-category icon at center.
 *
 * The component sizes itself to fill its parent View (use a View
 * with the desired width/height — e.g. the existing `tileArt`
 * style with width: '100%', height: 80).
 */
export function ManualTileArt({ scene }: ManualTileArtProps) {
  const mask = MASK_INFO[scene];
  return (
    <View style={styles.fill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <SharedDefs
          maskCx={VB_W * 0.5}
          maskCy={VB_H * mask.cyPct}
          maskInnerPct={VB_W * mask.innerPct}
          maskOuterPct={VB_W * mask.outerPct}
        />
        <BgLayers scene={scene} />
        {/* Scale all icons up so they read as the hero of the tile.
            1.35× anchored at (100, 58) maps pre-scale y∈[15,89] → post[0,100].
            Every scene MUST keep visible elements inside that band. */}
        <G transform={`translate(${VB_W / 2} ${VB_H * 0.58}) scale(1.35) translate(${-VB_W / 2} ${-VB_H * 0.58})`}>
          <SceneRenderer scene={scene} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
});
