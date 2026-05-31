import { SCENARIOS } from '../data/startingScenarios.js'

/**
 * @param {{
 *   cityHanzi: string,
 *   selectedId: string | null,
 *   onSelect: (scenario: typeof SCENARIOS[number]) => void,
 * }} props
 */
export default function ScenarioPicker({ cityHanzi, selectedId, onSelect }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[#E8D5A3]">How does your story begin?</h2>
        <div className="mx-auto my-3 h-px w-full max-w-xs bg-[rgba(212,168,67,0.15)]" />
        <p className="text-sm text-[#8C7A52]">
          You&apos;re new in {cityHanzi || 'China'}. What&apos;s your starting situation?
        </p>
      </div>

      <div className="space-y-2">
        {SCENARIOS.map((scenario) => {
          const selected = selectedId === scenario.id
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelect(scenario)}
              className={[
                'w-full rounded-lg border px-3 py-3 text-left transition',
                selected
                  ? 'border-[#D4A843] bg-[#D4A843]/10'
                  : 'border-[rgba(212,168,67,0.25)] bg-[#0F0E0C] hover:border-[#D4A843]/50',
              ].join(' ')}
            >
              <p className="text-sm font-medium text-[#E8D5A3]">
                {scenario.icon} {scenario.label}
              </p>
              <p className="mt-1 text-xs text-[#8C7A52]">{scenario.desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
