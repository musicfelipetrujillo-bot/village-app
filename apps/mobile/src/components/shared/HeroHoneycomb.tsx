// HeroHoneycomb — the faded hex lattice that lives INSIDE a gradient hero.
//
// A flat-top comb generated in JS, densest at the top and dissolving downward
// so it reads as brand texture behind the hero's content, not a busy grid.
// Distinct from HoneycombBackdrop (animated, bee-anchored, sits behind a whole
// page): this one is a static, full-bleed wash for a masthead.
//
// Extracted from HomeScreenV3 when the Village tab grew the same masthead
// (2026-09-10) — the defaults reproduce Home's original render exactly.
import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width;

export function HeroHoneycomb({
  height = 520,
  color = '#C24A63',
  /** Cancels the hero's own horizontal padding so the comb bleeds edge to edge. */
  inset = 22,
}: {
  height?: number;
  color?: string;
  inset?: number;
}) {
  const s = 30;
  const h = Math.sqrt(3) * s;
  const dx = 1.5 * s;
  const paths: { d: string; o: number }[] = [];
  for (let c = 0; c * dx <= SCREEN_W + s; c++) {
    const cx = c * dx;
    const yOff = c % 2 ? h / 2 : 0;
    for (let r = -1; r * h + yOff <= height + h; r++) {
      const cy = r * h + yOff;
      const o = 0.17 * (1 - (cy - 10) / (height * 0.82));
      if (o <= 0.015) continue;
      const d =
        `M${(cx + s).toFixed(1)},${cy.toFixed(1)} ` +
        `L${(cx + s / 2).toFixed(1)},${(cy - h / 2).toFixed(1)} ` +
        `L${(cx - s / 2).toFixed(1)},${(cy - h / 2).toFixed(1)} ` +
        `L${(cx - s).toFixed(1)},${cy.toFixed(1)} ` +
        `L${(cx - s / 2).toFixed(1)},${(cy + h / 2).toFixed(1)} ` +
        `L${(cx + s / 2).toFixed(1)},${(cy + h / 2).toFixed(1)} Z`;
      paths.push({ d, o: Math.min(0.22, o) });
    }
  }
  return (
    <Svg
      width={SCREEN_W}
      height={height}
      style={{ position: 'absolute', top: 0, left: -inset }}
      pointerEvents="none"
    >
      {paths.map((p, i) => (
        <Path key={i} d={p.d} stroke={color} strokeOpacity={p.o * 0.6} strokeWidth={1} fill="none" />
      ))}
    </Svg>
  );
}

export default HeroHoneycomb;
