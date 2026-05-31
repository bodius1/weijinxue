import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildPinyinPrefixIndex,
  digitKeyToSlot,
  lookupFromIndex,
  normalizeQuery,
  preloadPinyinImeData,
} from '../utils/pinyinIme.js'
import { rankYubanCandidates } from '../yuban/ime/rankYubanCandidates.js'
import {
  buildPhraseCandidates,
  splitDisplayCandidates,
} from '../yuban/ime/yubanPhraseCandidates.js'

/** Western keys → fullwidth Chinese punctuation for learner replies. */
const PUNCT_FROM_ASCII = {
  ',': '，',
  '.': '。',
  '!': '！',
  '?': '？',
  ':': '：',
  ';': '；',
}

/** Already-Chinese punctuation (and common pairs) append directly. */
const DIRECT_PUNCT_RE = /[，。！？、：；「」『』（）…—～]/

/**
 * @param {string} key
 * @returns {string | null}
 */
function punctuationToInsert(key) {
  if (Object.hasOwn(PUNCT_FROM_ASCII, key)) return PUNCT_FROM_ASCII[key]
  if (key.length === 1 && DIRECT_PUNCT_RE.test(key)) return key
  return null
}

/**
 * Freeform pinyin IME (same behavior as Type tab / Yǔbàn classic chat).
 * Type letters → candidates; 1–4 / Space to select; selected hanzi accumulates in composedHanzi.
 *
 * @param {{
 *   enabled?: boolean,
 *   resetKey?: number,
 *   hskLevel?: number,
 *   imeContext?: import('../yuban/ime/yubanImeContext.js').ReturnType<import('../yuban/ime/yubanImeContext.js').buildYubanImeContext> | null,
 *   onEnter?: () => void,
 * }} [options]
 */
