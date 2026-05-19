import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { PrimaryCTA } from '@components/shared/PrimaryCTA';

export interface MilkFilters {
  radius_miles: number;
  max_price: number | null;
  filter_badge: string | null;
  diet_flags: string[];
}

interface Props {
  visible: boolean;
  filters: MilkFilters;
  onApply: (f: MilkFilters) => void;
  onClose: () => void;
}

const RADII = [5, 10, 25, 50];
const BADGES = [
  { value: null, label: 'Any badge' },
  { value: 'basic', label: 'Basic +' },
  { value: 'verified', label: 'Verified +' },
  { value: 'verified_bloodwork', label: 'Bloodwork Verified' },
];
const PRICES = [
  { value: null, label: 'Any price' },
  { value: 1.00, label: 'Up to $1/oz' },
  { value: 1.50, label: 'Up to $1.50/oz' },
  { value: 2.00, label: 'Up to $2/oz' },
  { value: 3.00, label: 'Up to $3/oz' },
];
const DIET_OPTIONS = [
  { key: 'dairy_free', emoji: '🥛', label: 'Dairy Free' },
  { key: 'organic', emoji: '🌿', label: 'Organic' },
  { key: 'gluten_free', emoji: '🌾', label: 'Gluten Free' },
  { key: 'vegan', emoji: '🥦', label: 'Vegan' },
  { key: 'nut_free', emoji: '🥜', label: 'Nut Free' },
];

export function FilterDrawerModal({ visible, filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<MilkFilters>(filters);

  const handleApply = () => { onApply(local); onClose(); };
  const handleReset = () => {
    setLocal({ radius_miles: 25, max_price: null, filter_badge: null, diet_flags: [] });
  };

  const toggleDiet = (key: string) => {
    setLocal((prev) => ({
      ...prev,
      diet_flags: prev.diet_flags.includes(key)
        ? prev.diet_flags.filter((k) => k !== key)
        : [...prev.diet_flags, key],
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Filter Donors</Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.reset}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Distance */}
            <Text style={styles.sectionLabel}>Distance</Text>
            <View style={styles.chipRow}>
              {RADII.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, local.radius_miles === r && styles.chipActive]}
                  onPress={() => setLocal((p) => ({ ...p, radius_miles: r }))}
                >
                  <Text style={[styles.chipText, local.radius_miles === r && styles.chipTextActive]}>
                    {r} mi
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Trust badge */}
            <Text style={styles.sectionLabel}>Trust Badge</Text>
            <View style={styles.chipRow}>
              {BADGES.map(({ value, label }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.chip, local.filter_badge === value && styles.chipActive]}
                  onPress={() => setLocal((p) => ({ ...p, filter_badge: value }))}
                >
                  <Text style={[styles.chipText, local.filter_badge === value && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Price */}
            <Text style={styles.sectionLabel}>Max price per oz</Text>
            <View style={styles.chipRow}>
              {PRICES.map(({ value, label }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.chip, local.max_price === value && styles.chipActive]}
                  onPress={() => setLocal((p) => ({ ...p, max_price: value }))}
                >
                  <Text style={[styles.chipText, local.max_price === value && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Diet flags */}
            <Text style={styles.sectionLabel}>Donor diet</Text>
            <View style={styles.chipRow}>
              {DIET_OPTIONS.map(({ key, emoji, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, local.diet_flags.includes(key) && styles.chipActive]}
                  onPress={() => toggleDiet(key)}
                >
                  <Text style={[styles.chipText, local.diet_flags.includes(key) && styles.chipTextActive]}>
                    {emoji} {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <PrimaryCTA
              shape="rect"
              label="Show Results"
              onPress={handleApply}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FDFBF6', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40, maxHeight: '85%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0D5C5', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  title: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  reset: { fontSize: 14, color: COLORS.coco, fontFamily: FONTS.bodySemiBold },
  sectionLabel: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#9A8070', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.paper, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E0D5C5',
  },
  chipActive: { borderColor: COLORS.coco, backgroundColor: COLORS.pinkSoft },
  chipText: { fontSize: 13, color: '#6B5C52', fontFamily: FONTS.bodyMedium },
  chipTextActive: { color: COLORS.coco },
  footer: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#9A8070',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#9A8070', fontFamily: FONTS.bodySemiBold },
  applyBtn: { flex: 2, backgroundColor: '#C07840', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText: { fontSize: 15, color: '#FDFBF6', fontFamily: FONTS.bodySemiBold },
});
