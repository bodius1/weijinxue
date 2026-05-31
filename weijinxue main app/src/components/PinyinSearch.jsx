import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trackEvent } from '../utils/analytics.js'
import { HSK13_SET, SYLLABLE_PRIORITY } from '../data/searchRankData.js'
import { fullTonelessPinyin, getDictionary } from '../utils/pinyinIme.js'
import { cedictPinyinToMarked } from '../utils/pinyinToneMark.js'

function normalizeQuery(q) {
  return q
    .trim()
    .toLowerCase()
    .replace(/\d/g, '')
    .replace(/ü/g, 'v')
    .replace(/\u00fc/g, 'v')
}

function isAllHan(s) {
  return typeof s === 'string' && s.length > 0 && /^[\u4e00-\u9fff]+$/u.test(s)
}

function definitionLength(entry) {
  return entry.english.join(' / ').length
}

function matchStrength(fullToneless, queryNorm) {
  if (!queryNorm) return 0
  if (fullToneless === queryNorm) return 3
  if (fullToneless.startsWith(queryNorm)) return 2
  return 0
}

function priorityScore(entry) {
  const word = entry.simplified
  const chars = [...word]
  const syllables = entry.pinyin
    .trim()
    .split(/\s+/)
    .map((syl) => syl.replace(/[1-5]$/i, '').toLowerCase().replace(/ü/g, 'v'))

  let score = 0
  if (chars.length === syllables.length) {
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]
      if (HSK13_SET.has(ch)) score += 3000
      const pr = SYLLABLE_PRIORITY[syllables[i]]
      if (pr) {
        const ix = pr.indexOf(ch)
        if (ix !== -1) score += Math.max(0, 400 - ix)
      }
    }
  } else {
    for (const ch of chars) {
      if (HSK13_SET.has(ch)) score += 3000
    }
  }
  return score
}

function sortMatches(entries, queryNorm) {
  return [...entries].sort((a, b) => {
    const fa = fullTonelessPinyin(a.pinyin)
    const fb = fullTonelessPinyin(b.pinyin)
    const ma = matchStrength(fa, queryNorm)
    const mb = matchStrength(fb, queryNorm)
    if (mb !== ma) return mb - ma

    const pDiff = priorityScore(b) - priorityScore(a)
    if (pDiff !== 0) return pDiff

    const len = a.simplified.length - b.simplified.length
    if (len !== 0) return len

    const da = definitionLength(a)
    const db = definitionLength(b)
    if (da !== db) return da - db

    if (fa !== fb) return fa.localeCompare(fb)
    return a.simplified.localeCompare(b.simplified, 'zh')
  })
}

/** Cap sorted results so very broad prefixes (e.g. "a") stay responsive. */
const MAX_RESULTS = 800

