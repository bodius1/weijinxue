/** @typedef {{ [sentenceId: string]: number }} SentencesSeenLog */

export const SENTENCES_SEEN_LOG_KEY = 'sentences_seen_log'

const MS_PER_DAY = 86_400_000

/** Stable id for a sentence row (shared across HSK levels). */
export function getSentenceId(/** @type {unknown} */ row) {
  return String(row?.chinese ?? row?.zh ?? row?.sentence ?? '').trim()
}

/** @returns {SentencesSeenLog | null} null if localStorage unavailable */
export function readSentencesSeenLog() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(SENTENCES_SEEN_LOG_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    /** @type {SentencesSeenLog} */
    const out = {}
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v)
      if (k && Number.isFinite(n) && n > 0) out[k] = n
    }
    return out
  } catch {
    return null
  }
}

/**
 * Weight for deck ordering: unseen = 1; seen recently → low; ramps to 1 over 24h.
 * @param {number | undefined} lastSeenTimestamp
 * @param {number} [now]
 */
export function sentenceSeenWeight(lastSeenTimestamp, now = Date.now()) {
  if (lastSeenTimestamp == null || !Number.isFinite(lastSeenTimestamp)) return 1
  const elapsed = Math.max(0, now - lastSeenTimestamp)
  return Math.min(1, elapsed / MS_PER_DAY)
}

function plainShuffle(/** @type {T[]} */ arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Weighted random order without replacement (higher weight = more likely early).
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} getWeight
 */
export function weightedShuffleWithoutReplacement(items, getWeight) {
  const pool = [...items]
  /** @type {T[]} */
  const result = []
  while (pool.length > 0) {
    let total = 0
    const weights = pool.map((item) => {
      const w = getWeight(item)
      const safe = Number.isFinite(w) && w > 0 ? w : 0
      total += safe
      return safe
    })
    if (total <= 0) {
      result.push(...plainShuffle(pool))
      break
    }
    let r = Math.random() * total
    let pick = pool.length - 1
    for (let i = 0; i < pool.length; i += 1) {
      r -= weights[i]
      if (r <= 0) {
        pick = i
        break
      }
    }
    result.push(pool.splice(pick, 1)[0])
  }
  return result
}

/**
 * Build practice deck: deprioritize recently seen sentences when localStorage works.
 * @template T
 * @param {T[]} rows
 */
export function shuffleSentenceDeck(rows) {
  const pool = Array.isArray(rows) ? rows.filter(Boolean) : []
  if (pool.length <= 1) return [...pool]

  const log = readSentencesSeenLog()
  if (!log) return plainShuffle(pool)

  const now = Date.now()
  return weightedShuffleWithoutReplacement(pool, (row) => {
    const id = getSentenceId(row)
    if (!id) return 1
    return sentenceSeenWeight(log[id], now)
  })
}

/** Record that the user was shown this sentence. */
export function markSentenceSeen(/** @type {unknown} */ row) {
  const id = getSentenceId(row)
  if (!id) return
  try {
    if (typeof localStorage === 'undefined') return
    const log = readSentencesSeenLog() ?? {}
    log[id] = Date.now()
    localStorage.setItem(SENTENCES_SEEN_LOG_KEY, JSON.stringify(log))
  } catch {
    // silent fallback
  }
}
