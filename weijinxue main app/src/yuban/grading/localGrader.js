import { normalizeAlternatives } from './normalizeAlternatives.js'
import { normalizeGradingResponse } from '../conversation/gradingSchema.js'

/**
 * @param {string} s
 */
function norm(s) {
  return String(s ?? '')
    .trim()
    .replace(/[！!？?。，,\s]+$/g, '')
}

/**
 * @param {string} npcLine
 * @param {string} productionPrompt
 * @param {string} expectedPatternHint
 */
export function inferLocalTaskType(npcLine, productionPrompt, expectedPatternHint) {
  const blob = `${npcLine} ${productionPrompt} ${expectedPatternHint}`
  if (/你好|您好|早上好|欢迎|greeting|问候/i.test(blob)) return 'greeting'
  if (/[吗嗎]\s*$/.test(npcLine) || /要.*吗|吃饭吗|喝水吗|喝茶吗|米饭吗/i.test(npcLine)) {
    return 'yes_no_response'
  }
  if (/去哪里|去哪儿|去哪|哪里/.test(npcLine)) return 'asking_location'
  if (/吃什么|喝什么|要什么/i.test(npcLine)) return 'ordering_food'
  if (/谢谢|不客气/.test(npcLine)) return 'greeting'
  return 'short_answer'
}

/**
 * @param {object} p
 */
function buildGrade(p) {
  const verdict = p.evaluation === 'wrong' ? 'incorrect' : p.evaluation === 'off_task' ? 'off_task' : p.evaluation
  return normalizeGradingResponse({
    verdict,
    taskType: p.taskType,
    taskCompleted: p.taskCompleted ?? p.evaluation === 'correct',
    detectedIntent: p.detectedIntent ?? 'unknown',
    likelyTypo: p.likelyTypo ?? false,
    studentWrote: p.studentWrote ?? '',
    likelyIntended: p.likelyIntended ?? '',
    allowRecoveryButton: p.allowRecoveryButton ?? false,
    recoveryButtonText: p.recoveryButtonText ?? '',
    voices: {
      teacher: {
        hanzi: p.teacherHanzi ?? '',
        pinyin: p.teacherPinyin ?? '',
        english: p.teacherEnglish ?? '',
        explanation: p.teacherNote ?? '',
      },
      friend: {
        hanzi: p.friendHanzi ?? '',
        pinyin: p.friendPinyin ?? '',
        english: p.friendEnglish ?? '',
        label: p.friendLabel ?? 'natural',
        note: p.friendNote ?? '',
      },
      bystander: { tip: p.lurenNote ?? '' },
    },
    alternatives: normalizeAlternatives(p.alternatives ?? []),
    mistakeLog: { shouldLog: p.mistakeLog ?? false, type: p.mistakeType ?? 'none' },
  }, { studentReply: p.studentReply ?? '' })
}

/**
 * @param {{
 *   npcLine: string,
 *   npcEnglish?: string,
 *   taskType?: string,
 *   expectedPatternHint?: string,
 *   productionPrompt?: string,
 *   studentReply: string,
 *   hskLevel?: number,
 * }} input
 */
