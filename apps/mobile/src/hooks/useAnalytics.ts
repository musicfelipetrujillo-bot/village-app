// Lightweight analytics hook — wraps Sentry breadcrumbs for event tracking.
// In production, swap Sentry.addBreadcrumb calls with your analytics provider
// (Amplitude, PostHog, Mixpanel) by changing the trackEvent implementation.
// Screen tracking wires into React Navigation via useFocusEffect.

import { useCallback } from 'react';
import { Sentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

export type AnalyticsEvent =
  // Auth
  | 'sign_up'
  | 'sign_in'
  | 'sign_out'
  | 'onboarding_step_view'
  | 'onboarding_step_advanced'
  | 'onboarding_complete'
  | 'onboarding_failed'
  // Experts
  | 'specialist_search'
  | 'specialist_profile_view'
  | 'specialist_favorite_add'
  | 'specialist_favorite_remove'
  | 'booking_start'
  | 'booking_complete'
  | 'booking_payment_success'
  | 'review_submit'
  | 'message_send'
  | 'ai_qa_asked'
  | 'ai_followup_opened'
  | 'ai_triage_used'
  // Milk Connect (V2)
  | 'milk_donor_search'
  | 'milk_donor_profile_view'
  | 'milk_match_run'
  | 'milk_purchase_start'
  | 'milk_disclosure_shown'
  | 'milk_disclosure_accepted'
  | 'milk_purchase_payment_success'
  | 'milk_purchase_confirmed'
  | 'milk_dispute_opened'
  | 'milk_shipping_label_purchased'
  | 'milk_review_submitted'
  // Community (V3)
  | 'community_room_opened'
  | 'community_room_joined'
  | 'community_room_left'
  // Home — early-postpartum crisis card
  | 'home_crisis_card_opened'
  // Home — discharge welcome (one-shot orientation card for postpartum_0_6mo)
  | 'home_discharge_welcome_dismissed'
  // Me / preferences
  | 'notification_pref_changed'
  | 'quiet_hours_changed'
  // Me / account deletion (A2.c)
  | 'account_delete_requested'
  | 'account_delete_succeeded'
  | 'account_delete_failed'
  // Navigation
  | 'screen_view';

/**
 * Milk-specific events MUST also be persisted server-side (via milk_analytics_events)
 * for compliance reasons. These events survive client analytics outages and form part
 * of the legal defense record (per Risk & Compliance doc §3.2).
 */
const SERVER_PERSIST_EVENTS: ReadonlySet<AnalyticsEvent> = new Set<AnalyticsEvent>([
  'milk_disclosure_shown',
  'milk_disclosure_accepted',
  'milk_purchase_confirmed',
  'milk_dispute_opened',
  'milk_shipping_label_purchased',
]);

interface EventProperties {
  specialist_id?: string;
  specialty?: string;
  amount_cents?: number;
  screen?: string;
  rating?: number;
  is_telehealth?: boolean;
  // Milk
  donor_profile_id?: string;
  transaction_id?: string;
  reason_code?: string;
  fulfillment_method?: 'pickup' | 'shipping';
  // Community
  room_id?: string;
  room_slug?: string;
  // Onboarding funnel
  step?: number;
  total_steps?: number;
  stage?: string;
  has_due_date?: boolean;
  has_zip?: boolean;
  has_insurance?: boolean;
  reason?: string;
  // Notification prefs
  pref_key?: string;
  enabled?: boolean;
  start_hour?: number;
  end_hour?: number;
  [key: string]: string | number | boolean | undefined;
}

async function persistServerEvent(
  event: AnalyticsEvent,
  properties?: EventProperties,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // RLS requires authenticated user
    await supabase.from('milk_analytics_events').insert({
      user_id: user.id,
      event_name: event,
      properties: properties ?? {},
    });
  } catch (err) {
    // Fire-and-forget — never let analytics failures break user flows.
    // Sentry breadcrumb will still carry the event regardless.
    if (__DEV__) console.warn('[Analytics] server persist failed', err);
  }
}

export function useAnalytics() {
  const trackEvent = useCallback((event: AnalyticsEvent, properties?: EventProperties) => {
    // Sentry breadcrumb (always — useful for error context)
    Sentry?.addBreadcrumb?.({
      category: 'analytics',
      message: event,
      data: properties,
      level: 'info',
    });

    // Server-side persistence for compliance-relevant events
    if (SERVER_PERSIST_EVENTS.has(event)) {
      void persistServerEvent(event, properties);
    }

    // TODO: Replace with your analytics provider in production
    // Example — PostHog:
    // posthog.capture(event, properties);
    //
    // Example — Amplitude:
    // amplitude.track(event, properties);

    if (__DEV__) {
      console.log(`[Analytics] ${event}`, properties ?? '');
    }
  }, []);

  const trackScreen = useCallback((screenName: string) => {
    trackEvent('screen_view', { screen: screenName });
  }, [trackEvent]);

  return { trackEvent, trackScreen };
}
