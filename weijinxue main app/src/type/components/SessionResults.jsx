import { useState } from 'react'
import { useAuth } from '../../context/useAuth.js'
import { LeaderboardOverlay } from './LeaderboardOverlay.jsx'

/**
 * @param {{ label: string, value: string | number }} props
 */
function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-[#D4A843]/20 bg-[#0F0E0C] p-3">
      <div className="text-lg font-bold text-[#D4A843]">{value}</div>
      <div className="text-xs text-[#8C7A52]">{label}</div>
    </div>
  )
}

/**
 * @param {{
 *   score: number,
 *   streak: number,
 *   cpm: number,
 *   accuracy: number,
 *   hskLevel: number,
 *   personalBest: Record<string, unknown> | null,
 *   isNewBest: boolean,
 *   leaderboardRank: number,
 *   onPlayAgain: () => void,
 *   onClose: () => void,
 * }} props
 */
export function SessionResults({
  score,
  streak,
  cpm,
  accuracy,
  hskLevel,
  personalBest,
  isNewBest,
  leaderboardRank,
  onPlayAgain,
  onClose,
}) {
  const { user } = useAuth()
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const prevScore = Number(personalBest?.score ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F0E0C]/90 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#D4A843]/40 bg-[#1A1814] p-8 text-center">
        {showLeaderboard ? (
          <LeaderboardOverlay
            hskLevel={hskLevel}
            currentUserUid={user?.uid ?? null}
            onBack={() => setShowLeaderboard(false)}
          />
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold text-[#D4A843]">Session Complete</h2>
              {isNewBest ? (
                <div className="mt-2 inline-flex animate-pulse items-center gap-1 rounded-full border border-[#D4A843] bg-[#D4A843]/20 px-3 py-1 text-sm font-medium text-[#D4A843]">
                  🏆 New Personal Best!
                </div>
              ) : null}
            </div>

            <div>
              <div className="font-mono text-5xl font-bold text-[#D4A843]">{score.toLocaleString()}</div>
              <p className="mt-1 text-sm text-[#8C7A52]">points</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Best Streak" value={streak} />
              <StatCard label="CPM" value={cpm} />
              <StatCard label="Accuracy" value={`${Math.round(accuracy * 100)}%`} />
            </div>

            {personalBest && !isNewBest && prevScore > 0 ? (
              <div className="text-sm text-[#8C7A52]">
                Personal best: {prevScore.toLocaleString()} · {Number(personalBest.streak ?? 0)} streak
              </div>
            ) : null}

            {leaderboardRank > 0 ? (
              <div className="text-sm text-[#D4A843]/80">🏅 You rank #{leaderboardRank} on the leaderboard</div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4A843]/40 py-2.5 text-[#D4A843] transition hover:bg-[#D4A843]/10"
            >
              🏆 View Leaderboard
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex-1 rounded-xl bg-[#D4A843] py-3 font-medium text-[#0F0E0C] transition hover:brightness-110"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#D4A843]/40 px-4 py-3 text-[#D4A843] transition hover:bg-[#D4A843]/10"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
