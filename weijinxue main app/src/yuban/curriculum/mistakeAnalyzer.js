/** Human-readable labels for mistake types. */
export const MISTAKE_LABELS = {
  word_order: 'word order',
  missing_particle: 'missing particles (了, 的, etc.)',
  tone: 'tone marks',
  wrong_word: 'wrong word choice',
  pattern: 'grammar pattern usage',
  character_selection: 'wrong character picked',
  character_selection_mistake: 'wrong character picked',
  typo: 'typo / near-miss',
  off_task: 'off-task reply',
  too_advanced: 'above current level',
  wrong_intent: 'wrong intent',
}

/**
 * Returns the top N mistake types in the last `window` turns.
 * @param {Array<{ type?: string }>} mistakeLog
 * @param {{ window?: number, top?: number }} [opts]
 */
export function getTopMistakes(mistakeLog, { window = 20, top = 3 } = {}) {
  const recent = (mistakeLog || []).slice(-window)
  /** @type {Record<string, number>} */
  const counts = {}
  for (const m of recent) {
    const type = m?.type
    if (!type) continue
    counts[type] = (counts[type] || 0) + 1
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top)
}

/**
 * Same mistake type 2+ times in the last 3 turns.
 * @param {Array<{ type?: string }>} mistakeLog
 */
export function detectStrugglePattern(mistakeLog) {
  const lastThree = (mistakeLog || []).slice(-3)
  /** @type {Record<string, number>} */
  const counts = {}
  for (const m of lastThree) {
    const type = m?.type
    if (!type) continue
    counts[type] = (counts[type] || 0) + 1
  }
  for (const [type, count] of Object.entries(counts)) {
    if (count >= 2) return type
  }
  return null
}

/**
 * @param {Array<{ evaluation?: string }>} turnHistory
 * @returns {'improving' | 'stable' | 'struggling'}
 */
export function getTrend(turnHistory) {
  const recent = (turnHistory || []).slice(-6)
  if (recent.length < 3) return 'stable'

  const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
  const secondHalf = recent.slice(Math.floor(recent.length / 2))

  const firstAccuracy =
    firstHalf.filter((t) => t.evaluation === 'correct').length / firstHalf.length
  const secondAccuracy =
    secondHalf.filter((t) => t.evaluation === 'correct').length / secondHalf.length

  if (secondAccuracy > firstAccuracy + 0.15) return 'improving'
  if (secondAccuracy < firstAccuracy - 0.15) return 'struggling'
  return 'stable'
}

/**
 * @param {Array<{ confidence?: string, wasCorrect?: boolean }>} confidenceLog
 */
export function findOverconfidenceMoments(confidenceLog) {
  return (confidenceLog || [])
    .filter((c) => c.confidence === 'sure' && !c.wasCorrect)
    .slice(-5)
}