async function searchPinyin(queryNorm) {
  if (!queryNorm) return []
  const dict = await getDictionary()
  const all = dict.data.all
  const seen = new Set()
  const out = []

  for (let i = 0; i < all.length; i++) {
    const raw = all[i]
    const simp = raw[1]
    if (!isAllHan(simp)) continue
    const pin = raw[2]
    if (typeof pin !== 'string') continue
    const full = fullTonelessPinyin(pin)
    if (!full.startsWith(queryNorm)) continue

    const key = `${simp}|${pin}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(dict.expandValue(raw, false))
  }

  return sortMatches(out, queryNorm).slice(0, MAX_RESULTS)
}

function digitKeyToSlot(key, code) {
  if (key >= '1' && key <= '9') return Number(key) - 1
  const m = /^Numpad([1-9])$/.exec(code)
  return m ? Number(m[1]) - 1 : -1
}

const PAGE_SIZE = 9

export default function PinyinSearch({
  placeholder = 'type pinyin...',
  onSelect,
  /** `'hero'` — larger input for Learn tab entry point. */
  variant = 'default',
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [allMatches, setAllMatches] = useState([])
  const [dictionaryLoading, setDictionaryLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = window.setTimeout(() => queueMicrotask(() => setDebounced(query)), 100)
    return () => window.clearTimeout(t)
  }, [query])

  const norm = useMemo(() => normalizeQuery(debounced), [debounced])

  useEffect(() => {
    if (!norm) {
      setAllMatches([])
      setDictionaryLoading(false)
      return
    }
    let cancelled = false
    setDictionaryLoading(true)
    searchPinyin(norm)
      .then((matches) => {
        if (!cancelled) setAllMatches(matches)
      })
      .catch((err) => {
        console.error('Failed to load pinyin dictionary', err)
        if (!cancelled) setAllMatches([])
      })
      .finally(() => {
        if (!cancelled) setDictionaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [norm])

  useEffect(() => {
    queueMicrotask(() => setPage(0))
  }, [norm])

  const totalPages = Math.max(1, Math.ceil(allMatches.length / PAGE_SIZE))
  const currentPage = Math.min(page, Math.max(0, totalPages - 1))
  const pageStart = currentPage * PAGE_SIZE
  const pageSlice = allMatches.slice(pageStart, pageStart + PAGE_SIZE)

  const commit = useCallback(
    (entry) => {
      if (variant === 'hero') {
        trackEvent('search_performed', {
          query_length: Math.min(32, norm.length),
          results_bucket: allMatches.length > 20 ? 'many' : allMatches.length > 0 ? 'few' : 'none',
        })
      }
      onSelect?.({
        simplified: entry.simplified,
        traditional: entry.traditional,
        pinyin: entry.pinyin,
        pinyinDisplay: cedictPinyinToMarked(entry.pinyin),
        english: entry.english,
      })
      setQuery('')
      setDebounced('')
      setPage(0)
      inputRef.current?.focus()
    },
    [onSelect, variant, norm.length, allMatches.length],
  )

  const handleKeyDown = (e) => {
    if (!pageSlice.length) return
    const slot = digitKeyToSlot(e.key, e.code)
    if (slot < 0 || slot >= pageSlice.length) return
    e.preventDefault()
    commit(pageSlice[slot])
  }

  const showRow = norm.length > 0 && allMatches.length > 0
  const showPaging = allMatches.length > PAGE_SIZE

  return (
    <div className="w-full">
      <label className="block w-full">
        <span className="sr-only">Pinyin search</span>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) =>
            setQuery(e.target.value.toLowerCase().replace(/\d/g, ''))
          }
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={[
            'w-full outline-none transition',
            variant === 'hero'
              ? 'min-h-[3.25rem] rounded-xl border border-taupe bg-parchment px-4 py-3 text-lg font-normal text-ink shadow-sm placeholder:text-espresso/55 focus:border-clay focus:ring-2 focus:ring-clay/25 sm:min-h-[3.5rem] sm:text-xl'
              : 'border-0 border-b border-taupe bg-transparent py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-clay',
          ].join(' ')}
        />
      </label>

      {dictionaryLoading && norm ? (
        <p className="mt-2 border-b border-taupe pb-2.5 text-xs text-muted">Loading dictionary…</p>
      ) : null}

      {showRow && (
        <div
          className={[
            'mt-2 flex flex-wrap items-center gap-y-2 border-b border-taupe pb-2.5 text-ink',
            variant === 'hero' ? 'text-base sm:text-lg' : 'text-[15px]',
          ].join(' ')}
        >
          {showPaging && currentPage > 0 && (
            <button
              type="button"
              className="mr-2 shrink-0 rounded px-1.5 py-0.5 text-lg text-clay hover:bg-elevated"
              aria-label="Previous candidates"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              «
            </button>
          )}

          <div className="min-w-0 flex-1 leading-relaxed">
            {pageSlice.map((entry, i) => {
              const n = pageStart + i + 1
              return (
                <span key={`${entry.simplified}-${entry.pinyin}-${n}`}>
                  {i > 0 && (
                    <span aria-hidden className="whitespace-pre">
                      {'  '}
                    </span>
                  )}
                  <button
                    type="button"
                    className="inline text-left font-medium text-ink underline-offset-2 hover:underline"
                    onClick={() => commit(entry)}
                  >
                    <span className="font-normal text-espresso/75">{n}.</span>
                    {entry.simplified}
                  </button>
                </span>
              )
            })}
          </div>

          {showPaging && currentPage < totalPages - 1 && (
            <button
              type="button"
              className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-lg text-clay hover:bg-elevated"
              aria-label="Next candidates"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              »
            </button>
          )}
        </div>
      )}
    </div>
  )
}
