import { HSK_DATA } from './pinyinIme.js'
import { formatEnglishMeaningForDisplay } from './formatEnglishMeaning.js'

/** @typedef {{ simplified: string, english: string, pinyin: string, level: number }} HskRow */

/** @type {Map<string, HskRow> | null} */
let hskBySimplifiedCache = null

/** Call after HSK JSON is loaded (after preloadPinyinImeData from pinyinIme.js). */
export function resetMultipleChoiceQuizHskCache() {
  hskBySimplifiedCache = null
}

/** One row per simplified; keep earliest (lowest) HSK level. */
function buildHskIndex() {
  /** @type {Map<string, HskRow>} */
  const bySimp = new Map()
  for (let level = 1; level <= 6; level++) {
    const arr = HSK_DATA[level - 1]
    if (!Array.isArray(arr)) continue
    for (const raw of arr) {
      const simplified = String(raw?.simplified ?? '').trim()
      const english = String(raw?.english ?? '').trim()
      const pinyin = String(raw?.pinyin ?? '').trim()
      if (!simplified) continue
      const prev = bySimp.get(simplified)
      if (!prev || level < prev.level) {
        bySimp.set(simplified, { simplified, english, pinyin, level })
      }
    }
  }
  return bySimp
}

function getHskBySimplified() {
  if (hskBySimplifiedCache) return hskBySimplifiedCache
  hskBySimplifiedCache = buildHskIndex()
  return hskBySimplifiedCache
}

/** @param {string} simp */
function hskLevelForHeadword(simp) {
  const HSK_BY_SIMPLIFIED = getHskBySimplified()
  if (HSK_BY_SIMPLIFIED.has(simp)) return HSK_BY_SIMPLIFIED.get(simp).level
  let best = null
  for (const ch of simp) {
    if (HSK_BY_SIMPLIFIED.has(ch)) {
      const L = HSK_BY_SIMPLIFIED.get(ch).level
      best = best === null ? L : Math.min(best, L)
    }
  }
  return best ?? 3
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'and',
  'or',
  'of',
  'for',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'as',
  'be',
  'is',
  'are',
  'was',
  'were',
  'it',
  'its',
  'one',
  'some',
  'any',
])

