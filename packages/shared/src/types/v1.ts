// V1 — Specialist Directory types

export type PregnancyStage =
  | 'trying'
  | 'first_trimester'
  | 'second_trimester'
  | 'third_trimester'
  | 'postpartum_0_6mo'
  | 'postpartum_6_12mo'
  | 'postpartum_1yr_plus';

export type SupportedLanguage = 'en' | 'es';

export type SpecialtyType =
  | 'ob_gyn'
  | 'midwife'
  | 'doula'
  | 'lactation_consultant'
  | 'pediatrician'
  | 'sleep_coach'
  | 'pelvic_floor_pt'
  | 'perinatal_dietitian'
  | 'ppd_therapist';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type AppointmentSource = 'zocdoc' | 'calendly' | 'in_app';

export type AISkillType =
  | 'match'
  | 'profile_qa'
  | 'translate'
  | 'review_summary'
  | 'appointment_reminder'
  | 'followup_questions'
  | 'triage';

export interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  pregnancy_stage: PregnancyStage | null;
  due_date: string | null;
  preferred_language: SupportedLanguage;
  insurance_provider: string | null;
  zip_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Specialist {
  id: string;
  user_id: string | null;
  npi_number: string;
  npi_verified: boolean;
  npi_verified_at: string | null;
  full_name: string;
  credentials: string;
  specialty: SpecialtyType;
  bio: string | null;
  photo_url: string | null;
  practice_name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website_url: string | null;
  telehealth_available: boolean;
  telehealth_link: string | null;
  accepting_patients: boolean;
  years_experience: number | null;
  rating_avg: number;
  review_count: number;
  review_summary_cache: string | null;
  review_summary_cached_at: string | null;
  calendly_username: string | null;
  stripe_account_id: string | null;
  distance_miles?: number; // injected by geo query
  languages?: string[];
  insurances?: string[];
  services?: SpecialistService[];
}

export interface SpecialistService {
  id: string;
  specialist_id: string;
  service_name: string;
  description: string | null;
  price_cents: number | null;
  duration_min: number | null;
}

export interface Review {
  id: string;
  specialist_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  ai_summary: string | null;
  verified_patient: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  specialist_id: string;
  source: AppointmentSource;
  external_id: string | null;
  status: AppointmentStatus;
  appointment_at: string;
  duration_min: number;
  service_type: string | null;
  is_telehealth: boolean;
  telehealth_link: string | null;
  notes: string | null;
  stripe_payment_intent_id: string | null;
  amount_cents: number | null;
  created_at: string;
  updated_at: string;
  specialist?: Pick<Specialist, 'full_name' | 'specialty' | 'photo_url'>;
}

// AI skill request/response shapes
export interface AIMatchRequest {
  user_id: string;
  lat: number;
  lng: number;
  radius_miles?: number;
  specialty?: SpecialtyType;
}

export interface AIMatchRecommendation {
  specialist_id: string;
  name: string;
  specialty: SpecialtyType;
  reason: string;
}

export interface AIMatchResponse {
  recommendations: AIMatchRecommendation[];
}

export interface AITriageResponse {
  is_emergency: boolean;
  emergency_message: string | null;
  recommended_specialty: SpecialtyType | null;
  reasoning: string;
}
