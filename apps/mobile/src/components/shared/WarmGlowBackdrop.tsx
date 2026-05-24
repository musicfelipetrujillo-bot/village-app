// Warm-glow backdrop — gradient + bee marks that animate left→right on mount.
// Each bee drifts from translateX -24 → 0, staggered 55ms apart, so the
// first-entry experience feels like a swarm flying gently across the screen.
// After settling, bees rest at their natural positions.
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

type Props = {
  style?: ViewStyle | ViewStyle[];
  hideClusters?: boolean;
  scrollY?: Animated.Value;
  triggerAnim?: number; // increment to restart fly-in; 0 = hold (wait for focus)
};

// Rightward drift per bee over 500px of scroll.
// Larger bees = "closer" = drift more for depth illusion.
const MIN_BEE_W = 14;
const MAX_BEE_W = 30;
function parallaxDrift(width: number): number {
  const t = (width - MIN_BEE_W) / (MAX_BEE_W - MIN_BEE_W);
  return 40 + t * 60; // 40px (far) → 100px (close)
}

export function WarmGlowBackdrop({ style, hideClusters = false, scrollY, triggerAnim = 0 }: Props) {
  // One Animated.Value per bee — drives fly-in translateX + opacity
  const anims = useRef(BEES.map(() => new Animated.Value(0))).current;

  // Pre-compute all per-bee animated nodes once so native driver tracks them
  // across renders. Must be stable refs — never recreated.
  const beeTransforms = useRef(
    BEES.map((b, i) => {
      const mountX = anims[i].interpolate({
        inputRange: [0, 1],
        outputRange: [-70, 0], // dramatic fly-in from left
      });
      const opacity = anims[i].interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, b.opacity * 0.7, b.opacity],
      });
      return { mountX, opacity };
    })
  ).current;

  const parallaxValues = useRef(
    BEES.map(b =>
      scrollY
        ? scrollY.interpolate({
            inputRange: [0, 500],
            outputRange: [0, parallaxDrift(b.width)],
            extrapolate: 'clamp',
          })
        : null
    )
  ).current;

  const combinedX = useRef(
    BEES.map((_, i) => {
      const p = parallaxValues[i];
      return p ? Animated.add(beeTransforms[i].mountX, p) : beeTransforms[i].mountX;
    })
  ).current;

  useEffect(() => {
    if (hideClusters || triggerAnim === 0) return;
    anims.forEach(a => a.setValue(0));
    Animated.stagger(
      35,
      anims.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [triggerAnim]);

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
      {/* Shine removed — base is near-white, the shine was washing out the
          intentional pink wash at the top. */}

      {!hideClusters
        ? BEES.map((b, i) => {
            return (
              <Animated.Image
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
                    opacity: beeTransforms[i].opacity,
                    transform: [
                      { translateX: combinedX[i] },
                      { rotate: b.rotate },
                    ],
                  },
                ]}
              />
            );
          })
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
