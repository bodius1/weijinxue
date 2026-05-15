import { hashString } from './multipleChoiceQuizCore.js'

/**
 * @typedef {{ interval: number, timesRight: number, timesWrong: number, nextShowAt: number }} QuizSrRecord
 */

/** @param {number} level 1–6 */
export function quizSrStorageKey(level) {
  return `quiz_sr_${level}`
}

/** @param {number} level 1–6 */
export function quizPosStorageKey(level) {
  return `quiz_pos_${level}`
}

/**
 * @param {number} level
 * @returns {Record<string, QuizSrRecord>}
 */
export function readQuizSrMap(level) {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(quizSrStorageKey(level))
    if (!raw) return {}
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {}
    /** @type {Record<string, QuizSrRecord>} */
    const out = {}
    for (const [k, v] of Object.entries(p)) {
      if (!k || typeof v !== 'object' || !v) continue
      const interval = Number(v.interval)
      const timesRight = Number(v.timesRight)
      const timesWrong = Number(v.timesWrong)
      const nextShowAt = Number(v.nextShowAt)
      if (!Number.isFinite(interval) || !Number.isFinite(nextShowAt)) continue
      out[k] = {
        interval: Math.max(1, Math.floor(interval)),
        timesRight: Number.isFinite(timesRight) ? Math.max(0, Math.floor(timesRight)) : 0,
        timesWrong: Number.isFinite(timesWrong) ? Math.max(0, Math.floor(timesWrong)) : 0,
        nextShowAt: Math.max(0, Math.floor(nextShowAt)),
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * @param {number} level
 * @param {Record<string, QuizSrRecord>} map
 */
export function writeQuizSrMap(level, map) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(quizSrStorageKey(level), JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
}

/** @param {number} level */
export function readQuizPosition(level) {
  if (typeof localStorage === 'undefined') return 0
  try {
    const raw = localStorage.getItem(quizPosStorageKey(level))
    if (raw == null || raw === '') return 0
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/**
 * @param {number} level
 * @param {number} position
 */
export function writeQuizPosition(level, position) {
  if (typeof localStorage === 'undefined') return
  try {
    const n = Math.max(0, Math.floor(position))
    localStorage.setItem(quizPosStorageKey(level), String(n))
  } catch {
    /* ignore */
  }
}

/** @param {number} level 1–6 */
export function clearQuizSrLevel(level) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(quizSrStorageKey(level))
    localStorage.removeItem(quizPosStorageKey(level))
  } catch {
    /* ignore */
  }
}

/**
 * @param {QuizSrRecord | undefined} rec
 */
export function nextShowAtForWord(rec) {
  return rec ? rec.nextShowAt : 0
}

/**
 * @template T
 * @param {T[]} list
 * @param {Record<string, QuizSrRecord>} srMap
 * @param {number} position
 * @param {string | null} excludeLastSimplified
 * @param {number} salt
 * @returns {T | null}
 */
export function pickQuizSrCard(list, srMap, position, excludeLastSimplified, salt) {
  if (!list.length) return null

  /** @type {{ w: T, ns: number }[]} */
  const due = []
  /** @type {T[]} */
  const notDue = []
  for (const w of list) {
    const ns = nextShowAtForWord(srMap[w.simplified])
    if (ns <= position) due.push({ w, ns })
    else notDue.push(w)
  }

  due.sort((a, b) => a.ns - b.ns)

  /** @type {T[]} */
  const pool = due.length
    ? due.slice(0, Math.min(3, due.length)).map((x) => x.w)
    : notDue.length
      ? notDue
      : [...list]

  if (!pool.length) return list[0]

  const filtered = pool.filter((w) => w.simplified !== excludeLastSimplified)
  const usePool = filtered.length ? filtered : pool
  const idx = Math.abs(hashString(`${salt}\0${usePool.map((p) => p.simplified).join('\0')}`)) % usePool.length
  return usePool[idx]
}

/**
 * STEP 4: CORRECT / WRONG / NEVER SEEN (no record yet).
 * First time a word is answered, only the NEVER SEEN bootstrap runs.
 *
 * @param {Record<string, QuizSrRecord>} srMap
 * @param {number} position
 * @param {string} simplified
 * @param {boolean} isCorrect
 * @returns {{ map: Record<string, QuizSrRecord>, newPosition: number }}
 */
export function applyQuizSrAnswer(srMap, position, simplified, isCorrect) {
  const map = { ...srMap }
  const existing = map[simplified]
  if (!existing) {
    void isCorrect
    map[simplified] = {
      interval: 1,
      timesRight: 0,
      timesWrong: 0,
      nextShowAt: position + 1,
    }
    return { map, newPosition: position + 1 }
  }

  if (isCorrect) {
    existing.timesRight += 1
    existing.interval = Math.min(existing.interval * 2, 50)
  } else {
    existing.timesWrong += 1
    existing.interval = Math.max(Math.floor(existing.interval / 2), 1)
  }
  existing.nextShowAt = position + existing.interval
  const newPosition = position + 1
  return { map, newPosition }
}

/**
 * @template T
 * @param {T[]} list
 * @param {Record<string, QuizSrRecord>} srMap
 * @param {number} position
 */
export function quizSrStats(list, srMap, position) {
  let due = 0
  let mastered = 0
  for (const w of list) {
    const rec = srMap[w.simplified]
    const ns = nextShowAtForWord(rec)
    if (ns <= position) due += 1
    if (rec && rec.interval >= 16) mastered += 1
  }
  const remaining = Math.max(0, list.length - mastered)
  return { due, mastered, remaining }
}
