import { supabase } from './supabase';
import type { PregnancyStage, SupportedLanguage } from 'shared/src/types/v1';

export const authService = {
  signUp: async (email: string, password: string, fullName: string) => {
    // The public.users mirror row is created by the AFTER INSERT trigger
    // `on_auth_user_created` (migration 044). Don't insert from the client —
    // on hosted Supabase, signUp returns no session when email-confirm is
    // required, so a client-side insert would run as anon and silently
    // RLS-block. The trigger runs as SECURITY DEFINER and is unconditional.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  updateProfile: async (
    userId: string,
    updates: {
      pregnancy_stage?: PregnancyStage;
      due_date?: string;
      preferred_language?: SupportedLanguage;
      insurance_provider?: string;
      zip_code?: string;
      phone?: string;
    }
  ) => {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  },

  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },
};
