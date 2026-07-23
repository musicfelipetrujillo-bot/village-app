// HamburgerMenu — v3 brand kit dropdown menu primitive.
//
// Port of MenuButton + MenuPanel + MenuGroup + MenuItem from the
// 2026-05-24 design handoff (`shared.jsx` in the design bundle).
//
// React Native treatment: web reference uses absolute positioning +
// useClickOutside; we use Modal with a pressable backdrop because
// position:absolute popovers misbehave above ScrollViews on iOS and
// can't break out of safe-area / status-bar clipping. The trigger
// passes its onLayout-measured rect to anchor the panel; the rest of
// the visual recipe (paper→cream gradient, arrow nub, warm-tinted
// shadow stack, 24px icon chips, mono group labels, cinnamon hover
// fill, optional count badge) matches the web pixel-perfect.
//
// Used initially on ManualCategoryScreen to expose Library / This
// chapter / More actions (Save, Share, Print, Subscribe, etc.) —
// replacing the old "X of 5 done" status block per the handoff.

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '@utils/constants';

// ─── Tokens (v3 brand kit) ─────────────────────────────────────────────
//
// Pulled from constants.ts v2_* (which match the v3 brand-kit hexes
// pixel-for-pixel — verified against the 2026-05-24 design handoff
// `shared.jsx` BRAND block).
const PAPER     = COLORS.v2_paper;     // #FFFCF6
const CREAM     = COLORS.v2_cream;     // #FCF7EF
const PARCHMENT = COLORS.v2_parchment; // #F2E6DD
const COCOA     = COLORS.v2_cocoa;     // #43260F
const WALNUT    = COLORS.v2_walnut;    // #7A4A28
const CINNAMON  = COLORS.v2_cinnamon;  // #E84B79

// ─── MenuButton ────────────────────────────────────────────────────────
// Three-bar hamburger trigger. 36×28 parchment chip with embossed
// 1px highlight, hairline cocoa border, top/bottom bars 16px wide,
// middle bar 12px (the kit's slight asymmetry — not a code bug).
export interface MenuButtonProps {
  onPress: () => void;
  expanded: boolean;
  style?: StyleProp<ViewStyle>;
  /** Accessibility label for the trigger button (defaults to "Open menu"). */
  a11yLabel?: string;
}

export function MenuButton({ onPress, expanded, style, a11yLabel }: MenuButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? 'Open menu'}
      accessibilityState={{ expanded }}
      activeOpacity={0.7}
      style={[buttonStyles.btn, style]}
    >
      <View style={[buttonStyles.bar, buttonStyles.barLong]} />
      <View style={[buttonStyles.bar, buttonStyles.barShort]} />
      <View style={[buttonStyles.bar, buttonStyles.barLong]} />
    </TouchableOpacity>
  );
}

const buttonStyles = StyleSheet.create({
  btn: {
    width: 36, height: 28,
    backgroundColor: PARCHMENT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(122,74,40,0.18)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    // Embossed feel: paper inset highlight at top + soft contact shadow.
    // iOS native shadow + Android elevation. shadowColor walnut-tinted
    // per the kit's warm-shadow language (never cool #000).
    shadowColor: WALNUT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 1,
  },
  bar: {
    height: 1.6,
    backgroundColor: COCOA,
    borderRadius: 2,
    marginVertical: 1.5,
  },
  barLong: { width: 16 },
  barShort: { width: 12 },
});

// ─── MenuItem icon ─────────────────────────────────────────────────────
// 24×24 chip with paper bg + cocoa stroke OR cinnamon bg + paper stroke
// when `featured`. SVG path drawn from a string so callers stay
// declarative ("M…").
interface MenuIconProps {
  d: string;
  featured?: boolean;
}

