// Unified Saved hub aggregate API (migration 068, shipped 2026-05-21).
//
// One RPC, four sections + counts. The shapes intentionally mirror what
// the per-type screens already render, so the dashboard cards can be
// thin previews + a "See all →" link that hands off to the existing
// type-specific list screen (SavedManualScreen / FavoritesScreen /
// SavedDonorsScreen / SavedGearScreen).
import { supabase } from '@/lib/supabase';

export interface SavedVideoPreview {
  id: string;
  audience: 'mom' | 'baby';
  category: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  saved_at: string;
}

export interface SavedSpecialistPreview {
  id: string;
  full_name: string;
  specialty: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  saved_at: string; // aliased from favorites.created_at server-side
}

export interface SavedDonorPreview {
  id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  saved_at: string;
}

export interface SavedGearPreview {
  id: string;
  title: string;
  condition: string | null;
  price_cents: number | null;
  is_free: boolean;
  status: string;
  cover_image_url: string | null;
  saved_at: string;
}

export interface SavedDashboard {
  videos: SavedVideoPreview[];
  videos_count: number;
  specialists: SavedSpecialistPreview[];
  specialists_count: number;
  donors: SavedDonorPreview[];
  donors_count: number;
  gear: SavedGearPreview[];
  gear_count: number;
  total: number;
}

export async function getSavedDashboard(
  locale: 'en' | 'es' = 'en',
): Promise<SavedDashboard> {
  const { data, error } = await supabase.rpc('get_saved_dashboard', {
    p_locale: locale,
  });
  if (error) throw error;
  // The RPC returns a single JSONB blob. The supabase-js client surfaces
  // it as `data` directly (not wrapped in a row array) since the function
  // returns scalar JSONB rather than `RETURNS TABLE`.
  return (data ?? {
    videos: [], videos_count: 0,
    specialists: [], specialists_count: 0,
    donors: [], donors_count: 0,
    gear: [], gear_count: 0,
    total: 0,
  }) as SavedDashboard;
}
