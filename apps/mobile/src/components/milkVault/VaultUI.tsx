// V6 Milk Vault — shared UI atoms.
//
// Warm, premium, non-spreadsheet. Reuses the app's V3 kit (V3Card, PrimaryCTA,
// backdrop) + Gen Z tokens. Every piece here is presentational.

import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, PanResponder, Animated,
  StyleProp, ViewStyle, LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '@utils/constants';
import { V3Card } from '@components/shared/V3Card';
import { clamp } from '@utils/milkVaultCalc';

// ── Screen scaffold: warm page wash + safe top padding ─────────────────────
export function VaultScreen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.screen, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={['#FCF7EF', '#FBEFE4', '#F7E4DA']}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

// ── Editorial header with optional back + eyebrow + title + italic accent ──
export function VaultHeader({
  eyebrow, title, accent, onBack, right,
}: {
  eyebrow: string;
  title: string;
  accent?: string;       // italic Caveat word appended after the title
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 18 }} />}
        <View style={{ flex: 1 }} />
        {right ?? null}
      </View>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowBar} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.headerTitle}>
        {title}
        {accent ? <Text style={styles.headerAccent}>{' '}{accent}</Text> : null}
      </Text>
      <View style={styles.hairline} />
    </View>
  );
}

// ── Small labeled section head ─────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ── Hero stat: one big number + caption (e.g. total freezer oz) ────────────
export function HeroStat({
  value, unit, caption, sub,
}: { value: string; unit?: string; caption: string; sub?: string }) {
  return (
    <V3Card deepShadow style={{ marginHorizontal: 16 }} contentStyle={styles.heroInner}>
      <LinearGradient
        pointerEvents="none"
        colors={['#F2E9C4', '#EADBA8', '#E8C4B6']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.heroBand}
      />
      <Text style={styles.heroCaption}>{caption}</Text>
      <View style={styles.heroValueRow}>
        <Text style={styles.heroValue}>{value}</Text>
        {unit ? <Text style={styles.heroUnit}>{unit}</Text> : null}
      </View>
      {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
    </V3Card>
  );
}

// ── Compact stat tile for a 2-up grid ──────────────────────────────────────
export function StatTile({
  label, value, unit, hint, tint, onPress,
}: {
  label: string; value: string; unit?: string; hint?: string; tint?: string; onPress?: () => void;
}) {
  return (
    <V3Card
      tinted={tint}
      pressable={onPress}
      style={styles.tile}
      contentStyle={{ gap: 3 }}
    >
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.tileValueRow}>
        <Text style={styles.tileValue}>{value}</Text>
        {unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </V3Card>
  );
}

/** 2-up flex grid wrapper for StatTiles. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

// ── AI insight card — a friendly sentence with an emoji marker ─────────────
export function InsightCard({ emoji, text }: { emoji: string; text: string }) {
  return (
    <V3Card tinted={COLORS.genz_bone} style={{ marginHorizontal: 16, marginTop: 10 }} contentStyle={styles.insightInner}>
      <Text style={styles.insightEmoji}>{emoji}</Text>
      <Text style={styles.insightText}>{text}</Text>
    </V3Card>
  );
}

// ── Reserve-first ethical banner (marketplace) ─────────────────────────────
export function EthicalBanner({ text }: { text: string }) {
  return (
    <View style={styles.ethical}>
      <Text style={styles.ethicalEmoji}>🛡️</Text>
      <Text style={styles.ethicalText}>{text}</Text>
    </View>
  );
}

// ── Progress / coverage bar ────────────────────────────────────────────────
export function CoverageBar({
  progress, color = COLORS.genz_rose,
}: { progress: number; color?: string }) {
  const pct = clamp(progress, 0, 1);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Diet / lifestyle chips (read-only, from profile) ───────────────────────
export function TagChips({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {labels.map((l) => (
        <View key={l} style={styles.chip}>
          <Text style={styles.chipText}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Legal / safety disclaimer ──────────────────────────────────────────────
export function VaultLegalNote({ text }: { text: string }) {
  return (
    <View style={styles.legal}>
      <Text style={styles.legalText}>{text}</Text>
    </View>
  );
}

// ── Keep-vs-Sell slider (PanResponder — no native dep) ─────────────────────
export function KeepSellSlider({
  total, value, onChange,
}: {
  total: number;
  value: number;             // ounces to keep (0..total)
  onChange: (keepOz: number) => void;
}) {
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const pctToOz = (pct: number) => clamp(Math.round(pct * total), 0, total);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const w = widthRef.current;
        if (w > 0) onChange(pctToOz(clamp(evt.nativeEvent.locationX / w, 0, 1)));
      },
      onPanResponderMove: (evt) => {
        const w = widthRef.current;
        if (w > 0) onChange(pctToOz(clamp(evt.nativeEvent.locationX / w, 0, 1)));
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width; };
  const pct = total > 0 ? clamp(value / total, 0, 1) : 0;

  return (
    <View style={styles.sliderWrap}>
      <View
        style={styles.sliderTrack}
        onLayout={onLayout}
        {...responder.panHandlers}
      >
        {/* keep portion */}
        <View style={[styles.sliderKeep, { width: `${pct * 100}%` }]} />
        {/* thumb */}
        <View style={[styles.sliderThumb, { left: `${pct * 100}%` }]} />
      </View>
      <View style={styles.sliderLegendRow}>
        <View style={styles.sliderLegendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.genz_rose }]} />
          <Text style={styles.sliderLegendText}>keep for baby</Text>
        </View>
        <View style={styles.sliderLegendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.genz_clay }]} />
          <Text style={styles.sliderLegendText}>available</Text>
        </View>
      </View>
    </View>
  );
}

