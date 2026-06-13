// V9 canonical primary CTA — cinnamon pill with iOS-26 wet-glass top sheen.
// One spark per screen. Use this for the unambiguous primary action of any
// screen (Pay, Submit, Continue, Apply, Send, Book, etc.).
//
// Bakes in the full v9 recipe so call sites don't have to repeat 8 style
// rules + insert the GlassHighlight child + remember textAlign + etc:
//
//   Before:
//     <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={x}>
//       <GlassHighlight radius={999} height={14} />
//       <Text style={styles.primaryBtnText}>Pay $24.00</Text>
//     </TouchableOpacity>
//
//   After:
//     <PrimaryCTA label="Pay $24.00" onPress={x} flex />
//
// Style overrides are intentionally restricted to size/layout (flex, width,
// marginTop, etc.) — the color/shadow/sheen/text recipe is locked to kit
// canon. If you need a different color, you don't want a PrimaryCTA — you
// want a SecondaryCTA (outline cinnamon) or a custom button.
import React from 'react';
import {
  ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity,
  ViewStyle, AccessibilityRole,
} from 'react-native';
import { GlassHighlight } from './GlassHighlight';
import { FONTS } from '@utils/constants';
import { tap } from '@utils/haptics';

export interface PrimaryCTAProps {
  label: string;
  onPress: () => void;
  /** Pill (default — borderRadius 999) or rect (borderRadius 14). */
  shape?: 'pill' | 'rect';
  /** Disabled visual + behavior. */
  disabled?: boolean;
  /** Loading state — replaces label with spinner. */
  loading?: boolean;
  /** Flex-1 inside a row (most paired-CTA layouts). */
  flex?: boolean;
  /** Optional style passthrough for size/margin (color is fixed). */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label fallback (defaults to `label`). */
  accessibilityLabel?: string;
  /** Optional analytics-friendly testID. */
  testID?: string;
}

export function PrimaryCTA({
  label, onPress, shape = 'pill', disabled, loading, flex, style,
  accessibilityLabel, testID,
}: PrimaryCTAProps) {
  const isInactive = disabled || loading;
  const radius = shape === 'pill' ? 999 : 14;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        { borderRadius: radius },
        flex && styles.flexOne,
        isInactive && styles.disabled,
        style,
      ]}
      onPress={() => { tap(); onPress(); }}
      disabled={isInactive}
      activeOpacity={0.9}
      accessibilityRole={'button' satisfies AccessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: !!loading }}
      testID={testID}
    >
      {/* iOS-26 wet-glass top sheen — softens the cinnamon fill so the button
          reads as polished, not flat-orange-aggressive. Always rendered;
          clipped by parent overflow:hidden + radius. */}
      <GlassHighlight radius={radius} height={14} />
      {loading ? (
        <ActivityIndicator color="#FFFCF6" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#D96C88',              // kit cinnamon
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D96C88',                  // action-deep tonal shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,                     // dialed from 0.24 — polished, not aggressive
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',                      // so the sheen clips to the pill
  },
  flexOne: { flex: 1 },
  disabled: { opacity: 0.45 },
  label: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFCF6',                        // paper white (kit canon, not #FFF)
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
