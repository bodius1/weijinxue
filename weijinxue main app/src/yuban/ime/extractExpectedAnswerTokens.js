import { extractHanziRuns } from './extractHanzi.js'

const QUOTED_HANZI =
  /["""「『']([^"""」』'"]*[\u4e00-\u9fff][^"""」』'"]*)["""」』']/gu

/**
 * Pull short answer tokens from hint / task text (e.g. 要, 不要).
 * @param {string} [expectedHint]
 * @param {string} [productionPrompt]
 * @returns {string[]}
 */
export function extractExpectedAnswerTokens(expectedHint = '', productionPrompt = '') {
  /** @type {Set<string>} */
  const tokens = new Set()
  const hint = String(expectedHint ?? '')
  const prompt = String(productionPrompt ?? '')

  for (const text of [hint, prompt]) {
    for (const m of text.matchAll(QUOTED_HANZI)) {
      for (const run of extractHanziRuns(m[1])) {
        if (run.length <= 12) tokens.add(run)
      }
    }

    for (const part of text.split(/[/／|,，、]/)) {
      const trimmed = part.trim()
      if (!trimmed) continue
      for (const run of extractHanziRuns(trimmed)) {
        if (run.length <= 12 && /[\u4e00-\u9fff]/.test(trimmed)) tokens.add(run)
      }
    }

    for (const run of extractHanziRuns(text)) {
      if (run.length <= 6) tokens.add(run)
    }
  }

  return [...tokens].sort((a, b) => a.length - b.length)
}
