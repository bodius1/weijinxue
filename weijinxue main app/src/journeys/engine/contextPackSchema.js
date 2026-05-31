/**
 * Context Journeys — data schema (plain JS + JSDoc).
 * Used by context packs, progress store (Phase 3), drills UI (Phase 5), guided Yǔbàn (Phase 6).
 * Dependency-free: no imports from React, Firebase, or IME modules.
 */

/** @readonly */
export const DRILL_TYPES = Object.freeze({
  MULTIPLE_CHOICE: 'multiple-choice',
  TRANSLATE_TO_CHINESE: 'translate-to-chinese',
  PINYIN_INPUT: 'pinyin-input',
  REPLY_SHORT: 'reply-short',
  ARRANGE_SENTENCE: 'arrange-sentence',
})

/** @readonly */
export const CONTEXT_PACK_IDS = Object.freeze({
  TIME_DATE: 'time-date',
})

/**
 * Vocabulary item shown on lesson nodes and referenced by drills / AI allow-lists.
 * @typedef {Object} TargetWord
 * @property {string} hanzi
 * @property {string} pinyin
 * @property {string} english
 * @property {1|2|3} [hskLevel]
 * @property {string} [notes]
 */

/**
 * Grammar / phrase pattern block for lesson UI and guided prompts.
 * @typedef {Object} Pattern
 * @property {string} id
 * @property {string} title
 * @property {string} structure
 * @property {string} explanation
 * @property {string[]} examples
 */

/**
 * Deterministic exercise (Phase 5 MiniDrillCard). Validators use `type` + answer fields.
 * @typedef {Object} Drill
 * @property {string} id
 * @property {typeof DRILL_TYPES[keyof typeof DRILL_TYPES]} type
 * @property {string} prompt
 * @property {string} [promptChinese]
 * @property {string} [answer]
 * @property {string[]} [acceptedAnswers]
 * @property {string[]} [acceptedPinyin]
 * @property {string[]} [choices]
 * @property {string[]} [tiles]
 * @property {string} [expectedIdea]
 * @property {string[]} [sampleAnswers]
 * @property {string} [explanation]
 * @property {string} [hint]
 * @property {string[]} [targetWords]  // hanzi strings; should match stage targetWords where possible
 */

/**
 * Guided Yǔbàn constraints for this stage (Phase 6 buildGuidedContextPrompt).
 * @typedef {Object} AiScenario
 * @property {string} setting
 * @property {string} learnerGoal
 * @property {string[]} allowedTopics
 * @property {string[]} [bannedTopics]
 * @property {string[]} allowedVocabulary
 * @property {string[]} [suggestedPrompts]
 * @property {string[]} [successSignals]
 * @property {number} maxNewWords
 * @property {number} maxSentenceLengthChineseChars
 */

/**
 * Unlock thresholds evaluated by contextUnlocks.js (Phase 3).
 * @typedef {Object} MasteryRequirement
 * @property {number} requiredCorrectDrills
 * @property {number} [requiredAiTurns]
 * @property {number} [minAccuracy]
 */

/**
 * Per-stage UI / prompt caps; increases by stage index in engine if omitted.
 * @typedef {Object} ComplexitySettings
 * @property {number} level
 * @property {boolean} pinyinVisible
 * @property {boolean} englishGlossVisible
 * @property {number} maxSentenceLengthChineseChars
 * @property {number} maxNewWordsPerTurn
 */

/**
 * One node on the journey roadmap.
 * @typedef {Object} ContextStage
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} [estimatedMinutes]
 * @property {string | null} unlocksAfter
 * @property {TargetWord[]} targetWords
 * @property {Pattern[]} patterns
 * @property {Drill[]} drills
 * @property {AiScenario} aiScenario
 * @property {MasteryRequirement} mastery
 * @property {ComplexitySettings} complexity
 */

/**
 * Top-level scenario (e.g. Time & Dates).
 * @typedef {Object} ContextPack
 * @property {string} id
 * @property {string} title
 * @property {string} [chineseTitle]
 * @property {string} description
 * @property {[number, number]} hskRange
 * @property {string} [icon]
 * @property {ContextStage[]} stages
 */

/**
 * @param {unknown} pack
 * @returns {pack is ContextPack}
 */
export function isContextPack(pack) {
  if (!pack || typeof pack !== 'object') return false
  const p = /** @type {ContextPack} */ (pack)
  return (
    typeof p.id === 'string' &&
    typeof p.title === 'string' &&
    Array.isArray(p.stages) &&
    p.stages.length > 0
  )
}

/**
 * @param {ContextPack} pack
 * @param {string} stageId
 * @returns {ContextStage | undefined}
 */
export function getStageById(pack, stageId) {
  return pack.stages.find((s) => s.id === stageId)
}

/**
 * @param {ContextPack} pack
 * @returns {ContextStage}
 */
export function getFirstStage(pack) {
  const first = pack.stages[0]
  if (!first) throw new Error(`Context pack "${pack.id}" has no stages`)
  return first
}

/**
 * @param {ContextPack} pack
 * @param {string} stageId
 * @returns {ContextStage | undefined}
 */
export function getNextStage(pack, stageId) {
  const i = pack.stages.findIndex((s) => s.id === stageId)
  if (i < 0 || i >= pack.stages.length - 1) return undefined
  return pack.stages[i + 1]
}

/**
 * Collect all hanzi from targetWords across a stage (for drill / AI validation helpers).
 * @param {ContextStage} stage
 * @returns {Set<string>}
 */
export function stageTargetHanziSet(stage) {
  return new Set(stage.targetWords.map((w) => w.hanzi))
}
