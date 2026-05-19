# V4 Gear · Takedown Response SOP

> **Purpose**: define exactly who is on the hook for the 24-hour review
> promise the app makes inside `ReportListingModal`, what they do when a
> report lands, and what happens if they miss the window.
>
> **Status**: draft. Owner name + backup + paging channel still TBD.
> Approve / fill in those fields, then this becomes the live playbook.
>
> **Why this exists**: production app copy promises every reporter
> "A moderator reviews every report within 24 hours." An unkept public
> promise is FDUTPA-actionable on its own, independent of whether the
> underlying complaint was valid. A documented, followed SOP is the
> defense.

---

## 1 · Promises in the app today

Verbatim, from `apps/mobile/src/components/gear/ReportListingModal.tsx`:

| Surface | Copy |
|---|---|
| Modal body | "Help us keep Villie safe. A moderator reviews every report within 24 hours. The seller will not be told who reported them." |
| Post-submit alert | "A Village moderator will review this listing within 24 hours. You will not be notified of the outcome, but we may take the listing down without warning the seller." |

Two commitments are made:

1. **Review within 24 hours.** This is the SLA.
2. **Reporter anonymity from the seller.** Operationally enforceable (we never include `reporter_user_id` in any seller-facing surface).

The reporter is explicitly told they will **not** be notified of the
outcome. That simplifies the SOP — no reporter-facing follow-up is owed.

---

## 2 · Severity tiers

The 8 reason codes from `gear_listing_reports.reason_code` map to three
severity tiers. The 24-hour figure in the in-app copy is the **P1**
window; P0 reports get tighter treatment internally.

| Tier | SLA | Reason codes | Why this tier |
|---|---|---|---|
| **P0** | **4 hours** | `recalled_item`, `harassment_or_abuse` | CPSC §19 exposure + Section 230 / safety exposure |
| **P1** | **24 hours** (the published SLA) | `prohibited_category`, `counterfeit_or_fake`, `damaged_or_unsafe` | Material safety / consumer-protection concerns |
| **P2** | 48 hours (internal target only — no public promise) | `misleading_description`, `price_or_scam`, `other` | Quality of marketplace, lower legal exposure |

Reporting clocks start at `gear_listing_reports.created_at`.

---

## 3 · Roles

**Current state (transitional, pre-ops-hire)** — both moderator slots
sit with the founder + co-founder. Per the recommendation in the
attorney handoff doc, personal contact details are kept out of this
file; they live in the private contacts vault (1Password / Notion).

