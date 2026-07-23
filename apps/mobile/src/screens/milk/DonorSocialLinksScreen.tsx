// V2 Milk Connect — donor social links editor ("added credibility").
//
// Compliance (Risk & Compliance — Milk): donor-PROVIDED + opt-in + NOT
// verified by The Village. We store only what the donor types (no OAuth, no
// scraping). The screen warns these are publicly visible and to share only
// what they're comfortable with; the public profile carries a "not verified"
// disclaimer. See migration 075.
import React from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useT } from '@/i18n';
import { useMilkStore } from '@store/milk';
import { updateDonorProfile, type SocialLinks, type SocialPlatform } from '@api/milk';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

const T = {
  paper: COLORS.v2_paper, cream: COLORS.v2_cream, cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon, parchment: COLORS.v2_parchment,
  rule: 'rgba(61,31,14,0.13)',
};

const FIELDS: { key: SocialPlatform; labelKey: string; placeholder: string; prefix: string }[] = [
  { key: 'instagram', labelKey: 'donorSocial.instagram', placeholder: 'yourhandle', prefix: '@' },
  { key: 'tiktok',    labelKey: 'donorSocial.tiktok',    placeholder: 'yourhandle', prefix: '@' },
  { key: 'facebook',  labelKey: 'donorSocial.facebook',  placeholder: 'your.page',  prefix: '@' },
  { key: 'website',   labelKey: 'donorSocial.website',   placeholder: 'yoursite.com', prefix: '' },
];

type Props = NativeStackScreenProps<MilkStackParamList, 'DonorSocialLinks'>;

export default function DonorSocialLinksScreen({ route }: Props) {
  const t = useT();
  const navigation = useNavigation<any>();
  const donorProfile = useMilkStore((s) => s.donorProfile);
  const setDonorProfile = useMilkStore((s) => s.setDonorProfile);
  const profileId = route.params?.donorProfileId ?? donorProfile?.id ?? null;

  const initial = (donorProfile?.social_links ?? {}) as SocialLinks;
  const [values, setValues] = React.useState<SocialLinks>({
    instagram: initial.instagram ?? '',
    tiktok: initial.tiktok ?? '',
    facebook: initial.facebook ?? '',
    website: initial.website ?? '',
  });
  const [saving, setSaving] = React.useState(false);

  const onSave = async () => {
    if (!profileId) {
      Alert.alert(t('donorSocial.errorTitle'), t('donorSocial.noProfile'));
      return;
    }
    // Trim + drop empties so we never store blank handles.
    const cleaned: SocialLinks = {};
    (Object.keys(values) as SocialPlatform[]).forEach((k) => {
      const v = (values[k] ?? '').trim();
      if (v) cleaned[k] = v;
    });
    setSaving(true);
    try {
      const updated = await updateDonorProfile(profileId, { social_links: cleaned });
      setDonorProfile(updated);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t('donorSocial.errorTitle'), err?.message ?? t('donorSocial.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton color={T.rose} />
          <Text style={styles.headerTitle}>{t('donorSocial.title')}</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.lede}>{t('donorSocial.lede')}</Text>

          {FIELDS.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>{t(f.labelKey)}</Text>
              <View style={styles.inputRow}>
                {f.prefix ? <Text style={styles.prefix}>{f.prefix}</Text> : null}
                <TextInput
                  style={styles.input}
                  value={values[f.key] ?? ''}
                  onChangeText={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={f.key === 'website' ? 'url' : 'default'}
                  accessibilityLabel={t(f.labelKey)}
                />
              </View>
            </View>
          ))}

          {/* Safety + non-verification disclaimer (Risk & Compliance). */}
          <Text style={styles.disclaimer}>{t('donorSocial.disclaimer')}</Text>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t('donorSocial.save')}
            accessibilityState={{ busy: saving }}
          >
            {saving ? <ActivityIndicator color="#FFFCF6" /> : <Text style={styles.saveBtnText}>{t('donorSocial.save')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: T.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  back: { fontSize: 15, color: T.rose, fontFamily: FONTS.v2_link },
  headerTitle: { fontSize: 17, fontFamily: FONTS.v2_bold, color: T.cocoa },

  lede: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, color: T.walnut, marginBottom: 18 },

  field: { marginBottom: 14 },
  label: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    color: T.walnut, marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.paper, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
    paddingHorizontal: 12,
  },
  prefix: { fontFamily: FONTS.v2_body, fontSize: 15, color: T.walnut, marginRight: 2 },
  input: { flex: 1, paddingVertical: 12, fontFamily: FONTS.v2_body, fontSize: 15, color: T.cocoa },

  disclaimer: {
    fontFamily: FONTS.v2_body, fontSize: 12, lineHeight: 18, color: T.walnut,
    marginTop: 8, marginBottom: 22, opacity: 0.9,
  },
  saveBtn: { backgroundColor: T.rose, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: FONTS.v2_bold, fontSize: 16, color: '#FFFCF6' },
});
