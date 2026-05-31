import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildQuestion, hashString } from '../utils/multipleChoiceQuizCore.js'
import { formatEnglishMeaningForDisplay } from '../utils/formatEnglishMeaning.js'
import { pinyinForDisplay } from '../utils/pinyinToneMark.js'
import { readLearnedCharacters } from '../utils/learnedCharacters.js'
import { isExcludedFromHskTypingPool } from '../utils/hskWordFilters.js'
import {
  applyQuizSrAnswer,
  clearQuizSrLevel,
  pickQuizSrCard,
  quizSrStats,
  readQuizPosition,
  readQuizSrMap,
  writeQuizPosition,
  writeQuizSrMap,
} from '../utils/quizSpacedRepetition.js'
import { HSK_DATA, preloadHskData } from '../utils/pinyinIme.js'
import { recordStudyActivity } from '../utils/studyStatsFirestore.js'
import { trackEvent } from '../utils/analytics.js'

const DIRECTIONS = [
  { id: 'hanzi', label: '汉字 → English' },
  { id: 'english', label: 'English → 汉字' },
  { id: 'mix', label: 'Mix' },
]

/** @typedef {{ simplified: string, pinyin: string, english: string }} HskPoolRow */

/** @typedef {{ simplified: string, pinyin: string, meaning: string }} QuizCard */

/**
 * @template {{ simplified: string }} T
 * @param {T[]} list
 * @param {string | null} excludeSimp
 * @param {number} salt
 * @returns {T | null}
 */
function pickRandomFromList(list, excludeSimp, salt) {
  if (!list.length) return null
  if (list.length === 1) return list[0]
  const candidates = list.filter((c) => c.simplified !== excludeSimp)
  const pool = candidates.length ? candidates : list
  const idx = hashString(`${salt}\0${pool.map((p) => p.simplified).join('\0')}`) % pool.length
  return pool[idx]
}

/**
 * @param {{ onGoToLearn: () => void }} props
 */
