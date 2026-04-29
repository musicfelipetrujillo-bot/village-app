// Clinical-advisor Review Dashboard — INTERNAL-ONLY.
//
// Single screen that lists every maternal_insights / village_supports /
// week_checklists row where `clinical_advisor_reviewed=FALSE`, grouped by
// week. Reviewer taps Approve → row flips to approved + becomes public via
// existing RLS. Tap Reject → modal prompts for notes (required), row drops
// out of the feed but stays invisible to end users.
//
// Gating layers (in order):
//   1. EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED='1' — controls whether
//      RootNavigator even mounts this route. Production builds without the
//      flag don't include this file in the runtime tree.
//   2. `is_clinical_reviewer()` SECURITY DEFINER check inside every RPC —
//      currently locked to the seeded test user UUID.
//
// Reached via the hidden `ClinicalReview` modal route in RootNavigator
// (parallel to InternalAgents).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  clinicalReviewApi,
  type PendingReviewRow,
  type ReviewableSourceTable,
  sourceTableLabel,
  rowSource,
} from '@api/clinical-review';
import { COLORS, FONTS } from '@utils/constants';

interface RejectTarget {
  table: ReviewableSourceTable;
  id: string;
  title: string;
}

export default function ClinicalReviewScreen() {
  const navigation = useNavigation<any>();

  const [rows, setRows] = useState<PendingReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await clinicalReviewApi.listPending();
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load pending review queue.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── grouping ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const byWeek = new Map<number, PendingReviewRow[]>();
    for (const r of rows) {
      const arr = byWeek.get(r.week_number) ?? [];
      arr.push(r);
      byWeek.set(r.week_number, arr);
    }
    return Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const stats = useMemo(() => {
    const weeks = new Set(rows.map((r) => r.week_number));
    return { weekCount: weeks.size, rowCount: rows.length };
  }, [rows]);

  // ── approve / reject handlers ──────────────────────────────────────
  async function approve(row: PendingReviewRow) {
    setBusyRowId(row.row_id);
    try {
      await clinicalReviewApi.approve(row.source_table, row.row_id);
      // Optimistic remove — RPC succeeded, row should be off the feed now.
      setRows((cur) => cur.filter((r) => r.row_id !== row.row_id));
    } catch (e: any) {
      Alert.alert('Approve failed', e?.message ?? 'Unknown error');
    } finally {
      setBusyRowId(null);
    }
  }

  function openReject(row: PendingReviewRow) {
    setRejectTarget({
      table: row.source_table,
      id: row.row_id,
      title: row.title,
    });
    setRejectNotes('');
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (rejectNotes.trim().length < 3) {
      Alert.alert('Notes required', 'Please describe why this row is rejected (min 3 chars).');
      return;
    }
    setRejecting(true);
    try {
      await clinicalReviewApi.reject(
        rejectTarget.table,
        rejectTarget.id,
        rejectNotes.trim(),
      );
      setRows((cur) => cur.filter((r) => r.row_id !== rejectTarget.id));
      setRejectTarget(null);
      setRejectNotes('');
    } catch (e: any) {
      Alert.alert('Reject failed', e?.message ?? 'Unknown error');
    } finally {
      setRejecting(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.cream }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close clinical review dashboard"
        >
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
        <Text style={s.title}>Clinical Review</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={s.loadingBlock}>
            <ActivityIndicator color={COLORS.rust} />
            <Text style={s.helpTxt}>Loading pending content…</Text>
          </View>
        ) : error ? (
          <View style={s.errorBanner}>
            <Text style={s.errorTxt}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load}>
              <Text style={s.retryBtnTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : rows.length === 0 ? (
          <View style={s.emptyBlock}>
            <Text style={s.emptyEmoji}>✅</Text>
            <Text style={s.emptyTitle}>Inbox zero</Text>
            <Text style={s.emptyBody}>
              Every weekly-journey row has been clinical-advisor-reviewed.
              Pull down to refresh when the AI cron fills new weeks.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.statsBlock}>
              <Text style={s.statsTxt}>
                {stats.weekCount} {stats.weekCount === 1 ? 'week' : 'weeks'} pending
                {' · '}
                {stats.rowCount} {stats.rowCount === 1 ? 'row' : 'rows'} total
              </Text>
              <Text style={s.helpTxt}>
                Approving a row makes it visible to end users immediately.
                Rejecting keeps it private + records your notes.
              </Text>
            </View>

            {grouped.map(([week, weekRows]) => (
              <View key={week} style={s.weekBlock}>
                <Text style={s.weekHeading}>Week {week}</Text>
                {weekRows.map((row) => (
                  <ReviewCard
                    key={row.row_id}
                    row={row}
                    busy={busyRowId === row.row_id}
                    onApprove={() => approve(row)}
                    onReject={() => openReject(row)}
                  />
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Reject modal */}
      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="fade"
        onRequestClose={() => !rejecting && setRejectTarget(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reject content</Text>
            <Text style={s.modalSub} numberOfLines={2}>
              {rejectTarget?.title ?? ''}
            </Text>
            <Text style={s.label}>Reason (visible to AI re-gen prompt)</Text>
            <TextInput
              value={rejectNotes}
              onChangeText={setRejectNotes}
              multiline
              style={[s.input, s.multiline]}
              placeholder="e.g. body cites outdated AAP guidance"
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => setRejectTarget(null)}
                disabled={rejecting}
              >
                <Text style={s.secondaryBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, rejecting && s.btnDisabled]}
                onPress={confirmReject}
                disabled={rejecting}
              >
                {rejecting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={s.primaryBtnTxt}>Reject</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── card ────────────────────────────────────────────────────────────────
function ReviewCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: PendingReviewRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const source = rowSource(row);
  return (
    <View style={s.cardBlock}>
      <View style={s.badgeRow}>
        <View style={s.tableBadge}>
          <Text style={s.tableBadgeTxt}>{sourceTableLabel(row.source_table)}</Text>
        </View>
        <View style={s.categoryBadge}>
          <Text style={s.categoryBadgeTxt}>{row.category}</Text>
        </View>
        {source === 'ai' ? (
          <View style={s.aiBadge}>
            <Text style={s.aiBadgeTxt}>AI</Text>
          </View>
        ) : source === 'seed' ? (
          <View style={s.seedBadge}>
            <Text style={s.seedBadgeTxt}>Seed</Text>
          </View>
        ) : null}
        {row.requires_crisis_footer ? (
          <View style={s.crisisBadge}>
            <Text style={s.crisisBadgeTxt}>⚠ Crisis</Text>
          </View>
        ) : null}
        {row.is_essential === true ? (
          <View style={s.essentialBadge}>
            <Text style={s.essentialBadgeTxt}>Essential</Text>
          </View>
        ) : null}
      </View>

      <View style={s.titleRow}>
        {row.hero_emoji ? (
          <Text style={s.heroEmoji}>{row.hero_emoji}</Text>
        ) : null}
        <Text style={s.cardTitle} selectable>{row.title}</Text>
      </View>

      <Text style={s.langLabel}>EN</Text>
      <Text style={s.bodyTxt} selectable>{row.body_en}</Text>

      <Text style={s.langLabel}>ES</Text>
      <Text
        style={[s.bodyTxt, !row.body_es && s.bodyMissing]}
        selectable
      >
        {row.body_es ?? '— no Spanish translation seeded —'}
      </Text>

      {row.cta_label || row.cta_target ? (
        <View style={s.ctaRow}>
          <Text style={s.ctaLabel}>CTA</Text>
          <Text style={s.ctaTxt} selectable>
            {row.cta_label ?? '(no label)'} → {row.cta_target ?? '(no target)'}
          </Text>
        </View>
      ) : null}

      <View style={s.statusRow}>
        <Text style={s.statusKv}>
          status: <Text style={s.statusVal}>{row.review_status}</Text>
        </Text>
      </View>

      <View style={s.actionRow}>
        <TouchableOpacity
          style={[s.rejectBtn, busy && s.btnDisabled]}
          onPress={onReject}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Reject ${row.title}`}
        >
          <Text style={s.rejectBtnTxt}>✗ Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.approveBtn, busy && s.btnDisabled]}
          onPress={onApprove}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Approve ${row.title}`}
        >
          {busy
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={s.approveBtnTxt}>✓ Approve</Text>}
        </TouchableOpacity>
      </View>
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
  close: { fontSize: 22, color: COLORS.textDark, width: 24 },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    color: COLORS.textDark,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },

  loadingBlock: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 12,
  },
  helpTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMid,
  },

  emptyBlock: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 22,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMid,
    textAlign: 'center',
  },

  statsBlock: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 6,
  },
  statsTxt: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.textDark,
  },

  weekBlock: { marginTop: 16 },
  weekHeading: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.rustDark,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  cardBlock: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tableBadge: {
    backgroundColor: '#1C1008',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tableBadgeTxt: {
    color: '#E6D8C4',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  categoryBadge: {
    backgroundColor: '#F0E4D3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryBadgeTxt: {
    color: COLORS.brownMid,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  aiBadge: {
    backgroundColor: '#FFF5DB',
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  aiBadgeTxt: {
    color: COLORS.brownMid,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  seedBadge: {
    backgroundColor: COLORS.olive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  seedBadgeTxt: {
    color: COLORS.white,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  crisisBadge: {
    backgroundColor: '#FBE7E1',
    borderColor: COLORS.rustDark,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  crisisBadgeTxt: {
    color: COLORS.rustDark,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  essentialBadge: {
    backgroundColor: COLORS.rust,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  essentialBadgeTxt: {
    color: COLORS.white,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  heroEmoji: { fontSize: 22, marginTop: -2 },
  cardTitle: {
    flex: 1,
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 22,
  },

  langLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.textMid,
    marginTop: 8,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 19,
  },
  bodyMissing: {
    fontStyle: 'italic',
    color: COLORS.textLight,
  },

  ctaRow: {
    marginTop: 10,
    padding: 8,
    backgroundColor: COLORS.cream,
    borderRadius: 8,
  },
  ctaLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: COLORS.textMid,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ctaTxt: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDark,
    marginTop: 2,
  },

  statusRow: { marginTop: 8 },
  statusKv: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textLight,
  },
  statusVal: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.textMid,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.rustDark,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.rustDark,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: COLORS.olive,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  approveBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.white,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  btnDisabled: { opacity: 0.6 },

  // Error states
  errorBanner: {
    marginTop: 24,
    padding: 14,
    backgroundColor: '#F7E0DC',
    borderColor: COLORS.rustDark,
    borderWidth: 1,
    borderRadius: 10,
    gap: 10,
  },
  errorTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.rustDark,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.rust,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryBtnTxt: {
    color: COLORS.white,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },

  // Reject modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,16,8,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    gap: 4,
  },
  modalTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    color: COLORS.textDark,
  },
  modalSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMid,
    marginBottom: 6,
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.textMid,
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    minWidth: 110,
    backgroundColor: COLORS.rust,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.white,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondaryBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.textDark,
    fontSize: 13,
  },
});