// ── Simple radio row ───────────────────────────────────────────────────────
export function RadioRow({
  label, sublabel, selected, onPress,
}: { label: string; sublabel?: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.radioRow, selected && styles.radioRowActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      activeOpacity={0.85}
    >
      <View style={[styles.radioDot, selected && styles.radioDotActive]}>
        {selected ? <View style={styles.radioDotInner} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.radioLabel}>{label}</Text>
        {sublabel ? <Text style={styles.radioSub}>{sublabel}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// re-export for screens that want a plain scroll container
export { ScrollView, Animated };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.genz_cream },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', minHeight: 26 },
  back: { fontSize: 34, lineHeight: 34, color: COLORS.genz_chestnut, fontFamily: FONTS.body, marginLeft: -2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  eyebrowBar: { width: 16, height: 1.5, backgroundColor: COLORS.genz_rose },
  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.4,
    textTransform: 'uppercase', color: COLORS.genz_softink,
  },
  headerTitle: {
    fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 34,
    color: COLORS.genz_chestnut, marginTop: 6,
  },
  headerAccent: { fontFamily: FONTS.v3_display_italic, fontSize: 30, color: COLORS.genz_rose },
  hairline: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,14,0.14)', marginTop: 14,
  },

  sectionLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
    color: COLORS.genz_softink, marginHorizontal: 16, marginTop: 22, marginBottom: 8,
  },

  heroInner: { padding: 20, minHeight: 128, justifyContent: 'flex-end' },
  heroBand: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%', opacity: 0.55 },
  heroCaption: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase',
    color: COLORS.genz_softink,
  },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 2 },
  heroValue: { fontFamily: FONTS.v2_display_big, fontSize: 52, lineHeight: 56, color: COLORS.genz_chestnut },
  heroUnit: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.genz_softink, marginBottom: 8 },
  heroSub: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.genz_softink, marginTop: 6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginTop: 8 },
  tile: { width: '47%', marginHorizontal: 4, marginVertical: 4, minHeight: 92 },
  tileLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
    color: COLORS.genz_softink,
  },
  tileValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  tileValue: { fontFamily: FONTS.v2_display_big, fontSize: 30, lineHeight: 34, color: COLORS.genz_chestnut },
  tileUnit: { fontFamily: FONTS.v2_bold, fontSize: 13, color: COLORS.genz_softink, marginBottom: 5 },
  tileHint: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.genz_softink, marginTop: 2 },

  insightInner: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16 },
  insightEmoji: { fontSize: 22 },
  insightText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20, color: COLORS.genz_chestnut },

  ethical: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginHorizontal: 16, marginTop: 12,
    backgroundColor: 'rgba(217,108,136,0.08)', borderRadius: 14, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,108,136,0.25)',
  },
  ethicalEmoji: { fontSize: 16, marginTop: 1 },
  ethicalText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 19, color: COLORS.genz_chestnut },

  barTrack: { height: 10, borderRadius: 999, backgroundColor: COLORS.genz_clay, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 16, marginTop: 8 },
  chip: {
    backgroundColor: COLORS.genz_blush, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  chipText: { fontFamily: FONTS.v2_label, fontSize: 12, color: COLORS.genz_chestnut },

  legal: {
    marginHorizontal: 16, marginTop: 20, marginBottom: 8, padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(122,74,36,0.06)',
  },
  legalText: { fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 17, color: COLORS.genz_softink },

  sliderWrap: { marginHorizontal: 16, marginTop: 16 },
  sliderTrack: {
    height: 26, borderRadius: 999, backgroundColor: COLORS.genz_clay, justifyContent: 'center',
    overflow: 'visible',
  },
  sliderKeep: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: COLORS.genz_rose },
  sliderThumb: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.genz_bone,
    marginLeft: -14, borderWidth: 3, borderColor: COLORS.genz_rose,
    shadowColor: '#43260F', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  sliderLegendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  sliderLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sliderLegendText: { fontFamily: FONTS.v2_label, fontSize: 12, color: COLORS.genz_softink },
  dot: { width: 10, height: 10, borderRadius: 5 },

  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, backgroundColor: COLORS.genz_bone, marginHorizontal: 16, marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
  },
  radioRowActive: { borderColor: COLORS.genz_rose, backgroundColor: 'rgba(217,108,136,0.06)' },
  radioDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.genz_clay,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDotActive: { borderColor: COLORS.genz_rose },
  radioDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.genz_rose },
  radioLabel: { fontFamily: FONTS.v2_label, fontSize: 15, color: COLORS.genz_chestnut },
  radioSub: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: COLORS.genz_softink, marginTop: 2 },
});
