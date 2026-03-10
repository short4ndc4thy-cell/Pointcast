import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import useAuth from '../hooks/useAuth';

function calculateCalibration(bets) {
  const resolved = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  if (resolved.length < 10) return null;

  const buckets = [
    { label: '1.0–1.5x', min: 1.0, max: 1.5 },
    { label: '1.5–2.0x', min: 1.5, max: 2.0 },
    { label: '2.0–3.0x', min: 2.0, max: 3.0 },
    { label: '3.0x+', min: 3.0, max: Infinity },
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

function calculateWinRate(bets) {
  const resolved = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  if (resolved.length === 0) return null;
  return (resolved.filter((b) => b.status === 'won').length / resolved.length) * 100;
}

export default function Profile() {
  const { userId } = useParams();
  const { user, profile: ownProfile } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [bets, setBets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tab, setTab] = useState('bets');
  const [loading, setLoading] = useState(true);

  const isOwn = !userId || userId === user?.id;
  const targetId = isOwn ? user?.id : userId;

  useEffect(() => {
    async function load() {
      if (!targetId) { setLoading(false); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single();
      setProfileData(prof);

      const { data: userBets } = await supabase
        .from('bets')
        .select('*, markets(title, status, outcome)')
        .eq('user_id', targetId)
        .order('placed_at', { ascending: false });
      setBets(userBets || []);

      if (isOwn) {
        const { data: txns } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', targetId)
          .order('created_at', { ascending: false })
          .limit(100);
        setTransactions(txns || []);
      }

      setLoading(false);
    }
    load();
  }, [targetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profileData) {
    return <div className="text-center py-20 text-gray-500">User not found.</div>;
  }

  const calibration = calculateCalibration(bets);
  const winRate = calculateWinRate(bets);
  const marketsEntered = new Set(bets.map((b) => b.market_id)).size;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight">
              {profileData.username}
              {isOwn && <span className="text-sm text-gray-500 font-normal ml-2">(you)</span>}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Joined {new Date(profileData.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-accent-green">
                {profileData.points?.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Points</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-gray-200">{marketsEntered}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Markets</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-gray-200">
                {winRate != null ? `${winRate.toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-accent-blue">
                {calibration != null ? calibration.toFixed(0) : '—'}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Calibration</div>
            </div>
          </div>
        </div>
        {calibration == null && bets.length > 0 && (
          <p className="text-xs text-gray-500 mt-3">Calibration requires at least 10 resolved bets.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab('bets')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'bets' ? 'bg-accent-blue text-white' : 'bg-surface-100 text-gray-400 hover:text-gray-200'
          }`}
        >
          Bet History
        </button>
        {isOwn && (
          <button
            onClick={() => setTab('transactions')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'transactions' ? 'bg-accent-blue text-white' : 'bg-surface-100 text-gray-400 hover:text-gray-200'
            }`}
          >
            Transactions
          </button>
        )}
      </div>

      {/* Bets tab */}
      {tab === 'bets' && (
        <div className="card overflow-hidden">
          {bets.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">No bets yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
                    <th className="py-3 px-4 text-left">Market</th>
                    <th className="py-3 px-4 text-left">Option</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Odds</th>
                    <th className="py-3 px-4 text-right">Payout</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.id} className="border-b border-surface-200 hover:bg-surface-50">
                      <td className="py-2.5 px-4 text-gray-300 max-w-[200px] truncate">
                        {bet.markets?.title || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-gray-300">{bet.option}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-gray-300">{bet.amount}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-gray-400">
                        {bet.odds_at_placement?.toFixed(2)}x
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-accent-green">
                        {bet.payout != null ? `+${bet.payout}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className={`badge-${bet.status}`}>{bet.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && isOwn && (
        <div className="card overflow-hidden">
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
                    <th className="py-3 px-4 text-left">Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-surface-200 hover:bg-surface-50">
                      <td className="py-2.5 px-4 text-gray-300 font-mono text-xs">
                        {tx.type}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-semibold ${
                        tx.amount >= 0 ? 'text-accent-green' : 'text-accent-red'
                      }`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-500 text-xs">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
