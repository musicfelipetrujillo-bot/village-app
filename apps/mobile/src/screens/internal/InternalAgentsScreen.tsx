// Internal Agents Console — INTERNAL-ONLY debug surface.
//
// Purpose: a single screen where a founder/operator can paste a note,
// pick triage vs. run, and inspect the runtime's integration_envelope
// (category, workstream, owner, route, summary, next_step, risk,
// requires_human_review). Nothing here is wired into any public flow.
//
// Safety rules enforced here (matches RISK_AND_BOUNDARIES.md):
//   - No DB writes happen as a side effect of any runtime output.
//   - humanReview flag is rendered prominently in red when true.
//   - Unknown workstreams (not in VILLAGE_WORKSTREAMS) get a visible
//     "drift" warning — we do not silently accept runtime-defined taxonomy.
//   - Transport errors and business errors are surfaced separately so
//     operators can tell "runtime down" from "runtime said no".
//
// Reached via the hidden `InternalAgents` modal route wired into
// RootNavigator only when EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED === '1'.

import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { agentsApi, type AgentRequest, type AgentResponse } from '@api/agents';
import { toUiCard, isKnownWorkstream, type AgentUiCard } from '@village/agents-client';
import { COLORS, FONTS } from '@utils/constants';

type Mode = 'triage' | 'run';

