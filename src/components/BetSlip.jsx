import { useState } from 'react';
import { supabase } from '../supabaseClient';
import useAuth from '../hooks/useAuth';
import { OPTION_COLORS } from './OddsBar';

export default function BetSlip({ market, odds, onBetPlaced }) {
  const { user, profile, refreshProfile } = useAuth();
  const [selectedOption, setSelectedOption] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const options = market.options || [];
  const numAmount = parseInt(amount) || 0;
  const currentOdds = selectedOption && odds?.odds?.[selectedOption] ? odds.odds[selectedOption] : 0;
  const estimatedPayout = currentOdds && currentOdds !== Infinity
    ? Math.floor(numAmount * currentOdds * 0.95)
    : 0;

  async function placeBet() {
    setError('');
    setSuccess('');

    if (!user) { setError('You must be logged in.'); return; }
    if (!selectedOption) { setError('Select an option.'); return; }
    if (numAmount <= 0) { setError('Enter a valid amount.'); return; }
    if (numAmount > (profile?.points || 0)) { setError('Insufficient points.'); return; }
    if (market.status !== 'open') { setError('Market is not open.'); return; }
    if (market.closes_at && new Date(market.closes_at) < new Date()) { setError('Market has closed.'); return; }

    setLoading(true);
    try {
      // Insert bet
      const { error: betErr } = await supabase.from('bets').insert({
        user_id: user.id,
        market_id: market.id,
        option: selectedOption,
        amount: numAmount,
        odds_at_placement: currentOdds === Infinity ? 999 : parseFloat(currentOdds.toFixed(4)),
        status: 'active',
      });
      if (betErr) throw betErr;

      // Deduct points
      const { error: ptErr } = await supabase
        .from('profiles')
        .update({ points: (profile.points || 0) - numAmount })
        .eq('id', user.id);
      if (ptErr) throw ptErr;

      // Log transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'bet_placed',
        amount: -numAmount,
      });

      await refreshProfile();
      setSuccess(`Bet placed! ${numAmount} pts on "${selectedOption}"`);
      setAmount('');
      setSelectedOption(null);
      onBetPlaced?.();
    } catch (e) {
      setError(e.message || 'Failed to place bet.');
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="card p-4 text-center text-sm text-gray-400">
        <a href="/login" className="text-accent-blue hover:underline">Log in</a> to place bets
      </div>
    );
  }

  if (market.status !== 'open') return null;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Place a Bet</h3>

      {/* Option selection */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {options.map((opt, i) => {
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          const isSelected = selectedOption === opt;
          return (
            <button
              key={opt}
              onClick={() => setSelectedOption(opt)}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                isSelected
                  ? `border-current ${color.text} bg-surface-200`
                  : 'border-surface-300 text-gray-300 hover:border-surface-400 hover:bg-surface-100'
              }`}
            >
              <span>{opt}</span>
              {odds?.odds?.[opt] && (
                <span className="ml-2 font-mono text-xs opacity-70">
                  {odds.odds[opt] === Infinity ? '—' : `${odds.odds[opt].toFixed(2)}x`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">Amount (pts)</label>
        <input
          type="number"
          className="input-field font-mono"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={1}
          max={profile?.points || 0}
        />
        <div className="flex gap-2 mt-2">
          {[10, 50, 100, 250].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="flex-1 text-xs font-mono py-1 rounded bg-surface-200 hover:bg-surface-300 text-gray-300 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated payout */}
      {selectedOption && numAmount > 0 && (
        <div className="bg-surface-200 rounded-lg p-3 mb-3 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Stake</span>
            <span className="font-mono">{numAmount.toLocaleString()} pts</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Current Odds</span>
            <span className="font-mono">{currentOdds === Infinity ? '—' : `${currentOdds.toFixed(2)}x`}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-accent-green pt-1 border-t border-surface-300">
            <span>Est. Payout</span>
            <span className="font-mono">{estimatedPayout.toLocaleString()} pts</span>
          </div>
          <p className="text-[10px] text-gray-500 pt-1">
            5% house rake applied. Final payout depends on pool at resolution.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-accent-red mb-2">{error}</p>}
      {success && <p className="text-xs text-accent-green mb-2">{success}</p>}

      <button
        onClick={placeBet}
        disabled={loading || !selectedOption || numAmount <= 0}
        className="btn-primary w-full"
      >
        {loading ? 'Placing…' : 'Confirm Bet'}
      </button>

      <p className="text-[10px] text-gray-500 text-center mt-2">
        Balance: <span className="font-mono text-gray-300">{(profile?.points || 0).toLocaleString()} pts</span>
      </p>
    </div>
  );
}
