/**
 * Pure deterministic drill validation for Context Journeys (Phase 5).
 * No React, Firebase, or AI imports.
 */
import { DRILL_TYPES } from './contextPackSchema.js'
import { fullTonelessPinyin, normalizeQuery } from '../../utils/pinyinIme.js'

/** @typedef {import('./contextPackSchema.js').Drill} Drill */
/** @typedef {import('./contextPackSchema.js').ContextStage} ContextStage */
/** @typedef {import('./contextProgressStore.js').StageStats} StageStats */

const CHINESE_PUNCT_RE = /[。，！？、；：""''（）【】《》…—·.!?,;:'"()\[\]{}\s-]/g

/**
 * @param {unknown} value
 */
export function normalizeTextAnswer(value) {
  if (value == null) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

/**
 * @param {unknown} value
 */
export function normalizeChineseAnswer(value) {
  if (value == null) return ''
  return String(value)
    .trim()
    .replace(CHINESE_PUNCT_RE, '')
    .replace(/\s+/g, '')
}

/**
 * @param {unknown} value
 */
export function normalizePinyinAnswer(value) {
  if (value == null) return ''
  const raw = String(value).trim().toLowerCase()
  if (!raw) return ''
  const prepped = raw
    .replace(/\s+/g, '')
    .replace(/u:/gi, 'v')
    .replace(/ü/g, 'v')
    .replace(/\u00fc/g, 'v')
  const fromMarked = fullTonelessPinyin(prepped)
  if (fromMarked) return fromMarked
  return normalizeQuery(prepped)
}

/**
 * @param {Drill} drill
 */
export function getDrillPromptText(drill) {
  if (drill.promptChinese) return drill.promptChinese
  return drill.prompt ?? ''
}

/**
 * @param {Drill} drill
 * @returns {string[]}
 */
export function getAcceptedAnswers(drill) {
  const primary = drill.answer ? [drill.answer] : []
  const extras = Array.isArray(drill.acceptedAnswers) ? drill.acceptedAnswers : []
  const pinyin = Array.isArray(drill.acceptedPinyin) ? drill.acceptedPinyin : []
  const samples = Array.isArray(drill.sampleAnswers) ? drill.sampleAnswers : []

  switch (drill.type) {
    case DRILL_TYPES.PINYIN_INPUT:
      return [...new Set([...primary, ...pinyin, ...extras].filter(Boolean))]
    case DRILL_TYPES.REPLY_SHORT:
      return [...new Set([...primary, ...extras, ...samples].filter(Boolean))]
    case DRILL_TYPES.MULTIPLE_CHOICE:
    case DRILL_TYPES.TRANSLATE_TO_CHINESE:
    case DRILL_TYPES.ARRANGE_SENTENCE:
    default:
      return [...new Set([...primary, ...extras].filter(Boolean))]
  }
}

/**
 * Flexible normalized comparison for Chinese text answers.
 * @param {unknown} userInput
 * @param {unknown} correctAnswer
 */
export function checkAnswer(userInput, correctAnswer) {
  const normalize = (str) =>
    String(str ?? '')
      .trim()
      .replace(/[。，！？、；：""''…\s]/g, '')
      .toLowerCase()

  const normalizedInput = normalize(userInput)
  const normalizedCorrect = normalize(correctAnswer)

  if (!normalizedInput || !normalizedCorrect) return false

  return (
    normalizedInput === normalizedCorrect ||
    normalizedInput.includes(normalizedCorrect) ||
    normalizedCorrect.includes(normalizedInput)
  )
}

/**
 * @param {Drill} drill
 * @param {string} userStr
 */
function matchesChineseDrillAnswer(drill, userStr) {
  const accepted = getAcceptedAnswers(drill)
  if (accepted.some((a) => checkAnswer(userStr, a))) return true

  const pinyinAccepts = drill.acceptedPinyin ?? []
  if (pinyinAccepts.length) {
    const userPinyin = normalizePinyinAnswer(userStr)
    return pinyinAccepts.some((p) => normalizePinyinAnswer(p) === userPinyin)
  }
  return false
}

/**
 * @param {unknown} userAnswer
 */
function isEmptyAnswer(userAnswer) {
  if (userAnswer == null) return true
  if (Array.isArray(userAnswer)) return userAnswer.length === 0
  return normalizeTextAnswer(userAnswer) === ''
}

/**
 * @param {string | string[]} answer
 */
function formatArrangeAnswer(answer) {
  if (Array.isArray(answer)) return answer.join('')
  return String(answer)
}

/**
 * @param {Drill} drill
 * @param {string | string[]} userAnswer
 */
export function checkDrillAnswer(drill, userAnswer) {
  if (isEmptyAnswer(userAnswer)) return false

  const accepted = getAcceptedAnswers(drill)

  switch (drill.type) {
    case DRILL_TYPES.MULTIPLE_CHOICE: {
      const choice = normalizeTextAnswer(userAnswer)
      return accepted.some((a) => normalizeTextAnswer(a) === choice)
    }
    case DRILL_TYPES.TRANSLATE_TO_CHINESE:
    case DRILL_TYPES.REPLY_SHORT:
    case DRILL_TYPES.ARRANGE_SENTENCE: {
      const userStr = formatArrangeAnswer(userAnswer)
      return matchesChineseDrillAnswer(drill, userStr)
    }
    case DRILL_TYPES.PINYIN_INPUT: {
      const userNorm = normalizePinyinAnswer(userAnswer)
      return accepted.some((a) => normalizePinyinAnswer(a) === userNorm)
    }
    default:
      return false
  }
}

/**
 * @param {Drill} drill
 * @param {boolean} wasCorrect
 */
export function getDrillResultMessage(drill, wasCorrect) {
  if (wasCorrect) {
    return drill.explanation ? `Nice! ${drill.explanation}` : 'Nice work — that is correct.'
  }
  if (drill.hint) return `Not quite. Hint: ${drill.hint}`
  return 'Not quite — give it another try.'
}

/**
 * @param {ContextStage} stage
 * @param {string[]} [completedDrillIds]
 * @returns {Drill | null}
 */
export function getNextIncompleteDrill(stage, completedDrillIds = []) {
  const completed = new Set(completedDrillIds)
  const drills = stage.drills ?? []
  return drills.find((d) => !completed.has(d.id)) ?? null
}

/**
 * @param {ContextStage} stage
 * @param {StageStats | null | undefined} stageStats
 */
export function getStageDrillSummary(stage, stageStats) {
  const total = stage.drills?.length ?? 0
  const completedDrillIds = stageStats?.completedDrillIds ?? []
  const completed = completedDrillIds.length
  const correct = stageStats?.correctDrills ?? 0
  const incorrect = stageStats?.incorrectDrills ?? 0
  const attempted = stageStats?.attemptedDrills ?? correct + incorrect
  const accuracy = attempted > 0 ? correct / attempted : 0

  return {
    total,
    completed,
    correct,
    incorrect,
    attempted,
    accuracy,
    allComplete: total > 0 && completed >= total,
    completedDrillIds,
  }
}
