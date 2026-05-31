import { StoryBeat } from './StoryBeat.jsx'
import { ThreeVoices } from './ThreeVoices.jsx'

/**
 * @typedef {{
 *   id: string,
 *   turn: import('../conversation/turnTypes.js').StoryBeatTurn,
 *   voices?: import('../conversation/turnTypes.js').ThreeVoicesResponse | null,
 * }} HistoryEntry
 */

/**
 * @param {{ entries: HistoryEntry[] }} props
 */
export function TurnHistory({ entries }) {
  if (!entries.length) return null

  return (
    <div className="space-y-6 border-t border-[rgba(212,168,67,0.15)] pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8C7A52]">
        Earlier in your story
      </p>
      {entries.map((entry) => (
        <div key={entry.id} className="space-y-3 opacity-75">
          <StoryBeat turn={entry.turn} />
          {entry.voices ? (
            <div className="pointer-events-none">
              <ThreeVoices response={entry.voices} onContinue={() => {}} showContinue={false} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
