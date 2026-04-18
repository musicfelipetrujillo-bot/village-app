import { create } from 'zustand';
import type { Specialist, Review, SpecialtyType } from 'shared/src/types/v1';
import { specialistsApi, type SearchFilters } from '@api/specialists';

interface ExpertsState {
  results: Specialist[];
  selectedSpecialist: Specialist | null;
  reviews: Review[];
  favorites: Set<string>;
  loading: boolean;
  filters: Partial<SearchFilters>;

  search: (filters: SearchFilters) => Promise<void>;
  selectSpecialist: (id: string) => Promise<void>;
  loadReviews: (specialistId: string) => Promise<void>;
  setFilters: (filters: Partial<SearchFilters>) => void;
  toggleFavorite: (userId: string, specialistId: string) => Promise<void>;
  loadFavorites: (userId: string) => Promise<void>;
}

export const useExpertsStore = create<ExpertsState>((set, get) => ({
  results: [],
  selectedSpecialist: null,
  reviews: [],
  favorites: new Set(),
  loading: false,
  filters: {},

  search: async (filters) => {
    set({ loading: true, filters });
    try {
      const results = await specialistsApi.search(filters);
      set({ results });
    } finally {
      set({ loading: false });
    }
  },

  selectSpecialist: async (id) => {
    set({ loading: true });
    try {
      const specialist = await specialistsApi.getById(id);
      set({ selectedSpecialist: specialist });
    } finally {
      set({ loading: false });
    }
  },

  loadReviews: async (specialistId) => {
    const reviews = await specialistsApi.getReviews(specialistId);
    set({ reviews });
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),

  toggleFavorite: async (userId, specialistId) => {
    const { favorites } = get();
    const isFavorited = favorites.has(specialistId);
    // Optimistic update
    const next = new Set(favorites);
    isFavorited ? next.delete(specialistId) : next.add(specialistId);
    set({ favorites: next });
    try {
      await specialistsApi.toggleFavorite(userId, specialistId, isFavorited);
    } catch {
      // Roll back on error
      set({ favorites });
    }
  },

  loadFavorites: async (userId) => {
    const ids = await specialistsApi.getFavorites(userId);
    set({ favorites: new Set(ids) });
  },
}));
