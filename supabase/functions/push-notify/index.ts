// Edge Function: push-notify
// Internal helper — sends OneSignal push notifications
// POST /functions/v1/push-notify
// Body: { user_id?, external_ids?: string[], title: string, body: string,
//         data?: object, url?: string,
//         pref_key?: NotifPrefKey, respect_quiet_hours?: boolean,
//         bypass_prefs?: boolean }
// Called by: appointment-reminder, admin-approve-specialist, new message events
// Auth: service role only
//
// A2.b defense-in-depth: callers may pass `pref_key` to have this function
// filter recipients against `users.notif_prefs[pref_key]` BEFORE the OneSignal
// fan-out. This is a secondary gate — the primary gate still lives in each
// caller (so it can early-exit before AI/SMS spend). The central gate makes
// it impossible for a future caller to forget to respect prefs.
//
// `respect_quiet_hours` defaults to TRUE whenever pref_key is given (any
// pref-gated surface is a non-urgent nudge). Crisis/transactional callers
// (admin-approve-specialist, room-message-scan moderator alerts) MUST set
// `bypass_prefs: true` to skip both gates entirely.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isQuietHoursActive } from '../_shared/quiet-hours.ts';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mirror of `apps/mobile/src/store/user.ts::NotifPrefKey` — keep in sync with
// migration 032/033. Listed here explicitly so a typo doesn't silently bypass
// the gate via an unknown JSONB key.
const VALID_PREF_KEYS = [
  'events',
  'groups',
  'specialists',
  'milk_hub',
  'articles',
  'ai',
  'promotions',
] as const;
type NotifPrefKey = typeof VALID_PREF_KEYS[number];

interface PushPayload {
  // Target: one of these must be provided
  user_id?: string;           // Maps to OneSignal external_id (set on device registration)
  external_ids?: string[];    // Multiple users
  player_ids?: string[];      // Specific device tokens (fallback)

  // Content
  title: string;
  body: string;
  data?: Record<string, unknown>; // Deep-link data passed to app
  url?: string;                   // Deep link URL

  // A2.b central pref gate
  pref_key?: NotifPrefKey;
  respect_quiet_hours?: boolean;  // defaults to true when pref_key is set
  bypass_prefs?: boolean;         // crisis/transactional override
}

// Returns the subset of `candidateIds` whose users.notif_prefs[pref_key] !== false
// AND (when respect_quiet_hours) are not currently inside their quiet window.
// Defaults to opt-IN when the key is missing on a row, so legacy users without
// notif_prefs get notifications until they explicitly opt out.
async function filterByPrefs(
  candidateIds: string[],
  pref_key: NotifPrefKey,
  respectQuietHours: boolean,
): Promise<string[]> {
  if (candidateIds.length === 0) return [];
  const { data: rows } = await supabase
    .from('users')
    .select('id, notif_prefs')
    .in('id', candidateIds);
  return (rows ?? [])
    .filter((u: { notif_prefs: Record<string, unknown> | null }) => {
      const prefs = u.notif_prefs ?? {};
      if ((prefs as Record<string, unknown>)[pref_key] === false) return false;
      if (respectQuietHours && isQuietHoursActive(prefs as { quiet_hours?: unknown })) {
        return false;
      }
      return true;
    })
    .map((u: { id: string }) => u.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const payload = await req.json() as PushPayload;

    if (!payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Validate pref_key against the allowlist. An unknown key would otherwise
    // silently no-op the gate (every row reads `undefined !== false`).
    if (payload.pref_key && !VALID_PREF_KEYS.includes(payload.pref_key)) {
      return new Response(JSON.stringify({ error: `unknown pref_key: ${payload.pref_key}` }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Resolve the candidate external_ids list. player_ids bypass user-level
    // filtering entirely (they target a specific device, not a user account).
    let externalIds: string[] | undefined;
    if (payload.external_ids?.length) {
      externalIds = payload.external_ids;
    } else if (payload.user_id) {
      externalIds = [payload.user_id];
    }

    // Apply central pref gate when pref_key is supplied and bypass isn't set.
    // player_ids skip this — there's no user_id to look up.
    let filtered = 0;
    if (externalIds && payload.pref_key && !payload.bypass_prefs) {
      const respectQuietHours = payload.respect_quiet_hours !== false;
      const before = externalIds.length;
      externalIds = await filterByPrefs(externalIds, payload.pref_key, respectQuietHours);
      filtered = before - externalIds.length;
      if (externalIds.length === 0) {
        // All recipients opted out / in quiet hours. Not an error — the surface
        // worked, the audience just collapsed to zero.
        return new Response(
          JSON.stringify({ skipped: true, reason: 'all_filtered', filtered }),
          { headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Build OneSignal notification object
    const notification: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: payload.title },
      contents: { en: payload.body },
      ios_sound: 'default',
      android_sound: 'default',
      android_channel_id: 'village-general',
    };

    if (payload.data) notification.data = payload.data;
    if (payload.url) notification.url = payload.url;

    // Target selection (priority order)
    if (externalIds?.length) {
      notification.include_external_user_ids = externalIds;
    } else if (payload.player_ids?.length) {
      notification.include_player_ids = payload.player_ids;
    } else {
      return new Response(JSON.stringify({ error: 'No notification target specified' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notification),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.errors?.join(', ') ?? 'OneSignal error');
    }

    return new Response(
      JSON.stringify({ id: result.id, recipients: result.recipients, filtered }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
