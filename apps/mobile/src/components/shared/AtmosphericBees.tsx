// AtmosphericBees — 18 static villie-bee marks scattered across the page
// background. Extracted from WarmGlowBackdrop so V9PageBackdrop can compose
// just the bees (without re-painting V9's softer page gradient).
//
// Felipe approved the spread (5 vertical bands × left/center/right anchors,
// 9–22% opacity, varied sizes 14–30px) + the no-animation static treatment
// ("atmosphere should feel like it's always there, never moving").
//
// Drop it in absolutely below any page-level gradient + above the content:
//   <View style={{ flex: 1 }}>
//     <LinearGradient ... />     {/* page wash */}
//     <AtmosphericBees />        {/* bees over the wash */}
//     <ScrollView>...</ScrollView>
//   </View>

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';

const BEE = require('../../../assets/brand/villie-bee.png');

const BEES: {
  top?: number; bottom?: number;
  left?: number; right?: number;
  width: number; height: number;
  opacity: number;
  rotate: string;
}[] = [
  // ── Band 1 · Top (0-220) ──
  { top: 90,  right: 50,  width: 24, height: 22, opacity: 0.22, rotate: '-16deg' },
  { top: 150, left: 130,  width: 18, height: 16, opacity: 0.16, rotate: '10deg'  },
  { top: 210, right: 30,  width: 22, height: 20, opacity: 0.20, rotate: '20deg'  },
  // ── Band 2 · Upper-mid (220-440) ──
  { top: 260, left: 18,   width: 28, height: 25, opacity: 0.22, rotate: '-10deg' },
  { top: 330, left: 165,  width: 16, height: 14, opacity: 0.14, rotate: '8deg'   },
  { top: 370, right: 60,  width: 20, height: 18, opacity: 0.16, rotate: '-22deg' },
  { top: 420, left: 80,   width: 24, height: 22, opacity: 0.13, rotate: '14deg'  },
  // ── Band 3 · Mid (450-680) ──
  { top: 480, left: 25,   width: 18, height: 16, opacity: 0.16, rotate: '-8deg'  },
  { top: 530, right: 40,  width: 26, height: 23, opacity: 0.20, rotate: '18deg'  },
  { top: 580, left: 140,  width: 14, height: 13, opacity: 0.12, rotate: '-20deg' },
  { top: 640, right: 80,  width: 22, height: 20, opacity: 0.14, rotate: '4deg'   },
  // ── Band 4 · Lower-mid (680-900) ──
  { top: 700, left: 50,   width: 28, height: 25, opacity: 0.16, rotate: '-18deg' },
  { top: 760, right: 22,  width: 18, height: 16, opacity: 0.15, rotate: '30deg'  },
  { top: 830, left: 110,  width: 22, height: 20, opacity: 0.13, rotate: '-14deg' },
  { top: 870, right: 130, width: 16, height: 14, opacity: 0.11, rotate: '8deg'   },
  // ── Band 5 · Bottom (900+) ──
  { top: 940,  left: 30,  width: 20, height: 18, opacity: 0.13, rotate: '24deg'  },
  { top: 1010, right: 60, width: 24, height: 22, opacity: 0.11, rotate: '-12deg' },
  { bottom: 62, right: 48, width: 18, height: 16, opacity: 0.09, rotate: '8deg'  },
];

type Props = {
  style?: ViewStyle | ViewStyle[];
};

export function AtmosphericBees({ style }: Props) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {BEES.map((b, i) => (
        <Image
          key={i}
          source={BEE}
          resizeMode="contain"
          style={{
            position: 'absolute',
            top: b.top,
            bottom: b.bottom,
            left: b.left,
            right: b.right,
            width: b.width,
            height: b.height,
            opacity: b.opacity,
            transform: [{ rotate: b.rotate }],
          }}
        />
      ))}
    </View>
  );
}

export default AtmosphericBees;
