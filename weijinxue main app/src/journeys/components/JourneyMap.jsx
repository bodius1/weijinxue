import { getStageById } from '../engine/contextPackSchema.js'

/**
 * @typedef {'locked' | 'unlocked' | 'current' | 'complete'} StageVisualState
 */

/**
 * @param {import('../engine/contextPackSchema.js').ContextPack} pack
 * @param {string} stageId
 * @param {string[]} unlockedStageIds
 * @param {string[]} completedStageIds
 * @param {string | null} activeStageId
 * @returns {StageVisualState}
 */
export function getStageVisualState(stageId, unlockedStageIds, completedStageIds, activeStageId) {
  if (completedStageIds.includes(stageId)) return 'complete'
  if (stageId === activeStageId) return 'current'
  if (unlockedStageIds.includes(stageId)) return 'unlocked'
  return 'locked'
}

const STATE_STYLES = {
  complete: {
    dot: 'bg-[#7BA821] ring-[#7BA821]/40',
    row: 'border-[#7BA821]/35 bg-[#1A1814]/90',
    label: 'Complete',
  },
  current: {
    dot: 'bg-[#D4A843] ring-[#D4A843]/50 scale-110',
    row: 'border-[#D4A843]/55 bg-[#1f1c18] shadow-md shadow-[#D4A843]/10',
    label: 'Current',
  },
  unlocked: {
    dot: 'bg-[#D4A843]/50 ring-[#D4A843]/25',
    row: 'border-[#D4A843]/25 bg-[#1A1814] hover:border-[#D4A843]/45',
    label: 'Unlocked',
  },
  locked: {
    dot: 'bg-taupe/40 ring-taupe/20',
    row: 'border-taupe/30 bg-[#1A1814]/40 opacity-70',
    label: 'Locked',
  },
}

/**
 * @param {{
 *   pack: import('../engine/contextPackSchema.js').ContextPack
 *   unlockedStageIds: string[]
 *   completedStageIds: string[]
 *   activeStageId: string | null
 *   selectedStageId?: string | null
 *   onSelectStage: (stageId: string, state: StageVisualState) => void
 *   lockedHint?: string | null
 * }} props
 */
export default function JourneyMap({
  pack,
  unlockedStageIds,
  completedStageIds,
  activeStageId,
  selectedStageId,
  onSelectStage,
  lockedHint,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[#E8D5A3]">{pack.title}</h2>
          {pack.chineseTitle ? (
            <p className="font-serif text-sm text-[#D4A843]/90">{pack.chineseTitle}</p>
          ) : null}
        </div>
        <p className="text-xs text-[#E8D5A3]/55">{pack.stages.length} stages</p>
      </div>

      {lockedHint ? (
        <p className="rounded-lg border border-taupe/40 bg-[#0F0E0C]/80 px-3 py-2 text-sm text-[#E8D5A3]/70" role="status">
          {lockedHint}
        </p>
      ) : null}

      <ol className="relative space-y-0" aria-label={`${pack.title} roadmap`}>
        {pack.stages.map((stage, index) => {
          const state = getStageVisualState(
            stage.id,
            unlockedStageIds,
            completedStageIds,
            activeStageId,
          )
          const styles = STATE_STYLES[state]
          const isLocked = state === 'locked'
          const isSelected = selectedStageId === stage.id
          const stageMeta = getStageById(pack, stage.id)

          return (
            <li key={stage.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < pack.stages.length - 1 ? (
                <span
                  className="absolute left-[11px] top-6 bottom-0 w-px bg-[#D4A843]/20"
                  aria-hidden
                />
              ) : null}
              <span
                className={[
                  'relative z-[1] mt-1.5 h-3 w-3 shrink-0 rounded-full ring-2',
                  styles.dot,
                ].join(' ')}
                aria-hidden
              />
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onSelectStage(stage.id, state)}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-disabled={isLocked}
                className={[
                  'min-w-0 flex-1 rounded-xl border px-4 py-3 text-left transition',
                  styles.row,
                  isSelected ? 'ring-1 ring-[#D4A843]/40' : '',
                  isLocked ? 'cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[#E8D5A3]">{stage.title}</span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
                      state === 'complete'
                        ? 'bg-[#7BA821]/15 text-[#9bc94a]'
                        : state === 'current'
                          ? 'bg-[#D4A843]/20 text-[#D4A843]'
                          : state === 'locked'
                            ? 'bg-taupe/20 text-espresso'
                            : 'bg-[#D4A843]/10 text-[#D4A843]/80',
                    ].join(' ')}
                  >
                    {styles.label}
                  </span>
                </div>
                {stageMeta?.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[#E8D5A3]/60">{stageMeta.description}</p>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
