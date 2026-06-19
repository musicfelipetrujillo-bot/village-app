// Villie Boxes — box detail + customize screen.
//
// RN port of the handoff detail view: hero → stage/blurb → trust chips →
// live price summary → "Make it yours" customize toggle → contents
// (grid/list, with remove/restore on optional items, lock on core) →
// add-on shelf → sticky buy bar. Pricing is derived live via
// computeBoxPricing as the user removes items / picks add-ons; nothing is
// stored except the working selections in useBoxesStore.

import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import {
  getBox, computeBoxPricing, formatPrice, TONE_GRADIENTS,
  type BoxItem, type BoxAddOn,
} from '@api/boxes';
import { useBoxesStore, type ContentsLayout } from '@store/boxes';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

const T = {
  paper: COLORS.v2_paper,
  cream: COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  butter: COLORS.v2_butter,
  cinnamon: COLORS.v2_cinnamon,
  caramel: COLORS.v2_caramel,
  blush: COLORS.v2_blush,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rule: 'rgba(61,31,14,0.13)',
};

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type Rt = RouteProp<HomeStackParamList, 'BoxDetail'>;

function Check({ on }: { on: boolean }) {
  return (
    <View style={[styles.checkbox, on && styles.checkboxOn]}>
      {on && (
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path d="M5 13l4 4L19 7" stroke={T.paper} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

export default function BoxDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { boxId } = useRoute<Rt>().params;
  const box = getBox(boxId);

  const contentsLayout = useBoxesStore((s) => s.contentsLayout);
  const setContentsLayout = useBoxesStore((s) => s.setContentsLayout);
  const customizeMode = useBoxesStore((s) => s.customizeMode);
  const setCustomizeMode = useBoxesStore((s) => s.setCustomizeMode);
  const customize = useBoxesStore((s) => s.customize[boxId]);
  const toggleItem = useBoxesStore((s) => s.toggleItem);
  const toggleAddon = useBoxesStore((s) => s.toggleAddon);
  const resetCustomize = useBoxesStore((s) => s.resetCustomize);
  const addBoxToCart = useBoxesStore((s) => s.addBoxToCart);

  // Start each open from a clean slate (also clears customizeMode).
  useEffect(() => {
    resetCustomize(boxId);
  }, [boxId, resetCustomize]);

  const removedSet = useMemo(() => new Set(customize?.removed ?? []), [customize?.removed]);
  const addonSet = useMemo(() => new Set(customize?.addons ?? []), [customize?.addons]);
  const pricing = useMemo(
    () => (box ? computeBoxPricing(box, removedSet, addonSet) : null),
    [box, removedSet, addonSet],
  );

  if (!box || !pricing) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: FONTS.v2_body, color: T.walnut }}>Box not found.</Text>
      </View>
    );
  }

  const onAdd = () => {
    addBoxToCart(boxId);
    navigation.navigate('BoxesCart');
  };

  const grid = contentsLayout === 'grid';

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={box.hero as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <LinearGradient
            colors={[box.glow, 'rgba(255,255,255,0)']}
            start={{ x: 0.15, y: 0.1 }} end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.heroBack}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke={T.cocoa} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{box.badge}</Text>
          </View>
          <Text style={[styles.heroPop, { color: box.popColor }]}>{box.pop}</Text>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.stage}>{box.stage}</Text>
          <Text style={styles.title}>
            The <Text style={[styles.titleEm, { color: T.caramel }]}>{box.pop}</Text> Box
          </Text>
          <Text style={styles.blurb}>{box.blurb}</Text>

          {/* Trust chips */}
          <View style={styles.trustRow}>
            {box.trust.map(([icon, label]) => (
              <View key={label} style={styles.trustChip}>
                <TrustDot name={icon} />
                <Text style={styles.trustText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Live price summary */}
          <View style={styles.priceCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <Text style={styles.priceNow}>{formatPrice(pricing.now)}</Text>
                <Text style={styles.priceWas}>{formatPrice(pricing.was)}</Text>
              </View>
              <Text style={styles.priceMeta}>
                {pricing.includedCount} items
                {pricing.addTotal > 0 ? ` · +${formatPrice(pricing.addTotal)} add-ons` : ''}
              </Text>
            </View>
            <View style={styles.priceSaveChip}>
              <Text style={styles.priceSaveText}>save {formatPrice(pricing.save)}</Text>
            </View>
          </View>

          {pricing.removedCount > 0 && (
            <Text style={styles.skipNote}>
              You skipped {pricing.removedCount} {pricing.removedCount === 1 ? 'item' : 'items'} —
              that&apos;s {formatPrice(pricing.skippedSave)} you&apos;re not paying for.
            </Text>
          )}

          {/* Make it yours / contents header */}
          <View style={styles.contentsHead}>
            <View>
              <Text style={styles.eyebrow}>what&apos;s inside</Text>
              <Text style={styles.contentsTitle}>Make it yours</Text>
            </View>
            <View style={styles.layoutToggle}>
              {(['grid', 'list'] as ContentsLayout[]).map((opt) => {
                const active = contentsLayout === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setContentsLayout(opt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.layoutBtn, active && styles.layoutBtnActive]}
                  >
                    <Text style={[styles.layoutText, active && styles.layoutTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setCustomizeMode(!customizeMode)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: customizeMode }}
            style={[styles.customizeToggle, customizeMode && styles.customizeToggleOn]}
          >
            <Text style={[styles.customizeToggleText, customizeMode && styles.customizeToggleTextOn]}>
              {customizeMode ? '✓ Customizing — tap items to remove' : '✎ Already have something? Customize'}
            </Text>
          </TouchableOpacity>

          {/* Contents */}
          <View style={[styles.itemsWrap, grid && styles.itemsGrid]}>
            {box.items.map((item, i) => (
              <ItemTile
                key={`${item.t}-${i}`}
                item={item}
                grid={grid}
                removed={removedSet.has(i)}
                customizing={customizeMode}
                onToggle={() => toggleItem(boxId, i)}
              />
            ))}
          </View>

          {/* Add-on shelf */}
          <View style={styles.addonHead}>
            <Text style={styles.eyebrow}>make it more</Text>
            <Text style={styles.contentsTitle}>Add-ons</Text>
          </View>
          <View style={{ gap: 10 }}>
            {box.addons.map((addon, i) => (
              <AddOnRow
                key={`${addon.t}-${i}`}
                addon={addon}
                selected={addonSet.has(i)}
                onToggle={() => toggleAddon(boxId, i)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky buy bar */}
      <View style={styles.buyBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.buyNow}>{formatPrice(pricing.now)}</Text>
          <Text style={styles.buyMeta}>{pricing.includedCount} items{addonSet.size > 0 ? ` · ${addonSet.size} add-ons` : ''}</Text>
        </View>
        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Add the ${box.pop} box to cart, ${formatPrice(pricing.now)}`}
          style={styles.buyBtn}
        >
          <Text style={styles.buyBtnText}>Add to cart →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────
const TRUST_ICONS: Record<string, string> = {
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 18.5a2 2 0 100-4 2 2 0 000 4zM18.5 18.5a2 2 0 100-4 2 2 0 000 4z',
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
};

function TrustDot({ name }: { name: string }) {
  const d = TRUST_ICONS[name] ?? 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0';
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path d={d} stroke={T.walnut} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ItemTile({ item, grid, removed, customizing, onToggle }: {
  item: BoxItem; grid: boolean; removed: boolean; customizing: boolean; onToggle: () => void;
}) {
  const tone = TONE_GRADIENTS[item.tone];
  const disabled = item.core || !customizing;
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.8}
      onPress={disabled ? undefined : onToggle}
      accessibilityRole={disabled ? undefined : 'button'}
      accessibilityState={{ selected: !removed, disabled }}
      accessibilityLabel={`${item.t} ${item.q}${item.core ? ', essential' : removed ? ', removed' : ''}`}
      style={[
        styles.item,
        grid ? styles.itemGridCell : styles.itemRow,
        removed && styles.itemRemoved,
      ]}
    >
      <LinearGradient
        colors={tone as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.itemSwatch, grid ? styles.itemSwatchGrid : styles.itemSwatchRow]}
      >
        {item.tone === 'ink' ? <View style={{ width: 1, height: 1 }} /> : null}
      </LinearGradient>

      <View style={grid ? { marginTop: 8 } : { flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.itemName, removed && styles.itemNameRemoved]} numberOfLines={1}>{item.t}</Text>
          <Text style={styles.itemQty}>{item.q}</Text>
        </View>
        <Text style={styles.itemNote} numberOfLines={grid ? 2 : 1}>{item.n}</Text>
      </View>

      {/* Right affordance: core lock, or remove/restore control in customize mode */}
      {!grid && (
        item.core ? (
          <View style={styles.coreChip}><Text style={styles.coreChipText}>core</Text></View>
        ) : customizing ? (
          <Text style={[styles.removeCtrl, removed && styles.removeCtrlOn]}>
            {removed ? '+ add back' : '− remove'}
          </Text>
        ) : (
          <Text style={styles.itemValue}>{formatPrice(item.v)}</Text>
        )
      )}

      {/* Grid mode: small corner badge for core / removed state */}
      {grid && item.core && (
        <View style={styles.coreCorner}><Text style={styles.coreChipText}>core</Text></View>
      )}
      {grid && !item.core && customizing && (
        <View style={[styles.gridRemoveCorner, removed && styles.gridRemoveCornerOn]}>
          <Text style={styles.gridRemoveCornerText}>{removed ? '+' : '−'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function AddOnRow({ addon, selected, onToggle }: {
  addon: BoxAddOn; selected: boolean; onToggle: () => void;
}) {
  const tone = TONE_GRADIENTS[addon.tone];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${addon.t}, ${formatPrice(addon.p)}${selected ? ', added' : ''}`}
      style={[styles.addon, selected && styles.addonOn]}
    >
      <LinearGradient
        colors={tone as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.addonSwatch}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.addonName} numberOfLines={1}>{addon.t}</Text>
        <Text style={styles.addonNote} numberOfLines={1}>{addon.n}</Text>
      </View>
      <Text style={styles.addonPrice}>+{formatPrice(addon.p)}</Text>
      <Check on={selected} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  scroll: { paddingBottom: 130 },

  // ── Hero ──────────────────────────────────────────────────────────────
  hero: { height: 220, justifyContent: 'flex-end', padding: 18, paddingTop: 56 },
  heroBack: {
    position: 'absolute', top: 52, left: 16,
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5, marginBottom: 8,
  },
  heroBadgeText: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.3,
    textTransform: 'uppercase', fontWeight: '600', color: T.cocoa,
  },
  heroPop: { fontFamily: FONTS.v3_display_italic, fontSize: 56, lineHeight: 58 },

  body: { paddingHorizontal: 22, paddingTop: 20 },
  stage: {
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: '600', color: T.caramel,
  },
  title: {
    fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 33,
    color: T.cocoa, letterSpacing: -1, marginTop: 6,
  },
  titleEm: { fontFamily: FONTS.v3_display_italic, fontSize: 30 },
  blurb: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: T.walnut, marginTop: 12,
  },

  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  trustChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.paper, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  trustText: { fontFamily: FONTS.v2_label, fontSize: 11.5, color: T.walnut },

  // ── Price summary ─────────────────────────────────────────────────────
  priceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.paper, borderRadius: 16, padding: 16, marginTop: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  priceNow: { fontFamily: FONTS.v2_display_big, fontSize: 30, color: T.cocoa },
  priceWas: {
    fontFamily: FONTS.v2_body, fontSize: 14, color: T.walnut,
    textDecorationLine: 'line-through', opacity: 0.7, marginBottom: 4,
  },
  priceMeta: { fontFamily: FONTS.v2_label, fontSize: 12, color: T.walnut, marginTop: 4 },
  priceSaveChip: {
    backgroundColor: 'rgba(217,108,136,0.12)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5,
  },
  priceSaveText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: T.cinnamon },
  skipNote: {
    fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18,
    color: T.cinnamon, marginTop: 10,
  },

  // ── Contents header + toggles ─────────────────────────────────────────
  contentsHead: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: 28,
  },
  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 2.2,
    textTransform: 'uppercase', fontWeight: '600', color: T.walnut,
  },
  contentsTitle: {
    fontFamily: FONTS.v3_display, fontSize: 22, color: T.cocoa,
    letterSpacing: -0.6, marginTop: 4,
  },
  layoutToggle: { flexDirection: 'row', backgroundColor: T.parchment, borderRadius: 10, padding: 3 },
  layoutBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  layoutBtnActive: { backgroundColor: T.paper },
  layoutText: { fontFamily: FONTS.v2_label, fontSize: 11.5, color: T.walnut, textTransform: 'capitalize' },
  layoutTextActive: { color: T.cocoa, fontFamily: FONTS.v2_bold },

  customizeToggle: {
    marginTop: 14, backgroundColor: T.parchment, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  customizeToggleOn: { backgroundColor: 'rgba(217,108,136,0.10)', borderColor: 'rgba(217,108,136,0.3)' },
  customizeToggleText: { fontFamily: FONTS.v2_link, fontSize: 13, color: T.walnut },
  customizeToggleTextOn: { color: T.cinnamon },

  // ── Items ─────────────────────────────────────────────────────────────
  itemsWrap: { marginTop: 16, gap: 10 },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  item: {
    backgroundColor: T.paper, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  itemGridCell: { width: '48.5%', padding: 12, marginBottom: 10, position: 'relative' },
  itemRemoved: { opacity: 0.45 },
  itemSwatch: { borderRadius: 10, overflow: 'hidden' },
  itemSwatchRow: { width: 46, height: 46 },
  itemSwatchGrid: { width: '100%', height: 64 },
  itemName: { fontFamily: FONTS.v2_bold, fontSize: 13.5, color: T.cocoa, flexShrink: 1 },
  itemNameRemoved: { textDecorationLine: 'line-through' },
  itemQty: { fontFamily: FONTS.v2_mono, fontSize: 10.5, color: T.caramel, fontWeight: '600' },
  itemNote: { fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 15, color: T.walnut, marginTop: 2 },
  itemValue: { fontFamily: FONTS.v2_label, fontSize: 12, color: T.walnut },

  coreChip: {
    backgroundColor: T.parchment, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  coreChipText: {
    fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: '600', color: T.walnut,
  },
  coreCorner: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  removeCtrl: { fontFamily: FONTS.v2_link, fontSize: 12, color: T.cinnamon },
  removeCtrlOn: { color: T.caramel },
  gridRemoveCorner: {
    position: 'absolute', top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.cinnamon,
  },
  gridRemoveCornerOn: { backgroundColor: T.caramel },
  gridRemoveCornerText: { fontFamily: FONTS.v2_bold, fontSize: 16, color: T.paper, lineHeight: 18 },

  // ── Add-ons ───────────────────────────────────────────────────────────
  addonHead: { marginTop: 28, marginBottom: 14 },
  addon: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: T.paper, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  addonOn: { borderColor: 'rgba(217,108,136,0.4)', backgroundColor: 'rgba(217,108,136,0.06)' },
  addonSwatch: { width: 42, height: 42, borderRadius: 10, overflow: 'hidden' },
  addonName: { fontFamily: FONTS.v2_bold, fontSize: 13.5, color: T.cocoa },
  addonNote: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 2 },
  addonPrice: { fontFamily: FONTS.v2_bold, fontSize: 13, color: T.cinnamon },
  checkbox: {
    width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: T.rule, backgroundColor: T.cream,
  },
  checkboxOn: { backgroundColor: T.cinnamon, borderColor: T.cinnamon },

  // ── Buy bar ───────────────────────────────────────────────────────────
  buyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30,
    backgroundColor: T.paper,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  buyNow: { fontFamily: FONTS.v2_display_big, fontSize: 24, color: T.cocoa },
  buyMeta: { fontFamily: FONTS.v2_label, fontSize: 11.5, color: T.walnut, marginTop: 1 },
  buyBtn: {
    backgroundColor: T.cinnamon, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
  },
  buyBtnText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.paper },
});
