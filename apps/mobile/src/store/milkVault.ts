import { create } from 'zustand';
import type { MilkBag, MilkVaultSettings } from '@api/milkVault';
import { getMyBags, getMyVaultSettings } from '@api/milkVault';

interface MilkVaultState {
  settings: MilkVaultSettings | null;
  bags: MilkBag[];
  loading: boolean;
  loaded: boolean;

  setSettings: (s: MilkVaultSettings | null) => void;
  setBags: (b: MilkBag[]) => void;
  /** Optimistic helpers so the dashboard totals update immediately after a save. */
  addBagLocal: (bag: MilkBag) => void;
  removeBagLocal: (bagId: string) => void;

  fetchVault: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useMilkVaultStore = create<MilkVaultState>((set) => ({
  settings: null,
  bags: [],
  loading: false,
  loaded: false,

  setSettings: (s) => set({ settings: s }),
  setBags: (b) => set({ bags: b }),
  addBagLocal: (bag) => set((st) => ({ bags: [bag, ...st.bags] })),
  removeBagLocal: (bagId) => set((st) => ({ bags: st.bags.filter((x) => x.id !== bagId) })),

  fetchVault: async (userId) => {
    set({ loading: true });
    try {
      const [settings, bags] = await Promise.all([
        getMyVaultSettings(userId),
        getMyBags(userId),
      ]);
      set({ settings, bags, loaded: true });
    } catch (err) {
      console.error('fetchVault error:', err);
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ settings: null, bags: [], loading: false, loaded: false }),
}));
