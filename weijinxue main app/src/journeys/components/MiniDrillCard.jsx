import { useCallback, useEffect, useMemo, useState } from 'react'
import { DRILL_TYPES } from '../engine/contextPackSchema.js'
import {
  checkDrillAnswer,
  getDrillPromptText,
  getDrillResultMessage,
  getNextIncompleteDrill,
  getStageDrillSummary,
} from '../engine/contextDrillEngine.js'

/**
 * @param {{
 *   contextPack: import('../engine/contextPackSchema.js').ContextPack
 *   stage: import('../engine/contextPackSchema.js').ContextStage
 *   progress: import('../engine/contextProgressStore.js').ContextProgressDoc | null
 *   stageStats: import('../engine/contextProgressStore.js').StageStats | null
 *   onRecordAttempt: (stageId: string, drillId: string, wasCorrect: boolean) => void
 *   onStageComplete?: () => void
 *   onBackToRoadmap?: () => void
 *   className?: string
 * }} props
 */
export default function MiniDrillCard({
  contextPack,
  stage,
  progress,
  stageStats,
  onRecordAttempt,
  onStageComplete,
  onBackToRoadmap,
  className = '',
}) {
  const summary = useMemo(
    () => getStageDrillSummary(stage, stageStats),
    [stage, stageStats],
  )

  const [activeDrillId, setActiveDrillId] = useState(() => {
    const next = getNextIncompleteDrill(stage, stageStats?.completedDrillIds ?? [])
    return next?.id ?? stage.drills[0]?.id ?? null
  })

  const [textInput, setTextInput] = useState('')
  const [arrangeTokens, setArrangeTokens] = useState(/** @type {string[]} */ ([]))
  const [availableTiles, setAvailableTiles] = useState(/** @type {string[]} */ ([]))
  const [feedback, setFeedback] = useState(/** @type {'idle' | 'correct' | 'incorrect'} */ ('idle'))
  const [lastMessage, setLastMessage] = useState('')

  const drill = useMemo(
    () => stage.drills.find((d) => d.id === activeDrillId) ?? null,
    [stage.drills, activeDrillId],
  )

  const drillIndex = drill ? stage.drills.findIndex((d) => d.id === drill.id) : -1

  const resetDrillInput = useCallback((d) => {
    setTextInput('')
    setFeedback('idle')
    setLastMessage('')
    if (d?.type === DRILL_TYPES.ARRANGE_SENTENCE && d.tiles?.length) {
      setArrangeTokens([])
      setAvailableTiles([...d.tiles])
    } else {
      setArrangeTokens([])
      setAvailableTiles([])
    }
  }, [])

  useEffect(() => {
    if (drill) resetDrillInput(drill)
  }, [drill?.id, resetDrillInput])

  const handleSubmit = useCallback(
    (answerOverride) => {
      if (!drill || feedback === 'correct') return

      let userAnswer = answerOverride
      if (userAnswer === undefined) {
        if (drill.type === DRILL_TYPES.ARRANGE_SENTENCE) {
          userAnswer = arrangeTokens
        } else {
          userAnswer = textInput
        }
      }

      const wasCorrect = checkDrillAnswer(drill, userAnswer)
      setFeedback(wasCorrect ? 'correct' : 'incorrect')
      setLastMessage(getDrillResultMessage(drill, wasCorrect))

      onRecordAttempt(stage.id, drill.id, wasCorrect)
    },
    [arrangeTokens, drill, feedback, onRecordAttempt, stage.id, textInput],
  )

  const goToNextDrill = useCallback(() => {
    const ids = stageStats?.completedDrillIds ?? []
    const next = getNextIncompleteDrill(stage, ids)
    if (next) {
      setActiveDrillId(next.id)
      resetDrillInput(next)
      return
    }
    onStageComplete?.()
  }, [onStageComplete, resetDrillInput, stage, stageStats?.completedDrillIds])

  const addTile = (tile) => {
    setArrangeTokens((prev) => [...prev, tile])
    setAvailableTiles((prev) => {
      const i = prev.indexOf(tile)
      if (i < 0) return prev
      return [...prev.slice(0, i), ...prev.slice(i + 1)]
    })
  }

  const removeLastToken = () => {
    setArrangeTokens((prev) => {
      if (!prev.length) return prev
      const last = prev[prev.length - 1]
      setAvailableTiles((tiles) => [...tiles, last])
      return prev.slice(0, -1)
    })
  }

  if (summary.allComplete) {
    const mastery = stage.mastery ?? {}
    const wasStageCompleted = progress?.completedStageIds?.includes(stage.id)

    return (
      <section
        className={[
          'rounded-xl border border-[#7BA821]/35 bg-[#1A1814] p-5 text-center',
          className,
        ].join(' ')}
      >
        <p className="text-lg font-medium text-[#E8D5A3]">All mini drills complete!</p>
        <p className="mt-2 text-sm text-[#E8D5A3]/75">
          {wasStageCompleted
            ? 'Stage mastery reached — the next lesson is on your roadmap.'
            : `You finished every drill. Keep practicing until you reach ${mastery.requiredCorrectDrills ?? 0} correct answers with good accuracy.`}
        </p>
        {onBackToRoadmap ? (
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="mt-4 rounded-xl bg-[#D4A843] px-5 py-2.5 text-sm font-semibold text-[#0F0E0C] hover:brightness-110"
          >
            Back to roadmap
          </button>
        ) : null}
      </section>
    )
  }

  if (!drill) {
    return (
      <section className={['rounded-xl border border-taupe/40 p-4 text-sm text-[#E8D5A3]/60', className].join(' ')}>
        No drills available for this stage.
      </section>
    )
  }

  const promptText = getDrillPromptText(drill)
  const showPinyinHints = stage.complexity?.pinyinVisible !== false

  return (
    <section
      className={[
        'space-y-4 rounded-xl border border-[#D4A843]/30 bg-gradient-to-br from-[#1A1814] to-[#0F0E0C] p-4 sm:p-5',
        className,
      ].join(' ')}
      aria-labelledby="mini-drill-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="mini-drill-heading" className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">
          Mini drill {drillIndex >= 0 ? drillIndex + 1 : ''} of {stage.drills.length}
        </h3>
        <span className="text-xs text-[#E8D5A3]/55">
          {summary.completed}/{summary.total} done
        </span>
      </div>

      <div className="space-y-2">
        {drill.promptChinese ? (
          <p className="font-serif text-2xl leading-snug text-[#E8D5A3] sm:text-3xl">{drill.promptChinese}</p>
        ) : null}
        {drill.prompt ? (
          <p className={drill.promptChinese ? 'text-sm text-[#E8D5A3]/80' : 'text-base text-[#E8D5A3]'}>
            {drill.prompt}
          </p>
        ) : null}
        {!drill.prompt && !drill.promptChinese ? (
          <p className="text-sm text-[#E8D5A3]/60">{promptText}</p>
        ) : null}
      </div>

      {drill.targetWords?.length ? (
        <p className="text-xs text-[#D4A843]/70">
          Focus: {drill.targetWords.join(' · ')}
        </p>
      ) : null}

      {drill.hint && feedback === 'idle' ? (
        <p className="text-xs text-[#E8D5A3]/50">Hint: {drill.hint}</p>
      ) : null}

      <DrillInput
        drill={drill}
        textInput={textInput}
        onTextChange={setTextInput}
        arrangeTokens={arrangeTokens}
        availableTiles={availableTiles}
        onAddTile={addTile}
        onRemoveLast={removeLastToken}
        onChoice={(choice) => handleSubmit(choice)}
        onSubmit={() => handleSubmit()}
        disabled={feedback === 'correct'}
        showPinyinHints={showPinyinHints}
      />

      {feedback !== 'idle' ? (
        <div
          className={[
            'rounded-lg px-3 py-2 text-sm',
            feedback === 'correct'
              ? 'border border-[#7BA821]/40 bg-[#7BA821]/10 text-[#b8e86a]'
              : 'border border-[#C97064]/40 bg-[#C97064]/10 text-[#f0b4ae]',
          ].join(' ')}
          role="status"
        >
          {lastMessage}
          {feedback === 'correct' && drill.explanation ? (
            <p className="mt-1 text-xs opacity-90">{drill.explanation}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {feedback === 'correct' ? (
          <button
            type="button"
            onClick={goToNextDrill}
            className="rounded-lg bg-[#D4A843] px-4 py-2 text-sm font-semibold text-[#0F0E0C] hover:brightness-110"
          >
            {getNextIncompleteDrill(stage, stageStats?.completedDrillIds ?? []) ? 'Next drill' : 'Finish'}
          </button>
        ) : (
          <>
            {drill.type !== DRILL_TYPES.MULTIPLE_CHOICE ? (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={feedback === 'correct'}
                className="rounded-lg bg-[#D4A843] px-4 py-2 text-sm font-semibold text-[#0F0E0C] hover:brightness-110 disabled:opacity-40"
              >
                Check answer
              </button>
            ) : null}
            {feedback === 'incorrect' ? (
              <button
                type="button"
                onClick={() => resetDrillInput(drill)}
                className="rounded-lg border border-[#D4A843]/35 px-4 py-2 text-sm text-[#E8D5A3] hover:border-[#D4A843]/55"
              >
                Try again
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

/**
 * @param {{
 *   drill: import('../engine/contextPackSchema.js').Drill
 *   textInput: string
 *   onTextChange: (v: string) => void
 *   arrangeTokens: string[]
 *   availableTiles: string[]
 *   onAddTile: (t: string) => void
 *   onRemoveLast: () => void
 *   onChoice: (c: string) => void
 *   onSubmit: () => void
 *   disabled: boolean
 *   showPinyinHints: boolean
 * }} props
 */
function DrillInput({
  drill,
  textInput,
  onTextChange,
  arrangeTokens,
  availableTiles,
  onAddTile,
  onRemoveLast,
  onChoice,
  onSubmit,
  disabled,
  showPinyinHints,
}) {
  switch (drill.type) {
    case DRILL_TYPES.MULTIPLE_CHOICE:
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {(drill.choices ?? []).map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={disabled}
              onClick={() => onChoice(choice)}
              className="rounded-lg border border-[#D4A843]/25 bg-[#0F0E0C]/80 px-4 py-3 font-serif text-lg text-[#E8D5A3] transition hover:border-[#D4A843]/50 disabled:opacity-50"
            >
              {choice}
            </button>
          ))}
        </div>
      )

    case DRILL_TYPES.ARRANGE_SENTENCE:
      return (
        <div className="space-y-3">
          <div
            className="min-h-[3rem] rounded-lg border border-dashed border-[#D4A843]/30 bg-[#0F0E0C]/60 px-3 py-2 font-serif text-xl text-[#E8D5A3]"
            aria-label="Your sentence"
          >
            {arrangeTokens.length ? arrangeTokens.join('') : (
              <span className="text-sm text-[#E8D5A3]/40">Tap tiles below to build the sentence</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTiles.map((tile, i) => (
              <button
                key={`${tile}-${i}`}
                type="button"
                disabled={disabled}
                onClick={() => onAddTile(tile)}
                className="rounded-md border border-[#D4A843]/30 bg-[#1A1814] px-3 py-1.5 font-serif text-lg text-[#E8D5A3] hover:bg-[#252219] disabled:opacity-50"
              >
                {tile}
              </button>
            ))}
          </div>
          {arrangeTokens.length ? (
            <button
              type="button"
              onClick={onRemoveLast}
              className="text-xs text-[#D4A843] hover:underline"
            >
              Undo last tile
            </button>
          ) : null}
        </div>
      )

    case DRILL_TYPES.PINYIN_INPUT:
      return (
        <input
          type="text"
          inputMode="text"
          value={textInput}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          disabled={disabled}
          placeholder={showPinyinHints ? 'Type pinyin (tones optional)' : 'Type pinyin'}
          className="w-full rounded-lg border border-[#D4A843]/25 bg-[#0F0E0C] px-3 py-2.5 text-base text-[#E8D5A3] outline-none focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30 disabled:opacity-50"
          autoComplete="off"
          spellCheck={false}
        />
      )

    case DRILL_TYPES.TRANSLATE_TO_CHINESE:
    case DRILL_TYPES.REPLY_SHORT:
    default:
      return (
        <>
          <ChineseKeyboardNotice />
          <input
            type="text"
            inputMode="text"
            value={textInput}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            disabled={disabled}
            placeholder="Type your answer in Chinese"
            className="w-full rounded-lg border border-[#D4A843]/25 bg-[#0F0E0C] px-3 py-2.5 font-serif text-lg text-[#E8D5A3] outline-none focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30 disabled:opacity-50"
            autoComplete="off"
            lang="zh"
            spellCheck={false}
          />
        </>
      )
  }
}

function ChineseKeyboardNotice() {
  return (
    <div className="mb-2 flex items-center justify-center gap-1 text-center text-xs text-[#8C7A52]">
      <span>⌨️</span>
      <span>
        Windows: press{' '}
        <kbd className="rounded border border-[#8C7A52]/40 px-1 py-0.5 font-mono text-[10px]">
          Win + Space
        </kbd>
        {' '}to switch to Chinese keyboard input
      </span>
    </div>
  )
}
