import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function useMarkets(filters = {}) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchMarkets() {
    setLoading(true);
    let query = supabase
      .from('markets')
      .select('*, profiles!markets_created_by_fkey(username)')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (!error) setMarkets(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchMarkets();
  }, [filters.status]);

  return { markets, loading, refetch: fetchMarkets };
}

export function useMarket(id) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchMarket() {
    const { data, error } = await supabase
      .from('markets')
      .select('*, profiles!markets_created_by_fkey(username)')
      .eq('id', id)
      .single();
    if (!error) setMarket(data);
    setLoading(false);
  }

  useEffect(() => {
    if (id) fetchMarket();
  }, [id]);

  return { market, loading, refetch: fetchMarket };
}

export function calculateOdds(options, bets) {
  const pool = {};
  let totalPool = 0;

  options.forEach((opt) => {
    pool[opt] = 0;
  });

  bets.forEach((bet) => {
    if (bet.status === 'active' || bet.status === 'won' || bet.status === 'lost') {
      pool[bet.option] = (pool[bet.option] || 0) + bet.amount;
      totalPool += bet.amount;
    }
  });

  const odds = {};
  const percentages = {};
  options.forEach((opt) => {
    if (pool[opt] > 0 && totalPool > 0) {
      odds[opt] = totalPool / pool[opt];
      percentages[opt] = (pool[opt] / totalPool) * 100;
    } else if (totalPool === 0) {
      odds[opt] = options.length;
      percentages[opt] = 100 / options.length;
    } else {
      odds[opt] = Infinity;
      percentages[opt] = 0;
    }
  });

  return { odds, percentages, pool, totalPool };
}
