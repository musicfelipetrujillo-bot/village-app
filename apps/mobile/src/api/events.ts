// V4 Phase G2 — Events API (events + RSVPs + calendar handoff)
import { supabase } from '@/lib/supabase';
import { getPreferredRadiusKm } from '@store/user';

export type EventType = 'local' | 'webinar';
export type EventStatus = 'upcoming' | 'live' | 'ended' | 'cancelled';
export type WebinarPlatform = 'zoom' | 'youtube' | 'teams' | 'other';
export type RsvpStatus = 'going' | 'waitlist' | 'cancelled';
export type AgeTag = 'pregnancy' | '0-3mo' | '3-6mo' | '6-12mo' | '12mo+';

export interface EventCard {
  id: string;
  type: EventType;
  title: string;
  description: string;
  cover_image_url: string | null;
  host_name: string;
  host_avatar_url: string | null;
  is_partner: boolean;
  is_third_party: boolean;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number | null;
  age_tags: AgeTag[];
  venue_name: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  stream_url: string | null;
  platform: WebinarPlatform | null;
  is_free: boolean;
  price_cents: number | null;
  status: EventStatus;
  going_count: number;
}

export interface MyRsvpRow {
  rsvp_id: string;
  rsvp_status: RsvpStatus;
  added_to_calendar: boolean;
  rsvpd_at: string;
  event_id: string;
  type: EventType;
  title: string;
  cover_image_url: string | null;
  host_name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  stream_url: string | null;
  platform: WebinarPlatform | null;
  event_status: EventStatus;
}

export interface ListEventsParams {
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  type?: EventType | null;
  ageTags?: AgeTag[] | null;
}

export const eventsApi = {
  async listUpcoming(params: ListEventsParams = {}): Promise<EventCard[]> {
    const { lat = null, lng = null, radiusKm, type = null, ageTags = null } = params;
    // Fall back to the user's preferred radius (miles → km) when the caller
    // doesn't pass an explicit override.
    const effectiveRadiusKm = radiusKm ?? getPreferredRadiusKm();
    const { data, error } = await supabase.rpc('list_events_near', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: effectiveRadiusKm,
      p_type: type,
      p_age_tags: ageTags,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as EventCard[];
  },

  async getById(id: string): Promise<EventCard | null> {
    // Re-use the RPC: filter locally. A single-row fetch would need a second RPC;
    // this keeps the contract surface small and distance_km consistent.
    const { data, error } = await supabase
      .from('events')
      .select(`
        id, type, title, description, cover_image_url, host_name, host_avatar_url,
        is_partner, is_third_party, starts_at, ends_at, timezone, capacity, age_tags,
        venue_name, address, city, stream_url, platform, is_free, price_cents, status
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    // going_count via separate count query (no RPC for single-event aggregate yet).
    const { count } = await supabase
      .from('event_rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'going');

    return {
      ...(data as Omit<EventCard, 'lat' | 'lng' | 'distance_km' | 'going_count'>),
      lat: null,
      lng: null,
      distance_km: null,
      going_count: count ?? 0,
    } as EventCard;
  },

  async rsvp(eventId: string): Promise<{ status: RsvpStatus }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');

    // Upsert: re-RSVPing after a cancel flips status back to going (waitlist logic in trigger).
    const { data, error } = await supabase
      .from('event_rsvps')
      .upsert(
        { user_id: user.id, event_id: eventId, status: 'going', cancelled_at: null },
        { onConflict: 'user_id,event_id' },
      )
      .select('status')
      .single();
    if (error) throw new Error(error.message);
    return { status: data.status as RsvpStatus };
  },

  async cancelRsvp(eventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { error } = await supabase
      .from('event_rsvps')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
  },

  async markCalendarAdded(eventId: string, calendarEventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { error } = await supabase
      .from('event_rsvps')
      .update({ added_to_calendar: true, calendar_event_id: calendarEventId })
      .eq('user_id', user.id)
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
  },

  async getMyRsvpForEvent(eventId: string): Promise<{ status: RsvpStatus; added_to_calendar: boolean } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('status, added_to_calendar')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { status: RsvpStatus; added_to_calendar: boolean } | null) ?? null;
  },

  async listMyRsvps(past = false): Promise<MyRsvpRow[]> {
    const { data, error } = await supabase.rpc('list_my_rsvps', { p_past: past });
    if (error) throw new Error(error.message);
    return (data ?? []) as MyRsvpRow[];
  },
};

// Pure helpers
export function formatEventWhen(starts_at: string, ends_at: string, timezone?: string): string {
  const s = new Date(starts_at);
  const e = new Date(ends_at);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: timezone,
  };
  const dateStr = s.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone });
  const startTime = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  const endTime = e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  void opts;
  return `${dateStr} · ${startTime} – ${endTime}`;
}

export function formatDistance(km: number | null): string {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

/** Human-readable countdown label. Used on webinar screens. */
export function timeUntilLabel(starts_at: string): string {
  const diffMs = new Date(starts_at).getTime() - Date.now();
  if (diffMs <= 0) return 'Live now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Starts in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Starts in ${days}d`;
}
