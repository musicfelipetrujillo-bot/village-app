// V6 Milk Vault — Zustand store.
//
// Holds the vault settings, bags, transactions and derived stats for the
// signed-in user. Screens subscribe to slices; a single `fetchAll()` hydrates
// everything and recomputes the dashboard stats.

import { create } from 'zustand';
import {
  getSettings, ensureSettings, listBags, listTransactions, getMyLifestyleTags,
  type MilkVaultSettings, type MilkVaultBag, type MilkVaultTransaction, type LifestyleTag,
} from '@api/milkVault';
import {
  computeCoreStats, computeMarketplaceStats, computeLifetimeRollup,
  type VaultCoreStats, type VaultMarketplaceStats, type VaultLifetimeRollup,
} from '@utils/milkVaultCalc';

interface MilkVaultState {
  settings: MilkVaultSettings | null;
  bags: MilkVaultBag[];
  transactions: MilkVaultTransaction[];
  lifestyleTags: LifestyleTag[];

  core: VaultCoreStats | null;
  marketplace: VaultMarketplaceStats | null;
  lifetime: VaultLifetimeRollup | null;

  loading: boolean;
  loaded: boolean;

  fetchAll: () => Promise<void>;
  recompute: () => void;
  setSettings: (s: MilkVaultSettings) => void;
  reset: () => void;
}

export const useMilkVaultStore = create<MilkVaultState>((set, get) => ({
  settings: null,
  bags: [],
  transactions: [],
  lifestyleTags: [],
  core: null,
  marketplace: null,
  lifetime: null,
  loading: false,
  loaded: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      // Lazily create the settings row so first-open always has one to read.
      const settings = (await getSettings()) ?? (await ensureSettings());
      const [bags, transactions, lifestyleTags] = await Promise.all([
        listBags(),
        listTransactions(),
        getMyLifestyleTags(),
      ]);
      set({ settings, bags, transactions, lifestyleTags, loaded: true });
      get().recompute();
    } catch (err) {
      console.error('[milkVault] fetchAll error', err);
    } finally {
      set({ loading: false });
    }
  },

  recompute: () => {
    const { settings, bags, transactions } = get();
    if (!settings) {
      set({ core: null, marketplace: null, lifetime: null });
      return;
    }
    const core = computeCoreStats(bags, settings);
    const marketplace =
      settings.mode === 'marketplace' ? computeMarketplaceStats(core, settings) : null;
    const lifetime = computeLifetimeRollup(transactions);
    set({ core, marketplace, lifetime });
  },

  setSettings: (s) => {
    set({ settings: s });
    get().recompute();
  },

  reset: () =>
    set({
      settings: null, bags: [], transactions: [], lifestyleTags: [],
      core: null, marketplace: null, lifetime: null, loading: false, loaded: false,
    }),
}));
