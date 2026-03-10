import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function LeaderboardTable({ entries, page, setPage, total }) {
  const { user } = useAuth();
  const perPage = 25;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-300 text-gray-500 text-xs uppercase tracking-wider font-mono">
              <th className="py-3 px-3 text-left">Rank</th>
              <th className="py-3 px-3 text-left">User</th>
              <th className="py-3 px-3 text-right">Points</th>
              <th className="py-3 px-3 text-right hidden sm:table-cell">Markets</th>
              <th className="py-3 px-3 text-right hidden sm:table-cell">Win Rate</th>
              <th className="py-3 px-3 text-right">Calibration</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const rank = (page - 1) * perPage + i + 1;
              const isMe = user?.id === entry.id;
              return (
                <tr
                  key={entry.id}
                  className={`border-b border-surface-200 ${
                    isMe ? 'bg-accent-blue/5 border-l-2 border-l-accent-blue' : 'hover:bg-surface-50'
                  } transition-colors`}
                >
                  <td className="py-3 px-3 font-mono text-gray-400">
                    {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                  </td>
                  <td className="py-3 px-3">
                    <Link to={`/profile/${entry.id}`} className="text-gray-100 hover:text-accent-blue transition-colors font-medium">
                      {entry.username}
                      {isMe && <span className="ml-1.5 text-[10px] text-accent-blue font-mono">(YOU)</span>}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-accent-green">
                    {entry.points?.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-400 hidden sm:table-cell">
                    {entry.marketCount || 0}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-400 hidden sm:table-cell">
                    {entry.winRate != null ? `${entry.winRate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-400">
                    {entry.calibration != null ? entry.calibration.toFixed(0) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="btn-ghost text-xs !px-3 !py-1"
          >
            Prev
          </button>
          <span className="text-xs font-mono text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="btn-ghost text-xs !px-3 !py-1"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