export default function InternalAgentsScreen() {
  const navigation = useNavigation<any>();

  const [rawInput, setRawInput] = useState(
    'Users may not understand donor trust tiers.',
  );
  const [source, setSource] = useState('founder_note');
  const [relatedProject, setRelatedProject] = useState('');
  const [currentContext, setCurrentContext] = useState('');
  const [activeProjects, setActiveProjects] = useState(
    'donor trust update,onboarding rewrite',
  );
  const [validationNotes, setValidationNotes] = useState('');
  const [openIssues, setOpenIssues] = useState('');
  const [approvedForPlanning, setApprovedForPlanning] = useState(false);

  const [loading, setLoading] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [raw, setRaw] = useState<AgentResponse | null>(null);
  const [card, setCard] = useState<AgentUiCard | null>(null);
  const [healthText, setHealthText] = useState<string>('');

  const buildPayload = useCallback(
    (m: Mode): AgentRequest => ({
      raw_input: rawInput,
      source,
      related_project: relatedProject.trim() ? relatedProject : null,
      current_context: currentContext.trim() ? currentContext : null,
      active_projects: activeProjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      approved_for_planning: m === 'run' ? true : approvedForPlanning,
      validation_notes: validationNotes,
      open_issues: openIssues,
    }),
    [
      rawInput, source, relatedProject, currentContext, activeProjects,
      approvedForPlanning, validationNotes, openIssues,
    ],
  );

  async function send(m: Mode) {
    setLoading(true);
    setMode(m);
    try {
      const result = m === 'triage'
        ? await agentsApi.triage(buildPayload('triage'))
        : await agentsApi.run(buildPayload('run'));
      setRaw(result);
      setCard(toUiCard(result));
    } finally {
      setLoading(false);
    }
  }

  async function checkHealth() {
    setHealthChecking(true);
    try {
      const h = await agentsApi.health();
      setHealthText(JSON.stringify(h, null, 2));
    } catch (err) {
      setHealthText(err instanceof Error ? err.message : String(err));
    } finally {
      setHealthChecking(false);
    }
  }

  const workstreamUnknown =
    !!card && card.workstream !== 'unknown' && !isKnownWorkstream(card.workstream);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.cream }}
    >
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close internal agents console"
        >
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
        <Text style={s.title}>Internal Agents Console</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.helpTxt}>
          Internal tool. Paste a note, pick Triage (analysis) or Run (planning).
          Nothing here writes to product state.
        </Text>

        <View style={s.healthRow}>
          <TouchableOpacity
            style={[s.secondaryBtn, healthChecking && s.btnDisabled]}
            onPress={checkHealth}
            disabled={healthChecking}
            accessibilityRole="button"
            accessibilityLabel="Check runtime health"
          >
            <Text style={s.secondaryBtnTxt}>
              {healthChecking ? 'Checking…' : 'Check /health'}
            </Text>
          </TouchableOpacity>
        </View>
        {healthText ? (
          <View style={s.pre}>
            <Text style={s.preTxt}>{healthText}</Text>
          </View>
        ) : null}

        <Label text="Source" />
        <TextInput
          value={source}
          onChangeText={setSource}
          style={s.input}
          autoCapitalize="none"
          placeholder="founder_note"
          placeholderTextColor={COLORS.textLight}
        />

        <Label text="Raw Input *" />
        <TextInput
          value={rawInput}
          onChangeText={setRawInput}
          style={[s.input, s.multiline]}
          multiline
          placeholder="The note / observation / bug / question"
          placeholderTextColor={COLORS.textLight}
        />

        <Label text="Related Project (optional)" />
        <TextInput
          value={relatedProject}
          onChangeText={setRelatedProject}
          style={s.input}
          placeholder="donor trust update"
          placeholderTextColor={COLORS.textLight}
        />

        <Label text="Current Context (optional)" />
        <TextInput
          value={currentContext}
          onChangeText={setCurrentContext}
          style={[s.input, s.multiline]}
          multiline
          placeholder="e.g. beta week 2, ~20 donors active"
          placeholderTextColor={COLORS.textLight}
        />

        <Label text="Active Projects (comma separated)" />
        <TextInput
          value={activeProjects}
          onChangeText={setActiveProjects}
          style={s.input}
          placeholder="donor trust update,onboarding rewrite"
          placeholderTextColor={COLORS.textLight}
        />

        <Label text="Validation Notes (optional)" />
        <TextInput
          value={validationNotes}
          onChangeText={setValidationNotes}
          style={s.input}
          placeholder="anything already checked?"
          placeholderTextColor={COLORS.textLight}
        />

        <Label text="Open Issues (optional)" />
        <TextInput
          value={openIssues}
          onChangeText={setOpenIssues}
          style={s.input}
          placeholder="known blockers"
          placeholderTextColor={COLORS.textLight}
        />

        <View style={s.switchRow}>
          <Text style={s.switchLabel}>approved_for_planning (Triage mode only)</Text>
          <Switch
            value={approvedForPlanning}
            onValueChange={setApprovedForPlanning}
            trackColor={{ false: '#D9CDBC', true: COLORS.cocoSoft }}
            thumbColor={approvedForPlanning ? COLORS.coco : '#F0E4D3'}
          />
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.primaryBtn, loading && s.btnDisabled]}
            onPress={() => send('triage')}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Send triage request"
          >
            {loading && mode === 'triage'
              ? <ActivityIndicator color={COLORS.paper} />
              : <Text style={s.primaryBtnTxt}>Triage</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.primaryBtnAlt, loading && s.btnDisabled]}
            onPress={() => send('run')}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Send run request"
          >
            {loading && mode === 'run'
              ? <ActivityIndicator color={COLORS.paper} />
              : <Text style={s.primaryBtnTxt}>Run</Text>}
          </TouchableOpacity>
        </View>

        {card ? (
          <View style={s.cardBlock}>
            <Text style={s.cardTitle}>Envelope ({card.mode})</Text>

            {card.humanReview ? (
              <View style={s.reviewBanner}>
                <Text style={s.reviewTxt}>⚠ Human review required</Text>
              </View>
            ) : null}

            {workstreamUnknown ? (
              <View style={s.driftBanner}>
                <Text style={s.driftTxt}>
                  {`Workstream "${card.workstream}" not in Village taxonomy — drift signal.`}
                </Text>
              </View>
            ) : null}

            <Row k="category" v={card.category} />
            <Row k="workstream" v={card.workstream} />
            <Row k="owner" v={card.owner} />
            <Row k="route" v={card.route} />
            <Row k="risk" v={card.risk} />
            <Row k="summary" v={card.summary} wrap />
            <Row k="next_step" v={card.nextStep} wrap />
            {card.escalated ? (
              <Row
                k="escalation_reason"
                v={card.escalationReason ?? '(none given)'}
                wrap
              />
            ) : null}

            {raw?.ok === false ? (
              <View style={s.errorBanner}>
                <Text style={s.errorTxt}>
                  {raw.error ?? 'error'}: {raw.detail ?? ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {raw ? (
          <View style={s.pre}>
            <Text style={s.preLabel}>Raw response</Text>
            <Text style={s.preTxt}>{JSON.stringify(raw, null, 2)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={s.label}>{text}</Text>;
}

function Row({ k, v, wrap }: { k: string; v: string; wrap?: boolean }) {
  return (
    <View style={[s.row, wrap && s.rowWrap]}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, wrap && s.rowVWrap]} selectable>{v || '—'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  close: { fontSize: 22, color: COLORS.bark, width: 24 },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    color: COLORS.bark,
  },
  helpTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
    marginBottom: 12,
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.barkSoft,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.bark,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 4,
  },
  switchLabel: {
    flex: 1,
    marginRight: 12,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.coco,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnAlt: {
    flex: 1,
    backgroundColor: COLORS.sage,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.paper,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  btnDisabled: { opacity: 0.6 },
  secondaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  secondaryBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bark,
    fontSize: 12,
  },
  healthRow: { marginBottom: 12 },
  cardBlock: {
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.bark,
    marginBottom: 10,
  },
  reviewBanner: {
    backgroundColor: '#FBE7E1',
    borderColor: COLORS.cocoDeep,
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  reviewTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.cocoDeep,
    fontSize: 13,
  },
  driftBanner: {
    backgroundColor: '#FFF5DB',
    borderColor: COLORS.sand,
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  driftTxt: {
    fontFamily: FONTS.body,
    color: COLORS.barkSoft,
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: '#F7E0DC',
    borderColor: COLORS.cocoDeep,
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  errorTxt: {
    fontFamily: FONTS.body,
    color: COLORS.cocoDeep,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  rowWrap: { flexDirection: 'column' },
  rowK: {
    width: 110,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.barkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowV: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.bark,
  },
  rowVWrap: { marginTop: 2 },
  pre: {
    marginTop: 16,
    backgroundColor: '#43260F',
    padding: 12,
    borderRadius: 10,
  },
  preLabel: {
    fontFamily: FONTS.bodySemiBold,
    color: '#E6D8C4',
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  preTxt: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#E6D8C4',
    fontSize: 11,
  },
});
