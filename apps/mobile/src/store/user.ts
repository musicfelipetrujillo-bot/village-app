import { create } from 'zustand';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  pregnancy_stage: string | null;
  due_date: string | null;
  preferred_language: 'en' | 'es';
  insurance_provider: string | null;
  zip_code: string | null;
}

interface UserState {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
