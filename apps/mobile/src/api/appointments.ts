import { supabase } from '@/lib/supabase';
import type { Appointment } from 'shared/src/types/v1';

export interface CreateAppointmentPayload {
  user_id: string;
  specialist_id: string;
  source: 'calendly' | 'in_app';
  appointment_at: string; // ISO 8601
  service_type?: string;
  is_telehealth: boolean;
  amount_cents?: number;
  stripe_payment_intent_id?: string;
}

export const appointmentsApi = {
  create: async (payload: CreateAppointmentPayload): Promise<Appointment> => {
    const { data, error } = await supabase
      .from('appointments')
      .insert({ ...payload, status: 'confirmed' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getMyAppointments: async (userId: string): Promise<Appointment[]> => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, specialists(full_name, specialty, credentials, practice_name)')
      .eq('user_id', userId)
      .order('appointment_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  getById: async (id: string): Promise<Appointment & { specialists?: any }> => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, specialists(full_name, specialty, credentials, practice_name, phone)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
};