export function usePinyinIME({ enabled = true, resetKey = 0, hskLevel, imeContext = null, onEnter } = {}) {
  const [composedHanzi, setComposedHanzi] = useState('')
  const [imeInput, setImeInput] = useState('')
  const [candidatesExpanded, setCandidatesExpanded] = useState(false)
  const [indexReady, setIndexReady] = useState(false)
  const [pinyinIndex, setPinyinIndex] = useState(
    /** @type {ReturnType<typeof buildPinyinPrefixIndex> | null} */ (null),
  )

  const candidatesRef = useRef(/** @type {{ simplified: string, pinyin: string, english: string[] }[]} */ ([]))
  const candidatesExpandedRef = useRef(false)
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const onEnterRef = useRef(onEnter)

  useEffect(() => {
    onEnterRef.current = onEnter
  }, [onEnter])

  useEffect(() => {
    setComposedHanzi('')
    setImeInput('')
    setCandidatesExpanded(false)
  }, [resetKey])

  useEffect(() => {
    let cancelled = false
    const id = window.setTimeout(() => {
      preloadPinyinImeData()
        .then(() => {
          if (cancelled) return
          const idx = buildPinyinPrefixIndex()
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

  const queryNorm = useMemo(() => normalizeQuery(imeInput), [imeInput])

  const queryForRank = useMemo(() => queryNorm.replace(/\s+/g, ''), [queryNorm])

  const candidates = useMemo(() => {
    if (!indexReady || !pinyinIndex || !queryForRank) return []
    const raw = lookupFromIndex(pinyinIndex, queryForRank, undefined, undefined, undefined, hskLevel)
    return rankYubanCandidates(raw, queryForRank, imeContext)
  }, [queryForRank, indexReady, pinyinIndex, hskLevel, imeContext])

  const { mainCandidates, phraseCandidates } = useMemo(() => {
    if (!queryForRank) {
      return { mainCandidates: [], phraseCandidates: [] }
    }
    const phrases = buildPhraseCandidates(queryForRank, imeContext, hskLevel ?? 1)
    return splitDisplayCandidates(candidates, phrases, queryForRank)
  }, [candidates, queryForRank, imeContext, hskLevel])

  const displayList = mainCandidates.length ? mainCandidates : candidates

  const phraseCandidatesRef = useRef(/** @type {import('../yuban/ime/yubanPhraseCandidates.js').PhraseCandidate[]} */ ([]))

  useEffect(() => {
    candidatesRef.current = displayList.length ? displayList : candidates
  }, [displayList, candidates])

  useEffect(() => {
    phraseCandidatesRef.current = phraseCandidates
  }, [phraseCandidates])

  useEffect(() => {
    candidatesExpandedRef.current = candidatesExpanded
  }, [candidatesExpanded])
  const visibleLimit = candidatesExpanded ? Math.min(9, displayList.length) : Math.min(4, displayList.length)
  const visibleCandidates = displayList.slice(0, visibleLimit)
  const canExpandCandidates = displayList.length > 4

  const trySelectPhrase = useCallback((hanzi) => {
    const text = String(hanzi ?? '').trim()
    if (!text) return
    setComposedHanzi((s) => s + text)
    setImeInput('')
    setCandidatesExpanded(false)
  }, [])

  const reset = useCallback(() => {
    setComposedHanzi('')
    setImeInput('')
    setCandidatesExpanded(false)
  }, [])

  const trySelectSlot = useCallback((slotOnPage) => {
    const list = candidatesRef.current
    const maxSlot = candidatesExpandedRef.current
      ? Math.min(8, list.length - 1)
      : Math.min(3, list.length - 1)
    if (slotOnPage < 0 || slotOnPage > maxSlot) return
    const entry = list[slotOnPage]
    if (!entry) return
    setComposedHanzi((s) => s + entry.simplified)
    setImeInput('')
    setCandidatesExpanded(false)
  }, [])

  const hasPendingPinyin = imeInput.trim().length > 0

  const getHanziForSubmit = useCallback(() => {
    const text = composedHanzi.trim()
    if (!text) return { ok: false, text: '', reason: 'empty' }
    if (hasPendingPinyin) return { ok: false, text: '', reason: 'pending_pinyin' }
    return { ok: true, text, reason: null }
  }, [composedHanzi, hasPendingPinyin])

  const isActiveTarget = useCallback(() => {
    const root = rootRef.current
    if (!root) return false
    const active = document.activeElement
    if (!active) return false
    return root === active || root.contains(active)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!isActiveTarget()) return

      const target = /** @type {HTMLElement | null} */ (e.target)
      if (target?.closest('[data-pinyin-ime-skip-keys]')) return

      const { key, code } = e

      if (key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onEnterRef.current?.()
        return
      }

      if (key === 'Backspace') {
        e.preventDefault()
        setImeInput((s) => {
          if (s.length > 0) return s.slice(0, -1)
          setComposedHanzi((h) => {
            if (!h.length) return h
            const arr = [...h]
            arr.pop()
            return arr.join('')
          })
          return s
        })
        return
      }

      if (key === 'Escape') {
        e.preventDefault()
        setImeInput('')
        setCandidatesExpanded(false)
        return
      }

      if (key === ' ') {
        const exactPhrase = phraseCandidatesRef.current.find(
          (p) => p.pinyinNorm === queryNorm.replace(/\s+/g, ''),
        )
        if (exactPhrase) {
          e.preventDefault()
          trySelectPhrase(exactPhrase.hanzi)
          return
        }
        if (candidatesRef.current.length > 0) {
          e.preventDefault()
          trySelectSlot(0)
        }
        return
      }

      const slot = digitKeyToSlot(key, code)
      if (slot >= 0 && slot <= 8) {
        if (slot >= 4 && !candidatesExpandedRef.current) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        trySelectSlot(slot)
        return
      }

      const punct = punctuationToInsert(key)
      if (punct) {
        e.preventDefault()
        setImeInput('')
        setComposedHanzi((s) => s + punct)
        return
      }

      if (key.length === 1 && /^[a-z]$/i.test(key)) {
        e.preventDefault()
        setImeInput((s) => s + key.toLowerCase())
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, isActiveTarget, trySelectSlot, trySelectPhrase, queryNorm])

  return {
    rootRef,
    composedHanzi,
    imeInput,
    queryNorm,
    indexReady,
    candidates,
    mainCandidates,
    phraseCandidates,
    visibleCandidates,
    trySelectPhrase,
    candidatesExpanded,
    setCandidatesExpanded,
    canExpandCandidates,
    trySelectSlot,
    reset,
    getHanziForSubmit,
    hasPendingPinyin,
  }
}
