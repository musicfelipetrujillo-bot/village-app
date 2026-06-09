// V4 — Manual video library + per-user watch progress (migration 055).
// The Manual surface is a short-video browser (Mux-hosted, ≤2 min, EN+ES
// captions). Two RPCs feed the UI: list_manual_videos for the per-tile
// browse grid and list_this_week_manual for the curated 4-thumbnail row
// on Manual home. mark_video_watched upserts watch progress (90% of
// duration_seconds completes the video and is sticky once set).
//
// The legacy completion ledger from migration 049 (get_manual_progress /
// mark_manual_item_complete) was for the article-era "today's reading"
// 4-row checklist that no longer ships — the wrappers are removed here so
// callers can't re-introduce the dead path. The migration table itself
// stays on disk (not dropped) since it carries no data dependency.
import { supabase } from '@/lib/supabase';

// One (audience, category) bucket maps to one tile. The 10 valid pairs are
// CHECK-enforced in the DB; mismatched calls return an empty list.
export type ManualAudience = 'mom' | 'baby';
export type MomCategory   = 'feel' | 'heal'  | 'nourish' | 'rest' | 'tips';
export type BabyCategory  = 'feed' | 'sleep' | 'grow'    | 'care' | 'tips';

export interface ManualVideo {
  id: string;
  title: string;
  description: string;
  duration_seconds: number;
  mux_playback_id: string | null;
  // Self-hosted animated HTML clip (Claude Design export). When set, the
  // player loads this URL in the WebView instead of the Mux player.
  html_url: string | null;
  thumbnail_url: string;
  poster_url: string | null;
  has_captions_en: boolean;
  has_captions_es: boolean;
  week_relevance: number | null;
  age_min_weeks: number | null;
  age_max_weeks: number | null;
  sort_order: number;
  is_watched: boolean;
  watched_seconds: number;
  is_saved: boolean;
}

// SavedManualScreen reuses the same card UI as the per-category browse, but
// the row joins manual_video_saves so we also know audience+category (the
// browse RPC only returns rows inside one bucket already, so it doesn't need
// these) plus saved_at for sort/empty-state copy.
export interface SavedManualVideo {
  id: string;
  audience: ManualAudience;
  category: string;
  title: string;
  description: string;
  duration_seconds: number;
  mux_playback_id: string;
  thumbnail_url: string;
  poster_url: string | null;
  has_captions_en: boolean;
  has_captions_es: boolean;
  week_relevance: number | null;
  age_min_weeks: number | null;
  age_max_weeks: number | null;
  is_watched: boolean;
  watched_seconds: number;
  saved_at: string;
}

// Allowlist of share destinations. iOS doesn't tell us which app the user
// picks from the native share sheet — those land as 'ios_share_sheet'. The
// named channels exist for future deep-link share intents (a "Share to
// Instagram" button that uses Instagram's URL scheme directly) where we
// CAN attribute precisely. Keep the union in sync with the CHECK constraint
// on manual_video_shares.channel.
export type ManualShareChannel =
  | 'ios_share_sheet'
  | 'android_share_sheet'
  | 'copy_link'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'sms'
  | 'email'
  | 'whatsapp'
  | 'other';

export interface ManualVideoTile {
  // Compact card for the "this week" row on Manual home — no description,
  // no captions metadata, no resume position. Tapping routes through to
  // ManualVideoScreen which fetches the full row by id.
  id: string;
  audience: ManualAudience;
  category: string;
  title: string;
  duration_seconds: number;
  thumbnail_url: string;
  is_watched: boolean;
}

// Mux HLS URL helper. Approved videos use public playback IDs so the URL
// can be constructed client-side; signed playback (when wired) will require
// a token-issuing edge function — the URL shape stays the same.
export function muxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

// Mux's hosted player — full HTML5 video chrome incl. captions/quality menus.
// We render this inside a WebView until the native expo-video build lands
// (Stripe/Xcode 26 incompatibility currently blocks the dev-client rebuild),
// so the Manual surface ships now and gets pixel-precise watch tracking
// later. autoplay=true + playsInline keeps iOS from punting to fullscreen.
export function muxPlayerUrl(playbackId: string, opts?: {
  autoplay?: boolean;
  poster?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts?.autoplay) params.set('autoplay', 'true');
  if (opts?.poster) params.set('poster', opts.poster);
  const qs = params.toString();
  return `https://player.mux.com/${playbackId}${qs ? `?${qs}` : ''}`;
}

// Self-hosted manual-video origin. HTML clips + their poster thumbnails are
// stored in the DB as relative paths (`/manual-videos/...`); we prepend this
// origin at read time so the same rows work in dev (localhost) and prod (the
// deployed village website). Absolute URLs (Mux/Pexels) pass through untouched.
export const MANUAL_VIDEO_ORIGIN =
  process.env.EXPO_PUBLIC_MANUAL_VIDEO_ORIGIN ?? 'http://localhost:8090';

function absManualUrl<T extends string | null | undefined>(u: T): T {
  if (typeof u === 'string' && u.startsWith('/manual-videos')) {
    return `${MANUAL_VIDEO_ORIGIN}${u}` as T;
  }
  return u;
}

// Format duration as "M:SS" for the badge on each thumbnail.
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export async function listManualVideos(
  audience: ManualAudience,
  category: string,
  locale: 'en' | 'es' = 'en',
): Promise<ManualVideo[]> {
  const { data, error } = await supabase.rpc('list_manual_videos', {
    p_audience: audience,
    p_category: category,
    p_locale:   locale,
  });
  if (error) throw error;
  return (data ?? []).map((v: ManualVideo) => ({
    ...v,
    html_url: absManualUrl(v.html_url),
    thumbnail_url: absManualUrl(v.thumbnail_url),
  })) as ManualVideo[];
}

