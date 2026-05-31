import { getTopMistakes, detectStrugglePattern, MISTAKE_LABELS } from './mistakeAnalyzer.js'

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 */
export function buildWeaknessProfile(state) {
  if (!state) return ''

  const topMistakes = getTopMistakes(state.mistakeLog).slice(0, 3)
  const struggle = detectStrugglePattern(state.mistakeLog)

  const shakyPatterns = Object.values(state.patternMastery || {})
    .filter((p) => p.status === 'practicing' && p.attempts >= 2)
    .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)
    .slice(0, 2)

  const coldVocab = Object.entries(state.vocabulary || {})
    .filter(([, v]) => v.mastery === 'cold')
    .slice(0, 3)
    .map(([hanzi]) => hanzi)

  /** @type {string[]} */
  const fragments = []

  if (topMistakes.length > 0) {
    const issues = topMistakes
      .map((m) => `${MISTAKE_LABELS[m.type] || m.type} (×${m.count})`)
      .join(', ')
    fragments.push(`Common recent issues: ${issues}.`)
  }

  if (struggle) {
    const label = MISTAKE_LABELS[struggle] || struggle
    fragments.push(
      `IMPORTANT: The student has struggled with ${label} in the last 2-3 turns. ` +
        `Engineer this turn to naturally require getting it right.`,
    )
  }

  if (shakyPatterns.length > 0) {
    const patterns = shakyPatterns.map((p) => p.label || p.patternId).join(', ')
    fragments.push(
      `Patterns being practiced (not yet mastered): ${patterns}. Use these in this turn if natural.`,
    )
  }

  if (coldVocab.length > 0) {
    fragments.push(`Cold vocabulary to recycle if context fits: ${coldVocab.join(', ')}.`)
  }

  if (fragments.length === 0) return ''

  return `

ADAPTIVE TEACHING PROFILE:
${fragments.join('\n')}`
}
