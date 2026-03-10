import { useParams } from 'react-router-dom';
import { useMarket, calculateOdds } from '../hooks/useMarkets';
import useBets from '../hooks/useBets';
import useAuth from '../hooks/useAuth';
import OddsBar from '../components/OddsBar';
import BetSlip from '../components/BetSlip';

const STATUS_BADGE = {
  open: 'badge-open',
  closed: 'badge-closed',
  resolved: 'badge-resolved',
  voided: 'badge-voided',
};

export default function Market() {
  const { id } = useParams();
  const { market, loading: mLoading, refetch: refetchMarket } = useMarket(id);
  const { bets, loading: bLoading, refetch: refetchBets } = useBets(id);
  const { user } = useAuth();

  if (mLoading || bLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!market) {
    return <div className="text-center py-20 text-gray-500">Market not found.</div>;
  }

  const options = market.options || [];
  const oddsData = calculateOdds(options, bets);

  // Check user's bets on this market
  const userBets = bets.filter((b) => b.user_id === user?.id);
  const userResult = market.status === 'resolved' && userBets.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className={STATUS_BADGE[market.status] || 'badge'}>{market.status}</span>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight mb-2">{market.title}</h1>
          {market.description && (
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">{market.description}</p>
          )}

          {/* Resolved banner */}
          {market.status === 'resolved' && (
            <div className="bg-accent-green/10 border border-accent-green/20 rounded-lg p-3 mb-4">
              <span className="text-sm font-semibold text-accent-green">
                Resolved: {market.outcome}
              </span>
            </div>
          )}

          {market.status === 'voided' && (
            <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3 mb-4">
              <span className="text-sm font-semibold text-gray-400">
                This market has been voided. All bets refunded.
              </span>
            </div>
          )}

          {/* Odds */}
          <div className="mb-4">
            <OddsBar options={options} percentages={oddsData.percentages} />
          </div>

          {/* Stats row */}
          <div className="flex gap-6 text-xs text-gray-500">
            <div>
              <span className="text-gray-400">Total Pool</span>
              <div className="font-mono text-sm text-gray-200 mt-0.5">
                {oddsData.totalPool.toLocaleString()} pts
              </div>
            </div>
            <div>
              <span className="text-gray-400">Bets</span>
              <div className="font-mono text-sm text-gray-200 mt-0.5">{bets.length}</div>
            </div>
            {market.closes_at && (
              <div>
                <span className="text-gray-400">Closes</span>
                <div className="font-mono text-sm text-gray-200 mt-0.5">
                  {new Date(market.closes_at).toLocaleDateString()} {new Date(market.closes_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
            <div>
              <span className="text-gray-400">Created by</span>
              <div className="text-sm text-gray-200 mt-0.5">
                {market.profiles?.username || 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        {/* User's result */}
        {userResult && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Your Bets on This Market</h3>
            {userBets.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-surface-200 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`badge-${b.status}`}>{b.status}</span>
                  <span className="text-sm text-gray-300">{b.option}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-gray-300">{b.amount} pts</span>
                  {b.payout != null && (
                    <span className="font-mono text-sm text-accent-green ml-2">
                      +{b.payout} pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Odds table */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Current Odds</h3>
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center justify-between py-2 px-3 bg-surface-100 rounded-lg">
                <span className="text-sm text-gray-200">{opt}</span>
                <div className="flex items-center gap-4 font-mono text-sm">
                  <span className="text-gray-400">{oddsData.pool[opt]?.toLocaleString() || 0} pts</span>
                  <span className="text-accent-blue font-semibold">
                    {oddsData.odds[opt] === Infinity ? '—' : `${oddsData.odds[opt]?.toFixed(2)}x`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bets table */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">All Bets ({bets.length})</h3>
          {bets.length === 0 ? (
            <p className="text-sm text-gray-500">No bets yet. Be the first!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
                    <th className="py-2 px-2 text-left">User</th>
                    <th className="py-2 px-2 text-left">Option</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                    <th className="py-2 px-2 text-right">Odds</th>
                    <th className="py-2 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.id} className="border-b border-surface-200 hover:bg-surface-50">
                      <td className="py-2 px-2 text-gray-300">
                        {bet.user_id === user?.id ? (
                          <span className="text-accent-blue font-medium">You</span>
                        ) : (
                          bet.profiles?.username || 'Anon'
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-300">{bet.option}</td>
                      <td className="py-2 px-2 text-right font-mono text-gray-300">{bet.amount}</td>
                      <td className="py-2 px-2 text-right font-mono text-gray-400">
                        {bet.odds_at_placement?.toFixed(2)}x
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`badge-${bet.status}`}>{bet.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar — Bet Slip */}
      <div className="space-y-4">
        <BetSlip
          market={market}
          odds={oddsData}
          onBetPlaced={() => {
            refetchBets();
            refetchMarket();
          }}
        />
      </div>
    </div>
  );
}
