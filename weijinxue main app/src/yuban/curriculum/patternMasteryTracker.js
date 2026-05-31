/**
 * @param {string | undefined} hint
 */
function derivePatternId(hint) {
  if (!hint) return null
  const slug = hint
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return slug || null
}

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 * @param {(patch: object) => Promise<void>} updateState
 * @param {import('../conversation/turnTypes.js').StoryBeatTurn} turn
 * @param {import('../conversation/turnTypes.js').ThreeVoicesResponse} voicesResponse
 */
/**
 * @returns {Record<string, object> | null}
 */
export function buildPatternMasteryPatch(state, turn, voicesResponse) {
  const patternId = derivePatternId(turn.expectedPatternHint)
  if (!patternId || !state) return null

  const existing = state.patternMastery?.[patternId] || {
    patternId,
    label: turn.expectedPatternHint,
    attempts: 0,
    correct: 0,
    consecutiveCorrect: 0,
    status: /** @type {const} */ ('practicing'),
    lastSeen: 0,
  }

  const wasCorrect =
    voicesResponse.evaluation === 'correct' ||
    voicesResponse.recoveryApplied === true ||
    (voicesResponse.evaluation === 'almost' && voicesResponse.taskCompleted === true)

  const updated = {
    ...existing,
    label: existing.label || turn.expectedPatternHint,
    attempts: existing.attempts + 1,
    correct: existing.correct + (wasCorrect ? 1 : 0),
    consecutiveCorrect: wasCorrect ? existing.consecutiveCorrect + 1 : 0,
    lastSeen: Date.now(),
  }

  if (updated.consecutiveCorrect >= 3) {
    updated.status = 'mastered'
  } else if (updated.consecutiveCorrect >= 2 || updated.correct / updated.attempts > 0.7) {
    updated.status = 'almost'
  } else {
    updated.status = 'practicing'
  }

  return {
    ...(state.patternMastery || {}),
    [patternId]: updated,
  }
}

export async function updatePatternMastery(state, updateState, turn, voicesResponse) {
  const patch = buildPatternMasteryPatch(state, turn, voicesResponse)
  if (!patch) return
  await updateState({ patternMastery: patch })
}

export { derivePatternId }
