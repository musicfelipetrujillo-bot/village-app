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
import { supabase } from '@/lib/supabase';
import {
  listTipsForReview, getReviewSummary, approveTipsWeek,
  CATEGORY_LABEL, type MomTipForReview, type MomTipReviewSummary, type MomTipCategory,
} from '@api/momTips';
import { COLORS, FONTS } from '@utils/constants';

interface RejectTarget {
  table: ReviewableSourceTable;
  id: string;
  title: string;
  /** Section-local refresh — mom tips keep their own list, not `rows`. */
  onDone?: () => void;
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

  // The Buzz — recently auto-cleared trending_items, flaggable back into review
  const [clearedRows, setClearedRows] = useState<
    { id: string; issue_id: string; kind: string; title_en: string; summary_en: string; trend_source_url: string; evidence_source_url: string; created_at: string }[]
  >([]);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [pending, clearedResult] = await Promise.all([
        clinicalReviewApi.listPending(),
        supabase.rpc('list_recent_agent_cleared_trending_items'),
      ]);
      if (clearedResult.error) throw clearedResult.error;
      setRows(pending);
      setClearedRows(clearedResult.data ?? []);
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
      rejectTarget.onDone?.();
      setRejectTarget(null);
      setRejectNotes('');
    } catch (e: any) {
      Alert.alert('Reject failed', e?.message ?? 'Unknown error');
    } finally {
      setRejecting(false);
    }
  }

  async function flagAsMedical(id: string) {
    setFlaggingId(id);
    try {
      await supabase.rpc('flag_trending_item_as_medical', { p_id: id, p_notes: 'flagged from recently-cleared list' });
      setClearedRows((cur) => cur.filter((r) => r.id !== id));
      await load(); // pulls the newly-in_review item into the main pending list
    } catch (e: any) {
      Alert.alert('Flag failed', e?.message ?? 'Unknown error');
    } finally {
      setFlaggingId(null);
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
        {/* FIRST, deliberately. The weekly-journey queue below is ~500 rows in
            a plain (non-virtualized) ScrollView, so anything appended after it
            is ~500 cards down the page and effectively invisible — which is
            exactly what happened when this section shipped at the bottom.
            Mom tips also has the stronger claim on the top slot: it is the one
            queue gating a feature that is dark in production. */}
        <MomTipsReview
          onReject={(tip, onDone) => {
            setRejectTarget({ table: 'mom_tips', id: tip.id, title: tip.title, onDone });
            setRejectNotes('');
          }}
        />

        {loading ? (
          <View style={s.loadingBlock}>
            <ActivityIndicator color={COLORS.coco} />
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

        {clearedRows.length > 0 ? (
          <View style={s.weekBlock}>
            <Text style={s.weekHeading}>Recently auto-cleared — The Buzz</Text>
            <Text style={s.helpTxt}>
              Non-medical items that auto-cleared without human review. Flag one if it actually touches a
              health/medical claim.
            </Text>
            {clearedRows.map((r) => (
              <View key={r.id} style={s.cardBlock}>
                <Text style={s.cardTitle} selectable>{r.title_en}</Text>
                <Text style={s.bodyTxt} selectable>{r.summary_en}</Text>
                <TouchableOpacity
                  style={[s.rejectBtn, flaggingId === r.id && s.btnDisabled]}
                  onPress={() => flagAsMedical(r.id)}
                  disabled={flaggingId === r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Flag ${r.title_en} as medical`}
                >
                  {flaggingId === r.id
                    ? <ActivityIndicator color={COLORS.cocoDeep} />
                    : <Text style={s.rejectBtnTxt}>🚩 Flag as medical</Text>}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
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
                  ? <ActivityIndicator color={COLORS.paper} />
                  : <Text style={s.primaryBtnTxt}>Reject</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Mom Tips — week-at-a-time review (migration 123) ─────────────────────
// Mom Tips ship 7 rows per baby-week × 53 weeks, all seeded 'draft'. They are
// reviewed here rather than in the main queue above: 371 rows dropped into an
// unpaginated `list_pending_review` would bury the Buzz + weekly-journey items
// that queue exists to turn around quickly.
//
// The approve action is scoped to ONE WEEK and sits BELOW the full text of all
// seven tips, so what gets approved is exactly what was read. There is no
// approve-everything action anywhere in this file, and rejection stays per row
// with mandatory notes.
function MomTipsReview({ onReject }: { onReject: (tip: MomTipForReview, onDone: () => void) => void }) {
  const [summary, setSummary] = useState<MomTipReviewSummary | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [tips, setTips] = useState<MomTipForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const sum = await getReviewSummary();
      setSummary(sum);
      // Open on the first week that still needs a decision, not on week 0.
      setWeek((cur) => (cur == null ? (sum?.next_week ?? 0) : cur));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load mom tips');
      setLoading(false);
    }
  }, []);

  const loadWeek = useCallback(async (w: number) => {
    setLoading(true);
    try {
      setTips(await listTipsForReview(w));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load mom tips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (week != null) loadWeek(week); }, [week, loadWeek]);

  const approveWeek = async () => {
    if (week == null) return;
    setBusy(true);
    try {
      const n = await approveTipsWeek(week);
      await Promise.all([loadWeek(week), loadSummary()]);
      Alert.alert(
        n > 0 ? `Week ${week} approved` : 'Nothing to approve',
        n > 0
          ? `${n} ${n === 1 ? 'tip is' : 'tips are'} now live in Mama's Corner.`
          : 'Every tip in this week already has a decision.',
      );
    } catch (e: any) {
      Alert.alert('Approve failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  if (err) {
    return (
      <View style={s.weekBlock}>
        <Text style={s.weekHeading}>Mom tips</Text>
        <Text style={s.helpTxt}>{err}</Text>
      </View>
    );
  }

  const undecided = tips.filter((t) => t.review_status !== 'approved' && t.review_status !== 'rejected');

  return (
    <View style={s.weekBlock}>
      <Text style={s.weekHeading}>Mom tips — Mama's Corner</Text>
      {summary ? (
        <Text style={s.helpTxt}>
          {summary.approved} of {summary.total} approved · {summary.pending} awaiting review
          {summary.rejected > 0 ? ` · ${summary.rejected} rejected` : ''}
          {summary.pending > 0 ? '' : ' — the screen is live for every week you have approved.'}
        </Text>
      ) : null}

      <View style={s.tipNav}>
        <TouchableOpacity
          style={s.tipNavBtn}
          onPress={() => setWeek((w) => Math.max(0, (w ?? 0) - 1))}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          <Text style={s.tipNavTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.tipNavWeek}>Week {week ?? 0}</Text>
        <TouchableOpacity
          style={s.tipNavBtn}
          onPress={() => setWeek((w) => Math.min(52, (w ?? 0) + 1))}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <Text style={s.tipNavTxt}>›</Text>
        </TouchableOpacity>
        {summary?.next_week != null && summary.next_week !== week ? (
          <TouchableOpacity
            style={s.tipJump}
            onPress={() => setWeek(summary.next_week)}
            accessibilityRole="button"
            accessibilityLabel={`Jump to week ${summary.next_week}, the next one needing review`}
          >
            <Text style={s.tipJumpTxt}>next unreviewed · wk {summary.next_week}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={s.loadingBlock}><ActivityIndicator color={COLORS.coco} /></View>
      ) : tips.length === 0 ? (
        <Text style={s.helpTxt}>No tips written for this week.</Text>
      ) : (
        <>
          {tips.map((t) => (
            <View key={t.id} style={s.cardBlock}>
              <View style={s.tipHead}>
                <Text style={s.tipMeta}>
                  Day {t.day_index + 1} · {CATEGORY_LABEL[t.category as MomTipCategory]?.en ?? t.category}
                  {t.locale !== 'en' ? ` · ${t.locale.toUpperCase()}` : ''}
                </Text>
                <Text style={[s.tipStatus, t.review_status === 'approved' && s.tipStatusOk, t.review_status === 'rejected' && s.tipStatusNo]}>
                  {t.review_status}
                </Text>
              </View>
              <Text style={s.cardTitle} selectable>{t.title}</Text>
              <Text style={s.bodyTxt} selectable>{t.body}</Text>
              {t.review_notes ? <Text style={s.helpTxt}>Notes: {t.review_notes}</Text> : null}
              {t.review_status !== 'rejected' ? (
                // `rejectBtn` carries flex:1 for the two-up action row above —
                // it needs a row parent here or it stretches.
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={s.rejectBtn}
                    onPress={() => onReject(t, () => { if (week != null) { loadWeek(week); loadSummary(); } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Reject ${t.title}`}
                  >
                    <Text style={s.rejectBtnTxt}>Reject this tip</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}

          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.approveBtn, (busy || undecided.length === 0) && s.btnDisabled]}
              onPress={approveWeek}
              disabled={busy || undecided.length === 0}
              accessibilityRole="button"
              accessibilityState={{ busy, disabled: busy || undecided.length === 0 }}
              accessibilityLabel={`Approve the ${undecided.length} remaining tips in week ${week ?? 0}`}
            >
              {busy
                ? <ActivityIndicator color={COLORS.cream} />
                : (
                  <Text style={s.approveBtnTxt}>
                    {undecided.length === 0
                      ? `Week ${week ?? 0} — all decided`
                      : `Approve week ${week ?? 0} · ${undecided.length} ${undecided.length === 1 ? 'tip' : 'tips'}`}
                  </Text>
                )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
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

      {row.source_table === 'trending_items' ? (
        <View style={s.buzzBlock}>
          <Text style={s.buzzLabel}>TREND SOURCE</Text>
          <Text style={s.buzzUrl} selectable numberOfLines={1}>{row.trend_source_url}</Text>
          <Text style={s.buzzLabel}>EVIDENCE SOURCE</Text>
          <Text style={s.buzzUrl} selectable numberOfLines={1}>{row.evidence_source_url}</Text>
          {row.myth_claim_en ? (
            <>
              <Text style={s.buzzLabel}>MYTH CLAIM</Text>
              <Text style={s.bodyTxt} selectable>{row.myth_claim_en}</Text>
              <Text style={s.buzzLabel}>FACT</Text>
              <Text style={s.bodyTxt} selectable>{row.fact_en}</Text>
            </>
          ) : null}
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
            ? <ActivityIndicator color={COLORS.paper} />
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
  close: { fontSize: 22, color: COLORS.bark, width: 24 },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    color: COLORS.bark,
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
    color: COLORS.barkSoft,
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
    color: COLORS.bark,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.barkSoft,
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
    color: COLORS.bark,
  },

  weekBlock: { marginTop: 16 },
  weekHeading: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.cocoDeep,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  cardBlock: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: COLORS.paper,
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
    backgroundColor: '#43260F',
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
    color: COLORS.barkSoft,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  aiBadge: {
    backgroundColor: '#FFF5DB',
    borderColor: COLORS.sand,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  aiBadgeTxt: {
    color: COLORS.barkSoft,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  seedBadge: {
    backgroundColor: COLORS.sage,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  seedBadgeTxt: {
    color: COLORS.paper,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  crisisBadge: {
    backgroundColor: '#FBE7E1',
    borderColor: COLORS.cocoDeep,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  crisisBadgeTxt: {
    color: COLORS.cocoDeep,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  essentialBadge: {
    backgroundColor: COLORS.coco,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  essentialBadgeTxt: {
    color: COLORS.paper,
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
    color: COLORS.bark,
    lineHeight: 22,
  },

  langLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.barkSoft,
    marginTop: 8,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.bark,
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
    color: COLORS.barkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ctaTxt: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.bark,
    marginTop: 2,
  },

  buzzBlock: {
    marginTop: 10,
    padding: 8,
    backgroundColor: COLORS.cream,
    borderRadius: 8,
    gap: 2,
  },
  buzzLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: COLORS.barkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  buzzUrl: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.coco,
  },

  statusRow: { marginTop: 8 },
  statusKv: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textLight,
  },
  statusVal: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.barkSoft,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  // ─ Mom tips week reviewer ─
  tipNav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4, flexWrap: 'wrap' },
  tipNavBtn: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.v2_parchment,
  },
  tipNavTxt: { fontFamily: FONTS.headerBold, fontSize: 18, color: COLORS.cocoDeep, marginTop: -2 },
  tipNavWeek: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.cocoDeep, minWidth: 66 },
  tipJump: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.v2_parchment,
  },
  tipJumpTxt: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.barkSoft },
  tipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  tipMeta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.barkSoft },
  tipStatus: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: COLORS.barkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  tipStatusOk: { color: COLORS.sage },
  tipStatusNo: { color: COLORS.rust },

  rejectBtn: {
    flex: 1,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.cocoDeep,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.cocoDeep,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: COLORS.sage,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  approveBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.paper,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  btnDisabled: { opacity: 0.6 },

  // Error states
  errorBanner: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F7E0DC',
    borderColor: COLORS.cocoDeep,
    borderWidth: 1,
    borderRadius: 10,
    gap: 10,
  },
  errorTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.cocoDeep,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.coco,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryBtnTxt: {
    color: COLORS.paper,
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
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 18,
    gap: 4,
  },
  modalTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    color: COLORS.bark,
  },
  modalSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.barkSoft,
    marginBottom: 6,
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.barkSoft,
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
    color: COLORS.bark,
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
    backgroundColor: COLORS.coco,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.paper,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondaryBtnTxt: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bark,
    fontSize: 13,
  },
});
