// V4 Phase G1 — Home API (baby profile + milestones + notifications feed)
// G7 extensions: daily_checkin + home_feed_cache + AI curator invocations.
import { supabase } from '@/lib/supabase';

export type Gender = 'female' | 'male' | 'nonbinary' | 'unknown';
export type FeedingMethod = 'breastfed' | 'formula' | 'combo' | 'pumped';
// V5 Playbook personalization prefs (migration 091). Values mirror the mobile
// PbSleep / PbFeed / PbSolids unions in ManualScrollV3.
export type PbSleepPref = 'cosleep' | 'training' | 'mixed';
export type PbFeedPref = 'breast' | 'formula' | 'mixed';
export type PbSolidsPref = 'notyet' | 'starting' | 'going';
export interface PlaybookPrefs {
  pb_sleep_pref?: PbSleepPref | null;
  pb_feed_pref?: PbFeedPref | null;
  pb_solids_pref?: PbSolidsPref | null;
}
export type MilestoneCategory =
  | 'motor' | 'social' | 'communication' | 'sleep' | 'feeding' | 'sensory' | 'cognitive';

export interface BabyProfile {
  id: string;
  user_id: string;
  baby_name: string | null;
  date_of_birth: string;     // YYYY-MM-DD
  due_date: string | null;
  gender: Gender | null;
  birth_weight_grams: number | null;
  is_premature: boolean;
  corrected_age_offset_days: number | null;
  feeding_method: FeedingMethod | null;
  current_week_number: number;
  pb_sleep_pref?: PbSleepPref | null;
  pb_feed_pref?: PbFeedPref | null;
  pb_solids_pref?: PbSolidsPref | null;
  created_at: string;
  updated_at: string;
}

export interface BabyProfileInput {
  baby_name?: string | null;
  date_of_birth: string;
  due_date?: string | null;
  gender?: Gender | null;
  birth_weight_grams?: number | null;
  is_premature?: boolean;
  corrected_age_offset_days?: number | null;
  feeding_method?: FeedingMethod | null;
}

export interface Milestone {
  id: string;
  week_number: number;
  category: MilestoneCategory;
  title: string;
  description: string;
  hero_emoji: string | null;
  sleep_hours_min: number | null;
  sleep_hours_max: number | null;
  feed_interval_hours_min: number | null;
  feed_interval_hours_max: number | null;
  ai_summary_cache: string | null;
}

export interface CurrentMilestone {
  week_number: number;
  category: MilestoneCategory;
  title: string;
  description: string;
  hero_emoji: string | null;
  baby_name: string | null;
}

export interface NotificationFeedItem {
  id: string;
  user_id: string;
  type: 'milestone_alert' | 'event_reminder' | 'deal_expiry' | 'gear_message' | 'daily_checkin' | 'new_match';
  title: string;
  body: string;
  deeplink: string | null;
  reference_id: string | null;
  reference_table: string | null;
  is_read: boolean;
  is_sent: boolean;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

export const homeApi = {
  async getMyBabyProfile(): Promise<BabyProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // Read from the view so `current_week_number` is computed at read time.
    const { data, error } = await supabase
      .from('baby_profiles_with_week')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    // The view (frozen `bp.*`) predates the 091 Playbook-pref columns, so merge
    // them via a small direct read of the base table (RLS owner-only protects it).
    const { data: prefs } = await supabase
      .from('baby_profiles')
      .select('pb_sleep_pref, pb_feed_pref, pb_solids_pref')
      .eq('user_id', user.id)
      .maybeSingle();
    return { ...(data as object), ...(prefs ?? {}) } as BabyProfile;
  },

