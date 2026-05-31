import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HSK_DATA, preloadHskData } from '../utils/pinyinIme.js'
import { formatEnglishMeaningForDisplay } from '../utils/formatEnglishMeaning.js'
import { pinyinForDisplay } from '../utils/pinyinToneMark.js'
import { isLearnedSaved, removeLearnedCharacter, saveLearnedCharacter, toggleLearnedCharacter } from '../utils/learnedCharacters.js'
import { pushHskProgressLevel } from '../utils/hskProgressCloud.js'
import { recordStudyActivity } from '../utils/studyStatsFirestore.js'
import { trackEvent } from '../utils/analytics.js'

const STORAGE_KEY = 'huaxue-hsk-flashcards-v1'

/** @typedef {{ char: string, pinyin: string, meaning: string, rating: number, lastReviewed: string, timesReviewed: number, masteredAt?: string }} CardProgress */

function readStore() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw)
    return p && typeof p === 'object' ? p : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/** @param {Record<number, Record<string, CardProgress>>} store */
function getProgress(store, level, char) {
  return store[level]?.[char] ?? null
}

/** @param {Record<number, Record<string, CardProgress>>} store */
function saveProgress(store, level, char, pinyin, meaning, rating, prev) {
  const next = { ...store, [level]: { ...store[level] } }
  const timesReviewed = (prev?.timesReviewed ?? 0) + 1
  const now = new Date().toISOString()
  const base = {
    char,
    pinyin,
    meaning,
    rating,
    lastReviewed: now,
    timesReviewed,
  }
  next[level][char] =
    rating >= 5
      ? { ...base, rating: 5, masteredAt: now }
      : { ...base, rating, masteredAt: undefined }
  writeStore(next)
  return next
}

function normalizeWord(w) {
  return {
    simplified: String(w.simplified ?? '').trim(),
    pinyin: String(w.pinyin ?? '').trim(),
    english: String(w.english ?? '').trim(),
  }
}

function dedupeWords(words) {
  const seen = new Set()
  return words.filter((w) => {
    if (seen.has(w.simplified)) return false
    seen.add(w.simplified)
    return true
  })
}

function buildDeck(level, words) {
  const store = readStore()
  const list = dedupeWords(words.map(normalizeWord).filter((w) => w.simplified))
  const map = store[level] ?? {}
  const unmastered = list.filter((w) => (map[w.simplified]?.rating ?? 0) < 5)
  return [...unmastered].sort((a, b) => {
    const ra = map[a.simplified]?.rating ?? 0
    const rb = map[b.simplified]?.rating ?? 0
    if (ra !== rb) return ra - rb
    const ta = map[a.simplified]?.lastReviewed ?? ''
    const tb = map[b.simplified]?.lastReviewed ?? ''
    return String(ta).localeCompare(String(tb))
  })
}

function countMastered(level, words) {
  const store = readStore()
  const map = store[level] ?? {}
  return words.filter((w) => {
    const p = map[w.simplified]
    return (p?.rating ?? 0) >= 5
  }).length
}

function mixSeed(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function IconBookmark({ filled }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} strokeWidth="1.5" stroke="currentColor" className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  )
}

const RATING_OPTIONS = [
  { value: 1, emoji: '😰', label: '1' },
  { value: 2, emoji: '😕', label: '2' },
  { value: 3, emoji: '😐', label: '3' },
  { value: 4, emoji: '🙂', label: '4' },
  { value: 5, emoji: '🌟', label: '5' },
]

/** Hanzi on card: scales down so ~3 characters fit on one line within typical phone widths. */
function flashcardHanFontSize(charCount) {
  const n = Math.max(1, Math.min(charCount || 1, 10))
  if (n === 1) return 'clamp(2.5rem, 9vw, 5rem)'
  if (n === 2) return 'clamp(1.875rem, min(8vw, calc(52vw / 2)), 3.75rem)'
  return `clamp(1.5rem, min(6.5vw, calc(58vw / ${n})), 3rem)`
}

