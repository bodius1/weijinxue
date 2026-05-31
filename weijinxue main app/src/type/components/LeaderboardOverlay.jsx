import { useLeaderboard } from '../scoring/useLeaderboard.js'

/**
 * @param {{
 *   hskLevel?: number,
 *   currentUserUid?: string | null,
 *   onBack: () => void,
 * }} props
 */
export function LeaderboardOverlay({ hskLevel = 1, currentUserUid, onBack }) {
  const { entries, loading } = useLeaderboard(hskLevel)

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-lg text-[#D4A843] transition hover:text-[#E8D5A3]"
          aria-label="Back to results"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-[#D4A843]">🏆 Leaderboard</h2>
        <span className="ml-auto text-xs text-[#8C7A52]">HSK {hskLevel} · All time</span>
      </div>

      <div className="max-h-72 overflow-hidden overflow-y-auto rounded-xl border border-[#D4A843]/20">
        {loading ? (
          <div className="py-8 text-center text-sm text-[#8C7A52]">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#8C7A52]">No scores yet — be the first!</div>
        ) : (
          entries.map((entry, i) => {
            const isMe = currentUserUid && entry.uid === currentUserUid
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

            return (
              <div
                key={entry.id}
                className={[
                  'flex items-center gap-3 border-b border-[#D4A843]/10 px-4 py-2.5 text-sm last:border-0',
                  isMe ? 'border-l-2 border-l-[#D4A843] bg-[#D4A843]/10' : 'bg-[#0F0E0C]',
                ].join(' ')}
              >
                <span className="w-6 text-center text-[#8C7A52]">{medal || i + 1}</span>
                <span
                  className="flex-1 truncate font-medium"
                  style={{ color: isMe ? '#D4A843' : '#E8D5A3' }}
                >
                  {String(entry.displayName ?? 'Anonymous')}
                  {isMe ? <span className="ml-1 text-xs text-[#8C7A52]">(you)</span> : null}
                </span>
                <span className="font-mono text-[#D4A843]">{Number(entry.score ?? 0).toLocaleString()}</span>
                <span className="text-xs text-[#8C7A52]">🔥{Number(entry.streak ?? 0)}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
