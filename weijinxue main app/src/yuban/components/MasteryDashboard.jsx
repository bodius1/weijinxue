import { useStoryState } from '../StoryStateContext.jsx'
import { classifyVocabMastery } from '../helpers/vocabHelpers.js'
import { getTopMistakes, getTrend, MISTAKE_LABELS } from '../curriculum/mistakeAnalyzer.js'

/**
 * @param {{ onBack: () => void, turnHistory?: Array<{ evaluation?: string }> }} props
 */
export function MasteryDashboard({ onBack, turnHistory = [] }) {
  const { state } = useStoryState()
  if (!state) return null

  const patterns = Object.values(state.patternMastery || {})
  const mastered = patterns.filter((p) => p.status === 'mastered')
  const almost = patterns.filter((p) => p.status === 'almost')
  const practicing = patterns.filter((p) => p.status === 'practicing')
  const topMistakes = getTopMistakes(state.mistakeLog, { top: 5 })

  const classifiedVocab = classifyVocabMastery(state)
  const vocabArr = Object.values(classifiedVocab)
  const warmCount = vocabArr.filter((v) => v.mastery === 'warm').length
  const coldCount = vocabArr.filter((v) => v.mastery === 'cold').length
  const masteredVocab = vocabArr.filter((v) => v.mastery === 'mastered').length

  const trend = getTrend(turnHistory)
  const trendLabel =
    trend === 'improving' ? '↗ Improving' : trend === 'struggling' ? '↘ Needs focus' : '→ Stable'

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-[#D4A843]/30 bg-[#1A1814] p-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm text-[#D4A843] hover:underline">
          ← Back
        </button>
        <h2 className="font-medium text-[#D4A843]">📊 Your Progress</h2>
        <div className="w-12" />
      </div>

      <div className="text-center text-sm text-[#E8D5A3]">
        Day {state.daysInChina ?? 0} in {state.city} · {state.sessionsCompleted ?? 0} turns
      </div>
      <p className="text-center text-xs text-[#8C7A52]">Trend: {trendLabel}</p>

      <Section title="🏆 Mastered" count={mastered.length}>
        {mastered.length === 0 ? (
          <Empty text="Keep going — mastery is coming." />
        ) : (
          mastered.map((p) => <PatternRow key={p.patternId} pattern={p} variant="mastered" />)
        )}
      </Section>

      <Section title="⚡ Almost there" count={almost.length}>
        {almost.length === 0 ? (
          <Empty text="No patterns close to mastered yet." />
        ) : (
          almost.map((p) => <PatternRow key={p.patternId} pattern={p} variant="almost" />)
        )}
      </Section>

      <Section title="🔥 Practicing" count={practicing.length}>
        {practicing.length === 0 ? (
          <Empty text="No patterns being practiced yet." />
        ) : (
          practicing.map((p) => <PatternRow key={p.patternId} pattern={p} variant="practicing" />)
        )}
      </Section>

      <Section title="🔴 Common mistakes">
        {topMistakes.length === 0 ? (
          <Empty text="No common mistakes — nice work." />
        ) : (
          topMistakes.map((m) => (
            <div key={m.type} className="flex items-center justify-between py-1 text-sm">
              <span className="text-[#E8D5A3]">{MISTAKE_LABELS[m.type] || m.type}</span>
              <span className="text-[#8C7A52]">×{m.count}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="📚 Vocabulary">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-[#D4A843]">🔥 {warmCount} warm</span>
          <span className="text-[#8C7A52]">❄️ {coldCount} cold</span>
          <span className="text-green-400">✓ {masteredVocab} mastered</span>
        </div>
      </Section>
    </div>
  )
}

/** @param {{ title: string, count?: number, children: import('react').ReactNode }} props */
function Section({ title, count, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">
        {title}
        {count !== undefined ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-[#8C7A52]">({count})</span>
        ) : null}
      </div>
      <div className="space-y-1 border-l border-[#D4A843]/15 pl-2">{children}</div>
    </div>
  )
}

/** @param {{ pattern: object, variant: string }} props */
function PatternRow({ pattern, variant }) {
  const pct = pattern.attempts > 0 ? Math.round((pattern.correct / pattern.attempts) * 100) : 0
  const color =
    {
      mastered: '#7BA821',
      almost: '#D4A843',
      practicing: '#A8956A',
    }[variant] ?? '#A8956A'

  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="flex-1 truncate text-[#E8D5A3]">{pattern.label || pattern.patternId}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#0F0E0C]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-xs" style={{ color }}>
        {pct}%
      </span>
    </div>
  )
}

/** @param {{ text: string }} props */
function Empty({ text }) {
  return <div className="text-xs italic text-[#8C7A52]/60">{text}</div>
}
