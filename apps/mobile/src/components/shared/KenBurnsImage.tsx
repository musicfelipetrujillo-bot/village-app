import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

/**
 * Slow Ken Burns zoom/pan on hero photos. Pure JS — no expo-linear-gradient,
 * no reanimated, no native rebuild. Driven by React Native's built-in
 * Animated API with the native driver (transforms only) so the zoom runs
 * off the JS thread and won't stutter when the list is scrolling.
 *
 * The image gently scales between 1.00 and 1.06 over ~14s and pans a few
 * pixels horizontally, looping forever. Cinematic depth without any
 * dependency cost.
 */
export function KenBurnsImage({
  source,
  style,
  durationMs = 14000,
  maxScale = 1.06,
  panX = 8,
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  durationMs?: number;
  maxScale?: number;
  panX?: number;
}) {
  // Single 0..1 driver — both scale and translate derive from it via
  // interpolate. We use yoyo (1 → 0 → 1...) so the zoom-in is mirrored
  // by an equal-length zoom-out, no jump at the loop boundary.
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Forever yoyo loop — Animated.loop with reverse:true alternates the
    // direction so the photo breathes in and out smoothly.
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [t, durationMs]);

  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, maxScale] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, panX] });

  return (
    <Animated.Image
      source={source}
      // accessibilityIgnoresInvertColors is set on the wrapper screens.
      style={[style, { transform: [{ scale }, { translateX }] }]}
    />
  );
}
