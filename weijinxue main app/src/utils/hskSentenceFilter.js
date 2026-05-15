/**
 * Runtime filter: Type tab → Sentences pool may only use vocabulary from HSK 1…N (cumulative).
 * Rows are not removed from JSON; filtering happens when building the deck.
 */

/**
 * @param {number} level HSK 1–6
 * @param {unknown[][]} hskArrays Six lists like {@link import('./pinyinIme.js').HSK_DATA} — index 0 = HSK 1
 * @returns {Set<string>}
 */
export function getCumulativeAllowedWords(level, hskArrays) {
  const allowed = new Set()
  const lv = Math.min(6, Math.max(1, Math.floor(Number(level)) || 1))
  for (let i = 0; i < lv; i += 1) {
    const words = Array.isArray(hskArrays?.[i]) ? hskArrays[i] : []
    for (const w of words) {
      const s = String(w?.simplified ?? '').trim()
      if (s) allowed.add(s)
    }
  }
  return allowed
}

/**
 * @param {unknown} row Sentence row with `chinese` (or `zh` / `sentence`)
 * @returns {string}
 */
export function getSentenceChineseText(row) {
  return String(row?.chinese ?? row?.zh ?? row?.sentence ?? '').trim()
}

/**
 * @param {unknown} row
 * @param {Set<string>} allowedWords from {@link getCumulativeAllowedWords}
 * @param {number} [level] for dev logging only
 */
export function isSentenceValid(row, allowedWords, level) {
  const text = getSentenceChineseText(row)
  if (!text) return false
  if (!allowedWords || allowedWords.size === 0) return true

  const sortedWords = Array.from(allowedWords).sort((a, b) => b.length - a.length)
  let remaining = text.replace(/[。！？!?，,、；;：:\s]/g, '')

  for (const word of sortedWords) {
    if (!word) continue
    remaining = remaining.split(word).join('')
  }

  const isValid = remaining.length === 0
  if (!isValid && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn('[HSK sentence filter] omitted:', {
      level,
      chinese: text,
      english: row?.english,
      unmatched: remaining,
    })
  }
  return isValid
}

/**
 * @param {unknown[]} rows
 * @param {number} level HSK 1–6
 * @param {unknown[][]} hskArrays same shape as {@link getCumulativeAllowedWords}
 */
export function filterRowsByHskVocabulary(rows, level, hskArrays) {
  const list = Array.isArray(rows) ? rows : []
  const allowed = getCumulativeAllowedWords(level, hskArrays)
  if (allowed.size === 0) {
    return list.filter((r) => r && getSentenceChineseText(r))
  }
  return list.filter((r) => r && getSentenceChineseText(r) && isSentenceValid(r, allowed, level))
}
