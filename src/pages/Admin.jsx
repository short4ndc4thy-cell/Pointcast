import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import useAuth from '../hooks/useAuth';

// ─── Modal Shell ──────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-50 border border-surface-300 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Platform Stats ───────────────────────────────────────
function PlatformStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      const [
        { count: totalUsers },
        { count: totalMarkets },
        { count: openMarkets },
        { count: resolvedMarkets },
        { count: voidedMarkets },
        { count: totalBets },
        { data: pointsData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('markets').select('*', { count: 'exact', head: true }),
        supabase.from('markets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('markets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('markets').select('*', { count: 'exact', head: true }).eq('status', 'voided'),
        supabase.from('bets').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('points'),
      ]);

      const totalPoints = (pointsData || []).reduce((s, p) => s + (p.points || 0), 0);
      setStats({ totalUsers, totalMarkets, openMarkets, resolvedMarkets, voidedMarkets, totalBets, totalPoints });
    }
    load();
  }, []);

  if (!stats) return null;

  const items = [
    { label: 'Users', value: stats.totalUsers },
    { label: 'Markets', value: stats.totalMarkets },
    { label: 'Open', value: stats.openMarkets },
    { label: 'Resolved', value: stats.resolvedMarkets },
    { label: 'Voided', value: stats.voidedMarkets },
    { label: 'Total Bets', value: stats.totalBets },
    { label: 'Points in Circ.', value: stats.totalPoints?.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
      {items.map((it) => (
        <div key={it.label} className="card p-3 text-center">
          <div className="font-mono text-lg font-bold text-gray-100">{it.value}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Markets Manager ──────────────────────────────────────
function MarketsManager() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editMarket, setEditMarket] = useState(null);
  const [resolveMarket, setResolveMarket] = useState(null);
  const [resolveOutcome, setResolveOutcome] = useState('');

  const fetchMarkets = useCallback(async () => {
    const { data } = await supabase
      .from('markets')
      .select('*, bets(count)')
      .order('created_at', { ascending: false });
    setMarkets(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  async function handleCreate(form) {
    const options = form.options.split(',').map((o) => o.trim()).filter(Boolean);
    const { error } = await supabase.from('markets').insert({
      title: form.title,
      description: form.description,
      category: form.category,
      options,
      status: 'open',
      created_by: user.id,
      closes_at: form.closes_at || null,
    });
    if (error) { alert(error.message); return; }
    setCreateOpen(false);
    fetchMarkets();
  }

  async function handleEdit(form) {
    const { error } = await supabase.from('markets').update({
      title: form.title,
      description: form.description,
      category: form.category,
      closes_at: form.closes_at || null,
    }).eq('id', editMarket.id);
    if (error) { alert(error.message); return; }
    setEditMarket(null);
    fetchMarkets();
  }

  async function handleResolve() {
    if (!resolveOutcome) return;
    const market = resolveMarket;

    // Update market
    await supabase.from('markets').update({
      status: 'resolved',
      outcome: resolveOutcome,
      resolved_at: new Date().toISOString(),
    }).eq('id', market.id);

    // Get all active bets on this market
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('market_id', market.id)
      .eq('status', 'active');

    if (bets && bets.length > 0) {
      const totalPool = bets.reduce((s, b) => s + b.amount, 0);
      const winningBets = bets.filter((b) => b.option === resolveOutcome);
      const losingBets = bets.filter((b) => b.option !== resolveOutcome);
      const winningPool = winningBets.reduce((s, b) => s + b.amount, 0);

      // Update losers
      for (const bet of losingBets) {
        await supabase.from('bets').update({ status: 'lost', payout: 0 }).eq('id', bet.id);
      }

      // Pay winners
      for (const bet of winningBets) {
        const payout = winningPool > 0
          ? Math.floor((bet.amount / winningPool) * totalPool * 0.95)
          : 0;

        await supabase.from('bets').update({ status: 'won', payout }).eq('id', bet.id);

        // Credit user
        const { data: prof } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', bet.user_id)
          .single();

        await supabase.from('profiles')
          .update({ points: (prof?.points || 0) + payout })
          .eq('id', bet.user_id);

        await supabase.from('transactions').insert({
          user_id: bet.user_id,
          type: 'payout',
          amount: payout,
          reference_id: bet.id,
        });
      }
    }

    setResolveMarket(null);
    setResolveOutcome('');
    fetchMarkets();
  }

  async function handleVoid(market) {
    if (!confirm('Void this market? All bets will be refunded.')) return;

    await supabase.from('markets').update({ status: 'voided' }).eq('id', market.id);

    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('market_id', market.id)
      .eq('status', 'active');

    if (bets) {
      for (const bet of bets) {
        await supabase.from('bets').update({ status: 'refunded', payout: bet.amount }).eq('id', bet.id);

        const { data: prof } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', bet.user_id)
          .single();

        await supabase.from('profiles')
          .update({ points: (prof?.points || 0) + bet.amount })
          .eq('id', bet.user_id);

        await supabase.from('transactions').insert({
          user_id: bet.user_id,
          type: 'refund',
          amount: bet.amount,
          reference_id: bet.id,
        });
      }
    }
    fetchMarkets();
  }

  async function handleClose(market) {
    await supabase.from('markets').update({ status: 'closed' }).eq('id', market.id);
    fetchMarkets();
  }

  async function handleDelete(market) {
    if (!confirm('Delete this market permanently?')) return;
    const { error } = await supabase.from('markets').delete().eq('id', market.id);
    if (error) { alert(error.message); return; }
    fetchMarkets();
  }

  const STATUS_BADGE = { open: 'badge-open', closed: 'badge-closed', resolved: 'badge-resolved', voided: 'badge-voided' };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-bold">Markets</h2>
        <button onClick={() => setCreateOpen(true)} className="btn-primary text-sm">+ Create Market</button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
                <th className="py-2 px-3 text-left">Title</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-right">Bets</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => {
                const betCount = m.bets?.[0]?.count || 0;
                return (
                  <tr key={m.id} className="border-b border-surface-200 hover:bg-surface-50">
                    <td className="py-2 px-3 text-gray-200 max-w-[250px] truncate">{m.title}</td>
                    <td className="py-2 px-3"><span className={STATUS_BADGE[m.status]}>{m.status}</span></td>
                    <td className="py-2 px-3 text-right font-mono text-gray-400">{betCount}</td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {m.status === 'open' && (
                          <>
                            <button onClick={() => { setResolveMarket(m); setResolveOutcome(''); }} className="text-xs px-2 py-1 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20">Resolve</button>
                            <button onClick={() => handleClose(m)} className="text-xs px-2 py-1 rounded bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/20">Close</button>
                            <button onClick={() => handleVoid(m)} className="text-xs px-2 py-1 rounded bg-gray-500/10 text-gray-400 hover:bg-gray-500/20">Void</button>
                          </>
                        )}
                        {m.status === 'closed' && (
                          <>
                            <button onClick={() => { setResolveMarket(m); setResolveOutcome(''); }} className="text-xs px-2 py-1 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20">Resolve</button>
                            <button onClick={() => handleVoid(m)} className="text-xs px-2 py-1 rounded bg-gray-500/10 text-gray-400 hover:bg-gray-500/20">Void</button>
                          </>
                        )}
                        <button onClick={() => setEditMarket(m)} className="text-xs px-2 py-1 rounded bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20">Edit</button>
                        <button
                          onClick={() => handleDelete(m)}
                          disabled={betCount > 0}
                          className="text-xs px-2 py-1 rounded bg-accent-red/10 text-accent-red hover:bg-accent-red/20 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Market">
        <MarketForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editMarket} onClose={() => setEditMarket(null)} title="Edit Market">
        {editMarket && (
          <MarketForm
            initial={editMarket}
            onSubmit={handleEdit}
            onCancel={() => setEditMarket(null)}
            isEdit
          />
        )}
      </Modal>

      {/* Resolve Modal */}
      <Modal open={!!resolveMarket} onClose={() => setResolveMarket(null)} title="Resolve Market">
        {resolveMarket && (
          <div>
            <p className="text-sm text-gray-300 mb-4">{resolveMarket.title}</p>
            <p className="text-xs text-gray-500 mb-2">Select the winning outcome:</p>
            <div className="space-y-2 mb-4">
              {(resolveMarket.options || []).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setResolveOutcome(opt)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    resolveOutcome === opt
                      ? 'border-accent-green bg-accent-green/10 text-accent-green'
                      : 'border-surface-300 text-gray-300 hover:border-surface-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleResolve} disabled={!resolveOutcome} className="btn-primary flex-1">
                Confirm Resolution
              </button>
              <button onClick={() => setResolveMarket(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MarketForm({ initial, onSubmit, onCancel, isEdit = false }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    category: 'School Events',
    options: initial?.options?.join(', ') || 'Yes, No',
    closes_at: initial?.closes_at ? initial.closes_at.slice(0, 16) : '',
  });

  function handle(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Title</label>
        <input name="title" className="input-field" value={form.title} onChange={handle} required />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Description</label>
        <textarea name="description" className="input-field h-20 resize-none" value={form.description} onChange={handle} />
      </div>
      {!isEdit && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Options (comma-separated)</label>
          <input name="options" className="input-field font-mono" value={form.options} onChange={handle} placeholder="Yes, No" />
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Closes At</label>
        <input name="closes_at" type="datetime-local" className="input-field" value={form.closes_at} onChange={handle} />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSubmit(form)} className="btn-primary flex-1">
          {isEdit ? 'Save Changes' : 'Create Market'}
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

// ─── Bets Manager ─────────────────────────────────────────
function BetsManager() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchBets = useCallback(async () => {
    let query = supabase
      .from('bets')
      .select('*, profiles(username), markets(title)')
      .order('placed_at', { ascending: false })
      .limit(200);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data } = await query;
    setBets(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  async function removeBet(bet) {
    if (!confirm(`Remove this bet and refund ${bet.amount} pts to ${bet.profiles?.username}?`)) return;

    await supabase.from('bets').update({ status: 'removed', payout: bet.amount }).eq('id', bet.id);

    const { data: prof } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', bet.user_id)
      .single();

    await supabase.from('profiles')
      .update({ points: (prof?.points || 0) + bet.amount })
      .eq('id', bet.user_id);

    await supabase.from('transactions').insert({
      user_id: bet.user_id,
      type: 'refund',
      amount: bet.amount,
      reference_id: bet.id,
    });

    fetchBets();
  }

  const filtered = bets.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.profiles?.username?.toLowerCase().includes(s) ||
      b.markets?.title?.toLowerCase().includes(s) ||
      b.option?.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <h2 className="text-lg font-display font-bold mb-4">Bets</h2>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          className="input-field flex-1"
          placeholder="Search by user, market, option…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input-field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['active', 'won', 'lost', 'refunded', 'removed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
                <th className="py-2 px-3 text-left">User</th>
                <th className="py-2 px-3 text-left">Market</th>
                <th className="py-2 px-3 text-left">Option</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3 text-right">Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((bet) => (
                <tr key={bet.id} className="border-b border-surface-200 hover:bg-surface-50">
                  <td className="py-2 px-3">
                    <a href={`/profile/${bet.user_id}`} className="text-accent-blue hover:underline text-xs">
                      {bet.profiles?.username || 'Unknown'}
                    </a>
                  </td>
                  <td className="py-2 px-3 text-gray-300 max-w-[180px] truncate text-xs">{bet.markets?.title}</td>
                  <td className="py-2 px-3 text-gray-300 text-xs">{bet.option}</td>
                  <td className="py-2 px-3 text-right font-mono text-gray-300">{bet.amount}</td>
                  <td className="py-2 px-3 text-right"><span className={`badge-${bet.status}`}>{bet.status}</span></td>
                  <td className="py-2 px-3 text-right">
                    {bet.status === 'active' && (
                      <button
                        onClick={() => removeBet(bet)}
                        className="text-xs px-2 py-1 rounded bg-accent-red/10 text-accent-red hover:bg-accent-red/20"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Users Manager ────────────────────────────────────────
function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjustUser, setAdjustUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!profiles) { setLoading(false); return; }

    // Get bet counts
    const { data: betCounts } = await supabase
      .from('bets')
      .select('user_id');

    const countMap = {};
    (betCounts || []).forEach((b) => {
      countMap[b.user_id] = (countMap[b.user_id] || 0) + 1;
    });

    setUsers(profiles.map((p) => ({ ...p, betCount: countMap[p.id] || 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function toggleAdmin(u) {
    await supabase.from('profiles').update({ is_admin: !u.is_admin }).eq('id', u.id);
    fetchUsers();
  }

  async function toggleBan(u) {
    await supabase.from('profiles').update({ is_banned: !u.is_banned }).eq('id', u.id);
    fetchUsers();
  }

  async function handleAdjust() {
    const amt = parseInt(adjustAmount);
    if (!amt || !adjustUser) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', adjustUser.id)
      .single();

    await supabase.from('profiles')
      .update({ points: (prof?.points || 0) + amt })
      .eq('id', adjustUser.id);

    await supabase.from('transactions').insert({
      user_id: adjustUser.id,
      type: 'admin_adjustment',
      amount: amt,
    });

    setAdjustUser(null);
    setAdjustAmount('');
    setAdjustReason('');
    fetchUsers();
  }

  return (
    <div>
      <h2 className="text-lg font-display font-bold mb-4">Users</h2>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
                <th className="py-2 px-3 text-left">Username</th>
                <th className="py-2 px-3 text-right">Points</th>
                <th className="py-2 px-3 text-right">Bets</th>
                <th className="py-2 px-3 text-center">Admin</th>
                <th className="py-2 px-3 text-center">Banned</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-surface-200 hover:bg-surface-50 ${u.is_banned ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-3">
                    <a href={`/profile/${u.id}`} className="text-gray-200 hover:text-accent-blue text-xs">
                      {u.username}
                    </a>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-accent-green">{u.points?.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono text-gray-400">{u.betCount}</td>
                  <td className="py-2 px-3 text-center">
                    {u.is_admin ? <span className="text-accent-blue text-xs font-mono">YES</span> : <span className="text-gray-500 text-xs font-mono">no</span>}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {u.is_banned ? <span className="text-accent-red text-xs font-mono">BANNED</span> : <span className="text-gray-500 text-xs font-mono">no</span>}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-1 justify-end flex-wrap">
                      <button onClick={() => toggleAdmin(u)} className="text-xs px-2 py-1 rounded bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20">
                        {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                      </button>
                      <button onClick={() => toggleBan(u)} className="text-xs px-2 py-1 rounded bg-accent-red/10 text-accent-red hover:bg-accent-red/20">
                        {u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                      <button onClick={() => setAdjustUser(u)} className="text-xs px-2 py-1 rounded bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/20">
                        Adjust Pts
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Points Modal */}
      <Modal open={!!adjustUser} onClose={() => setAdjustUser(null)} title={`Adjust Points — ${adjustUser?.username}`}>
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Current balance: <span className="font-mono text-accent-green">{adjustUser?.points?.toLocaleString()} pts</span></p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (positive to add, negative to subtract)</label>
            <input type="number" className="input-field font-mono" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reason</label>
            <input className="input-field" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdjust} disabled={!adjustAmount} className="btn-primary flex-1">Apply</button>
            <button onClick={() => setAdjustUser(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Suggestions Manager ──────────────────────────────────
function SuggestionsManager() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    const { data } = await supabase
      .from('market_suggestions')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });
    setSuggestions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  async function handleApprove(suggestion) {
    // Create market from suggestion
    const { error: mkErr } = await supabase.from('markets').insert({
      title: suggestion.title,
      description: suggestion.description,
      category: 'School Events',
      options: suggestion.options,
      status: 'open',
      created_by: suggestion.user_id,
      closes_at: suggestion.closes_at || null,
    });
    if (mkErr) { alert(mkErr.message); return; }

    // Mark suggestion as approved
    await supabase.from('market_suggestions')
      .update({ status: 'approved' })
      .eq('id', suggestion.id);

    fetchSuggestions();
  }

  async function handleReject(suggestion) {
    await supabase.from('market_suggestions')
      .update({ status: 'rejected' })
      .eq('id', suggestion.id);
    fetchSuggestions();
  }

  const pending = suggestions.filter((s) => s.status === 'pending');
  const handled = suggestions.filter((s) => s.status !== 'pending');

  const STATUS_COLORS = {
    pending: 'badge-closed',
    approved: 'badge-resolved',
    rejected: 'badge-lost',
  };

  return (
    <div>
      <h2 className="text-lg font-display font-bold mb-4">
        Suggestions
        {pending.length > 0 && (
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-blue text-white text-xs font-mono">
            {pending.length}
          </span>
        )}
      </h2>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading…</div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No suggestions yet.</div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">Pending Review</h3>
              {pending.map((s) => (
                <div key={s.id} className="bg-surface-100 border border-surface-300 rounded-lg p-4 mb-2">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-100">{s.title}</h4>
                      {s.description && <p className="text-xs text-gray-400 mt-1">{s.description}</p>}
                    </div>
                    <span className={STATUS_COLORS[s.status]}>{s.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span>By: <span className="text-gray-300">{s.profiles?.username}</span></span>
                    <span>Options: <span className="font-mono text-gray-300">{(s.options || []).join(', ')}</span></span>
                    {s.closes_at && <span>Closes: {new Date(s.closes_at).toLocaleDateString()}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(s)} className="text-xs px-3 py-1.5 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20 font-medium">
                      Approve & Create Market
                    </button>
                    <button onClick={() => handleReject(s)} className="text-xs px-3 py-1.5 rounded bg-accent-red/10 text-accent-red hover:bg-accent-red/20 font-medium">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {handled.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-2 mt-4">Previously Reviewed</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
                      <th className="py-2 px-3 text-left">Title</th>
                      <th className="py-2 px-3 text-left">By</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {handled.map((s) => (
                      <tr key={s.id} className="border-b border-surface-200">
                        <td className="py-2 px-3 text-gray-300 text-xs">{s.title}</td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{s.profiles?.username}</td>
                        <td className="py-2 px-3 text-right"><span className={STATUS_COLORS[s.status]}>{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────
export default function Admin() {
  const [section, setSection] = useState('markets');

  const tabs = [
    { key: 'markets', label: 'Markets' },
    { key: 'suggestions', label: 'Suggestions' },
    { key: 'bets', label: 'Bets' },
    { key: 'users', label: 'Users' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display font-bold tracking-tight mb-6">Admin Dashboard</h1>

      <PlatformStats />

      <div className="flex gap-1 mb-6 border-b border-surface-300 pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              section === t.key
                ? 'bg-accent-blue text-white'
                : 'bg-surface-100 text-gray-400 hover:text-gray-200 hover:bg-surface-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-6">
        {section === 'markets' && <MarketsManager />}
        {section === 'suggestions' && <SuggestionsManager />}
        {section === 'bets' && <BetsManager />}
        {section === 'users' && <UsersManager />}
      </div>
    </div>
  );
}