export default function QuizTab({ onGoToLearn }) {
  const [, setStoreTick] = useState(0)
  const [hskReady, setHskReady] = useState(false)
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState(null)
  const [directionMode, setDirectionMode] = useState('mix')
  /** Session-only: number of correct answers this page load (saved mode only) */
  const [correctCount, setCorrectCount] = useState(0)
  const [celebrateAll, setCelebrateAll] = useState(false)
  const [sourceMode, setSourceMode] = useState(() => (readLearnedCharacters().length > 0 ? 'saved' : 'random'))
  const [randomHskLevel, setRandomHskLevel] = useState(1)

  useEffect(() => {
    const fn = () => setStoreTick((t) => t + 1)
    window.addEventListener('huaxue-learned-changed', fn)
    return () => window.removeEventListener('huaxue-learned-changed', fn)
  }, [])

  useEffect(() => {
    let cancelled = false
    preloadHskData()
      .then(() => {
        if (!cancelled) setHskReady(true)
      })
      .catch((err) => {
        console.error('Failed to load HSK data', err)
        if (!cancelled) setHskReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const learned = readLearnedCharacters()
  const savedCount = learned.length

  const hskPoolRows = useMemo(() => {
    const arr = HSK_DATA[randomHskLevel - 1] ?? []
    return arr
      .filter((raw) => !isExcludedFromHskTypingPool(raw?.simplified))
      .map((raw) => ({
        simplified: String(raw?.simplified ?? '').trim(),
        pinyin: String(raw?.pinyin ?? '').trim(),
        english: String(raw?.english ?? '').trim(),
      }))
      .filter((w) => w.simplified)
  }, [randomHskLevel, hskReady])

  /** Random-mode SR bundle; `null` until layout sync runs. */
  const [randomQuiz, setRandomQuiz] = useState(
    /** @type {null | { level: number; position: number; srMap: Record<string, import('../utils/quizSpacedRepetition.js').QuizSrRecord>; card: HskPoolRow | null; questionNonce: number }} */ (
      null
    ),
  )
  const hskPoolRef = useRef(hskPoolRows)

  useEffect(() => {
    hskPoolRef.current = hskPoolRows
  }, [hskPoolRows])

  useLayoutEffect(() => {
    if (sourceMode !== 'random') return
    const rows = hskPoolRows
    if (!rows.length) {
      queueMicrotask(() =>
        setRandomQuiz({
          level: randomHskLevel,
          position: 0,
          srMap: {},
          card: null,
          questionNonce: 0,
        }),
      )
      return
    }
    const position = readQuizPosition(randomHskLevel)
    const srMap = readQuizSrMap(randomHskLevel)
    const card = pickQuizSrCard(rows, srMap, position, null, position * 7919 + rows.length)
    queueMicrotask(() =>
      setRandomQuiz({
        level: randomHskLevel,
        position,
        srMap,
        card,
        questionNonce: 0,
      }),
    )
  }, [sourceMode, randomHskLevel, hskPoolRows])

  const currentCard = useMemo(() => {
    if (sourceMode === 'random') {
      const row = randomQuiz?.card
      if (!row) return null
      return {
        simplified: row.simplified,
        pinyin: row.pinyin,
        meaning: row.english,
      }
    }
    if (!learned.length) return null
    return pickRandomFromList(learned, null, round * 7919 + learned.length)
  }, [sourceMode, randomQuiz?.card, learned, round])

  const buildQuestionOptions = useMemo(() => {
    if (sourceMode !== 'random') return undefined
    return { poolRows: hskPoolRows }
  }, [sourceMode, hskPoolRows])

  const questionRound = useMemo(() => {
    if (sourceMode === 'random') return randomQuiz?.questionNonce ?? 0
    return round
  }, [sourceMode, randomQuiz?.questionNonce, round])

  const isReverse = useMemo(() => {
    if (!currentCard) return false
    if (directionMode === 'english') return true
    if (directionMode === 'hanzi') return false
    return hashString(`${currentCard.simplified}\0${currentCard.meaning}\0${questionRound}`) % 2 === 1
  }, [currentCard, directionMode, questionRound])

  const { choices, correctIndex, clueText } = useMemo(() => {
    if (!currentCard) {
      return { choices: [], correctIndex: 0, clueText: '' }
    }
    return buildQuestion(
      currentCard.simplified,
      currentCard.meaning,
      questionRound,
      isReverse,
      buildQuestionOptions,
    )
  }, [currentCard, questionRound, isReverse, buildQuestionOptions])

  useEffect(() => {
    trackEvent('quiz_mode_selected', {
      source_mode: sourceMode,
      direction_mode: directionMode,
    })
  }, [sourceMode, directionMode])

  useEffect(() => {
    if (sourceMode !== 'random') return
    trackEvent('hsk_level_selected', { context: 'quiz_random', hsk_level: randomHskLevel })
  }, [randomHskLevel, sourceMode])

  const handlePick = useCallback(
    (index) => {
      if (picked !== null || !currentCard) return
      setPicked(index)
      void recordStudyActivity({
        quizAnswered: 1,
        quizCorrect: index === correctIndex ? 1 : 0,
        activeTab: 'quiz',
      })
      trackEvent('quiz_answered', {
        correct: index === correctIndex ? 1 : 0,
        source_mode: sourceMode,
        direction_mode: directionMode,
        hsk_level: sourceMode === 'random' ? randomHskLevel : 0,
      })
      if (index === correctIndex) trackEvent('quiz_correct')
      else trackEvent('quiz_wrong')
      if (sourceMode === 'saved' && index === correctIndex) {
        setCorrectCount((c) => c + 1)
      }
      if (sourceMode === 'random') {
        setRandomQuiz((prev) => {
          if (!prev?.card) return prev
          const { map, newPosition } = applyQuizSrAnswer(
            prev.srMap,
            prev.position,
            prev.card.simplified,
            index === correctIndex,
          )
          writeQuizSrMap(prev.level, map)
          writeQuizPosition(prev.level, newPosition)
          return { ...prev, srMap: map, position: newPosition }
        })
      }
    },
    [picked, currentCard, correctIndex, sourceMode, randomHskLevel, directionMode],
  )

  useEffect(() => {
    if (sourceMode !== 'saved') return
    if (savedCount <= 0) return
    if (correctCount !== savedCount) return
    if (correctCount <= 0) return

    queueMicrotask(() => setCelebrateAll(true))
    const t = window.setTimeout(() => {
      queueMicrotask(() => {
        setCelebrateAll(false)
        setCorrectCount(0)
        setPicked(null)
        setRound((r) => r + 1)
      })
    }, 1800)
    return () => window.clearTimeout(t)
  }, [sourceMode, correctCount, savedCount])

  const nextQuestion = useCallback(() => {
    setPicked(null)
    if (sourceMode === 'random') {
      setRandomQuiz((prev) => {
        if (!prev?.card) return prev
        const rows = hskPoolRef.current
        if (!rows.length) return { ...prev, card: null, questionNonce: prev.questionNonce + 1 }
        const next = pickQuizSrCard(
          rows,
          prev.srMap,
          prev.position,
          prev.card.simplified,
          prev.position * 7919 + rows.length,
        )
        return {
          ...prev,
          card: next,
          questionNonce: prev.questionNonce + 1,
        }
      })
      return
    }
    setRound((r) => r + 1)
  }, [sourceMode])

  const handleResetRandomLevel = useCallback(() => {
    if (
      !window.confirm(
        `Reset HSK ${randomHskLevel} quiz progress?\nThis cannot be undone.`,
      )
    ) {
      return
    }
    clearQuizSrLevel(randomHskLevel)
    const rows = hskPoolRef.current
    if (!rows.length) {
      setRandomQuiz({
        level: randomHskLevel,
        position: 0,
        srMap: {},
        card: null,
        questionNonce: 0,
      })
    } else {
      const card = pickQuizSrCard(rows, {}, 0, null, rows.length)
      setRandomQuiz({
        level: randomHskLevel,
        position: 0,
        srMap: {},
        card,
        questionNonce: 0,
      })
    }
    setPicked(null)
  }, [randomHskLevel])

  useEffect(() => {
    if (picked !== null || !currentCard) return
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.repeat) return
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        return
      }
      let idx = -1
      if (e.key >= '1' && e.key <= '4') idx = Number(e.key) - 1
      else if (e.code === 'Numpad1') idx = 0
      else if (e.code === 'Numpad2') idx = 1
      else if (e.code === 'Numpad3') idx = 2
      else if (e.code === 'Numpad4') idx = 3
      if (idx < 0 || idx >= choices.length) return
      e.preventDefault()
      handlePick(idx)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [picked, currentCard, choices, handlePick])

  useEffect(() => {
    if (picked === null || !currentCard || celebrateAll) return
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.repeat) return
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (picked === null) return
        nextQuestion()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [picked, currentCard, celebrateAll, nextQuestion])

  if (sourceMode === 'saved' && !learned.length) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col bg-transparent px-3 text-ink sm:px-4">
        <div className="mx-auto w-full max-w-lg flex flex-col pt-3">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              aria-current="true"
              className="cursor-default rounded-lg border border-[#D4A843] bg-[#D4A843]/15 px-2.5 py-1.5 text-xs font-medium text-[#D4A843]"
            >
              Bookmarked
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode('random')
                setRandomHskLevel(1)
                setPicked(null)
                setRound((r) => r + 1)
              }}
              className="rounded-lg border border-taupe px-2.5 py-1.5 text-xs font-medium text-espresso transition hover:border-[#D4A843]/50 hover:bg-elevated"
            >
              HSK
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="flex max-w-md flex-col items-center gap-2 text-base leading-relaxed text-espresso">
            <span className="text-2xl" aria-hidden>
              🔖
            </span>
            <span>No saved characters yet — bookmark words on the Learn tab first</span>
          </p>
          <button
            type="button"
            onClick={onGoToLearn}
            className="mt-8 rounded-xl bg-clay px-6 py-3 text-sm font-medium text-paper shadow-sm hover:bg-btn-hover"
          >
            Go to Learn →
          </button>
        </div>
      </div>
    )
  }

  if (!currentCard) {
    const randomWaiting = sourceMode === 'random' && hskPoolRows.length > 0 && randomQuiz === null
    if (randomWaiting) {
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center bg-transparent px-4 text-center text-ink">
          <p className="text-sm text-espresso/80">Loading quiz…</p>
        </div>
      )
    }
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center bg-transparent px-4 text-center text-ink">
        <p className="text-espresso">No words loaded for this HSK level.</p>
      </div>
    )
  }

  const srProgressLine =
    sourceMode === 'random' && randomQuiz && hskPoolRows.length > 0
      ? (() => {
          const { due, mastered, remaining } = quizSrStats(
            hskPoolRows,
            randomQuiz.srMap,
            randomQuiz.position,
          )
          return `${due} due · ${mastered} mastered · ${remaining} left`
        })()
      : null
  const char = currentCard.simplified
  const charLen = [...char].length
  const pinyinDisplay = pinyinForDisplay(currentCard.pinyin)
  const scoreLabel = `${correctCount} / ${savedCount} correct`
  const showScore = sourceMode === 'saved'

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-transparent px-3 text-ink sm:px-4">
      {celebrateAll ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-4"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-xl border border-clay/60 bg-elevated px-5 py-3 text-center text-sm font-semibold text-ink shadow-lg">
            🎉 All correct!
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-lg flex flex-col">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (sourceMode === 'saved') return
                  setSourceMode('saved')
                  setPicked(null)
                  setRound((r) => r + 1)
                }}
                className={[
                  'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                  sourceMode === 'saved'
                    ? 'border-[#D4A843] bg-[#D4A843]/15 text-[#D4A843]'
                    : 'border-taupe text-espresso hover:border-[#D4A843]/50 hover:bg-elevated',
                ].join(' ')}
              >
                Bookmarked
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sourceMode === 'random') return
                  setSourceMode('random')
                  setRandomHskLevel(1)
                  setPicked(null)
                  setRound((r) => r + 1)
                }}
                className={[
                  'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                  sourceMode === 'random'
                    ? 'border-[#D4A843] bg-[#D4A843]/15 text-[#D4A843]'
                    : 'border-taupe text-espresso hover:border-[#D4A843]/50 hover:bg-elevated',
                ].join(' ')}
              >
                HSK
              </button>
              <span className="mx-1 hidden h-4 w-px shrink-0 bg-taupe/80 sm:inline" aria-hidden />
              <div className="flex flex-wrap gap-1.5">
                {DIRECTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setDirectionMode(id)
                      setPicked(null)
                      if (sourceMode === 'random') {
                        setRandomQuiz((s) =>
                          s ? { ...s, questionNonce: s.questionNonce + 1 } : s,
                        )
                      } else {
                        setRound((r) => r + 1)
                      }
                    }}
                    className={[
                      'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                      directionMode === id
                        ? 'border-clay bg-clay text-paper'
                        : 'border-taupe text-espresso hover:bg-elevated',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {sourceMode === 'random' ? (
                <>
                  <span className="mx-1 h-4 w-px shrink-0 self-center bg-taupe/80" aria-hidden />
                  <button
                    type="button"
                    onClick={handleResetRandomLevel}
                    className="text-[11px] font-medium text-[#D4A843]/70 underline decoration-[#D4A843]/40 underline-offset-2 transition hover:text-[#D4A843] hover:decoration-[#D4A843] sm:text-xs"
                  >
                    Reset
                  </button>
                </>
              ) : null}
            </div>
            {sourceMode === 'random' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => {
                      setRandomHskLevel(lv)
                      setPicked(null)
                    }}
                    className={[
                      'rounded-lg border px-2 py-1 text-[11px] font-medium transition',
                      randomHskLevel === lv
                        ? 'border-[#D4A843] bg-[#D4A843]/15 text-[#D4A843]'
                        : 'border-taupe text-espresso hover:border-[#D4A843]/40 hover:bg-elevated',
                    ].join(' ')}
                  >
                    HSK {lv}
                  </button>
                ))}
                {srProgressLine ? (
                  <>
                    <span className="mx-1 h-4 w-px shrink-0 self-center bg-taupe/80" aria-hidden />
                    <p className="text-[11px] tabular-nums tracking-wide text-espresso/65 sm:text-xs">
                      {srProgressLine}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          {showScore ? (
            <span className="shrink-0 text-sm tabular-nums text-espresso">{scoreLabel}</span>
          ) : null}
        </div>

        <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-[#3A3529] bg-[#1C1A16] shadow-sm">
          <div className="flex flex-col items-center justify-center px-5 py-4 text-center sm:px-6">
            {isReverse ? (
              <>
                <p
                  className="max-w-lg font-normal leading-snug text-ink"
                  style={{ fontSize: 'clamp(20px, 4.5vw, 30px)' }}
                >
                  {formatEnglishMeaningForDisplay(char, clueText || currentCard.meaning || '')}
                </p>
              </>
            ) : (
              <>
                <div
                  className={[
                    'max-w-[min(100%,92vw)] font-normal leading-none text-ink',
                    charLen >= 3 ? 'whitespace-nowrap' : '',
                  ].join(' ')}
                  style={{ fontSize: 'clamp(50px, 10vw, 100px)' }}
                >
                  {char}
                </div>
                <p className="mt-3 text-[clamp(1.15rem,3.5vw,1.75rem)] font-normal leading-tight text-espresso/90">
                  {pinyinDisplay}
                </p>
              </>
            )}
          </div>

          <div className="border-t border-[#3A3529] bg-[#252219] p-4">
            <div className="flex flex-col gap-1.5">
              {choices.map((label, i) => {
                const isPicked = picked === i
                const isCorrect = i === correctIndex
                let ring = 'border-[#3A3529]'
                if (picked !== null) {
                  if (isCorrect) ring = 'border-correct bg-correct/20'
                  else if (isPicked) ring = 'border-wrong bg-wrong/25'
                }
                return (
                  <button
                    key={`${questionRound}-${i}-${String(label).slice(0, 24)}`}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => handlePick(i)}
                    className={[
                      'flex min-h-[52px] w-full flex-row items-center gap-[12px] rounded-xl border px-4 py-1.5 leading-snug text-ink transition sm:px-5',
                      isReverse ? 'tracking-wide' : '',
                      ring,
                      picked === null ? 'hover:border-[#D4A843]/50 hover:bg-[#1C1A16]/80' : '',
                      picked !== null && !isCorrect && !isPicked ? 'opacity-45' : '',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-8 w-8 shrink-0 flex-row items-center justify-center rounded-lg border text-sm font-bold tabular-nums leading-none text-[#D4A843]',
                        picked !== null && isCorrect && i === correctIndex
                          ? 'border-correct bg-correct/20 text-correct'
                          : picked !== null && isPicked && !isCorrect
                            ? 'border-wrong bg-wrong/20 text-wrong'
                            : 'border-[#D4A843]/60 bg-[#D4A843]/12',
                      ].join(' ')}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={
                        isReverse
                          ? 'min-w-0 flex-1 text-center text-2xl font-medium leading-snug sm:text-3xl'
                          : 'min-w-0 flex-1 text-left text-base font-medium leading-snug'
                      }
                    >
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

            {picked !== null && (
              <div className="mt-3 flex flex-col items-center gap-2 border-t border-[#3A3529] pt-3">
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    disabled={celebrateAll}
                    onClick={nextQuestion}
                    className="rounded-xl bg-clay px-6 py-3 text-sm font-medium text-paper hover:bg-btn-hover disabled:opacity-50"
                  >
                    Next Question →
                  </button>
                  <p className="text-center text-sm text-neutral-500">or press Space</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
