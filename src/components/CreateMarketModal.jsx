import { useState } from 'react';
import { supabase } from '../supabaseClient';
import useAuth from '../hooks/useAuth';

const MARKET_COST = 100; // points to create a market instantly

export default function CreateMarketModal({ open, onClose, onCreated }) {
  const { user, profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState(null); // null = choosing, 'pay' | 'suggest'
  const [form, setForm] = useState({
    title: '',
    description: '',
    options: 'Yes, No',
    closes_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!open) return null;

  function handle(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  function reset() {
    setMode(null);
    setForm({ title: '', description: '', options: 'Yes, No', closes_at: '' });
    setError('');
    setSuccess('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePayToCreate() {
    setError('');
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if ((profile?.points || 0) < MARKET_COST) { setError(`You need at least ${MARKET_COST} points.`); return; }

    setLoading(true);
    try {
      const options = form.options.split(',').map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) { setError('Need at least 2 options.'); setLoading(false); return; }

      // Create the market
      const { error: mkErr } = await supabase.from('markets').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: 'School Events',
        options,
        status: 'open',
        created_by: user.id,
        closes_at: form.closes_at || null,
      });
      if (mkErr) throw mkErr;

      // Deduct points
      const { error: ptErr } = await supabase
        .from('profiles')
        .update({ points: (profile.points || 0) - MARKET_COST })
        .eq('id', user.id);
      if (ptErr) throw ptErr;

      // Log transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'bet_placed',
        amount: -MARKET_COST,
      });

      await refreshProfile();
      setSuccess('Market created! It\'s live now.');
      onCreated?.();
      setTimeout(handleClose, 1500);
    } catch (e) {
      setError(e.message || 'Failed to create market.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSuggest() {
    setError('');
    if (!form.title.trim()) { setError('Title is required.'); return; }

    setLoading(true);
    try {
      const options = form.options.split(',').map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) { setError('Need at least 2 options.'); setLoading(false); return; }

      const { error: sgErr } = await supabase.from('market_suggestions').insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        options,
        closes_at: form.closes_at || null,
      });
      if (sgErr) throw sgErr;

      setSuccess('Suggestion submitted! An admin will review it.');
      setTimeout(handleClose, 1500);
    } catch (e) {
      setError(e.message || 'Failed to submit suggestion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-surface-50 border border-surface-300 rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold">
            {mode === 'pay' ? 'Create Market' : mode === 'suggest' ? 'Suggest a Market' : 'New Market'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Mode selection */}
        {!mode && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-4">Choose how you want to add a market:</p>

            <button
              onClick={() => setMode('pay')}
              className="w-full text-left card p-4 hover:border-accent-blue hover:bg-surface-100 transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-100 group-hover:text-accent-blue transition-colors">
                  Pay to Create
                </span>
                <span className="font-mono text-sm font-bold text-accent-green">{MARKET_COST} pts</span>
              </div>
              <p className="text-xs text-gray-500">
                Goes live instantly. Costs {MARKET_COST} points.
              </p>
            </button>

            <button
              onClick={() => setMode('suggest')}
              className="w-full text-left card p-4 hover:border-accent-blue hover:bg-surface-100 transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-100 group-hover:text-accent-blue transition-colors">
                  Suggest for Free
                </span>
                <span className="font-mono text-sm text-gray-400">FREE</span>
              </div>
              <p className="text-xs text-gray-500">
                Submit an idea. An admin will review and approve it.
              </p>
            </button>

            <p className="text-[10px] text-gray-500 text-center pt-2">
              Balance: <span className="font-mono text-gray-300">{(profile?.points || 0).toLocaleString()} pts</span>
            </p>
          </div>
        )}

        {/* Market form (shared by both modes) */}
        {mode && !success && (
          <div className="space-y-3">
            {mode === 'pay' && (
              <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg px-3 py-2 text-xs text-accent-blue mb-2">
                This will cost <span className="font-mono font-bold">{MARKET_COST} pts</span> and go live immediately.
              </div>
            )}
            {mode === 'suggest' && (
              <div className="bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-xs text-gray-400 mb-2">
                Free to submit. An admin will review your suggestion.
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <input name="title" className="input-field" value={form.title} onChange={handle} placeholder="Will the cafeteria serve pizza on Friday?" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
              <textarea name="description" className="input-field h-16 resize-none" value={form.description} onChange={handle} placeholder="Add context…" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Options (comma-separated)</label>
              <input name="options" className="input-field font-mono" value={form.options} onChange={handle} placeholder="Yes, No" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Closes At</label>
              <input name="closes_at" type="datetime-local" className="input-field" value={form.closes_at} onChange={handle} />
            </div>

            {error && <p className="text-xs text-accent-red">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={mode === 'pay' ? handlePayToCreate : handleSuggest}
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Submitting…' : mode === 'pay' ? `Create (${MARKET_COST} pts)` : 'Submit Suggestion'}
              </button>
              <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost">Back</button>
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="text-center py-4">
            <div className="text-accent-green text-sm font-medium">{success}</div>
          </div>
        )}
      </div>
    </div>
  );
}
