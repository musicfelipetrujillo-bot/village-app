// Global floating action button to open the in-app AI help chat ("Villie").
// Rendered as a sibling overlay above AppNavigator in RootNavigator, so it
// appears on every authenticated screen.
//
// Drag-to-reposition + snap-to-corner: a long-press / drag gesture lets the
// user move the FAB to any of the 4 screen corners. The chosen corner is
// persisted to AsyncStorage so the FAB stays where the user left it across
// launches. Tap (no drag) opens the chat as before.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TouchableOpacity, Text, StyleSheet, View, Platform,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { COLORS, NAV_HEIGHT } from '@utils/constants';

const STORAGE_KEY = 'village.villieFabCorner.v1';
const FAB_SIZE = 56;
const EDGE_PADDING = 16;
// Vertical bands keep the FAB clear of the status bar (top) and the bottom
// tab bar (bottom). Tweak only if NAV_HEIGHT changes.
const TOP_OFFSET = 64;
const BOTTOM_OFFSET = NAV_HEIGHT + 16;
// Drag threshold: any movement under this is treated as a tap, not a drag.
// Without this, a quick tap with a tiny finger-jitter would skip onPress.
const DRAG_THRESHOLD = 6;

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const DEFAULT_CORNER: Corner = 'bottom-right';

function cornerToXY(corner: Corner) {
  const { width, height } = Dimensions.get('window');
  const right = width - FAB_SIZE - EDGE_PADDING;
  const bottom = height - FAB_SIZE - BOTTOM_OFFSET;
  switch (corner) {
    case 'top-left':     return { x: EDGE_PADDING, y: TOP_OFFSET };
    case 'top-right':    return { x: right,        y: TOP_OFFSET };
    case 'bottom-left':  return { x: EDGE_PADDING, y: bottom };
    case 'bottom-right': return { x: right,        y: bottom };
  }
}

function nearestCorner(x: number, y: number): Corner {
  const { width, height } = Dimensions.get('window');
  const isLeft = x + FAB_SIZE / 2 < width / 2;
  const isTop  = y + FAB_SIZE / 2 < height / 2;
  if (isTop  && isLeft)  return 'top-left';
  if (isTop  && !isLeft) return 'top-right';
  if (!isTop && isLeft)  return 'bottom-left';
  return 'bottom-right';
}

export default function FloatingHelpButton() {
  const navigation = useNavigation<any>();
  const [corner, setCorner] = useState<Corner>(DEFAULT_CORNER);
  const initial = cornerToXY(DEFAULT_CORNER);
  const pan = useRef(new Animated.ValueXY(initial)).current;
  // Track whether the most recent gesture moved enough to count as a drag —
  // used to suppress the onPress that fires after a release.
  const wasDragging = useRef(false);

  // Idle pulse ring — expands + fades out after 4 s of inactivity, then loops.
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPulse = useCallback(() => {
    pulseAnim.current?.stop();
    pulseScale.setValue(1);
    pulseOpacity.setValue(0);
  }, [pulseScale, pulseOpacity]);

  const startPulse = useCallback(() => {
    stopPulse();
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.7, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.45, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ]),
      { iterations: -1 },
    );
    pulseAnim.current = loop;
    loop.start();
  }, [pulseScale, pulseOpacity, stopPulse]);

  const resetIdleTimer = useCallback(() => {
    stopPulse();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(startPulse, 4000);
  }, [startPulse, stopPulse]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      pulseAnim.current?.stop();
    };
  }, []);

  // Restore saved corner on mount. Fail-safe: if read errors or returns
  // garbage, fall back to default corner.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive) return;
        if (stored === 'top-left' || stored === 'top-right'
          || stored === 'bottom-left' || stored === 'bottom-right') {
          setCorner(stored);
          pan.setValue(cornerToXY(stored));
        }
      } catch {
        // ignore — keep default
      }
    })();
    return () => { alive = false; };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once the user has actually started dragging,
      // so a plain tap still reaches the TouchableOpacity underneath.
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        wasDragging.current = false;
        // @ts-expect-error _value exists at runtime on Animated.Value
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) {
          wasDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gesture);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // @ts-expect-error _value exists at runtime
        const x = pan.x._value as number;
        // @ts-expect-error _value exists at runtime
        const y = pan.y._value as number;
        const next = nearestCorner(x, y);
        const target = cornerToXY(next);
        Animated.spring(pan, {
          toValue: target,
          useNativeDriver: false,
          friction: 7, tension: 40,
        }).start();
        setCorner(next);
        // Fire-and-forget — failure to persist falls back to default next launch.
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    })
  ).current;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.fab,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Pulse ring — behind the button, expands + fades on idle. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
        <TouchableOpacity
          style={styles.fabInner}
          onPress={() => {
            // PanResponder consumed the gesture if it was a drag — but on
            // iOS a slow drag can still trigger onPress. Guard explicitly.
            if (wasDragging.current) {
              wasDragging.current = false;
              return;
            }
            resetIdleTimer();
            navigation.navigate('AIHelpChat');
          }}
          accessibilityRole="button"
          accessibilityLabel="Open in-app help chat. Drag to move."
          activeOpacity={0.85}
        >
          <Text style={styles.icon}>💬</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 0, left: 0,
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
    backgroundColor: '#C07840',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6B2E0E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  fabInner: {
    width: '100%', height: '100%', borderRadius: FAB_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
    backgroundColor: '#C07840',
    // Ring appears behind fab button content via z-index ordering (first child = lowest).
  },
  icon: { fontSize: 26 },
});
