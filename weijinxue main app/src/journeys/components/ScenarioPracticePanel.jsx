/**
 * Preview-only panel for a stage's guided Yǔbàn scenario (Phase 4 — no AI calls).
 */

/**
 * @param {{ scenario: import('../engine/contextPackSchema.js').AiScenario | null | undefined }} props
 */
export default function ScenarioPracticePanel({ scenario }) {
  if (!scenario) {
    return (
      <section className="rounded-xl border border-taupe/40 bg-[#0F0E0C]/60 p-4 text-sm text-[#E8D5A3]/60">
        No practice scenario defined for this stage yet.
      </section>
    )
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-[#D4A843]/25 bg-gradient-to-br from-[#1A1814] to-[#0F0E0C] p-4 sm:p-5"
      aria-labelledby="scenario-preview-heading"
    >
      <div>
        <h3 id="scenario-preview-heading" className="text-sm font-semibold text-[#D4A843]">
          Practice scenario preview
        </h3>
        <p className="mt-1 text-xs text-[#E8D5A3]/55">
          Guided Yǔbàn practice arrives in a later phase — this is a preview only.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#D4A843]/70">Setting</p>
        <p className="text-sm leading-relaxed text-[#E8D5A3]">{scenario.setting}</p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#D4A843]/70">Your goal</p>
        <p className="text-sm leading-relaxed text-[#E8D5A3]">{scenario.learnerGoal}</p>
      </div>

      {scenario.allowedTopics?.length ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#D4A843]/70">
            Allowed topics
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {scenario.allowedTopics.map((topic) => (
              <li
                key={topic}
                className="rounded-full bg-[#D4A843]/10 px-2.5 py-0.5 text-xs text-[#E8D5A3]"
              >
                {topic}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scenario.suggestedPrompts?.length ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#D4A843]/70">
            Suggested prompts
          </p>
          <ul className="space-y-2">
            {scenario.suggestedPrompts.map((prompt) => (
              <li
                key={prompt}
                className="rounded-lg border border-[#D4A843]/15 bg-[#0F0E0C]/80 px-3 py-2 font-serif text-sm text-[#E8D5A3]"
              >
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
