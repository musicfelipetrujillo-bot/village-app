// Card glow accent — two soft radial blobs anchored inside the corners of
// a hero card, mirroring the `.cardA .portrait .blob1/.blob2` pattern from
// the Specialist Card Concepts artifact. Reuses the same pre-rendered
// glow PNGs as `WarmGlowBackdrop` (yolk + apricot) so the visual idiom
// matches at page level and inside-card level. Sits at the bottom of the
// card via `pointerEvents="none"` + `StyleSheet.absoluteFill` so it never
// catches touches on the card's primary CTA. Card itself must own
// `overflow: 'hidden'` and `position: 'relative'`.
import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';

const GLOW_YOLK = require('../../../assets/gradients/glow-yolk.png');
const GLOW_APRICOT = require('../../../assets/gradients/glow-apricot.png');

type Props = {
  /** Diameter of each blob in px. Default 220 — sized for hero cards. */
  size?: number;
  /** Top-right blob opacity. Keep low so text stays readable. */
  topRightOpacity?: number;
  /** Bottom-left blob opacity. */
  bottomLeftOpacity?: number;
  style?: ViewStyle | ViewStyle[];
};

export function CardGlowAccent({
  size = 220,
  topRightOpacity = 0.55,
  bottomLeftOpacity = 0.40,
  style,
}: Props) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={GLOW_YOLK}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          top: -size * 0.35,
          right: -size * 0.35,
          width: size,
          height: size,
          opacity: topRightOpacity,
        }}
      />
      <Image
        source={GLOW_APRICOT}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          bottom: -size * 0.40,
          left: -size * 0.35,
          width: size,
          height: size,
          opacity: bottomLeftOpacity,
        }}
      />
    </View>
  );
}

export default CardGlowAccent;
