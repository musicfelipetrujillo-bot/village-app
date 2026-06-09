// Warm-glow backdrop — gradient + bee marks scattered across the page.
//
// Per Felipe's 2026-05-24 call: bees are PURE STATIC ATMOSPHERE — no
// fly-in animation on focus, no parallax drift on scroll. Atmosphere
// should feel like it's *always there*, not something that animates.
// Motion was making the eye track them as UI; static reads as
// background.
//
// The `scrollY` and `triggerAnim` props are kept on the signature
// (no-ops now) so the 7 screens that already pass them don't error.
// Future re-enabling of motion would only need to flip the static
// flag below.
import React from 'react';
import { View, Image, StyleSheet, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { COLORS } from '@utils/constants';

const BEE = require('../../../assets/brand/villie-bee.png');

// Each bee's static layout + target opacity.
//
// 18 bees distributed across the page in 5 vertical bands (top / upper-mid /
// mid / lower-mid / bottom), each band with a left + center + right anchor.
// Goal: feel like a swarm that's *throughout the page*, not just clustered
// at the top edges. Background-quiet (opacity 9-22%) but visually busy —
// the "background but crowdy" balance Felipe asked for.
const BEES: {
  top?: number; bottom?: number;
  left?: number; right?: number;
  width: number; height: number;
  opacity: number;
  rotate: string;
}[] = [
  // ── Band 1 · Top (0-220) ── header + masthead area
  { top: 90,  right: 50,  width: 24, height: 22, opacity: 0.22, rotate: '-16deg' },
  { top: 150, left: 130,  width: 18, height: 16, opacity: 0.16, rotate: '10deg'  },  // center
  { top: 210, right: 30,  width: 22, height: 20, opacity: 0.20, rotate: '20deg'  },
  // ── Band 2 · Upper-mid (220-440) ── greeting / first card
  { top: 260, left: 18,   width: 28, height: 25, opacity: 0.22, rotate: '-10deg' },
  { top: 330, left: 165,  width: 16, height: 14, opacity: 0.14, rotate: '8deg'   },  // center
  { top: 370, right: 60,  width: 20, height: 18, opacity: 0.16, rotate: '-22deg' },
  { top: 420, left: 80,   width: 24, height: 22, opacity: 0.13, rotate: '14deg'  },
  // ── Band 3 · Mid (450-680) ── primary content
  { top: 480, left: 25,   width: 18, height: 16, opacity: 0.16, rotate: '-8deg'  },
  { top: 530, right: 40,  width: 26, height: 23, opacity: 0.20, rotate: '18deg'  },
  { top: 580, left: 140,  width: 14, height: 13, opacity: 0.12, rotate: '-20deg' },  // center
  { top: 640, right: 80,  width: 22, height: 20, opacity: 0.14, rotate: '4deg'   },
  // ── Band 4 · Lower-mid (680-900) ── secondary content
  { top: 700, left: 50,   width: 28, height: 25, opacity: 0.16, rotate: '-18deg' },
  { top: 760, right: 22,  width: 18, height: 16, opacity: 0.15, rotate: '30deg'  },
  { top: 830, left: 110,  width: 22, height: 20, opacity: 0.13, rotate: '-14deg' },  // center
  { top: 870, right: 130, width: 16, height: 14, opacity: 0.11, rotate: '8deg'   },  // center-right
  // ── Band 5 · Bottom (900+) ── footer/long-scroll territory
  { top: 940,  left: 30,  width: 20, height: 18, opacity: 0.13, rotate: '24deg'  },
  { top: 1010, right: 60, width: 24, height: 22, opacity: 0.11, rotate: '-12deg' },
  { bottom: 62, right: 48, width: 18, height: 16, opacity: 0.09, rotate: '8deg'  },
];

// Honeycomb echoes — faint hexagon outlines scattered through the SAME
// atmosphere as the bees (Felipe: "add the honeycombs in the background,
// same feeling as the bees"). Single flat-top cells, honey-tinted, even
// quieter than the bees (7-13%) so they read as background texture that
// echoes the masthead comb without competing with content. Interleaved
// into the gaps between the bee anchors across the 5 bands.
const HONEY = '#E0A23E';
function hexPts(size: number): string {
  const r = size / 2;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i); // flat-top hexagon, matches the masthead comb
    pts.push(`${(r + r * Math.cos(a)).toFixed(1)},${(r + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
const COMBS: {
  top?: number; bottom?: number; left?: number; right?: number;
  size: number; opacity: number; rotate: string;
}[] = [
  { top: 124, left: 44,   size: 30, opacity: 0.13, rotate: '6deg'   },
  { top: 196, right: 96,  size: 22, opacity: 0.10, rotate: '-10deg' },
  { top: 300, right: 28,  size: 34, opacity: 0.12, rotate: '12deg'  },
  { top: 360, left: 150,  size: 18, opacity: 0.08, rotate: '-4deg'  },
  { top: 452, left: 30,   size: 26, opacity: 0.11, rotate: '-8deg'  },
  { top: 540, right: 54,  size: 30, opacity: 0.11, rotate: '14deg'  },
  { top: 624, left: 120,  size: 20, opacity: 0.08, rotate: '-16deg' },
  { top: 720, right: 100, size: 24, opacity: 0.10, rotate: '4deg'   },
  { top: 800, left: 38,   size: 32, opacity: 0.11, rotate: '16deg'  },
  { top: 900, right: 44,  size: 24, opacity: 0.09, rotate: '-8deg'  },
  { top: 992, left: 96,   size: 20, opacity: 0.08, rotate: '10deg'  },
];

type Props = {
  style?: ViewStyle | ViewStyle[];
  hideClusters?: boolean;
  /** No-op (kept for API compat — bees are static now, see header). */
  scrollY?: Animated.Value;
  /** No-op (kept for API compat — bees are static now, see header). */
  triggerAnim?: number;
};

export function WarmGlowBackdrop({ style, hideClusters = false }: Props) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, style]}>
      {/* U-shape gradient: subtle pink wash at top + bottom, near-white middle.
          The previous monotonic top→bottom darkening read as a flat pink page;
          this curve gives the page a "stage" that lets the warm-tinted cards
          (Week hero, Welcome) land cleanly without merging with the bg. */}
      <LinearGradient
        colors={[
          '#FDF1EB', '#FDF8F4', '#FCFCFB',
          '#FCFCFB', '#FCF6EF', '#F9E9DD', '#F5DFD3',
        ]}
        locations={[0, 0.12, 0.30, 0.62, 0.76, 0.90, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Honeycomb echoes — rendered behind the bees so the bees stay the
          focal marks and the combs sit as quiet hive texture. */}
      {!hideClusters
        ? COMBS.map((c, i) => (
            <View
              key={`comb-${i}`}
              style={{
                position: 'absolute',
                top: c.top, bottom: c.bottom, left: c.left, right: c.right,
                width: c.size, height: c.size,
                opacity: c.opacity,
                transform: [{ rotate: c.rotate }],
              }}
            >
              <Svg width={c.size} height={c.size}>
                <Polygon points={hexPts(c.size)} fill="none" stroke={HONEY} strokeWidth={1.6} />
              </Svg>
            </View>
          ))
        : null}

      {!hideClusters
        ? BEES.map((b, i) => (
            <Image
              key={i}
              source={BEE}
              resizeMode="contain"
              style={[
                styles.bee,
                {
                  top: b.top,
                  bottom: b.bottom,
                  left: b.left,
                  right: b.right,
                  width: b.width,
                  height: b.height,
                  opacity: b.opacity,
                  transform: [{ rotate: b.rotate }],
                },
              ]}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#FFFFFF' },
  shine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '12%',
    backgroundColor: '#FFFFFF',
    opacity: 0.22,
  },
  bee: { position: 'absolute' },
});

export default WarmGlowBackdrop;
