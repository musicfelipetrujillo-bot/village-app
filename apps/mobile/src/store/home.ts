// V4 Phase G1 — Home store (baby profile + current milestone).
// G7 extensions: daily check-in + home feed cache.
//
// WHY THIS STORE HYDRATES ITSELF (2026-08-13)
// -------------------------------------------
// "The baby profile keeps resetting on every force-quit" has now been chased
// three times. It was never a DB reset — her `baby_profiles` row has been sitting
// there untouched the whole time. It was always this store being empty on a cold
// start, so Home fell back to PLACEHOLDER_BABY_NAME at week 1 and she read that
// as "the app deleted my baby".
//
// The first two attempts both put the trigger in a UI component (v9 HomeScreen's
// mount effect, then an effect in AppNavigator). Both were correct when written
// and both went missing again — the first when Home moved to V3, the second when
// an OTA was published from a branch that had been cut before the fix landed. A
// single line in one component is simply too easy to drop.
//
// So the trigger now lives with the data. Three properties, in order of how much
// they matter to a mother staring at the wrong name:
//
//   1. CACHED. The last known baby is written to AsyncStorage and painted on the
//      very first frame — no session, no network, no round-trip. A force-quit
//      cannot lose her baby any more, and neither can a plane or a dead signal.
//   2. SELF-STARTING. Hydration is driven by Supabase's own auth state, from
//      module scope, so every screen that imports the store gets it. No UI
//      refactor can quietly remove it again.
//   3. SELF-HEALING. A lookup that fails retries with backoff instead of leaving
//      the placeholder up for the rest of the session, and a failed lookup never
//      overwrites a baby we already have.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  homeApi,
  type BabyProfile,
  type CurrentMilestone,
  type DailyCheckin,
  type HomeFeed,
} from '@api/home';
import { supabase } from '@/lib/supabase';

// Namespaced + versioned like `village_pre_auth_lang`. Bump the suffix if the
// cached shape ever changes so a stale entry is ignored rather than mis-read.
const BABY_CACHE_KEY = 'village_home_baby_v1';

interface CachedBaby {
  userId: string;
  babyProfile: BabyProfile | null;
  currentMilestone: CurrentMilestone | null;
  savedAt: number;
}