  // V5 5.2 — persist the Playbook tune prefs (sleep/feed/solids). Pure UPDATE on
  // the caller's own row; no-op if they don't have a baby profile yet.
  async updateBabyPlaybookPrefs(prefs: PlaybookPrefs): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { error } = await supabase
      .from('baby_profiles')
      .update(prefs)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
  },

  async upsertBabyProfile(input: BabyProfileInput): Promise<BabyProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const payload = { ...input, user_id: user.id };
    // Write through the base table (views aren't writable), then re-read via view
    // so the caller gets the computed current_week_number.
    const { error: upErr } = await supabase
      .from('baby_profiles')
      .upsert(payload, { onConflict: 'user_id' });
    if (upErr) throw new Error(upErr.message);

    const { data, error } = await supabase
      .from('baby_profiles_with_week')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error) throw new Error(error.message);
    return data as BabyProfile;
  },

  async getMilestonesForWeek(week: number): Promise<Milestone[]> {
    const { data, error } = await supabase.rpc('get_milestones_for_week', { p_week: week });
    if (error) throw new Error(error.message);
    return (data ?? []) as Milestone[];
  },

  async getMyCurrentMilestone(): Promise<CurrentMilestone | null> {
    const { data, error } = await supabase.rpc('get_my_current_milestone');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CurrentMilestone[];
    return rows[0] ?? null;
  },

  async listMyNotifications(limit = 30): Promise<NotificationFeedItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('user_notifications_feed')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationFeedItem[];
  },

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_notifications_feed')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ── G7: Daily check-in ───────────────────────────────────────────────
  async getTodayCheckin(): Promise<DailyCheckin | null> {
    const { data, error } = await supabase.rpc('get_today_checkin');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as DailyCheckin[];
    return rows[0] ?? null;
  },

  // Last-N-days mood trend for the Insights screen. RLS (own-only) scopes rows.
  async getRecentCheckins(days = 7): Promise<{ checkin_date: string; mood_score: number }[]> {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('checkin_date, mood_score')
      .gte('checkin_date', since)
      .order('checkin_date', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as { checkin_date: string; mood_score: number }[];
  },

  async submitCheckin(input: CheckinInput): Promise<DailyCheckinWithReply> {
    // 1) Write the user-side row via RLS-protected RPC.
    const { data: upserted, error: upErr } = await supabase.rpc('upsert_daily_checkin', {
      p_mood_score: input.mood_score,
      p_energy_score: input.energy_score ?? null,
      p_user_response: input.user_response ?? null,
    });
    if (upErr) throw new Error(upErr.message);
    const rows = (upserted ?? []) as DailyCheckin[];
    const row = rows[0];
    if (!row) throw new Error('check-in upsert returned no row');

    // 2) Ask the AI responder. The Edge Function patches ai_reply + crisis_flagged
    //    directly onto the DB row, so we can re-read (or just merge the response).
    const { data: aiResp, error: aiErr } = await supabase.functions.invoke('ai-daily-checkin', {
      body: { checkin_id: row.id },
    });
    if (aiErr) {
      // Safety fallback — the Edge Function itself has a catch branch, but if the
      // invoke itself failed (network, cold start), we still return the user row.
      return {
        ...row,
        ai_reply: null,
        crisis_flagged: false,
        crisis_resources: null,
      };
    }
    const payload = (aiResp ?? {}) as {
      reply?: string | null; crisis?: boolean; crisis_resources?: CrisisResources | null;
    };
    return {
      ...row,
      ai_reply: payload.reply ?? null,
      crisis_flagged: Boolean(payload.crisis),
      crisis_resources: payload.crisis_resources ?? null,
    };
  },

  // ── G7: Home feed cache ──────────────────────────────────────────────
  async getHomeFeed(): Promise<HomeFeed | null> {
    const { data, error } = await supabase.rpc('get_home_feed');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as HomeFeed[];
    return rows[0] ?? null;
  },

  /** Trigger a server-side refresh for the current user. Returns the new count. */
  async refreshHomeFeed(): Promise<{ refreshed: number; cards?: number }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not signed in');
    const { data, error } = await supabase.functions.invoke('home-feed-curator', {
      body: { mode: 'single', user_id: auth.user.id },
    });
    if (error) throw new Error(error.message);
    return (data ?? { refreshed: 0 }) as { refreshed: number; cards?: number };
  },
};

// ── G7 types ─────────────────────────────────────────────────────────────
export interface DailyCheckin {
  id: string;
  user_id: string;
  checkin_date: string;               // YYYY-MM-DD
  mood_score: number;                 // 1..5
  energy_score: number | null;
  user_response: string | null;
  ai_reply: string | null;
  ai_reply_model: string | null;
  crisis_flagged: boolean;
  crisis_resources: CrisisResources | null;
  created_at: string;
  updated_at: string;
}

