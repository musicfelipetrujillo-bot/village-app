// Web dev preview seed — populates Zustand stores with mock data so
// HomeScreen renders its full card layout without a real Supabase session.
// Only runs when __DEV__ && Platform.OS === 'web'. Never ships to native.
import { Platform } from 'react-native';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { useEventsStore } from '@store/events';
import { usePerksStore } from '@store/perks';

const noop = async () => {};

export function seedWebDevStores() {
  if (!__DEV__ || Platform.OS !== 'web') return;

  // ── Auth ────────────────────────────────────────────────────────────────────
  useAuthStore.setState({
    session: { user: { id: 'dev-user-id', email: 'dev@village.app' } } as any,
    user: { id: 'dev-user-id', email: 'dev@village.app' } as any,
    loading: false,
  });

  // ── User profile ────────────────────────────────────────────────────────────
  useUserStore.setState({
    profile: {
      id: 'dev-user-id',
      full_name: 'Sofia',
      email: 'dev@village.app',
      pregnancy_stage: 'postpartum_6_12mo',
      preferred_language: 'en',
      zip_code: '33101',
      search_radius_miles: 25,
      created_at: new Date().toISOString(),
    } as any,
    fetchProfile: noop,
  });

  // ── Home store — week 29, seeded feed cards ─────────────────────────────────
  useHomeStore.setState({
    babyProfile: {
      id: 'dev-baby-id',
      user_id: 'dev-user-id',
      baby_name: 'Luna',
      date_of_birth: '2025-10-20',
      current_week_number: 29,
      gender: 'female',
      feeding_method: 'breastfeeding',
      created_at: new Date().toISOString(),
    } as any,
    currentMilestone: {
      week_number: 29,
      title: 'Week 29',
      motor_skills: 'Pulls to stand, cruises along furniture',
      social_emotional: 'Waves bye-bye, claps hands',
      communication: 'Says "mama" and "dada" with meaning',
      sleep_hours_min: 12,
      sleep_hours_max: 16,
      feeds_per_day: 4,
      ai_summary_cache: 'Luna is building independence this week — she may pull herself up to stand and start cruising along furniture. This is the beginning of walking. Keep floors clear and offer safe surfaces for her to hold.',
    } as any,
    // Non-null checkin prevents the daily check-in modal from auto-triggering
    todayCheckin: {
      id: 'dev-checkin',
      mood_score: 4,
      energy_score: 3,
      checkin_date: new Date().toISOString().slice(0, 10),
      ai_reply: 'You\'re doing great. Week 29 is a big one.',
      crisis_flagged: false,
    } as any,
    feed: {
      cards: [
        {
          card_type: 'milestone',
          priority: 10,
          payload: {
            week_number: 29,
            title: 'Week 29 · On the move',
            description: 'Luna may be pulling to stand and cruising along furniture. First steps are close.',
            long_copy: 'This week Luna is likely experimenting with pulling herself up to stand and cruising along furniture — the first steps toward independent walking. Keep floors clear and offer safe, stable surfaces.',
            category: 'motor_skills',
          },
        },
        {
          card_type: 'events',
          priority: 8,
          payload: {
            events: [
              { id: 'ev1', title: 'Baby & Me Swim Class', starts_at: new Date(Date.now() + 86400000 * 3).toISOString(), location_name: 'Coral Gables Aquatic Center', event_type: 'local', reason: 'Great for Luna\'s motor development at week 29' },
              { id: 'ev2', title: 'Postpartum Recovery Webinar', starts_at: new Date(Date.now() + 86400000 * 7).toISOString(), location_name: null, event_type: 'webinar', reason: 'Free, online, 45 minutes' },
            ],
          },
        },
        {
          card_type: 'perks',
          priority: 6,
          payload: {
            deals: [
              { id: 'p1', brand_name: 'Lovevery', title: '20% off play kits', deal_type: 'discount_code', redemption_method: 'show_code', reason: 'Stage-matched for 29 weeks' },
              { id: 'p2', brand_name: 'Bobbie', title: 'Free sample formula', deal_type: 'free_sample', redemption_method: 'request_sample', reason: 'Organic option if supplementing' },
              { id: 'p3', brand_name: 'UPPAbaby', title: '15% off strollers', deal_type: 'affiliate_link', redemption_method: 'tap_link', reason: 'Popular with Miami moms' },
            ],
          },
        },
        {
          card_type: 'gear_tip',
          priority: 4,
          payload: {
            tip: 'A pull-to-stand activity cube gives Luna safe furniture to cruise along while keeping her engaged. Look for one with a non-slip base.',
            category_hint: 'activity_center',
          },
        },
      ],
      is_stale: false,
      generated_at: new Date().toISOString(),
    } as any,
    loading: false,
    loadedAt: Date.now(),
    // Stub out all fetchers so they don't call Supabase and overwrite seed data
    fetchAll: noop,
  });

  // ── Events store ─────────────────────────────────────────────────────────────
  useEventsStore.setState({
    upcoming: [
      { id: 'ev1', title: 'Baby & Me Swim Class', starts_at: new Date(Date.now() + 86400000 * 3).toISOString(), location_name: 'Coral Gables Aquatic Center', event_type: 'local', is_partner: true } as any,
      { id: 'ev2', title: 'Postpartum Recovery Webinar', starts_at: new Date(Date.now() + 86400000 * 7).toISOString(), event_type: 'webinar', is_partner: false } as any,
    ],
    fetchUpcoming: noop,
  } as any);

  // ── Perks store ──────────────────────────────────────────────────────────────
  usePerksStore.setState({
    perks: [
      { id: 'p1', brand_name: 'Lovevery', title: '20% off play kits', deal_type: 'discount_code', category: 'toys_play', eligibility_age_tags: ['6-9mo'] } as any,
      { id: 'p2', brand_name: 'Bobbie', title: 'Free sample formula', deal_type: 'free_sample', category: 'feeding', eligibility_age_tags: ['6-9mo'] } as any,
    ],
    fetchPerks: noop,
  } as any);
}
