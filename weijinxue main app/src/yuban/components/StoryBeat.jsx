import { NPCAvatar } from './NPCAvatar.jsx'
import { WeaknessBadge } from './WeaknessBadge.jsx'
import { derivePatternId } from '../curriculum/patternMasteryTracker.js'

/**
 * @param {{
 *   turn: import('../conversation/turnTypes.js').StoryBeatTurn | null,
 *   patternMastery?: Record<string, { label?: string, status?: string }>,
 * }} props
 */
export function StoryBeat({ turn, patternMastery = {} }) {
  if (!turn) return null

  const patternId = derivePatternId(turn.expectedPatternHint)
  const pattern = patternId ? patternMastery[patternId] : null
  const showBadge =
    pattern &&
    (pattern.status === 'practicing' || pattern.status === 'almost') &&
    turn.expectedPatternHint

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm italic text-[#8C7A52]">{turn.narration}</p>
        {showBadge ? <WeaknessBadge patternLabel={pattern.label || turn.expectedPatternHint} /> : null}
      </div>

      <div className="flex gap-3 rounded-xl border border-[#D4A843]/30 bg-[#1A1814] p-4">
        <NPCAvatar speaker={turn.speaker} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-[#D4A843]">{turn.speaker.chineseName}</span>
            <span className="text-xs text-[#8C7A52]">
              {turn.speaker.pinyinName} · {turn.speaker.role}
            </span>
          </div>
          <p className="text-xl font-medium text-[#E8D5A3]">{turn.dialogue.hanzi}</p>
          <p className="text-sm text-[#8C7A52]">{turn.dialogue.pinyin}</p>
          <p className="text-sm italic text-[#A8956A]">&ldquo;{turn.dialogue.english}&rdquo;</p>
        </div>
      </div>
    </div>
  )
}
