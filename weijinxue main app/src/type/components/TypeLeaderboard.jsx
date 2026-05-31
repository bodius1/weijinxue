import { useLeaderboard } from '../scoring/useLeaderboard.js'
import { useAuth } from '../../context/useAuth.js'

/**
 * @param {{ hskLevel?: number }} props
 */
export function TypeLeaderboard({ hskLevel = 1 }) {
  const { entries, loading, userRank } = useLeaderboard(hskLevel)
  const { user } = useAuth()

  return (
    <section className="mt-12 border-t border-[#D4A843]/20 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#D4A843]">🏆 Leaderboard</h2>
        <span className="text-xs text-[#8C7A52]">
          HSK {hskLevel} · Sentences · All time
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-[#8C7A52]">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="py-6 text-center text-sm text-[#8C7A52]">No scores yet — be the first!</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#D4A843]/20">
          <div className="grid grid-cols-5 border-b border-[#D4A843]/20 bg-[#1A1814] px-4 py-2 text-xs uppercase tracking-wider text-[#8C7A52]">
            <span>#</span>
            <span className="col-span-2">Player</span>
            <span className="text-right">Score</span>
            <span className="text-right">Streak</span>
          </div>

          {entries.map((entry, i) => {
            const isCurrentUser = user && entry.uid === user.uid
            const rank = i + 1
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

            return (
              <div
                key={entry.id}
                className={[
                  'grid grid-cols-5 border-b border-[#D4A843]/10 px-4 py-3 text-sm last:border-0 transition-colors',
                  isCurrentUser
                    ? 'border-l-2 border-l-[#D4A843] bg-[#D4A843]/10'
                    : 'bg-[#0F0E0C] hover:bg-[#1A1814]',
                ].join(' ')}
              >
                <span className="text-[#8C7A52]">{medal || rank}</span>
                <span
                  className="col-span-2 truncate font-medium"
                  style={{ color: isCurrentUser ? '#D4A843' : '#E8D5A3' }}
                >
                  {String(entry.displayName ?? 'Anonymous')}
                  {isCurrentUser ? <span className="ml-1 text-xs text-[#8C7A52]">(you)</span> : null}
                </span>
                <span className="text-right font-mono text-[#D4A843]">
                  {Number(entry.score ?? 0).toLocaleString()}
                </span>
                <span className="text-right text-[#8C7A52]">🔥{Number(entry.streak ?? 0)}</span>
              </div>
            )
          })}
        </div>
      )}

      {user && userRank === 0 && entries.length > 0 ? (
        <div className="mt-3 text-center text-xs text-[#8C7A52]">
          Complete a session to appear on the leaderboard
        </div>
      ) : null}
    </section>
  )
}
