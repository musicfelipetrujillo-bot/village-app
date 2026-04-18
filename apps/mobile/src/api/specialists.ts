import { supabase } from '@/lib/supabase';
import type { Specialist, Review, SpecialtyType } from 'shared/src/types/v1';

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
      radius_miles: filters.radiusMiles ?? 10,
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
};
