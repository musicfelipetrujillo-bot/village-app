// Lightweight i18n. Reads `users.preferred_language` (already 'en' | 'es' on
// the user store — A1's MeScreen toggle persists the column) and dispatches
// between the static EN/ES JSON dictionaries. Falls back to English when a
// key is missing in Spanish, and falls back to the literal key when missing
// in both — that way a typo'd key surfaces visibly during dev rather than
// rendering empty.
//
// Why not i18next? We currently translate <30 keys across a handful of
// discharge-priority surfaces. i18next + plurals + namespaces + lazy-load
// would be more code than the dictionaries themselves. If translation needs
// grow (Haitian Creole, plurals, ICU MessageFormat) swap this out — call
// sites only depend on the `t()` signature.
//
// Hospital-discharge GTM: this is for clinician-handoff-grade copy; every
// new key here should be reviewed for tone (calm, second-person, no
// flippancy) before it lands.

import { useUserStore } from '@store/user';
import { usePreAuthLanguage } from '@store/preAuthLanguage';
import en from './en.json';
import es from './es.json';

export type Lang = 'en' | 'es';

const DICTS: Record<Lang, Record<string, unknown>> = { en, es };

/**
 * Resolve a dotted key path against a dictionary.
 * Returns null if the path doesn't end at a string (key missing or points
 * at an object).
 */
function lookup(dict: Record<string, unknown>, key: string): string | null {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return typeof cur === 'string' ? cur : null;
}

/**
 * Substitute `{{name}}` placeholders. Missing values render as empty string
 * (matches i18next default) — never as the literal `{{name}}` token, which
 * would leak through to the UI.
 */
function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = params[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Translate a dotted key in the requested language. EN fallback for missing
 * ES keys; literal-key fallback if both miss. Pure — safe to call outside
 * React components (e.g., from store actions).
 */
export function t(key: string, lang: Lang = 'en', params?: Record<string, string | number>): string {
  const hit = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
  if (hit === null) {
    // Translation miss — fires a Sentry breadcrumb so we catch
    // gaps in production. Returns the raw key so the screen still
    // shows something readable to the user.
    reportMissingKey(key, lang);
    return key;
  }
  return interpolate(hit, params);
}

// Reporting is per-key/per-session deduped — a missing key on a heavily
// rendered screen would otherwise flood Sentry with identical
// breadcrumbs. The Set is cleared by app restart, which is the right
// granularity (each cold launch tells us about every gap once).
const reportedKeys = new Set<string>();
function reportMissingKey(key: string, lang: Lang): void {
  if (reportedKeys.has(`${lang}:${key}`)) return;
  reportedKeys.add(`${lang}:${key}`);
  // Lazy require so this module stays Sentry-agnostic if Sentry isn't
  // initialized (initSentry no-ops without a DSN). Wrapped in try so a
  // missing Sentry can never break a translation lookup.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Sentry } = require('@/lib/sentry');
    Sentry.addBreadcrumb({
      category: 'i18n',
      level: 'warning',
      message: `missing translation: ${key} (${lang})`,
      data: { key, lang },
    });
  } catch {
    // ignore — translation must always succeed
  }
}

/**
 * Hook variant — pulls the active language preference and returns a bound
 * `t()`. Logged-in users get their saved `users.preferred_language`; auth
 * screens (no profile yet) fall back to the pre-auth store, which is
 * AsyncStorage-backed and updated by the OnboardingScreen language picker.
 *
 * Components re-render when either source changes because they subscribe
 * to both slices.
 */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const userLang = useUserStore((s) => s.profile?.preferred_language);
  const preAuthLang = usePreAuthLanguage((s) => s.language);
  const lang: Lang = userLang ?? preAuthLang;
  return (key, params) => t(key, lang, params);
}
