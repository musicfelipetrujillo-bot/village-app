// HoneycombBackdrop — an animated honeycomb texture + one signature bee,
// anchored top-right of a section masthead and dissolving into the page toward
// the lower-left (per-cell opacity fade, NOT an opaque overlay — so it never
// patches over the page wash behind it).
//
// Motion: on mount (i.e. every time you tap a Village tile and arrive at a
// section), the cells "light up" in a staggered cascade spreading out from the
// bee — each one flares brighter as it pops in, then settles. A few accent
// cells keep a slow living-hive glow afterward, and the bee drifts in. The
// whole thing honors prefers-reduced-motion (renders static).
//
// Shared across the four Village section heroes (Milk / Experts / Gear /
// Plans). Each passes its accent color; same comb + bee everywhere = brand
// cohesion, different tint = section identity. Pure SVG + the bee PNG we
// already ship, so it's lightweight and OTA-able (no photos, no native build).
import React from 'react';
import {
  Animated, View, Image, StyleSheet, Easing, Platform, AccessibilityInfo,
  StyleProp, ViewStyle,
} from 'react-native';
import Svg, { Polygon, Path, Circle, Rect } from 'react-native-svg';
import { useIsFocused } from '@react-navigation/native';
import { BeeParcel, CoffeeCup } from './VillieBee';

const BEE = require('../../../assets/brand/villie-bee.png');
const USE_NATIVE = Platform.OS !== 'web'; // web has no native animated module

export type HoneycombIntensity = 'subtle' | 'playful';

