/**
 * Yǔbàn flexible grading schema — normalizes AI JSON to app shape.
 */
import { normalizeAlternatives } from '../grading/normalizeAlternatives.js'

/** @typedef {'correct' | 'almost' | 'wrong' | 'off_task' | 'skipped'} Evaluation */

/** @typedef {'correct' | 'almost' | 'incorrect' | 'off_task'} Verdict */

/**
 * @param {Verdict | string | undefined} verdict
 * @param {Record<string, unknown>} [parsed]
 * @returns {Evaluation}
 */
export function verdictToEvaluation(verdict, parsed = {}) {
  if (verdict === 'correct') return 'correct'
  if (verdict === 'almost') return 'almost'
  if (verdict === 'off_task') return 'off_task'
  if (verdict === 'incorrect') return 'wrong'
  if (parsed.taskCompleted === true && parsed.likelyTypo === true) return 'almost'
  return 'wrong'
}

/**
 * @param {string | undefined} legacy
 * @returns {Verdict | undefined}
 */
function legacyEvaluationToVerdict(legacy) {
  if (legacy === 'correct') return 'correct'
  if (legacy === 'almost') return 'almost'
  if (legacy === 'wrong') return 'incorrect'
  if (legacy === 'skipped') return undefined
  return undefined
}

/**
 * @param {unknown} voice
 * @param {string} defaultLabel
 */
function normalizeTeacherVoice(voice, defaultLabel = '老师 Lǎoshī') {
  const v = /** @type {Record<string, unknown>} */ (voice ?? {})
  const explanation = String(v.explanation ?? v.note ?? '').trim()
  return {
    label: defaultLabel,
    hanzi: String(v.hanzi ?? '').trim(),
    pinyin: String(v.pinyin ?? '').trim(),
    english: String(v.english ?? '').trim(),
    note: explanation,
  }
}

/**
 * @param {unknown} voice
 */
function normalizeFriendVoice(voice) {
  const v = /** @type {Record<string, unknown>} */ (voice ?? {})
  const label = String(v.label ?? '').trim()
  const noteParts = []
  if (label === 'above_current_level') {
    noteParts.push('Above your current level:')
  } else if (label === 'casual' || label === 'natural') {
    noteParts.push(label === 'casual' ? 'Casual answer:' : 'More natural:')
  }
  const note = String(v.note ?? '').trim()
  if (note) noteParts.push(note)
  return {
    label: '朋友 Péngyǒu',
    hanzi: String(v.hanzi ?? '').trim(),
    pinyin: String(v.pinyin ?? '').trim(),
    english: String(v.english ?? '').trim(),
    note: noteParts.join(' '),
    friendLabel: label || undefined,
  }
}

/**
 * @param {unknown} voice
 */
function normalizeBystanderVoice(voice) {
  const v = /** @type {Record<string, unknown>} */ (voice ?? {})
  const tip = String(v.tip ?? v.note ?? '').trim()
  return {
    label: '路人 Lùrén',
    note: tip,
  }
}

/**
 * @param {Record<string, unknown>} parsed
 * @param {Evaluation} evaluation
 */
export function buildMistakeRecord(parsed, evaluation) {
  const log = /** @type {Record<string, unknown>} */ (parsed.mistakeLog ?? {})
  if (log.shouldLog === false || evaluation === 'correct' || evaluation === 'skipped') {
    return null
  }

  const mistakeType = String(log.type ?? '').trim()
  if (mistakeType === 'none' || !mistakeType) {
    if (parsed.likelyTypo && parsed.likelyIntended) {
      return {
        type: 'character_selection_mistake',
        wrote: parsed.studentWrote,
        intended: parsed.likelyIntended,
        details: String(log.details ?? ''),
      }
    }
    if (evaluation === 'off_task') {
      return { type: 'off_task', details: String(log.details ?? '') }
    }
    return null
  }

  return {
    type: mistakeType,
    wrote: parsed.studentWrote,
    intended: parsed.likelyIntended,
    details: String(log.details ?? ''),
  }
}

/**
 * @param {Record<string, unknown>} parsed
 */
function buildEncouragement(parsed) {
  const verdict = String(parsed.verdict ?? '')
  if (verdict === 'correct') return 'Nice — you completed the task.'
  if (verdict === 'almost') return 'Close — you were on the right track.'
  if (verdict === 'off_task') return 'Good effort — let’s focus on what this moment needed.'
  return 'Keep going — short answers are fine at your level.'
}

