// Typing engine logic adapted from Qwerty Learner
// https://github.com/RealKai42/qwerty-learner
// GPL-3.0 License
// IME-style candidate lookup uses CC-CEDICT (same normalization as PinyinSearch).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  HSK_DATA,
  buildPinyinPrefixIndex,
  digitKeyToSlot,
  fullTonelessPinyin,
  lookupFromIndex,
  normalizeQuery,
  pickCedictEntryForWord,
  preloadPinyinImeData,
} from '../utils/pinyinIme.js'
import {
  formatEnglishMeaningForDisplay,
  resolveTypeHskDisplayEnglish,
  resolveTypeHskDisplayPinyin,
  resolveTypeHskMeaningPlain,
} from '../utils/formatEnglishMeaning.js'
import { pinyinForDisplay } from '../utils/pinyinToneMark.js'
import { saveLearnedCharacter } from '../utils/learnedCharacters.js'
import { isExcludedFromHskTypingPool } from '../utils/hskWordFilters.js'
import { SENT_ROWS_BY_LEVEL } from '../utils/sentenceData.js'
import { mergeSentenceContextCandidates } from '../utils/sentenceIme.js'
import { filterRowsByHskVocabulary } from '../utils/hskSentenceFilter.js'
import { markSentenceSeen } from '../utils/sentenceSeenLog.js'
import {
  createSentenceSessionDeck,
  takeFromSentenceSessionDeck,
} from '../utils/sentenceDeckShuffle.js'
import { recordStudyActivity } from '../utils/studyStatsFirestore.js'
import { trackEvent } from '../utils/analytics.js'
import { PinyinStreamInput } from '../type/components/PinyinStreamInput.jsx'
import { useScoreSystem } from '../type/scoring/useScoreSystem.js'
import { usePersonalBest } from '../type/scoring/usePersonalBest.js'
import { useLeaderboard } from '../type/scoring/useLeaderboard.js'
import { XPOrbSystem } from '../type/components/XPOrbSystem.jsx'
import { MultiplierBadge } from '../type/components/MultiplierBadge.jsx'
import { SessionResults } from '../type/components/SessionResults.jsx'
import { SentenceCarousel } from '../type/components/SentenceCarousel.jsx'
import { AmbientParticles } from '../type/effects/AmbientParticles.jsx'

/**
 * One entry per HSK level (1–6). Levels 5–6 reuse the HSK4 extended pool until
 * `sentences_hsk5.json` / `sentences_hsk6.json` are added (see `scripts/gen-sentences.mjs`).
 * Rows load from `src/data/sentences_hsk*.json` via {@link preloadSentenceData} at app startup.
 * Sentence mode filters rows at runtime to cumulative HSK 1…N headwords (`filterRowsByHskVocabulary`).
 */

/** @typedef {{ simplified: string, pinyin: string, english: string }} HskWord */

/** @typedef {{ simplified: string, pinyin: string, english: string[] }} CedictEntry */

function normalizeWord(raw) {
  const simplified = String(raw?.simplified ?? '').trim()
  const pinyin = String(raw?.pinyin ?? '').trim()
  const english = String(raw?.english ?? '').trim()
  return simplified && pinyin ? { simplified, pinyin, english } : null
}

function pickRandomWord(words, excludeSimp, avoidTonelessPinyins) {
  const avoid =
    avoidTonelessPinyins && avoidTonelessPinyins.length
      ? new Set(avoidTonelessPinyins.filter(Boolean))
      : null
  let list = words.filter((w) => w.simplified !== excludeSimp)
  if (avoid && avoid.size > 0) {
    const filtered = list.filter((w) => !avoid.has(fullTonelessPinyin(w.pinyin)))
    if (filtered.length > 0) list = filtered
  }
  const pool = list.length ? list : words.filter((w) => w.simplified !== excludeSimp)
  const pool2 = pool.length ? pool : words
  const idx = Math.floor(Math.random() * pool2.length)
  return pool2[idx]
}

const TIMER_OPTIONS = [
  { id: 60, label: '60s' },
  { id: 120, label: '120s' },
  { id: 0, label: '∞' },
]

/** Pause timer while skip-reveal is shown; easy to tune. */
const SKIP_REVEAL_DURATION = 2000
const SKIP_REVEAL_EXIT_MS = 300

/** @param {number} level 1–6 */
function getHskWordMeta(level, simplified) {
  const arr = HSK_DATA[level - 1] ?? []
  const simp = String(simplified ?? '').trim()
  for (const raw of arr) {
    const s = String(raw?.simplified ?? '').trim()
    if (s === simp) {
      return {
        simplified: s,
        pinyin: String(raw?.pinyin ?? '').trim(),
        meaning: String(raw?.english ?? '').trim(),
      }
    }
  }
  return { simplified: simp, pinyin: '', meaning: '' }
}

/** Pinyin + meaning from the HSK list when available; for HSK 1 always prefer that row (+ overrides). Otherwise CC-CEDICT when it matches. */
function getLearnMetaFromCedictOrHsk(level, simplified) {
  const hsk = getHskWordMeta(level, simplified)
  if (level === 1) {
    if (hsk.pinyin || hsk.meaning) {
      return {
        simplified: hsk.simplified,
        pinyin: resolveTypeHskDisplayPinyin(hsk.simplified, hsk.pinyin),
        meaning: resolveTypeHskMeaningPlain(hsk.simplified, hsk.meaning),
      }
    }
    const ce = pickCedictEntryForWord(simplified, '')
    if (ce) {
      return {
        simplified: ce.simplified,
        pinyin: ce.pinyin,
        meaning: ce.english.join(' / '),
      }
    }
    return {
      simplified: hsk.simplified,
      pinyin: resolveTypeHskDisplayPinyin(hsk.simplified, hsk.pinyin),
      meaning: resolveTypeHskMeaningPlain(hsk.simplified, hsk.meaning),
    }
  }
  const ce = pickCedictEntryForWord(simplified, hsk.pinyin)
  if (ce) {
    return {
      simplified: ce.simplified,
      pinyin: ce.pinyin,
      meaning: ce.english.join(' / '),
    }
  }
  return { simplified: hsk.simplified, pinyin: hsk.pinyin, meaning: hsk.meaning }
}

function IconArrowRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.75"
      stroke="currentColor"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 8l6 4-6 4" />
    </svg>
  )
}

/** @typedef {{ kind: 'han'; expect: string; py: string; state: 'untyped' | 'correct' | 'wrong'; wrongGlyph?: string }} SentHanCell */
/** @typedef {{ kind: 'punct'; ch: string }} SentPunctCell */
/** @typedef {SentHanCell | SentPunctCell} SentCell */
/** @typedef {{ id: string; chinese: string; english: string; cells: SentCell[] }} SentLine */

