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
import { supabase } from '@/lib/supabase';

interface HomeState {
  babyProfile: BabyProfile | null;
  currentMilestone: CurrentMilestone | null;
  todayCheckin: DailyCheckin | null;
  feed: HomeFeed | null;
  loading: boolean;
  loadedAt: number | null;
  unreadNotifCount: number;

  fetchAll: () => Promise<void>;
  setBabyProfile: (p: BabyProfile | null) => void;
  setTodayCheckin: (c: DailyCheckin | null) => void;
  refreshFeed: () => Promise<void>;
  clearUnreadNotifs: () => void;
  reset: () => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  babyProfile: null,
  currentMilestone: null,
  todayCheckin: null,
  feed: null,
  loading: false,
  loadedAt: null,
  unreadNotifCount: 0,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // getMyBabyProfile was the ONLY call here without a .catch(), so any error
      // rejected the whole Promise.all and skipped the set() below — one flaky
      // lookup blanked feed, check-in and notifications too. Now it resolves to a
      // tagged result so a failure stays contained AND is distinguishable from a
      // genuine "no baby yet".
      const [profileResult, feed, checkin, notifResult] = await Promise.all([
        homeApi.getMyBabyProfile().then(
          (p) => ({ known: true as const, profile: p }),
          () => ({ known: false as const, profile: null }),
        ),
        homeApi.getHomeFeed().catch(() => null),
        homeApi.getTodayCheckin().catch(() => null),
        user
          ? supabase
              .from('user_notifications_feed')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('is_read', false)
              .then((r) => r, () => ({ count: 0 }))
          : Promise.resolve({ count: 0 }),
      ]);
      const profile = profileResult.profile;
      let milestone: CurrentMilestone | null = null;
      if (profile) {
        milestone = await homeApi.getMyCurrentMilestone().catch(() => null);
      }
      set({
        // ONLY overwrite the baby when the lookup actually answered. A failed or
        // session-less refetch keeps whatever we already had — it must never
        // downgrade a real baby to null, which is what made the profile look
        // like it "kept resetting" (reported 2026-08-12).
        ...(profileResult.known ? { babyProfile: profile, currentMilestone: milestone } : {}),
        feed,
        todayCheckin: checkin,
        loadedAt: Date.now(),
        unreadNotifCount: (notifResult as any)?.count ?? 0,
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
  clearUnreadNotifs: () => set({ unreadNotifCount: 0 }),

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
    unreadNotifCount: 0,
  }),
}));
