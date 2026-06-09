// V10 — Villie's Picks store (weekly editorial recommendations). Mirrors
// usePerksStore so the Home "picks & perks" card reads both from stores
// (real on native; web-dev-seeded in the browser preview).
import { create } from 'zustand';
import { picksApi, type VilliePick } from '@api/picks';

interface PicksState {
  picks: VilliePick[];
  loading: boolean;
  loadedAt: number | null;
  fetchPicks: () => Promise<void>;
  reset: () => void;
}

export const usePicksStore = create<PicksState>((set) => ({
  picks: [],
  loading: false,
  loadedAt: null,
  fetchPicks: async () => {
    set({ loading: true });
    try {
      const rows = await picksApi.listPicks();
      set({ picks: rows, loadedAt: Date.now() });
    } catch (err) {
      console.error('[picks] fetchPicks', err);
    } finally {
      set({ loading: false });
    }
  },
  reset: () => set({ picks: [], loadedAt: null }),
}));
