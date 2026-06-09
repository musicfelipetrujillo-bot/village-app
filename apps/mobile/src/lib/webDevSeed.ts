// Web dev preview seed — populates Zustand stores with mock data so
// HomeScreen renders its full card layout without a real Supabase session.
// Only runs when __DEV__ && Platform.OS === 'web'. Never ships to native.
import { Platform } from 'react-native';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { useEventsStore } from '@store/events';
import { usePerksStore } from '@store/perks';
import { usePicksStore } from '@store/picks';
import { useGearStore } from '@store/gear';
import { useExpertsStore } from '@store/experts';

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
      full_name: 'Alana',
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
      description: 'Pulling to stand and cruising the furniture.',
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

  // ── Events store — Villie Plans class placeholders (mirrors migration 085) ───
  useEventsStore.setState({
    upcoming: [
      { id: 'ev1', type: 'local',   title: 'Baby & Me Music Class',                 host_name: 'Tiny Tunes Miami',            starts_at: new Date(Date.now() + 86400000 * 1).toISOString(), venue_name: 'Pinecrest Gardens',          city: 'Miami', is_partner: true,  is_third_party: false, is_free: true, distance_km: 3.2, going_count: 9,  age_tags: ['0-3mo','3-6mo','6-12mo','12mo+'] } as any,
      { id: 'ev2', type: 'local',   title: 'Postpartum Yoga: Mom + Baby',           host_name: 'Bloom Yoga Studio',           starts_at: new Date(Date.now() + 86400000 * 2).toISOString(), venue_name: 'Bloom Studio Coral Gables',  city: 'Miami', is_partner: true,  is_third_party: false, is_free: true, distance_km: 5.0, going_count: 7,  age_tags: ['pregnancy','0-3mo','3-6mo','6-12mo'] } as any,
      { id: 'ev3', type: 'webinar', title: 'Postpartum Mental Health: Ask a Therapist', host_name: 'Dr. Lisa Chen, PhD',      starts_at: new Date(Date.now() + 86400000 * 3).toISOString(), is_partner: false, is_third_party: true,  is_free: true, going_count: 31, age_tags: ['pregnancy','0-3mo','3-6mo','6-12mo','12mo+'] } as any,
      { id: 'ev4', type: 'local',   title: 'Baby & Me Swim Class',                  host_name: 'AquaTots Miami',              starts_at: new Date(Date.now() + 86400000 * 4).toISOString(), venue_name: 'Venetian Pool',              city: 'Miami', is_partner: false, is_third_party: true,  is_free: true, distance_km: 6.8, going_count: 5,  age_tags: ['3-6mo','6-12mo','12mo+'] } as any,
      { id: 'ev5', type: 'local',   title: 'Breastfeeding Support Circle',          host_name: 'The Village Community',       starts_at: new Date(Date.now() + 86400000 * 6).toISOString(), venue_name: 'Wynwood Family Hub',         city: 'Miami', is_partner: true,  is_third_party: false, is_free: true, distance_km: 4.1, going_count: 14, age_tags: ['pregnancy','0-3mo','3-6mo'] } as any,
      { id: 'ev6', type: 'local',   title: 'Newborn Care Basics',                   host_name: 'Baptist Health Birth Center', starts_at: new Date(Date.now() + 86400000 * 8).toISOString(), venue_name: 'Baptist Health Birth Center', city: 'Miami', is_partner: false, is_third_party: true, is_free: true, distance_km: 7.5, going_count: 12, age_tags: ['pregnancy','0-3mo'] } as any,
      { id: 'ev7', type: 'local',   title: 'Baby Sign Language Basics',             host_name: 'Tiny Signs Miami',            starts_at: new Date(Date.now() + 86400000 * 9).toISOString(),  venue_name: 'Coral Gables Branch Library',  city: 'Miami', is_partner: true,  is_third_party: false, is_free: true, distance_km: 4.6, going_count: 11, age_tags: ['6-12mo','12mo+'] } as any,
      { id: 'ev8', type: 'local',   title: 'Newborn Sleep Workshop',                host_name: 'Coach Sarah Mills, CPSC',     starts_at: new Date(Date.now() + 86400000 * 11).toISOString(), venue_name: 'South Miami Wellness Center',  city: 'Miami', is_partner: true,  is_third_party: false, is_free: true, distance_km: 6.0, going_count: 17, age_tags: ['pregnancy','0-3mo','3-6mo'] } as any,
      { id: 'ev9', type: 'local',   title: 'Infant Massage for Bonding & Colic',    host_name: 'Nurture Touch Miami',         starts_at: new Date(Date.now() + 86400000 * 12).toISOString(), venue_name: 'Nurture Touch Studio, Brickell', city: 'Miami', is_partner: true, is_third_party: false, is_free: true, distance_km: 2.3, going_count: 8,  age_tags: ['0-3mo','3-6mo'] } as any,
      { id: 'ev10', type: 'local',  title: 'Mommy & Me Story Time',                 host_name: 'Miami-Dade Public Library',   starts_at: new Date(Date.now() + 86400000 * 13).toISOString(), venue_name: 'West Kendall Regional Library', city: 'Miami', is_partner: false, is_third_party: true, is_free: true, distance_km: 9.1, going_count: 22, age_tags: ['6-12mo','12mo+'] } as any,
      { id: 'ev11', type: 'webinar', title: 'Baby-Led Weaning Workshop',            host_name: 'Dr. Marisol Reyes, RD',       starts_at: new Date(Date.now() + 86400000 * 14).toISOString(), is_partner: false, is_third_party: true, is_free: true, going_count: 27, age_tags: ['3-6mo','6-12mo'] } as any,
      { id: 'ev12', type: 'webinar', title: 'Sleep Training Without Tears: Live Q&A', host_name: 'Coach Sarah Mills, CPSC',    starts_at: new Date(Date.now() + 86400000 * 17).toISOString(), is_partner: false, is_third_party: true, is_free: true, going_count: 19, age_tags: ['3-6mo','6-12mo','12mo+'] } as any,
    ],
    // Pre-saved "plans" for the Saved events preview (a couple already hearted).
    savedIds: new Set<string>(['ev2', 'ev8']),
    savedEvents: [
      { id: 'ev2', type: 'local', title: 'Postpartum Yoga: Mom + Baby',  host_name: 'Bloom Yoga Studio',        starts_at: new Date(Date.now() + 86400000 * 2).toISOString(),  venue_name: 'Bloom Studio Coral Gables',   city: 'Miami', is_partner: true, is_third_party: false, is_free: true, distance_km: 5.0, going_count: 7,  age_tags: ['pregnancy','0-3mo','3-6mo','6-12mo'] } as any,
      { id: 'ev8', type: 'local', title: 'Newborn Sleep Workshop',       host_name: 'Coach Sarah Mills, CPSC',  starts_at: new Date(Date.now() + 86400000 * 11).toISOString(), venue_name: 'South Miami Wellness Center',  city: 'Miami', is_partner: true, is_third_party: false, is_free: true, distance_km: 6.0, going_count: 17, age_tags: ['pregnancy','0-3mo','3-6mo'] } as any,
    ],
    fetchUpcoming: noop,
    fetchSavedIds: noop,
    fetchSavedEvents: noop,
    // Local-only toggle so the ♡ is interactive in the web preview (no Supabase).
    toggleSave: async (eventId: string) => {
      const s = useEventsStore.getState();
      const next = new Set(s.savedIds);
      const wasSaved = next.has(eventId);
      if (wasSaved) next.delete(eventId); else next.add(eventId);
      const savedEvents = wasSaved
        ? s.savedEvents.filter((e) => e.id !== eventId)
        : [...s.savedEvents, ...s.upcoming.filter((e) => e.id === eventId)];
      useEventsStore.setState({ savedIds: next, savedEvents } as any);
    },
  } as any);

  // ── Perks store ──────────────────────────────────────────────────────────────
  usePerksStore.setState({
    perks: [
      { id: 'p1', brand_name: 'Pampers', brand_logo_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/perks/pampers.png', title: '20% off Pampers diapers', deal_type: 'discount_code', category: 'gear', eligibility_age_tags: ['0-3mo','3-6mo'] } as any,
      { id: 'p2', brand_name: 'Nara Organics', brand_logo_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/perks/nara.png', title: 'Partner: 20% off your first order', deal_type: 'partner_offer', category: 'feeding', eligibility_age_tags: ['6-9mo'] } as any,
    ],
    fetchPerks: noop,
  } as any);

  // ── Picks store ──────────────────────────────────────────────────────────────
  usePicksStore.setState({
    picks: [
      { id: 'k1', name: 'Goodnight Moon',     blurb: 'The bedtime classic, on repeat', emoji: '📖', image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/goodnight-moon.png', affiliate_url: null, category: 'book',    eligibility_age_tags: [], sort_order: 1 } as any,
      { id: 'k2', name: 'Lovevery play gym',  blurb: 'The one toy worth the hype now', emoji: '🧸', image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/play-gym.png', affiliate_url: null, category: 'toy',     eligibility_age_tags: [], sort_order: 2 } as any,
      { id: 'k3', name: 'First-spoons set',   blurb: 'For the solids mess ahead',      emoji: '🥄', image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/first-spoons.png', affiliate_url: null, category: 'feeding', eligibility_age_tags: [], sort_order: 3 } as any,
      { id: 'k4', name: 'Hooded baby towels', blurb: 'Soft, oversized, fast-drying',   emoji: '🛁', image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/hooded-towels.png', affiliate_url: null, category: 'gear',    eligibility_age_tags: [], sort_order: 4 } as any,
    ],
    fetchPicks: noop,
  } as any);

  // ── Gear store — Baby Gear browse feed (real placeholder item photos) ───────
  useGearStore.setState({
    feed: [
      { id: 'g1', title: 'UPPAbaby Minu V2 stroller — excellent condition', category: 'stroller', subcategory: 'lightweight', brand: 'UPPAbaby', condition: 'like_new', age_tags: ['3-6mo','6-12mo','12mo+'], price_cents: 29900, is_free: false, currency: 'USD', pickup_city: 'Miami', distance_km: 2.4, is_cpsc_checked: true, is_boosted: true, cover_image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/stroller.png', save_count: 12, created_at: new Date().toISOString() } as any,
      { id: 'g2', title: 'Lovevery Play Gym — free to a good home', category: 'activity_center', subcategory: 'playmat', brand: 'Lovevery', condition: 'good', age_tags: ['0-3mo','3-6mo'], price_cents: 0, is_free: true, currency: 'USD', pickup_city: 'Brickell', distance_km: 2.0, is_cpsc_checked: true, cover_image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/play-gym.png', save_count: 21, created_at: new Date().toISOString() } as any,
      { id: 'g3', title: 'Ergobaby Omni 360 carrier — like new', category: 'carrier_wrap', subcategory: 'structured', brand: 'Ergobaby', condition: 'like_new', age_tags: ['0-3mo','3-6mo','6-12mo'], price_cents: 7500, is_free: false, currency: 'USD', pickup_city: 'Miami Beach', distance_km: 6.8, is_cpsc_checked: true, cover_image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/carrier.png', save_count: 5, created_at: new Date().toISOString() } as any,
      { id: 'g4', title: 'Stokke Tripp Trapp high chair + baby set', category: 'high_chair', subcategory: 'convertible', brand: 'Stokke', condition: 'good', age_tags: ['6-12mo','12mo+'], price_cents: 18000, is_free: false, currency: 'USD', pickup_city: 'Coral Gables', distance_km: 5.1, is_cpsc_checked: false, cover_image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/high-chair.png', save_count: 8, created_at: new Date().toISOString() } as any,
      { id: 'g5', title: 'Melissa & Doug wooden puzzle bundle (4 puzzles)', category: 'toy', subcategory: 'wooden', brand: 'Melissa & Doug', condition: 'good', age_tags: ['12mo+'], price_cents: 2500, is_free: false, currency: 'USD', pickup_city: 'Coconut Grove', distance_km: 4.0, is_cpsc_checked: false, cover_image_url: 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/puzzles.png', save_count: 3, created_at: new Date().toISOString() } as any,
    ],
    fetchFeed: noop,
  } as any);

  // ── Experts store — Specialist directory (real seed headshots + emoji fallback) ─
  const SPEC_BASE = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/specialists';
  useExpertsStore.setState({
    results: [
      { id: 's1', full_name: 'Dr. Ana Rodriguez', specialty: 'lactation_consultant', credentials: 'IBCLC · RN', city: 'Miami',       distance_miles: 2.1, accepting_patients: true,  telehealth_available: true,  npi_verified: true,  photo_url: `${SPEC_BASE}/ana-rodriguez-v2.png`, services: [{ price_cents: 12000 }] } as any,
      { id: 's2', full_name: 'Maria Santos',       specialty: 'doula',                credentials: 'CD(DONA)',  city: 'Miami Beach', distance_miles: 4.3, accepting_patients: true,  telehealth_available: false, npi_verified: false, photo_url: `${SPEC_BASE}/maria-santos.png`,  services: [{ price_cents: 9000 }] } as any,
      { id: 's3', full_name: 'Coach Sarah Mills',  specialty: 'sleep_coach',          credentials: 'CPSC',      city: 'Coral Gables', distance_miles: 5.6, accepting_patients: true,  telehealth_available: true,  npi_verified: false, photo_url: `${SPEC_BASE}/sarah-mills.png`,   services: [{ price_cents: 15000 }] } as any,
      { id: 's4', full_name: 'Dr. Jennifer Lee',   specialty: 'pelvic_floor_pt',      credentials: 'DPT',       city: 'Brickell',     distance_miles: 3.0, accepting_patients: false, telehealth_available: true,  npi_verified: true,  photo_url: `${SPEC_BASE}/jennifer-lee.png`,  services: [{ price_cents: 18000 }] } as any,
      // No photo_url → these keep the specialty-emoji fallback tile
      { id: 's5', full_name: 'Dr. Carmen Vega',    specialty: 'perinatal_dietitian',  credentials: 'RD, LDN',   city: 'Miami',       distance_miles: 6.2, accepting_patients: true,  telehealth_available: true,  npi_verified: true,  photo_url: null, services: [{ price_cents: 11000 }] } as any,
      { id: 's6', full_name: 'Dr. Lisa Chen',      specialty: 'ppd_therapist',        credentials: 'PhD, LMHC', city: 'Coconut Grove', distance_miles: 7.4, accepting_patients: true,  telehealth_available: true,  npi_verified: true,  photo_url: null, services: [{ price_cents: 16000 }] } as any,
    ],
    loading: false,
    search: noop,
    loadFavorites: noop,
  } as any);
}
