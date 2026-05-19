// V4 G2 — Event Review Dashboard — INTERNAL-ONLY.
//
// Mirrors ClinicalReviewScreen but for the AI-screened ingest queue (Pass 2
// of self-sustaining events). Lists every events row where review_status =
// 'pending' (i.e. AI screen returned mid-confidence and a human needs to
// triage). Reviewer taps Approve → row flips to 'approved' + becomes public
// via the existing `events_public_read` RLS policy. Tap Reject → modal
// prompts for notes (required, min 3 chars), row flips to 'rejected' and
// stays out of all public RPCs.
//
// Gating:
//   1. `users.is_event_reviewer = TRUE` — controls whether RootNavigator
//      mounts the launcher pill + modal route.
//   2. `is_event_reviewer()` SECURITY DEFINER check inside every RPC
//      (migration 046) — server-side enforcement.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform, RefreshControl, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  eventReviewApi,
  type PendingEventRow,
  confidenceLabel,
  confidencePercent,
} from '@api/event-review';
import { formatEventWhen } from '@api/events';
import { COLORS, FONTS } from '@utils/constants';

interface RejectTarget {
  id: string;
  title: string;
}

export default function EventReviewScreen() {
  const navigation = useNavigation<any>();

  const [rows, setRows] = useState<PendingEventRow[]>([]);
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
      const data = await eventReviewApi.listPending();
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load pending event queue.');
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

  // Group by confidence band so reviewers can fast-path the easy ones first
  // (high → likely auto-approve-with-glance; low → likely reject; medium →
  // careful read).
  const grouped = useMemo(() => {
    const buckets: Record<string, PendingEventRow[]> = {
      high: [],
      medium: [],
      low: [],
      unscreened: [],
    };
    for (const r of rows) {
      buckets[confidenceLabel(r.ingestion_confidence)].push(r);
    }
    return [
      ['high', buckets.high],
      ['medium', buckets.medium],
      ['low', buckets.low],
      ['unscreened', buckets.unscreened],
    ] as const;
  }, [rows]);

  const stats = useMemo(() => ({ total: rows.length }), [rows]);

  // ── approve / reject handlers ──────────────────────────────────────
  async function approve(row: PendingEventRow) {
    setBusyRowId(row.id);
    try {
      // Pass through AI-suggested age tags as the default — reviewer trusts
      // Haiku unless they edited them. (Editing UI is a future polish; for
      // now: suggested → applied verbatim, no edit.)
      await eventReviewApi.approve(row.id, {
        ageTags: row.suggested_age_tags ?? undefined,
      });
      setRows((cur) => cur.filter((r) => r.id !== row.id));
    } catch (e: any) {
      Alert.alert('Approve failed', e?.message ?? 'Unknown error');
    } finally {
      setBusyRowId(null);
    }
  }

  function openReject(row: PendingEventRow) {
    setRejectTarget({ id: row.id, title: row.title });
    setRejectNotes('');
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (rejectNotes.trim().length < 3) {
      Alert.alert(
        'Notes required',
        'Please describe why this event is rejected (min 3 chars).',
      );
      return;
    }
    setRejecting(true);
    try {
      await eventReviewApi.reject(rejectTarget.id, rejectNotes.trim());
      setRows((cur) => cur.filter((r) => r.id !== rejectTarget.id));
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
          accessibilityLabel="Close event review dashboard"
        >
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
        <Text style={s.title}>Event Review</Text>
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
            <ActivityIndicator color={COLORS.coco} />
            <Text style={s.helpTxt}>Loading pending events…</Text>
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
              Every ingested event has been triaged. Pull down to refresh
              after the next ICS sync (09:00 UTC) or AI screen sweep
              (09:30 UTC).
            </Text>
          </View>
        ) : (
          <>
            <View style={s.statsBlock}>
              <Text style={s.statsTxt}>
                {stats.total} {stats.total === 1 ? 'event' : 'events'} pending
              </Text>
              <Text style={s.helpTxt}>
                Approve makes the event public immediately via the events RLS
                policy. Reject keeps it hidden and records your notes for the
                AI re-tune feedback loop.
              </Text>
            </View>

            {grouped.map(([band, bandRows]) =>
              bandRows.length === 0 ? null : (
                <View key={band} style={s.bandBlock}>
                  <Text style={s.bandHeading}>
                    {band} confidence · {bandRows.length}
                  </Text>
                  {bandRows.map((row) => (
                    <EventCard
                      key={row.id}
                      row={row}
                      busy={busyRowId === row.id}
                      onApprove={() => approve(row)}
                      onReject={() => openReject(row)}
                    />
                  ))}
                </View>
              ),
            )}
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
            <Text style={s.modalTitle}>Reject event</Text>
            <Text style={s.modalSub} numberOfLines={2}>
              {rejectTarget?.title ?? ''}
            </Text>
            <Text style={s.label}>Reason (helps tune the AI screen)</Text>
            <TextInput
              value={rejectNotes}
              onChangeText={setRejectNotes}
              multiline
              style={[s.input, s.multiline]}
              placeholder="e.g. not maternal-health relevant — adult fitness class"
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

// ─── card ────────────────────────────────────────────────────────────────
function EventCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: PendingEventRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const conf = confidenceLabel(row.ingestion_confidence);
  return (
    <View style={s.cardBlock}>
      <View style={s.badgeRow}>
        <View style={[s.typeBadge, row.type === 'webinar' && s.webinarBadge]}>
          <Text style={s.typeBadgeTxt}>{row.type}</Text>
        </View>
        <View style={[s.confBadge, confStyle(conf)]}>
          <Text style={s.confBadgeTxt}>
            {conf} · {confidencePercent(row.ingestion_confidence)}
          </Text>
        </View>
        {row.is_partner ? (
          <View style={s.partnerBadge}>
            <Text style={s.partnerBadgeTxt}>Partner</Text>
          </View>
        ) : null}
        {row.is_third_party ? (
          <View style={s.thirdPartyBadge}>
            <Text style={s.thirdPartyBadgeTxt}>3rd-party</Text>
          </View>
        ) : null}
      </View>

      <Text style={s.cardTitle} selectable>{row.title}</Text>

      <Text style={s.metaTxt}>
        {formatEventWhen(row.starts_at, row.ends_at)}
      </Text>

      {row.type === 'local' ? (
        <Text style={s.metaTxt}>
          {row.venue_name ?? '(no venue)'}
          {row.city ? ` · ${row.city}` : ''}
        </Text>
      ) : row.stream_url ? (
        <TouchableOpacity onPress={() => Linking.openURL(row.stream_url!)}>
          <Text style={[s.metaTxt, s.linkTxt]} numberOfLines={1}>
            {row.stream_url}
          </Text>
        </TouchableOpacity>
      ) : null}

      <Text style={s.metaTxt}>
        Hosted by {row.host_name}
        {row.source_partner_name ? ` · feed: ${row.source_partner_name}` : ''}
      </Text>

      <Text style={s.langLabel}>Description</Text>
      <Text style={s.bodyTxt} selectable numberOfLines={6}>
        {row.description}
      </Text>

      {row.ingestion_notes ? (
        <View style={s.aiNotesRow}>
          <Text style={s.aiNotesLabel}>AI notes</Text>
          <Text style={s.aiNotesTxt} selectable>{row.ingestion_notes}</Text>
        </View>
      ) : null}

      <View style={s.tagsRow}>
        <Text style={s.tagsLabel}>Suggested age tags:</Text>
        {(row.suggested_age_tags ?? []).length === 0 ? (
          <Text style={s.tagsEmpty}>none</Text>
        ) : (
          (row.suggested_age_tags ?? []).map((t) => (
            <View key={t} style={s.tagPill}>
              <Text style={s.tagPillTxt}>{t}</Text>
            </View>
          ))
        )}
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

function confStyle(c: string) {
  switch (c) {
    case 'high':   return { backgroundColor: '#E2EBD2', borderColor: COLORS.sage };
    case 'medium': return { backgroundColor: '#FFF5DB', borderColor: COLORS.sand };
    case 'low':    return { backgroundColor: '#F7E0DC', borderColor: COLORS.cocoDeep };
    default:       return { backgroundColor: COLORS.cream, borderColor: 'rgba(0,0,0,0.12)' };
  }
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

  loadingBlock: { paddingTop: 80, alignItems: 'center', gap: 12 },
  helpTxt: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.barkSoft },

  emptyBlock: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 24 },
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

  statsBlock: { paddingTop: 16, paddingBottom: 8, gap: 6 },
  statsTxt: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.bark,
  },

  bandBlock: { marginTop: 16 },
  bandHeading: {
    fontFamily: FONTS.headerBold,
    fontSize: 14,
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
  typeBadge: {
    backgroundColor: '#1C1008',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  webinarBadge: { backgroundColor: COLORS.barkSoft },
  typeBadgeTxt: {
    color: '#E6D8C4',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  confBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  confBadgeTxt: {
    color: COLORS.barkSoft,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  partnerBadge: {
    backgroundColor: COLORS.sage,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  partnerBadgeTxt: {
    color: COLORS.paper,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  thirdPartyBadge: {
    backgroundColor: '#F0E4D3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  thirdPartyBadgeTxt: {
    color: COLORS.barkSoft,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },

  cardTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    color: COLORS.bark,
    lineHeight: 22,
    marginBottom: 6,
  },
  metaTxt: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.barkSoft,
    marginBottom: 2,
  },
  linkTxt: {
    color: COLORS.cocoDeep,
    textDecorationLine: 'underline',
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

  aiNotesRow: {
    marginTop: 10,
    padding: 8,
    backgroundColor: COLORS.cream,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.sand,
  },
  aiNotesLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: COLORS.barkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  aiNotesTxt: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.bark,
    lineHeight: 17,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  tagsLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.barkSoft,
  },
  tagsEmpty: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  tagPill: {
    backgroundColor: '#F0E4D3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagPillTxt: {
    color: COLORS.barkSoft,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
