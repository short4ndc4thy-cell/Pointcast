const OPTION_COLORS = [
  { bg: 'bg-accent-green', text: 'text-accent-green', bar: '#22c55e' },
  { bg: 'bg-accent-red', text: 'text-accent-red', bar: '#ef4444' },
  { bg: 'bg-accent-blue', text: 'text-accent-blue', bar: '#3b82f6' },
  { bg: 'bg-accent-yellow', text: 'text-accent-yellow', bar: '#eab308' },
  { bg: 'bg-purple-500', text: 'text-purple-400', bar: '#a855f7' },
  { bg: 'bg-cyan-500', text: 'text-cyan-400', bar: '#06b6d4' },
];

export default function OddsBar({ options, percentages, compact = false }) {
  if (!options || options.length === 0) return null;

  const total = options.reduce((sum, opt) => sum + (percentages[opt] || 0), 0);

  return (
    <div className="w-full">
      {/* Bar */}
      <div className={`w-full ${compact ? 'h-2' : 'h-3'} rounded-full overflow-hidden flex bg-surface-300`}>
        {options.map((opt, i) => {
          const pct = total > 0 ? (percentages[opt] || 0) / total * 100 : 100 / options.length;
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          return (
            <div
              key={opt}
              className="transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${Math.max(pct, 1)}%`,
                backgroundColor: color.bar,
                opacity: 0.85,
              }}
            />
          );
        })}
      </div>

      {/* Labels */}
      {!compact && (
        <div className="flex justify-between mt-1.5">
          {options.map((opt, i) => {
            const pct = percentages[opt] || 0;
            const color = OPTION_COLORS[i % OPTION_COLORS.length];
            return (
              <div key={opt} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-sm ${color.bg}`} />
                <span className="text-xs text-gray-400">{opt}</span>
                <span className={`font-mono text-xs font-semibold ${color.text}`}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { OPTION_COLORS };
