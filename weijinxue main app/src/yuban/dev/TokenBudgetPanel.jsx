import { readTokenBudget, resetTokenBudget } from '../grading/tokenBudget.js'
import { useDevMode } from './useDevMode.js'

/**
 * Session token budget summary (dev only).
 */
export function TokenBudgetPanel() {
  const { enabled, panelVisible } = useDevMode()
  if (!enabled || !panelVisible) return null

  const b = readTokenBudget()

  return (
    <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">
          Token budget (session)
        </span>
        <button
          type="button"
          onClick={() => resetTokenBudget()}
          className="text-[10px] text-emerald-400/70 hover:text-emerald-300"
        >
          reset
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px] text-emerald-200/90">
        <li>LLM calls: {b.llmCalls}</li>
        <li>Est. input tokens: {b.estInputTokens}</li>
        <li>Est. output tokens: {b.estOutputTokens}</li>
        <li>Est. tokens saved: {b.estTokensSaved}</li>
        <li>Local grades: {b.localGrades}</li>
        <li>Cached grades: {b.cachedGrades}</li>
        <li>Local story beats: {b.localStoryBeats}</li>
        <li>Turn index: {b.turnIndex}</li>
      </ul>
    </div>
  )
}