/**
 * Normalizes new or legacy grader JSON into {@link import('./turnTypes.js').ThreeVoicesResponse}.
 * @param {unknown} parsed
 * @param {{ studentReply?: string, skipped?: boolean, recoveryApplied?: boolean }} [opts]
 */
export function normalizeGradingResponse(parsed, opts = {}) {
  const { studentReply = '', skipped = false, recoveryApplied = false } = opts

  if (skipped) {
    return {
      verdict: /** @type {const} */ ('correct'),
      evaluation: 'skipped',
      taskCompleted: false,
      voices: {
        laoshi: { label: '老师 Lǎoshī', note: 'Skipped this turn.' },
        pengyou: { label: '朋友 Péngyǒu' },
        luren: { label: '路人 Lùrén', note: '' },
      },
      alternatives: [],
      studentReply,
      recoveryApplied: false,
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid grading response')
  }

  const p = /** @type {Record<string, unknown>} */ (parsed)

  const isLegacy = Boolean(p.evaluation && /** @type {Record<string, unknown>} */ (p.voices ?? {}).laoshi)

  const verdict =
    (/** @type {Verdict | undefined} */ (p.verdict)) ??
    legacyEvaluationToVerdict(String(p.evaluation ?? '')) ??
    'incorrect'

  let evaluation = verdictToEvaluation(verdict, p)
  if (recoveryApplied && (verdict === 'correct' || verdict === 'almost')) {
    evaluation = 'correct'
  }

  const voicesRaw = /** @type {Record<string, unknown>} */ (p.voices ?? {})
  const laoshi = normalizeTeacherVoice(voicesRaw.teacher ?? voicesRaw.laoshi)
  const pengyou = normalizeFriendVoice(voicesRaw.friend ?? voicesRaw.pengyou)
  const luren = normalizeBystanderVoice(voicesRaw.bystander ?? voicesRaw.luren)

  const likelyIntended = String(p.likelyIntended ?? '').trim()
  const studentWrote = String(p.studentWrote ?? studentReply).trim()
  const allowRecoveryButton =
    Boolean(p.allowRecoveryButton) || (Boolean(p.likelyTypo) && Boolean(likelyIntended))
  const recoveryButtonText =
    String(p.recoveryButtonText ?? '').trim() ||
    (likelyIntended ? `I meant ${likelyIntended}` : '')

  const alternatives = normalizeAlternatives(p.alternatives)

  const mistakeRecord = buildMistakeRecord(p, evaluation)

  return {
    verdict,
    evaluation,
    taskType: String(p.taskType ?? ''),
    taskCompleted: Boolean(p.taskCompleted),
    naturalness: String(p.naturalness ?? ''),
    detectedIntent: String(p.detectedIntent ?? ''),
    likelyTypo: Boolean(p.likelyTypo),
    studentWrote,
    likelyIntended,
    allowRecoveryButton,
    recoveryButtonText,
    alternatives,
    voices: { laoshi, pengyou, luren },
    mistakeRecord,
    studentReplyAsHanzi: studentWrote || studentReply,
    encouragement: String(p.encouragement ?? '').trim() || buildEncouragement({ ...p, verdict }),
    studentReply,
    recoveryApplied,
  }
}

/**
 * Apply typo recovery to student text.
 * @param {string} original
 * @param {string} wrote
 * @param {string} intended
 */
export function applyRecoveryText(original, wrote, intended) {
  const o = String(original ?? '').trim()
  const w = String(wrote ?? '').trim()
  const i = String(intended ?? '').trim()
  if (!i) return o
  if (w && o.includes(w)) return o.replace(w, i)
  if (!o || o === w) return i
  return i
}

/**
 * Build mistake log entry for recovery tap.
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 * @param {{ wrote: string, intended: string, taskType?: string }} info
 */
export function buildRecoveryMistakeEntry(turn, state, { wrote, intended, taskType }) {
  return {
    type: 'character_selection_mistake',
    wrote,
    intended,
    prompt: turn.dialogue.hanzi,
    taskType: taskType || 'open_conversation',
    hskLevel: `HSK${state?.hskLevel ?? 1}`,
    recoveryApplied: true,
    timestamp: Date.now(),
  }
}
