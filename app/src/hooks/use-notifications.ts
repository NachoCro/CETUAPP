import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';

const KEY = ['notifications'] as const;

/** Notificaciones del usuario, actualizadas en tiempo real. */
export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AppNotification[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const markRead = useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (ids !== 'all') q = q.in('id', ids);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const unread = query.data?.filter((n) => !n.read_at).length ?? 0;

  return { query, unread, markRead };
}

/** A qué pantalla lleva cada notificación al tocarla. */
export function notificationHref(n: AppNotification): Href | null {
  if (n.data.claim_id) return '/reclamos';
  if (n.data.order_id) return '/copias';
  if (n.data.proposal_id) return '/propuestas';
  if (n.type === 'verificacion') return '/verificacion';
  return null;
}