function MenuIcon({ d, featured }: MenuIconProps) {
  const bg = featured ? CINNAMON : 'rgba(253,251,246,0.8)';
  const stroke = featured ? PAPER : COCOA;
  return (
    <View
      style={{
        width: 24, height: 24, borderRadius: 6,
        backgroundColor: bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(122,74,40,0.18)',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path
          d={d}
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

// ─── MenuItem ──────────────────────────────────────────────────────────
// Single action row inside the panel. Tappable area 40px tall (8px
// padding + 24 icon), with optional sub copy + count chip.
//
// The `title` prop can be a string OR a React node — the latter lets
// callers slip a Fraunces italic accent into the title (e.g. "Save
// _{chapter}_"). When it's a string we render plain bold.
export interface MenuItemProps {
  title: React.ReactNode;
  sub?: string;
  count?: string;
  /** Path data for a 24-viewBox SVG icon. */
  icon: string;
  /** Featured = cinnamon icon chip (one per menu, used on hero item). */
  featured?: boolean;
  onPress: () => void;
}

export function MenuItem({ title, sub, count, icon, featured, onPress }: MenuItemProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="menuitem"
      style={[itemStyles.row, pressed && itemStyles.rowPressed]}
    >
      <MenuIcon d={icon} featured={featured} />
      <View style={itemStyles.text}>
        {typeof title === 'string' ? (
          <Text style={itemStyles.title} numberOfLines={1}>{title}</Text>
        ) : (
          // Allow rich title (e.g. with an italic accent span).
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            {title}
          </View>
        )}
        {sub ? <Text style={itemStyles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {count ? (
        <View style={itemStyles.countChip}>
          <Text style={itemStyles.countText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  // Pressed fill = cinnamon @ ~14% — matches the hover state in the web ref.
  rowPressed: { backgroundColor: 'rgba(192,120,64,0.14)' },
  text: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: FONTS.v2_bold,
    fontSize: 13,
    color: COCOA,
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  sub: {
    fontFamily: FONTS.v2_label,
    fontSize: 10.5,
    color: WALNUT,
    lineHeight: 13,
    marginTop: 1,
  },
  countChip: {
    backgroundColor: 'rgba(192,120,64,0.15)',
    paddingVertical: 3, paddingHorizontal: 6,
    borderRadius: 5,
  },
  countText: {
    fontFamily: FONTS.v2_mono,
    fontSize: 9,
    letterSpacing: 1.3, // ~0.14em at 9px
    color: CINNAMON,
    fontWeight: '600',
  },
});

// ─── MenuGroup ─────────────────────────────────────────────────────────
// Section wrapper with optional uppercase mono label and a hairline
// divider above when it's not the first group.
export interface MenuGroupProps {
  label?: string;
  first?: boolean;
  children: React.ReactNode;
}

export function MenuGroup({ label, first, children }: MenuGroupProps) {
  return (
    <View
      style={{
        paddingTop: 8,
        paddingHorizontal: 4,
        paddingBottom: 4,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(122,74,40,0.18)',
        marginTop: first ? 0 : 4,
      }}
    >
      {label ? (
        <Text
          style={{
            fontFamily: FONTS.v2_mono,
            fontSize: 8.5,
            letterSpacing: 2.2, // ~0.26em at 8.5px
            color: CINNAMON,
            fontWeight: '600',
            textTransform: 'uppercase',
            paddingHorizontal: 10,
            paddingBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

// ─── MenuPanel ─────────────────────────────────────────────────────────
// Modal-hosted popover. The trigger reports its on-screen rect via
// onTriggerLayout; we anchor the panel beneath it. iOS modals fade
// in by default — we use `animationType="none"` and trust the open
// state for a faster feel, matching the web reference's instant open.
export interface MenuPanelProps {
  visible: boolean;
  onDismiss: () => void;
  /** Right edge of the trigger, measured from screen-left. */
  anchorRight: number;
  /** Bottom edge of the trigger, measured from screen-top. */
  anchorTop: number;
  width?: number;
  children: React.ReactNode;
}

export function MenuPanel({
  visible, onDismiss, anchorRight, anchorTop, width = 252, children,
}: MenuPanelProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop catches taps outside the panel to dismiss. Transparent
          so the underlying screen stays visible — this is a dropdown,
          not a sheet. */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={onDismiss}
        accessibilityLabel="Close menu"
      />
      <View
        style={[
          panelStyles.panel,
          {
            width,
            // Anchor: right edge aligned to trigger right, top edge
            // 4px below trigger bottom (gives breathing room for the
            // arrow nub).
            right: anchorRight,
            top: anchorTop + 4,
          },
        ]}
      >
        {/* Paper→cream vertical gradient — matches the warm "sun-bleached
            paper" feel of the web reference. */}
        <LinearGradient
          colors={[PAPER, CREAM]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Arrow nub pointing at the trigger button (top-right of panel). */}
        <View style={panelStyles.arrow} />
        {children}
      </View>
    </Modal>
  );
}

const panelStyles = StyleSheet.create({
  panel: {
    position: 'absolute',
    padding: 6,
    borderRadius: 14,
    overflow: 'visible',
    // Warm-tinted shadow stack — matches the kit's 5-layer recipe.
    // RN only renders one shadow per view; the cinnamon hairline border
    // approximates the "outline" layer that the web stack adds last.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(122,74,40,0.22)',
    shadowColor: WALNUT,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 12,
  },
  arrow: {
    position: 'absolute',
    top: -5, right: 12,
    width: 10, height: 10,
    backgroundColor: PAPER,
    transform: [{ rotate: '45deg' }],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(122,74,40,0.22)',
    borderLeftColor: 'rgba(122,74,40,0.22)',
    borderTopLeftRadius: 2,
  },
});

// ─── Icon paths (handoff SVGs, 24-viewBox) ─────────────────────────────
//
// Re-exported here so call sites stay copy-paste from the handoff
// without inlining SVG strings everywhere. Names match the handoff
// menu item table.
export const MENU_ICONS = {
  // Library
  bookOpen:
    'M2 4h7a3 3 0 013 3v13a2 2 0 00-2-2H2V4zM22 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8V4z',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
  history:
    'M3 12a9 9 0 109-9 9.74 9.74 0 00-6.36 2.64L3 8M3 3v5h5M12 7v5l3 3',
  // This chapter
  save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
  share:
    'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  printer:
    'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z',
  // More
  mailHeart:
    'M22 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h11l7 6zM2 6l10 7 10-7',
} as const;
