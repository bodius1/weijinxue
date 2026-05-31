import { useState } from 'react'
import { useAuth } from '../../context/useAuth.js'
import { useStoryState } from '../StoryStateContext.jsx'
import ChineseNamePicker from './ChineseNamePicker.jsx'
import CityPicker from './CityPicker.jsx'
import ScenarioPicker from './ScenarioPicker.jsx'

/** @param {{ step: number, total?: number }} props */
function ProgressDots({ step, total = 3 }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={[
            'h-2 w-2 rounded-full transition',
            i === step ? 'bg-[#D4A843]' : 'bg-[rgba(212,168,67,0.25)]',
          ].join(' ')}
          aria-hidden
        />
      ))}
    </div>
  )
}

export default function YubanOnboarding() {
  const { user } = useAuth()
  const { initializeState } = useStoryState()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [chineseName, setChineseName] = useState('')
  const [pinyinName, setPinyinName] = useState('')
  const [city, setCity] = useState(/** @type {null | { id: string, hanzi: string, pinyin: string }} */ (null))
  const [scenario, setScenario] = useState(/** @type {null | { id: string }} */ (null))

  const canContinueStep0 = chineseName.trim().length > 0 && pinyinName.trim().length > 0
  const canContinueStep1 = Boolean(city)
  const canFinish = Boolean(scenario)

  const handleFinish = async () => {
    if (!scenario || !city || !canContinueStep0 || submitting) return
    setSubmitting(true)
    try {
      await initializeState({
        chineseName: chineseName.trim(),
        pinyinName: pinyinName.trim(),
        englishName: user?.displayName?.trim() || '',
        hskLevel: 1,
        city: city.hanzi,
        currentScenario: scenario.id,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-[10px] border border-[rgba(212,168,67,0.2)] bg-[#1A1814] p-5 sm:p-6">
      <ProgressDots step={step} />

      {step === 0 ? (
        <ChineseNamePicker
          chineseName={chineseName}
          pinyinName={pinyinName}
          onChineseNameChange={setChineseName}
          onPinyinNameChange={setPinyinName}
        />
      ) : null}

      {step === 1 ? <CityPicker selectedId={city?.id ?? null} onSelect={setCity} /> : null}

      {step === 2 ? (
        <ScenarioPicker
          cityHanzi={city?.hanzi ?? ''}
          selectedId={scenario?.id ?? null}
          onSelect={setScenario}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={submitting}
            className="rounded-lg border border-[rgba(212,168,67,0.3)] px-4 py-2 text-sm text-[#E8D5A3] transition hover:border-[#D4A843]/50 disabled:opacity-50"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 0 && !canContinueStep0) || (step === 1 && !canContinueStep1)}
            className="ml-auto rounded-lg bg-[#D4A843] px-5 py-2 text-sm font-semibold text-[#0F0E0C] transition hover:bg-[#b8872a] disabled:opacity-50"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleFinish()}
            disabled={!canFinish || submitting}
            className="ml-auto rounded-lg bg-[#D4A843] px-5 py-2 text-sm font-semibold text-[#0F0E0C] transition hover:bg-[#b8872a] disabled:opacity-50"
          >
            {submitting ? 'Starting…' : 'Start My Story →'}
          </button>
        )}
      </div>
    </div>
  )
}
