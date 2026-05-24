import { supabase } from '@/lib/supabase';
import { getPreferredRadiusMiles } from '@store/user';
import type { Specialist, Review, SpecialtyType } from 'shared/src/types/v1';

// ── Admin: issue a specialist invite ──────────────────────────────────────
//
// Wraps the `admin-specialist-invite` edge function (JWT-gated, allowlist
// check via ADMIN_USER_IDS env). Mobile callers never see the service-role
// key — the gateway forwards approved requests to specialist-invite-create
// server-side. Returns the invite URL the admin can hand-deliver or share.
//
// Surface errors are stable across heuristics + future allowlist changes:
//   - 401: caller not signed in
//   - 403: signed in but not in admin allowlist
//   - 4xx: invalid payload (bad email, unknown specialty, etc.)
//   - 500: db / forwarding error

export type AdminInvitePayload = {
  email: string;
  full_name?: string;
  credentials?: string;
  specialty?: SpecialtyType;
  npi_number?: string;
  personal_note?: string;
};

export type AdminInviteResult = {
  invite_id: string;
  token: string;
  invite_url: string;
  expires_at: string;
  reused: boolean;
};

export async function issueSpecialistInvite(
  payload: AdminInvitePayload,
): Promise<{ ok: true; data: AdminInviteResult } | { ok: false; status: number; error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'admin-specialist-invite',
      { body: payload },
    );
    if (error) {
      // supabase-js bundles HTTP errors here; the function returns a JSON
      // body with `error` so we can surface it cleanly.
      const status = (error as any).status ?? 0;
      const msg = (error as any).message ?? 'unknown error';
      return { ok: false, status, error: msg };
    }
    return { ok: true, data: data as AdminInviteResult };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message ?? String(e) };
  }
}

export interface SearchFilters {
  lat: number;
  lng: number;
  radiusMiles?: number;
  specialty?: SpecialtyType;
  language?: string;
  insurance?: string;
  telehealthOnly?: boolean;
}

export const specialistsApi = {
  search: async (filters: SearchFilters): Promise<Specialist[]> => {
    const { data, error } = await supabase.rpc('specialists_near', {
      lat: filters.lat,
      lng: filters.lng,
      radius_miles: filters.radiusMiles ?? getPreferredRadiusMiles(),
      specialty_filter: filters.specialty ?? null,
      language_filter: filters.language ?? null,
      insurance_filter: filters.insurance ?? null,
      telehealth_only: filters.telehealthOnly ?? false,
    });
    if (error) throw error;

    // Attach languages for each specialist
    const ids: string[] = (data ?? []).map((s: any) => s.id);
    const { data: langs } = await supabase
      .from('specialist_languages')
      .select('specialist_id, language_code')
      .in('specialist_id', ids);

    const langMap: Record<string, string[]> = {};
    (langs ?? []).forEach((l: any) => {
      if (!langMap[l.specialist_id]) langMap[l.specialist_id] = [];
      langMap[l.specialist_id].push(l.language_code);
    });

    return (data ?? []).map((s: any) => ({ ...s, languages: langMap[s.id] ?? [] }));
  },

  getById: async (id: string): Promise<Specialist> => {
    const { data, error } = await supabase
      .from('specialists')
      .select(`
        *,
        specialist_languages(language_code),
        specialist_insurances(insurance_name, plan_type),
        specialist_services(id, service_name, description, price_cents, duration_min)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;

    return {
      ...data,
      languages: data.specialist_languages?.map((l: any) => l.language_code) ?? [],
      insurances: data.specialist_insurances?.map((i: any) => i.insurance_name) ?? [],
      services: data.specialist_services ?? [],
    };
  },

  getReviews: async (specialistId: string): Promise<Review[]> => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('specialist_id', specialistId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },

  addReview: async (review: {
    specialist_id: string;
    user_id: string;
    rating: number;
    body?: string;
  }): Promise<void> => {
    const { error } = await supabase.from('reviews').insert(review);
    if (error) throw error;
  },

  toggleFavorite: async (userId: string, specialistId: string, isFavorited: boolean) => {
    if (isFavorited) {
      await supabase.from('favorites').delete()
        .eq('user_id', userId).eq('specialist_id', specialistId);
    } else {
      await supabase.from('favorites').insert({ user_id: userId, specialist_id: specialistId });
    }
  },

  getFavorites: async (userId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('favorites')
      .select('specialist_id')
      .eq('user_id', userId);
    return (data ?? []).map((f: any) => f.specialist_id);
  },

  getFavoriteSpecialists: async (userId: string): Promise<Specialist[]> => {
    const { data, error } = await supabase
      .from('favorites')
      .select('specialists(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((f: any) => f.specialists).filter(Boolean);
  },
};
