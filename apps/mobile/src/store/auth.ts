import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Sentry } from '@/lib/sentry';

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

  signOut: async () => {
    await supabase.auth.signOut();
    tagSentryUser(null);
    set({ session: null, user: null });
  },
}));
