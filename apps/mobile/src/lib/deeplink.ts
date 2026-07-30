// Deep-link routing — turns a notification payload into a navigation action.
//
// WHY THIS EXISTS: until now every push we sent carried a `village://…` URL
// (or a `data.screen`) that nothing consumed — the OneSignal click handler
// logged it to the console and dropped it, and `app.json` never registered a
// URL scheme, so the links were dead on both ends. Retention pushes are
// pointless if tapping one just opens the app on whatever screen it was last
// on, so routing is part of the notification work, not a follow-up.
//
// Two input shapes are supported, because both are already in the wild:
//   1. `data: { screen: 'appointments', appointment_id: '…' }`  (appointment-reminder)
//   2. `url:  'village://home/the-buzz'`                        (trending, room digest,
//                                                                daily-checkin feed rows)
// New senders should use the URL form — it round-trips through
// `user_notifications_feed.deeplink` so the in-app Notifications list and the
// push open the same destination with one mapping.
//
// Navigation goes through the root `navigationRef` rather than a screen's own
// navigation prop: a cold-start tap has no mounted screen, and a warm tap can
// land while a modal is dismissing.
import { navigationRef } from '@/navigation/navigationRef';

/** Tab → nested screen (+ params). Tabs stay registered even when hidden, so
 *  cross-tab navigation always resolves. */
export interface DeepLinkTarget {
  tab?: string;
  screen?: string;
  params?: Record<string, unknown>;
  /** Root-stack modal (AIHelpChat, QuickReference, Paywall) — no tab. */
  rootScreen?: string;
}

// `village://<host>/<path…>` → target. Host is the tab-ish namespace, the
// rest selects a screen. Unknown links fall back to Home rather than throwing:
// a stale link from an old push must never crash the app on launch.
export function parseDeepLink(raw: string): DeepLinkTarget | null {
  if (!raw) return null;
  // Accept both the app scheme and the legacy `village://` prefix that four
  // edge functions already emit. Also tolerate an https villieapp.com URL.
  const m = raw.match(/^(?:villie|village):\/\/(.*)$/i)
        ?? raw.match(/^https?:\/\/(?:www\.)?villieapp\.com\/(.*)$/i);
  if (!m) return null;

  const [path, query] = m[1].split('?');
  const seg = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const params: Record<string, string> = {};
  if (query) {
    for (const pair of query.split('&')) {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    }
  }
  if (!seg.length) return { tab: 'Home', screen: 'HomeRoot' };

  const [host, ...rest] = seg;

  switch (host) {
    case 'home': {
      const sub = rest[0];
      if (!sub) return { tab: 'Home', screen: 'HomeRoot' };
      const homeRoutes: Record<string, string> = {
        checkin: 'DailyCheckin',
        'day-plan': 'DayPlan',
        'the-buzz': 'TheBuzz',
        insights: 'Insights',
        notifications: 'Notifications',
        discover: 'DiscoverHome',
        events: 'EventsList',
        perks: 'PerksList',
        'mom-hub': 'MomHub',
        boxes: 'BoxesHub',
      };
      if (sub === 'week' || sub === 'journey') {
        const week = Number(rest[1] ?? params.week);
        return {
          tab: 'Home',
          screen: 'WeeklyJourney',
          params: Number.isFinite(week) && week > 0 ? { week } : undefined,
        };
      }
      if (sub === 'milestone') {
        const week = Number(rest[1] ?? params.week);
        return Number.isFinite(week) && week > 0
          ? { tab: 'Home', screen: 'MilestoneDetail', params: { week } }
          : { tab: 'Home', screen: 'MilestoneTimeline' };
      }
      return { tab: 'Home', screen: homeRoutes[sub] ?? 'HomeRoot' };
    }

    case 'manual': {
      const sub = rest[0];
      if (!sub) return { tab: 'Manual', screen: 'ManualHome' };
      if (sub === 'week') {
        const week = Number(rest[1] ?? params.week);
        return {
          tab: 'Manual',
          screen: 'ManualHome',
          params: Number.isFinite(week) && week > 0 ? { week } : undefined,
        };
      }
      if (sub === 'video' && rest[1]) {
        return { tab: 'Manual', screen: 'ManualVideo', params: { videoId: rest[1] } };
      }
      if (sub === 'saved')  return { tab: 'Manual', screen: 'SavedManual' };
      if (sub === 'index')  return { tab: 'Manual', screen: 'ManualWeekIndex' };
      return { tab: 'Manual', screen: 'ManualHome' };
    }

    case 'appointments':
    case 'experts':
      return { tab: 'Experts', screen: rest[0] === 'saved' ? 'Favorites' : 'ExpertsHome' };

    case 'milk':  return { tab: 'Milk',  screen: rest[0] === 'inbox' ? 'MilkMessageThreads' : 'MilkConnectHome' };
    case 'gear':  return { tab: 'Gear',  screen: rest[0] === 'inbox' ? 'GearMessageThreads' : 'GearBrowse' };
    case 'me':
    case 'profile': return { tab: 'Profile', screen: 'MeRoot' };

    case 'help':  return { rootScreen: 'AIHelpChat', params: params.seed ? { seed: params.seed } : undefined };
    case 'emergency': return { rootScreen: 'QuickReference' };
    case 'pro':   return { rootScreen: 'Paywall', params: { source: 'deeplink' } };

    default:
      return { tab: 'Home', screen: 'HomeRoot' };
  }
}

// Legacy `data.screen` payloads (appointment-reminder ships one today).
function targetFromData(data: Record<string, unknown>): DeepLinkTarget | null {
  const screen = typeof data.screen === 'string' ? data.screen : null;
  if (!screen) return null;
  switch (screen) {
    case 'appointments': return { tab: 'Experts', screen: 'ExpertsHome' };
    case 'checkin':      return { tab: 'Home', screen: 'DailyCheckin' };
    default:             return null;
  }
}

/** Navigate to a parsed target. Safe to call before the navigator mounts —
 *  callers should gate on `navigationRef.isReady()` (see `openDeepLink`). */
export function navigateToTarget(target: DeepLinkTarget): void {
  if (!navigationRef.isReady()) return;
  try {
    if (target.rootScreen) {
      navigationRef.navigate(target.rootScreen as never, target.params as never);
      return;
    }
    if (!target.tab) return;
    navigationRef.navigate(
      target.tab as never,
      (target.screen
        ? { screen: target.screen, params: target.params }
        : undefined) as never,
    );
  } catch (e) {
    // A stale link pointing at a route this build doesn't register must not
    // crash the app — swallow and leave the user where they are.
    if (__DEV__) console.warn('[deeplink] navigate failed', e);
  }
}

/**
 * Entry point for a notification tap. Accepts the OneSignal payload shape
 * (`{ launchURL, additionalData }`) or a bare URL string.
 *
 * Cold start: the navigator isn't mounted when the OS delivers the tap, so we
 * retry on a short interval until it is (capped) instead of dropping the link.
 */
export function openDeepLink(
  input: string | { url?: string; data?: Record<string, unknown> },
): void {
  const url = typeof input === 'string' ? input : input.url;
  const data = typeof input === 'string' ? undefined : input.data;

  const target =
    (url ? parseDeepLink(url) : null) ??
    (data ? targetFromData(data) : null);
  if (!target) return;

  if (navigationRef.isReady()) { navigateToTarget(target); return; }

  let tries = 0;
  const id = setInterval(() => {
    tries += 1;
    if (navigationRef.isReady()) {
      clearInterval(id);
      navigateToTarget(target);
    } else if (tries > 40) {          // ~10s — navigator never came up
      clearInterval(id);
    }
  }, 250);
}
