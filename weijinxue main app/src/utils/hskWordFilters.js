/**
 * Exclude HSK rows from TypeTab / QuizTab active pools only (source JSON unchanged).
 * - Grammar frames with "……" slots are not typable in the character IME.
 * - Very long headwords (>6 Unicode chars) are too complex for these modes.
 * @param {unknown} simplified
 */
export function isExcludedFromHskTypingPool(simplified) {
  const s = String(simplified ?? '').trim()
  if (!s) return true
  if (s.includes('……')) return true
  if (Array.from(s).length > 6) return true
  return false
}