function parseSentenceRow(/** @type {any} */ row) {
  const chinese = String(row?.chinese ?? '')
  const english = String(row?.english ?? '')
  const pys = String(row?.py ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
  let pi = 0
  /** @type {SentCell[]} */
  const cells = []
  for (const ch of chinese) {
    if (/[\u4e00-\u9fff]/u.test(ch)) {
      const py = pys[pi] ?? ''
      pi += 1
      cells.push({ kind: 'han', expect: ch, py, state: 'untyped' })
    } else if (ch.trim()) {
      cells.push({ kind: 'punct', ch })
    }
  }
  return { chinese, english, cells }
}

function buildSentLine(/** @type {any} */ row, /** @type {() => string} */ idFn) {
  const { chinese, english, cells } = parseSentenceRow(row)
  return { id: idFn(), chinese, english, cells }
}

/** First Han on the sentence row the user is typing that is not yet correct (`untyped` or `wrong`). */
function findActiveSentenceCell(/** @type {SentLine[]} */ lines) {
  const line0 = lines[0]
  if (!line0) return null
  for (let i = 0; i < line0.cells.length; i += 1) {
    const c = line0.cells[i]
    if (c.kind === 'han' && c.state !== 'correct') {
      return { lineIndex: 0, cellIndex: i, cell: c }
    }
  }
  return null
}

/**
 * Row used for sentence IME context and lookahead. Uses `active.lineIndex` when in range.
 * Invariant today: `findActiveSentenceCell` only scans `lines[0]`, so `lineIndex` is always `0`
 * (other `sentLines` slots are previews until the current line finishes and the deck rotates).
 * If typing is ever allowed on another row, extend `findActiveSentenceCell` and pick handlers together.
 */
function getSentenceLineForTypingIme(/** @type {SentLine[]} */ lines, /** @type {{ lineIndex: number } | null | undefined} */ active) {
  if (!lines?.length) return undefined
  const li = active?.lineIndex
  if (typeof li === 'number' && Number.isFinite(li) && li >= 0 && li < lines.length && lines[li]) return lines[li]
  return lines[0]
}

function lineAllHanCorrect(/** @type {SentLine | undefined} */ line) {
  if (!line) return false
  return line.cells.every((c) => c.kind === 'punct' || (c.kind === 'han' && c.state === 'correct'))
}

/** Max Han run length used for sentence IME lookahead (multi-syllable words). */
const MAX_SENT_LOOKAHEAD = 4

/**
 * Build composite Han + joined syllables from `startCellIdx` for sentence IME.
 * Normally stops at the first already-correct Han (anti-spoiler for what follows).
 * When `startCellIdx` itself is correct (IME back-extended over a finished prefix), include those
 * correct syllables then continue through the active untyped run (e.g. 音 + 乐 → 音乐).
 */
function getSentenceLookaheadTarget(/** @type {SentLine | undefined} */ line0, /** @type {number} */ startCellIdx) {
  if (!line0) return null
  const cells = line0.cells
  const first = cells[startCellIdx]
  if (!first || first.kind !== 'han') return null
  if (first.state === 'wrong') {
    return { simplified: first.expect, pinyin: first.py }
  }
  const allowLeadingCorrect = first.state === 'correct'
  let simp = ''
  const syllables = []
  for (let i = startCellIdx; i < cells.length && simp.length < MAX_SENT_LOOKAHEAD; i += 1) {
    const c = cells[i]
    if (c.kind === 'punct') break
    if (c.kind !== 'han') break
    if (c.state === 'wrong') {
      if (!simp) return { simplified: c.expect, pinyin: c.py }
      break
    }
    if (c.state === 'correct') {
      if (allowLeadingCorrect) {
        simp += c.expect
        syllables.push(c.py)
      } else {
        break
      }
      continue
    }
    simp += c.expect
    syllables.push(c.py)
  }
  if (!simp) return null
  return { simplified: simp, pinyin: syllables.join(' ') }
}

/** First Han cell index for IME lookahead: include leading Han already marked correct (e.g. 音 + 乐 → 音乐). */
function getSentenceImeLookaheadStartCell(/** @type {SentLine | undefined} */ line0, /** @type {number} */ fromCellIdx) {
  if (!line0) return fromCellIdx
  let start = fromCellIdx
  while (start > 0) {
    const prev = line0.cells[start - 1]
    if (prev?.kind !== 'han' || prev.state !== 'correct') break
    start -= 1
  }
  return start
}

/**
 * If `picked` equals the expected Han substring from some `start`..`start+len` where `fromCell` lies,
 * and every Han before `fromCell` in that span is already correct, return exclusive end index.
 * Allows choosing 音乐 when the cursor is on 乐 and 音 is already correct.
 */
function sentencePickSpansAhead(
  /** @type {SentLine} */ line,
  /** @type {number} */ fromCell,
  /** @type {string} */ picked,
) {
  const exp = String(picked ?? '').trim()
  if (!exp) return null
  const need = exp.length
  for (let start = fromCell; start >= 0 && fromCell - start < need; start -= 1) {
    const end = start + need
    if (end > line.cells.length) continue
    let ok = true
    for (let k = 0; k < need; k += 1) {
      const i = start + k
      const c = line.cells[i]
      if (c.kind !== 'han' || c.expect !== exp[k]) {
        ok = false
        break
      }
      if (i < fromCell) {
        if (c.state !== 'correct') {
          ok = false
          break
        }
      } else if (i === fromCell) {
        if (c.state === 'correct') {
          ok = false
          break
        }
      } else if (c.state !== 'untyped') {
        ok = false
        break
      }
    }
    if (ok) return end
  }
  return null
}

export default function TypeTab() {
  const [screen, setScreen] = useState('play')
  const [hskLevel, setHskLevel] = useState(1)
  const [timerSeconds, setTimerSeconds] = useState(60)
  const [secondsLeft, setSecondsLeft] = useState(60)
  /** Counts only after Space; gates countdown and input. */
  const [roundStarted, setRoundStarted] = useState(false)
  /** For unlimited mode only — used for CPM, not shown in the header. */
  const [practiceSeconds, setPracticeSeconds] = useState(0)

  const [imeInput, setImeInput] = useState('')
  const [candidatesExpanded, setCandidatesExpanded] = useState(false)
  const [indexReady, setIndexReady] = useState(false)

  const [charsCompleted, setCharsCompleted] = useState(0)
  const [correctFirstPicks, setCorrectFirstPicks] = useState(0)
  const [totalSelectionAttempts, setTotalSelectionAttempts] = useState(0)
  const [wrongThisWord, setWrongThisWord] = useState(0)

  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  const [currentWord, setCurrentWord] = useState(/** @type {HskWord | null} */ (null))

  const [wrongEntries, setWrongEntries] = useState(
    /** @type {{ simplified: string, picked: string }[]} */ ([]),
  )

  const [flash, setFlash] = useState(/** @type {'none' | 'correct' | 'wrong'} */ ('none'))
  /** Monkeytype-style: Tab opens restart prompt; Enter confirms, Esc cancels. */
  const [showRestartPrompt, setShowRestartPrompt] = useState(false)

  /** While Tab overlay is open: skip shows answer here (blurred play area unchanged) before advancing. */
  const [skipReveal, setSkipReveal] = useState(
    /** @type {null | { simplified: string; pinyinMarked: string; english: string; mode: 'characters' | 'sentences' }} */ (
      null
    ),
  )
  const [skipRevealExiting, setSkipRevealExiting] = useState(false)
  /** Fades next word in after skip-reveal exit (characters + sentences). */
  const [wordEntryOpacity, setWordEntryOpacity] = useState(true)

  /** Results screen: after saving wrong picks */
  const [wrongSaveFlash, setWrongSaveFlash] = useState(false)
  const [wrongSaveDone, setWrongSaveDone] = useState(false)

  const [typeMode, setTypeMode] = useState(/** @type {'characters' | 'sentences'} */ ('characters'))
  const sentLineIdRef = useRef(0)
  const typeRoundStartTrackedRef = useRef(false)
  const typeResultsTrackedRef = useRef(false)
  /** @type {import('react').MutableRefObject<{ pool: unknown[], order: number[], pointer: number, usedIndices: Set<number> }>} */
  const sentSessionDeckRef = useRef({
    pool: [],
    order: [],
    pointer: 0,
    usedIndices: new Set(),
  })
  const [sentLines, setSentLines] = useState(/** @type {SentLine[]} */ ([]))
  const [sentCharsCorrect, setSentCharsCorrect] = useState(0)
  const [sentCharsWrong, setSentCharsWrong] = useState(0)
  const [sentPickTotal, setSentPickTotal] = useState(0)
  const [sentPickGood, setSentPickGood] = useState(0)
  const [sentStreakVal, setSentStreakVal] = useState(0)
  const [sentLinesCompleted, setSentLinesCompleted] = useState(0)
  const [sentCursorLeft, setSentCursorLeft] = useState(/** @type {number | null} */ (null))
  const [showSessionResults, setShowSessionResults] = useState(false)
  const [isNewBest, setIsNewBest] = useState(false)
  const scoreBadgeRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const sentenceContainerRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const handleSentenceSessionEndRef = useRef(/** @type {() => Promise<void>} */ (async () => {}))

  const { personalBest, submitScore } = usePersonalBest(hskLevel)
  const { userRank, refresh: refreshLeaderboard } = useLeaderboard(hskLevel)
  const {
    score: typeScore,
    multiplier: typeMultiplier,
    sessionBestStreak,
    orbEvents,
    orbArrivalCount,
    emitXPOrb,
    dissolveOrbs,
    updateSessionBest,
    reset: resetScoreSystem,
  } = useScoreSystem(sentStreakVal)
  /**
   * Sentences mode: last `line0.cells` index that is a locked (gold) Han — same as end of the correct prefix.
   * `-1` means nothing confirmed yet. Backspace never removes Hans at or before this index.
   */
  const [committedPos, setCommittedPos] = useState(-1)

  const pausedRef = useRef(false)
  const currentWordRef = useRef(/** @type {HskWord | null} */ (null))
  const wrongThisWordRef = useRef(0)
  const candidatesRef = useRef(/** @type {CedictEntry[]} */ ([]))
  const candidatesExpandedRef = useRef(false)
  const [pinyinIndex, setPinyinIndex] = useState(/** @type {Map<string, Map<string, CedictEntry>> | null} */ (null))
  const roundStartedRef = useRef(false)
  const showRestartPromptRef = useRef(false)
  const skipRevealRef = useRef(
    /** @type {null | { simplified: string; pinyinMarked: string; english: string; mode: 'characters' | 'sentences' }} */ (
      null
    ),
  )
  const playSurfaceRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const wrongSaveTimeoutRef = useRef(0)
  const typeModeRef = useRef(/** @type {'characters' | 'sentences'} */ ('characters'))
  const sentLinesRef = useRef(/** @type {SentLine[]} */ ([]))
  const imeInputRef = useRef('')
  const committedPosRef = useRef(-1)
  const sentLine0RowRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const skipRevealTimerRef = useRef(0)
  const skipRevealExitTimerRef = useRef(0)
  /** True while skip-reveal timers are active (before skipReveal state commits). */
  const skipRevealInFlightRef = useRef(false)
  /** Last one or two prompt words (HSK toneless pinyin) to reduce back-to-back repeats (e.g. many 红 in a row). */
  const recentPromptTonelessRef = useRef(/** @type {string[]} */ ([]))

  useEffect(() => {
    currentWordRef.current = currentWord
  }, [currentWord])

  useEffect(() => {
    wrongThisWordRef.current = wrongThisWord
  }, [wrongThisWord])

  useEffect(() => {
    candidatesExpandedRef.current = candidatesExpanded
  }, [candidatesExpanded])

  useEffect(() => {
    roundStartedRef.current = roundStarted
  }, [roundStarted])

  useEffect(() => {
    showRestartPromptRef.current = showRestartPrompt
  }, [showRestartPrompt])

  useEffect(() => {
    skipRevealRef.current = skipReveal
  }, [skipReveal])

  useEffect(() => {
    typeModeRef.current = typeMode
  }, [typeMode])

  useEffect(() => {
    sentLinesRef.current = sentLines
  }, [sentLines])

  useEffect(() => {
    imeInputRef.current = imeInput
  }, [imeInput])

  useEffect(() => {
    queueMicrotask(() => {
      if (screen !== 'results') {
        setWrongSaveFlash(false)
        setWrongSaveDone(false)
        window.clearTimeout(wrongSaveTimeoutRef.current)
        wrongSaveTimeoutRef.current = 0
      }
    })
  }, [screen])

  useEffect(
    () => () => {
      window.clearTimeout(wrongSaveTimeoutRef.current)
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    const id = window.setTimeout(() => {
      preloadPinyinImeData()
        .then(() => {
          if (cancelled) return
          console.time('buildPinyinIndex')
          const idx = buildPinyinPrefixIndex()
          console.timeEnd('buildPinyinIndex')
          queueMicrotask(() => {
            if (cancelled) return
            setPinyinIndex(idx)
            setIndexReady(true)
          })
        })
        .catch((err) => {
          console.error('Failed to load pinyin dictionary', err)
          if (cancelled) return
          queueMicrotask(() => {
            if (cancelled) return
            setPinyinIndex(new Map())
            setIndexReady(true)
          })
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [])

  const words = useMemo(() => {
    const arr = HSK_DATA[hskLevel - 1] ?? []
    return arr
      .filter((raw) => !isExcludedFromHskTypingPool(raw?.simplified))
      .map(normalizeWord)
      .filter(Boolean)
  }, [hskLevel, indexReady])

  const queryNorm = useMemo(() => normalizeQuery(imeInput), [imeInput])

  const sentActive = useMemo(() => findActiveSentenceCell(sentLines), [sentLines])
  const sentTargetWord = useMemo(() => {
    if (typeMode !== 'sentences') return null
    if (!sentActive || sentActive.cell.kind !== 'han') return null
    const line = getSentenceLineForTypingIme(sentLines, sentActive)
    if (!line) return null
    const imeStart = getSentenceImeLookaheadStartCell(line, sentActive.cellIndex)
    const span = getSentenceLookaheadTarget(line, imeStart)
    if (!span) return null
    return {
      simplified: span.simplified,
      pinyin: span.pinyin,
      english: line.english ?? '',
    }
  }, [typeMode, sentActive, sentLines])

  useLayoutEffect(() => {
    if (typeMode !== 'sentences') {
      queueMicrotask(() => setSentCursorLeft(null))
      return
    }
    const row = sentLine0RowRef.current
    if (!row) {
      queueMicrotask(() => setSentCursorLeft(null))
      return
    }
    const anchor = row.querySelector('[data-sent-cursor-active="1"]')
    if (!anchor) {
      queueMicrotask(() => setSentCursorLeft(null))
      return
    }
    const rowRect = row.getBoundingClientRect()
    const aRect = anchor.getBoundingClientRect()
    queueMicrotask(() => setSentCursorLeft(aRect.left - rowRect.left - 3))
  }, [typeMode, sentLines, sentActive, imeInput, roundStarted, showRestartPrompt])

  const candidates = useMemo(() => {
    if (!indexReady || !pinyinIndex) return []
    if (typeMode === 'sentences') {
      const t = sentTargetWord
      if (!t) return []
      const global = lookupFromIndex(pinyinIndex, queryNorm, t.simplified, t.pinyin, t.english, hskLevel)
      const line = getSentenceLineForTypingIme(sentLines, sentActive)
      if (!line || !sentActive) return global
      return mergeSentenceContextCandidates(line, sentActive, queryNorm, global)
    }
    if (!currentWord) return []
    return lookupFromIndex(
      pinyinIndex,
      queryNorm,
      currentWord.simplified,
      currentWord.pinyin,
      currentWord.english,
    )
  }, [typeMode, queryNorm, currentWord, indexReady, sentTargetWord, sentLines, sentActive, pinyinIndex, hskLevel])

  useEffect(() => {
    candidatesRef.current = candidates
  }, [candidates])

  const visibleLimit = candidatesExpanded ? Math.min(9, candidates.length) : Math.min(4, candidates.length)
  const visibleCandidates = candidates.slice(0, visibleLimit)
  const canExpandCandidates = candidates.length > 4

  const loadWord = useCallback(
    (excludeSimp) => {
      const avoid = [...recentPromptTonelessRef.current]
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const raw = pickRandomWord(words, excludeSimp, avoid)
        if (!raw) return
        const rawToneless = fullTonelessPinyin(raw.pinyin)
        if (hskLevel === 1) {
          setCurrentWord({
            simplified: raw.simplified,
            pinyin: resolveTypeHskDisplayPinyin(raw.simplified, raw.pinyin),
            english: raw.english,
          })
          setImeInput('')
          setCandidatesExpanded(false)
          setWrongThisWord(0)
          wrongThisWordRef.current = 0
          setFlash('none')
          recentPromptTonelessRef.current = [rawToneless, avoid[0]].filter(Boolean).slice(0, 2)
          return
        }
        const hskHint = getHskWordMeta(hskLevel, raw.simplified)
        const cedictEntry = pickCedictEntryForWord(raw.simplified, raw.pinyin || hskHint.pinyin)
        const w = cedictEntry
          ? {
              simplified: cedictEntry.simplified,
              pinyin: cedictEntry.pinyin,
              english: cedictEntry.english.join(' / '),
            }
          : { simplified: raw.simplified, pinyin: raw.pinyin, english: raw.english }
        setCurrentWord(w)
        setImeInput('')
        setCandidatesExpanded(false)
        setWrongThisWord(0)
        wrongThisWordRef.current = 0
        setFlash('none')
        recentPromptTonelessRef.current = [rawToneless, avoid[0]].filter(Boolean).slice(0, 2)
        return
      }
    },
    [words, hskLevel],
  )

  const takeNextSentenceRow = useCallback(() => {
    const row = takeFromSentenceSessionDeck(sentSessionDeckRef.current)
    if (!row) return null
    markSentenceSeen(row)
    return row
  }, [])

  const refillSentenceLines = useCallback(() => {
    const raw = SENT_ROWS_BY_LEVEL[hskLevel - 1] ?? []
    const filtered = filterRowsByHskVocabulary(raw, hskLevel, HSK_DATA)
    const pool =
      filtered.length > 0 ? filtered : raw.filter((x) => x && String(x?.chinese ?? '').trim())
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      const pct = raw.length ? Math.round((pool.length / raw.length) * 100) : 0
      console.log('%c[Sentences] Session pool', 'color: #D4A843; font-weight: bold', {
        hskLevel,
        rawInFile: raw.length,
        afterHskFilter: filtered.length,
        playing: pool.length,
        filterCoverage: `${pct}%`,
        fallbackToUnfiltered: filtered.length === 0 && raw.length > 0,
      })
    }
    sentSessionDeckRef.current = createSentenceSessionDeck(pool, Date.now())
    const nextLine = () => {
      const row = takeNextSentenceRow()
      if (!row) return null
      return buildSentLine(row, () => `sl-${(sentLineIdRef.current += 1)}`)
    }
    const lines = [nextLine(), nextLine(), nextLine(), nextLine()].filter(Boolean)
    setSentLines(lines)
    setImeInput('')
    setCandidatesExpanded(false)
    committedPosRef.current = -1
    setCommittedPos(-1)
    setSentCharsCorrect(0)
    setSentCharsWrong(0)
    setSentPickTotal(0)
    setSentPickGood(0)
    setSentStreakVal(0)
    setSentLinesCompleted(0)
    resetScoreSystem()
    setShowSessionResults(false)
    setIsNewBest(false)
  }, [hskLevel, takeNextSentenceRow, resetScoreSystem])

  useEffect(() => {
    queueMicrotask(() => {
      recentPromptTonelessRef.current = []
      setWrongEntries([])
      setWordsCompleted(0)
      setStreak(0)
      setBestStreak(0)
      setCharsCompleted(0)
      setCorrectFirstPicks(0)
      setTotalSelectionAttempts(0)
      setRoundStarted(false)
      setShowRestartPrompt(false)
      if (skipRevealTimerRef.current) window.clearTimeout(skipRevealTimerRef.current)
      if (skipRevealExitTimerRef.current) window.clearTimeout(skipRevealExitTimerRef.current)
      skipRevealTimerRef.current = 0
      skipRevealExitTimerRef.current = 0
      skipRevealInFlightRef.current = false
      setSkipReveal(null)
      setSkipRevealExiting(false)
      setWordEntryOpacity(true)
      setPracticeSeconds(0)
      setSecondsLeft(timerSeconds === 0 ? 0 : timerSeconds)
      if (typeMode === 'sentences') {
        refillSentenceLines()
      } else {
        loadWord(null)
      }
    })
  }, [hskLevel, loadWord, timerSeconds, typeMode, refillSentenceLines])

  useEffect(() => {
    queueMicrotask(() => setCandidatesExpanded(false))
  }, [imeInput, currentWord, typeMode, sentLines])

  useEffect(() => {
    if (screen !== 'play' || !roundStarted || showRestartPrompt || skipReveal) return
    if (timerSeconds === 0) {
      const id = window.setInterval(() => {
        setPracticeSeconds((t) => t + 1)
      }, 1000)
      return () => window.clearInterval(id)
    }
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [screen, timerSeconds, hskLevel, roundStarted, showRestartPrompt, skipReveal, typeMode])

  useEffect(
    () => () => {
      if (skipRevealTimerRef.current) window.clearTimeout(skipRevealTimerRef.current)
      if (skipRevealExitTimerRef.current) window.clearTimeout(skipRevealExitTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (screen !== 'play' || timerSeconds === 0) return
    if (secondsLeft === 0) {
      if (typeModeRef.current === 'sentences') {
        queueMicrotask(() => void handleSentenceSessionEndRef.current())
      } else {
        queueMicrotask(() => setScreen('results'))
      }
    }
  }, [secondsLeft, screen, timerSeconds])

  const completeWord = useCallback(() => {
    pausedRef.current = true
    const n = currentWordRef.current?.simplified.length ?? 0
    if (n > 0) void recordStudyActivity({ typedCharacters: n, activeTab: 'type' })
    setWordsCompleted((c) => c + 1)
    setCharsCompleted((c) => c + n)
    setStreak((s) => {
      const n = s + 1
      setBestStreak((b) => Math.max(b, n))
      return n
    })
    setFlash('correct')
    window.setTimeout(() => {
      setFlash('none')
      loadWord(currentWordRef.current?.simplified ?? null)
      pausedRef.current = false
    }, 400)
  }, [loadWord])

  const completeWordRef = useRef(completeWord)
  useEffect(() => {
    completeWordRef.current = completeWord
  }, [completeWord])

  const restartTest = useCallback(() => {
    pausedRef.current = false
    if (skipRevealTimerRef.current) window.clearTimeout(skipRevealTimerRef.current)
    if (skipRevealExitTimerRef.current) window.clearTimeout(skipRevealExitTimerRef.current)
    skipRevealTimerRef.current = 0
    skipRevealExitTimerRef.current = 0
    skipRevealInFlightRef.current = false
    setSkipReveal(null)
    setSkipRevealExiting(false)
    setWordEntryOpacity(true)
    setShowRestartPrompt(false)
    setImeInput('')
    setCandidatesExpanded(false)
    setWrongThisWord(0)
    wrongThisWordRef.current = 0
    setFlash('none')
    setWrongEntries([])
    setWordsCompleted(0)
    setStreak(0)
    setBestStreak(0)
    setCharsCompleted(0)
    setCorrectFirstPicks(0)
    setTotalSelectionAttempts(0)
    setPracticeSeconds(0)
    setSecondsLeft(timerSeconds === 0 ? 0 : timerSeconds)
    setRoundStarted(true)
    if (typeModeRef.current === 'sentences') {
      refillSentenceLines()
    } else {
      loadWord(null)
    }
    resetScoreSystem()
    setShowSessionResults(false)
    setIsNewBest(false)
    requestAnimationFrame(() => {
      playSurfaceRef.current?.focus()
    })
  }, [loadWord, timerSeconds, refillSentenceLines, resetScoreSystem])

  /** From restart overlay: next word only — timer & session stats unchanged; streak cleared. */
  const skipWordFromPrompt = useCallback(() => {
    if (skipRevealRef.current || skipRevealInFlightRef.current) return

    if (skipRevealTimerRef.current) window.clearTimeout(skipRevealTimerRef.current)
    if (skipRevealExitTimerRef.current) window.clearTimeout(skipRevealExitTimerRef.current)
    skipRevealTimerRef.current = 0
    skipRevealExitTimerRef.current = 0

    setStreak(0)
    setImeInput('')
    setCandidatesExpanded(false)
    setWrongThisWord(0)
    wrongThisWordRef.current = 0
    setFlash('none')

    pausedRef.current = true

    /** @type {null | { simplified: string; pinyinMarked: string; english: string; mode: 'characters' | 'sentences' }} */
    let reveal = null
    const excludedForLoad =
      typeModeRef.current === 'characters' ? (currentWordRef.current?.simplified ?? null) : null

    if (typeModeRef.current === 'sentences') {
      const l0 = sentLinesRef.current[0]
      if (l0) {
        const digitPy = l0.cells
          .filter((c) => c.kind === 'han')
          .map((c) => c.py)
          .join(' ')
        reveal = {
          mode: 'sentences',
          simplified: l0.chinese,
          pinyinMarked: pinyinForDisplay(digitPy),
          english: formatEnglishMeaningForDisplay('', l0.english),
        }
      }
    } else {
      const w = currentWordRef.current
      if (w) {
        const meta = getLearnMetaFromCedictOrHsk(hskLevel, w.simplified)
        if (w.simplified) {
          saveLearnedCharacter({ ...meta, hskLevel })
        }
        reveal = {
          mode: 'characters',
          simplified: w.simplified,
          pinyinMarked: pinyinForDisplay(meta.pinyin),
          english:
            hskLevel === 1
              ? resolveTypeHskDisplayEnglish(w.simplified, w.english)
              : formatEnglishMeaningForDisplay(w.simplified, w.english),
        }
      }
    }

    const runAdvance = () => {
      if (typeModeRef.current === 'sentences') {
        const row = takeNextSentenceRow()
        if (row) {
          const newFirst = buildSentLine(row, () => `sl-${(sentLineIdRef.current += 1)}`)
          committedPosRef.current = -1
          setCommittedPos(-1)
          setSentLines((prev) => [newFirst, prev[1], prev[2], prev[3]].filter(Boolean))
        }
      } else {
        loadWord(excludedForLoad)
      }
    }

    const finishAfterReveal = () => {
      skipRevealInFlightRef.current = false
      setShowRestartPrompt(false)
      setSkipReveal(null)
      setSkipRevealExiting(false)
      setWordEntryOpacity(false)
      runAdvance()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWordEntryOpacity(true)
          pausedRef.current = false
          playSurfaceRef.current?.focus()
        })
      })
    }

    if (!reveal) {
      skipRevealInFlightRef.current = false
      setShowRestartPrompt(false)
      setSkipReveal(null)
      setSkipRevealExiting(false)
      setWordEntryOpacity(false)
      runAdvance()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWordEntryOpacity(true)
          pausedRef.current = false
          playSurfaceRef.current?.focus()
        })
      })
      return
    }

    skipRevealInFlightRef.current = true
    setSkipRevealExiting(false)
    setSkipReveal(reveal)

    skipRevealTimerRef.current = window.setTimeout(() => {
      setSkipRevealExiting(true)
      skipRevealExitTimerRef.current = window.setTimeout(() => {
        finishAfterReveal()
        skipRevealExitTimerRef.current = 0
      }, SKIP_REVEAL_EXIT_MS)
      skipRevealTimerRef.current = 0
    }, SKIP_REVEAL_DURATION)
  }, [loadWord, hskLevel, takeNextSentenceRow])

  const advanceSentenceQueue = useCallback(() => {
    committedPosRef.current = -1
    setCommittedPos(-1)
    setSentLines((p2) => {
      if (!sentSessionDeckRef.current.pool.length || p2.length < 2) return p2.slice(1)
      const row = takeNextSentenceRow()
      if (!row) return p2.slice(1)
      const cL = buildSentLine(row, () => `sl-${(sentLineIdRef.current += 1)}`)
      const next = [...p2.slice(1), cL].filter(Boolean)
      while (next.length < 4) {
        const extra = takeNextSentenceRow()
        if (!extra) break
        next.push(buildSentLine(extra, () => `sl-${(sentLineIdRef.current += 1)}`))
      }
      return next
    })
    setSentLinesCompleted((n) => n + 1)
  }, [takeNextSentenceRow])

  const handleSentencePick = useCallback((/** @type {CedictEntry} */ entry) => {
    const active = findActiveSentenceCell(sentLinesRef.current)
    if (!active || active.cell.kind !== 'han') return
    const { cellIndex } = active
    const line0 = sentLinesRef.current[0]
    if (!line0) return

    const endExclusive = sentencePickSpansAhead(line0, cellIndex, entry.simplified)
    const ok = endExclusive !== null

    setSentPickTotal((t) => t + 1)
    if (ok) {
      const len = endExclusive - cellIndex
      if (len > 0) void recordStudyActivity({ typedCharacters: len, activeTab: 'type' })
      setSentPickGood((g) => g + 1)
      setSentStreakVal((s) => s + len)
      setSentCharsCorrect((c) => c + len)
      setImeInput('')
      {
        const last = endExclusive - 1
        committedPosRef.current = Math.max(committedPosRef.current, last)
        setCommittedPos(committedPosRef.current)
      }
      setSentLines((prev) => {
        const l0 = prev[0]
        if (!l0) return prev
        const cells = l0.cells.map((c, i) => {
          if (i >= cellIndex && i < endExclusive && c.kind === 'han') {
            return { kind: 'han', expect: c.expect, py: c.py, state: 'correct' }
          }
          return c
        })
        const next0 = { ...l0, cells }
        return [next0, prev[1], prev[2], prev[3]].filter(Boolean)
      })
      window.setTimeout(() => {
        const l0 = sentLinesRef.current[0]
        if (!l0 || !lineAllHanCorrect(l0)) return
        advanceSentenceQueue()
      }, 280)
      return
    }

    setSentCharsWrong((w) => w + 1)
    setSentStreakVal(0)
    setImeInput('')
    setSentLines((prev) => {
      const l0 = prev[0]
      if (!l0) return prev
      const cells = l0.cells.map((c, i) => {
        if (i !== cellIndex || c.kind !== 'han') return c
        return {
          kind: 'han',
          expect: c.expect,
          py: c.py,
          state: 'wrong',
          wrongGlyph: entry.simplified,
        }
      })
      return [{ ...l0, cells }, prev[1], prev[2], prev[3]].filter(Boolean)
    })
    setFlash('wrong')
    window.setTimeout(() => setFlash('none'), 220)
  }, [advanceSentenceQueue])

  const handleSentenceStreamCharConfirmed = useCallback(
    (fromX, fromY) => {
      setSentCharsCorrect((c) => c + 1)
      setSentPickGood((g) => g + 1)
      setSentPickTotal((t) => t + 1)
      setSentStreakVal((s) => {
        const next = s + 1
        updateSessionBest(next)
        emitXPOrb(fromX, fromY, next)
        return next
      })
    },
    [emitXPOrb, updateSessionBest],
  )

  const handleSentenceStreamCharError = useCallback(() => {
    dissolveOrbs()
    setSentCharsWrong((w) => w + 1)
    setSentPickTotal((t) => t + 1)
    setSentStreakVal(0)
  }, [dissolveOrbs])

  const handleSentenceStreamComplete = useCallback(() => {
    const l0 = sentLinesRef.current[0]
    const hanCount = l0?.cells.filter((c) => c.kind === 'han').length ?? 0
    if (hanCount > 0) void recordStudyActivity({ typedCharacters: hanCount, activeTab: 'type' })
    advanceSentenceQueue()
  }, [advanceSentenceQueue])

  const revertLastSentenceHan = useCallback(() => {
    const line0 = sentLinesRef.current[0]
    if (!line0) return
    const lockedThrough = committedPosRef.current
    for (let i = line0.cells.length - 1; i >= 0; i -= 1) {
      const c = line0.cells[i]
      if (c.kind !== 'han' || c.state !== 'wrong') continue
      if (i <= lockedThrough) return
      setSentLines((prev) => {
        const l0 = prev[0]
        if (!l0) return prev
        const cells = l0.cells.map((x, j) =>
          j === i && x.kind === 'han' && x.state === 'wrong'
            ? { kind: 'han', expect: x.expect, py: x.py, state: 'untyped' }
            : x,
        )
        return [{ ...l0, cells }, prev[1], prev[2], prev[3]].filter(Boolean)
      })
      setSentPickTotal((n) => Math.max(0, n - 1))
      setSentCharsWrong((n) => Math.max(0, n - 1))
      setSentStreakVal(0)
      return
    }
  }, [])

  const trySelectSlot = useCallback((slotOnPage) => {
    if (pausedRef.current) return
    if (showRestartPromptRef.current) return
    if (skipRevealRef.current || skipRevealInFlightRef.current) return
    if (!roundStartedRef.current) return
    const list = candidatesRef.current
    const maxSlot = candidatesExpandedRef.current
      ? Math.min(8, list.length - 1)
      : Math.min(3, list.length - 1)
    if (slotOnPage < 0 || slotOnPage > maxSlot) return
    const entry = list[slotOnPage]
    if (!entry) return

    if (typeModeRef.current === 'sentences') {
      handleSentencePick(entry)
      return
    }

    setTotalSelectionAttempts((t) => t + 1)

    const target = currentWordRef.current
    if (!target) return

    const ok = entry.simplified === target.simplified
    if (ok) {
      if (wrongThisWordRef.current === 0) {
        setCorrectFirstPicks((c) => c + 1)
      }
      setWrongThisWord(0)
      wrongThisWordRef.current = 0
      setImeInput('')
      completeWordRef.current()
      return
    }

    setWrongThisWord((w) => {
      const next = w + 1
      wrongThisWordRef.current = next
      return next
    })
    setStreak(0)
    setWrongEntries((list) => {
      const rest = list.filter((x) => x.simplified !== target.simplified)
      return [...rest, { simplified: target.simplified, picked: entry.simplified }]
    })
    setFlash('wrong')
    window.setTimeout(() => setFlash('none'), 280)
    setImeInput('')
  }, [handleSentencePick])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (screen !== 'play') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { key, code } = e

      if (showRestartPromptRef.current) {
        if (skipRevealRef.current || skipRevealInFlightRef.current) {
          if (key === 'Tab') {
            e.preventDefault()
            return
          }
          if (key === 'Enter' || key === ' ' || code === 'Space' || key === 'Escape') {
            e.preventDefault()
            return
          }
          return
        }
        if (key === 'Tab') {
          e.preventDefault()
          return
        }
        if (key === 'Enter') {
          e.preventDefault()
          restartTest()
          return
        }
        if (key === ' ' || code === 'Space') {
          e.preventDefault()
          skipWordFromPrompt()
          return
        }
        if (key === 'Escape') {
          e.preventDefault()
          setShowRestartPrompt(false)
          requestAnimationFrame(() => playSurfaceRef.current?.focus())
          return
        }
        return
      }

      if (key === 'Tab' && roundStartedRef.current) {
        e.preventDefault()
        setShowRestartPrompt(true)
        return
      }

      if (pausedRef.current) return

      if (!roundStartedRef.current) {
        if (key === ' ') {
          e.preventDefault()
          setRoundStarted(true)
        }
        return
      }

      if (typeModeRef.current === 'sentences' && roundStartedRef.current) {
        if (
          key === 'Backspace' ||
          (key.length === 1 && /^[a-z]$/i.test(key)) ||
          key === ' ' ||
          code === 'Space'
        ) {
          return
        }
      }

      if (key === 'Backspace') {
        e.preventDefault()
        setImeInput((s) => s.slice(0, -1))
        return
      }

      if (key === 'Escape') {
        e.preventDefault()
        setImeInput('')
        setCandidatesExpanded(false)
        return
      }

      if (key === ' ') {
        if (typeModeRef.current !== 'sentences' && candidatesRef.current.length > 0) {
          e.preventDefault()
          trySelectSlot(0)
        }
        return
      }

      const slot = digitKeyToSlot(key, code)
      if (slot >= 0 && slot <= 8) {
        if (typeModeRef.current === 'sentences') return
        if (slot >= 4 && !candidatesExpandedRef.current) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        trySelectSlot(slot)
        return
      }

      if (key.length === 1 && /^[a-z]$/i.test(key)) {
        if (typeModeRef.current === 'sentences') return
        e.preventDefault()
        setImeInput((s) => s + key.toLowerCase())
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, trySelectSlot, restartTest, skipWordFromPrompt])

  const playedSecondsForCpm =
    screen !== 'play'
      ? timerSeconds > 0
        ? timerSeconds
        : Math.max(1, practiceSeconds)
      : !roundStarted
        ? 0
        : timerSeconds === 0
          ? Math.max(1, practiceSeconds)
          : Math.max(0, timerSeconds - secondsLeft)
  const charsForCpm = typeMode === 'sentences' ? sentCharsCorrect : charsCompleted
  const cpm = playedSecondsForCpm > 0 ? Math.round((charsForCpm / playedSecondsForCpm) * 60) : 0
  const accuracyPct =
    typeMode === 'sentences'
      ? sentPickTotal > 0
        ? Math.round((sentPickGood / sentPickTotal) * 100)
        : 100
      : totalSelectionAttempts > 0
        ? Math.round((correctFirstPicks / totalSelectionAttempts) * 100)
        : 100

  const handleSentenceSessionEnd = useCallback(async () => {
    if (showSessionResults) return
    pausedRef.current = true
    const accuracy = sentPickTotal > 0 ? sentPickGood / sentPickTotal : 1
    const newBest = await submitScore({
      score: typeScore,
      streak: sessionBestStreak,
      cpm,
      accuracy,
      hskLevel,
    })
    setIsNewBest(newBest)
    setShowSessionResults(true)
    void refreshLeaderboard()
  }, [
    showSessionResults,
    submitScore,
    typeScore,
    sessionBestStreak,
    cpm,
    sentPickGood,
    sentPickTotal,
    hskLevel,
    refreshLeaderboard,
  ])

  useEffect(() => {
    handleSentenceSessionEndRef.current = handleSentenceSessionEnd
  }, [handleSentenceSessionEnd])

  useEffect(() => {
    trackEvent('hsk_level_selected', { context: 'type', hsk_level: hskLevel })
  }, [hskLevel])

  useEffect(() => {
    trackEvent('type_mode_selected', { mode: typeMode === 'sentences' ? 'sentences' : 'characters' })
  }, [typeMode])

  useEffect(() => {
    if (!roundStarted) {
      typeRoundStartTrackedRef.current = false
    }
  }, [roundStarted])

  useEffect(() => {
    if (!roundStarted || screen !== 'play') return
    if (typeRoundStartTrackedRef.current) return
    typeRoundStartTrackedRef.current = true
    trackEvent('type_session_started', {
      timer_mode: timerSeconds === 0 ? 'unlimited' : 'timed',
      type_mode: typeMode === 'sentences' ? 'sentences' : 'characters',
      hsk_level: hskLevel,
    })
  }, [roundStarted, screen, timerSeconds, typeMode, hskLevel])

  useEffect(() => {
    if (screen !== 'results') {
      typeResultsTrackedRef.current = false
      return
    }
    if (typeResultsTrackedRef.current) return
    typeResultsTrackedRef.current = true
    const elapsed = timerSeconds > 0 ? timerSeconds : Math.max(0, practiceSeconds)
    const charCount = typeMode === 'sentences' ? sentCharsCorrect : charsCompleted
    void recordStudyActivity({
      typeSessions: 1,
      studySeconds: elapsed,
      activeTab: 'type',
    })
    trackEvent('type_session_completed', {
      timer_mode: timerSeconds === 0 ? 'unlimited' : 'timed',
      hsk_level: hskLevel,
    })
    trackEvent('typed_characters_count', { count: charCount })
    trackEvent('typing_accuracy', { percent: accuracyPct })
    trackEvent('typing_cpm', { value: cpm })
  }, [
    screen,
    timerSeconds,
    practiceSeconds,
    typeMode,
    sentCharsCorrect,
    charsCompleted,
    accuracyPct,
    cpm,
    hskLevel,
  ])

  const handleTryAgain = () => {
    if (skipRevealTimerRef.current) window.clearTimeout(skipRevealTimerRef.current)
    if (skipRevealExitTimerRef.current) window.clearTimeout(skipRevealExitTimerRef.current)
    skipRevealTimerRef.current = 0
    skipRevealExitTimerRef.current = 0
    skipRevealInFlightRef.current = false
    setSkipReveal(null)
    setSkipRevealExiting(false)
    setWordEntryOpacity(true)
    pausedRef.current = false
    setWrongEntries([])
    setWordsCompleted(0)
    setStreak(0)
    setBestStreak(0)
    setCharsCompleted(0)
    setCorrectFirstPicks(0)
    setTotalSelectionAttempts(0)
    setRoundStarted(false)
    setShowRestartPrompt(false)
    setPracticeSeconds(0)
    setSecondsLeft(timerSeconds === 0 ? 0 : timerSeconds)
    setScreen('play')
    setShowSessionResults(false)
    setIsNewBest(false)
    resetScoreSystem()
    if (typeMode === 'sentences') refillSentenceLines()
    else loadWord(null)
  }

  const handleSaveWrongPicks = useCallback(() => {
    const seen = new Set()
    for (const w of wrongEntries) {
      const simp = String(w?.simplified ?? '').trim()
      if (!simp || seen.has(simp)) continue
      seen.add(simp)
      const meta = getLearnMetaFromCedictOrHsk(hskLevel, simp)
      saveLearnedCharacter({ ...meta, hskLevel })
    }
    setWrongSaveFlash(true)
    setWrongSaveDone(true)
    window.clearTimeout(wrongSaveTimeoutRef.current)
    wrongSaveTimeoutRef.current = window.setTimeout(() => {
      setWrongSaveDone(false)
      setWrongSaveFlash(false)
      wrongSaveTimeoutRef.current = 0
    }, 1500)
  }, [wrongEntries, hskLevel])

  if (screen === 'results') {
    const wrongArr = wrongEntries

    if (typeMode === 'sentences') {
      return (
        <div className="flex min-h-[calc(100dvh-9rem)] flex-col bg-transparent px-3 py-6 text-ink sm:px-4">
          <h2 className="text-center text-xl font-semibold text-ink">Time&apos;s up</h2>
          <dl className="mx-auto mt-6 grid max-w-sm gap-3 text-sm">
            <div className="flex justify-between gap-8 border-b border-taupe pb-2">
              <dt className="text-espresso">CPM (characters)</dt>
              <dd className="font-medium tabular-nums text-ink">{cpm}</dd>
            </div>
            <div className="flex justify-between gap-8 border-b border-taupe pb-2">
              <dt className="text-espresso">Accuracy</dt>
              <dd className="font-medium tabular-nums text-ink">{accuracyPct}%</dd>
            </div>
            <div className="flex justify-between gap-8 border-b border-taupe pb-2">
              <dt className="text-espresso">Characters typed correctly</dt>
              <dd className="font-medium tabular-nums text-ink">{sentCharsCorrect}</dd>
            </div>
            <div className="flex justify-between gap-8 border-b border-taupe pb-2">
              <dt className="text-espresso">Characters typed incorrectly</dt>
              <dd className="font-medium tabular-nums text-ink">{sentCharsWrong}</dd>
            </div>
            <div className="flex justify-between gap-8 border-b border-taupe pb-2">
              <dt className="text-espresso">Sentences completed</dt>
              <dd className="font-medium tabular-nums text-ink">{sentLinesCompleted}</dd>
            </div>
          </dl>

          <div className="mx-auto mt-10 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleTryAgain}
              className="rounded-xl bg-clay px-6 py-2.5 text-sm font-medium text-paper hover:bg-btn-hover"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                setScreen('play')
                setRoundStarted(false)
                setShowRestartPrompt(false)
                setPracticeSeconds(0)
                setSecondsLeft(timerSeconds === 0 ? 0 : timerSeconds)
                refillSentenceLines()
              }}
              className="rounded-xl border border-taupe bg-elevated px-6 py-2.5 text-sm font-medium text-ink hover:border-clay"
            >
              Back
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col bg-transparent px-3 py-6 text-ink sm:px-4">
        <h2 className="text-center text-xl font-semibold text-ink">Time&apos;s up</h2>
        <dl className="mx-auto mt-6 grid max-w-sm gap-3 text-sm">
          <div className="flex justify-between gap-8 border-b border-taupe pb-2">
            <dt className="text-espresso">CPM (characters)</dt>
            <dd className="font-medium tabular-nums text-ink">{cpm}</dd>
          </div>
          <div className="flex justify-between gap-8 border-b border-taupe pb-2">
            <dt className="text-espresso">Accuracy (first pick)</dt>
            <dd className="font-medium tabular-nums text-ink">{accuracyPct}%</dd>
          </div>
          <div className="flex justify-between gap-8 border-b border-taupe pb-2">
            <dt className="text-espresso">Longest streak</dt>
            <dd className="font-medium tabular-nums text-ink">{bestStreak}</dd>
          </div>
          <div className="flex justify-between gap-8 border-b border-taupe pb-2">
            <dt className="text-espresso">Words completed</dt>
            <dd className="font-medium tabular-nums text-ink">{wordsCompleted}</dd>
          </div>
          <div className="flex justify-between gap-8 border-b border-taupe pb-2">
            <dt className="text-espresso">Selection attempts</dt>
            <dd className="font-medium tabular-nums text-ink">{totalSelectionAttempts}</dd>
          </div>
        </dl>

        {wrongArr.length > 0 ? (
          <div className="mx-auto mt-8 w-full max-w-md">
            <h3 className="text-sm font-semibold text-clay">Wrong picks</h3>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-taupe bg-elevated p-3 text-sm text-espresso">
              {wrongArr.map((w) => (
                <li key={`${w.simplified}-${w.picked}`}>
                  <span className="font-medium text-ink">{w.simplified}</span>
                  <span className="text-muted"> — picked </span>
                  <span className="text-wrong">{w.picked}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={wrongSaveDone}
                onClick={handleSaveWrongPicks}
                className={[
                  'rounded-xl border px-6 py-2.5 text-sm font-medium transition-colors duration-200',
                  wrongSaveFlash
                    ? 'border-[#D4A843] bg-[#D4A843]/20 text-ink shadow-[0_0_0_1px_rgba(212,168,67,0.45)]'
                    : 'border-taupe bg-elevated text-ink hover:border-[#D4A843]/70 hover:bg-[#D4A843]/10',
                  wrongSaveDone ? 'cursor-default' : '',
                ].join(' ')}
              >
                {wrongSaveDone ? '✓ Saved to Quiz deck!' : `Save wrong picks (${wrongArr.length})`}
              </button>
            </div>
          </div>
        ) : (
          <p className="mx-auto mt-8 max-w-md text-center text-sm text-espresso">
            🎉 Perfect session — nothing to save!
          </p>
        )}

        <div className="mx-auto mt-10 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={handleTryAgain}
            className="rounded-xl bg-clay px-6 py-2.5 text-sm font-medium text-paper hover:bg-btn-hover"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => {
              setScreen('play')
              setWrongEntries([])
              setRoundStarted(false)
              setShowRestartPrompt(false)
              setPracticeSeconds(0)
              setSecondsLeft(timerSeconds === 0 ? 0 : timerSeconds)
              setCharsCompleted(0)
              setCorrectFirstPicks(0)
              setTotalSelectionAttempts(0)
              setWordsCompleted(0)
              setStreak(0)
              setBestStreak(0)
              loadWord(null)
            }}
            className="rounded-xl border border-taupe bg-elevated px-6 py-2.5 text-sm font-medium text-ink hover:border-clay"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  const canShowPlay = typeMode === 'sentences' ? sentLines.length > 0 : Boolean(currentWord)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-transparent text-ink">
      <div className="mb-2 shrink-0 flex flex-col gap-3 rounded-xl border border-taupe bg-parchment px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="flex flex-wrap items-center gap-2 gap-y-2">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={screen !== 'play'}
              onClick={() => setTypeMode('characters')}
              className={[
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                typeMode === 'characters'
                  ? 'border-clay bg-clay text-paper'
                  : 'border-taupe text-espresso hover:bg-elevated disabled:opacity-40',
              ].join(' ')}
            >
              Characters
            </button>
            <button
              type="button"
              disabled={screen !== 'play'}
              onClick={() => setTypeMode('sentences')}
              className={[
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                typeMode === 'sentences'
                  ? 'border-clay bg-clay text-paper'
                  : 'border-taupe text-espresso hover:bg-elevated disabled:opacity-40',
              ].join(' ')}
            >
              Sentences
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6].map((lv) => (
              <button
                key={lv}
                type="button"
                disabled={screen !== 'play'}
                onClick={() => setHskLevel(lv)}
                className={[
                  'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                  hskLevel === lv
                    ? 'border-clay bg-clay text-paper'
                    : 'border-taupe text-espresso hover:bg-elevated disabled:opacity-40',
                ].join(' ')}
              >
                HSK {lv}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TIMER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              disabled={screen !== 'play'}
              onClick={() => setTimerSeconds(id)}
              className={[
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                timerSeconds === id
                  ? 'border-clay bg-clay text-paper'
                  : 'border-taupe text-espresso hover:bg-elevated disabled:opacity-40',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {timerSeconds !== 0 ? (
          <div className="text-right text-sm tabular-nums text-espresso sm:ml-auto">
            <span>{secondsLeft}s</span>
          </div>
        ) : null}
      </div>

      <div
        className={[
          'flex min-h-0 w-full flex-1 flex-col overflow-y-auto',
          typeMode === 'sentences' ? 'justify-start' : '',
        ].join(' ')}
      >
        <div className={typeMode === 'sentences' ? 'w-full py-6 sm:py-8' : 'my-auto w-full'}>
          <div
            className={[
              'mx-1.5 flex w-full flex-col rounded-2xl border border-taupe bg-parchment px-3 shadow-sm sm:mx-0 sm:px-6',
              typeMode === 'sentences' ? 'pb-6 pt-5 sm:pb-8 sm:pt-6' : 'pb-2 pt-3 sm:pb-2 sm:pt-4',
            ].join(' ')}
          >
        {canShowPlay ? (
          <>
            {typeMode === 'sentences' && screen === 'play' ? (
              <XPOrbSystem
                orbEvents={orbEvents}
                badgeRef={scoreBadgeRef}
                multiplier={typeMultiplier}
              />
            ) : null}
            <div className="flex flex-col items-center text-center">
              <div
                ref={playSurfaceRef}
                tabIndex={-1}
                className={[
                  'relative w-full max-w-3xl rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-clay/30 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                  typeMode === 'sentences' ? 'mt-0' : 'mt-1',
                ].join(' ')}
              >
                <div
                  className={
                    (!roundStarted || (roundStarted && showRestartPrompt))
                      ? 'blur-lg pointer-events-none select-none transition-[filter]'
                      : ''
                  }
                >
                  <div className="flex w-full max-w-3xl flex-col items-center">
                    {typeMode === 'sentences' ? (
                      <div
                        ref={sentenceContainerRef}
                        className={[
                          'relative flex w-full max-w-3xl flex-col items-center transition-opacity duration-300 ease-out',
                          wordEntryOpacity ? 'opacity-100' : 'opacity-0',
                          typeMultiplier >= 5 ? 'fire-container' : '',
                        ].join(' ')}
                      >
                        <AmbientParticles
                          multiplier={typeMultiplier}
                          containerRef={sentenceContainerRef}
                        />
                        <div className="pointer-events-none absolute top-0 right-1 z-20">
                          <MultiplierBadge
                            ref={scoreBadgeRef}
                            score={typeScore}
                            streak={sentStreakVal}
                            cpm={cpm}
                            orbArrived={orbArrivalCount}
                          />
                        </div>

                        {sentLines.length === 0 ? (
                          <div className="py-8 text-center text-sm text-[#8C7A52]">
                            Loading sentences...
                          </div>
                        ) : (
                          <SentenceCarousel
                            sentenceQueue={sentLines.map((l) => l.chinese)}
                            completedCount={sentLinesCompleted}
                            activeInput={
                              <PinyinStreamInput
                                key={sentLines[0].id}
                                sentence={sentLines[0].chinese}
                                sentLine={sentLines[0]}
                                english={formatEnglishMeaningForDisplay('', sentLines[0].english ?? '')}
                                onComplete={handleSentenceStreamComplete}
                                onCharConfirmed={handleSentenceStreamCharConfirmed}
                                onCharError={handleSentenceStreamCharError}
                                active={roundStarted && !showRestartPrompt && !skipReveal}
                                disabled={!roundStarted || showRestartPrompt || Boolean(skipReveal)}
                                sentencesCompleted={sentLinesCompleted}
                                multiplier={typeMultiplier}
                              />
                            }
                          />
                        )}
                      </div>
                    ) : (
                      <div
                        className={[
                          'flex flex-col items-center gap-1.5 transition-opacity duration-300 ease-out',
                          wordEntryOpacity ? 'opacity-100' : 'opacity-0',
                        ].join(' ')}
                      >
                        <div
                          className={[
                            'leading-none font-normal transition-colors duration-200',
                            flash === 'correct' ? 'text-correct' : '',
                            flash === 'wrong' ? 'text-wrong' : '',
                            flash === 'none' ? 'text-ink' : '',
                          ].join(' ')}
                          style={{ fontSize: 'clamp(66px,20.5vw,184px)' }}
                        >
                          {currentWord.simplified}
                        </div>
                        {flash === 'correct' ? (
                          <p className="text-lg font-medium text-correct">Correct!</p>
                        ) : null}

                        <p className="max-w-lg px-2 text-base text-[#D4A843] sm:text-lg">
                          {hskLevel === 1
                            ? resolveTypeHskDisplayEnglish(currentWord.simplified, currentWord.english)
                            : formatEnglishMeaningForDisplay(currentWord.simplified, currentWord.english)}
                        </p>
                      </div>
                    )}

                    {typeMode !== 'sentences' ? (
                    <div className="mx-auto mt-4 w-full max-w-2xl transition-opacity duration-300">
                      <div
                        className={[
                          'rounded-lg border border-taupe bg-elevated px-4 py-3 font-mono text-xl tracking-wide text-ink sm:text-2xl',
                          flash === 'wrong' ? 'border-wrong ring-1 ring-wrong/50' : '',
                        ].join(' ')}
                        aria-label="Pinyin composition"
                      >
                        <span className="px-1 text-ink">{imeInput || '\u00a0'}</span>
                        <span
                          className="ml-0.5 inline-block h-[0.92em] w-px shrink-0 animate-pulse bg-clay"
                          aria-hidden
                        />
                      </div>

                      <div className="mt-2 overflow-hidden rounded-lg border border-taupe bg-parchment/90">
                        <div className="flex items-center justify-between gap-2 border-b border-taupe/40 px-2 py-2 sm:px-3">
                          <div className="flex w-9 shrink-0 justify-start sm:w-10">
                            {candidatesExpanded ? (
                              <button
                                type="button"
                                onClick={() => setCandidatesExpanded(false)}
                                className="rounded-full border border-taupe/80 px-2 py-0.5 text-xs text-clay hover:border-clay"
                                aria-label="Show fewer candidates"
                              >
                                «
                              </button>
                            ) : (
                              <span className="inline-block w-9 sm:w-10" aria-hidden />
                            )}
                          </div>
                          <span className="min-w-0 flex-1 text-center text-xs text-muted">
                            {!indexReady
                              ? 'Building dictionary index…'
                              : !candidates.length
                                ? queryNorm
                                  ? 'No matches'
                                  : '\u00a0'
                                : candidatesExpanded
                                  ? '1–9 or Space for #1'
                                  : '1–4 or Space for #1'}
                          </span>
                          <div className="flex w-9 shrink-0 justify-end sm:w-10">
                            {!candidatesExpanded && canExpandCandidates ? (
                              <button
                                type="button"
                                onClick={() => setCandidatesExpanded(true)}
                                className="rounded-full border border-taupe/80 px-2 py-0.5 text-xs text-clay hover:border-clay"
                                aria-label="Show more candidates"
                              >
                                »
                              </button>
                            ) : (
                              <span className="inline-block w-9 sm:w-10" aria-hidden />
                            )}
                          </div>
                        </div>
                        <div className="overflow-hidden px-2 py-2 sm:px-3 sm:pb-2">
                          {!indexReady ? (
                            <p className="py-3 text-center text-sm text-muted">Preparing fast lookup…</p>
                          ) : visibleCandidates.length === 0 ? (
                            <p className="py-3 text-center text-sm text-muted">
                              {queryNorm ? 'No candidates — keep typing' : 'Type letters to see candidates'}
                            </p>
                          ) : (
                            <div
                              className={
                                candidatesExpanded
                                  ? 'grid grid-cols-3 gap-2 overflow-hidden sm:gap-3'
                                  : 'flex flex-nowrap justify-center gap-2 overflow-hidden sm:gap-3'
                              }
                            >
                              {visibleCandidates.map((entry, i) => {
                                const num = i + 1
                                const isHi = i === 0
                                return (
                                  <button
                                    key={`${entry.simplified}-${entry.pinyin}-${num}`}
                                    type="button"
                                    onClick={() => trySelectSlot(i)}
                                    className={[
                                      'flex min-w-0 items-baseline justify-center gap-1.5 rounded-full border px-2 py-2.5 text-left transition sm:gap-2 sm:px-4 sm:py-3',
                                      candidatesExpanded
                                        ? 'w-full max-w-none'
                                        : 'max-w-[8.5rem] flex-1 basis-0 sm:max-w-[9.5rem]',
                                      isHi ? 'border-clay ring-2 ring-clay/40' : 'border-taupe/80',
                                      'bg-elevated hover:border-clay',
                                    ].join(' ')}
                                  >
                                    <span className="shrink-0 text-sm font-bold tabular-nums text-clay sm:text-base">
                                      {num}.
                                    </span>
                                    <span className="min-w-0 truncate text-lg text-ink sm:text-xl">{entry.simplified}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    ) : null}
                  </div>
                </div>

                {!roundStarted ? (
                  <p className="pointer-events-none absolute left-1/2 top-[clamp(5.25rem,19vw,12.75rem)] z-[25] w-full max-w-lg -translate-x-1/2 rounded-md border border-taupe/50 bg-parchment/95 px-3 py-2 text-center text-sm leading-snug text-espresso/80 shadow-sm sm:top-[clamp(5.75rem,20vw,13.5rem)]">
                    {typeMode === 'sentences' ? (
                      <>
                        Type pinyin continuously for each character — no spaces, no tones.{' '}
                        <span className="font-medium text-ink">Backspace</span> fixes a mistake. Characters turn gold as
                        you match each syllable.
                      </>
                    ) : (
                      <>
                        Type pinyin, then <span className="font-medium text-ink">1–4</span> or{' '}
                        <span className="font-medium text-ink">Space</span> for the first choice. Press{' '}
                        <span className="font-medium text-ink">»</span> below for up to nine.
                      </>
                    )}
                  </p>
                ) : null}

                {!roundStarted ? (
                  <button
                    type="button"
                    className="absolute inset-0 z-[40] flex flex-col items-center justify-center gap-2 rounded-2xl border border-taupe/50 bg-parchment/75 px-4 py-8 text-center backdrop-blur-md backdrop-saturate-150 sm:gap-3"
                    aria-label="Press Space to start the round"
                    onClick={() => setRoundStarted(true)}
                  >
                    <span className="text-sm font-semibold text-ink sm:text-base">Press Space to start</span>
                    <span className="text-xs text-espresso">The timer counts down only after you start.</span>
                    <div className="mt-1 flex flex-col gap-1 text-[11px] text-muted">
                      <p>tab + enter — restart</p>
                      <p>tab + space — skip</p>
                      <p>esc — cancel</p>
                    </div>
                  </button>
                ) : null}

                {roundStarted && showRestartPrompt ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[45] flex flex-col items-center justify-center px-4 py-6"
                  >
                    {skipReveal ? (
                      <div
                        className={[
                          'pointer-events-none flex max-w-lg flex-col items-center gap-1 text-center transition-opacity duration-300 ease-out',
                          skipRevealExiting ? 'opacity-0' : 'opacity-100',
                        ].join(' ')}
                        aria-live="polite"
                      >
                        <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#D4A843]/40">
                          skipped
                        </p>
                        {skipReveal.mode === 'sentences' ? (
                          <>
                            <p
                              className="font-mono font-normal leading-snug text-white"
                              style={{ fontSize: 'clamp(1.15rem,4.1vw,2.05rem)' }}
                            >
                              {skipReveal.simplified}
                            </p>
                            <p className="mt-2 text-lg text-[#D4A843] sm:text-xl">{skipReveal.pinyinMarked}</p>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#D4A843]/88 sm:text-base">
                              {skipReveal.english}
                            </p>
                          </>
                        ) : (
                          <>
                            <p
                              className="leading-none font-normal text-white"
                              style={{ fontSize: 'clamp(52px,15vw,128px)' }}
                            >
                              {skipReveal.simplified}
                            </p>
                            <p className="mt-2 text-xl text-[#D4A843] sm:text-2xl">{skipReveal.pinyinMarked}</p>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#D4A843]/88 sm:text-base">
                              {skipReveal.english}
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="pointer-events-auto flex flex-col items-center gap-2">
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                          <button
                            type="button"
                            onClick={() => restartTest()}
                            className="flex items-center gap-2 rounded-lg border-2 border-clay bg-transparent px-6 py-2.5 text-sm font-medium text-clay shadow-sm transition hover:bg-clay/10 sm:px-8"
                          >
                            <span className="text-lg leading-none" aria-hidden>
                              ↺
                            </span>
                            restart
                          </button>
                          <button
                            type="button"
                            onClick={() => skipWordFromPrompt()}
                            className="flex items-center gap-2 rounded-lg border-2 border-taupe bg-transparent px-6 py-2.5 text-sm font-medium text-espresso shadow-sm transition hover:border-espresso/50 hover:bg-elevated/80 sm:px-8"
                          >
                            <IconArrowRight />
                            skip
                          </button>
                        </div>
                        <p className="text-xs text-muted">tab + enter — restart</p>
                        <p className="text-xs text-muted">tab + space — skip</p>
                        <p className="text-xs text-muted">esc — cancel</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-espresso">
            {typeMode === 'sentences' ? 'No sentences loaded for this level.' : 'No words in this list.'}
          </p>
        )}
          </div>
        </div>
      </div>

      {showSessionResults && typeMode === 'sentences' ? (
        <SessionResults
          score={typeScore}
          streak={sessionBestStreak}
          cpm={cpm}
          accuracy={sentPickTotal > 0 ? sentPickGood / sentPickTotal : 1}
          hskLevel={hskLevel}
          personalBest={personalBest}
          isNewBest={isNewBest}
          leaderboardRank={userRank}
          onPlayAgain={() => {
            setShowSessionResults(false)
            setIsNewBest(false)
            handleTryAgain()
          }}
          onClose={() => {
            setShowSessionResults(false)
            pausedRef.current = false
            setScreen('results')
          }}
        />
      ) : null}
    </div>
  )
}
