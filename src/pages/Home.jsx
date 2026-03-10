import useMarkets from '../hooks/useMarkets';
import useAuth from '../hooks/useAuth';
import MarketCard from '../components/MarketCard';

export default function Home() {
  const { markets, loading } = useMarkets({ status: 'open' });
  const { profile } = useAuth();

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            Markets
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Predict outcomes. Earn points.
          </p>
        </div>
        {profile?.is_admin && (
          <a href="/admin" className="btn-primary text-sm">
            + Create Market
          </a>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm">
          No open markets yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
