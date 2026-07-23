// Daycare discovery — Google Places-backed (Care "daycare" tier). MVP fields
// only (name/rating/open-now/distance); ages/price/licensing come in the later
// hybrid phase. villie lists, does not endorse.
import { supabase } from '@/lib/supabase';

export interface Daycare {
  place_id: string;
  name: string;
  address?: string;
  rating?: number;
  ratings_count?: number;
  open_now?: boolean;
  distance_mi: number;
  lat: number;
  lng: number;
  // Miami-Dade DCF registry fields (present only when source === 'mdc_dcf').
  license_number?: string;
  capacity?: number;
  phone?: string;
  source?: 'mdc_dcf' | 'places';
}

export const daycaresApi = {
  async listNear(lat: number, lng: number, radiusMiles = 10): Promise<Daycare[]> {
    const { data, error } = await supabase.functions.invoke('daycares-nearby', {
      body: { lat, lng, radius_miles: radiusMiles },
    });
    if (error) throw new Error(error.message);
    return (data?.results ?? []) as Daycare[];
  },
};
