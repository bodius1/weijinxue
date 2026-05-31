import { useMemo, useState } from 'react'
import { getScenarioById } from '../data/startingScenarios.js'
import { classifyVocabMastery } from '../helpers/vocabHelpers.js'
import NPCRoster from './NPCRoster.jsx'
import VocabularyDrawer from './VocabularyDrawer.jsx'

/**
 * @param {{
 *   state: import('../StoryStateContext.jsx').YubanStoryState | null,
 *   className?: string,
 *   onOpenDashboard?: () => void,
 * }} props
 */
export default function StoryContextPanel({ state, className = '', onOpenDashboard }) {
  const [vocabOpen, setVocabOpen] = useState(false)

  const scenario = useMemo(
    () => getScenarioById(String(state?.currentScenario ?? 'arrival')),
    [state?.currentScenario],
  )

  const npcCount = Object.keys(state?.npcs ?? {}).length
  const classifiedVocab = useMemo(() => classifyVocabMastery(state ?? {}), [state])
  const vocabCount = Object.keys(classifiedVocab).length

  const sessions = Number(state?.sessionsCompleted ?? 0) + 1
  const days = Number(state?.daysInChina ?? 0)
  const hsk = Number(state?.hskLevel ?? 1)

  const storyLog = Array.isArray(state?.storyLog) ? state.storyLog : []

  return (
    <>
      <aside
        className={[
          'w-full shrink-0 rounded-[10px] border border-[rgba(212,168,67,0.2)] bg-[#1A1814] p-4 lg:w-[280px]',
          className,
        ].join(' ')}
      >
        <h3 className="text-sm font-semibold text-[#E8D5A3]">📖 Your Story</h3>

        <div className="mt-3 space-y-1 text-[13px] text-[#E8D5A3]">
          <p className="font-medium">
            {state?.chineseName}{' '}
            <span className="font-normal text-[#8C7A52]">{state?.pinyinName}</span>
          </p>
          <p className="text-[#8C7A52]">
            {state?.city} · Day {days || 1}
          </p>
          <p className="text-[#8C7A52]">
            HSK {hsk} · Session {sessions}
          </p>
        </div>

        <SectionDivider />

        <SectionLabel>🎬 Current Scene</SectionLabel>
        <p className="mt-1 text-[13px] text-[#E8D5A3]">{scenario.label}</p>

        <SectionDivider />

        <SectionLabel>👥 People you&apos;ve met ({npcCount})</SectionLabel>
        <div className="mt-2">
          <NPCRoster npcs={state?.npcs ?? {}} />
        </div>

        <SectionDivider />

        <SectionLabel>📚 Words learned ({vocabCount})</SectionLabel>
        <button
          type="button"
          onClick={() => setVocabOpen(true)}
          disabled={vocabCount === 0}
          className="mt-1 text-xs text-[#D4A843] underline-offset-2 hover:underline disabled:cursor-default disabled:text-[#8C7A52] disabled:no-underline"
        >
          View all →
        </button>

        {onOpenDashboard ? (
          <>
            <SectionDivider />
            <button
              type="button"
              onClick={onOpenDashboard}
              className="mt-2 w-full rounded-lg border border-[#D4A843]/40 px-3 py-1.5 text-xs text-[#D4A843] transition hover:bg-[#D4A843]/10"
            >
              📊 View Progress
            </button>
          </>
        ) : null}

        <SectionDivider />

        <SectionLabel>📜 Recent events</SectionLabel>
        {storyLog.length === 0 ? (
          <p className="mt-1 text-xs text-[#8C7A52]">Your story is just beginning…</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {storyLog.slice(0, 3).map((entry, i) => (
              <li key={`${entry.date}-${i}`} className="text-xs leading-snug text-[#8C7A52]">
                {entry.summary}
              </li>
            ))}
          </ul>
        )}
      </aside>

      <VocabularyDrawer open={vocabOpen} onClose={() => setVocabOpen(false)} state={state} />
    </>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#D4A843]">{children}</p>
  )
}

function SectionDivider() {
  return <div className="my-3 h-px bg-[rgba(212,168,67,0.15)]" />
}
