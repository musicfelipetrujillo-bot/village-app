// V4 Phase G4 — Gear store (browse + my listings + saved)
import { create } from 'zustand';
import {
  gearApi,
  type GearCard,
  type MyListingRow,
  type SavedListingRow,
  type ListGearParams,
} from '@api/gear';

interface GearState {
  feed: GearCard[];
  myListings: MyListingRow[];
  saved: SavedListingRow[];
  loading: boolean;
  loadedAt: number | null;

  fetchFeed: (params?: ListGearParams) => Promise<void>;
  fetchMyListings: () => Promise<void>;
  fetchSaved: () => Promise<void>;
  reset: () => void;
}

export const useGearStore = create<GearState>((set) => ({
  feed: [],
  myListings: [],
  saved: [],
  loading: false,
  loadedAt: null,

  fetchFeed: async (params) => {
    set({ loading: true });
    try {
      const rows = await gearApi.listGear(params);
      set({ feed: rows, loadedAt: Date.now() });
    } catch (err) {
      console.error('[gear] fetchFeed', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchMyListings: async () => {
    try {
      const rows = await gearApi.listMyListings();
      set({ myListings: rows });
    } catch (err) {
      console.error('[gear] fetchMyListings', err);
    }
  },

  fetchSaved: async () => {
    try {
      const rows = await gearApi.listMySaved();
      set({ saved: rows });
    } catch (err) {
      console.error('[gear] fetchSaved', err);
    }
  },

  reset: () => set({ feed: [], myListings: [], saved: [], loadedAt: null }),
}));
