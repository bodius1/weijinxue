import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getFirstEnglish,
  getPinyinFromSentence,
  getSimplifiedSentence,
  tatoebaSearchUrl,
} from '../utils/tatoeba.js'
import { formatEnglishMeaningForDisplay } from '../utils/formatEnglishMeaning.js'
import { pinyinForDisplay } from '../utils/pinyinToneMark.js'

/** Non-overlapping occurrences of full substring `target` in `simplified`. */
function countTargetOccurrences(simplified, target) {
  if (!target || !simplified) return 0
  let n = 0
  let pos = 0
  const L = target.length
  while (pos <= simplified.length - L) {
    const idx = simplified.indexOf(target, pos)
    if (idx === -1) break
    n += 1
    pos = idx + L
  }
  return n
}

/** Count CJK unified ideographs (excludes punctuation, Latin, etc.). */
function countHanCharacters(s) {
  if (!s) return 0
  let n = 0
  for (const ch of s) {
    if (/^[\u4e00-\u9fff]$/u.test(ch)) n += 1
  }
  return n
}

function hashString(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

function isSentenceEndPunctuation(ch) {
  return /[。！？.!?…]/u.test(ch)
}

function isGapAfterTerminalPunctuation(without, g) {
  return (
    g === without.length &&
    without.length > 0 &&
    isSentenceEndPunctuation(without[without.length - 1])
  )
}

/**
 * Insertion-gap practice: remove the full `targetWord` once, then numbered gaps.
 */
function buildPracticePlan(simplified, targetWord, sentenceId) {
  if (!simplified || !targetWord) return null
  if (countTargetOccurrences(simplified, targetWord) !== 1) return null
  const minHan = Math.max(3, targetWord.length + 1)
  if (countHanCharacters(simplified) < minHan) return null

  const wordLen = targetWord.length
  const trueIdx = simplified.indexOf(targetWord)
  if (trueIdx === -1) return null

  const without =
    simplified.slice(0, trueIdx) + simplified.slice(trueIdx + wordLen)
  const correctGap = trueIdx
  const numGaps = without.length + 1
  const decoyCandidates = []
  for (let g = 0; g < numGaps; g++) {
    if (g === correctGap) continue
    if (isGapAfterTerminalPunctuation(without, g)) continue
    decoyCandidates.push(g)
  }
  if (decoyCandidates.length === 0 && correctGap !== 0) {
    decoyCandidates.push(0)
  }
  if (decoyCandidates.length === 0) return null

  const seed =
    (typeof sentenceId === 'number' && Number.isFinite(sentenceId)
      ? sentenceId
      : Number(sentenceId)) || hashString(simplified)
  const decoyGap =
    decoyCandidates[Math.abs(seed >>> 0) % decoyCandidates.length]

  const quizGaps = [correctGap, decoyGap].sort((a, b) => a - b)
  const gapToBlankIndex = new Map()
  quizGaps.forEach((g, i) => gapToBlankIndex.set(g, i + 1))
  const answerIndex = gapToBlankIndex.get(correctGap) ?? 1

  const segments = []
  for (let g = 0; g <= without.length; g++) {
    if (gapToBlankIndex.has(g)) {
      const blankIndex = gapToBlankIndex.get(g)
      segments.push({ type: 'blank', blankIndex, gapIndex: g })
    }
    if (g < without.length) {
      const ch = without[g]
      const last = segments[segments.length - 1]
      if (last?.type === 'text') last.text += ch
      else segments.push({ type: 'text', text: ch })
    }
  }

  return { segments, numBlanks: quizGaps.length, answerIndex }
}

async function fetchTatoebaPage(query, page) {
  const url = tatoebaSearchUrl(query, page)
  const res = await fetch(url)
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

async function fetchTatoebaPageBatch(query, startPage, count) {
  const pages = Array.from({ length: count }, (_, i) => startPage + i)
  const settled = await Promise.allSettled(
    pages.map((p) => fetchTatoebaPage(query, p)),
  )
  const ok = []
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]
    if (s.status === 'fulfilled') ok.push({ page: pages[i], data: s.value })
  }
  return ok.sort((a, b) => a.page - b.page)
}

