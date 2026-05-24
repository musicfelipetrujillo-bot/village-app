// AdminInviteScreen — in-app form for issuing specialist invites.
//
// Wraps the admin-specialist-invite edge function (JWT-gated, allowlist
// via ADMIN_USER_IDS env). Replaces the need to drop to a terminal and
// run `pnpm specialist:invite` for one-off invites. The CLI path stays
// the canonical bulk + CSV-batch tool; this screen handles the
// "remembered Marisol over coffee, send her an invite right now" case.
//
// Auth model: the edge function is the security boundary. This screen
// is visible to everyone in the MeScreen, but submitting as a non-admin
// returns a friendly 403 message ("Your account isn't on the admin
// list — ping moderator@villieapp.com to be added.") instead of
// silently dying. Keeps the allowlist server-side without leaking it to
// the client.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { V3Card } from '@components/shared/V3Card';
import {
  issueSpecialistInvite,
  type AdminInviteResult,
} from '@api/specialists';
import type { SpecialtyType } from 'shared/src/types/v1';

const T = {
  paper:    COLORS.v2_paper,
  parchment: COLORS.v2_parchment,
  card:     COLORS.v2_card,
  cinnamon: COLORS.v2_cinnamon,
  salmon:   COLORS.v2_salmon,
  sage:     COLORS.v2_sage,
  cocoa:    COLORS.v2_cocoa,
  walnut:   COLORS.v2_walnut,
  amber:    COLORS.v2_amber,
  rule:     'rgba(61,31,14,0.13)',
};

// Mirror of migration 060 ALLOWED_SPECIALTIES — same shape, same labels
// used elsewhere in the app. Keep in sync with the edge fn.
const SPECIALTY_OPTIONS: { value: SpecialtyType; label: string }[] = [
  { value: 'ob_gyn',                label: 'OB-GYN' },
  { value: 'midwife',               label: 'Midwife' },
  { value: 'doula',                 label: 'Doula' },
  { value: 'lactation_consultant',  label: 'Lactation Consultant' },
  { value: 'pediatrician',          label: 'Pediatrician' },
  { value: 'sleep_coach',           label: 'Sleep Coach' },
  { value: 'pelvic_floor_pt',       label: 'Pelvic Floor PT' },
  { value: 'perinatal_dietitian',   label: 'Perinatal Dietitian' },
  { value: 'ppd_therapist',         label: 'PPD Therapist' },
];

export default function AdminInviteScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [credentials, setCredentials] = useState('');
  const [specialty, setSpecialty] = useState<SpecialtyType | null>(null);
  const [npi, setNpi] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AdminInviteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    setErrorMsg(null);
    setResult(null);
    if (!email.trim()) {
      setErrorMsg('Email is required.');
      return;
    }
    setSubmitting(true);
    const out = await issueSpecialistInvite({
      email: email.trim(),
      full_name: fullName.trim() || undefined,
      credentials: credentials.trim() || undefined,
      specialty: specialty ?? undefined,
      npi_number: npi.trim() || undefined,
      personal_note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (out.ok) {
      setResult(out.data);
    } else {
      const friendly =
        out.status === 401
          ? 'You need to be signed in to issue invites.'
          : out.status === 403
            ? 'Your account isn’t on the admin allowlist. Ping moderator@villieapp.com to be added.'
            : `${out.error} (status ${out.status})`;
      setErrorMsg(friendly);
    }
  };

  const shareInvite = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `You’re invited to join Villie as a specialist.\n\n${result.invite_url}\n\nLink expires ${new Date(result.expires_at).toLocaleDateString()}.`,
      });
    } catch { /* user cancelled */ }
  };

  const resetForm = () => {
    setEmail(''); setFullName(''); setCredentials('');
    setSpecialty(null); setNpi(''); setNote('');
    setResult(null); setErrorMsg(null);
  };

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Editorial masthead */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow} activeOpacity={0.7}>
          <Text style={styles.backText}>← Me</Text>
        </TouchableOpacity>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrow}>ADMIN · SPECIALIST INVITES</Text>
        </View>
        <Text style={styles.title}>
          Invite a <Text style={styles.titleItalic}>specialist.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Generates a one-time link the specialist uses to create their
          profile. Pre-filled fields make their onboarding shorter — none
          are required except email.
        </Text>
        <View style={styles.headerRule} />

        {result ? (
          <V3Card style={{ marginTop: 18 }} contentStyle={styles.resultInner}>
            <Text style={styles.resultEyebrow}>
              {result.reused ? 'EXISTING INVITE' : 'INVITE ISSUED'}
            </Text>
            <Text style={styles.resultUrl} selectable>{result.invite_url}</Text>
            <Text style={styles.resultMeta}>
              Expires {new Date(result.expires_at).toLocaleString()}
            </Text>
            <View style={styles.resultActions}>
              <TouchableOpacity style={styles.ctaPrimary} onPress={shareInvite} activeOpacity={0.85}>
                <Text style={styles.ctaPrimaryText}>Share link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={resetForm} activeOpacity={0.85}>
                <Text style={styles.ctaSecondaryText}>Issue another</Text>
              </TouchableOpacity>
            </View>
          </V3Card>
        ) : (
          <V3Card style={{ marginTop: 18 }} contentStyle={styles.formInner}>
            <Field
              label="Email"
              required
              value={email}
              onChangeText={setEmail}
              placeholder="marisol@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Marisol Vargas"
              autoCapitalize="words"
            />
            <Field
              label="Credentials"
              value={credentials}
              onChangeText={setCredentials}
              placeholder="IBCLC · MS"
            />
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Specialty</Text>
              <View style={styles.chipWrap}>
                {SPECIALTY_OPTIONS.map((opt) => {
                  const on = specialty === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSpecialty(on ? null : opt.value)}
                      activeOpacity={0.85}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Field
              label="NPI number"
              value={npi}
              onChangeText={setNpi}
              placeholder="1234567890"
              keyboardType="number-pad"
              maxLength={10}
            />
            <Field
              label="Personal note"
              value={note}
              onChangeText={setNote}
              placeholder="Shown in the invite email body."
              multiline
              maxLength={500}
            />
            {errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}
            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              activeOpacity={0.85}
              style={[styles.ctaPrimary, submitting && { opacity: 0.55 }, { marginTop: 18 }]}
            >
              {submitting ? (
                <ActivityIndicator color={T.paper} />
              ) : (
                <Text style={styles.ctaPrimaryText}>Issue invite</Text>
              )}
            </TouchableOpacity>
          </V3Card>
        )}

        <Text style={styles.footnote}>
          Tip: for bulk + CSV batches, run{'\n'}
          <Text style={{ fontFamily: FONTS.v2_mono }}>pnpm specialist:invite</Text> from a trusted dev shell.
        </Text>
      </ScrollView>
    </View>
  );
}

