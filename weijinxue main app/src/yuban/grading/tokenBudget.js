import { estimateTokenCount } from '../dev/storyBeatTiming.js'

const BUDGET_KEY = 'yuban_token_budget_v1'

/** @typedef {{
 *   llmCalls: number,
 *   estInputTokens: number,
 *   estOutputTokens: number,
 *   localGrades: number,
 *   cachedGrades: number,
 *   localStoryBeats: number,
 *   estTokensSaved: number,
 *   turnIndex: number,
 * }} TokenBudget
 */

/** @returns {TokenBudget} */
function defaultBudget() {
  return {
    llmCalls: 0,
    estInputTokens: 0,
    estOutputTokens: 0,
    localGrades: 0,
    cachedGrades: 0,
    localStoryBeats: 0,
    estTokensSaved: 0,
    turnIndex: 0,
  }
}

/** @returns {TokenBudget} */
export function readTokenBudget() {
  try {
    const raw = sessionStorage.getItem(BUDGET_KEY)
    if (!raw) return defaultBudget()
    return { ...defaultBudget(), ...JSON.parse(raw) }
  } catch {
    return defaultBudget()
  }
}

/**
 * @param {Partial<TokenBudget>} patch
 */
export function updateTokenBudget(patch) {
  const next = { ...readTokenBudget(), ...patch }
  try {
    sessionStorage.setItem(BUDGET_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/**
 * @param {{ inputChars?: number, outputChars?: number, savedChars?: number }} opts
 */
export function recordLlmUsage(opts) {
  const b = readTokenBudget()
  updateTokenBudget({
    llmCalls: b.llmCalls + 1,
    estInputTokens: b.estInputTokens + estimateTokenCount('x'.repeat(opts.inputChars ?? 0)),
    estOutputTokens: b.estOutputTokens + estimateTokenCount('x'.repeat(opts.outputChars ?? 0)),
  })
}

/**
 * @param {number} savedChars
 */
export function recordTokensSaved(savedChars) {
  const b = readTokenBudget()
  updateTokenBudget({
    estTokensSaved: b.estTokensSaved + estimateTokenCount('x'.repeat(savedChars)),
  })
}

export function resetTokenBudget() {
  try {
    sessionStorage.removeItem(BUDGET_KEY)
  } catch {
    /* ignore */
  }
}
