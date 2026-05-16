// Warm-glow backdrop — gradient + bee marks that animate left→right on mount.
// Each bee drifts from translateX -24 → 0, staggered 55ms apart, so the
// first-entry experience feels like a swarm flying gently across the screen.
// After settling, bees rest at their natural positions.
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@utils/constants';

const BEE = require('../../../assets/brand/villie-bee.png');

// Each bee's static layout + target opacity
const BEES: {
  top?: number; bottom?: number;
  left?: number; right?: number;
  width: number; height: number;
  opacity: number;
  rotate: string;
}[] = [
  // ── Masthead — top-right buddy pair ──
  { top: 112, right: 58,  width: 24, height: 22, opacity: 0.26, rotate: '-16deg' },
  { top: 136, right: 86,  width: 15, height: 13, opacity: 0.16, rotate: '10deg'  },
  // ── Far left anchor ──
  { top: 152, left: 10,   width: 28, height: 25, opacity: 0.30, rotate: '-10deg' },
  { top: 212, left: 38,   width: 17, height: 15, opacity: 0.20, rotate: '8deg'   },
  // ── Right, lower masthead ──
  { top: 228, right: 24,  width: 22, height: 20, opacity: 0.22, rotate: '20deg'  },
  // ── Mid page — sparse, drifting ──
  { top: 395, left: 48,   width: 26, height: 23, opacity: 0.16, rotate: '-22deg' },
  { top: 500, right: 52,  width: 20, height: 18, opacity: 0.14, rotate: '14deg'  },
  { top: 610, left: 150,  width: 16, height: 14, opacity: 0.13, rotate: '-8deg'  },
  // ── Lower page ──
  { top: 700, right: 22,  width: 28, height: 25, opacity: 0.13, rotate: '-18deg' },
  { top: 800, left: 30,   width: 18, height: 16, opacity: 0.11, rotate: '30deg'  },
  { top: 890, left: 105,  width: 22, height: 20, opacity: 0.11, rotate: '-14deg' },
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
