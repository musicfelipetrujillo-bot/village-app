import { create } from 'zustand';
import type { MilkDonorProfile, MilkTrustBadge, MilkListing } from '@api/milk';
import { getMyDonorProfile, getTrustBadge, getMyListings } from '@api/milk';

interface MilkState {
  donorProfile: MilkDonorProfile | null;
  trustBadge: MilkTrustBadge | null;
  myListings: MilkListing[];
  loading: boolean;

  setDonorProfile: (profile: MilkDonorProfile | null) => void;
  setTrustBadge: (badge: MilkTrustBadge | null) => void;
  setMyListings: (listings: MilkListing[]) => void;

  fetchDonorData: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useMilkStore = create<MilkState>((set, get) => ({
  donorProfile: null,
  trustBadge: null,
  myListings: [],
  loading: false,

  setDonorProfile: (profile) => set({ donorProfile: profile }),
  setTrustBadge: (badge) => set({ trustBadge: badge }),
  setMyListings: (listings) => set({ myListings: listings }),

  fetchDonorData: async (userId) => {
    set({ loading: true });
    try {
      const profile = await getMyDonorProfile(userId);
      set({ donorProfile: profile });

      if (profile) {
        const [badge, listings] = await Promise.all([
          getTrustBadge(profile.id),
          getMyListings(profile.id),
        ]);
        set({ trustBadge: badge, myListings: listings });
      }
    } catch (err) {
      console.error('fetchDonorData error:', err);
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ donorProfile: null, trustBadge: null, myListings: [], loading: false }),
}));