// Flat-top hexagon points for a cell drawn inside its own 2r × (√3·r) box,
// centered at (r, √3·r/2). `rr` is the drawn radius (slightly < r → comb gaps).
function hexLocalPoints(r: number, rr: number): string {
  const cx = r;
  const cy = (Math.sqrt(3) / 2) * r;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

interface Cell { cx: number; cy: number; target: number; glow: boolean; order: number; }

export function HoneycombBackdrop({
  accent,
  intensity = 'subtle',
  pageColor = '#FCF7EF',
  showBee = true,
  showComb = false,
  topOffset = 76,
  animate = true,
  scene,
  sceneInsetX = 0,
  style,
}: {
  accent: string;
  intensity?: HoneycombIntensity;
  /** Kept for API symmetry; the comb dissolves via per-cell opacity. */
  pageColor?: string;
  showBee?: boolean;
  /** Draw the honeycomb cells. Default false — bees-only, cleaner UI
   *  (Felipe 2026-07-11: "remove the honeycomb but keep the cute bees"). */
  showComb?: boolean;
  /** Push the comb + bee down so they clear the masthead utility row. */
  topOffset?: number;
  /** Shift the scene bees left from the right edge (clears a top-right menu). */
  sceneInsetX?: number;
  /** Set false to render the resting state with no entry/idle motion. */
  animate?: boolean;
  /** Per-section bee "scene" (the bee doing something). Falls back to the
   *  single corner bee when unset. Village sections: milk / gear / specialists
   *  / plans. Manual chapters: sleep / feed / grow / care / soothe. Village
   *  hub: village (the whole hive gathers). */
  scene?:
    | 'milk' | 'gear' | 'specialists' | 'plans'
    | 'sleep' | 'feed' | 'grow' | 'care' | 'soothe' | 'village';
  style?: StyleProp<ViewStyle>;
}) {
  const playful = intensity === 'playful';
  const r = playful ? 30 : 26;
  const baseOp = playful ? 0.34 : 0.17;
  const strokeW = playful ? 2 : 1.4;
  const cols = playful ? 6 : 4;
  const rows = playful ? 5 : 3;
  const svgW = playful ? 480 : 380;
  const gap = playful ? 2.5 : 3.5;

  const dx = 1.5 * r;
  const dy = Math.sqrt(3) * r;
  const hexW = 2 * r;
  const hexH = Math.sqrt(3) * r;
  const localPts = hexLocalPoints(r, r - gap);

  // Build the cell grid (memoized so the animated-value refs stay aligned).
  const cells = React.useMemo<Cell[]>(() => {
    const raw: Omit<Cell, 'order'>[] = [];
    for (let c = 0; c < cols; c++) {
      for (let row = 0; row < rows; row++) {
        const cx = svgW - r - c * dx;
        const cy = topOffset + r + row * dy + (c % 2 ? dy / 2 : 0);
        const dist = (c / cols) * 0.62 + (row / rows) * 0.72;
        const op = baseOp * (1 - dist);
        if (op < 0.025) continue;
        raw.push({ cx, cy, target: op, glow: playful && (c + row) % 3 === 0 });
      }
    }
    // Cascade order = distance from the bee anchor (top-right) so the light
    // spreads outward from the bee.
    const beeX = svgW - 30;
    const beeY = topOffset + 18;
    raw.sort((a, b) =>
      Math.hypot(a.cx - beeX, a.cy - beeY) - Math.hypot(b.cx - beeX, b.cy - beeY));
    return raw.map((cell, i) => ({ ...cell, order: i }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity, topOffset]);

  // One entry driver per cell + a shared idle-glow loop + a bee driver.
  const entry = React.useRef<Animated.Value[]>([]).current;
  while (entry.length < cells.length) entry.push(new Animated.Value(animate ? 0 : 1));
  const glow = React.useRef(new Animated.Value(0)).current;
  const bee = React.useRef(new Animated.Value(animate ? 0 : 1)).current;

  // Replay the light-up every time the section regains focus (the navigator
  // keeps screens mounted, so a mount-only effect would fire just once). This
  // is what makes the comb light up each time you tap into a Village section.
  const isFocused = useIsFocused();
  React.useEffect(() => {
    let cancelled = false;
    const settle = () => { entry.forEach((v) => v.setValue(1)); bee.setValue(1); };
    if (!animate) { settle(); return; }
    if (!isFocused) return;

    // Reset to the pre-cascade state so re-entry replays the whole effect.
    entry.forEach((v) => v.setValue(0));
    bee.setValue(0);
    glow.setValue(0);

    const run = (reduce: boolean) => {
      if (cancelled) return;
      if (reduce) { settle(); return; }
      // Staggered light-up cascade from the bee outward.
      Animated.stagger(
        playful ? 46 : 54,
        cells.map((_, i) =>
          Animated.timing(entry[i], {
            toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE,
          })),
      ).start();
      // Bee drifts in just behind the first cells.
      Animated.timing(bee, {
        toValue: 1, duration: 520, delay: 260, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE,
      }).start();
      // Living-hive glow on the accent cells, after the cascade.
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1500, delay: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE }),
          Animated.timing(glow, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE }),
        ]),
      ).start();
    };

    const p = AccessibilityInfo.isReduceMotionEnabled?.();
    if (p && typeof p.then === 'function') p.then((r2) => run(!!r2)).catch(() => run(false));
    else run(false);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, cells]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      {showComb && cells.map((cell, i) => {
        const p = entry[i];
        const flare = Math.min(1, cell.target * 1.9);
        // Pop in with a brightness flare that settles to the resting opacity.
        const opacity = p.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, flare, cell.target] });
        const scale = p.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              right: (svgW - cell.cx) - r,
              top: cell.cy - hexH / 2,
              width: hexW, height: hexH,
              opacity, transform: [{ scale }],
            }}
          >
            <Svg width={hexW} height={hexH}>
              <Polygon
                points={localPts}
                fill={cell.glow ? accent : 'none'}
                fillOpacity={cell.glow ? 0.5 : 0}
                stroke={accent}
                strokeOpacity={1}
                strokeWidth={strokeW}
              />
            </Svg>
          </Animated.View>
        );
      })}

      {/* Living-hive glow — a brighter duplicate on the accent cells that
          breathes after the cascade settles. */}
      {showComb && cells.filter((c) => c.glow).map((cell, i) => {
        const gOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(0.55, cell.target * 1.5)] });
        return (
          <Animated.View
            key={`g${i}`}
            style={{
              position: 'absolute',
              right: (svgW - cell.cx) - r,
              top: cell.cy - hexH / 2,
              width: hexW, height: hexH,
              opacity: gOpacity,
            }}
          >
            <Svg width={hexW} height={hexH}>
              <Polygon points={localPts} fill={accent} fillOpacity={0.65} stroke={accent} strokeOpacity={0.9} strokeWidth={strokeW} />
            </Svg>
          </Animated.View>
        );
      })}

      {/* ── Per-section scenes, composed from the real painterly bee PNG ─── */}
      {/* Wrapped so callers can shift the bees left (sceneInsetX) to clear a
          top-right menu without disturbing the comb texture behind them. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: sceneInsetX }}>
      {scene === 'milk' && (
        // Two real bees meet over a honeycomb cell; they fly in from opposite
        // sides and converge, then the milk drop appears between them.
        <>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 6, right: 78, width: 44, height: 44,
              opacity: bee,
              transform: [{ translateX: bee.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false}
              style={{ width: 44, height: 44, transform: [{ rotate: '6deg' }] }} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 6, right: 28, width: 44, height: 44,
              opacity: bee,
              transform: [{ translateX: bee.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false}
              style={{ width: 44, height: 44, transform: [{ scaleX: -1 }, { rotate: '6deg' }] }} />
          </Animated.View>
          <Animated.View
            style={{
              // Centered between the two bees (their centers are at ~100 and
              // ~50 from the right edge → midpoint 75; drop width 16 → right 67).
              position: 'absolute', top: topOffset + 48, right: 67, width: 16, height: 20,
              opacity: bee.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
              transform: [{ scale: bee.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 0.3, 1] }) }],
            }}
          >
            <Svg width={16} height={20} viewBox="0 0 16 20">
              <Path d="M8 1 C12 7 15 11 8 18 C1 11 4 7 8 1 Z" fill="#FFFCF6" stroke={accent} strokeOpacity={0.6} strokeWidth={1} />
            </Svg>
          </Animated.View>
        </>
      )}

      {scene === 'specialists' && (
        // The expert bee — the REAL bee with a teal scrub cap + stethoscope
        // overlaid on top. Drifts in, then a gentle idle bob (glow loop).
        <Animated.View
          style={{
            position: 'absolute', top: topOffset + 6, right: 30, width: 58, height: 58,
            opacity: bee,
            transform: [
              { translateY: Animated.add(
                  bee.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }),
                  glow.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
                ) },
            ],
          }}
        >
          <Image source={BEE} resizeMode="contain" accessible={false} style={{ width: 58, height: 58 }} />
          {/* Stethoscope draped over the body */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 26, left: 15, width: 32, height: 30 }}>
            <Svg width={32} height={30} viewBox="0 0 32 30">
              <Path d="M6 2 C2 12 5 24 15 24" stroke="#46545E" strokeWidth={2.4} fill="none" strokeLinecap="round" />
              <Circle cx="17" cy="24" r="4" fill="#AEB9C1" stroke="#46545E" strokeWidth={1.3} />
            </Svg>
          </View>
          {/* Scrub cap on the crown */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 16, left: 17, width: 26, height: 15 }}>
            <Svg width={26} height={15} viewBox="0 0 26 15">
              <Path d="M2 13 Q13 -1 24 13 Q13 17 2 13 Z" fill="#5FA8A0" />
              <Path d="M2 13 Q13 -1 24 13" stroke="#3C6F6A" strokeWidth={1.2} fill="none" />
              <Path d="M23 12 q4 2 2 6" stroke="#3C6F6A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
            </Svg>
          </View>
        </Animated.View>
      )}

      {scene === 'gear' && (
        // Two real bees hand off a parcel — one offers (left), one receives.
        <>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 8, right: 82, width: 42, height: 42,
              opacity: bee,
              transform: [{ translateX: bee.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false}
              style={{ width: 42, height: 42, transform: [{ rotate: '6deg' }] }} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 8, right: 26, width: 42, height: 42,
              opacity: bee,
              transform: [{ translateX: bee.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false}
              style={{ width: 42, height: 42, transform: [{ scaleX: -1 }, { rotate: '6deg' }] }} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 34, right: 54, width: 22, height: 22,
              opacity: bee.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] }),
              transform: [{ scale: bee.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.4, 0.4, 1] }) }],
            }}
          >
            <BeeParcel size={22} />
          </Animated.View>
        </>
      )}

      {scene === 'plans' && (
        // A little gathering — three real bees circle up around a coffee cup
        // (the thing they have in common: "classes, circles, real coffee").
        <>
          {/* Coffee cup at the center — bees gather around it, facing in */}
          <Animated.View
            style={{
              position: 'absolute', right: 38, top: topOffset + 4, width: 24, height: 24,
              opacity: bee.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
              transform: [{ scale: bee.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.4, 1] }) }],
            }}
          >
            <CoffeeCup size={24} />
          </Animated.View>
          {[
            { right: 70, top: topOffset - 2, size: 30, flip: false }, // left of cup → faces right (in)
            { right: 18, top: topOffset + 0, size: 30, flip: true },  // right of cup → faces left (in)
            { right: 40, top: topOffset + 34, size: 28, flip: false },// below the cup
          ].map((b, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute', right: b.right, top: b.top, width: b.size, height: b.size,
                opacity: bee,
                transform: [{ scale: bee.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              }}
            >
              <Image source={BEE} resizeMode="contain" accessible={false}
                style={{ width: b.size, height: b.size, transform: b.flip ? [{ scaleX: -1 }] : undefined }} />
            </Animated.View>
          ))}
        </>
      )}

      {/* ── Manual chapter scenes — one thematic bee per chapter ───────── */}
      {scene === 'sleep' && (
        // A drowsy bee with a trail of z's drifting up — newborn sleep.
        <>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 10, right: 66, width: 50, height: 50,
              opacity: bee,
              transform: [
                { translateY: bee.interpolate({ inputRange: [0, 1], outputRange: [-9, 0] }) },
                { rotate: '10deg' },
              ],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false} style={{ width: 50, height: 50 }} />
          </Animated.View>
          {[
            { r: 110, t: topOffset + 6, s: 9, d: 0 },
            { r: 100, t: topOffset - 4, s: 12, d: 0.16 },
            { r: 88, t: topOffset - 16, s: 16, d: 0.32 },
          ].map((z, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute', right: z.r, top: z.t, width: z.s, height: z.s,
                opacity: bee.interpolate({ inputRange: [0, 0.5 + z.d, 1], outputRange: [0, 0, 0.9] }),
                transform: [
                  { translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
                  { scale: bee.interpolate({ inputRange: [0, 0.5 + z.d, 1], outputRange: [0.4, 0.4, 1] }) },
                ],
              }}
            >
              <Svg width={z.s} height={z.s} viewBox="0 0 10 10">
                <Path d="M2 2 H8 L2 8 H8" stroke={accent} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          ))}
        </>
      )}

      {scene === 'feed' && (
        // The bee offers a little bottle — feeding.
        <>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 6, right: 22, width: 48, height: 48,
              opacity: bee,
              transform: [{ translateX: bee.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false}
              style={{ width: 48, height: 48, transform: [{ scaleX: -1 }] }} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 22, right: 64, width: 16, height: 28,
              opacity: bee.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
              transform: [
                { rotate: '-16deg' },
                { scale: bee.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.4, 1] }) },
              ],
            }}
          >
            <Svg width={16} height={28} viewBox="0 0 16 28">
              <Rect x="6" y="1" width="4" height="3" rx="1" fill="#E8C4B6" />
              <Rect x="4.5" y="4" width="7" height="2.6" rx="1.3" fill={accent} fillOpacity={0.5} />
              <Rect x="3" y="6.4" width="10" height="19" rx="3.2" fill="#FFFCF6" stroke={accent} strokeWidth={1} />
              <Path d="M5 12 h3 M5 16 h3" stroke={accent} strokeOpacity={0.6} strokeWidth={0.9} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </>
      )}

      {scene === 'grow' && (
        // A baby bee grows in beside the mother bee — growth.
        <>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 2, right: 24, width: 48, height: 48,
              opacity: bee,
              transform: [{ translateY: bee.interpolate({ inputRange: [0, 1], outputRange: [-9, 0] }) }],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false} style={{ width: 48, height: 48 }} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 24, right: 60, width: 26, height: 26,
              opacity: bee.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, 1] }),
              transform: [
                { scale: bee.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.2, 0.2, 1] }) },
                { scaleX: -1 }, // the little one faces its mother
              ],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false} style={{ width: 26, height: 26 }} />
          </Animated.View>
        </>
      )}

      {scene === 'care' && (
        // A heart that beats gently beside the bee — care.
        <>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 6, right: 66, width: 48, height: 48,
              opacity: bee,
              transform: [{ translateY: bee.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false} style={{ width: 48, height: 48 }} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 4, right: 106, width: 20, height: 18,
              opacity: bee.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
              transform: [
                { scale: Animated.add(
                    bee.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.3, 1] }),
                    glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] }),
                  ) },
              ],
            }}
          >
            <Svg width={20} height={18} viewBox="0 0 20 18">
              <Path d="M10 17 C-2 8 3 1 10 6 C17 1 22 8 10 17 Z" fill={accent} fillOpacity={0.6} stroke={accent} strokeWidth={1} />
            </Svg>
          </Animated.View>
        </>
      )}

      {scene === 'soothe' && (
        // Two little notes drift up — humming a baby calm.
        <>
          <Animated.View
            style={{
              position: 'absolute', top: topOffset + 8, right: 66, width: 48, height: 48,
              opacity: bee,
              transform: [
                { translateY: bee.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                { rotate: '-6deg' },
              ],
            }}
          >
            <Image source={BEE} resizeMode="contain" accessible={false} style={{ width: 48, height: 48 }} />
          </Animated.View>
          {[
            { r: 110, t: topOffset + 2, s: 13, d: 0 },
            { r: 96, t: topOffset - 12, s: 16, d: 0.2 },
          ].map((n, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute', right: n.r, top: n.t, width: n.s, height: n.s,
                opacity: bee.interpolate({ inputRange: [0, 0.5 + n.d, 1], outputRange: [0, 0, 0.92] }),
                transform: [
                  { translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
                  { scale: bee.interpolate({ inputRange: [0, 0.5 + n.d, 1], outputRange: [0.4, 0.4, 1] }) },
                ],
              }}
            >
              <Svg width={n.s} height={n.s} viewBox="0 0 12 12">
                <Circle cx="4" cy="9" r="2.4" fill={accent} />
                <Path d="M6.4 9 V2.4 L10 3.6" stroke={accent} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          ))}
        </>
      )}

      {scene === 'village' && (
        // The whole hive gathers — three bees converge (the village).
        <>
          {[
            { right: 64, top: topOffset - 2, size: 34, flip: false, dx: -14, dy: -6 },
            { right: 20, top: topOffset + 2, size: 30, flip: true, dx: 14, dy: -6 },
            { right: 44, top: topOffset + 32, size: 26, flip: false, dx: 0, dy: 12 },
          ].map((b, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute', right: b.right, top: b.top, width: b.size, height: b.size,
                opacity: bee,
                transform: [
                  { translateX: bee.interpolate({ inputRange: [0, 1], outputRange: [b.dx, 0] }) },
                  { translateY: Animated.add(
                      bee.interpolate({ inputRange: [0, 1], outputRange: [b.dy, 0] }),
                      glow.interpolate({ inputRange: [0, 1], outputRange: [0, i % 2 ? -2 : -3.5] }),
                    ) },
                  { scale: bee.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                ],
              }}
            >
              <Image source={BEE} resizeMode="contain" accessible={false}
                style={{ width: b.size, height: b.size, transform: b.flip ? [{ scaleX: -1 }] : undefined }} />
            </Animated.View>
          ))}
        </>
      )}

      {!scene && showBee && (
        <Animated.Image
          source={BEE}
          resizeMode="contain"
          accessible={false}
          style={{
            position: 'absolute',
            top: topOffset + (playful ? 18 : 16),
            right: playful ? 26 : 24,
            width: playful ? 44 : 30,
            height: playful ? 44 : 30,
            opacity: bee,
            transform: [
              { translateY: bee.interpolate({ inputRange: [0, 1], outputRange: [-9, 0] }) },
              { rotate: playful ? '-18deg' : '-12deg' },
            ],
          }}
        />
      )}
      </View>
    </View>
  );
}
