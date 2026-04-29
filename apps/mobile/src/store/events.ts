// V4 Phase G2 — Events store (upcoming feed + my RSVPs)
import { create } from 'zustand';
import { eventsApi, type EventCard, type MyRsvpRow, type ListEventsParams } from '@api/events';

interface EventsState {
  upcoming: EventCard[];
  myRsvps: MyRsvpRow[];
  pastRsvps: MyRsvpRow[];
  loading: boolean;
  loadedAt: number | null;

  fetchUpcoming: (params?: ListEventsParams) => Promise<void>;
  fetchMyRsvps: () => Promise<void>;
  fetchPastRsvps: () => Promise<void>;
  reset: () => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  upcoming: [],
  myRsvps: [],
  pastRsvps: [],
  loading: false,
  loadedAt: null,

  fetchUpcoming: async (params) => {
    set({ loading: true });
    try {
      const rows = await eventsApi.listUpcoming(params);
      set({ upcoming: rows, loadedAt: Date.now() });
    } catch (err) {
      console.error('[events] fetchUpcoming', err);
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

  reset: () => set({ upcoming: [], myRsvps: [], pastRsvps: [], loadedAt: null }),
}));
