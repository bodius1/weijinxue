import MiniDrillCard from './MiniDrillCard.jsx'
import ScenarioPracticePanel from './ScenarioPracticePanel.jsx'

/**
 * @param {{
 *   contextPack: import('../engine/contextPackSchema.js').ContextPack
 *   stage: import('../engine/contextPackSchema.js').ContextStage
 *   progress?: import('../engine/contextProgressStore.js').ContextProgressDoc | null
 *   stageStats?: import('../engine/contextProgressStore.js').StageStats | null
 *   onRecordDrillAttempt: (stageId: string, drillId: string, wasCorrect: boolean) => void
 *   onBack: () => void
 * }} props
 */
export default function LessonNode({
  contextPack,
  stage,
  progress = null,
  stageStats,
  onRecordDrillAttempt,
  onBack,
}) {
  const mastery = stage.mastery ?? { requiredCorrectDrills: 0 }
  const minAcc = mastery.minAccuracy != null ? Math.round(mastery.minAccuracy * 100) : 80
  const drillCount = stage.drills?.length ?? 0

  return (
    <article className="space-y-6 pb-8">
      <header className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[#D4A843] transition hover:underline"
        >
          ← Back to roadmap
        </button>
        <div>
          <h2 className="text-xl font-semibold text-[#E8D5A3] sm:text-2xl">{stage.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#E8D5A3]/80">{stage.description}</p>
          {stage.estimatedMinutes ? (
            <p className="mt-2 text-xs text-[#D4A843]/75">~{stage.estimatedMinutes} min</p>
          ) : null}
        </div>
      </header>

      <section className="rounded-xl border border-[#D4A843]/20 bg-[#1A1814]/80 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">
          Mastery requirements
        </h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#E8D5A3]/85">
          <li>
            {mastery.requiredCorrectDrills ?? 0} correct mini-drills
            {drillCount > 0 ? ` (${drillCount} available)` : ''}
          </li>
          {mastery.requiredAiTurns ? (
            <li>{mastery.requiredAiTurns} guided Yǔbàn turns</li>
          ) : null}
          <li>At least {minAcc}% drill accuracy</li>
        </ul>
        {stageStats ? (
          <p className="mt-3 text-xs text-[#E8D5A3]/55">
            Progress: {stageStats.correctDrills} correct · {stageStats.incorrectDrills} incorrect ·{' '}
            {Math.round((stageStats.masteryScore ?? 0) * 100)}% toward mastery
          </p>
        ) : null}
      </section>

      {stage.targetWords?.length ? (
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">New words</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {stage.targetWords.map((w) => (
              <li
                key={w.hanzi}
                className="rounded-lg border border-taupe/30 bg-[#0F0E0C]/50 px-3 py-2"
              >
                <span className="font-serif text-lg text-[#E8D5A3]">{w.hanzi}</span>
                <span className="ml-2 text-sm text-[#D4A843]/90">{w.pinyin}</span>
                <p className="text-xs text-[#E8D5A3]/65">{w.english}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stage.patterns?.length ? (
        <section className="space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">Patterns</h3>
          {stage.patterns.map((pat) => (
            <div
              key={pat.id}
              className="space-y-2 rounded-xl border border-taupe/35 bg-[#1A1814]/60 p-4"
            >
              <h4 className="font-medium text-[#E8D5A3]">{pat.title}</h4>
              <p className="font-mono text-sm text-[#D4A843]">{pat.structure}</p>
              <p className="text-sm text-[#E8D5A3]/75">{pat.explanation}</p>
              {pat.examples?.length ? (
                <ul className="space-y-1 border-l-2 border-[#D4A843]/25 pl-3">
                  {pat.examples.map((ex) => (
                    <li key={ex} className="font-serif text-sm text-[#E8D5A3]">
                      {ex}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">Mini drills</h3>
        <MiniDrillCard
          contextPack={contextPack}
          stage={stage}
          progress={progress}
          stageStats={stageStats}
          onRecordAttempt={onRecordDrillAttempt}
          onBackToRoadmap={onBack}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">More practice</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <PracticePlaceholder label="Type Practice" phase="Phase 5" />
          <PracticePlaceholder label="Practice with Yǔbàn AI" phase="Phase 6" />
        </div>
      </section>

      <ScenarioPracticePanel scenario={stage.aiScenario} />
    </article>
  )
}

function PracticePlaceholder({ label, phase }) {
  return (
    <button
      type="button"
      disabled
      className="rounded-xl border border-taupe/40 bg-[#0F0E0C]/40 px-3 py-3 text-left opacity-60"
      title={`${label} — ${phase}`}
    >
      <span className="block text-sm font-medium text-[#E8D5A3]/80">{label}</span>
      <span className="mt-1 block text-[10px] text-espresso">Coming in {phase}</span>
    </button>
  )
}
