import { supabase } from '@/lib/supabase';

export interface Message {
  id: string;
  sender_id: string;
  specialist_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export const messagesApi = {
  /** Fetch all messages in a thread between a user and a specialist */
  getThread: async (specialistId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('specialist_id', specialistId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /** Send a message from the current user to a specialist */
  send: async (senderId: string, specialistId: string, body: string): Promise<void> => {
    const { error } = await supabase
      .from('messages')
      .insert({ sender_id: senderId, specialist_id: specialistId, body });
    if (error) throw error;
  },

  /** Mark all unread messages from the specialist as read */
  markThreadRead: async (specialistId: string, userId: string): Promise<void> => {
    // Mark messages sent by the specialist (i.e., not by the user) as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('specialist_id', specialistId)
      .neq('sender_id', userId)
      .is('read_at', null);
  },

  /**
   * Subscribe to NEW messages in a 1:1 specialist thread via Supabase Realtime.
   *
   * Filter narrows server-push payload to this specialist; RLS still gates
   * each subscriber to their own thread (a user can only see rows where
   * sender_id = auth.uid() OR specialist's user — see migration 002 policies).
   * Returns an unsubscribe function.
   */
  subscribeToThread: (specialistId: string, onNew: (row: Message) => void): (() => void) => {
    const channel = supabase
      .channel(`messages:${specialistId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `specialist_id=eq.${specialistId}`,
        },
        (payload) => onNew(payload.new as Message),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
};