export interface DailyCheckinWithReply extends DailyCheckin {
  // Same as DailyCheckin but typed to communicate that ai_reply may be freshly
  // generated (vs. loaded from DB). Identical shape for now.
}

export interface CheckinInput {
  mood_score: number;                 // 1..5
  energy_score?: number | null;
  user_response?: string | null;
}

export type CrisisResourceKey = 'emergency' | 'mental_health' | 'postpartum' | 'crisis_text';
export type CrisisResources = Partial<Record<CrisisResourceKey, {
  name: string; description: string; phone?: string; sms?: string; sms_body?: string;
}>>;

export type HomeFeedCardBlock =
  | 'milestone' | 'checkin' | 'events' | 'perks' | 'gear_tip' | 'quickaccess';

export interface HomeFeedCard<P = Record<string, unknown>> {
  block: HomeFeedCardBlock;
  priority: number;
  payload: P;
}

export interface HomeFeed {
  cards: HomeFeedCard[];
  generated_at: string;
  expires_at: string;
  is_stale: boolean;
}

// Block-specific payload shapes used by HomeScreen renderers.
export interface MilestoneBlockPayload {
  week_number: number;
  title: string;
  description: string;
  hero_emoji: string | null;
  long_copy: string | null;
}
export interface CheckinBlockPayload {
  state: 'pending' | 'answered' | 'crisis';
  mood_score?: number;
  preview?: string;
}
export interface EventsBlockPayload {
  event_ids: string[];
  reasons: Record<string, string>;
}
export interface PerksBlockPayload {
  items: { deal_id: string; reason: string }[];
}
export interface GearTipBlockPayload {
  tip: string;
  category_hint: string | null;
}
export interface QuickAccessBlockPayload {
  items: { key: string; label: string; icon: string; deeplink: string }[];
}

// `labelKey` resolves to `checkin.mood{Rough,Meh,Ok,Good,Great}` via t() at
// render time so the chips flip on language toggle. `label` (English) is kept
// as a fallback for any non-i18n consumer (e.g. analytics or AI prompt).
export const MOOD_OPTIONS: { score: number; emoji: string; label: string; labelKey: string }[] = [
  { score: 1, emoji: '😞', label: 'Rough', labelKey: 'checkin.moodRough' },
  { score: 2, emoji: '😕', label: 'Meh',   labelKey: 'checkin.moodMeh' },
  { score: 3, emoji: '😐', label: 'OK',    labelKey: 'checkin.moodOk' },
  { score: 4, emoji: '🙂', label: 'Good',  labelKey: 'checkin.moodGood' },
  { score: 5, emoji: '😊', label: 'Great', labelKey: 'checkin.moodGreat' },
];

// Helpers (pure — no server deps)

/** Compute baby's current week locally as a fallback when current_week_number isn't available. 1..104 clamped. */
export function computeWeekNumber(dob: string, correctedOffsetDays = 0): number {
  const start = new Date(dob);
  start.setDate(start.getDate() + correctedOffsetDays);
  const days = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.min(104, Math.floor(days / 7) + 1));
}

// Hand-rolled localized age string. Kept here (not in i18n JSON dicts) because
// the ES forms branch on number agreement (1 día / N días, 1 mes / N meses,
// 1 año / N años) which is awkward to express via flat string templates.
// `lang` defaults to 'en' so existing call sites stay correct; Me + Home
// surfaces pass the user's preferred_language explicitly.
export function formatAge(dob: string, lang: 'en' | 'es' = 'en'): string {
  const start = new Date(dob);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  if (lang === 'es') {
    if (days < 14) return `${days} ${days === 1 ? 'día' : 'días'}`;
    if (months < 2) {
      const w = Math.floor(days / 7);
      return `${w} ${w === 1 ? 'semana' : 'semanas'}`;
    }
    if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    const years = Math.floor(months / 12);
    const rem = months - years * 12;
    if (rem === 0) return `${years} ${years === 1 ? 'año' : 'años'}`;
    return `${years} a ${rem} m`;
  }
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`;
  if (months < 2) return `${Math.floor(days / 7)} weeks old`;
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} old`;
  const years = Math.floor(months / 12);
  const rem = months - years * 12;
  return rem === 0 ? `${years} year${years === 1 ? '' : 's'} old` : `${years}y ${rem}mo old`;
}