| Role | Owner | Responsibility |
|---|---|---|
| **Primary moderator** | Founder (Felipe) — alias `moderator@villieapp.com` (route to founder inbox + push) | Reviews the queue twice daily, owns P0 paging. |
| **Backup moderator** | Co-founder (founder's partner) — alias `moderator-backup@villieapp.com` (route to partner inbox + push) | Covers PTO, weekends, and overflow. |
| **Escalation contact** | Counsel (TBD — engagement pending per attorney handoff doc) + founder | Receives anything that triggers legal exposure or threatens to. Until counsel is engaged, the founder owns escalation by default. |

**Transitional constraints worth naming explicitly:**

- **Single-household coverage**: primary + backup share a residence and
  often a schedule. For P0 at 03:00 ET this is fine (one phone wakes
  both). For a 2-week joint PTO, coverage breaks. Either don't take
  joint PTO during the launch window, or hand-off the on-call to a
  third human (counsel, advisor, contractor) for the gap.
- **Bus factor of one effective person**: if both founders are
  unreachable, the SLA fails. This is acceptable risk pre-launch but
  is **not** acceptable at meaningful user volume. Trigger to revisit:
  >100 active gear listings OR first paying hospital partner.
- **No legal counsel in escalation chain yet**: until counsel is
  engaged (open item in `V4_GEAR_ATTORNEY_HANDOFF.md`), genuine legal
  exposure events have nowhere to escalate to. P0 events with legal
  surface area (e.g., a credible CSAM report, a threat-of-violence
  message) should be reported directly to law enforcement via 911 /
  the local non-emergency line, with the founder documenting
  the timeline in `admin_audit_log` for the eventual counsel review.

**Hard rule**: the role pair `primary + backup` must cover **24/7**
for P0 severities. P1 + P2 can be business-hours queue work.

**Pre-launch deliverables before this section is enforceable:**

- [ ] `moderator@villieapp.com` and `moderator-backup@villieapp.com` email aliases configured (forwarding to founder + partner respectively).
- [ ] OneSignal push channel verified on both founders' personal devices.
- [ ] 1Password / Notion entry created with phone numbers + real email behind the aliases (label: "Villie · Moderator on-call").

---

## 4 · How reports reach the moderator

Three surfacing channels, layered by severity:

1. **Real-time pager** (P0 only)
   - Webhook fired on `gear_listing_reports` INSERT when `reason_code IN ('recalled_item', 'harassment_or_abuse')`.
   - Routes to PagerDuty / OneSignal push to the primary's phone.
   - Backup is paged if primary doesn't ack within 30 min.
   - _Implementation: trigger + edge fn, not yet built. See §10 to-do._

2. **Daily digest email** (all tiers)
   - 09:00 ET cron writes a digest to the moderator inbox: every report opened in the last 24h + every report still `under_review` past its SLA window.
   - Reuses `admin-compliance-events` edge fn output.

3. **Studio saved query** (ad-hoc)
   - Bookmark: `SELECT id, listing_id, reason_code, description, status, created_at FROM gear_listing_reports WHERE status IN ('open', 'under_review') ORDER BY created_at ASC;`
   - Used for manual sweeps and when the daily digest fails.

The primary moderator's day starts by clearing the digest email.

---

## 5 · The review pipeline

The DB already has the four-status pipeline. The SOP names what each
transition means in practice.

```
  open ──claim──▶ under_review ──action──▶ resolved
                                       ╲
                                        ╲──no action──▶ dismissed
```

| Transition | When | Who | Audit-log entry |
|---|---|---|---|
| `open → under_review` | Moderator opens the report and starts investigating. Must happen within the SLA. | Primary / backup | `gear_report_claimed` |
| `under_review → resolved` | Action taken: listing withdrawn, seller account flagged, message thread escalated, etc. The "what was done" is required in the audit log. | Primary / backup | `gear_report_resolved` (with `action_taken` field) |
| `under_review → dismissed` | No action. Either the report was incorrect or the listing was already in compliance. Reasoning required. | Primary / backup | `gear_report_dismissed` (with `reason` field) |

Every transition writes a row to `admin_audit_log` with
`{ report_id, listing_id, reason_code, prior_status, new_status, action_taken_or_dismissal_reason, moderator_user_id }`. **No silent
status changes.** The audit log is the FDUTPA defense file.

---

## 6 · Per-reason decision tree

What the moderator does once they open a report, by `reason_code`.

### `recalled_item` (P0 · 4 hours)

1. Pull the listing from `get_gear_listing(listing_id)`.
2. Check `cpsc_recall_status`:
   - `'recalled'` → listing is already auto-withdrawn (migration 023 trigger handled it). Confirm and `resolved`. No further action needed; CPSC compliance is automated.
   - `'clear'` or `'unknown'` → run `gear-cpsc-check` edge fn manually with the listing's UPC and brand+title. Re-check status.
3. If new status comes back `'recalled'`, auto-withdraw fires → `resolved`.
4. If still `'clear'` after manual recheck, **dismiss with reasoning** in the audit log. Reporter was wrong — that's fine, the SOP defended the user.

### `harassment_or_abuse` (P0 · 4 hours)

1. Open the relevant `gear_message_threads` row for `listing_id` + the seller. The thread is participant-RLS so the moderator must use the service-role admin view (`admin-compliance-events` already exposes this).
2. Read the message history. Look for: threats, slurs, sexual content directed at a user, doxxing, repeated contact after "stop" was sent.
3. Three possible resolutions:
   - **Confirmed abuse** → suspend reported user account (service-role UPDATE on `users.deleted_at` flag, or a softer `users.is_suspended` if/when that column exists). Withdraw all their active listings. Audit-log it.
   - **Threat of physical harm or minor involved** → escalate to escalation contact + law enforcement (911 or local non-emergency line). Document the timestamp of escalation.
   - **No abuse confirmed** → dismiss with reasoning. Do not message either party.

### `prohibited_category` (P1 · 24 hours)

1. Check `gear_listings.category` against the migration 012 allowlist (no `car_seat`, `breast_pump`, `sleep_positioner`, `inclined_sleeper`, `helmet`).
2. If category is on the allowlist but the **title / description / photos** describe a prohibited item that slipped past the picker (e.g., listed as `toy` but is actually a `breast_pump`):
   - Withdraw the listing (`listing_status = 'withdrawn'`, `removed_reason = 'prohibited_after_review'`).
   - Send the seller the template in §7.
   - Apply a 7-day cooldown before that seller can post a new listing (manual flag in `admin_audit_log` for now; future column).
3. If the listing is legitimately on the allowlist, dismiss.

### `counterfeit_or_fake` (P1 · 24 hours)

The moderator usually cannot verify counterfeit status from photos alone.
Default posture is to act on **patterns**, not single reports.

1. Look up the seller's other listings: `SELECT * FROM gear_listings WHERE seller_user_id = ? AND listing_status != 'withdrawn'`.
2. Count active reports across all their listings.
3. If **≥2 separate reporters** have filed `counterfeit_or_fake` against this seller, withdraw all flagged listings and suspend the seller account pending verification (seller emails proof of purchase / receipt).
4. If single report, dismiss with reasoning. Note in audit log so the next report compounds.

### `damaged_or_unsafe` (P1 · 24 hours)

1. Review listing photos + description.
2. If photos confirm a hazard (cracked frame, mold, missing safety part, expired by-date on consumables): withdraw, notify seller via §7 template.
3. If ambiguous, dismiss. Reporter was free to walk away from the meet.

### `misleading_description` (P2 · 48h internal target)

1. Compare listing copy to photos. Look for material misrepresentation (brand claimed but not visible, condition graded "Excellent" when photos show clear wear, capacity / weight figures invented).
2. **Material** misrepresentation → withdraw + §7 template.
3. **Minor** misrepresentation (color slightly off, year off by one) → dismiss.

### `price_or_scam` (P2 · 48h internal target)

1. Check seller account age (`users.created_at`).
2. Check whether they have any completed milk or gear transactions or specialist bookings as a credibility signal.
3. New account (<7 days) + multiple listings + reported for scam → suspend pending verification.
4. Established account + single report → dismiss.

### `other` (P2 · 48h internal target)

1. Read the free-text `description` field.
2. Route to whichever category from above fits best, follow that branch.
3. If nothing fits, dismiss.

---

## 7 · Response templates

Reporters are told upfront they won't get a response — no template needed
for them. Sellers get one of three system messages when an action is
taken against their listing.

All templates ship EN + ES because the user's `preferred_language`
governs delivery.

### Template A — Listing withdrawn (CPSC recall)

**EN**: "We've withdrawn your listing because the item matches an active CPSC recall ({{recall_number}}). Recalled items can't be resold on Villie under federal law (CPSIA §19). Details: {{recall_url}}. This isn't a strike on your account."

**ES**: "Retiramos tu anuncio porque el artículo coincide con un retiro activo de la CPSC ({{recall_number}}). Por ley federal (CPSIA §19), los artículos retirados no pueden revenderse en Villie. Detalles: {{recall_url}}. Esto no afecta tu cuenta."

### Template B — Listing withdrawn (prohibited category / safety / misrepresentation)

**EN**: "We've withdrawn your listing after a moderator review. Reason: {{reason_short}}. Our Gear Marketplace Addendum (in your account → Account & security) explains the categories we don't allow and the listing standards we follow. You can list other items at any time."

**ES**: "Retiramos tu anuncio tras la revisión de un moderador. Razón: {{reason_short}}. El Adendo del Intercambio de Artículos (en tu cuenta → Cuenta y seguridad) explica las categorías no permitidas y los estándares que seguimos. Puedes publicar otros artículos cuando quieras."

`reason_short` is one of: "matches a category we don't allow",
"photos show a safety hazard", "description didn't match the photos",
"signs of counterfeit goods", "pattern of reports across your account".

### Template C — Account suspended pending verification

**EN**: "Your Villie seller account is paused while we look into a report. Reply to this message with proof of purchase (receipt, original packaging photo, or original listing screenshot) for the items you've listed. We'll restore your account within 3 business days of receiving documentation."

**ES**: "Tu cuenta de vendedor en Villie está en pausa mientras revisamos un reporte. Responde a este mensaje con comprobante de compra (recibo, foto del empaque original, o captura del anuncio original) de los artículos que publicaste. Restauraremos tu cuenta dentro de 3 días hábiles después de recibir la documentación."

All three templates are delivered as `system` messages inside the
existing `gear_messages` thread tied to the affected listing, so the
seller sees them in-app.

---

## 8 · Failure-mode posture (most important section)

What happens if the moderator misses the SLA. **This is what makes the
24-hour promise legally defensible.**

### P0 missed (no `under_review` claim within 4 hours)

- The listing is **auto-withdrawn** by a Postgres-side trigger. Better to over-withdraw and reinstate later than to leave a recalled / abusive listing live.
- The seller receives Template A (recall) or Template B (other P0) automatically.
- The report status flips to `under_review` with `auto_escalated = true` flag; primary + backup are both paged.
- This is the only auto-action defensible without human review — CPSC §19 makes it federally compelling for recalls, and harassment is safety-tier.

### P1 missed (no `under_review` claim within 24 hours)

- The report is **not** auto-actioned. P1 reasons aren't safe to auto-withdraw without human review (false-positive risk).
- Instead, an `auto_acknowledged_at` timestamp is written and an internal alert fires to the escalation contact.
- This buys defensible time: we have not silently dropped the report.
- The moderator must clear it within the next 24 hours or the escalation contact takes it over.

### P2 missed

- Internal alert only. No legal exposure beyond marketplace quality.

### What gets logged either way

Every SLA miss writes a row to `admin_audit_log` with
`{ event: 'gear_report_sla_missed', tier, report_id, time_since_created }`.
This is part of the FDUTPA defense file: we did not silently ignore
reports; we have a timestamped record of every missed deadline and the
escalation that followed.

---

## 9 · Coverage cadence

| Window | Coverage |
|---|---|
| **Weekdays 09:00–18:00 ET** | Primary on the queue. Acks all reports in the daily digest before noon. |
| **Weekdays 18:00–09:00 ET** | Backup on call for P0 only. P1/P2 reports wait until morning. |
| **Weekends + holidays** | Backup primary on call for P0 only. P1 + P2 acked by Monday 12:00 ET. |
| **PTO** | Primary notifies Felipe 7+ days in advance. Backup becomes acting primary for the window. |

Both humans must have the OneSignal push channel enabled on a personal
device. Phone-off-for-the-night is fine for P1+; P0 will wake them.

---

## 10 · Implementation to-do (pre-launch)

Code that needs to land before this SOP is enforceable:

- [x] **P0 real-time pager** — Shipped 2026-05-19 (commit `92f564c`). `gear-moderation-pager` edge fn pulls overdue P0 reports via the `sweep_p0_overdue_reports()` RPC and fans out OneSignal push to `GEAR_MODERATOR_EXTERNAL_IDS`. GH Action cron fires every 5 minutes.
- [x] **SLA-miss auto-withdraw for P0** — Shipped 2026-05-19 (commit `92f564c`). `auto_withdraw_p0_overdue_listings()` RPC + `gear-moderation-auto-withdraw` edge wrapper. GH Action cron fires every 15 minutes. Withdraws the listing, writes `admin_audit_log`, posts system message to the seller's existing thread.
- [x] **Daily digest email** — Shipped 2026-05-19. `gear-moderation-daily-digest` edge fn fires daily at 13:00 UTC (09:00 ET). Sends an HTML email via Resend to `GEAR_MODERATOR_DIGEST_EMAILS` recipients with P0-overdue, open queue, and auto-actioned-in-last-24h sections. Quiet days send a zero-state email by default so missing emails are a real signal (cron broke, not "nothing happened"); pass `send_when_empty:false` if you'd rather have silence.
- [x] **`auto_escalated` + `auto_acknowledged_at` columns** on `gear_listing_reports` — Migration 063.
- [x] **`admin_audit_log` schema confirmation** — Verified 2026-05-19. The existing `metadata` JSONB column accommodates `action_taken` and `dismissal_reason` fields without schema changes; we just write them into metadata on each row.
- [x] **System-message dispatch helper** — Shipped 2026-05-19. `gear-takedown-template-dispatch` edge fn writes `message_type='system'` rows into `gear_messages` for a given listing's thread. Supports Templates A (CPSC recall), B (generic withdrawal, 5 reason_short values), C (account suspension). EN + ES copy. Service-role-gated; the moderator's `actor_user_id` is recorded in `admin_audit_log`.
- [ ] **Optional**: `gear_seller_cooldowns` table for the 7-day reposting ban after a `prohibited_category` strike. Not blocking launch.

**Pre-launch env / secrets to set in Supabase Edge Function secrets:**
- `GEAR_MODERATOR_EXTERNAL_IDS` — comma-separated Supabase user IDs (founder + co-founder per §3)
- `RESEND_API_KEY` — Resend API key from https://resend.com
- `GEAR_MODERATOR_DIGEST_EMAILS` — comma-separated recipient addresses (`moderator@villieapp.com`, `moderator-backup@villieapp.com`)
- `GEAR_MODERATOR_DIGEST_FROM` (optional) — defaults to `Villie Moderation <noreply@villieapp.com>`; must be on a verified Resend domain

Once those secrets are set, the SOP is fully automated end-to-end.

---

## 11 · Onboarding from zero

A new moderator should read, in order:

1. This SOP (you're reading it).
2. `docs/V4_GEAR_ATTORNEY_HANDOFF.md` for the legal posture context.
3. `docs/source/Village_Risk_and_Compliance.md` §2.1 (CPSC) — the source of truth for the marketplace's compliance commitments.
4. CPSC SaferProducts.gov — where recalled-item reports get cross-referenced.
5. FTC marketplace guidance on Section 230 + FDUTPA.

They should shadow the primary for at least 5 P1/P2 reports before
taking the queue solo. P0 reports they observe only until 10+ resolutions
under supervision.

---

## 12 · Open items for counsel review before this SOP goes live

- **Auto-withdraw on P0 miss** (§8). Is the trigger-based auto-action without human review acceptable for recalled-item reports? CPSC §19 suggests yes; counsel should confirm for `harassment_or_abuse` specifically.
- **Reporter-anonymity language** (§1). The modal says "the seller will not be told who reported them." Confirm we're under no subpoena-style obligation to surface the reporter even on legal request without a court order.
- **Suspension without notice** (§6 `counterfeit_or_fake`, `price_or_scam`). Suspending an account pending verification is standard marketplace practice; confirm we have the right under our Gear Marketplace Addendum once the real Addendum text lands.
- **7-day reposting ban** (§6 `prohibited_category`). Confirm acceptable; otherwise replace with a warning + automatic re-screen on next post.

---

## Cross-references

- `/Users/gp/.claude/projects/-Users-gp-The-Village-App/memory/project_gear_takedown_sla_unassigned.md` — the memory entry this SOP closes out.
- `docs/V4_GEAR_ATTORNEY_HANDOFF.md` — the legal-posture brief.
- `supabase/migrations/024_v4_gear_messaging.sql` — schema for `gear_listing_reports`, `gear_message_threads`, `gear_messages`.
- `apps/mobile/src/components/gear/ReportListingModal.tsx` — the in-app surface that makes the 24-hour promise.
- `apps/mobile/src/api/gear.ts` — `GearReportReason` type + `gearReportReasonLabel`.
- `supabase/functions/admin-compliance-events/index.ts` — admin viewer for both gear + milk analytics events.