async function readCache(): Promise<CachedBaby | null> {
  try {
    const raw = await AsyncStorage.getItem(BABY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBaby;
    return parsed && typeof parsed.userId === 'string' ? parsed : null;
  } catch {
    // A corrupt or unreadable cache is just a cache miss — never fatal.
    return null;
  }
}

async function writeCache(entry: CachedBaby): Promise<void> {
  try {
    await AsyncStorage.setItem(BABY_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Best-effort. Losing the write costs us the instant first paint next
    // launch, nothing more — the network fetch still repairs it.
  }
}

async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BABY_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

interface HomeState {
  babyProfile: BabyProfile | null;
  currentMilestone: CurrentMilestone | null;
  todayCheckin: DailyCheckin | null;
  feed: HomeFeed | null;
  loading: boolean;
  loadedAt: number | null;
  unreadNotifCount: number;
  /** Auth user the in-memory data belongs to — guards against showing one
   *  account's baby to another after a switch. */
  hydratedForUserId: string | null;

  fetchAll: () => Promise<void>;
  /** Paint from cache, then refresh from the network. Idempotent per user. */
  hydrateForUser: (userId: string) => Promise<void>;
  setBabyProfile: (p: BabyProfile | null) => void;
  setTodayCheckin: (c: DailyCheckin | null) => void;
  refreshFeed: () => Promise<void>;
  clearUnreadNotifs: () => void;
  reset: () => void;
}

// Retry schedule for a profile lookup that couldn't answer (no session yet,
// radio still waking after a cold start, transient 5xx). Bounded on purpose:
// this is a repair path, not a poller.
const RETRY_DELAYS_MS = [1_000, 4_000, 10_000];
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
// Collapses concurrent callers (store self-start + AppNavigator + a screen
// focus all landing at once) onto one in-flight request.
let inFlight: Promise<void> | null = null;

function cancelRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryCount = 0;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  babyProfile: null,
  currentMilestone: null,
  todayCheckin: null,
  feed: null,
  loading: false,
  loadedAt: null,
  unreadNotifCount: 0,
  hydratedForUserId: null,

  fetchAll: async () => {
    if (inFlight) return inFlight;
    const run = async () => {
      set({ loading: true });
      try {
        // getSession() reads the stored session locally (refreshing only if
        // expired); getUser() would add a network round-trip to /auth/v1/user
        // that can fail on a cold start while the radio is still coming up —
        // which is exactly when we most need this to work.
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        // getMyBabyProfile is the one call here whose failure must stay
        // distinguishable from a genuine "no baby yet" — resolve it to a tagged
        // result so one flaky lookup can't blank the feed, check-in and
        // notifications alongside it.
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
          // ONLY overwrite the baby when the lookup actually answered. A failed
          // or session-less refetch keeps whatever we already had — it must
          // never downgrade a real baby to null, which is what made the profile
          // look like it "kept resetting".
          ...(profileResult.known ? { babyProfile: profile, currentMilestone: milestone } : {}),
          feed,
          todayCheckin: checkin,
          // Only claim "loaded" when the baby lookup answered, so no staleness
          // check mistakes a failed run for a successful one.
          ...(profileResult.known ? { loadedAt: Date.now() } : {}),
          unreadNotifCount: (notifResult as any)?.count ?? 0,
        });

        if (profileResult.known) {
          cancelRetry();
          if (user) {
            set({ hydratedForUserId: user.id });
            void writeCache({
              userId: user.id,
              babyProfile: profile,
              currentMilestone: milestone,
              savedAt: Date.now(),
            });
          }
        } else if (retryCount < RETRY_DELAYS_MS.length) {
          // Self-heal. Without this, one bad moment at launch left the
          // placeholder up until she force-quit again.
          const delay = RETRY_DELAYS_MS[retryCount];
          retryCount += 1;
          retryTimer = setTimeout(() => {
            retryTimer = null;
            void get().fetchAll();
          }, delay);
        }

        // If cache is stale or missing, kick off a curator refresh in the
        // background. UI renders whatever it already has; the next load will
        // see fresh cards.
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
    };
    inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  },

  hydrateForUser: async (userId) => {
    const state = get();
    // Already showing this user's data — the network refresh below is all
    // that's left to do.
    if (state.hydratedForUserId !== userId) {
      const cached = await readCache();
      if (cached && cached.userId === userId) {
        // First paint, straight from disk: her baby's real name and week are on
        // screen before a single request leaves the device.
        set({
          babyProfile: cached.babyProfile,
          currentMilestone: cached.currentMilestone,
          hydratedForUserId: userId,
        });
      } else if (cached && cached.userId !== userId) {
        // Different account on this device — never show the previous user's
        // baby while the real one loads.
        await clearCache();
        set({ babyProfile: null, currentMilestone: null, hydratedForUserId: null });
      }
    }
    await get().fetchAll();
  },

  setBabyProfile: (p) => {
    set({ babyProfile: p });
    // Keep the cache honest when a screen writes through (e.g. baby setup),
    // so the next cold start paints the new value rather than the old one.
    const userId = get().hydratedForUserId;
    if (userId) {
      void writeCache({
        userId,
        babyProfile: p,
        currentMilestone: get().currentMilestone,
        savedAt: Date.now(),
      });
    }
  },
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

  reset: () => {
    cancelRetry();
    void clearCache();
    set({
      babyProfile: null,
      currentMilestone: null,
      todayCheckin: null,
      feed: null,
      loadedAt: null,
      unreadNotifCount: 0,
      hydratedForUserId: null,
    });
  },
}));

// ─── Self-start ────────────────────────────────────────────────────────────
// Registered at module scope so it is impossible to forget: importing the store
// is enough. `onAuthStateChange` emits INITIAL_SESSION on subscribe, so this
// covers the cold-start case as well as sign-in and account switches.
//
// The callback body is deferred with setTimeout(0) deliberately — Supabase runs
// these callbacks while holding its auth lock, and calling back into
// supabase.auth from inside one can deadlock.
let lastAuthUserId: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  const userId = session?.user?.id ?? null;
  if (userId === lastAuthUserId) return;   // token refreshes are not new users
  lastAuthUserId = userId;
  setTimeout(() => {
    if (!userId) {
      useHomeStore.getState().reset();
      return;
    }
    void useHomeStore.getState().hydrateForUser(userId);
  }, 0);
});