export function tryLocalGradeYubanTurn(input) {
  const hsk = Number(input.hskLevel ?? 1)
  if (hsk > 2) return { handled: false, normalizedGrade: null }

  const reply = norm(input.studentReply)
  const npc = input.npcLine ?? ''
  const taskType = input.taskType || inferLocalTaskType(npc, input.productionPrompt ?? '', input.expectedPatternHint ?? '')

  if (!reply || reply === '(skipped)') return { handled: false, normalizedGrade: null }

  const GREETINGS = new Set(['你好', '您好', '嗨', '早', '早上好', '你好吗', '谢谢', '谢谢你'])
  if (taskType === 'greeting' || /^你好|早上好|欢迎/.test(npc)) {
    if (GREETINGS.has(reply)) {
      const note =
        reply === '你好吗'
          ? 'Good! “你好吗？” works as a greeting reply. Simpler: 你好.'
          : reply === '早'
            ? 'Good! “早” is natural. Full form: 早上好.'
            : `Good! “${reply}” is a natural greeting.`
      return {
        handled: true,
        normalizedGrade: buildGrade({
          evaluation: 'correct',
          taskType: 'greeting',
          taskCompleted: true,
          detectedIntent: 'greeting',
          studentReply: reply,
          teacherNote: note,
          teacherHanzi: reply === '你好吗' ? '你好吗？' : reply,
          friendHanzi: reply === '你好吗' ? '你好啊！' : '你好！',
          friendNote: 'Casual and natural.',
          lurenNote: 'Short greeting replies are very common.',
          alternatives: ['你好', '你好吗', '早上好'],
        }),
      }
    }
  }

  const isOffer = /要.*吗|你要.*吗|吃饭吗|喝水吗|喝茶吗|米饭吗/i.test(npc)
  const AFF = new Set([
    '要',
    '是',
    '是的',
    '对',
    '我要',
    '吃',
    '喝',
    '好的',
    '好',
    '我饿了',
    '饿了',
    '我渴了',
    '渴了',
  ])
  const NEG = new Set(['不', '不要', '不吃', '不喝', '我不要', '不用', '不要，谢谢', '不用，谢谢', '谢谢，不要'])

  if (taskType === 'yes_no_response' || isOffer) {
    if (AFF.has(reply) || /^我要/.test(reply) || /^我想(吃|喝)/.test(reply)) {
      const wantsYao = /要|不要/.test(input.expectedPatternHint ?? '')
      const usedYao = reply === '要' || /^要/.test(reply)
      const alts = ['要', '是的', '对']
      if (/茶/.test(npc)) alts.push('我要喝茶')
      if (/水|喝/.test(npc)) alts.push('我要喝水', '我要水')
      if (/饭|吃/.test(npc)) alts.push('我要吃饭', '我饿了')
      return {
        handled: true,
        normalizedGrade: buildGrade({
          evaluation: 'correct',
          taskType: 'yes_no_response',
          taskCompleted: true,
          detectedIntent: 'affirmative',
          studentReply: reply,
          teacherNote:
            wantsYao && !usedYao
              ? 'Correct! “是的” answers the question. This task practices 要 (yào) — also try: 要.'
              : 'Correct! That works as a yes/no answer.',
          teacherHanzi: usedYao ? '要。' : '是的。',
          friendHanzi: /饭|吃/.test(npc) ? '要！' : '要。',
          friendNote: 'Natural short answer.',
          lurenNote: 'For 吗 questions, 要 or 是的 both work.',
          alternatives: alts,
        }),
      }
    }
    if (NEG.has(reply) || /^不/.test(reply)) {
      return {
        handled: true,
        normalizedGrade: buildGrade({
          evaluation: 'correct',
          taskType: 'yes_no_response',
          taskCompleted: true,
          detectedIntent: 'negative',
          studentReply: reply,
          teacherNote: 'Correct — a clear “no” answer.',
          teacherHanzi: '不要。',
          alternatives: ['不要', '不', '谢谢，不要'],
        }),
      }
    }
  }

  if (/喝|水|茶/.test(npc) && /和/.test(reply) && /我要/.test(reply) && !/喝/.test(reply)) {
    return {
      handled: true,
      normalizedGrade: buildGrade({
        evaluation: 'almost',
        taskType: 'yes_no_response',
        taskCompleted: true,
        detectedIntent: 'affirmative',
        likelyTypo: true,
        studentWrote: '和',
        likelyIntended: '喝',
        allowRecoveryButton: true,
        recoveryButtonText: 'I meant 喝',
        studentReply: reply,
        teacherNote:
          'Almost — you likely meant 喝 (hē, drink), not 和 (hé, and). Primary fix: 我要喝水. Simpler: 我要水.',
        teacherHanzi: '我要喝水。',
        teacherPinyin: 'Wǒ yào hē shuǐ.',
        teacherEnglish: 'I want to drink water.',
        alternatives: ['要', '我要水', '我要喝水'],
        mistakeLog: true,
        mistakeType: 'character_selection',
      }),
    }
  }

  if (/俄/.test(reply) && /饿|了/.test(reply.replace(/俄/g, '饿'))) {
    const fixed = reply.replace(/俄/g, '饿')
    return {
      handled: true,
      normalizedGrade: buildGrade({
        evaluation: 'correct',
        taskType: 'yes_no_response',
        taskCompleted: true,
        detectedIntent: 'affirmative',
        likelyTypo: true,
        studentWrote: '俄',
        likelyIntended: '饿',
        studentReply: reply,
        teacherNote: `Good! Use 饿 (è, hungry), not 俄 (é). Model: ${fixed}`,
        teacherHanzi: fixed,
        alternatives: ['我饿了', '要', '是的'],
      }),
    }
  }

  if (taskType === 'asking_location' || /去哪里|去哪儿/.test(npc)) {
    if (/去/.test(reply) && reply.length >= 2) {
      return {
        handled: true,
        normalizedGrade: buildGrade({
          evaluation: 'correct',
          taskType: 'asking_location',
          taskCompleted: true,
          detectedIntent: 'location_request',
          studentReply: reply,
          teacherNote: /想/.test(reply)
            ? 'Good! You can also say: 我要去我的房间.'
            : 'Good! You said where you want to go.',
          alternatives: ['我要去房间', '我想去房间', '去健身房'],
        }),
      }
    }
  }

  if (taskType === 'ordering_food' || /吃什么/.test(npc)) {
    if (/吃饭米饭|饭米饭/.test(reply)) {
      return {
        handled: true,
        normalizedGrade: buildGrade({
          evaluation: 'almost',
          taskType: 'ordering_food',
          taskCompleted: false,
          detectedIntent: 'food_request',
          studentReply: reply,
          teacherNote:
            'Almost — 吃饭 means “to eat (a meal)”; 米饭 is the food. Say: 我想吃米饭.',
          teacherHanzi: '我想吃米饭。',
          alternatives: ['我想吃米饭', '我要吃饭', '我要米饭'],
        }),
      }
    }
    if (/我要吃|我想吃|我要/.test(reply)) {
      return {
        handled: true,
        normalizedGrade: buildGrade({
          evaluation: 'correct',
          taskType: 'ordering_food',
          taskCompleted: true,
          detectedIntent: 'food_request',
          studentReply: reply,
          teacherNote: 'Correct! You said what you want to eat.',
          alternatives: ['我要吃饭', '我想吃米饭', '我要米饭'],
        }),
      }
    }
  }

  if (reply === '要' && isOffer) {
    const teaAlts = ['要', '是的', '对']
    if (/茶/.test(npc)) teaAlts.push('我要喝茶')
    else if (/水|喝/.test(npc)) teaAlts.push('我要喝水', '我要水')
    else teaAlts.push('我要喝茶', '我要喝水')

    return {
      handled: true,
      normalizedGrade: buildGrade({
        evaluation: 'correct',
        taskType: 'yes_no_response',
        taskCompleted: true,
        detectedIntent: 'affirmative',
        studentReply: reply,
        teacherNote: 'Correct! Short 要 is natural here.',
        teacherHanzi: '要。',
        friendHanzi: '要！',
        alternatives: teaAlts,
      }),
    }
  }

  return { handled: false, normalizedGrade: null }
}
