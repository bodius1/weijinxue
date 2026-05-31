import { buildThreeVoicesPrompt } from '../conversation/buildSystemPrompt.js'
import { buildLearnerContextForGrading } from '../conversation/buildGradingPrompt.js'
import { buildWeaknessProfile } from '../curriculum/weaknessProfile.js'
import { parseAIJson, validateThreeVoices } from '../conversation/parseAIResponse.js'
import { normalizeGradingResponse } from '../conversation/gradingSchema.js'
import { applyGradingOverrides } from '../conversation/gradingOverrides.js'
import { snapshotCurrentVoicesGrade } from './TurnDebugRecord.js'

/**
 * Rerun three-voices grading for dev inspector (does not persist to Firestore).
 *
 * @param {{
 *   state: import('../StoryStateContext.jsx').YubanStoryState,
 *   currentTurn: import('../conversation/turnTypes.js').StoryBeatTurn,
 *   debugRecord: import('./TurnDebugRecord.js').TurnDebugRecord,
 *   callAI: (systemPrompt: string, userMessage: string) => Promise<string>,
 *   useCapturedPrompt?: boolean,
 * }} params
 */
export async function replayVoicesGrade({
  state,
  currentTurn,
  debugRecord,
  callAI,
  useCapturedPrompt = false,
}) {
  const studentReply = String(debugRecord.studentReplyRaw ?? '').trim()
  if (!studentReply) {
    throw new Error('No student reply captured for replay')
  }

  const capturedPrompt =
    debugRecord.frozenVoicesPrompt ??
    debugRecord.originalVoices?.prompt ??
    debugRecord.voicesPrompt

  const voicesPrompt = useCapturedPrompt && capturedPrompt
    ? capturedPrompt
    : buildThreeVoicesPrompt(state, currentTurn, studentReply)

  const voicesStartedAt = Date.now()
  const raw = await callAI(voicesPrompt, `Student replied: ${studentReply}`)
  const parsed = parseAIJson(raw)
  validateThreeVoices(parsed)
  let normalized = normalizeGradingResponse(parsed, { studentReply })
  normalized = applyGradingOverrides(currentTurn, studentReply, normalized, state)

  const durationMs = Date.now() - voicesStartedAt
  const replayAt = Date.now()

  const originalVoices =
    debugRecord.originalVoices ??
    snapshotCurrentVoicesGrade({
      ...debugRecord,
      voicesGradedAt: debugRecord.voicesGradedAt ?? replayAt,
    })

  return {
    voicesPrompt,
    voicesRaw: raw,
    voicesParsed: parsed,
    voicesNormalized: normalized,
    voicesDurationMs: durationMs,
    voicesReplayAt: replayAt,
    voicesReplayError: null,
    originalVoices,
    learnerProfileSnapshot:
      debugRecord.learnerProfileSnapshot ?? buildLearnerContextForGrading(state),
    weaknessProfileSnapshot: debugRecord.weaknessProfileSnapshot ?? buildWeaknessProfile(state),
  }
}