function emptySet() {
  return new Set()
}

export default function QuickQuiz({ entry, isOpen }) {
  const placementWord = useMemo(
    () => (entry?.char || '').trim() || '欢迎',
    [entry?.char],
  )
  const displayPinyin = useMemo(() => pinyinForDisplay(entry?.pinyin), [entry?.pinyin])

  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const [lastFetchedPage, setLastFetchedPage] = useState(0)
  const [hasMorePages, setHasMorePages] = useState(true)

  const [answerIndex, setAnswerIndex] = useState(1)
  const [won, setWon] = useState(false)
  const [wrongGuesses, setWrongGuesses] = useState(emptySet)

  const candidatesRef = useRef(candidates)
  const sentenceIndexRef = useRef(sentenceIndex)
  const lastFetchedPageRef = useRef(lastFetchedPage)
  const hasMorePagesRef = useRef(hasMorePages)

  useEffect(() => {
    candidatesRef.current = candidates
    sentenceIndexRef.current = sentenceIndex
    lastFetchedPageRef.current = lastFetchedPage
    hasMorePagesRef.current = hasMorePages
  }, [candidates, sentenceIndex, lastFetchedPage, hasMorePages])

  const current = candidates[sentenceIndex] ?? null
  const simplified = current ? getSimplifiedSentence(current) : ''
  const english = current ? getFirstEnglish(current) : ''
  const fullPinyin = current ? getPinyinFromSentence(current) : ''

  const blankData = useMemo(
    () =>
      simplified && placementWord && current?.id != null
        ? buildPracticePlan(simplified, placementWord, current.id)
        : null,
    [simplified, placementWord, current],
  )
  const blankSegments = blankData?.segments ?? null
  const numBlanks = blankData?.numBlanks ?? 0
  const planAnswerIndex = blankData?.answerIndex ?? 1

  const blankMinWidth = useMemo(
    () => `clamp(3rem, ${Math.max(placementWord.length, 1) + 3}ch, 16rem)`,
    [placementWord.length],
  )

  const ingestResults = useCallback(
    (results, seenIds) => {
      const next = []
      const minHan = Math.max(3, placementWord.length + 1)
      for (const s of results || []) {
        if (!s?.id || seenIds.has(s.id)) continue
        const sim = getSimplifiedSentence(s)
        if (countTargetOccurrences(sim, placementWord) !== 1) continue
        if (countHanCharacters(sim) < minHan) continue
        if (!buildPracticePlan(sim, placementWord, s.id)) continue
        seenIds.add(s.id)
        next.push(s)
      }
      return next
    },
    [placementWord],
  )

  const resetRound = useCallback(() => {
    setWon(false)
    setWrongGuesses(emptySet())
    setAnswerIndex(1)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      if (!simplified || numBlanks < 2) {
        resetRound()
        return
      }
      setWon(false)
      setWrongGuesses(emptySet())
      setAnswerIndex(planAnswerIndex)
    })
  }, [sentenceIndex, numBlanks, simplified, planAnswerIndex, resetRound])

  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => {
        setCandidates([])
        setSentenceIndex(0)
        setLastFetchedPage(0)
        setHasMorePages(true)
        setFetchError(null)
        setLoading(false)
        resetRound()
        candidatesRef.current = []
        sentenceIndexRef.current = 0
        lastFetchedPageRef.current = 0
        hasMorePagesRef.current = true
      })
      return
    }

    let cancelled = false

    async function loadInitial() {
      setLoading(true)
      setFetchError(null)
      setCandidates([])
      candidatesRef.current = []
      setSentenceIndex(0)
      sentenceIndexRef.current = 0
      setLastFetchedPage(0)
      lastFetchedPageRef.current = 0
      setHasMorePages(true)
      hasMorePagesRef.current = true
      resetRound()

      const seenIds = new Set()
      const acc = []
      const BATCH = 4
      let startPage = 1

      try {
        while (!cancelled && startPage <= 24) {
          const batch = await fetchTatoebaPageBatch(placementWord, startPage, BATCH)
          if (cancelled) return
          if (batch.length === 0) {
            if (!cancelled) {
              setHasMorePages(false)
              hasMorePagesRef.current = false
            }
            break
          }

          let batchHasMore = false
          for (const { page, data } of batch) {
            const rows = data?.results || []
            acc.push(...ingestResults(rows, seenIds))
            const paging = data?.paging?.Sentences
            if (paging?.nextPage) batchHasMore = true
            if (!cancelled) {
              setLastFetchedPage(page)
              lastFetchedPageRef.current = page
            }
          }
          if (!cancelled) {
            setHasMorePages(batchHasMore)
            hasMorePagesRef.current = batchHasMore
          }
          if (acc.length > 0) break
          if (!batchHasMore) break
          startPage += BATCH
        }
        if (!cancelled) {
          setCandidates(acc)
          setSentenceIndex(0)
          candidatesRef.current = acc
        }
      } catch {
        if (!cancelled) setFetchError('Could not load example sentences.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInitial()
    return () => {
      cancelled = true
    }
  }, [isOpen, placementWord, ingestResults, resetRound])

  const loadMore = useCallback(async () => {
    if (!hasMorePagesRef.current) return 0
    const nextPage = lastFetchedPageRef.current + 1
    if (nextPage < 1) return 0
    setLoading(true)
    setFetchError(null)
    try {
      const data = await fetchTatoebaPage(placementWord, nextPage)
      const rows = data?.results || []
      const prev = candidatesRef.current
      const seenIds = new Set(prev.map((s) => s.id))
      const more = ingestResults(rows, seenIds)
      const merged = [...prev, ...more]
      setCandidates(merged)
      candidatesRef.current = merged
      const paging = data?.paging?.Sentences
      const morePages = Boolean(paging?.nextPage)
      setHasMorePages(morePages)
      hasMorePagesRef.current = morePages
      setLastFetchedPage(nextPage)
      lastFetchedPageRef.current = nextPage
      return more.length
    } catch {
      setFetchError('Could not load more sentences.')
      return 0
    } finally {
      setLoading(false)
    }
  }, [placementWord, ingestResults])

  const handleNumberPick = useCallback(
    (n) => {
      if (n < 1 || n > numBlanks || won) return
      if (n === answerIndex) {
        setWon(true)
        return
      }
      setWrongGuesses((prev) => new Set(prev).add(n))
    },
    [answerIndex, numBlanks, won],
  )

  useEffect(() => {
    if (!isOpen || !current || !blankSegments || won || numBlanks === 0) return

    function isTypingTarget(el) {
      if (!(el instanceof HTMLElement)) return false
      if (el.isContentEditable) return true
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'))
    }

    function onKeyDown(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (isTypingTarget(e.target)) return

      let digit = null
      if (e.key >= '1' && e.key <= '9') digit = Number(e.key)
      else {
        const m = /^Numpad(\d)$/.exec(e.code)
        if (m) digit = Number(m[1])
      }
      if (digit == null || digit < 1 || digit > numBlanks) return

      e.preventDefault()
      handleNumberPick(digit)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, current, blankSegments, won, numBlanks, handleNumberPick])

  const handleNext = async () => {
    if (!won) return
    const idx = sentenceIndexRef.current
    let list = candidatesRef.current
    if (idx + 1 < list.length) {
      setSentenceIndex(idx + 1)
      return
    }
    if (!hasMorePagesRef.current) return
    await loadMore()
    list = candidatesRef.current
    if (list.length > idx + 1) {
      setSentenceIndex(idx + 1)
    }
  }

  const showEmpty =
    !loading &&
    !fetchError &&
    isOpen &&
    candidates.length === 0 &&
    !hasMorePages

  const canLoadAnotherSentence =
    sentenceIndex + 1 < candidates.length || hasMorePages

  return (
    <div
      id="examples-practice-panel"
      className="border-t border-taupe bg-elevated px-3 py-4"
    >
      <h2 className="mb-3 text-center text-sm font-semibold text-ink">
        Practice: {placementWord}
        {displayPinyin ? (
          <span className="font-normal text-espresso"> ({displayPinyin})</span>
        ) : null}
      </h2>

      {loading && candidates.length === 0 ? (
        <p className="text-center text-sm text-espresso/80">Loading examples…</p>
      ) : null}

      {fetchError ? (
        <p className="text-center text-sm text-accent-red">{fetchError}</p>
      ) : null}

      {showEmpty ? (
        <p className="text-center text-sm text-espresso/80">
          No example sentences found for “{placementWord}” yet (need the whole word
          exactly once, enough characters in the sentence, and another insertion gap
          for a decoy choice).
        </p>
      ) : null}

      {current && blankSegments ? (
        <div className="mx-auto max-w-lg space-y-4">
          <p className="text-center text-lg leading-relaxed text-ink">
            {blankSegments.map((seg, i) => {
              if (seg.type === 'text') {
                return <span key={i}>{seg.text}</span>
              }
              const n = seg.blankIndex
              const isCorrectSlot = won && n === answerIndex
              const isWrongGuess = wrongGuesses.has(n) && !won
              const isOtherSlot = won && n !== answerIndex

              const boxCls = isCorrectSlot
                ? 'border-correct bg-correct/25 text-ink ring-2 ring-correct'
                : isWrongGuess
                  ? 'border-wrong bg-wrong/35 text-ink ring-2 ring-wrong'
                  : isOtherSlot
                    ? 'border-taupe bg-parchment/80 text-ink'
                    : 'border-dashed border-clay/60 bg-parchment/60 text-espresso'

              const cellText = !won
                ? '[___]'
                : isCorrectSlot
                  ? placementWord
                  : '–'

              return (
                <span
                  key={i}
                  style={{ minWidth: blankMinWidth }}
                  className={[
                    'mx-1 inline-flex min-h-[2.25rem] flex-col items-center justify-center rounded border px-2 py-1 text-center align-middle text-lg font-medium leading-tight transition-opacity',
                    boxCls,
                  ].join(' ')}
                >
                  <span className="text-[10px] leading-none text-muted">
                    {n}
                  </span>
                  <span className="max-w-[min(100%,16rem)] whitespace-normal break-all leading-tight">
                    {cellText}
                  </span>
                </span>
              )
            })}
          </p>

          {won ? (
            <>
              <p className="text-center text-sm font-medium text-correct">
                You correctly filled in the blank.
              </p>
              <p className="text-center text-base text-espresso">{fullPinyin}</p>
            </>
          ) : null}

          <p className="text-center text-sm italic text-espresso/90">
            <span className="text-espresso/75 not-italic">English: </span>
            <span className="font-medium not-italic text-espresso">
              {formatEnglishMeaningForDisplay(placementWord, english) || '—'}
            </span>
          </p>

          {numBlanks > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: numBlanks }, (_, i) => i + 1).map((n) => {
                const isAnswer = n === answerIndex
                const dimOthers = won && !isAnswer
                const label =
                  won && isAnswer ? placementWord : won && dimOthers ? '–' : String(n)
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={won}
                    onClick={() => handleNumberPick(n)}
                    className={[
                      'min-h-12 rounded-lg border px-3 text-center text-sm font-semibold transition',
                      won && isAnswer
                        ? 'min-w-[min(100%,14rem)] cursor-default border-correct bg-correct/30 text-ink ring-2 ring-correct'
                        : dimOthers
                          ? 'h-12 min-w-12 cursor-default border-taupe bg-parchment/50 text-espresso opacity-35'
                          : 'h-12 min-w-12 border-taupe bg-parchment text-ink hover:border-clay hover:bg-elevated',
                    ].join(' ')}
                    aria-label={
                      won && isAnswer
                        ? `Correct: ${placementWord}`
                        : `Choose blank ${n}`
                    }
                  >
                    <span className="break-all leading-snug">{label}</span>
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={loading || !canLoadAnotherSentence || !won}
              className="text-sm font-medium text-clay underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-40"
            >
              Next sentence →
            </button>
          </div>

          {loading && candidates.length > 0 ? (
            <p className="text-center text-xs text-espresso/70">Loading…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
