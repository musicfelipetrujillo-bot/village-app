// V4 Phase G3 — Perks store (catalog + my claims)
import { create } from 'zustand';
import { perksApi, type PerkCard, type MyClaimRow, type ListPerksParams } from '@api/perks';

interface PerksState {
  perks: PerkCard[];
  myClaims: MyClaimRow[];
  loading: boolean;
  loadedAt: number | null;

  fetchPerks: (params?: ListPerksParams) => Promise<void>;
  fetchMyClaims: () => Promise<void>;
  reset: () => void;
}

export const usePerksStore = create<PerksState>((set) => ({
  perks: [],
  myClaims: [],
  loading: false,
  loadedAt: null,

  fetchPerks: async (params) => {
    set({ loading: true });
    try {
      const rows = await perksApi.listPerks(params);
      set({ perks: rows, loadedAt: Date.now() });
    } catch (err) {
      console.error('[perks] fetchPerks', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchMyClaims: async () => {
    try {
      const rows = await perksApi.listMyClaims();
      set({ myClaims: rows });
    } catch (err) {
      console.error('[perks] fetchMyClaims', err);
    }
  },

  reset: () => set({ perks: [], myClaims: [], loadedAt: null }),
}));
