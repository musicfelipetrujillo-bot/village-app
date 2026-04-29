// Hand-drawn decorative marks recreated from the moodboard reference.
// Pure React Native (no SVG dep) — uses Views with borderRadius + rotate
// transforms + opacity layering to evoke the marker/watercolor feel without
// shipping bitmap assets. Place absolutely behind editorial content.
//
// All marks accept top/left/right/bottom + size + tint props so callers can
// position them per-card. Default tints map to the editorial palette
// (yolk for circles, blush for dots, lime for sprig, ceramicDeep for scribble).
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { COLORS } from '@utils/constants';

type AbsPos = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};

// Yolk-tinted soft circle — the "scribbled-circle" highlight mark from the
// moodboard. Two layered ellipses with slight rotation give the off-register,
// hand-drawn feel without an SVG.
export function YolkCircle({
  size = 64,
  tint = COLORS.yolkLight,
  opacity = 0.85,
  ...pos
}: AbsPos & { size?: number; tint?: string; opacity?: number }) {
  return (
    <View pointerEvents="none" style={[styles.absolute, pos]}>
      <View
        style={{
          width: size,
          height: size * 0.92,
          borderRadius: size,
          backgroundColor: tint,
          opacity,
          transform: [{ rotate: '-8deg' }],
        }}
      />
    </View>
  );
}

// Two slightly offset yolk ellipses — gives the "ringed" doubled-circle look
// the moodboard uses on the Village hero ("V" mark).
export function YolkRing({
  size = 56,
  tint = COLORS.yolkLight,
  ...pos
}: AbsPos & { size?: number; tint?: string }) {
  return (
    <View pointerEvents="none" style={[styles.absolute, pos]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size,
          borderWidth: 2,
          borderColor: tint,
          transform: [{ rotate: '-6deg' }],
          opacity: 0.7,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          width: size - 8,
          height: size - 8,
          borderRadius: size,
          borderWidth: 1.5,
          borderColor: tint,
          transform: [{ rotate: '12deg' }],
          opacity: 0.55,
        }}
      />
    </View>
  );
}

// Quick scribble line — three short angled bars stacked, evoking the
// marker-stroke decoration on the moodboard's WEEK card and Manual.
export function ScribbleMark({
  size = 32,
  tint = COLORS.brownDeep,
  ...pos
}: AbsPos & { size?: number; tint?: string }) {
  const bar = (rotate: string, top: number, left: number) => (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        width: size * 0.7,
        height: 2,
        backgroundColor: tint,
        borderRadius: 2,
        transform: [{ rotate }],
        opacity: 0.55,
      }}
    />
  );
  return (
    <View pointerEvents="none" style={[styles.absolute, { width: size, height: size }, pos]}>
      {bar('-12deg', 0, 0)}
      {bar('-4deg', 8, 4)}
      {bar('6deg', 16, 0)}
    </View>
  );
}

// Cluster of small blush dots — the "confetti dot" pattern on the moodboard.
// Hand-positioned to feel scattered rather than perfectly gridded.
export function DotCluster({
  tint = COLORS.dinerDark,
  ...pos
}: AbsPos & { tint?: string }) {
  const dot = (top: number, left: number, scale = 1) => (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        width: 4 * scale,
        height: 4 * scale,
        borderRadius: 4,
        backgroundColor: tint,
        opacity: 0.4,
      }}
    />
  );
  return (
    <View pointerEvents="none" style={[styles.absolute, { width: 36, height: 28 }, pos]}>
      {dot(0, 12, 1)}
      {dot(6, 2, 0.8)}
      {dot(10, 22, 1)}
      {dot(18, 14, 0.8)}
      {dot(20, 4, 0.6)}
    </View>
  );
}

// Soft leaf sprig — two rotated rounded ellipses + a green stem, evoking the
// botanical illustration mark on the moodboard's Manual and Home statement.
export function LeafSprig({
  size = 44,
  tint = COLORS.olive,
  ...pos
}: AbsPos & { size?: number; tint?: string }) {
  return (
    <View pointerEvents="none" style={[styles.absolute, { width: size, height: size }, pos]}>
      {/* Stem */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.45,
          top: size * 0.2,
          width: 1.5,
          height: size * 0.7,
          backgroundColor: tint,
          opacity: 0.55,
          transform: [{ rotate: '6deg' }],
        }}
      />
      {/* Left leaf */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          top: size * 0.32,
          width: size * 0.36,
          height: size * 0.18,
          borderRadius: size,
          backgroundColor: tint,
          opacity: 0.6,
          transform: [{ rotate: '-30deg' }],
        }}
      />
      {/* Right leaf */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.46,
          top: size * 0.16,
          width: size * 0.36,
          height: size * 0.18,
          borderRadius: size,
          backgroundColor: tint,
          opacity: 0.6,
          transform: [{ rotate: '30deg' }],
        }}
      />
    </View>
  );
}

// Tiny five-point sparkle — same ✦ glyph used on the statement card mark,
// rendered as bold serif text so it scales w/ size and inherits color.
export function SparkleMark({
  size = 14,
  tint = COLORS.dinerDark,
  ...pos
}: AbsPos & { size?: number; tint?: string }) {
  return (
    <View pointerEvents="none" style={[styles.absolute, pos]}>
      <Text style={{ fontSize: size, color: tint, opacity: 0.85 }}>✦</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
});
