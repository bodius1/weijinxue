/** Local calendar date as YYYY-MM-DD (browser timezone). */
export function localTodayYMD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @param {string} ymd */
export function parseYMD(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Positive if a > b chronologically (a is later day). @param {string} a @param {string} b */
export function compareYMD(a, b) {
  if (a === b) return 0
  return a > b ? 1 : -1
}

/**
 * Whole-day difference from `fromYmd` to `toYmd` (local midnight to midnight).
 * @param {string} fromYmd
 * @param {string} toYmd
 */
export function ymdDiffDays(fromYmd, toYmd) {
  const a = parseYMD(fromYmd)
  const b = parseYMD(toYmd)
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

/** @param {string} ymd */
export function ymdAddDays(ymd, deltaDays) {
  const d = parseYMD(ymd)
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Days in year with at least one activity counter > 0.
 * @param {Record<string, { cardsStudied?: number, flashcardsRated?: number, reviews?: number, quizAnswered?: number, typedCharacters?: number, typeSessions?: number, studySeconds?: number }>} dayMap
 * @param {number} year
 */
export function activeDaysInYear(dayMap, year) {
  const prefix = `${year}-`
  let n = 0
  for (const key of Object.keys(dayMap)) {
    if (!key.startsWith(prefix)) continue
    const v = dayMap[key]
    const sum =
      (v.reviews ?? 0) +
      (v.flashcardsRated ?? v.cardsStudied ?? 0) +
      (v.quizAnswered ?? 0) +
      (v.typedCharacters ?? 0) +
      (v.typeSessions ?? 0) +
      (v.studySeconds ?? 0)
    if (sum > 0) n += 1
  }
  return n
}

/** @param {number} year */
export function daysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365
}
