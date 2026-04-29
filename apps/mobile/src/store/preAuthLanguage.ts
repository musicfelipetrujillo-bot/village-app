// Pre-auth language preference, persisted to AsyncStorage.
//
// `useT()` (in src/i18n/index.ts) reads from the authenticated user's
// `users.preferred_language` column once a profile is hydrated. Before that
// — Splash, Onboarding, SignUp, Login, ForgotPassword — there is no profile,
// so every string defaulted to English. For a hospital-discharge GTM where
// Miami is heavily bilingual, that meant a Spanish-speaking mom saw English
// throughout her *first* interaction with the app.
//
// This store fills the gap. The OnboardingScreen language picker writes
// here, the auth screens read from here via `useT()` fallback, and once the
// user signs in, the user-store profile takes over (the value stays in
// AsyncStorage as the next-session default).
//
// Storage key is namespaced (`village_*`) so a future user-prefs key won't
// collide.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PreAuthLang = 'en' | 'es';

const STORAGE_KEY = 'village_pre_auth_lang';

interface PreAuthLanguageStore {
  language: PreAuthLang;
  /** True once we've attempted to read AsyncStorage on app boot. Auth
   *  screens render English on the first frame and re-render to Spanish
   *  if hydration finds a stored value — fine because the first frame is
   *  the splash. */
  hydrated: boolean;
  /** Writes through to AsyncStorage; failures are swallowed because a
   *  storage error here should NOT break the auth flow. */
  setLanguage: (lang: PreAuthLang) => Promise<void>;
  /** Called once from App.tsx on boot. Idempotent. */
  hydrate: () => Promise<void>;
}

export const usePreAuthLanguage = create<PreAuthLanguageStore>((set, get) => ({
  language: 'en',
  hydrated: false,
  setLanguage: async (lang) => {
    set({ language: lang });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Persistence is best-effort. The in-memory value is what the
      // current session reads; next launch will fall back to 'en'.
    }
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'es') {
        set({ language: stored, hydrated: true });
        return;
      }
    } catch {
      // Fall through.
    }
    set({ hydrated: true });
  },
}));
