import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import LeaderboardTable from '../components/LeaderboardTable';

function calculateCalibration(bets) {
  const resolved = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  if (resolved.length < 10) return null;

  const buckets = [
    { min: 1.0, max: 1.5 },
    { min: 1.5, max: 2.0 },
    { min: 2.0, max: 3.0 },
    { min: 3.0, max: Infinity },
  ];

  let totalDiff = 0;
  let bucketsUsed = 0;

  buckets.forEach((bucket) => {
    const inBucket = resolved.filter(
      (b) => b.odds_at_placement >= bucket.min && b.odds_at_placement < bucket.max
    );
    if (inBucket.length === 0) return;
    const wins = inBucket.filter((b) => b.status === 'won').length;
    const actualWinRate = wins / inBucket.length;
    const midOdds = bucket.max === Infinity ? bucket.min + 1 : (bucket.min + bucket.max) / 2;
    const impliedProb = 1 / midOdds;
    totalDiff += Math.abs(impliedProb - actualWinRate);
    bucketsUsed++;
  });

  if (bucketsUsed === 0) return null;
  return Math.max(0, 100 - (totalDiff / bucketsUsed) * 100);
}

export default function Leaderboard() {
  const [tab, setTab] = useState('all');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 25;

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Get all profiles
      const { data: profiles, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('points', { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

      setTotal(count || 0);

      if (!profiles || profiles.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Get all bets for these users
      const userIds = profiles.map((p) => p.id);
      let betsQuery = supabase
        .from('bets')
        .select('user_id, market_id, status, odds_at_placement')
        .in('user_id', userIds);

      if (tab === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        betsQuery = betsQuery.gte('placed_at', weekAgo.toISOString());
      }

      const { data: allBets } = await betsQuery;

      const enriched = profiles.map((p) => {
        const userBets = (allBets || []).filter((b) => b.user_id === p.id);
        const resolved = userBets.filter((b) => b.status === 'won' || b.status === 'lost');
        const wins = resolved.filter((b) => b.status === 'won').length;
        const marketCount = new Set(userBets.map((b) => b.market_id)).size;

        return {
          ...p,
          marketCount,
          winRate: resolved.length > 0 ? (wins / resolved.length) * 100 : null,
          calibration: calculateCalibration(userBets),
        };
      });

      // Sort by points for all-time, or by win rate for weekly
      if (tab === 'week') {
        enriched.sort((a, b) => (b.winRate || 0) - (a.winRate || 0));
      }

      setEntries(enriched);
      setLoading(false);
    }
    load();
  }, [tab, page]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight">Leaderboard</h1>
        <div className="flex gap-1">
          <button
            onClick={() => { setTab('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'all' ? 'bg-accent-blue text-white' : 'bg-surface-100 text-gray-400 hover:text-gray-200'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => { setTab('week'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'week' ? 'bg-accent-blue text-white' : 'bg-surface-100 text-gray-400 hover:text-gray-200'
            }`}
          >
            This Week
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm">No users yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <LeaderboardTable entries={entries} page={page} setPage={setPage} total={total} />
        </div>
      )}
    </div>
  );
}
