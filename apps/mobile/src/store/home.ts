// V4 Phase G1 — Home store (baby profile + current milestone).
// G7 extensions: daily check-in + home feed cache.
import { create } from 'zustand';
import {
  homeApi,
  type BabyProfile,
  type CurrentMilestone,
  type DailyCheckin,
  type HomeFeed,
} from '@api/home';

interface HomeState {
  babyProfile: BabyProfile | null;
  currentMilestone: CurrentMilestone | null;
  todayCheckin: DailyCheckin | null;
  feed: HomeFeed | null;
  loading: boolean;
  loadedAt: number | null;

  fetchAll: () => Promise<void>;
  setBabyProfile: (p: BabyProfile | null) => void;
  setTodayCheckin: (c: DailyCheckin | null) => void;
  refreshFeed: () => Promise<void>;
  reset: () => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  babyProfile: null,
  currentMilestone: null,
  todayCheckin: null,
  feed: null,
  loading: false,
  loadedAt: null,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [profile, feed, checkin] = await Promise.all([
        homeApi.getMyBabyProfile(),
        homeApi.getHomeFeed().catch(() => null),
        homeApi.getTodayCheckin().catch(() => null),
      ]);
      let milestone: CurrentMilestone | null = null;
      if (profile) {
        milestone = await homeApi.getMyCurrentMilestone().catch(() => null);
      }
      set({
        babyProfile: profile,
        currentMilestone: milestone,
        feed,
        todayCheckin: checkin,
        loadedAt: Date.now(),
      });

      // If cache is stale or missing, kick off a curator refresh in the background.
      // UI renders whatever it already has; the next load will see fresh cards.
      if (!feed || feed.is_stale) {
        homeApi.refreshHomeFeed()
          .then(() => homeApi.getHomeFeed())
          .then((fresh) => { if (fresh) set({ feed: fresh }); })
          .catch(() => { /* ignore — fail soft */ });
      }
    } catch (err) {
      console.error('[home] fetchAll error', err);
    } finally {
      set({ loading: false });
    }
  },

  setBabyProfile: (p) => set({ babyProfile: p }),
  setTodayCheckin: (c) => set({ todayCheckin: c }),

  refreshFeed: async () => {
    try {
      await homeApi.refreshHomeFeed();
      const fresh = await homeApi.getHomeFeed();
      if (fresh) set({ feed: fresh });
    } catch (err) {
      console.error('[home] refreshFeed error', err);
    }
  },

  reset: () => set({
    babyProfile: null,
    currentMilestone: null,
    todayCheckin: null,
    feed: null,
    loadedAt: null,
  }),
}));
