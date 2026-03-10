import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { calculateOdds } from '../hooks/useMarkets';
import OddsBar from './OddsBar';

function timeLeft(dateStr) {
  if (!dateStr) return '';
  const diff = new Date(dateStr) - new Date();
  if (diff <= 0) return 'Closed';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_BADGE = {
  open: 'badge-open',
  closed: 'badge-closed',
  resolved: 'badge-resolved',
  voided: 'badge-voided',
};

export default function MarketCard({ market }) {
  const [oddsData, setOddsData] = useState(null);
  const options = market.options || [];

  useEffect(() => {
    async function load() {
      const { data: bets } = await supabase
        .from('bets')
        .select('option, amount, status')
        .eq('market_id', market.id);
      setOddsData(calculateOdds(options, bets || []));
    }
    load();
  }, [market.id]);

  return (
    <Link to={`/market/${market.id}`} className="card p-4 hover:border-surface-400 hover:bg-surface-100 transition-all duration-200 group block">
      <div className="flex items-start justify-between mb-2">
        <span className={`${STATUS_BADGE[market.status] || 'badge'}`}>
          {market.status}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-100 mb-3 leading-snug group-hover:text-white transition-colors line-clamp-2">
        {market.title}
      </h3>

      {oddsData && (
        <OddsBar options={options} percentages={oddsData.percentages} compact />
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-300">
        <span className="text-xs text-gray-500">
          {market.status === 'open' ? timeLeft(market.closes_at) : market.status === 'resolved' ? `Outcome: ${market.outcome}` : ''}
        </span>
        <span className="font-mono text-xs text-gray-400">
          {oddsData ? `${oddsData.totalPool.toLocaleString()} pts` : '—'}
        </span>
      </div>
    </Link>
  );
}
