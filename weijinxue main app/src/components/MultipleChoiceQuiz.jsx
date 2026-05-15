import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildQuestion, hashString } from '../utils/multipleChoiceQuizCore.js'

const DIRECTIONS = [
  { id: 'mix', label: 'Mix' },
  { id: 'hanzi', label: '汉字 → 英语' },
  { id: 'english', label: '英语 → 汉字' },
]

export default function MultipleChoiceQuiz({ entry, isOpen }) {
  const char = (entry?.char || '').trim() || '学'
  const meaning = (entry?.meaning || '').trim() || ''

  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState(null)
  const [directionMode, setDirectionMode] = useState('mix')

  useEffect(() => {
    queueMicrotask(() => {
      setRound(0)
      setPicked(null)
    })
  }, [char, meaning])

  const isReverse = useMemo(() => {
    if (directionMode === 'english') return true
    if (directionMode === 'hanzi') return false
    return hashString(`${char}\0${meaning}\0${round}`) % 2 === 1
  }, [char, meaning, round, directionMode])

  const { choices, correctIndex, clueText } = useMemo(
    () => buildQuestion(char, meaning, round, isReverse),
    [char, meaning, round, isReverse],
  )

  const handlePick = useCallback(
    (index) => {
      if (picked !== null) return
      setPicked(index)
    },
    [picked],
  )

  const nextRound = useCallback(() => {
    setPicked(null)
    setRound((r) => r + 1)
  }, [])

  if (!isOpen) {
    return <div id="multiple-choice-quiz-panel" hidden className="sr-only" aria-hidden="true" />
  }

  return (
    <div
      id="multiple-choice-quiz-panel"
      className="border-t border-taupe bg-elevated px-3 py-4 sm:px-4"
      role="region"
      aria-label="Multiple choice quiz"
    >
      <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-clay">Multiple choice</h3>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {DIRECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setDirectionMode(id)}
            className={[
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
              directionMode === id
                ? 'border-clay bg-clay text-paper'
                : 'border-taupe text-espresso hover:bg-parchment/50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-center text-xs text-muted">
        {isReverse
          ? 'Which word matches this meaning? (Distractors are nearby HSK words, similar length and part of speech.)'
          : 'Pick the English that matches the word above. (Wrong answers are plausible: same kind of word, similar length, nearby HSK.)'}
      </p>

      {isReverse && clueText && (
        <p
          className="mx-auto mt-4 max-w-md px-2 text-center font-normal leading-snug text-ink"
          style={{ fontSize: 'clamp(17px, 3.8vw, 22px)' }}
        >
          {clueText}
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {choices.map((label, i) => {
          const isPicked = picked === i
          const isCorrect = i === correctIndex
          let ring = 'border-taupe'
          if (picked !== null) {
            if (isCorrect) ring = 'border-correct bg-correct/25'
            else if (isPicked) ring = 'border-wrong bg-wrong/30'
          }
          return (
            <button
              key={`${round}-${i}-${label.slice(0, 32)}`}
              type="button"
              disabled={picked !== null}
              onClick={() => handlePick(i)}
              className={[
                'rounded-xl border px-3 py-3 text-left text-sm leading-snug text-ink transition',
                isReverse ? 'text-center text-xl font-medium tracking-wide' : '',
                ring,
                picked === null ? 'hover:border-clay hover:bg-parchment/50' : '',
                picked !== null && !isCorrect && !isPicked ? 'opacity-50' : '',
              ].join(' ')}
            >
              <span className="font-medium text-espresso">{String.fromCharCode(65 + i)}.</span>{' '}
              {label}
            </button>
          )
        })}
      </div>

      {picked !== null && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-center text-sm text-espresso">
            {picked === correctIndex ? (
              <span className="font-medium text-correct">Correct!</span>
            ) : (
              <>
                The answer was: <span className="font-medium text-correct">{choices[correctIndex]}</span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={nextRound}
            className="rounded-xl bg-clay px-5 py-2 text-sm font-medium text-paper hover:bg-btn-hover"
          >
            Next question
          </button>
        </div>
      )}
    </div>
  )
}
