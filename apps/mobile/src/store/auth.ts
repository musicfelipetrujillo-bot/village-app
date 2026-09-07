import { create } from 'zustand';
import { OneSignal } from 'react-native-onesignal';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Sentry } from '@/lib/sentry';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { useTrackerStore } from '@store/babyTracker';
import { useMilkVaultStore } from '@store/milkVault';
import { useMilkStore } from '@store/milk';
import { useGearStore } from '@store/gear';
import { useEventsStore } from '@store/events';
import { usePerksStore } from '@store/perks';
import { usePicksStore } from '@store/picks';
import { useExpertsStore } from '@store/experts';
import { useBoxesStore } from '@store/boxes';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
}

// Tag Sentry events with the user id (only). Email + username are scrubbed in
// `beforeSend` (HIPAA-adjacent caution), so passing only `id` here is the
// minimal context needed to triage a crash to a real user via Supabase admin.
function tagSentryUser(user: User | null) {
  try {
    Sentry?.setUser?.(user ? { id: user.id } : null);
  } catch {
    // Sentry isn't required for app function — never fail auth on telemetry.
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  setSession: (session) => {
    const user = session?.user ?? null;
    tagSentryUser(user);
    set({ session, user, loading: false });
  },

  // SECURITY (audit 2026-09-04): sign-out used to clear only `session` + `user`
  // and the Sentry user id. Everything else survived into the next session:
  //
  //   · the DEVICE stayed linked to her OneSignal external_id, so user-targeted
  //     pushes — daily check-in nudges, "baby's week" milestones, room digests —
  //     kept arriving on the lock screen of a signed-out phone. On a shared,
  //     sold, or clinic demo device that is someone else reading her
  //     notifications. There was no OneSignal.logout() anywhere in the codebase.
  //   · `useUserStore` kept her full name, due date, ZIP and INSURANCE PROVIDER
  //     in memory, and `Sentry.setContext('user_meta')` kept her pregnancy stage
  //     attached — so the next user's early crashes were tagged with the previous
  //     user's health context.
  //   · the vault / tracker / gear / milk / events / perks / picks / experts /
  //     boxes stores kept their rows, so a fast account switch could render the
  //     previous account's data before each screen's own fetch overwrote it.
  //     (`useHomeStore` was the only one already resetting, via its own
  //     onAuthStateChange listener.)
  //
  // Teardown runs in `finally`: if the network call fails, the user still asked
  // to sign out, and leaving her data resident because a request timed out is the
  // wrong failure. Each step is individually guarded so one throwing cannot
  // strand the rest.
  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Unlink the push device. Without this the external_id mapping persists on
      // the device record and user-targeted sends keep resolving to this phone.
      try {
        OneSignal.logout();
      } catch {
        // Native module missing (Expo Go / unsigned sim) — never block sign-out.
      }

      // setProfile(null) also clears zipCoords and the Sentry 'user_meta'
      // context, so it is the profile reset AND the telemetry scrub in one.
      safely(() => useUserStore.getState().setProfile(null));

      for (const reset of [
        () => useHomeStore.getState().reset(),
        () => useTrackerStore.getState().reset(),
        () => useMilkVaultStore.getState().reset(),
        () => useMilkStore.getState().reset(),
        () => useGearStore.getState().reset(),
        () => useEventsStore.getState().reset(),
        () => usePerksStore.getState().reset(),
        () => usePicksStore.getState().reset(),
        () => useExpertsStore.getState().reset(),
        () => useBoxesStore.getState().reset(),
      ]) {
        safely(reset);
      }

      tagSentryUser(null);
      set({ session: null, user: null });
    }
  },
}));

/** Run a teardown step without letting it abort the rest of sign-out. */
function safely(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.warn('[auth] sign-out teardown step failed:', (err as Error)?.message ?? String(err));
  }
}