export default function FlashcardsTab() {
  const [hskReady, setHskReady] = useState(false)
  const levels = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((level) => ({
        level,
        label: `HSK ${level}`,
        words: HSK_DATA[level - 1] ?? [],
      })),
    [hskReady],
  )

  const [storeTick, setStoreTick] = useState(0)
  const [mode, setMode] = useState('picker')
  const [activeLevel, setActiveLevel] = useState(1)
  const [deck, setDeck] = useState([])
  const [initialKeys, setInitialKeys] = useState(() => new Set())
  const [uniqueRated, setUniqueRated] = useState(() => new Set())
  const [sessionRatings, setSessionRatings] = useState(0)
  const [startRatings, setStartRatings] = useState(() => new Map())
  const [finalRatings, setFinalRatings] = useState(() => new Map())

  const [showPinyin, setShowPinyin] = useState(true)
  const [meaningRevealed, setMeaningRevealed] = useState(false)
  const [, setSavedTick] = useState(0)
  const [bookmarkPulse, setBookmarkPulse] = useState(false)
  const [deckToast, setDeckToast] = useState(/** @type {string | null} */ (null))

  const [completeStats, setCompleteStats] = useState({ newMastered: 0, stillLearning: 0, toReview: 0 })

  const studyRootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const deckToastTimerRef = useRef(0)
  const modeRef = useRef(mode)
  const meaningRevealedRef = useRef(meaningRevealed)
  const currentRef = useRef(/** @type {{ simplified: string, pinyin: string, english: string } | null} */ (null))
  const applyRatingRef = useRef(/** @type {(rating: number) => void} */ (() => {}))
  const handleQuizDeckToggleRef = useRef(/** @type {() => void} */ (() => {}))

  const bumpStore = useCallback(() => setStoreTick((t) => t + 1), [])

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

  const revealCardMeaning = useCallback(() => {
    setMeaningRevealed(true)
    trackEvent('flashcard_revealed', { hsk_level: activeLevel })
  }, [activeLevel])

  useEffect(() => {
    const fn = () => setSavedTick((t) => t + 1)
    window.addEventListener('huaxue-learned-changed', fn)
    return () => window.removeEventListener('huaxue-learned-changed', fn)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(deckToastTimerRef.current)
      deckToastTimerRef.current = 0
    },
    [],
  )

  const showDeckToast = useCallback((text) => {
    setDeckToast(text)
    window.clearTimeout(deckToastTimerRef.current)
    deckToastTimerRef.current = window.setTimeout(() => {
      setDeckToast(null)
      deckToastTimerRef.current = 0
    }, 1500)
  }, [])

  const levelMeta = useMemo(() => {
    void storeTick
    return levels.map((L) => {
      const wordsNorm = dedupeWords(L.words.map(normalizeWord).filter((w) => w.simplified))
      return {
        ...L,
        words: wordsNorm,
        total: wordsNorm.length,
        mastered: countMastered(L.level, wordsNorm),
      }
    })
  }, [levels, storeTick])

  const beginSession = useCallback(
    (level) => {
      const words = levels.find((l) => l.level === level)?.words ?? []
      const d = buildDeck(level, words)
      if (d.length === 0) {
        setActiveLevel(level)
        setMode('empty')
        return
      }
      const keys = new Set(d.map((w) => w.simplified))
      const store = readStore()
      const map = store[level] ?? {}
      const snap = new Map()
      const fin = new Map()
      for (const k of keys) {
        const r = map[k]?.rating ?? 0
        snap.set(k, r)
        fin.set(k, r)
      }
      setActiveLevel(level)
      setDeck(d)
      setInitialKeys(keys)
      setUniqueRated(new Set())
      setSessionRatings(0)
      setStartRatings(snap)
      setFinalRatings(fin)
      setShowPinyin(true)
      setMeaningRevealed(false)
      setMode('study')
      trackEvent('hsk_level_selected', { context: 'flashcards', hsk_level: level })
    },
    [levels]
  )

  const current = deck[0] ?? null
  const queueTotal = deck.length
  const queueLabel = queueTotal > 0 ? `1 / ${queueTotal}` : '0 / 0'

  const isQuizSaved = current ? isLearnedSaved(current.simplified) : false

  const handleQuizDeckToggle = useCallback(() => {
    if (!current) return
    const store = readStore()
    const prev = getProgress(store, activeLevel, current.simplified)
    const masteryRating = prev?.rating ?? 0
    toggleLearnedCharacter({
      simplified: current.simplified,
      pinyin: current.pinyin,
      meaning: current.english,
      rating: masteryRating,
      hskLevel: activeLevel,
    })
    setSavedTick((t) => t + 1)
    setBookmarkPulse(true)
    window.setTimeout(() => setBookmarkPulse(false), 450)
  }, [current, activeLevel])

  const finishSession = useCallback(
    (nextFinalRatings) => {
      let newMastered = 0
      let stillLearning = 0
      let toReview = 0
      for (const char of initialKeys) {
        const start = startRatings.get(char) ?? 0
        const end = nextFinalRatings.get(char) ?? start
        if (end >= 5 && start < 5) newMastered += 1
        if (end < 5) {
          if (end === 3 || end === 4) stillLearning += 1
          else if (end === 1 || end === 2) toReview += 1
          else toReview += 1
        }
      }
      setCompleteStats({ newMastered, stillLearning, toReview })
      setMode('complete')
      bumpStore()
    },
    [bumpStore, initialKeys, startRatings]
  )

  const applyRating = useCallback(
    (rating) => {
      if (!current) return
      const cur = current
      const store = readStore()
      const prev = getProgress(store, activeLevel, cur.simplified)
      saveProgress(store, activeLevel, cur.simplified, cur.pinyin, cur.english, rating, prev)
      void recordStudyActivity({ flashcardsRated: 1, activeTab: 'flashcards' })
      trackEvent('flashcard_rated', { rating, hsk_level: activeLevel })
      const storeAfter = readStore()

      if (rating === 5) {
        const L = levels.find((l) => l.level === activeLevel)
        if (L) {
          const wordsNorm = dedupeWords(L.words.map(normalizeWord).filter((w) => w.simplified))
          void pushHskProgressLevel(activeLevel, countMastered(activeLevel, wordsNorm), wordsNorm.length)
        }
      }

      if (rating <= 3) {
        if (!isLearnedSaved(cur.simplified)) {
          saveLearnedCharacter({
            simplified: cur.simplified,
            pinyin: cur.pinyin,
            meaning: cur.english,
            rating: 0,
            hskLevel: activeLevel,
            lastReviewed: new Date().toISOString(),
            timesReviewed: 0,
          })
          showDeckToast('Added to Quiz deck')
        }
      } else if (rating >= 4) {
        if (isLearnedSaved(cur.simplified)) {
          removeLearnedCharacter(cur.simplified)
          showDeckToast('Removed from Quiz deck')
        }
      }

      const nextFinal = new Map(finalRatings)
      nextFinal.set(cur.simplified, rating)

      const nextUnique = new Set(uniqueRated)
      nextUnique.add(cur.simplified)
      const roundDone = nextUnique.size >= initialKeys.size

      setFinalRatings(nextFinal)
      setUniqueRated(nextUnique)
      setSessionRatings((c) => c + 1)
      setMeaningRevealed(false)

      setDeck((prevDeck) => {
        if (!prevDeck[0] || prevDeck[0].simplified !== cur.simplified) return prevDeck
        let next = prevDeck.slice(1)
        if (rating <= 2) {
          const slot = 3 + (mixSeed(`${cur.simplified}|${activeLevel}|${sessionRatings}`) % 3)
          const insertAt = Math.min(slot, next.length)
          next = [...next.slice(0, insertAt), cur, ...next.slice(insertAt)]
        } else if (rating <= 4) {
          next = [...next, cur]
        }
        return next.filter((w) => (getProgress(storeAfter, activeLevel, w.simplified)?.rating ?? 0) < 5)
      })

      if (roundDone) {
        finishSession(nextFinal)
      } else {
        bumpStore()
      }
    },
    [
      activeLevel,
      current,
      finalRatings,
      uniqueRated,
      initialKeys,
      finishSession,
      bumpStore,
      sessionRatings,
      levels,
      showDeckToast,
    ],
  )

  useEffect(() => {
    meaningRevealedRef.current = meaningRevealed
    currentRef.current = current
    applyRatingRef.current = applyRating
    modeRef.current = mode
    handleQuizDeckToggleRef.current = handleQuizDeckToggle
  }, [meaningRevealed, current, applyRating, mode, handleQuizDeckToggle])

  const isStudying = mode === 'study'

  useEffect(() => {
    if (!isStudying) return undefined

    const shouldHandleShortcut = () => {
      const root = studyRootRef.current
      const el = document.activeElement
      if (!root) return false
      if (!el || !(el instanceof Node)) return true
      if (el === document.body || el === document.documentElement) return true
      if (root.contains(el)) return true
      return false
    }

    const isTypingInField = () => {
      const el = document.activeElement
      if (!el || !(el instanceof HTMLElement)) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (el.isContentEditable) return true
      return false
    }

    const onKeyDown = (e) => {
      if (modeRef.current !== 'study') return
      if (!currentRef.current) return
      if (!shouldHandleShortcut()) return
      if (isTypingInField()) return

      if (e.key === 'Tab') {
        if (e.altKey || e.ctrlKey || e.metaKey) return
        e.preventDefault()
        e.stopPropagation()
        handleQuizDeckToggleRef.current()
        return
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        if (!meaningRevealedRef.current) {
          revealCardMeaning()
        }
        return
      }

      if (/^[1-5]$/.test(e.key)) {
        if (meaningRevealedRef.current) {
          e.preventDefault()
          e.stopPropagation()
          applyRatingRef.current(Number(e.key))
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStudying, meaningRevealed, current, applyRating, handleQuizDeckToggle, revealCardMeaning])

  if (mode === 'picker') {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-y-auto bg-transparent px-3 text-ink sm:px-4">
        <div className="mx-auto w-full max-w-lg shrink-0 py-2 sm:py-3">
          <h2 className="sr-only">Choose HSK level</h2>
          <p className="mb-3 text-center text-sm text-espresso/85">Pick a level to study flashcards.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {levelMeta.map(({ level, label, total, mastered }) => {
              const pct = total ? Math.round((mastered / total) * 100) : 0
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => beginSession(level)}
                  className="flex flex-col rounded-2xl border border-clay bg-elevated p-4 text-left shadow-sm transition hover:border-clay hover:shadow-md sm:p-5"
                >
                  <span className="text-xl font-semibold text-ink sm:text-2xl">{label}</span>
                  <span className="mt-1 text-sm text-espresso/90">{total} words</span>
                  <span className="text-sm text-clay">{mastered} mastered</span>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-taupe/50" aria-hidden>
                    <div className="h-full rounded-full bg-clay transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="mt-1 text-xs text-espresso/70">{pct}% mastery</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'empty') {
    const L = levels.find((l) => l.level === activeLevel)
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center bg-transparent px-3 text-center text-ink sm:px-4">
        <p className="text-lg text-espresso">You have mastered every word in {L?.label ?? 'this level'}.</p>
        <button
          type="button"
          className="mt-6 rounded-xl border border-taupe bg-elevated px-6 py-3 text-sm font-medium text-ink shadow-sm hover:border-clay"
          onClick={() => {
            bumpStore()
            setMode('picker')
          }}
        >
          Back to levels
        </button>
      </div>
    )
  }

  if (mode === 'complete') {
    const L = levels.find((l) => l.level === activeLevel)
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center bg-transparent px-3 text-center text-ink sm:px-4">
        <h2 className="text-2xl font-semibold text-ink sm:text-3xl">Session Complete! 🎉</h2>
        <p className="mt-2 text-sm text-espresso/90">{L?.label}</p>
        <ul className="mt-6 w-full max-w-sm space-y-2 text-left text-sm text-espresso">
          <li>
            <span className="font-medium text-ink">{completeStats.newMastered}</span> new mastered
          </li>
          <li>
            <span className="font-medium text-ink">{completeStats.stillLearning}</span> still learning (ratings 3–4)
          </li>
          <li>
            <span className="font-medium text-ink">{completeStats.toReview}</span> to review (ratings 1–2)
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="rounded-xl bg-clay px-6 py-3 text-sm font-medium text-paper shadow-sm hover:bg-btn-hover"
            onClick={() => beginSession(activeLevel)}
          >
            Study Again
          </button>
          <button
            type="button"
            className="rounded-xl border border-taupe bg-elevated px-6 py-3 text-sm font-medium text-ink hover:border-clay"
            onClick={() => {
              bumpStore()
              setMode('picker')
            }}
          >
            Back to Levels
          </button>
        </div>
      </div>
    )
  }

  const L = levels.find((l) => l.level === activeLevel)

  return (
    <div ref={studyRootRef} className="flex min-h-0 w-full flex-1 flex-col bg-transparent px-3 text-ink sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5 sm:px-1">
        <button
          type="button"
          onClick={() => {
            setMode('picker')
            bumpStore()
          }}
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-clay hover:bg-elevated hover:text-ink"
        >
          <IconBack />
          <span>{L?.label ?? 'HSK'}</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-espresso">{queueLabel}</span>
          <button
            type="button"
            onClick={() => setShowPinyin((s) => !s)}
            className="rounded-lg border border-taupe bg-parchment px-3 py-1.5 text-xs font-medium text-ink hover:border-clay"
          >
            {showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
          </button>
        </div>
      </div>

      <div className="mx-1.5 rounded-2xl border border-taupe bg-parchment shadow-sm sm:mx-2">
        {current && (
          <div className="relative flex flex-col items-center gap-4 px-4 pb-5 pt-4 text-center sm:gap-5 sm:px-5 sm:pb-6 sm:pt-5">
            {deckToast ? (
              <p
                key={deckToast}
                className="huaxue-deck-toast pointer-events-none absolute inset-x-0 bottom-3 z-20 px-3 text-center text-xs text-muted"
                role="status"
                aria-live="polite"
              >
                {deckToast}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleQuizDeckToggle}
              title={isQuizSaved ? 'Remove from Quiz deck' : 'Save to Quiz deck'}
              aria-label={isQuizSaved ? 'Remove from Quiz deck' : 'Save to Quiz deck'}
              className={[
                'absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition sm:right-3 sm:top-3',
                bookmarkPulse ? 'motion-safe:animate-pulse' : '',
                isQuizSaved
                  ? 'text-[#D4A843] hover:bg-[#D4A843]/10'
                  : 'text-[#D4A843]/45 hover:bg-elevated hover:text-[#D4A843]/75',
              ].join(' ')}
            >
              <IconBookmark filled={isQuizSaved} />
            </button>

            <div className="mx-auto w-full max-w-full px-0.5 text-center">
              <span
                className="inline-block whitespace-nowrap leading-none font-normal text-ink"
                style={{ fontSize: flashcardHanFontSize([...current.simplified].length) }}
              >
                {current.simplified}
              </span>
            </div>
            {showPinyin && (
              <p className="text-[clamp(1.25rem,4.5vw,2rem)] font-normal leading-tight text-espresso">
                {pinyinForDisplay(current.pinyin)}
              </p>
            )}
            {!meaningRevealed ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={revealCardMeaning}
                  className="rounded-xl border border-taupe bg-elevated px-5 py-2.5 text-sm font-medium text-ink shadow-sm hover:border-clay"
                >
                  Tap to reveal meaning
                </button>
                <p className="text-[11px] text-muted">or press Space</p>
              </div>
            ) : (
              <p className="max-w-md text-base leading-snug text-muted motion-safe:transition-opacity motion-safe:duration-500 sm:text-lg">
                {formatEnglishMeaningForDisplay(current.simplified, current.english)}
              </p>
            )}

            {meaningRevealed && (
              <div className="flex w-full max-w-lg flex-col items-center gap-2 sm:gap-2.5">
                <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-2.5">
                  {RATING_OPTIONS.map(({ value, emoji, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => applyRating(value)}
                      className="flex min-w-[4.25rem] flex-col items-center rounded-xl border border-taupe bg-elevated px-2.5 py-2 text-sm text-ink transition hover:border-clay sm:min-w-[4.5rem] sm:px-3"
                      aria-label={`Confidence ${value}`}
                    >
                      <span className="text-xl" aria-hidden>
                        {emoji}
                      </span>
                      <span className="font-medium tabular-nums">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">or press 1–5</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
