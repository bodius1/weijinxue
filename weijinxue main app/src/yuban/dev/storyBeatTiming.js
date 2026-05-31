/**
 * Story beat advance timing (dev diagnostics + lightweight production metrics).
 */

/** @typedef {keyof typeof PHASE_LABELS} StoryBeatPhaseKey */

const PHASE_LABELS = {
  continueButtonClicked: 'Continue clicked',
  loadLearnerProfileStart: 'Load learner profile (start)',
  loadLearnerProfileEnd: 'Load learner profile (end)',
  buildStoryPromptStart: 'Build story prompt (start)',
  buildStoryPromptEnd: 'Build story prompt (end)',
  modelCallStart: 'Model call (start)',
  modelCallEnd: 'Model call (end)',
  parseStoryBeatStart: 'Parse story beat (start)',
  parseStoryBeatEnd: 'Parse story beat (end)',
  storyCoherenceCheckStart: 'Coherence check (start)',
  storyCoherenceCheckEnd: 'Coherence check (end)',
  fallbackOrRetryStart: 'Fallback / retry (start)',
  fallbackOrRetryEnd: 'Fallback / retry (end)',
  firestoreWriteStart: 'Firestore write (start)',
  firestoreWriteEnd: 'Firestore write (end)',
  setReactStateStart: 'React state update (start)',
  setReactStateEnd: 'React state update (end)',
  productionGapVisible: 'Production gap visible',
}

/**
 * @typedef {object} StoryBeatTiming
 * @property {number} wallOrigin
 * @property {Record<string, number>} marks
 * @property {Record<string, unknown>} meta
 * @property {{
 *   attempt: number,
 *   provider?: string,
 *   model?: string,
 *   ms?: number,
 * }[]} modelCalls
 * @property {string | null} currentPhase
 * @property {boolean} fallbackUsed
 * @property {number} retryCount
 * @property {string | null} retryReason
 * @property {boolean} wasDevModeEnabled
 * @property {number | null} productionGapVisibleAt
 */

/** @returns {StoryBeatTiming} */
export function createStoryBeatTiming() {
  return {
    wallOrigin: Date.now(),
    marks: {},
    meta: {},
    modelCalls: [],
    currentPhase: null,
    fallbackUsed: false,
    retryCount: 0,
    retryReason: null,
    wasDevModeEnabled: true,
    productionGapVisibleAt: null,
  }
}

/**
 * @param {StoryBeatTiming | null | undefined} timing
 * @param {StoryBeatPhaseKey} phase
 * @param {Record<string, unknown>} [meta]
 */
export function markStoryBeatPhase(timing, phase, meta = {}) {
  if (!timing) return
  const now = Date.now()
  timing.marks[phase] = now
  timing.currentPhase = phase
  if (Object.keys(meta).length) {
    timing.meta[phase] = { ...(timing.meta[phase] ?? {}), ...meta }
  }
}

/**
 * @param {number} start
 * @param {number} end
 */
export function phaseDurationMs(start, end) {
  if (!start || !end) return 0
  return Math.max(0, end - start)
}

/**
 * Rough token estimate (~4 chars per token for English-heavy prompts).
 * @param {string} text
 */
export function estimateTokenCount(text) {
  const len = String(text ?? '').length
  return Math.ceil(len / 4)
}

/**
 * @param {StoryBeatTiming | null | undefined} timing
 */
