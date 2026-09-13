// V4 Phase G2 — Events store (upcoming feed + my RSVPs)
import { create } from 'zustand';
import { eventsApi, type EventCard, type MyRsvpRow, type ListEventsParams } from '@api/events';

interface EventsState {
  upcoming: EventCard[];
  myRsvps: MyRsvpRow[];
  pastRsvps: MyRsvpRow[];
  savedIds: Set<string>;
  savedEvents: EventCard[];
  loading: boolean;
  loadedAt: number | null;
  /**
   * Set when the last upcoming-events fetch failed. Load-bearing: without it
   * a network failure is indistinguishable from "there are no events", and
   * the screen told the user "No events match your filters" after a Gateway
   * Timeout — sending her to fiddle with filters that cannot fix it.
   */
  error: string | null;

  fetchUpcoming: (params?: ListEventsParams) => Promise<void>;
  fetchMyRsvps: () => Promise<void>;
  fetchPastRsvps: () => Promise<void>;
  fetchSavedIds: () => Promise<void>;
  fetchSavedEvents: () => Promise<void>;
  toggleSave: (eventId: string) => Promise<void>;
  reset: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  upcoming: [],
  myRsvps: [],
  pastRsvps: [],
  savedIds: new Set<string>(),
  savedEvents: [],
  loading: false,
  loadedAt: null,
  error: null,

  fetchUpcoming: async (params) => {
    set({ loading: true });
    try {
      const rows = await eventsApi.listUpcoming(params);
      // Clear the error only on success, and keep whatever we already had if
      // the call throws — a failed REFRESH should never blank a good list.
      set({ upcoming: rows, loadedAt: Date.now(), error: null });
    } catch (err) {
      console.error('[events] fetchUpcoming', err);
      set({ error: err instanceof Error ? err.message : 'fetch failed' });
    } finally {
      set({ loading: false });
    }
  },

  fetchMyRsvps: async () => {
    try {
      const rows = await eventsApi.listMyRsvps(false);
      set({ myRsvps: rows });
    } catch (err) {
      console.error('[events] fetchMyRsvps', err);
    }
  },

  fetchPastRsvps: async () => {
    try {
      const rows = await eventsApi.listMyRsvps(true);
      set({ pastRsvps: rows });
    } catch (err) {
      console.error('[events] fetchPastRsvps', err);
    }
  },

  fetchSavedIds: async () => {
    try {
      const ids = await eventsApi.listMySavedEventIds();
      set({ savedIds: new Set(ids) });
    } catch (err) {
      console.error('[events] fetchSavedIds', err);
    }
  },

  fetchSavedEvents: async () => {
    try {
      const rows = await eventsApi.listMySavedEvents();
      set({ savedEvents: rows, savedIds: new Set(rows.map((r) => r.id)) });
    } catch (err) {
      console.error('[events] fetchSavedEvents', err);
    }
  },

  // Optimistic save/unsave — flips the id set immediately, reverts on error.
  toggleSave: async (eventId) => {
    const cur = get().savedIds;
    const wasSaved = cur.has(eventId);
    const next = new Set(cur);
    if (wasSaved) next.delete(eventId); else next.add(eventId);
    set({ savedIds: next });
    if (wasSaved) set((s) => ({ savedEvents: s.savedEvents.filter((e) => e.id !== eventId) }));
    try {
      if (wasSaved) await eventsApi.unsaveEvent(eventId);
      else await eventsApi.saveEvent(eventId);
    } catch (err) {
      console.error('[events] toggleSave', err);
      set({ savedIds: cur }); // revert
    }
  },

  reset: () => set({
    upcoming: [], myRsvps: [], pastRsvps: [],
    savedIds: new Set<string>(), savedEvents: [], loadedAt: null, error: null,
  }),
}));
