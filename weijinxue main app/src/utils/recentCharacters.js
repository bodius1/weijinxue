const STORAGE_KEY = 'huaxue-recent-chars'
const MAX = 24

const FALLBACK_DISTRACTORS = [
  '的',
  '一',
  '是',
  '不',
  '我',
  '有',
  '人',
  '这',
  '来',
  '去',
  '好',
  '大',
  '小',
  '中',
]

/**
 * @typedef {{ char: string, pinyin: string }} RecentChar
 */

/** @returns {RecentChar[]} */
export function readRecentCharacters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => x?.char) : []
  } catch {
    return []
  }
}

/** @param {RecentChar[]} list */
function writeRecent(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* ignore */
  }
}

/**
 * Record a viewed character (simplified form from search).
 * @param {string} char
 * @param {string} pinyin
 */
export function pushRecentCharacter(char, pinyin) {
  if (!char || typeof char !== 'string') return
  const prev = readRecentCharacters().filter((x) => x.char !== char)
  prev.unshift({ char, pinyin: pinyin || '' })
  writeRecent(prev)
}

/**
 * Three wrong options: prefer recent entries (any length) !== exclude,
 * then fill with common single characters.
 * @param {string} exclude
 * @returns {string[]}
 */
export function pickWrongOptions(exclude) {
  const seen = new Set([exclude])
  const out = []
  for (const { char } of readRecentCharacters()) {
    if (!char || seen.has(char)) continue
    if (!/^[\u4e00-\u9fff]+$/u.test(char)) continue
    seen.add(char)
    out.push(char)
    if (out.length >= 3) break
  }
  for (const c of FALLBACK_DISTRACTORS) {
    if (out.length >= 3) break
    if (!seen.has(c)) {
      seen.add(c)
      out.push(c)
    }
  }
  return out.slice(0, 3)
}
