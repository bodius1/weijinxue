import { buildThreeVoicesGradingPromptCompact } from '../conversation/buildGradingPrompt.js'
import { normalizeGradingResponse } from '../conversation/gradingSchema.js'
import { applyGradingOverrides } from '../conversation/gradingOverrides.js'
import { parseAIJson, validateThreeVoices } from '../conversation/parseAIResponse.js'
import { tryLocalGradeYubanTurn, inferLocalTaskType } from './localGrader.js'
import { buildGradeCacheKey, getCachedGrade, setCachedGrade } from './gradeCache.js'
import {
  readTokenBudget,
  updateTokenBudget,
  recordLlmUsage,
  recordTokensSaved,
} from './tokenBudget.js'
import { estimateTokenCount } from '../dev/storyBeatTiming.js'

/**
 * @typedef {'local_grader' | 'cache' | 'llm'} GradingSource
 */

/**
 * @typedef {{
 *   normalized: import('../conversation/turnTypes.js').ThreeVoicesResponse,
 *   source: GradingSource,
 *   tokensSavedEstimate?: number,
 *   promptChars?: number,
 *   voicesPrompt?: string | null,
 *   voicesRaw?: string | null,
 *   voicesParsed?: unknown,
 * }} GradeResult
 */

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState} state
 * @param {import('../conversation/turnTypes.js').StoryBeatTurn} turn
 * @param {string} studentReply
 * @param {(systemPrompt: string, userMessage: string) => Promise<string>} callAI
 * @param {{ recoveryNote?: string }} [opts]
 */
export async function gradeYubanTurn(state, turn, studentReply, callAI, opts = {}) {
  const hskLevel = Number(state?.hskLevel ?? 1)
  const npcLine = turn.dialogue?.hanzi ?? ''
  const taskType = inferLocalTaskType(npcLine, turn.productionPrompt ?? '', turn.expectedPatternHint ?? '')

  const cacheKey = buildGradeCacheKey({
    npcLine,
    taskType,
    expectedPatternHint: turn.expectedPatternHint ?? '',
    studentReply,
    hskLevel,
  })

  const cached = getCachedGrade(cacheKey, studentReply)
  if (cached) {
    const b = readTokenBudget()
    updateTokenBudget({ cachedGrades: b.cachedGrades + 1 })
    recordTokensSaved(6500)
    return {
      normalized: applyGradingOverrides(turn, studentReply, cached, state),
      source: 'cache',
      tokensSavedEstimate: estimateTokenCount('x'.repeat(6500)),
    }
  }

  const local = tryLocalGradeYubanTurn({
    npcLine,
    npcEnglish: turn.dialogue?.english,
    taskType,
    expectedPatternHint: turn.expectedPatternHint,
    productionPrompt: turn.productionPrompt,
    studentReply,
    hskLevel,
    scenario: state.currentScenario,
  })

  if (local.handled && local.normalizedGrade) {
    const normalized = applyGradingOverrides(turn, studentReply, local.normalizedGrade, state)
    setCachedGrade(cacheKey, serializeForCache(normalized))
    const b = readTokenBudget()
    updateTokenBudget({ localGrades: b.localGrades + 1 })
    recordTokensSaved(6500)
    return {
      normalized,
      source: 'local_grader',
      tokensSavedEstimate: estimateTokenCount('x'.repeat(6500)),
    }
  }

  const voicesPrompt = buildThreeVoicesGradingPromptCompact(state, turn, studentReply, opts)
  const promptChars = voicesPrompt.length
  const voicesRaw = await callAI(voicesPrompt, `Student replied: ${studentReply}`)
  recordLlmUsage({ inputChars: promptChars, outputChars: voicesRaw.length })

  const voicesParsed = parseAIJson(voicesRaw)
  validateThreeVoices(voicesParsed)

  let normalized = normalizeGradingResponse(voicesParsed, { studentReply })
  normalized = applyGradingOverrides(turn, studentReply, normalized, state)

  setCachedGrade(cacheKey, serializeForCache(normalized))

  return {
    normalized,
    source: 'llm',
    promptChars,
    voicesPrompt,
    voicesRaw,
    voicesParsed,
    tokensSavedEstimate: 0,
  }
}

/**
 * @param {import('../conversation/turnTypes.js').ThreeVoicesResponse} n
 */
function serializeForCache(n) {
  return {
    verdict: n.verdict,
    taskType: n.taskType,
    taskCompleted: n.taskCompleted,
    likelyTypo: n.likelyTypo,
    studentWrote: n.studentWrote,
    likelyIntended: n.likelyIntended,
    voices: {
      teacher: {
        hanzi: n.voices.laoshi.hanzi,
        pinyin: n.voices.laoshi.pinyin,
        english: n.voices.laoshi.english,
        explanation: n.voices.laoshi.note,
      },
      friend: {
        hanzi: n.voices.pengyou.hanzi,
        pinyin: n.voices.pengyou.pinyin,
        english: n.voices.pengyou.english,
        label: n.voices.pengyou.friendLabel ?? 'natural',
        note: n.voices.pengyou.note,
      },
      bystander: { tip: n.voices.luren.note },
    },
    alternatives: n.alternatives,
    mistakeLog: n.mistakeRecord ? { shouldLog: true, type: n.mistakeRecord.type } : { shouldLog: false },
  }
}
