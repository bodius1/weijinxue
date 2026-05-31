import { normalizeGradingResponse } from '../conversation/gradingSchema.js'

const CACHE_KEY = 'yuban_grade_cache_v1'
const MAX_ENTRIES = 100
const TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @param {Record<string, unknown>} payload
 */
function hashKey(payload) {
  const s = JSON.stringify(payload)
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return String(h)
}

/**
 * @returns {{ entries: Array<{ key: string, at: number, grade: unknown }> }}
 */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { entries: [] }
    const parsed = JSON.parse(raw)
    return { entries: Array.isArray(parsed?.entries) ? parsed.entries : [] }
  } catch {
    return { entries: [] }
  }
}

/**
 * @param {{ entries: Array<{ key: string, at: number, grade: unknown }> }} data
 */
function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {{
 *   npcLine: string,
 *   taskType?: string,
 *   expectedPatternHint?: string,
 *   studentReply: string,
 *   hskLevel: number,
 * }} input
 */
export function buildGradeCacheKey(input) {
  return hashKey({
    npcLine: input.npcLine,
    taskType: input.taskType ?? '',
    expectedPatternHint: input.expectedPatternHint ?? '',
    studentReply: input.studentReply,
    hskLevel: input.hskLevel,
  })
}

/**
 * @param {string} key
 * @param {string} studentReply
 */
export function getCachedGrade(key, studentReply) {
  const now = Date.now()
  const { entries } = readCache()
  const hit = entries.find((e) => e.key === key && now - e.at < TTL_MS)
  if (!hit?.grade) return null
  try {
    return normalizeGradingResponse(hit.grade, { studentReply })
  } catch {
    return null
  }
}

/**
 * @param {string} key
 * @param {unknown} gradeSerializable
 */
export function setCachedGrade(key, gradeSerializable) {
  const now = Date.now()
  let { entries } = readCache()
  entries = entries.filter((e) => now - e.at < TTL_MS && e.key !== key)
  entries.unshift({ key, at: now, grade: gradeSerializable })
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES)
  writeCache({ entries })
}

/** Clear cache (tests). */
export function clearGradeCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}
