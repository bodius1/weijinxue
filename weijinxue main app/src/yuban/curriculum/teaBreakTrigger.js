import { detectStrugglePattern, MISTAKE_LABELS } from './mistakeAnalyzer.js'
import { parseAIJson } from '../conversation/parseAIResponse.js'

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 */
export function shouldShowTeaBreak(state) {
  if (!state) return null

  const shown = state.teaBreaksShown || []
  const lastTeaBreakAt = shown[shown.length - 1]?.ts || 0
  const minSpacing = 1000 * 60 * 3

  if (Date.now() - lastTeaBreakAt < minSpacing) return null

  const struggle = detectStrugglePattern(state.mistakeLog)
  if (struggle) {
    const recentlyShown = shown.slice(-3).some((b) => b.topic === `struggle_${struggle}`)
    if (!recentlyShown) {
      return {
        topic: `struggle_${struggle}`,
        reason: 'struggle',
        focus: MISTAKE_LABELS[struggle] || struggle,
      }
    }
  }

  const justMastered = Object.values(state.patternMastery || {}).find(
    (p) => p.status === 'mastered' && p.lastSeen > Date.now() - 60000,
  )
  if (justMastered) {
    const recentlyShown = shown
      .slice(-3)
      .some((b) => b.topic === `mastered_${justMastered.patternId}`)
    if (!recentlyShown) {
      return {
        topic: `mastered_${justMastered.patternId}`,
        reason: 'mastery',
        focus: justMastered.label || justMastered.patternId,
      }
    }
  }

  const sessions = state.sessionsCompleted || 0
  if (sessions > 0 && sessions % 8 === 0) {
    const recentlyShown = shown.slice(-1).some((b) => b.topic === `cultural_${sessions}`)
    if (!recentlyShown) {
      return {
        topic: `cultural_${sessions}`,
        reason: 'milestone',
        focus: 'cultural insight',
      }
    }
  }

  return null
}

/**
 * @param {(systemPrompt: string, userMessage: string) => Promise<string>} callAI
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 * @param {{ topic: string, reason: string, focus: string }} trigger
 */
export async function generateTeaBreak(callAI, state, trigger) {
  const prompt = `You are Yǔbàn. Generate a SHORT cultural or pedagogical insight called a "Tea Break" for a Chinese learner.

Student context:
- HSK level: ${state?.hskLevel ?? 1}
- City: ${state?.city ?? ''}
- Trigger reason: ${trigger.reason}
- Focus: ${trigger.focus}

If reason is "struggle": briefly explain the concept they're missing with one clear example. Don't lecture — 3-4 sentences max.

If reason is "mastery": celebrate the pattern they just mastered and hint at what comes next. Keep it warm and encouraging.

If reason is "milestone": share a small piece of Chinese culture, language history, or usage tip relevant to their current city.

Return ONLY valid JSON:
{
  "title": "Short title, 2-5 words",
  "body": "The insight itself, 3-5 sentences max. Plain prose."
}`

  const raw = await callAI(prompt, 'Generate the tea break.')
  const parsed = parseAIJson(raw)
  return {
    title: String(parsed.title ?? 'Tea Break'),
    body: String(parsed.body ?? ''),
  }
}
