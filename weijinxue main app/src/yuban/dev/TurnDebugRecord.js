/**
 * @typedef {object} VoicesGradeSnapshot
 * @property {string | null} prompt
 * @property {string | null} raw
 * @property {unknown | null} parsed
 * @property {unknown | null} normalized
 * @property {number | null} durationMs
 * @property {number | null} timestamp
 */

/**
 * In-memory debug snapshot for one story turn (never persisted to Firestore).
 * @typedef {object} TurnDebugRecord
 * @property {string | null} beatPrompt
 * @property {string | null} beatRaw
 * @property {unknown | null} beatParsed
 * @property {number | null} beatStartedAt
 * @property {number | null} beatDurationMs
 * @property {string | null} voicesPrompt
 * @property {string | null} frozenVoicesPrompt
 * @property {string | null} voicesRaw
 * @property {unknown | null} voicesParsed
 * @property {unknown | null} voicesNormalized
 * @property {number | null} voicesStartedAt
 * @property {number | null} voicesDurationMs
 * @property {number | null} voicesGradedAt
 * @property {number | null} voicesReplayAt
 * @property {string | null} voicesReplayError
 * @property {string | null} studentReplyRaw
 * @property {string | null} confidenceLevel
 * @property {string | null} weaknessProfileSnapshot
 * @property {string | null} learnerProfileSnapshot
 * @property {VoicesGradeSnapshot | null} originalVoices
 * @property {import('./storyBeatTiming.js').ReturnType<import('./storyBeatTiming.js').finalizeStoryBeatTiming> | null} storyBeatTiming
 * @property {'local_grader' | 'cache' | 'llm' | null} gradingSource
 * @property {number | null} tokensSavedEstimate
 * @property {'local_template' | 'llm' | 'local_fallback_guard' | null} storyBeatSource
 * @property {number | null} promptCharCount
 */

/** @returns {TurnDebugRecord} */
export function createEmptyTurnDebugRecord() {
  return {
    beatPrompt: null,
    beatRaw: null,
    beatParsed: null,
    beatStartedAt: null,
    beatDurationMs: null,
    voicesPrompt: null,
    frozenVoicesPrompt: null,
    voicesRaw: null,
    voicesParsed: null,
    voicesNormalized: null,
    voicesStartedAt: null,
    voicesDurationMs: null,
    voicesGradedAt: null,
    voicesReplayAt: null,
    voicesReplayError: null,
    studentReplyRaw: null,
    confidenceLevel: null,
    weaknessProfileSnapshot: null,
    learnerProfileSnapshot: null,
    originalVoices: null,
    storyBeatTiming: null,
    gradingSource: null,
    tokensSavedEstimate: null,
    storyBeatSource: null,
    promptCharCount: null,
  }
}

/**
 * @param {import('./TurnDebugRecord.js').TurnDebugRecord} d
 * @returns {import('./TurnDebugRecord.js').VoicesGradeSnapshot}
 */
export function snapshotCurrentVoicesGrade(d) {
  return {
    prompt: d.voicesPrompt,
    raw: d.voicesRaw,
    parsed: d.voicesParsed,
    normalized: d.voicesNormalized,
    durationMs: d.voicesDurationMs,
    timestamp: d.voicesGradedAt ?? Date.now(),
  }
}
