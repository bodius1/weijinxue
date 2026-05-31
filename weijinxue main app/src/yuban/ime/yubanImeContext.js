import { fullTonelessPinyin } from '../../utils/pinyinIme.js'
import { classifyVocabMastery } from '../helpers/vocabHelpers.js'
import { extractExpectedAnswerTokens } from './extractExpectedAnswerTokens.js'

/** Beginner syllable → preferred hanzi (layered boost, not exclusive). */
export const BEGINNER_SYLLABLE_BOOSTS = {
  yao: ['要', '药'],
  zao: ['早', '早上', '早上好'],
  hao: ['好', '你好', '早上好', '不好', '好吗'],
  ni: ['你', '你好', '您'],
  wo: ['我', '我们'],
  qu: ['去', '出去'],
  chi: ['吃', '吃饭'],
  fan: ['饭', '米饭', '吃饭', '饭店'],
  shui: ['水', '喝水'],
  cha: ['茶', '喝茶'],
  shi: ['是', '是的', '十'],
  bu: ['不', '不要', '不错'],
  ma: ['吗', '妈', '马'],
  na: ['哪', '那'],
  li: ['里', '里面'],
  fangjian: ['房间'],
  jianshenfang: ['健身房'],
  xie: ['谢', '谢谢'],
  duo: ['多', '多少'],
  qian: ['钱', '多少钱'],
}

import { extractHanziRuns } from './extractHanzi.js'

export { extractHanziRuns } from './extractHanzi.js'

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 * @param {{
 *   productionPrompt?: string,
 *   expectedHint?: string,
 *   npcDialogueHanzi?: string,
 * }} turnHints
 */
export function buildYubanImeContext(state, turnHints = {}) {
  const hskLevel = Number(state?.hskLevel ?? 1)
  const classified = classifyVocabMastery(state ?? {})

  /** @type {Set<string>} */
  const taskHanzi = new Set()
  /** @type {Set<string>} */
  const expectedHanzi = new Set()
  /** @type {Set<string>} */
  const warmHanzi = new Set()
  /** @type {Set<string>} */
  const masteredHanzi = new Set()

  for (const text of [
    turnHints.npcDialogueHanzi,
    turnHints.productionPrompt,
    turnHints.expectedHint,
  ]) {
    for (const run of extractHanziRuns(text)) {
      taskHanzi.add(run)
      for (const ch of [...run]) expectedHanzi.add(ch)
    }
  }

  for (const [hanzi, v] of Object.entries(classified)) {
    if (v.mastery === 'warm') warmHanzi.add(hanzi)
    if (v.mastery === 'mastered') masteredHanzi.add(hanzi)
  }

  for (const p of Object.values(state?.patternMastery ?? {})) {
    if (p.status === 'mastered' && p.label) {
      for (const run of extractHanziRuns(String(p.label))) {
        for (const ch of [...run]) masteredHanzi.add(ch)
      }
    }
  }

  const expectedAnswerTokens = extractExpectedAnswerTokens(
    turnHints.expectedHint,
    turnHints.productionPrompt,
  )
  /** @type {Set<string>} */
  const expectedAnswerSet = new Set(expectedAnswerTokens)
  for (const token of expectedAnswerTokens) {
    taskHanzi.add(token)
    for (const ch of [...token]) expectedHanzi.add(ch)
  }

  const promptBlob = `${turnHints.productionPrompt ?? ''} ${turnHints.expectedHint ?? ''} ${turnHints.npcDialogueHanzi ?? ''}`
  /** @type {Record<string, string[]>} */
  const syllableBoosts = { ...BEGINNER_SYLLABLE_BOOSTS }
  if (/哪|哪里|去哪儿|去哪里|房间|饭店|健身房|学校/.test(promptBlob)) {
    syllableBoosts.na = ['哪', '那']
  }

  /** @type {Map<string, string[]>} */
  const phraseByQueryPrefix = new Map()
  for (const run of [...taskHanzi].sort((a, b) => b.length - a.length)) {
    const pin = fullTonelessPinyin(run)
    if (!pin || pin.length < 2) continue
    for (let len = 1; len <= pin.length; len++) {
      const pre = pin.slice(0, len)
      const list = phraseByQueryPrefix.get(pre) ?? []
      if (!list.includes(run)) list.push(run)
      phraseByQueryPrefix.set(pre, list)
    }
  }

  return {
    hskLevel,
    taskHanzi,
    expectedHanzi,
    expectedAnswerTokens,
    expectedAnswerSet,
    warmHanzi,
    masteredHanzi,
    phraseByQueryPrefix,
    syllableBoosts,
    productionPrompt: turnHints.productionPrompt ?? '',
    expectedHint: turnHints.expectedHint ?? '',
    npcDialogueHanzi: turnHints.npcDialogueHanzi ?? '',
  }
}

/** @typedef {ReturnType<typeof buildYubanImeContext>} YubanImeContext */
