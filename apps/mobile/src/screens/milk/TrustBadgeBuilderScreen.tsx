import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMilkStore } from '@store/milk';
import { getTrustBadge, upsertDietFlags, addMedication, getMedications, removeMedication } from '@api/milk';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';
import type { DietFlagKey, MilkMedication } from '@api/milk';

type Props = NativeStackScreenProps<MilkStackParamList, 'TrustBadgeBuilder'>;

const DIET_FLAGS: { key: DietFlagKey; labelKey: string; emoji: string }[] = [
  { key: 'dairy_free', labelKey: 'trustBadge.dietDairyFree', emoji: '🥛' },
  { key: 'organic', labelKey: 'trustBadge.dietOrganic', emoji: '🌿' },
  { key: 'gluten_free', labelKey: 'trustBadge.dietGlutenFree', emoji: '🌾' },
  { key: 'vegan', labelKey: 'trustBadge.dietVegan', emoji: '🥦' },
  { key: 'nut_free', labelKey: 'trustBadge.dietNutFree', emoji: '🥜' },
];

const BADGE_INFO: Record<string, { labelKey: string; color: string; descKey: string }> = {
  none: { labelKey: 'trustBadge.badgeNoneLabel', color: '#9A8070', descKey: 'trustBadge.badgeNoneDesc' },
  basic: { labelKey: 'trustBadge.badgeBasicLabel', color: COLORS.statusAlert, descKey: 'trustBadge.badgeBasicDesc' },
  verified: { labelKey: 'trustBadge.badgeVerifiedLabel', color: '#6B7C3F', descKey: 'trustBadge.badgeVerifiedDesc' },
  verified_bloodwork: { labelKey: 'trustBadge.badgeBloodworkLabel', color: COLORS.statusSuccess, descKey: 'trustBadge.badgeBloodworkDesc' },
};