export function hashString(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

function shuffleWithSeed(items, seed) {
  const a = [...items]
  let s = seed >>> 0
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Primary gloss before first `/`. */
function primaryGloss(english) {
  return String(english || '')
    .split('/')[0]
    .trim()
}

/** @returns {'verb' | 'noun' | 'skip'} */
function classifyPartOfSpeech(english) {
  const low = String(english || '').toLowerCase()
  if (low.includes('(idiom)')) return 'skip'
  const g = primaryGloss(english).toLowerCase()
  if (g.startsWith('to ')) return 'verb'
  return 'noun'
}

function wordCountFirstSense(english) {
  const first = primaryGloss(english).replace(/\([^)]*\)/g, ' ').trim()
  if (!first) return 1
  return first.split(/\s+/).filter(Boolean).length
}

/** @returns {'short' | 'medium' | 'long'} */
function lengthBucket(english) {
  const n = wordCountFirstSense(english)
  if (n <= 4) return 'short'
  if (n <= 9) return 'medium'
  return 'long'
}

function bucketsMatch(a, b) {
  if (a === b) return true
  const order = ['short', 'medium', 'long']
  const ia = order.indexOf(a)
  const ib = order.indexOf(b)
  return Math.abs(ia - ib) <= 1
}

/** Tokens from correct gloss to ban as substrings in distractor English. */
function banTokensFromCorrect(correctEnglish) {
  const raw = String(correctEnglish || '').toLowerCase()
  const parts = raw.split(/[/;,\s.()]+/)
  const out = []
  for (const p of parts) {
    const t = p.replace(/[^a-z']/g, '')
    if (t.length >= 3 && !STOPWORDS.has(t)) out.push(t)
  }
  return [...new Set(out)]
}

function englishViolatesBan(distractorEnglish, banTokens) {
  const low = String(distractorEnglish || '').toLowerCase()
  for (const t of banTokens) {
    if (low.includes(t)) return true
  }
  return false
}

/**
 * @param {string} entryChar
 * @param {string} correctMeaning
 * @param {number} round
 * @param {boolean} isReverse
 * @param {{ poolRows?: { simplified: string, english: string, pinyin: string }[] }} [options] — when `poolRows` is non-empty, distractors are chosen only from that list (e.g. one HSK JSON list).
 * @returns {{ isReverse: boolean, choices: string[], correctIndex: number, clueText: string }}
 */
export function buildQuestion(entryChar, correctMeaning, round, isReverse, options = {}) {
  const char = String(entryChar || '').trim() || '欢迎'
  const correct = String(correctMeaning || '').trim() || '—'
  const seed = hashString(`${char}\0${correct}\0${round}\0${isReverse ? 'r' : 'f'}`)

  const fixedPool =
    Array.isArray(options.poolRows) && options.poolRows.length > 0 ? options.poolRows : null

  const centerLevel = hskLevelForHeadword(char)
  const banTokens = banTokensFromCorrect(correct)
  const rawPos = classifyPartOfSpeech(correct)
  const pos = rawPos === 'skip' ? 'noun' : rawPos
  const lenB = lengthBucket(correct)

  const rows = fixedPool ?? [...getHskBySimplified().values()]

  /** @param {number} bandW 1 = adjacent levels only */
  function poolFor(bandW) {
    if (fixedPool) return fixedPool
    const lo = Math.max(1, centerLevel - bandW)
    const hi = Math.min(6, centerLevel + bandW)
    return rows.filter((r) => r.level >= lo && r.level <= hi)
  }

  function tryPick(pool, relaxPos, relaxLen) {
    const distractors = []
    const posOk = (r) => {
      const p = classifyPartOfSpeech(r.english)
      if (p === 'skip') return false
      if (relaxPos) return true
      return p === pos
    }
    const lenOk = (r) => {
      if (relaxLen) return true
      return bucketsMatch(lengthBucket(r.english), lenB)
    }

    const shuffled = shuffleWithSeed(pool, seed ^ 0x9e3779b9)
    for (const r of shuffled) {
      if (distractors.length >= 3) break
      if (r.simplified === char) continue
      if (!posOk(r)) continue
      if (!lenOk(r)) continue
      if (englishViolatesBan(r.english, banTokens)) continue
      const t = r.english.trim()
      if (!t || t.toLowerCase() === correct.toLowerCase()) continue
      if (isReverse) {
        if (Math.abs(r.simplified.length - char.length) > 1) continue
      }
      const label = isReverse ? r.simplified : formatEnglishMeaningForDisplay(r.simplified, t)
      if (distractors.some((d) => d.toLowerCase() === label.toLowerCase())) continue
      distractors.push(label)
    }
    return distractors
  }

  let bandW = 1
  let relaxLen = false
  let relaxPos = false
  let pool = poolFor(bandW)
  let distractors = tryPick(pool, relaxPos, relaxLen)

  const attempts = [
    () => {
      relaxLen = true
    },
    () => {
      relaxPos = true
    },
    () => {
      relaxLen = false
      relaxPos = true
    },
    () => {
      if (!fixedPool) {
        bandW = Math.min(3, bandW + 1)
        pool = poolFor(bandW)
      }
      relaxLen = false
      relaxPos = false
    },
    () => {
      relaxLen = true
    },
    () => {
      relaxPos = true
    },
  ]

  let step = 0
  while (distractors.length < 3 && step < attempts.length) {
    attempts[step]()
    step += 1
    distractors = tryPick(pool, relaxPos, relaxLen)
  }

  if (distractors.length < 3) {
    const wide = shuffleWithSeed(rows.filter((r) => r.simplified !== char), seed + 99)
    for (const r of wide) {
      if (classifyPartOfSpeech(r.english) === 'skip') continue
      if (englishViolatesBan(r.english, banTokens)) continue
      const label = isReverse ? r.simplified : formatEnglishMeaningForDisplay(r.simplified, r.english.trim())
      if (!label || distractors.some((d) => d.toLowerCase() === label.toLowerCase()) || label === char) continue
      distractors.push(label)
      if (distractors.length >= 3) break
    }
  }

  let guard = 0
  const padHan = ['工', '门', '天', '心', '手', '口', '文', '月', '水', '火']
  while (distractors.length < 3 && guard < 40) {
    const h = padHan[guard % padHan.length]
    guard += 1
    if (isReverse) {
      if (h !== char && !distractors.includes(h)) distractors.push(h)
    } else {
      const filler =
        pos === 'verb'
          ? ['to wait; to await', 'to speak; to say', 'to look; to watch', 'to listen'][guard % 4]
          : ['size; scale', 'direction; way', 'method; means', 'result; outcome'][guard % 4]
      const fDisp = formatEnglishMeaningForDisplay('', filler)
      if (!englishViolatesBan(filler, banTokens) && !distractors.some((d) => d.toLowerCase() === fDisp.toLowerCase())) {
        distractors.push(fDisp)
      }
    }
  }

  const correctLabel = isReverse ? char : formatEnglishMeaningForDisplay(char, correct)
  const combined = shuffleWithSeed([correctLabel, ...distractors.slice(0, 3)], seed)
  const correctIndex = combined.findIndex((c) => c === correctLabel)

  return {
    isReverse,
    choices: combined,
    correctIndex: correctIndex === -1 ? 0 : correctIndex,
    clueText: isReverse ? formatEnglishMeaningForDisplay(char, correct) : '',
  }
}