// Simple labeled-input atom that picks up the form's typography.
function Field({
  label, required, multiline, ...inputProps
}: {
  label: string;
  required?: boolean;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.fieldLabel}>
        {label}{required ? <Text style={{ color: T.cinnamon }}> *</Text> : null}
      </Text>
      <TextInput
        {...inputProps}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor="rgba(122,74,40,0.45)"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },
  scroll: { paddingHorizontal: 22, paddingTop: 56, paddingBottom: 64 },

  backRow: { paddingBottom: 14 },
  backText: {
    fontFamily: FONTS.v2_mono, fontSize: 12, color: T.walnut,
    letterSpacing: 0.6,
  },

  eyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrowBar: { width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 },
  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', color: T.walnut, fontWeight: '500',
  },
  title: {
    marginTop: 6,
    fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 33,
    color: T.cocoa, letterSpacing: -0.9,
  },
  titleItalic: {
    fontFamily: FONTS.v3_display_italic, color: T.salmon,
  },
  subtitle: {
    marginTop: 10,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: T.walnut,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.rule,
    marginTop: 14, width: 48,
  },

  formInner: { padding: 18 },
  fieldLabel: {
    fontFamily: FONTS.v2_bold, fontSize: 12, color: T.cocoa,
    marginBottom: 6,
  },
  input: {
    backgroundColor: T.parchment,
    borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: FONTS.v2_body, fontSize: 14, color: T.cocoa,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  chipWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: T.paper,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.18)',
  },
  chipOn: {
    backgroundColor: T.cocoa, borderColor: T.cocoa,
  },
  chipText: {
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.cocoa,
  },
  chipTextOn: {
    fontFamily: FONTS.v2_bold, color: T.paper,
  },

  errorText: {
    marginTop: 14,
    fontFamily: FONTS.v2_body, fontSize: 13, color: '#B02E2E',
    lineHeight: 18,
  },

  ctaPrimary: {
    alignSelf: 'stretch',
    backgroundColor: T.cinnamon,
    paddingVertical: 13, borderRadius: 999,
    alignItems: 'center',
    shadowColor: T.cocoa, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 3,
  },
  ctaPrimaryText: {
    fontFamily: FONTS.v2_bold, fontSize: 14, color: T.paper, letterSpacing: 0.4,
  },
  ctaSecondary: {
    alignSelf: 'stretch',
    paddingVertical: 13, borderRadius: 999,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.cocoa,
  },
  ctaSecondaryText: {
    fontFamily: FONTS.v2_bold, fontSize: 14, color: T.cocoa, letterSpacing: 0.4,
  },

  resultInner: { padding: 20 },
  resultEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10, color: T.amber,
    letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: '700',
  },
  resultUrl: {
    marginTop: 10,
    fontFamily: FONTS.v2_mono, fontSize: 12.5, color: T.cocoa,
    lineHeight: 18,
  },
  resultMeta: {
    marginTop: 8,
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut,
  },
  resultActions: {
    marginTop: 18, flexDirection: 'column', gap: 10,
  },

  footnote: {
    marginTop: 22, textAlign: 'center',
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut,
    lineHeight: 18,
  },
});