// ── Manual pieces (Phase 4.5, migration 072) ──────────────────────────────
//
// Article / illustration / checklist content for the ManualScrollV3 inline
// piece stream. Video pieces stay in `manual_videos` (Mux-specific
// metadata) — the mobile screen merges the two at render time, with video
// always first per the handoff cadence.
//
// LIFECYCLE: the manual_pieces table ships empty in migration 072.
// `ManualScrollV3` keeps a hand-authored PIECES_BY_CHAPTER constant as
// the fallback when listManualPieces returns []. As clinical-advisor
// authoring lands, INSERT migrations populate buckets and the fallback
// gracefully gets superseded — bucket-by-bucket rollout, no flag day.

export type ManualPieceKind = 'article' | 'illustration' | 'checklist';

export interface ManualPiece {
  id:         string;
  kind:       ManualPieceKind;
  num:        string;
  title:      string;
  dur:        string | null;     // article only
  excerpt:    string | null;     // article only
  caption:    string | null;     // illustration only
  steps:      string[] | null;   // checklist only
  sort_order: number;
}

export async function listManualPieces(
  audience: ManualAudience,
  category: string,
  locale: 'en' | 'es' = 'en',
): Promise<ManualPiece[]> {
  const { data, error } = await supabase.rpc('list_manual_pieces', {
    p_audience: audience,
    p_category: category,
    p_locale:   locale,
  });
  if (error) {
    console.warn('listManualPieces failed', error.message);
    return [];   // bucket-missing / RLS-fail → fall back to hand-authored
  }
  return (data ?? []) as ManualPiece[];
}

export async function listThisWeekManual(
  week: number,
  locale: 'en' | 'es' = 'en',
): Promise<ManualVideoTile[]> {
  const { data, error } = await supabase.rpc('list_this_week_manual', {
    p_week:   week,
    p_locale: locale,
  });
  if (error) throw error;
  return (data ?? []).map((t: ManualVideoTile) => ({
    ...t,
    thumbnail_url: absManualUrl(t.thumbnail_url),
  })) as ManualVideoTile[];
}

// Fetch one video by id (used by ManualVideoScreen on mount). The list RPC
// already returns everything we need, so we just call it for the bucket and
// pluck the matching row — saves a separate RPC + RLS surface.
export async function getManualVideo(
  audience: ManualAudience,
  category: string,
  videoId: string,
  locale: 'en' | 'es' = 'en',
): Promise<ManualVideo | null> {
  const list = await listManualVideos(audience, category, locale);
  return list.find((v) => v.id === videoId) ?? null;
}

// Persist watch progress. Caller passes the max watched position seen so
// far; the DB clamps to GREATEST(stored, incoming) so out-of-order calls
// never decrement. Crossing 90% sets completed_at (sticky).
export async function markVideoWatched(
  videoId: string,
  seconds: number,
): Promise<void> {
  const { error } = await supabase.rpc('mark_video_watched', {
    p_video_id: videoId,
    p_seconds:  Math.max(0, Math.floor(seconds)),
  });
  if (error) throw error;
}

// Saves / Favorites (migration 065).
//
// Returns the new saved state. Mobile flips the heart on the returned value
// (true = now saved, false = now unsaved) so we don't need a refetch.
export async function toggleManualSave(videoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_manual_save', {
    p_video_id: videoId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function listMySavedManual(
  locale: 'en' | 'es' = 'en',
): Promise<SavedManualVideo[]> {
  const { data, error } = await supabase.rpc('list_my_saved_manual', {
    p_locale: locale,
  });
  if (error) throw error;
  return (data ?? []) as SavedManualVideo[];
}

// Share log. Fire-and-forget on the client — a swallowed error never blocks
// the share itself. Migration 065 enforces the channel allowlist; calling
// with a bad string surfaces as a CHECK violation, not silently no-ops.
export async function logManualShare(
  videoId: string,
  channel: ManualShareChannel,
): Promise<void> {
  const { error } = await supabase.rpc('log_manual_share', {
    p_video_id: videoId,
    p_channel:  channel,
  });
  if (error) {
    // Don't bubble — this is analytics; a failure shouldn't block the user.
    // Sentry breadcrumb is still fired by the calling screen via useAnalytics.
    console.warn('log_manual_share failed', error.message);
  }
}

// Public-facing share URL for a Manual video.
//
// Points at the manual-og Supabase edge function (not villieapp.com/m/
// directly) so social-media crawlers — Twitter, FB, Slack, Discord,
// iMessage — get per-video OG previews (real thumbnail + title) instead
// of the generic wordmark the static marketing page would serve.
//
// What the edge function does:
//   - Crawler User-Agent → returns server-rendered HTML with per-video
//     og:title / og:description / og:image
//   - Real user → 302-redirects to villieapp.com/m/?v=<id> (the static
//     interactive landing page), so the user-facing experience is
//     unchanged. UTM params are preserved across the redirect.
//
// The villieapp.com landing page is still the canonical user destination;
// the edge function URL is invisible to users (visible only in the
// initial share-text payload and then to crawlers).
export function manualVideoShareUrl(videoId: string): string {
  return `https://albyndcruwopulazvpjs.supabase.co/functions/v1/manual-og?v=${videoId}`;
}