export function finalizeStoryBeatTiming(timing) {
  if (!timing) return null

  const m = timing.marks
  const modelLatencyMs = timing.modelCalls.reduce((sum, c) => sum + (c.ms ?? 0), 0)
  const retryModelMs = timing.modelCalls.slice(1).reduce((sum, c) => sum + (c.ms ?? 0), 0)
  const firstModelMs = timing.modelCalls[0]?.ms ?? 0

  const promptBuildMs = phaseDurationMs(m.buildStoryPromptStart, m.buildStoryPromptEnd)
  const parseMs = phaseDurationMs(m.parseStoryBeatStart, m.parseStoryBeatEnd)
  const coherenceMs = phaseDurationMs(m.storyCoherenceCheckStart, m.storyCoherenceCheckEnd)
  const fallbackMs = phaseDurationMs(m.fallbackOrRetryStart, m.fallbackOrRetryEnd)
  const firestoreLatencyMs = phaseDurationMs(m.firestoreWriteStart, m.firestoreWriteEnd)
  const reactRenderMs = phaseDurationMs(m.setReactStateStart, m.setReactStateEnd)
  const profileMs = phaseDurationMs(m.loadLearnerProfileStart, m.loadLearnerProfileEnd)

  const continueAt = m.continueButtonClicked ?? timing.wallOrigin
  const visibleAt = timing.productionGapVisibleAt ?? m.productionGapVisible ?? null
  const totalContinueToVisibleMs = visibleAt ? visibleAt - continueAt : null

  const summary = {
    totalContinueToVisibleMs,
    totalWallMs: visibleAt ? visibleAt - timing.wallOrigin : Date.now() - timing.wallOrigin,
    modelLatencyMs,
    modelCall1Ms: firstModelMs,
    retryModelMs,
    firestoreLatencyMs,
    promptBuildMs,
    parseMs,
    coherenceMs,
    fallbackMs,
    reactRenderMs,
    profileMs,
    retryCount: timing.retryCount,
    fallbackUsed: timing.fallbackUsed,
    retryReason: timing.retryReason,
    wasDevModeEnabled: timing.wasDevModeEnabled,
    currentPhase: timing.currentPhase,
    promptCharCount: timing.meta.buildStoryPromptEnd?.charCount ?? null,
    promptTokenEstimate: timing.meta.buildStoryPromptEnd?.tokenEstimate ?? null,
    modelProvider: timing.modelCalls[0]?.provider ?? null,
    modelName: timing.modelCalls[0]?.model ?? null,
    skippedModelRetry: Boolean(timing.meta.fallbackOrRetryEnd?.skippedModelRetry),
    modelCalls: timing.modelCalls,
    marks: { ...m },
  }

  return summary
}

/**
 * @param {ReturnType<typeof finalizeStoryBeatTiming>} summary
 */
export function logStoryBeatTiming(summary) {
  if (!summary) return
  console.group('[Yǔbàn] Story beat timing')
  console.table(summary)
  console.groupEnd()
}

/**
 * @param {ReturnType<typeof finalizeStoryBeatTiming>} summary
 */
export function formatTimingBreakdownLines(summary) {
  if (!summary) return []
  const lines = []
  const total = summary.totalContinueToVisibleMs ?? summary.totalWallMs
  lines.push(`Total: ${total != null ? `${total}ms` : '—'}`)
  if (summary.modelCall1Ms) lines.push(`Model call 1: ${summary.modelCall1Ms}ms`)
  if (summary.retryModelMs) lines.push(`Retry model call: ${summary.retryModelMs}ms`)
  if (summary.firestoreLatencyMs) lines.push(`Firestore writes: ${summary.firestoreLatencyMs}ms`)
  if (summary.promptBuildMs) lines.push(`Prompt build: ${summary.promptBuildMs}ms`)
  if (summary.parseMs) lines.push(`Parse/validate: ${summary.parseMs}ms`)
  if (summary.reactRenderMs) lines.push(`React render: ${summary.reactRenderMs}ms`)
  if (summary.coherenceMs) lines.push(`Coherence check: ${summary.coherenceMs}ms`)
  if (summary.fallbackMs) lines.push(`Fallback path: ${summary.fallbackMs}ms`)
  if (summary.retryReason) lines.push(`Retry/fallback reason: ${summary.retryReason}`)
  if (summary.fallbackUsed) lines.push(`Fallback used: yes`)
  if (summary.skippedModelRetry) lines.push(`Model retry skipped: yes (local fallback)`)
  if (summary.promptCharCount != null) {
    lines.push(`Prompt size: ${summary.promptCharCount} chars (~${summary.promptTokenEstimate ?? '?'} tokens)`)
  }
  if (summary.modelProvider) {
    lines.push(`Model: ${summary.modelProvider} / ${summary.modelName ?? 'unknown'}`)
  }
  return lines
}

export { PHASE_LABELS }
