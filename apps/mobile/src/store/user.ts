import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Sentry } from '@/lib/sentry';
import {
  DEFAULT_SEARCH_RADIUS_MILES,
  MILES_TO_KM,
} from '@utils/constants';

// Sentry context tag for triage segmentation. Stage + language are NOT PII —
// they're inferable from joining a stage room or switching languages, and
// they're the most useful filters when triaging a crash report. Wrapped in
// try/catch so a Sentry hiccup never breaks the app.
function tagSentryProfileContext(profile: { pregnancy_stage: string | null; preferred_language: 'en' | 'es' } | null) {
  try {
    Sentry?.setContext?.('user_meta', profile ? {
      pregnancy_stage: profile.pregnancy_stage ?? 'unknown',
      preferred_language: profile.preferred_language,
    } : null);
  } catch {
    // Telemetry must never break the app.
  }
}

// Keys must mirror migration 032 default jsonb and the UX spec §Settings.
// Transactional/safety surfaces (crisis moderator SMS, specialist admin
// approval) are NEVER gated on these — they bypass `notif_prefs` entirely.
export type NotifPrefKey =
  | 'events'
  | 'groups'
  | 'specialists'
  | 'milk_hub'
  | 'articles'
  | 'ai'
  | 'promotions'
  // Weekly Sunday newsletter (migration 067). Default OFF per CAN-SPAM;
  // users opt in via NotificationPreferencesScreen.
  | 'newsletter'
  // The Buzz weekly trending-topics digest (migration 105).
  | 'trending'
  // "Baby's week" milestone nudges + dormant winback (migration 111).
  // Default ON — content about her own baby is the core loop, not marketing.
  | 'baby_week';

// Shape must mirror `supabase/functions/_shared/quiet-hours.ts::QuietHours`
// and the JSONB default in migration 033. Timezone is an IANA string — set
// on first edit from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
export interface QuietHours {
  enabled: boolean;
  start_hour: number; // inclusive, 0..23
  end_hour: number;   // exclusive, 0..23
  tz: string;
}

export type NotifPrefs = Record<NotifPrefKey, boolean> & {
  quiet_hours: QuietHours;
};

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start_hour: 22,
  end_hour: 7,
  tz: 'America/New_York',
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  events: true,
  groups: true,
  specialists: true,
  milk_hub: true,
  articles: true,
  ai: true,
  promotions: false,
  newsletter: false,
  trending: true,
  baby_week: true,
  quiet_hours: DEFAULT_QUIET_HOURS,
};

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  pregnancy_stage: string | null;
  due_date: string | null;
  preferred_language: 'en' | 'es';
  insurance_provider: string | null;
  zip_code: string | null;
  search_radius_miles: number;
  notif_prefs: NotifPrefs;
  // V3 C3 — per-user opt-in for anonymous community mode (migration 069).
  // When true, every new room join auto-generates an anonymous identity.
  // The Connect tab is hidden by product decision; this flag is foundation
  // work that activates when Community ships.
  anonymous_mode_default: boolean;
  // Internal flag — TRUE for users authorized to approve/reject AI-generated
  // weekly-journey content via the Clinical Review dashboard. Server-side the
  // `is_clinical_reviewer()` SECURITY DEFINER helper (migration 043) reads
  // the same column; this client-side mirror is what gates UI surfaces
  // (RootNavigator launcher pill + Me-screen entry-point). Toggle in DB:
  //   UPDATE users SET is_clinical_reviewer = TRUE WHERE email = '…';
  is_clinical_reviewer: boolean;
  // Internal flag — TRUE for ops staff who curate AI-screened event ingest
  // candidates. Distinct from is_clinical_reviewer (medical content).
  // Server-side `is_event_reviewer()` (migration 046) gates the RPCs;
  // this mirror gates the Me-screen entry-point. Toggle in DB:
  //   UPDATE users SET is_event_reviewer = TRUE WHERE email = '…';
  is_event_reviewer: boolean;
  // villie pro entitlement (migration 110) — written ONLY by the
  // revenuecat-webhook edge function. This mirror is the fallback source for
  // lib/pro.ts isProUser(); the live source is RevenueCat CustomerInfo.
  is_pro: boolean;
}

export interface ZipCoords { lat: number; lng: number; zip: string }

interface UserState {
  profile: UserProfile | null;
  // Centroid of the user's stated ZIP, resolved once per session. This is the
  // location fallback when GPS is denied — before it existed, every "near me"
  // surface silently used hardcoded Miami coords (see devLocation.ts).
  zipCoords: ZipCoords | null;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: () => Promise<void>;
  resolveZipCoords: () => Promise<void>;
}