export default function TrustBadgeBuilderScreen({ route, navigation }: Props) {
  const { donorProfileId } = route.params;
  const { setTrustBadge } = useMilkStore();
  const t = useT();

  const [badge, setBadge] = useState<{ badge_level: string; diet_disclosed: boolean; medications_disclosed: boolean } | null>(null);
  const [selectedDiet, setSelectedDiet] = useState<DietFlagKey[]>([]);
  const [medications, setMedications] = useState<MilkMedication[]>([]);
  const [showMedModal, setShowMedModal] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [b, meds] = await Promise.all([
        getTrustBadge(donorProfileId),
        getMedications(donorProfileId),
      ]);
      setBadge(b);
      setMedications(meds);
      if (b) setTrustBadge(b as any);
    } finally {
      setLoading(false);
    }
  };

  const toggleDiet = (key: DietFlagKey) => {
    setSelectedDiet((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleAddMedication = async () => {
    if (!medName.trim()) return;
    const med = await addMedication({
      donor_profile_id: donorProfileId,
      medication_name: medName.trim(),
      dosage: medDosage.trim() || null,
      frequency: medFreq.trim() || null,
      notes: null,
      is_current: true,
    });
    setMedications((prev) => [...prev, med]);
    setMedName(''); setMedDosage(''); setMedFreq('');
    setShowMedModal(false);
  };

  const handleRemoveMedication = async (id: string) => {
    await removeMedication(id);
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      await upsertDietFlags(donorProfileId, selectedDiet);

      // Mark diet + medications disclosed on trust badge (service_role call via RPC)
      await supabase.rpc('recalculate_milk_badge_level', { p_donor_profile_id: donorProfileId });

      // Refresh badge
      const updated = await getTrustBadge(donorProfileId);
      if (updated) {
        setBadge(updated);
        setTrustBadge(updated as any);
      }

      navigation.replace('CreateListing', { donorProfileId });
    } catch (err) {
      console.error('TrustBadgeBuilder save error:', err);
      Alert.alert(t('trustBadge.errorTitle'), t('trustBadge.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#C07840" /></View>;
  }

  const badgeLevel = (badge?.badge_level ?? 'basic') as keyof typeof BADGE_INFO;
  const info = BADGE_INFO[badgeLevel] ?? BADGE_INFO.basic;

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.title}>{t('trustBadge.title')}</Text>
        <Text style={styles.subtitle}>{t('trustBadge.subtitle')}</Text>

        {/* Current badge */}
        <View style={[styles.badgeCard, { borderColor: info.color }]}>
          <View style={[styles.badgePill, { backgroundColor: info.color }]}>
            <Text style={styles.badgePillText}>{t(info.labelKey)}</Text>
          </View>
          <Text style={styles.badgeDesc}>{t(info.descKey)}</Text>
        </View>

        {/* Checklist */}
        <View style={styles.checklistCard}>
          {[
            { done: true, labelKey: 'trustBadge.checkQuestionnaire' },
            { done: selectedDiet.length > 0, labelKey: 'trustBadge.checkDiet' },
            { done: medications.length > 0 || badge?.medications_disclosed, labelKey: 'trustBadge.checkMeds' },
            { done: badge?.badge_level === 'verified_bloodwork', labelKey: 'trustBadge.checkBloodwork' },
          ].map((item, i) => (
            <View key={i} style={styles.checkRow}>
              <Text style={[styles.checkIcon, item.done && styles.checkDone]}>
                {item.done ? '✓' : '○'}
              </Text>
              <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>
                {t(item.labelKey)}
              </Text>
            </View>
          ))}
        </View>

        {/* Diet flags */}
        <Text style={styles.sectionTitle}>{t('trustBadge.dietTitle')}</Text>
        <Text style={styles.sectionSub}>{t('trustBadge.dietSub')}</Text>
        <View style={styles.flagsGrid}>
          {DIET_FLAGS.map(({ key, labelKey, emoji }) => {
            const active = selectedDiet.includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.flagChip, active && styles.flagChipActive]}
                onPress={() => toggleDiet(key)}
              >
                <Text style={styles.flagEmoji}>{emoji}</Text>
                <Text style={[styles.flagLabel, active && styles.flagLabelActive]}>{t(labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.flagChip, selectedDiet.length === 0 && styles.flagChipActive]}
            onPress={() => setSelectedDiet([])}
          >
            <Text style={styles.flagEmoji}>🍽️</Text>
            <Text style={[styles.flagLabel, selectedDiet.length === 0 && styles.flagLabelActive]}>{t('trustBadge.dietNoRestrictions')}</Text>
          </TouchableOpacity>
        </View>

        {/* Medications */}
        <Text style={styles.sectionTitle}>{t('trustBadge.medsTitle')}</Text>
        <Text style={styles.sectionSub}>{t('trustBadge.medsSub')}</Text>
        {medications.map((med) => (
          <View key={med.id} style={styles.medRow}>
            <View style={styles.medInfo}>
              <Text style={styles.medName}>{med.medication_name}</Text>
              {(med.dosage || med.frequency) && (
                <Text style={styles.medDetail}>{[med.dosage, med.frequency].filter(Boolean).join(' · ')}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => med.id && handleRemoveMedication(med.id)}>
              <Text style={styles.medRemove}>{t('trustBadge.medsRemove')}</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addMedBtn} onPress={() => setShowMedModal(true)}>
          <Text style={styles.addMedText}>{t('trustBadge.medsAddCta')}</Text>
        </TouchableOpacity>

        {/* Bloodwork CTA (manual in v1) */}
        <View style={styles.bloodworkCard}>
          <Text style={styles.bloodworkTitle}>{t('trustBadge.bloodworkCardTitle')}</Text>
          <Text style={styles.bloodworkBody}>{t('trustBadge.bloodworkCardBody')}</Text>
          <TouchableOpacity style={styles.bloodworkBtn}>
            <Text style={styles.bloodworkBtnText}>{t('trustBadge.bloodworkCardCta')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, saving && styles.disabled]}
          onPress={handleSaveAndContinue}
          disabled={saving}
        >
          <Text style={styles.continueBtnText}>
            {saving ? t('trustBadge.saving') : t('trustBadge.saveCta')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add medication modal */}
      <Modal visible={showMedModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('trustBadge.modalTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('trustBadge.modalNamePlaceholder')}
              value={medName}
              onChangeText={setMedName}
              placeholderTextColor="#9A8070"
            />
            <TextInput
              style={styles.input}
              placeholder={t('trustBadge.modalDosagePlaceholder')}
              value={medDosage}
              onChangeText={setMedDosage}
              placeholderTextColor="#9A8070"
            />
            <TextInput
              style={styles.input}
              placeholder={t('trustBadge.modalFreqPlaceholder')}
              value={medFreq}
              onChangeText={setMedFreq}
              placeholderTextColor="#9A8070"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowMedModal(false)}>
                <Text style={styles.modalCancelText}>{t('trustBadge.modalCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAdd, !medName.trim() && styles.disabled]}
                onPress={handleAddMedication}
                disabled={!medName.trim()}
              >
                <Text style={styles.modalAddText}>{t('trustBadge.modalAdd')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0E8' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 120 },
  title: { fontSize: 28, fontFamily: FONTS.headerBold, color: '#2C1810', marginBottom: 8, letterSpacing: -0.4, lineHeight: 34 },
  subtitle: { fontSize: 14, color: '#6B5C52', lineHeight: 21, marginBottom: 24, fontFamily: FONTS.body },

  // v9 card lift — full hairline + soft cocoa drop. Border color comes from
  // the badge-tier accent at render time (kept dynamic since each tier has
  // its own color signal), but hairline width is the v9 canon.
  badgeCard: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 20,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 20,
    shadowColor: '#6B2E0E', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 8 }, shadowRadius: 22, elevation: 3,
  },
  badgePill: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginBottom: 10,
  },
  badgePillText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#FDFBF6' },
  badgeDesc: { fontSize: 14, color: '#6B5C52', lineHeight: 20, fontFamily: FONTS.body },

  // v9 card lift — checklist needs surface lift to read as a tally surface.
  checklistCard: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16, marginBottom: 24, gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#6B2E0E', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 6 }, shadowRadius: 20, elevation: 2,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkIcon: { fontSize: 18, color: '#C5B8AE', width: 24, textAlign: 'center' },
  checkDone: { color: '#6B7C3F' },
  checkLabel: { fontSize: 14, color: '#9A8070', flex: 1, fontFamily: FONTS.body },
  checkLabelDone: { color: '#2C1810', fontFamily: FONTS.bodyMedium },

  sectionTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 6, marginTop: 8 },
  sectionSub: { fontSize: 13, color: '#9A8070', marginBottom: 14, lineHeight: 19, fontFamily: FONTS.body },

  flagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  flagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.paper, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
  },
  flagChipActive: { borderColor: '#C07840', backgroundColor: 'rgba(192,120,64,0.08)' },
  flagEmoji: { fontSize: 16 },
  flagLabel: { fontSize: 13, color: '#6B5C52', fontFamily: FONTS.bodyMedium },
  flagLabelActive: { color: '#3D1F0E', fontFamily: FONTS.bodySemiBold },

  medRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.paper, borderRadius: 10, padding: 16,
    marginBottom: 8,
  },
  medInfo: { flex: 1 },
  medName: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  medDetail: { fontSize: 12, color: '#9A8070', marginTop: 2, fontFamily: FONTS.body },
  medRemove: { fontSize: 13, color: '#CC4444', fontFamily: FONTS.bodyMedium },
  addMedBtn: {
    borderWidth: 1.5, borderColor: COLORS.coco, borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 12, alignItems: 'center', marginBottom: 24,
  },
  addMedText: { fontSize: 14, color: '#A77349', fontFamily: FONTS.bodySemiBold },

  bloodworkCard: {
    backgroundColor: '#F0F4E8', borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: '#D4DDB8',
  },
  bloodworkTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 8 },
  bloodworkBody: { fontSize: 13, color: '#6B5C52', lineHeight: 20, marginBottom: 14, fontFamily: FONTS.body },
  bloodworkBtn: {
    alignSelf: 'flex-start', backgroundColor: '#6B7C3F',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
  },
  bloodworkBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#FDFBF6' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 36,
    backgroundColor: '#F5F0E8', borderTopWidth: 1, borderTopColor: '#E8E0D5',
  },
  // v9 canonical CTA — rect variant
  continueBtn: {
    backgroundColor: '#C07840', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  continueBtnText: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: '#FDFBF6' },
  disabled: { opacity: 0.45 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 20 },
  input: {
    borderWidth: 1.5, borderColor: '#E0D5C5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: '#2C1810', marginBottom: 12, fontFamily: FONTS.body,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1, borderWidth: 1.5, borderColor: '#9A8070',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#9A8070', fontFamily: FONTS.bodySemiBold },
  modalAdd: { flex: 1, backgroundColor: '#C07840', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalAddText: { fontSize: 15, color: '#FDFBF6', fontFamily: FONTS.bodySemiBold },
});
