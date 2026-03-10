import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function useBets(marketId) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchBets() {
    const { data, error } = await supabase
      .from('bets')
      .select('*, profiles(username)')
      .eq('market_id', marketId)
      .order('placed_at', { ascending: false });
    if (!error) setBets(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!marketId) return;
    fetchBets();

    const channel = supabase
      .channel(`bets-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
          filter: `market_id=eq.${marketId}`,
        },
        () => {
          fetchBets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  return { bets, loading, refetch: fetchBets };
}

export function useUserBets(userId) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchBets() {
    if (!userId) return;
    const { data, error } = await supabase
      .from('bets')
      .select('*, markets(title, status, outcome)')
      .eq('user_id', userId)
      .order('placed_at', { ascending: false });
    if (!error) setBets(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchBets();
  }, [userId]);

  return { bets, loading, refetch: fetchBets };
}
