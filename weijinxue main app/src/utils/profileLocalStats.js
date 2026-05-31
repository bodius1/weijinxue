/**
 * Device-local aggregates for Profile HSK overview (flashcards + quiz touch).
 * TODO: merge cloud flashcard state if you add server-side deck sync.
 */

import { HSK_DATA } from './pinyinIme.js'
import { readLearnedCharacters } from './learnedCharacters.js'
import { readQuizSrMap } from './quizSpacedRepetition.js'

const FLASH_KEY = 'huaxue-hsk-flashcards-v1'

function readFlashStore() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(FLASH_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw)
    return p && typeof p === 'object' ? p : {}
  } catch {
    return {}
  }
}

function normalizeWord(w) {
  return {
    simplified: String(w?.simplified ?? '').trim(),
  }
}

/** @param {number} level 1-6 */
export function getHskFlashOverview(level) {
  const words = (HSK_DATA[level - 1] ?? []).map(normalizeWord).filter((w) => w.simplified)
  const seen = new Set()
  const list = words.filter((w) => {
    if (seen.has(w.simplified)) return false
    seen.add(w.simplified)
    return true
  })
  const store = readFlashStore()
  const map = store[level] ?? {}
  let mastered = 0
  let learning = 0
  let fresh = 0
  for (const w of list) {
    const r = map[w.simplified]?.rating ?? 0
    if (r >= 5) mastered += 1
    else if (r > 0) learning += 1
    else fresh += 1
  }
  const due = learning + fresh
  const quizMap = readQuizSrMap(level)
  const quizTouched = Object.keys(quizMap).length
  void quizTouched // TODO: surface in UI or merge into Due/New heuristics
  return {
    total: list.length,
    new: fresh,
    learning,
    due,
    mastered,
  }
}

export function getMasteredFromSavedWords() {
  return readLearnedCharacters().length
}

/** @returns {number[]} HSK levels 1–6 that have any quiz SR data */
export function getQuizTouchedLevels() {
  const out = []
  for (let L = 1; L <= 6; L += 1) {
    if (Object.keys(readQuizSrMap(L)).length > 0) out.push(L)
  }
  return out
}