// The profile row in `public.users` is only written to the store at the end of
// OnboardingProfileScreen. On cold launch (already-onboarded user), nothing
// else populates it — that's the bug that made Home greet "friend" instead of
// the real name. `fetchProfile` reads the row for the current auth user; it's
// safe to call on every Home mount (RLS scopes it to the owner).
export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  zipCoords: null,
  setProfile: (profile) => {
    tagSentryProfileContext(profile);
    // Drop a stale centroid when the ZIP changes (or the user signs out), so
    // "near me" can never keep pointing at a previous address.
    const prevZip = get().zipCoords?.zip;
    const nextZip = normalizeZip(profile?.zip_code);
    set({ profile, ...(prevZip && prevZip !== nextZip ? { zipCoords: null } : {}) });
  },
  fetchProfile: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, avatar_url, pregnancy_stage, due_date, preferred_language, insurance_provider, zip_code, search_radius_miles, notif_prefs, anonymous_mode_default, is_clinical_reviewer, is_event_reviewer, is_pro')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (error || !data) return;
    // Merge with defaults so a newer client pref key added post-migration
    // doesn't read as `undefined` against a row written by an older client.
    // quiet_hours is a nested object — merge it separately so a partial DB
    // value (e.g., only `enabled` flipped) doesn't drop the other fields.
    const rawPrefs = (data as UserProfile).notif_prefs ?? {};
    const rawQh = (rawPrefs as Partial<NotifPrefs>).quiet_hours ?? {};
    const merged: UserProfile = {
      ...(data as UserProfile),
      // Defensively coerce — older rows or RLS-stripped responses might miss
      // the column. Default to FALSE (least-privileged), matching the
      // server-side helper's COALESCE behavior.
      is_clinical_reviewer: (data as UserProfile).is_clinical_reviewer === true,
      is_event_reviewer: (data as UserProfile).is_event_reviewer === true,
      notif_prefs: {
        ...DEFAULT_NOTIF_PREFS,
        ...rawPrefs,
        quiet_hours: { ...DEFAULT_QUIET_HOURS, ...rawQh },
      },
    };
    set({ profile: merged });
    // Fire-and-forget: warms the ZIP fallback so a later GPS denial has
    // something better than hardcoded Miami to fall back to.
    void get().resolveZipCoords();
  },

  // Resolves users.zip_code → centroid via the geocode-zip edge function
  // (cache-first server-side, so this costs a Google lookup at most once per
  // ZIP ever). Silent on failure by design — the caller's own default still
  // applies, and a missing centroid must never block a screen from loading.
  resolveZipCoords: async () => {
    const zip = normalizeZip(get().profile?.zip_code);
    if (!zip) return;
    if (get().zipCoords?.zip === zip) return; // already resolved this session
    try {
      const { data, error } = await supabase.functions.invoke('geocode-zip', { body: { zip } });
      if (error) return;
      const lat = (data as any)?.lat;
      const lng = (data as any)?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        set({ zipCoords: { lat, lng, zip } });
      }
    } catch {
      /* offline or function down — fallback chain handles it */
    }
  },
}));

// "33133-1234" / " 33133 " → "33133"; anything shorter than 5 digits → null.
function normalizeZip(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

// Synchronous read of the resolved ZIP centroid, for the location helper.
export function getZipCoords(): ZipCoords | null {
  return useUserStore.getState().zipCoords;
}

// Read the current user's preferred search radius without subscribing. Used
// by the API layer (specialists/milk/events/gear) as the fallback when a caller
// doesn't explicitly pass `radiusMiles`. Falls back to `DEFAULT_SEARCH_RADIUS_MILES`
// when the profile hasn't hydrated yet (cold start, pre-login).
export function getPreferredRadiusMiles(): number {
  const profile = useUserStore.getState().profile;
  return profile?.search_radius_miles ?? DEFAULT_SEARCH_RADIUS_MILES;
}

// Same, but in kilometers — for RPCs that accept `p_radius_km` (events, gear).
export function getPreferredRadiusKm(): number {
  return Math.round(getPreferredRadiusMiles() * MILES_TO_KM);
}

// Synchronous read of the caller's notification prefs. Edge-function call
// sites should query the DB directly (the JWT scopes them via RLS) — this
// helper is for in-app UI (the settings screen). Falls back to defaults
// when the profile hasn't hydrated.
export function getNotifPrefs(): NotifPrefs {
  const profile = useUserStore.getState().profile;
  return profile?.notif_prefs ?? DEFAULT_NOTIF_PREFS;
}

// Synchronous reviewer check — used by RootNavigator + MeScreen to decide
// whether to show the Clinical Review dashboard launcher and queue entry.
// The server-side RPC re-checks via SECURITY DEFINER, so a tampered client
// can't actually approve/reject — this helper is purely a UX gate.
export function isClinicalReviewer(): boolean {
  return useUserStore.getState().profile?.is_clinical_reviewer === true;
}

// Same shape as isClinicalReviewer but for the event-ingest review queue.
// Distinct DB column so the two roles can be granted independently.
export function isEventReviewer(): boolean {
  return useUserStore.getState().profile?.is_event_reviewer === true;
}
